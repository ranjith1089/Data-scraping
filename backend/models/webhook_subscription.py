"""WebhookSubscription — outbound webhook destinations registered by tenants.

Unlike :class:`WebhookEndpoint` (inbound webhooks — where Meta / Google
post TO us), this table stores URLs that WE post TO when events happen
inside a tenant. Used for Zapier, Make, custom integrations, and any
other tool that wants to react to lead activity in real time.

Each row fires for one or more event types (e.g. ``lead.created``,
``lead.stage_changed``). The ``secret_encrypted`` column holds a
Fernet-encrypted HMAC secret that we sign each delivery with so the
receiving side can verify authenticity.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

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
    url: Mapped[str] = mapped_column(Text, nullable=False)
    event_types: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        server_default="{lead.created}",
    )
    # Fernet-encrypted HMAC secret used to sign outgoing deliveries.
    secret_encrypted: Mapped[Optional[bytes]] = mapped_column(
        LargeBinary, nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    last_delivery_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    failure_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
