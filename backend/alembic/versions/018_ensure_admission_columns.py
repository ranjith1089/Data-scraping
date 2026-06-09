"""Ensure admission columns exist on leads (idempotent safety net for 017).

Revision ID: 018
Revises: 017

This migration re-applies the same IF NOT EXISTS ALTER TABLEs as 017 so
that the columns are guaranteed to exist even if 017 was stamped in
alembic_version before its DDL committed (e.g. a failed Railway deploy).
It is a pure no-op when the columns are already present.
"""
from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for col, ddl_type in [
        ("parent_name",       "VARCHAR"),
        ("parent_phone",      "VARCHAR"),
        ("course_interested", "VARCHAR"),
        ("board",             "VARCHAR"),
        ("stream",            "VARCHAR"),
        ("percentage_marks",  "DOUBLE PRECISION"),
        ("school_name",       "VARCHAR"),
    ]:
        op.execute(sa.text(
            f"ALTER TABLE leads ADD COLUMN IF NOT EXISTS {col} {ddl_type}"
        ))


def downgrade() -> None:
    # Nothing to undo — 017 handles the actual downgrade
    pass
