"""LeadAssignmentRule — routes new leads to sales reps.

Three strategies are supported via the ``strategy`` column:

* ``round_robin``  — iterate through ``user_pool`` using ``cursor``
* ``load_balanced`` — pick the user in ``user_pool`` with the fewest
  currently-open leads (computed at assignment time)
* ``rule_based``   — evaluate ``rules`` top-down until one matches,
  then assign to the user specified in that rule

The assignment service increments ``cursor`` atomically so parallel
lead ingestion is safe.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class LeadAssignmentRule(Base):
    __tablename__ = "lead_assignment_rules"

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
    strategy: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="round_robin"
    )
    rules: Mapped[Optional[list]] = mapped_column(
        JSONB, nullable=True, server_default="[]"
    )
    user_pool: Mapped[Optional[list]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=True
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    cursor: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
