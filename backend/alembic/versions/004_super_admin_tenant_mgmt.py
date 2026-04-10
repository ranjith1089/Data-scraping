"""Super-admin tenant management — additive schema.

Adds the platform-level super-admin layer:

* ``users.is_superuser`` — platform super-admin flag (bool, default false)
* ``tenants.status``      — lifecycle: active / suspended / cancelled
* ``tenants.owner_id``    — nullable FK to the tenant's primary owner user
* ``tenants.suspended_at`` / ``cancelled_at`` / ``updated_at`` — audit timestamps

Backfills:

* Mirrors ``is_active`` into ``status`` (active ↔ suspended)
* Seeds ``updated_at = created_at`` so the column is never NULL going forward
* Promotes the pre-seeded ``admin@leadforge.ai`` user to super-admin so the
  new admin UI works immediately after the migration lands
* Populates ``owner_id`` with the earliest-created ``role='owner'`` user per
  tenant (best-effort; stays NULL if the tenant has no owner yet)

Revision ID: 004
Revises: 003
Create Date: 2026-04-09 13:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # users.is_superuser
    # ------------------------------------------------------------------
    op.add_column(
        "users",
        sa.Column(
            "is_superuser",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Partial index — only super-admin rows are indexed. The table is
    # overwhelmingly non-superusers, so a partial index keeps it tiny
    # while still accelerating the "list all super-admins" path.
    op.create_index(
        "ix_users_is_superuser",
        "users",
        ["is_superuser"],
        postgresql_where=sa.text("is_superuser = true"),
    )

    # ------------------------------------------------------------------
    # tenants.status / owner_id / suspended_at / cancelled_at / updated_at
    # ------------------------------------------------------------------
    op.add_column(
        "tenants",
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="active",
        ),
    )
    op.add_column(
        "tenants",
        sa.Column("owner_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_foreign_key(
        "fk_tenants_owner_id_users",
        "tenants",
        "users",
        ["owner_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_tenants_status", "tenants", ["status"])

    # ------------------------------------------------------------------
    # Backfills
    # ------------------------------------------------------------------
    op.execute(
        "UPDATE tenants "
        "SET status = CASE WHEN is_active THEN 'active' ELSE 'suspended' END"
    )
    op.execute("UPDATE tenants SET updated_at = created_at WHERE updated_at IS NULL")

    # Promote the pre-seeded demo admin to platform super-admin so the
    # new /admin/tenants UI works out of the box. Email is the stable key
    # across fresh installs (id is regenerated in some environments).
    op.execute(
        "UPDATE users SET is_superuser = true "
        "WHERE email = 'admin@leadforge.ai'"
    )

    # Backfill owner_id with each tenant's earliest-created owner user.
    # Uses DISTINCT ON which is Postgres-specific — the whole project is
    # Postgres-only so this is fine.
    op.execute(
        """
        UPDATE tenants t
        SET owner_id = u.id
        FROM (
            SELECT DISTINCT ON (tenant_id) tenant_id, id
            FROM users
            WHERE role = 'owner'
            ORDER BY tenant_id, created_at ASC
        ) u
        WHERE u.tenant_id = t.id AND t.owner_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_tenants_status", table_name="tenants")
    op.drop_constraint("fk_tenants_owner_id_users", "tenants", type_="foreignkey")
    op.drop_column("tenants", "updated_at")
    op.drop_column("tenants", "cancelled_at")
    op.drop_column("tenants", "suspended_at")
    op.drop_column("tenants", "owner_id")
    op.drop_column("tenants", "status")

    op.drop_index("ix_users_is_superuser", table_name="users")
    op.drop_column("users", "is_superuser")
