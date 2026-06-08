"""EnrichmentLog ORM model — audit trail for every lead enrichment attempt."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class EnrichmentLog(Base):
    __tablename__ = "enrichment_logs"

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
    # apollo | hunter | manual
    source: Mapped[str] = mapped_column(String(30), nullable=False, default="apollo")
    # Raw values returned by the provider
    fields_found: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    # Which fields were actually written to the lead row
    fields_updated: Mapped[Optional[list]] = mapped_column(ARRAY(Text), nullable=True)
    # success | partial | failed | no_api_key | not_found
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="success")
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
