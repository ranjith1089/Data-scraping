"""BaseIntegration — abstract contract every provider plugin implements.

Each concrete integration (``meta_ads.py``, ``google_ads.py``,
``whatsapp_ext.py``, ``smtp.py``, etc.) subclasses ``BaseIntegration``
and registers itself via the ``@register("provider_code")`` decorator
from ``services.integrations``.

Surface
-------
``test_connection()``     — called by the admin panel "Test" button;
                             returns a structured result with an ok
                             flag and human-readable message.
``handle_webhook()``      — called by ``routers/integrations/webhooks_public.py``
                             after signature verification; transforms
                             a provider payload into a ``Lead`` (and
                             optionally subsequent automation triggers).
``push_event()``          — called when AveonApex wants to *send*
                             something outbound to the provider, e.g.
                             a conversion upload.
``refresh_credentials()`` — called automatically when a stored access
                             token is about to expire.

All methods are async to match the rest of the backend.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from models.integration import Integration


@dataclass
class IntegrationTestResult:
    ok: bool
    provider: str
    message: str
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class WebhookResult:
    """Outcome of processing a single inbound webhook."""

    ok: bool
    message: str
    lead_id: Optional[UUID] = None
    created: bool = False
    deduped: bool = False
    details: dict[str, Any] = field(default_factory=dict)


class BaseIntegration(ABC):
    """Abstract base class for all third-party provider plugins.

    Concrete subclasses should be instantiated with an ``Integration``
    ORM row and a decrypted ``credentials`` dict, and must implement
    at least ``test_connection``. Webhook-driven providers also
    implement ``handle_webhook``; outbound-only providers implement
    ``push_event``.
    """

    #: Short machine code, e.g. ``"meta_ads"``. Override in subclass.
    provider: str = ""

    #: Human-readable display name.
    display_name: str = ""

    #: Whether this provider authenticates via OAuth 2.0 (False = API key).
    uses_oauth: bool = False

    def __init__(
        self,
        integration: Integration,
        credentials: dict[str, Any] | None = None,
    ) -> None:
        self.integration = integration
        self.credentials = credentials or {}
        self.config = integration.config or {}

    # ------------------------------------------------------------------
    # Required
    # ------------------------------------------------------------------

    @abstractmethod
    async def test_connection(self) -> IntegrationTestResult:
        """Verify the stored credentials still work against the provider."""

    # ------------------------------------------------------------------
    # Optional — override as needed
    # ------------------------------------------------------------------

    async def handle_webhook(
        self,
        db: AsyncSession,
        payload: dict[str, Any],
        headers: dict[str, str],
    ) -> WebhookResult:
        """Transform an inbound webhook into AveonApex domain events."""
        return WebhookResult(
            ok=False,
            message=f"{self.provider}: handle_webhook not implemented",
        )

    async def verify_webhook_signature(
        self,
        body: bytes,
        headers: dict[str, str],
        secret: str,
    ) -> bool:
        """Verify a provider-specific HMAC signature on the raw body.

        Default implementation returns False so unverified providers
        cannot silently accept payloads.
        """
        return False

    async def push_event(
        self,
        event_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Send an outbound event (conversion upload, message send, etc.)."""
        return {
            "ok": False,
            "error": f"{self.provider}: push_event not implemented",
        }

    async def refresh_credentials(self) -> dict[str, Any] | None:
        """Refresh OAuth tokens if near expiry; return the new credentials dict."""
        return None
