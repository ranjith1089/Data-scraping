"""SocialMessage — every inbound or outbound message in a conversation.

Each row carries enough context to serve four use cases:

1. The conversation timeline UI (group by ``conversation_id`` order by
   ``created_at``).
2. Webhook dedup — ``(platform, external_message_id)`` is uniquely
   indexed (partial — null external IDs not deduped).
3. Outbound delivery audit — ``status`` walks ``received → queued →
   sent → delivered → failed``; ``error`` carries the failure detail.
4. Rule attribution — ``rule_id`` and ``trigger_post_id`` let analytics
   answer "how many DMs did rule X fire on post Y last week?".
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class SocialMessage(Base):
    __tablename__ = "social_messages"

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
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("social_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    platform: Mapped[str] = mapped_column(String(20), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    external_message_id: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True
    )
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attachments: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSONB, nullable=True, server_default="[]"
    )
    trigger_post_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("social_posts.id", ondelete="SET NULL"),
        nullable=True,
    )
    rule_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("automation_rules.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="received"
    )
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    received_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
