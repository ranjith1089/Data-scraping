"""Social module — Instagram DM automation, lead capture, conversations.

Adds the schema for the LeadForge Social module (Phase 1 — Instagram-first).
Fully additive: 9 new tables, 4 new columns on automation_rules. Existing
rows are untouched.

* social_accounts          — external profiles we've seen (commenters, DMers)
* social_conversations     — thread-level grouping per (tenant, social_account)
* social_messages          — every inbound + outbound message with rich metadata
* social_posts             — IG / FB posts the tenant has put under automation
* social_campaigns         — campaign-level grouping of rules + posts
* social_campaign_posts    — many-to-many between campaigns and posts
* social_message_templates — reusable DM bodies with variable placeholders
* social_follow_gates      — pending "follow then send link" tasks
* social_consents          — opt-in / opt-out / DPDP audit trail

Plus on automation_rules: platform, campaign_id, priority, cooldown_minutes —
so the existing trigger/condition/action engine can scope rules per channel
and per campaign.

All new tables enable Row-Level Security with the standard tenant_isolation
policy ``USING (tenant_id = current_setting('app.current_tenant', true)::uuid)``.

Revision ID: 006
Revises: 005
Create Date: 2026-04-21 14:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _enable_rls(table: str) -> None:
    """Apply the standard per-tenant RLS policy on a new table."""
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        """
    )


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1) social_accounts
    # ------------------------------------------------------------------
    op.create_table(
        "social_accounts",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("external_user_id", sa.String(120), nullable=False),
        sa.Column("handle", sa.String(120), nullable=True),
        sa.Column("display_name", sa.String(200), nullable=True),
        sa.Column("profile_picture_url", sa.Text(), nullable=True),
        sa.Column(
            "lead_id",
            UUID(as_uuid=True),
            sa.ForeignKey("leads.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "first_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("metadata_json", JSONB(), nullable=True, server_default="{}"),
        sa.UniqueConstraint(
            "tenant_id",
            "platform",
            "external_user_id",
            name="uq_social_accounts_tenant_platform_user",
        ),
    )
    op.create_index(
        "ix_social_accounts_lead", "social_accounts", ["lead_id"]
    )
    _enable_rls("social_accounts")

    # ------------------------------------------------------------------
    # 2) social_conversations
    # ------------------------------------------------------------------
    op.create_table(
        "social_conversations",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "social_account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("social_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="open",
        ),
        sa.Column(
            "assigned_to",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_message_preview", sa.Text(), nullable=True),
        sa.Column(
            "unread_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_social_conv_account", "social_conversations", ["social_account_id"]
    )
    op.create_index(
        "ix_social_conv_assigned", "social_conversations", ["assigned_to"]
    )
    _enable_rls("social_conversations")

    # ------------------------------------------------------------------
    # 3) social_posts (created BEFORE social_messages because messages FK to it)
    # ------------------------------------------------------------------
    op.create_table(
        "social_posts",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("external_post_id", sa.String(120), nullable=False),
        sa.Column("permalink", sa.Text(), nullable=True),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("media_url", sa.Text(), nullable=True),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "platform",
            "external_post_id",
            name="uq_social_posts_tenant_platform_post",
        ),
    )
    _enable_rls("social_posts")

    # ------------------------------------------------------------------
    # 4) social_campaigns (created BEFORE social_messages — messages FK rule_id
    #    points to automation_rules, but campaigns are referenced by
    #    automation_rules ALTER below)
    # ------------------------------------------------------------------
    op.create_table(
        "social_campaigns",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="active",
        ),
        sa.Column("goal", sa.String(40), nullable=True),
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    _enable_rls("social_campaigns")

    # ------------------------------------------------------------------
    # 5) social_campaign_posts (many-to-many)
    # ------------------------------------------------------------------
    op.create_table(
        "social_campaign_posts",
        sa.Column(
            "campaign_id",
            UUID(as_uuid=True),
            sa.ForeignKey("social_campaigns.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "post_id",
            UUID(as_uuid=True),
            sa.ForeignKey("social_posts.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )

    # ------------------------------------------------------------------
    # 6) automation_rules — additive columns
    # ------------------------------------------------------------------
    op.add_column(
        "automation_rules",
        sa.Column("platform", sa.String(20), nullable=True),
    )
    op.add_column(
        "automation_rules",
        sa.Column(
            "campaign_id",
            UUID(as_uuid=True),
            sa.ForeignKey("social_campaigns.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "automation_rules",
        sa.Column(
            "priority",
            sa.Integer(),
            nullable=False,
            server_default="100",
        ),
    )
    op.add_column(
        "automation_rules",
        sa.Column(
            "cooldown_minutes",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    op.create_index(
        "ix_automation_rules_platform_trigger",
        "automation_rules",
        ["platform", "trigger_type"],
    )
    op.create_index(
        "ix_automation_rules_campaign", "automation_rules", ["campaign_id"]
    )

    # ------------------------------------------------------------------
    # 7) social_messages (FKs to conversations, posts, automation_rules)
    # ------------------------------------------------------------------
    op.create_table(
        "social_messages",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "conversation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("social_conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("direction", sa.String(10), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("external_message_id", sa.String(200), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column(
            "attachments", JSONB(), nullable=True, server_default="[]"
        ),
        sa.Column(
            "trigger_post_id",
            UUID(as_uuid=True),
            sa.ForeignKey("social_posts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "rule_id",
            UUID(as_uuid=True),
            sa.ForeignKey("automation_rules.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="received",
        ),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    # Webhook dedup: same (platform, external_message_id) is rejected on the
    # second arrival. Partial unique index — null external IDs are not deduped.
    op.create_index(
        "ix_social_msg_external",
        "social_messages",
        ["platform", "external_message_id"],
        unique=True,
        postgresql_where=sa.text("external_message_id IS NOT NULL"),
    )
    op.create_index(
        "ix_social_msg_conv", "social_messages", ["conversation_id"]
    )
    _enable_rls("social_messages")

    # ------------------------------------------------------------------
    # 8) social_message_templates
    # ------------------------------------------------------------------
    op.create_table(
        "social_message_templates",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "language", sa.String(8), nullable=False, server_default="en"
        ),
        sa.Column(
            "variables", JSONB(), nullable=True, server_default="[]"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    _enable_rls("social_message_templates")

    # ------------------------------------------------------------------
    # 9) social_follow_gates
    # ------------------------------------------------------------------
    op.create_table(
        "social_follow_gates",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "social_account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("social_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "rule_id",
            UUID(as_uuid=True),
            sa.ForeignKey("automation_rules.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("message_to_send", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fulfilled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    _enable_rls("social_follow_gates")

    # ------------------------------------------------------------------
    # 10) social_consents
    # ------------------------------------------------------------------
    op.create_table(
        "social_consents",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tenant_id",
            UUID(as_uuid=True),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "social_account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("social_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("consent_type", sa.String(40), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column("evidence", JSONB(), nullable=True),
    )
    _enable_rls("social_consents")


def downgrade() -> None:
    op.execute(
        "DROP POLICY IF EXISTS tenant_isolation ON social_consents"
    )
    op.drop_table("social_consents")

    op.execute(
        "DROP POLICY IF EXISTS tenant_isolation ON social_follow_gates"
    )
    op.drop_table("social_follow_gates")

    op.execute(
        "DROP POLICY IF EXISTS tenant_isolation ON social_message_templates"
    )
    op.drop_table("social_message_templates")

    op.execute(
        "DROP POLICY IF EXISTS tenant_isolation ON social_messages"
    )
    op.drop_table("social_messages")

    op.drop_index("ix_automation_rules_campaign", table_name="automation_rules")
    op.drop_index(
        "ix_automation_rules_platform_trigger", table_name="automation_rules"
    )
    op.drop_column("automation_rules", "cooldown_minutes")
    op.drop_column("automation_rules", "priority")
    op.drop_column("automation_rules", "campaign_id")
    op.drop_column("automation_rules", "platform")

    op.drop_table("social_campaign_posts")

    op.execute(
        "DROP POLICY IF EXISTS tenant_isolation ON social_campaigns"
    )
    op.drop_table("social_campaigns")

    op.execute(
        "DROP POLICY IF EXISTS tenant_isolation ON social_posts"
    )
    op.drop_table("social_posts")

    op.execute(
        "DROP POLICY IF EXISTS tenant_isolation ON social_conversations"
    )
    op.drop_table("social_conversations")

    op.execute(
        "DROP POLICY IF EXISTS tenant_isolation ON social_accounts"
    )
    op.drop_table("social_accounts")
