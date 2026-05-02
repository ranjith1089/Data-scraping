"""SocialCampaign — groups one or more automation rules + zero-or-more posts.

A campaign is the UX-level grouping the tenant works with: "Q3 Course
Launch" might bundle 3 rules (comment-trigger, story-reply, follow-gate)
across 5 posts. Pausing a campaign disables all its rules at once.

The link between rules and a campaign lives on
``automation_rules.campaign_id`` (added in migration 006). Posts are
linked via the ``social_campaign_posts`` join table below.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class SocialCampaign(Base):
    __tablename__ = "social_campaigns"

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
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="active"
    )
    goal: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )


class SocialCampaignPost(Base):
    """Many-to-many link: a campaign targets N posts, a post can sit
    in multiple campaigns (rare but possible during A/B comparisons).
    """

    __tablename__ = "social_campaign_posts"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("social_campaigns.id", ondelete="CASCADE"),
        primary_key=True,
    )
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("social_posts.id", ondelete="CASCADE"),
        primary_key=True,
    )
