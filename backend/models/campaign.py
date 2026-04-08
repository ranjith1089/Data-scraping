from typing import Optional
from sqlalchemy import String, Integer, text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from core.database import Base
import uuid
from datetime import datetime


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    sector_codes: Mapped[Optional[list]] = mapped_column(ARRAY(String), nullable=True)
    status: Mapped[str] = mapped_column(String, default="draft")
    channel: Mapped[str] = mapped_column(String, default="email")
    segment_filter: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    daily_limit: Mapped[int] = mapped_column(Integer, default=100)
    ai_tone: Mapped[str] = mapped_column(String, default="professional")
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=text("now()"))
