"""Public API, webhook subscriptions, public forms, and A/B testing columns.

Adds all schema needed for GAPs 1 / 2 / 3 in a single additive migration:

* ``webhook_subscriptions`` — outbound webhook destinations registered by
  tenants for Zapier / Make / custom integrations.
* ``public_forms`` — tenant-owned public forms embeddable on customer
  websites. The ``public_token`` is the only thing needed to submit a
  lead; it can be rotated by deleting and recreating the form.
* ``campaign_steps.variant_b_subject`` / ``variant_b_body`` /
  ``ab_split_pct`` — optional columns enabling per-step A/B testing.
* ``outreach_log.variant`` — one-char tag ('a' or 'b') recording which
  variant a given send used, NULL for non-AB sends.

All columns are nullable / defaulted so the migration is fully
additive — existing rows keep working without any backfill.

Revision ID: 005
Revises: 004
Create Date: 2026-04-21 09:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1) webhook_subscriptions — outbound webhooks (GAP 3)
    # ------------------------------------------------------------------
    op.create_table(
        "webhook_subscriptions",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column(
            "event_types",
            ARRAY(sa.String()),
            nullable=False,
            server_default="{lead.created}",
        ),
        sa.Column("secret_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "last_delivery_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column(
            "failure_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    op.execute(
        "ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY"
    )
    op.execute(
        """
        CREATE POLICY tenant_isolation ON webhook_subscriptions
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        """
    )

    # ------------------------------------------------------------------
    # 2) public_forms — embeddable forms (GAP 1)
    # ------------------------------------------------------------------
    op.create_table(
        "public_forms",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column(
            "public_token",
            sa.String(64),
            nullable=False,
            unique=True,
            index=True,
        ),
        sa.Column("sector_code", sa.String(20), nullable=False),
        sa.Column("redirect_url", sa.Text(), nullable=True),
        sa.Column(
            "custom_field_schema",
            JSONB(),
            nullable=True,
            server_default="[]",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "submission_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    op.execute("ALTER TABLE public_forms ENABLE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON public_forms
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        """
    )

    # ------------------------------------------------------------------
    # 3) A/B testing columns (GAP 2)
    # ------------------------------------------------------------------
    op.add_column(
        "campaign_steps",
        sa.Column("variant_b_subject", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "campaign_steps",
        sa.Column("variant_b_body", sa.Text(), nullable=True),
    )
    op.add_column(
        "campaign_steps",
        sa.Column(
            "ab_split_pct",
            sa.Integer(),
            nullable=False,
            server_default="50",
        ),
    )

    # outreach_log.variant — nullable char. NULL means "this send was
    # not part of an A/B test". 'a' or 'b' when it was.
    op.add_column(
        "outreach_log",
        sa.Column("variant", sa.String(length=1), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("outreach_log", "variant")
    op.drop_column("campaign_steps", "ab_split_pct")
    op.drop_column("campaign_steps", "variant_b_body")
    op.drop_column("campaign_steps", "variant_b_subject")

    op.execute("DROP POLICY IF EXISTS tenant_isolation ON public_forms")
    op.drop_table("public_forms")

    op.execute(
        "DROP POLICY IF EXISTS tenant_isolation ON webhook_subscriptions"
    )
    op.drop_table("webhook_subscriptions")
