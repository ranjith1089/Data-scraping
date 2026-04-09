"""AutomationRule — trigger → conditions → actions workflow.

A minimal rule engine stored as JSONB. The automation engine evaluates
rules in ``services/automation_engine.py`` whenever:

* a lead is created (``trigger_type = 'lead.created'``)
* a lead's stage changes (``trigger_type = 'lead.stage_changed'``)
* a lead is scored by the AI (``trigger_type = 'lead.scored'``)
* the scheduler fires a timer (``trigger_type = 'timer'``)

``conditions`` is a list of ``{field, op, value}`` filters that must
all evaluate true. ``actions`` is an ordered list of action objects:
``send_whatsapp_template``, ``send_email``, ``create_task``,
``assign_user``, ``update_stage``, ``push_conversion``, ``wait``.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class AutomationRule(Base):
    __tablename__ = "automation_rules"

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
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    trigger_config: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, server_default="{}"
    )
    conditions: Mapped[Optional[list]] = mapped_column(
        JSONB, nullable=True, server_default="[]"
    )
    actions: Mapped[Optional[list]] = mapped_column(
        JSONB, nullable=True, server_default="[]"
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    run_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    last_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
