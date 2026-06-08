"""Add tasks table — Phase 9 Tasks & Follow-ups.

Revision ID: 015
Revises: 014
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("lead_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=True),
        sa.Column("deal_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("deals.id", ondelete="CASCADE"), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        # follow_up | call | email | meeting | other
        sa.Column("task_type", sa.String(30), nullable=False, server_default="follow_up"),
        # low | medium | high | urgent
        sa.Column("priority", sa.String(10), nullable=False, server_default="medium"),
        # pending | in_progress | done | cancelled
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), onupdate=sa.text("now()"), nullable=True),
    )

    # Indexes for the most common query patterns
    op.create_index("ix_tasks_tenant",        "tasks", ["tenant_id"])
    op.create_index("ix_tasks_lead",          "tasks", ["lead_id"])
    op.create_index("ix_tasks_deal",          "tasks", ["deal_id"])
    op.create_index("ix_tasks_assigned_to",   "tasks", ["assigned_to"])
    op.create_index("ix_tasks_status",        "tasks", ["status"])
    op.create_index("ix_tasks_due_date",      "tasks", ["due_date"])
    op.create_index("ix_tasks_tenant_status", "tasks", ["tenant_id", "status"])

    # Row-Level Security
    op.execute("ALTER TABLE tasks ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tasks_tenant_isolation ON tasks
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tasks_tenant_isolation ON tasks")
    op.drop_index("ix_tasks_tenant_status", table_name="tasks")
    op.drop_index("ix_tasks_due_date",      table_name="tasks")
    op.drop_index("ix_tasks_status",        table_name="tasks")
    op.drop_index("ix_tasks_assigned_to",   table_name="tasks")
    op.drop_index("ix_tasks_deal",          table_name="tasks")
    op.drop_index("ix_tasks_lead",          table_name="tasks")
    op.drop_index("ix_tasks_tenant",        table_name="tasks")
    op.drop_table("tasks")
