"""Email sending service — per-tenant aware.

Every call resolves the tenant's SendGrid integration first; if the tenant
has one connected (via the Integrations page → SendGrid), we send through
their API key. Otherwise we fall back to the platform-wide
``SENDGRID_API_KEY`` env var so single-tenant deploys keep working.

The legacy ``send_email(to, subject, body)`` API is kept as a thin shim for
backwards compatibility. New callers should use
``send_email_for_tenant(db, tenant_id, ...)``.
"""

from __future__ import annotations

import logging
from typing import Any, Optional
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.crypto import decrypt_json
from models.integration import Integration
from services.integrations import get_integration

logger = logging.getLogger(__name__)

_SENDGRID_BASE = "https://api.sendgrid.com/v3"


class EmailService:
    """Tenant-aware email sender.

    - ``send_email_for_tenant`` — resolves per-tenant SendGrid integration
      first, falls back to ``SENDGRID_API_KEY`` env var.
    - ``send_email`` (legacy) — env-var only. Kept for callers that don't
      yet have a tenant context.
    """

    def __init__(self) -> None:
        self.global_api_key = settings.SENDGRID_API_KEY
        self.global_from_email = settings.SENDGRID_FROM_EMAIL
        self.enabled_globally = bool(self.global_api_key)

    # ------------------------------------------------------------------
    # Legacy env-var-only path
    # ------------------------------------------------------------------

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        from_name: str = "AveonApex",
    ) -> dict[str, Any]:
        """Send via the platform-wide SENDGRID_API_KEY. Prefer
        :meth:`send_email_for_tenant` in new code."""
        if not self.enabled_globally:
            logger.warning(
                "SendGrid global fallback not configured (SENDGRID_API_KEY "
                "missing). Use send_email_for_tenant with a tenant instead."
            )
            return {
                "status": "skipped",
                "message_id": None,
                "error": "SendGrid not configured",
            }
        return await self._send_via_api(
            api_key=self.global_api_key,
            from_email=self.global_from_email,
            from_name=from_name,
            to_email=to_email,
            subject=subject,
            body_html=body,
        )

    # ------------------------------------------------------------------
    # New tenant-aware path
    # ------------------------------------------------------------------

    async def _load_tenant_integration(
        self,
        db: AsyncSession,
        tenant_id: UUID,
    ) -> Optional[Integration]:
        """Return the tenant's active SendGrid integration, or None."""
        result = await db.execute(
            select(Integration).where(
                Integration.tenant_id == tenant_id,
                Integration.provider == "sendgrid",
            )
        )
        row = result.scalar_one_or_none()
        if row and row.credentials_encrypted and row.status == "connected":
            return row
        if row and row.credentials_encrypted:
            # Accept even "error" / "disconnected" rows if they have creds —
            # the send itself is the authoritative health check.
            return row
        return None

    async def send_email_for_tenant(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
        from_name: str = "AveonApex",
        from_email_override: Optional[str] = None,
    ) -> dict[str, Any]:
        """Send an email on behalf of a specific tenant.

        Resolution order:
        1. Tenant's SendGrid integration → decrypt api_key, use config's
           from_email if set, call the plugin's ``push_event("email", …)``
           so the same validation / error translation as the Integrations
           page applies.
        2. Platform-wide ``SENDGRID_API_KEY`` env var (legacy path).
        3. Skip with a structured error.
        """
        integration = await self._load_tenant_integration(db, tenant_id)

        if integration:
            plugin_cls = get_integration("sendgrid")
            if plugin_cls is None:
                logger.error("SendGrid plugin not registered — check plugin registry")
                return {
                    "status": "failed",
                    "message_id": None,
                    "error": "SendGrid plugin missing",
                }
            try:
                plugin = plugin_cls(
                    integration,
                    credentials=decrypt_json(integration.credentials_encrypted),
                )
                result = await plugin.push_event(
                    "email",
                    {
                        "to": to_email,
                        "subject": subject,
                        "body_html": body_html,
                        "body_text": body_text,
                        "from_email": from_email_override,
                        "from_name": from_name,
                    },
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "SendGrid push_event crashed for tenant=%s", tenant_id
                )
                return {"status": "failed", "message_id": None, "error": str(exc)}

            if result.get("ok"):
                return {
                    "status": "sent",
                    "message_id": result.get("message_id"),
                    "provider": "sendgrid_tenant",
                }
            return {
                "status": "failed",
                "message_id": None,
                "error": result.get("error") or "Unknown provider error",
                "provider": "sendgrid_tenant",
            }

        # Fallback to the env-var path
        if self.enabled_globally:
            logger.info(
                "Tenant %s has no SendGrid integration — using env-var fallback",
                tenant_id,
            )
            from_email = from_email_override or self.global_from_email
            return await self._send_via_api(
                api_key=self.global_api_key,
                from_email=from_email,
                from_name=from_name,
                to_email=to_email,
                subject=subject,
                body_html=body_html,
                body_text=body_text,
            )

        return {
            "status": "skipped",
            "message_id": None,
            "error": (
                "Email is not configured for this tenant. Connect SendGrid "
                "from the Integrations page, or set SENDGRID_API_KEY for a "
                "platform-wide fallback."
            ),
        }

    # ------------------------------------------------------------------
    # Shared low-level HTTP send
    # ------------------------------------------------------------------

    @staticmethod
    async def _send_via_api(
        api_key: str,
        from_email: str,
        from_name: str,
        to_email: str,
        subject: str,
        body_html: str,
        body_text: Optional[str] = None,
    ) -> dict[str, Any]:
        """Low-level SendGrid REST call. Used by the env-var fallback.
        Tenant path goes through the plugin instead so failures route
        through the same friendly error translation as the Integrations
        page."""
        body: dict[str, Any] = {
            "personalizations": [{"to": [{"email": to_email}]}],
            "from": {"email": from_email, "name": from_name},
            "subject": subject,
            "content": [],
        }
        if body_text:
            body["content"].append({"type": "text/plain", "value": body_text})
        body["content"].append({"type": "text/html", "value": body_html})

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{_SENDGRID_BASE}/mail/send", json=body, headers=headers
                )
        except httpx.HTTPError as exc:
            logger.error("SendGrid env-fallback send failed: %s", exc)
            return {"status": "failed", "message_id": None, "error": f"network: {exc}"}

        if resp.status_code // 100 == 2:
            return {
                "status": "sent",
                "message_id": resp.headers.get("X-Message-Id", ""),
                "status_code": resp.status_code,
                "provider": "sendgrid_env",
            }
        return {
            "status": "failed",
            "message_id": None,
            "error": f"HTTP {resp.status_code}: {resp.text[:200]}",
            "provider": "sendgrid_env",
        }


email_service = EmailService()
