from typing import Optional
from sqlalchemy import String, Text, DateTime, text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base
import uuid
from datetime import datetime


class OutreachLog(Base):
    # Canonical table name is singular "outreach_log" — that's what migration
    # 001_initial_schema and schema.sql create, and what production actually
    # holds. This ORM model used to declare the plural "outreach_logs", which
    # matched no real table and made every ORM query against OutreachLog fail
    # with UndefinedTableError (e.g. the per-campaign stat queries in
    # routers/campaigns.py:_enrich_campaign, which is why POST /campaigns/
    # was returning a raw 500 on every attempt).
    __tablename__ = "outreach_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True
    )
    step_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaign_steps.id"), nullable=True
    )
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id"), nullable=True
    )
    channel: Mapped[str] = mapped_column(String, nullable=False)
    recipient: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="pending")
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    opened_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    clicked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    replied_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_msg: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    message_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # 'a' / 'b' when the send was an A/B variant, NULL otherwise (GAP 2).
    variant: Mapped[Optional[str]] = mapped_column(String(1), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
