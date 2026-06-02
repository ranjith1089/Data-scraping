"""Rename seeded admin email from leadforge.ai to aveonapex.ai.

The brand was renamed from LeadForge AI to AveonApex after migrations
001 and 002 had already been applied to production. Those migrations
seeded and patched the admin user with email 'admin@leadforge.ai'.

The rename commit updated the migration file *content* but Alembic
tracks by revision ID, so the production database was untouched.
This migration performs the actual UPDATE so the live admin email
matches the new brand.

After this migration the admin credentials become:
    email:    admin@aveonapex.ai
    password: admin123

Revision ID: 008
Revises: 007
"""

from __future__ import annotations

from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None

# UUIDs match the row seeded in migration 001.
ADMIN_ID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
OLD_EMAIL = "admin@leadforge.ai"
NEW_EMAIL = "admin@aveonapex.ai"


def upgrade() -> None:
    op.execute(
        f"""
        UPDATE users
        SET email = '{NEW_EMAIL}'
        WHERE id = '{ADMIN_ID}'
          AND email = '{OLD_EMAIL}'
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        UPDATE users
        SET email = '{OLD_EMAIL}'
        WHERE id = '{ADMIN_ID}'
          AND email = '{NEW_EMAIL}'
        """
    )
