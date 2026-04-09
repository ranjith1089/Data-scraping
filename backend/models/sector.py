from typing import Optional
from sqlalchemy import String, Text, DateTime, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from core.database import Base
import uuid
from datetime import datetime


class Sector(Base):
    __tablename__ = "sectors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_persona: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pain_points: Mapped[Optional[list]] = mapped_column(ARRAY(String), nullable=True)
    value_props: Mapped[Optional[list]] = mapped_column(ARRAY(String), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
