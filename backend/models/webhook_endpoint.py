"""WebhookEndpoint — a public, tenant-scoped, signed webhook URL.

Each row produces exactly one public URL of the form::

    {PUBLIC_BASE_URL}/api/v1/webhooks/{provider}/{path_token}

Where ``path_token`` is a random 48-char base64 string. Events posted
to that URL must either carry a valid provider-specific signature
(X-Hub-Signature-256 for Meta, etc.) or an HMAC-SHA256 of the raw
body computed with the row's ``secret`` (Fernet-encrypted).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

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
    integration_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("integrations.id", ondelete="CASCADE"),
        nullable=True,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    path_token: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    secret: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    last_event_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    event_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
