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
    op.add_column("leads", sa.Column("parent_name",       sa.String(), nullable=True))
    op.add_column("leads", sa.Column("parent_phone",      sa.String(), nullable=True))
    op.add_column("leads", sa.Column("course_interested", sa.String(), nullable=True))
    op.add_column("leads", sa.Column("board",             sa.String(), nullable=True))
    op.add_column("leads", sa.Column("stream",            sa.String(), nullable=True))
    op.add_column("leads", sa.Column("percentage_marks",  sa.Float(),  nullable=True))
    op.add_column("leads", sa.Column("school_name",       sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "school_name")
    op.drop_column("leads", "percentage_marks")
    op.drop_column("leads", "stream")
    op.drop_column("leads", "board")
    op.drop_column("leads", "course_interested")
    op.drop_column("leads", "parent_phone")
    op.drop_column("leads", "parent_name")
