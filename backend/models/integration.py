"""Integration — one row per (tenant, provider).

Represents a third-party service LeadForge has been configured to talk to:
Meta Ads, Google Ads, LinkedIn Ads, WhatsApp Business, SendGrid, SMTP,
GA4, Facebook Pixel, etc.

The secret portion of the credentials (OAuth tokens, API keys, webhook
secrets) is Fernet-encrypted in ``credentials_encrypted``. Non-secret
settings (selected account IDs, form IDs, page IDs, conversion action
IDs) live in ``config`` JSONB so they can be queried and indexed.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Integration(Base):
    __tablename__ = "integrations"
    __table_args__ = (
        UniqueConstraint("tenant_id", "provider", name="uq_integrations_tenant_provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="disconnected"
    )
    credentials_encrypted: Mapped[Optional[bytes]] = mapped_column(
        LargeBinary, nullable=True
    )
    config: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, server_default="{}"
    )
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
