"""SocialConsent — opt-in / opt-out / data-deletion audit trail.

Required for GDPR + Indian DPDP compliance. The rule engine reads the
most recent ``opt_out`` row for a given (tenant, social_account_id)
before sending and refuses to dispatch if found.

``evidence`` stores the concrete artifact that produced the consent
state — typically the message id + content where the user typed
"STOP" or clicked an unsubscribe link in a DM template.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class SocialConsent(Base):
    __tablename__ = "social_consents"

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
    social_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("social_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    consent_type: Mapped[str] = mapped_column(String(40), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    evidence: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
