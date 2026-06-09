"""Add student admission fields to leads + extend LeadSource enum.

Revision ID: 017
Revises: 016

New columns on `leads`:
  parent_name, parent_phone, course_interested, board, stream,
  percentage_marks, school_name

New LeadSource values (stored as plain VARCHAR — no Postgres enum change
needed because the column is already VARCHAR, not a PG ENUM type):
  phone_enquiry, walk_in, stall, school_visit, instagram, facebook
"""
from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use IF NOT EXISTS so this migration is safe to re-run on Railway
    # even if a previous deploy partially applied it.
    conn = op.get_bind()
    conn.execute(sa.text(
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS parent_name       VARCHAR"
    ))
    conn.execute(sa.text(
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS parent_phone      VARCHAR"
    ))
    conn.execute(sa.text(
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS course_interested VARCHAR"
    ))
    conn.execute(sa.text(
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS board             VARCHAR"
    ))
    conn.execute(sa.text(
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS stream            VARCHAR"
    ))
    conn.execute(sa.text(
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS percentage_marks  DOUBLE PRECISION"
    ))
    conn.execute(sa.text(
        "ALTER TABLE leads ADD COLUMN IF NOT EXISTS school_name       VARCHAR"
    ))


def downgrade() -> None:
    op.drop_column("leads", "school_name")
    op.drop_column("leads", "percentage_marks")
    op.drop_column("leads", "stream")
    op.drop_column("leads", "board")
    op.drop_column("leads", "course_interested")
    op.drop_column("leads", "parent_phone")
    op.drop_column("leads", "parent_name")
