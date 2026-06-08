"""Add enrichment_logs table to track lead enrichment history.

Revision ID: 010
Revises: 009
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg
from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "enrichment_logs",
        sa.Column(
            "id",
            pg.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "lead_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # apollo | hunter | manual
        sa.Column("source", sa.String(30), nullable=False, server_default="apollo"),
        # Raw values returned by the provider {email: "...", phone: "..."}
        sa.Column("fields_found", pg.JSONB, nullable=True),
        # Which fields were actually written to the lead row
        sa.Column("fields_updated", pg.ARRAY(sa.Text), nullable=True),
        # success | partial | failed | no_api_key | not_found
        sa.Column("status", sa.String(30), nullable=False, server_default="success"),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_enrichment_logs_tenant_id", "enrichment_logs", ["tenant_id"])
    op.create_index("ix_enrichment_logs_lead_id", "enrichment_logs", ["lead_id"])

    op.execute("ALTER TABLE enrichment_logs ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY enrichment_logs_tenant_isolation ON enrichment_logs
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS enrichment_logs_tenant_isolation ON enrichment_logs")
    op.drop_index("ix_enrichment_logs_lead_id", "enrichment_logs")
    op.drop_index("ix_enrichment_logs_tenant_id", "enrichment_logs")
    op.drop_table("enrichment_logs")
