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
    # Use op.execute + IF NOT EXISTS so this is safe to re-run on Railway.
    # op.get_bind() is deprecated in Alembic 1.10+ and unreliable in async
    # setups; op.execute(sa.text(...)) is the correct pattern.
    op.execute(sa.text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS parent_name       VARCHAR"))
    op.execute(sa.text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS parent_phone      VARCHAR"))
    op.execute(sa.text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS course_interested VARCHAR"))
    op.execute(sa.text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS board             VARCHAR"))
    op.execute(sa.text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS stream            VARCHAR"))
    op.execute(sa.text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS percentage_marks  DOUBLE PRECISION"))
    op.execute(sa.text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS school_name       VARCHAR"))


def downgrade() -> None:
    op.drop_column("leads", "school_name")
    op.drop_column("leads", "percentage_marks")
    op.drop_column("leads", "stream")
    op.drop_column("leads", "board")
    op.drop_column("leads", "course_interested")
    op.drop_column("leads", "parent_phone")
    op.drop_column("leads", "parent_name")
