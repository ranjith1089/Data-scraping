"""WhatsApp sending service — per-tenant aware.

This service is the single entry point used by ``campaign_runner.py`` and
any other code that wants to send a WhatsApp message on behalf of a tenant.

Resolution order for every send:

1. **Per-tenant integration** — if the tenant has an active row in the
   ``integrations`` table for either ``whatsapp`` (Meta Cloud API) or
   ``whatsapp_gupshup`` (Gupshup BSP), we dispatch through the matching
   plugin in ``services.integrations``.

2. **Platform-wide env-var fallback** — ``WA_API_KEY`` / ``WA_PHONE_ID``
   from ``core.config.settings``. This mirrors the legacy single-tenant
   behaviour so existing deployments keep working without any database
   change.

The legacy ``whatsapp_service.send_message(to, body)`` API is kept for
backwards compatibility (uses env vars only). New callers should use
``send_message_for_tenant(db, tenant_id, to, body)``.
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


# Provider codes that this service knows how to dispatch to, in preferred
# order. Gupshup wins over direct-Meta if both happen to be configured on
# the same tenant, because BSPs have better India delivery rates and we
# want the "nicer" path to be the default.
_WHATSAPP_PROVIDER_PREFERENCE: tuple[str, ...] = (
    "whatsapp_gupshup",
    "whatsapp",
)


class WhatsAppService:
    """Tenant-aware WhatsApp sender.

    Instances can be called with or without a tenant. When called without
    a tenant (the legacy path) the service falls back to the global
    ``WA_API_KEY`` / ``WA_PHONE_ID`` env vars and talks directly to the
    Meta Cloud API.
    """

    BASE_URL = "https://graph.facebook.com/v19.0"

    def __init__(self) -> None:
        self.api_key = settings.WA_API_KEY
        self.phone_id = settings.WA_PHONE_ID
        self.enabled_globally = bool(self.api_key and self.phone_id)

    # ------------------------------------------------------------------
    # Legacy single-tenant API (env-var only)
    # ------------------------------------------------------------------

    async def send_message(self, to_phone: str, message: str) -> dict[str, Any]:
        """Send a WhatsApp text message using the platform-wide env vars.

        Kept for backwards compatibility with call sites that don't yet
        have a tenant context. Prefer ``send_message_for_tenant``.
        """
        if not self.enabled_globally:
            logger.warning(
                "WhatsApp global fallback is not configured (WA_API_KEY / "
                "WA_PHONE_ID missing). Call send_message_for_tenant instead."
            )
            return {"status": "skipped", "error": "WhatsApp not configured"}

        url = f"{self.BASE_URL}/{self.phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "text",
            "text": {"body": message},
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    url, json=payload, headers=headers, timeout=30
                )
                resp.raise_for_status()
                data = resp.json()
                return {
                    "status": "sent",
                    "message_id": data.get("messages", [{}])[0].get("id"),
                    "provider": "whatsapp_env_fallback",
                }
        except Exception as exc:  # noqa: BLE001
            logger.error("WhatsApp env-fallback send failed: %s", exc)
            return {"status": "failed", "error": str(exc)}

    # ------------------------------------------------------------------
    # New tenant-aware API
    # ------------------------------------------------------------------

    async def _load_active_integration(
        self,
        db: AsyncSession,
        tenant_id: UUID,
    ) -> Optional[Integration]:
        """Return the highest-priority active WhatsApp integration, or None."""
        result = await db.execute(
            select(Integration).where(
                Integration.tenant_id == tenant_id,
                Integration.provider.in_(_WHATSAPP_PROVIDER_PREFERENCE),
            )
        )
        rows = list(result.scalars().all())
        if not rows:
            return None

        # Pick the preferred provider that is actually connected.
        by_provider = {row.provider: row for row in rows}
        for provider in _WHATSAPP_PROVIDER_PREFERENCE:
            row = by_provider.get(provider)
            if row and row.status == "connected" and row.credentials_encrypted:
                return row

        # Fall back to any row that has credentials, regardless of status —
        # callers can always re-test afterwards.
        for row in rows:
            if row.credentials_encrypted:
                return row
        return None

    async def send_message_for_tenant(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        to_phone: str,
        message: str,
    ) -> dict[str, Any]:
        """Send a WhatsApp text message on behalf of a specific tenant.

        Resolves the tenant's active WhatsApp integration (either direct
        Meta Cloud API or Gupshup BSP) and dispatches through the matching
        plugin. Falls back to the global env-var path if the tenant has
        no integration row but ``WA_API_KEY`` / ``WA_PHONE_ID`` are set.
        """
        integration = await self._load_active_integration(db, tenant_id)

        if integration:
            plugin_cls = get_integration(integration.provider)
            if plugin_cls is None:
                logger.error(
                    "No plugin registered for provider %s (tenant=%s)",
                    integration.provider,
                    tenant_id,
                )
                return {
                    "status": "failed",
                    "error": f"No plugin for provider '{integration.provider}'",
                }

            try:
                plugin = plugin_cls(
                    integration,
                    credentials=decrypt_json(integration.credentials_encrypted),
                )
                result = await plugin.push_event(
                    "text", {"to": to_phone, "body": message}
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "WhatsApp push_event crashed for tenant=%s provider=%s",
                    tenant_id,
                    integration.provider,
                )
                return {
                    "status": "failed",
                    "error": f"{integration.provider}: {exc}",
                }

            if result.get("ok"):
                return {
                    "status": "sent",
                    "message_id": result.get("message_id"),
                    "provider": integration.provider,
                }
            return {
                "status": "failed",
                "error": result.get("error") or "Unknown provider error",
                "provider": integration.provider,
            }

        # No per-tenant integration — fall back to env vars.
        if self.enabled_globally:
            logger.info(
                "Tenant %s has no WhatsApp integration — using env-var fallback",
                tenant_id,
            )
            return await self.send_message(to_phone, message)

        return {
            "status": "skipped",
            "error": (
                "WhatsApp is not configured for this tenant. Connect a "
                "WhatsApp Business integration from the Integrations page."
            ),
        }


whatsapp_service = WhatsAppService()
