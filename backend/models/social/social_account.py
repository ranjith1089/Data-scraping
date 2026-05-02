"""SocialAccount — an external profile we've seen interact with the tenant.

One row per (tenant, platform, external_user_id). The same Instagram user
commenting on five different posts produces ONE social_account row that
accumulates ``last_seen_at`` updates.

When a rule fires ``create_lead`` we set ``lead_id`` so the drawer's
Activity tab can pull the conversation thread for that lead.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class SocialAccount(Base):
    __tablename__ = "social_accounts"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "platform",
            "external_user_id",
            name="uq_social_accounts_tenant_platform_user",
        ),
    )

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
    platform: Mapped[str] = mapped_column(String(20), nullable=False)
    external_user_id: Mapped[str] = mapped_column(String(120), nullable=False)
    handle: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    profile_picture_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True,
    )
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    # Renamed from `metadata` (reserved by SQLAlchemy Declarative Base) to
    # `metadata_json` so the model class can sit on Base without a clash.
    metadata_json: Mapped[Optional[dict[str, Any]]] = mapped_column(
        JSONB, nullable=True, server_default="{}"
    )
