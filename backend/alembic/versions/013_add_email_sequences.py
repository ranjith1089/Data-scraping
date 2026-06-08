"""Add email sequence tables.

Phase 6 — Email Sequences: drip campaign engine with per-lead enrollment,
step-level delay scheduling, and open/reply tracking.

Tables:
  email_sequences         — sequence definition (name, status)
  email_sequence_steps    — ordered steps with delay + subject/body templates
  email_sequence_enrollments — per-lead enrollment with scheduler state
  email_sequence_logs     — per-send delivery record (tracks opens, replies)

Revision ID: 013
Revises: 012
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg
from alembic import op

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── email_sequences ───────────────────────────────────────────────────────
    op.create_table(
        "email_sequences",
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
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        # draft | active | paused | archived
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="draft"
        ),
        sa.Column(
            "created_by",
            pg.UUID(as_uuid=True),
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
    )
    op.create_index("ix_email_sequences_tenant", "email_sequences", ["tenant_id"])
    op.create_index("ix_email_sequences_status", "email_sequences", ["status"])

    # RLS
    op.execute(
        """
        ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;

        CREATE POLICY email_sequences_tenant_isolation
          ON email_sequences
          USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
        """
    )

    # ── email_sequence_steps ──────────────────────────────────────────────────
    op.create_table(
        "email_sequence_steps",
        sa.Column(
            "id",
            pg.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "sequence_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("email_sequences.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # 1-based order within the sequence
        sa.Column("step_order", sa.Integer, nullable=False),
        # Days after previous step (0 = same day as enrollment for step 1)
        sa.Column(
            "delay_days", sa.Integer, nullable=False, server_default="0"
        ),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        # cold_outreach | follow_up | value_add | breakup
        sa.Column(
            "email_type",
            sa.String(30),
            nullable=False,
            server_default="follow_up",
        ),
        sa.Column(
            "ai_tone",
            sa.String(30),
            nullable=False,
            server_default="professional",
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
    )
    op.create_index(
        "ix_email_sequence_steps_sequence",
        "email_sequence_steps",
        ["sequence_id", "step_order"],
    )
    op.create_index(
        "ix_email_sequence_steps_tenant",
        "email_sequence_steps",
        ["tenant_id"],
    )

    op.execute(
        """
        ALTER TABLE email_sequence_steps ENABLE ROW LEVEL SECURITY;

        CREATE POLICY email_sequence_steps_tenant_isolation
          ON email_sequence_steps
          USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
        """
    )

    # ── email_sequence_enrollments ────────────────────────────────────────────
    op.create_table(
        "email_sequence_enrollments",
        sa.Column(
            "id",
            pg.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "sequence_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("email_sequences.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "lead_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "enrolled_by",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # active | paused | completed | unsubscribed | replied | bounced | failed
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="active"
        ),
        # Which step was last sent (0 = none yet)
        sa.Column(
            "current_step", sa.Integer, nullable=False, server_default="0"
        ),
        # When the next step should fire (NULL = no more steps / paused)
        sa.Column("next_step_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "enrolled_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index(
        "ix_email_seq_enrollments_sequence",
        "email_sequence_enrollments",
        ["sequence_id"],
    )
    op.create_index(
        "ix_email_seq_enrollments_lead",
        "email_sequence_enrollments",
        ["lead_id"],
    )
    op.create_index(
        "ix_email_seq_enrollments_tenant",
        "email_sequence_enrollments",
        ["tenant_id"],
    )
    op.create_index(
        "ix_email_seq_enrollments_next_step",
        "email_sequence_enrollments",
        ["next_step_at"],
    )
    # Prevent double-enrolling same lead in same sequence
    op.create_unique_constraint(
        "uq_enrollment_sequence_lead",
        "email_sequence_enrollments",
        ["sequence_id", "lead_id"],
    )

    op.execute(
        """
        ALTER TABLE email_sequence_enrollments ENABLE ROW LEVEL SECURITY;

        CREATE POLICY email_sequence_enrollments_tenant_isolation
          ON email_sequence_enrollments
          USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
        """
    )

    # ── email_sequence_logs ───────────────────────────────────────────────────
    op.create_table(
        "email_sequence_logs",
        sa.Column(
            "id",
            pg.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "enrollment_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("email_sequence_enrollments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "step_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("email_sequence_steps.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "lead_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tenant_id",
            pg.UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("step_order", sa.Integer, nullable=True),
        sa.Column("subject", sa.String(500), nullable=True),
        # pending | sent | delivered | opened | clicked | replied | bounced | failed
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="pending"
        ),
        sa.Column("sendgrid_message_id", sa.String(150), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_msg", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_email_seq_logs_enrollment",
        "email_sequence_logs",
        ["enrollment_id"],
    )
    op.create_index(
        "ix_email_seq_logs_lead",
        "email_sequence_logs",
        ["lead_id"],
    )
    op.create_index(
        "ix_email_seq_logs_tenant",
        "email_sequence_logs",
        ["tenant_id"],
    )

    op.execute(
        """
        ALTER TABLE email_sequence_logs ENABLE ROW LEVEL SECURITY;

        CREATE POLICY email_sequence_logs_tenant_isolation
          ON email_sequence_logs
          USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
        """
    )


def downgrade() -> None:
    op.drop_table("email_sequence_logs")
    op.drop_table("email_sequence_enrollments")
    op.drop_table("email_sequence_steps")
    op.drop_table("email_sequences")
