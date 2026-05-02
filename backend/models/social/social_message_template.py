"""SocialMessageTemplate — reusable DM bodies referenced by rule actions.

A rule's ``send_dm`` action can either inline the message body or
reference a template by id. Templates support placeholder substitution
(``{{name}}``, ``{{company_name}}``, etc.) at send time.

``language`` is one of ``en`` / ``ta`` / ``hi`` and ties into the
existing vernacular AI generator at ``/ai/generate-vernacular`` —
the form-based template editor can call that endpoint to draft the
non-English content automatically.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class SocialMessageTemplate(Base):
    __tablename__ = "social_message_templates"

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
    content: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(
        String(8), nullable=False, server_default="en"
    )
    variables: Mapped[Optional[list[dict[str, Any]]]] = mapped_column(
        JSONB, nullable=True, server_default="[]"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
