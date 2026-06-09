"""Add deal status / won-lost tracking and deal_activities table.

Phase 7 — Deals / Revenue Pipeline:
  - Adds status, lost_reason, won_at, lost_at to the deals table
  - Creates deal_activities table (notes, calls, emails per deal)

Revision ID: 014
Revises: 013
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg
from alembic import op

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extend deals table ────────────────────────────────────────────────────
    op.add_column(
        "deals",
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="open",
        ),
    )
    op.add_column("deals", sa.Column("lost_reason", sa.Text, nullable=True))
    op.add_column(
        "deals",
        sa.Column("won_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "deals",
        sa.Column("lost_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_index("ix_deals_status", "deals", ["status"])
    op.create_index("ix_deals_tenant_status", "deals", ["tenant_id", "status"])

    # ── deal_activities ───────────────────────────────────────────────────────
    op.create_table(
        "deal_activities",
        sa.Column(
            "id",
            pg.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "deal_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("deals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # note | call | email | meeting | stage_change
        sa.Column(
            "activity_type",
            sa.String(30),
            nullable=False,
            server_default="note",
        ),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_deal_activities_deal", "deal_activities", ["deal_id"])
    op.create_index("ix_deal_activities_tenant", "deal_activities", ["tenant_id"])

    op.execute("ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY deal_activities_tenant_isolation"
        " ON deal_activities"
        " USING (tenant_id = current_setting('app.current_tenant', true)::uuid)"
    )


def downgrade() -> None:
    op.drop_table("deal_activities")
    op.drop_index("ix_deals_tenant_status", "deals")
    op.drop_index("ix_deals_status", "deals")
    op.drop_column("deals", "lost_at")
    op.drop_column("deals", "won_at")
    op.drop_column("deals", "lost_reason")
    op.drop_column("deals", "status")
