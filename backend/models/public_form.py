"""PublicForm — embeddable tenant-owned form that creates leads.

Each row's ``public_token`` is the only auth needed for the public
submit endpoint (``POST /api/v1/public/forms/{public_token}/submit``).
The token is random 48-byte base64; rotating it means deleting the
form and creating a new one.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class PublicForm(Base):
    __tablename__ = "public_forms"

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
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    public_token: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    sector_code: Mapped[str] = mapped_column(String(20), nullable=False)
    redirect_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Shape: [{"key": "company_size", "label": "Company Size", "required": false, "type": "text"}]
    custom_field_schema: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSONB, nullable=True, server_default="[]"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    submission_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
