"""Reposition the 'education' sector as Schools & Coaching.

Revision ID: 019
Revises: 018

Since migration 016 added a dedicated 'college' sector (Colleges &
Universities) for higher-ed admissions, the original generic 'education'
sector overlapped with it. This migration re-scopes 'education' to cover
ONLY schools (K-12), coaching / test-prep, tuition and edtech — so the
two sectors are distinct ("split by level").

Idempotent single-statement UPDATEs (asyncpg rejects multi-statement
strings), safe to re-run.
"""
from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text(
        "UPDATE sectors SET name = 'Schools & Coaching' WHERE code = 'education'"
    ))
    op.execute(sa.text(
        "UPDATE sectors SET description = "
        "'K-12 schools, CBSE/State/ICSE institutions, tuition & coaching "
        "centres, NEET/JEE test-prep academies, and edtech providers. "
        "(Higher-ed colleges & universities use the dedicated college sector.)' "
        "WHERE code = 'education'"
    ))
    op.execute(sa.text(
        "UPDATE sectors SET ai_persona = "
        "'Expert admissions & enrolment consultant for Schools & Coaching "
        "institutes in India. You understand the K-12 academic calendar, "
        "parent-driven decision making, board affiliations (CBSE/State/ICSE), "
        "coaching batch cycles (NEET/JEE foundation), and fee-structure "
        "sensitivities of school and coaching admissions.' "
        "WHERE code = 'education'"
    ))


def downgrade() -> None:
    op.execute(sa.text(
        "UPDATE sectors SET name = 'Education - Schools, Colleges & Training' "
        "WHERE code = 'education'"
    ))
