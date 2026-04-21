"""Outbound webhook dispatcher for tenant-configured subscriptions.

Iterates active :class:`WebhookSubscription` rows for a given
``(tenant_id, event_type)``, signs the payload with each row's HMAC
secret, POSTs it to the configured URL with one shot-of-retries, and
records the outcome on the row itself plus in the ``integration_events``
audit table. Designed to be fire-and-forget from the business-logic
site: ``await publish_event(db, tenant_id, "lead.created", lead_data)``.

Delivery rules
--------------
* 3 attempts total with 15s / 60s backoff between attempts.
* Timeout per attempt: 10 seconds.
* Private IP ranges (127.*, 10.*, 192.168.*, 172.16-31.*) are rejected
  at dispatch time to mitigate SSRF via a misconfigured webhook URL.
* Each delivery writes ``X-LeadForge-Event`` / ``X-LeadForge-Signature``
  / ``X-LeadForge-Delivery-Id`` headers.

Non-goals
---------
No queue. If the dispatcher crashes mid-delivery, the subscription's
``last_error`` reflects what happened but there is no replay. That's
fine for a single-tenant SaaS starter; a real queue would be a
follow-up.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import ipaddress
import json
import logging
import socket
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import urlparse
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.crypto import decrypt_str
from core.database import AsyncSessionLocal
from models.integration_event import IntegrationEvent
from models.webhook_subscription import WebhookSubscription

logger = logging.getLogger(__name__)

_ATTEMPT_BACKOFFS_S = (15, 60)  # retry 1 → wait 15s → retry 2 → wait 60s → give up
_HTTP_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


def _is_private_host(url: str) -> bool:
    """Return True if the URL targets a private / loopback / link-local
    address — we refuse to POST to these to avoid SSRF.

    Best-effort: if DNS fails we return False and let the HTTP layer
    fail loudly instead (that's strictly less risky than blocking a
    flaky DNS resolution that could still go to a public IP)."""
    try:
        host = urlparse(url).hostname or ""
        if not host:
            return True
        infos = socket.getaddrinfo(host, None)
    except (socket.gaierror, UnicodeError):
        return False
    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast:
            return True
    return False


def _sign_payload(secret: str, body: bytes) -> str:
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


async def _deliver_once(
    url: str,
    headers: dict[str, str],
    body: bytes,
) -> tuple[bool, Optional[int], Optional[str]]:
    """One HTTP attempt. Returns (ok, status_code, error_message)."""
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT, follow_redirects=False) as client:
            resp = await client.post(url, content=body, headers=headers)
    except httpx.HTTPError as exc:
        return False, None, f"network: {exc}"
    return resp.status_code // 100 == 2, resp.status_code, (
        None if resp.status_code // 100 == 2
        else f"HTTP {resp.status_code}: {resp.text[:200]}"
    )


async def _deliver_subscription(
    sub: WebhookSubscription,
    event_type: str,
    payload: dict[str, Any],
    tenant_id: UUID,
) -> tuple[bool, Optional[str]]:
    """Try to deliver to ONE subscription with retries.

    Returns (final_ok, final_error_message). Uses a dedicated short-lived
    AsyncSessionLocal so the caller's request lifecycle doesn't block
    the HTTP attempts.
    """
    if _is_private_host(sub.url):
        return False, "Private / loopback URLs are rejected for security."

    delivery_id = str(uuid.uuid4())
    secret = decrypt_str(sub.secret_encrypted) if sub.secret_encrypted else ""
    body_bytes = json.dumps(
        {
            "event": event_type,
            "tenant_id": str(tenant_id),
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "data": payload,
        },
        default=str,
    ).encode("utf-8")

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "LeadForge-Webhook/1.0",
        "X-LeadForge-Event": event_type,
        "X-LeadForge-Delivery-Id": delivery_id,
    }
    if secret:
        headers["X-LeadForge-Signature"] = _sign_payload(secret, body_bytes)

    last_error: Optional[str] = None
    last_status: Optional[int] = None
    for attempt in range(len(_ATTEMPT_BACKOFFS_S) + 1):
        ok, status, err = await _deliver_once(sub.url, headers, body_bytes)
        last_status = status
        last_error = err
        if ok:
            return True, None
        if attempt < len(_ATTEMPT_BACKOFFS_S):
            await asyncio.sleep(_ATTEMPT_BACKOFFS_S[attempt])

    return False, last_error or f"Failed after retries (status={last_status})"


async def _record_outcome(
    tenant_id: UUID,
    subscription_id: UUID,
    event_type: str,
    ok: bool,
    error: Optional[str],
    payload: dict[str, Any],
) -> None:
    """Update the subscription row + append an audit event.

    Uses its own isolated AsyncSessionLocal so we don't contend with
    the request-scoped session and the write survives even if the
    caller's transaction is rolled back for unrelated reasons.
    """
    try:
        async with AsyncSessionLocal() as session:
            # RLS needs the tenant setting to UPDATE webhook_subscriptions
            await session.execute(
                # pylint: disable=c-extension-no-member
                __import__("sqlalchemy").text(
                    f"SET LOCAL app.current_tenant = '{tenant_id}'"
                )
            )
            sub = await session.get(WebhookSubscription, subscription_id)
            if sub is not None:
                sub.last_delivery_at = datetime.now(timezone.utc)
                if ok:
                    sub.last_error = None
                    sub.failure_count = 0
                else:
                    sub.last_error = (error or "")[:500]
                    sub.failure_count = (sub.failure_count or 0) + 1

            session.add(
                IntegrationEvent(
                    tenant_id=tenant_id,
                    integration_id=None,
                    direction="outbound",
                    event_type=event_type,
                    status="ok" if ok else "failed",
                    error=(error[:500] if error else None),
                    payload={
                        "subscription_id": str(subscription_id),
                        "preview": {k: payload.get(k) for k in list(payload)[:3]},
                    },
                )
            )
            await session.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to record webhook outcome: %s", exc)


async def publish_event(
    db: AsyncSession,
    tenant_id: UUID,
    event_type: str,
    payload: dict[str, Any],
) -> None:
    """Fan out an event to every active subscription that subscribes to it.

    Safe to ``await`` from inside a request handler. Each subscription
    is delivered concurrently with ``asyncio.gather``; failures on one
    never block others.
    """
    result = await db.execute(
        select(WebhookSubscription).where(
            WebhookSubscription.tenant_id == tenant_id,
            WebhookSubscription.is_active.is_(True),
        )
    )
    subs = [
        s
        for s in result.scalars().all()
        if event_type in (s.event_types or [])
    ]
    if not subs:
        return

    async def _one(sub: WebhookSubscription) -> None:
        ok, err = await _deliver_subscription(sub, event_type, payload, tenant_id)
        await _record_outcome(tenant_id, sub.id, event_type, ok, err, payload)

    # Deliver concurrently; don't let one slow endpoint block the others.
    await asyncio.gather(*(_one(s) for s in subs), return_exceptions=True)


async def test_deliver(sub: WebhookSubscription, tenant_id: UUID) -> dict[str, Any]:
    """Synchronous test-delivery for the "Send test" button in the UI.

    No retries — we want the user to see the actual first-attempt error
    immediately rather than wait 75 seconds.
    """
    if _is_private_host(sub.url):
        return {
            "ok": False,
            "error": "Private / loopback URLs are rejected.",
        }
    secret = decrypt_str(sub.secret_encrypted) if sub.secret_encrypted else ""
    body_bytes = json.dumps(
        {
            "event": "ping",
            "tenant_id": str(tenant_id),
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "data": {"test": True},
        }
    ).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "LeadForge-Webhook/1.0",
        "X-LeadForge-Event": "ping",
        "X-LeadForge-Delivery-Id": str(uuid.uuid4()),
    }
    if secret:
        headers["X-LeadForge-Signature"] = _sign_payload(secret, body_bytes)
    ok, status, err = await _deliver_once(sub.url, headers, body_bytes)
    return {"ok": ok, "status_code": status, "error": err}
