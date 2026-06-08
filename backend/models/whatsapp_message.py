"""WhatsAppMessage ORM model — Phase 5 WhatsApp Outreach."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

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
    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )

    # outbound | inbound
    direction: Mapped[str] = mapped_column(String(10), nullable=False, default="outbound")
    # ai_generated | manual | template | inbound
    message_type: Mapped[str] = mapped_column(String(30), nullable=False, default="ai_generated")

    content: Mapped[str] = mapped_column(Text, nullable=False)
    template_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # pending | sent | delivered | read | failed | received
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    # WhatsApp's own message id (wamid.xxx)
    wa_message_id: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    phone_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    ai_tone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
