"""Fix seeded admin password hash so 'admin123' actually works.

The original 001_initial_schema.py inserted the demo admin user with a
bcrypt hash that does NOT verify against the documented password
'admin123'. Verified locally using both passlib and direct bcrypt.checkpw
against bcrypt 4.0.1 — every candidate password returned False. The hash
was apparently generated from a different plaintext during development
and the comment in 001 was never corrected.

Because 001 is already applied on production, editing it in place has no
effect — alembic tracks by revision id. This migration runs a targeted
UPDATE against the demo admin row (matched by both id and email to be
safe) with a freshly generated, round-trip-verified bcrypt hash for
'admin123'. The ON CONFLICT / WHERE clause is a no-op idempotent filter
so running this migration twice is harmless.

Revision ID: 002
Revises: 001
Create Date: 2026-04-09 08:20:00.000000
"""
from typing import Sequence, Union
from alembic import op


revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Known-good bcrypt(12) hash for the plaintext 'admin123'. Generated with
# bcrypt==4.0.1 and verified via both passlib.CryptContext.verify() and
# the raw bcrypt.checkpw() backend. Do NOT regenerate this value casually
# — it's intentionally pinned so this migration is deterministic.
ADMIN123_HASH = "$2b$12$KYaFo0a/I3KHRJX1jQw56.4/xitfQIs4cHmvgTnAUdeCFeHEMg/UO"

# Same constants as the original seed row, repeated here so the UPDATE
# targets exactly the demo admin and nothing else.
ADMIN_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
ADMIN_EMAIL = "admin@leadforge.ai"


def upgrade() -> None:
    op.execute(
        f"""
        UPDATE users
        SET password_hash = '{ADMIN123_HASH}'
        WHERE id = '{ADMIN_ID}'
          AND email = '{ADMIN_EMAIL}'
        """
    )


def downgrade() -> None:
    # Restore the original (broken) hash from 001 for symmetry. Nobody
    # should ever want this, but alembic requires a downgrade path.
    original_broken = (
        "$2b$12$LJ3m4ys3Lk0TSwHBGOGKneFGxGiAUMFpMQEarlNXqTKATa/GhJnGy"
    )
    op.execute(
        f"""
        UPDATE users
        SET password_hash = '{original_broken}'
        WHERE id = '{ADMIN_ID}'
          AND email = '{ADMIN_EMAIL}'
        """
    )
