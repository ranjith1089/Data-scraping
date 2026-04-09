"""Third-party integration module — tables + additive lead/outreach columns.

Adds the persistence layer for the Integration Module:

* ``integrations``          — one row per (tenant, provider)
* ``webhook_endpoints``     — public signed webhook URLs
* ``integration_events``    — append-only audit log
* ``automation_rules``      — trigger → condition → actions
* ``lead_assignment_rules`` — round-robin / rule-based routing
* ``apscheduler_jobs``      — APScheduler SQLAlchemy jobstore table

Also adds **nullable, additive** columns to existing tables so no
existing data is touched:

* ``leads`` — utm_source/medium/campaign/term/content, source_integration_id,
  campaign_id, dedup_key, external_id (+ matching indexes)
* ``outreach_log`` — retry_count, next_retry_at, provider_event_id

Revision ID: 003
Revises: 002
Create Date: 2026-04-09 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _outreach_logs_table_name() -> str:
    """Resolve the real outreach-log table name at migration time.

    The SQLAlchemy ``OutreachLog`` model declares
    ``__tablename__ = "outreach_logs"`` (plural), but the earlier
    ``001_initial_schema`` migration created the table as
    ``outreach_log`` (singular). Production databases therefore may
    have either name depending on how they were bootstrapped. We
    inspect the live schema here and target whichever exists so the
    additive columns land in the right place.
    """
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())
    if "outreach_logs" in existing:
        return "outreach_logs"
    if "outreach_log" in existing:
        return "outreach_log"
    # Neither exists — downstream op.add_column will raise with a clear
    # error message pointing at the missing table.
    return "outreach_logs"


def upgrade() -> None:
    # ------------------------------------------------------------------
    # integrations
    # ------------------------------------------------------------------
    op.create_table(
        "integrations",
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
        ),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="disconnected"),
        sa.Column("credentials_encrypted", sa.LargeBinary(), nullable=True),
        sa.Column("config", JSONB(), nullable=True, server_default="{}"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
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
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "tenant_id", "provider", name="uq_integrations_tenant_provider"
        ),
    )
    op.create_index("ix_integrations_tenant_id", "integrations", ["tenant_id"])

    # ------------------------------------------------------------------
    # webhook_endpoints
    # ------------------------------------------------------------------
    op.create_table(
        "webhook_endpoints",
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
        ),
        sa.Column(
            "integration_id",
            UUID(as_uuid=True),
            sa.ForeignKey("integrations.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("path_token", sa.String(64), nullable=False, unique=True),
        sa.Column("secret", sa.LargeBinary(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_event_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("event_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_webhook_endpoints_tenant_id", "webhook_endpoints", ["tenant_id"]
    )
    op.create_index(
        "ix_webhook_endpoints_path_token", "webhook_endpoints", ["path_token"]
    )

    # ------------------------------------------------------------------
    # integration_events
    # ------------------------------------------------------------------
    op.create_table(
        "integration_events",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "integration_id",
            UUID(as_uuid=True),
            sa.ForeignKey("integrations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("direction", sa.String(10), nullable=False),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("payload", JSONB(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ok"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "lead_id",
            UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_integration_events_tenant_created",
        "integration_events",
        ["tenant_id", "created_at"],
    )
    op.create_index(
        "ix_integration_events_integration_created",
        "integration_events",
        ["integration_id", "created_at"],
    )
    op.create_index(
        "ix_integration_events_event_type", "integration_events", ["event_type"]
    )

    # ------------------------------------------------------------------
    # automation_rules
    # ------------------------------------------------------------------
    op.create_table(
        "automation_rules",
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
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("trigger_type", sa.String(40), nullable=False),
        sa.Column("trigger_config", JSONB(), nullable=True, server_default="{}"),
        sa.Column("conditions", JSONB(), nullable=True, server_default="[]"),
        sa.Column("actions", JSONB(), nullable=True, server_default="[]"),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("run_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
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
            nullable=False,
        ),
    )
    op.create_index(
        "ix_automation_rules_tenant_trigger",
        "automation_rules",
        ["tenant_id", "trigger_type"],
    )

    # ------------------------------------------------------------------
    # lead_assignment_rules
    # ------------------------------------------------------------------
    op.create_table(
        "lead_assignment_rules",
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
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column(
            "strategy", sa.String(20), nullable=False, server_default="round_robin"
        ),
        sa.Column("rules", JSONB(), nullable=True, server_default="[]"),
        sa.Column(
            "user_pool",
            ARRAY(UUID(as_uuid=True)),
            nullable=True,
        ),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("cursor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_lead_assignment_rules_tenant", "lead_assignment_rules", ["tenant_id"]
    )

    # ------------------------------------------------------------------
    # Additive columns on `leads`
    # ------------------------------------------------------------------
    op.add_column("leads", sa.Column("utm_source", sa.String(120), nullable=True))
    op.add_column("leads", sa.Column("utm_medium", sa.String(120), nullable=True))
    op.add_column("leads", sa.Column("utm_campaign", sa.String(120), nullable=True))
    op.add_column("leads", sa.Column("utm_term", sa.String(120), nullable=True))
    op.add_column("leads", sa.Column("utm_content", sa.String(120), nullable=True))
    op.add_column(
        "leads",
        sa.Column(
            "source_integration_id",
            UUID(as_uuid=True),
            sa.ForeignKey("integrations.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "leads",
        sa.Column(
            "campaign_id",
            UUID(as_uuid=True),
            sa.ForeignKey("campaigns.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("leads", sa.Column("dedup_key", sa.String(255), nullable=True))
    op.add_column("leads", sa.Column("external_id", sa.String(255), nullable=True))

    op.create_index(
        "ix_leads_dedup_key", "leads", ["tenant_id", "dedup_key"]
    )
    op.create_index(
        "uq_leads_external_id",
        "leads",
        ["tenant_id", "source_integration_id", "external_id"],
        unique=True,
        postgresql_where=sa.text("external_id IS NOT NULL"),
    )

    # Backfill dedup_key from email (lowercased) for existing rows
    op.execute(
        "UPDATE leads SET dedup_key = LOWER(email) WHERE email IS NOT NULL AND dedup_key IS NULL"
    )

    # ------------------------------------------------------------------
    # Additive columns on `outreach_log`
    # ------------------------------------------------------------------
    # NOTE: the SQLAlchemy OutreachLog model uses __tablename__ = "outreach_logs"
    # (plural), so target the plural form here to stay consistent with the ORM.
    outreach_table = _outreach_logs_table_name()
    op.add_column(
        outreach_table,
        sa.Column(
            "retry_count", sa.Integer(), nullable=False, server_default="0"
        ),
    )
    op.add_column(
        outreach_table,
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        outreach_table,
        sa.Column("provider_event_id", sa.String(255), nullable=True),
    )

    # ------------------------------------------------------------------
    # APScheduler jobstore table (created lazily by APScheduler if absent,
    # but we create it here for predictable migrations across environments)
    # ------------------------------------------------------------------
    op.create_table(
        "apscheduler_jobs",
        sa.Column("id", sa.Unicode(191), primary_key=True),
        sa.Column("next_run_time", sa.Float(), index=True, nullable=True),
        sa.Column("job_state", sa.LargeBinary(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("apscheduler_jobs")

    outreach_table = _outreach_logs_table_name()
    op.drop_column(outreach_table, "provider_event_id")
    op.drop_column(outreach_table, "next_retry_at")
    op.drop_column(outreach_table, "retry_count")

    op.drop_index("uq_leads_external_id", table_name="leads")
    op.drop_index("ix_leads_dedup_key", table_name="leads")
    op.drop_column("leads", "external_id")
    op.drop_column("leads", "dedup_key")
    op.drop_column("leads", "campaign_id")
    op.drop_column("leads", "source_integration_id")
    op.drop_column("leads", "utm_content")
    op.drop_column("leads", "utm_term")
    op.drop_column("leads", "utm_campaign")
    op.drop_column("leads", "utm_medium")
    op.drop_column("leads", "utm_source")

    op.drop_index("ix_lead_assignment_rules_tenant", table_name="lead_assignment_rules")
    op.drop_table("lead_assignment_rules")

    op.drop_index("ix_automation_rules_tenant_trigger", table_name="automation_rules")
    op.drop_table("automation_rules")

    op.drop_index("ix_integration_events_event_type", table_name="integration_events")
    op.drop_index(
        "ix_integration_events_integration_created", table_name="integration_events"
    )
    op.drop_index("ix_integration_events_tenant_created", table_name="integration_events")
    op.drop_table("integration_events")

    op.drop_index("ix_webhook_endpoints_path_token", table_name="webhook_endpoints")
    op.drop_index("ix_webhook_endpoints_tenant_id", table_name="webhook_endpoints")
    op.drop_table("webhook_endpoints")

    op.drop_index("ix_integrations_tenant_id", table_name="integrations")
    op.drop_table("integrations")
