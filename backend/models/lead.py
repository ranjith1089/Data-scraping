from typing import Optional
from sqlalchemy import String, Integer, BigInteger, Text, DateTime, text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from core.database import Base
import uuid
from datetime import datetime, timezone


def _utcnow() -> datetime:
    """Timezone-aware UTC now for onupdate callbacks (see models/deal.py)."""
    return datetime.now(timezone.utc)


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    sector_code: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("sectors.code"), nullable=True
    )
    company_name: Mapped[str] = mapped_column(String, nullable=False)
    industry: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    sub_industry: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    state: Mapped[str] = mapped_column(String, default="Tamil Nadu")
    district: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pincode: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    company_size: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    annual_revenue_inr: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    designation: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    lead_score: Mapped[int] = mapped_column(Integer, default=50)
    score_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icp_match: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stage: Mapped[str] = mapped_column(String, default="new")
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    tags: Mapped[Optional[list]] = mapped_column(ARRAY(String), nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    custom_fields: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    last_contacted: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), onupdate=_utcnow
    )
