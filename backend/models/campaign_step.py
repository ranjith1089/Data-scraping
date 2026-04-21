from typing import Optional
from sqlalchemy import String, Integer, Boolean, Text, DateTime, text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base
import uuid
from datetime import datetime


class CampaignStep(Base):
    __tablename__ = "campaign_steps"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False
    )
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    channel: Mapped[str] = mapped_column(String, nullable=False)
    delay_days: Mapped[int] = mapped_column(Integer, default=0)
    subject: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_generated: Mapped[bool] = mapped_column(Boolean, default=False)
    # A/B testing (GAP 2). All three nullable/defaulted so the migration
    # is additive and existing rows keep sending the primary variant only.
    variant_b_subject: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )
    variant_b_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ab_split_pct: Mapped[int] = mapped_column(
        Integer, default=50, server_default="50", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
