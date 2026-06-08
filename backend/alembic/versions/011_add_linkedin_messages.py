"""Add linkedin_messages table.

Phase 4 — LinkedIn Prospecting: stores AI-generated LinkedIn connection
notes, follow-up messages, and per-lead outreach status tracking.

Revision ID: 011
Revises: 010
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg
from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "linkedin_messages",
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
        # AI-generated messages
        sa.Column("connection_note", sa.Text, nullable=False),
        sa.Column("followup_message", sa.Text, nullable=True),
        # Outreach status: draft | sent | connected | replied | ignored
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        # AI metadata
        sa.Column("ai_generated", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("ai_tone", sa.String(50), nullable=True),
        # LinkedIn profile snapshot (from ProxyCurl or manually set)
        sa.Column("linkedin_headline", sa.Text, nullable=True),
        sa.Column("linkedin_summary", sa.Text, nullable=True),
        sa.Column("linkedin_profile_snapshot", pg.JSONB, nullable=True),
        # Activity timestamps
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
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

    op.create_index("ix_linkedin_messages_tenant_id", "linkedin_messages", ["tenant_id"])
    op.create_index("ix_linkedin_messages_lead_id", "linkedin_messages", ["lead_id"])
    op.create_index("ix_linkedin_messages_status", "linkedin_messages", ["status"])

    # Row Level Security
    op.execute("ALTER TABLE linkedin_messages ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY linkedin_messages_tenant_isolation ON linkedin_messages
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS linkedin_messages_tenant_isolation ON linkedin_messages")
    op.drop_index("ix_linkedin_messages_status", table_name="linkedin_messages")
    op.drop_index("ix_linkedin_messages_lead_id", table_name="linkedin_messages")
    op.drop_index("ix_linkedin_messages_tenant_id", table_name="linkedin_messages")
    op.drop_table("linkedin_messages")
