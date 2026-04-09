"""IntegrationEvent — append-only audit log for the integration layer.

Every inbound webhook we receive and every outbound API call we make
to a third-party provider produces one row. Used by the admin panel
Event Log tab, by retry logic, and as forensic data when a tenant
reports missing leads.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class IntegrationEvent(Base):
    __tablename__ = "integration_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    integration_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("integrations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    # e.g. 'lead.captured', 'conversion.uploaded', 'oauth.refreshed',
    # 'webhook.rejected', 'dedup.hit', 'message.retried'
    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="ok"
    )
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
