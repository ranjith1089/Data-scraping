"""Add whatsapp_messages table.

Phase 5 — WhatsApp Outreach: stores both outbound AI-generated/manual
messages and inbound replies per lead, with full delivery tracking.

Revision ID: 012
Revises: 011
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg
from alembic import op

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_messages",
        sa.Column(
            "id",
            pg.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("tenant_id", pg.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "lead_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        # outbound | inbound
        sa.Column("direction", sa.String(10), nullable=False, server_default="outbound"),
        # ai_generated | manual | template | inbound
        sa.Column("message_type", sa.String(30), nullable=False, server_default="ai_generated"),
        # Full message text
        sa.Column("content", sa.Text, nullable=False),
        # WhatsApp template name (when message_type=template)
        sa.Column("template_name", sa.String(100), nullable=True),
        # pending | sent | delivered | read | failed | received
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        # WhatsApp's own message ID (wamid.xxx) — returned on send / set on inbound
        sa.Column("wa_message_id", sa.String(300), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        # The E.164 phone number the message was sent to / received from
        sa.Column("phone_number", sa.String(30), nullable=True),
        sa.Column("ai_tone", sa.String(50), nullable=True),
        # Delivery timestamps
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index("ix_wa_messages_tenant_id",  "whatsapp_messages", ["tenant_id"])
    op.create_index("ix_wa_messages_lead_id",    "whatsapp_messages", ["lead_id"])
    op.create_index("ix_wa_messages_status",     "whatsapp_messages", ["status"])
    op.create_index("ix_wa_messages_direction",  "whatsapp_messages", ["direction"])
    op.create_index("ix_wa_messages_wa_msg_id",  "whatsapp_messages", ["wa_message_id"])

    op.execute("ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY whatsapp_messages_tenant_isolation ON whatsapp_messages
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS whatsapp_messages_tenant_isolation ON whatsapp_messages")
    op.drop_index("ix_wa_messages_wa_msg_id",  table_name="whatsapp_messages")
    op.drop_index("ix_wa_messages_direction",  table_name="whatsapp_messages")
    op.drop_index("ix_wa_messages_status",     table_name="whatsapp_messages")
    op.drop_index("ix_wa_messages_lead_id",    table_name="whatsapp_messages")
    op.drop_index("ix_wa_messages_tenant_id",  table_name="whatsapp_messages")
    op.drop_table("whatsapp_messages")
