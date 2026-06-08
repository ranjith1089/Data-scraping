from typing import Optional
from sqlalchemy import String, Integer, Date, Text, DateTime, text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base
import uuid
from datetime import datetime, date, timezone


def _utcnow() -> datetime:
    """Timezone-aware UTC now. Used for onupdate callbacks because
    `datetime.utcnow` returns a naive datetime which asyncpg refuses
    to bind to a TIMESTAMPTZ column."""
    return datetime.now(timezone.utc)


class Deal(Base):
    __tablename__ = "deals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leads.id"), nullable=True
    )
    stage_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_stages.id"), nullable=True
    )
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    value_inr: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    close_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    probability: Mapped[int] = mapped_column(Integer, default=20)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Phase 7 — won/lost tracking
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    lost_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    won_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    lost_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), onupdate=_utcnow
    )
