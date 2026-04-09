from typing import Optional
from sqlalchemy import String, Boolean, DateTime, text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from core.database import Base
import uuid
from datetime import datetime


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="uq_users_tenant_email"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="member")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # IMPORTANT: last_login is written from Python code as a tz-aware datetime
    # (datetime.now(timezone.utc) in routers/auth.py login handler). The DB
    # column is TIMESTAMPTZ (created in 001_initial_schema.py), so the
    # SQLAlchemy type MUST declare timezone=True. Without it, SQLAlchemy
    # binds the parameter as a naive timestamp and asyncpg raises a
    # DataError when it sees a tz-aware datetime, causing login to 500.
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
