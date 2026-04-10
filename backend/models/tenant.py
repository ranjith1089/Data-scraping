from typing import Optional
from sqlalchemy import String, Boolean, DateTime, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from core.database import Base
import uuid
from datetime import datetime


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
        server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String, default="starter")
    # ``is_active`` is retained as a backwards-compatible shim. New code
    # should branch on ``status`` instead; ``is_active`` is kept in sync
    # so any legacy query that still filters on it keeps working.
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Lifecycle status introduced in migration 004. Values:
    # ``active`` / ``suspended`` / ``cancelled``. Not a SQL ENUM (kept as
    # VARCHAR) to keep future value additions cheap and migration-free.
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="active", server_default="active"
    )
    settings: Mapped[dict] = mapped_column(JSONB, default=dict)
    # Optional pointer to the tenant's primary owner user. Nullable so a
    # tenant can be created by a super-admin before the owner user exists.
    # ``ON DELETE SET NULL`` so deleting a user never orphans the tenant.
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    suspended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
