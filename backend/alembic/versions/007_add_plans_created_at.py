"""Add missing created_at column to plans table.

The Plan ORM model has carried a ``created_at`` column since the model
was updated, but no migration was ever generated for it. Every call to
``GET /api/v1/billing/current`` (and any other endpoint that SELECTs
from ``plans``) raises:

    UndefinedColumnError: column plans.created_at does not exist

This migration adds the column with a server-side default of ``now()``
so existing rows get the current timestamp (acceptable — plans were
seeded at schema creation and the created_at value is not user-visible).

Revision ID: 007
Revises: 006
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "plans",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("plans", "created_at")
