"""Public Instagram webhook receiver.

Meta sends two kinds of requests to this endpoint:

1. **Verification** — once, when we configure the webhook on the Meta
   App. ``GET /webhooks/instagram?hub.mode=subscribe&hub.challenge=X
   &hub.verify_token=<configured>`` → must echo ``hub.challenge`` back.

2. **Event delivery** — ``POST /webhooks/instagram`` with the event
   batch. Signed via ``X-Hub-Signature-256`` HMAC of the raw body
   using our Meta App Secret.

Because LeadForge owns ONE Meta App, all tenants' webhooks land here.
We resolve the tenant by walking the ``entry[].id`` (the Instagram
Business Account id) back to an Integration row.

Each event is normalised into a ``(event_type, payload)`` pair and
handed to:

  * ``message_persistence.upsert_inbound_message`` — dedup + persist
  * ``rule_engine.evaluate_event`` — fire matching rules

The handler returns 200 to Meta as fast as it can — Meta retries
non-2xx responses for up to 24 hours, so we want every successful
delivery to acknowledge promptly even if rule evaluation took a beat.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select

from core.config import settings
from core.database import AsyncSessionLocal, get_db_session
from models.integration import Integration
from services.integrations import get_integration
from services.social import message_persistence as mp
from services.social import rule_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/instagram", tags=["social-webhooks"])


# ---------------------------------------------------------------------
# 1) Verification handshake
# ---------------------------------------------------------------------

@router.get("", response_class=PlainTextResponse)
async def verify_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
):
    """Echo the hub.challenge if hub.verify_token matches the env var."""
    expected = settings.META_WEBHOOK_VERIFY_TOKEN or ""
    if hub_mode != "subscribe" or hub_verify_token != expected:
        raise HTTPException(status_code=403, detail="Verification failed")
    return PlainTextResponse(content=hub_challenge or "")


# ---------------------------------------------------------------------
# 2) Tenant resolution
# ---------------------------------------------------------------------

async def _find_tenant_for_ig_business(
    ig_business_id: str,
) -> Optional[UUID]:
    """Walk every Integration(provider=instagram_dm) and decrypt its
    credentials to find which tenant owns the IG Business id.

    O(n) over connected tenants but n is small in practice (one row
    per tenant); fine for Phase 1. If this becomes hot we'll add a
    materialised view ``social_account_to_tenant`` later.
    """
    from core.crypto import decrypt_json

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Integration).where(
                Integration.provider == "instagram_dm",
                Integration.status == "connected",
            )
        )
        for row in result.scalars().all():
            try:
                creds = decrypt_json(row.credentials_encrypted)
            except Exception:  # noqa: BLE001
                continue
            if (creds or {}).get("instagram_business_id") == ig_business_id:
                return row.tenant_id
    return None


# ---------------------------------------------------------------------
# 3) Event normalisation
# ---------------------------------------------------------------------

def _normalise_messaging_event(
    item: dict[str, Any], ig_business_id: str
) -> Optional[tuple[str, dict[str, Any]]]:
    """Translate one ``messaging`` entry → (event_type, payload).

    Instagram DMs arrive under ``entry[].messaging[]`` with a
    ``sender.id`` (IGSID) and ``message.text`` / ``message.mid``.
    Story replies and reactions come through the same channel with
    different sub-keys.
    """
    sender = (item.get("sender") or {}).get("id")
    if not sender:
        return None
    message = item.get("message") or {}
    if message.get("text"):
        return (
            "dm.received",
            {
                "external_user_id": sender,
                "external_message_id": message.get("mid"),
                "comment_text": None,
                "message_text": message.get("text"),
                "received_at": item.get("timestamp"),
                "is_echo": message.get("is_echo", False),
                "ig_business_id": ig_business_id,
            },
        )
    if message.get("reaction"):
        return (
            "story_reaction.received",
            {
                "external_user_id": sender,
                "external_message_id": message.get("mid"),
                "reaction": message.get("reaction"),
                "ig_business_id": ig_business_id,
            },
        )
    if (item.get("postback") or {}).get("payload"):
        # Quick-reply tap — treat as a DM with the payload as text.
        return (
            "dm.received",
            {
                "external_user_id": sender,
                "external_message_id": item.get("postback", {}).get("mid"),
                "message_text": item["postback"]["payload"],
                "ig_business_id": ig_business_id,
            },
        )
    return None


def _normalise_change_event(
    change: dict[str, Any], ig_business_id: str
) -> Optional[tuple[str, dict[str, Any]]]:
    """Translate one ``changes`` entry → (event_type, payload).

    Comments arrive as ``field='comments', value={id, text, from, media}``.
    Mentions arrive as ``field='mentions'``.
    """
    field = change.get("field")
    value = change.get("value") or {}

    if field == "comments":
        sender = (value.get("from") or {}).get("id")
        if not sender:
            return None
        media = value.get("media") or {}
        return (
            "comment.received",
            {
                "external_user_id": sender,
                "external_message_id": value.get("id"),
                "comment_text": value.get("text"),
                "post_id": media.get("id"),
                "media_url": media.get("media_url"),
                "permalink": media.get("permalink"),
                "username": (value.get("from") or {}).get("username"),
                "ig_business_id": ig_business_id,
            },
        )
    if field == "mentions":
        media_id = value.get("media_id")
        return (
            "mention.received",
            {
                "external_message_id": value.get("comment_id"),
                "post_id": media_id,
                "ig_business_id": ig_business_id,
            },
        )
    return None


# ---------------------------------------------------------------------
# 4) POST event delivery
# ---------------------------------------------------------------------

@router.post("")
async def receive_webhook(request: Request):
    """Top-level Instagram webhook handler.

    Signature verification → tenant resolution → event normalisation
    → persist + evaluate. Returns 200 to Meta even on partial failure
    so we don't get the same delivery retried for 24 hours; partial
    errors land in the logs + integration_events.
    """
    raw = await request.body()

    # 1) Signature verification (using the Meta App Secret, not a per-tenant value).
    plugin_cls = get_integration("instagram_dm")
    if plugin_cls is None:
        logger.error("instagram_dm plugin missing — webhook receiver disabled")
        return {"ok": False, "error": "plugin missing"}
    # Build a dummy plugin instance for the signature helper. The
    # method only needs the secret + body; it doesn't touch
    # `self.credentials`.
    dummy = plugin_cls.__new__(plugin_cls)
    dummy.credentials = {}
    dummy.config = {}
    if not settings.META_APP_SECRET:
        logger.warning(
            "META_APP_SECRET unset — webhook signature check is disabled. "
            "Production deploys MUST configure it."
        )
    elif not await dummy.verify_webhook_signature(
        raw, dict(request.headers), settings.META_APP_SECRET
    ):
        raise HTTPException(status_code=401, detail="bad signature")

    # 2) Parse + iterate entries.
    try:
        body = json.loads(raw or b"{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="invalid JSON")
    entries = body.get("entry") or []
    if not entries:
        return {"ok": True, "processed": 0}

    processed = 0
    for entry in entries:
        ig_business_id = str(entry.get("id") or "")
        if not ig_business_id:
            continue
        tenant_id = await _find_tenant_for_ig_business(ig_business_id)
        if not tenant_id:
            logger.info(
                "webhook event for unknown IG business id %s — ignoring",
                ig_business_id,
            )
            continue

        # Normalise into (event_type, payload) tuples.
        events: list[tuple[str, dict[str, Any]]] = []
        for m in entry.get("messaging") or []:
            n = _normalise_messaging_event(m, ig_business_id)
            if n:
                events.append(n)
        for c in entry.get("changes") or []:
            n = _normalise_change_event(c, ig_business_id)
            if n:
                events.append(n)

        # Persist + evaluate per event in a tenant-scoped session.
        async for db in get_db_session(tenant_id):
            for event_type, payload in events:
                if payload.get("is_echo"):
                    # Skip our own outbound DMs that Meta echoes back.
                    continue

                # Persist inbound message + dedup.
                received_at = (
                    datetime.fromtimestamp(
                        int(payload["received_at"]) / 1000, tz=timezone.utc
                    )
                    if payload.get("received_at")
                    else datetime.now(timezone.utc)
                )
                msg, convo, dup = await mp.upsert_inbound_message(
                    db,
                    tenant_id=tenant_id,
                    platform="instagram",
                    external_user_id=payload["external_user_id"],
                    external_message_id=payload.get("external_message_id"),
                    source=event_type.split(".")[0],
                    content=payload.get("message_text") or payload.get("comment_text"),
                    handle=payload.get("username"),
                    received_at=received_at,
                )
                if dup:
                    continue

                # Fire rules.
                try:
                    await rule_engine.evaluate_event(
                        db,
                        tenant_id,
                        event_type=event_type,
                        event_payload=payload,
                        platform="instagram",
                        social_account_id=(convo.social_account_id if convo else None),
                        social_message_id=(msg.id if msg else None),
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.exception(
                        "rule_engine crashed for tenant=%s event=%s: %s",
                        tenant_id,
                        event_type,
                        exc,
                    )
                processed += 1

    # Always 200 — see docstring.
    return {"ok": True, "processed": processed}
