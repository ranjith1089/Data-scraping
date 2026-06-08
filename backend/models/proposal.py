"""Proposal ORM model — AI-generated sales proposals tied to a lead."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Proposal(Base):
    __tablename__ = "proposals"

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
    # service_proposal | project_quote | intro_letter
    proposal_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="service_proposal"
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    # draft | sent | accepted | rejected
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft")
    ai_tone: Mapped[str] = mapped_column(String(50), nullable=False, default="professional")
    # Rendered Markdown — shown in the editor
    content_markdown: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Rendered HTML — used for the export/preview endpoint
    content_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Structured sections dict from AI output — used for Word export + re-render
    sections: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
