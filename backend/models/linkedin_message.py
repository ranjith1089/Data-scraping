"""LinkedInMessage ORM model — Phase 4 LinkedIn Prospecting."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class LinkedInMessage(Base):
    __tablename__ = "linkedin_messages"

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

    # AI-generated message content
    connection_note: Mapped[str] = mapped_column(Text, nullable=False)
    followup_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Outreach lifecycle: draft → sent → connected → replied | ignored
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")

    # AI generation metadata
    ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    ai_tone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # LinkedIn profile snapshot (from ProxyCurl or manually entered)
    linkedin_headline: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    linkedin_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    linkedin_profile_snapshot: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Activity timestamps
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    connected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    replied_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
