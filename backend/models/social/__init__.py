"""Social module ORM models — Phase 1 (Instagram-first DM automation).

Each row is tenant-scoped via ``tenant_id`` + Postgres RLS policy
``USING (tenant_id = current_setting('app.current_tenant', true)::uuid)``.

The module's runtime engine (rule_engine + action_executor) lives at
``backend/services/social/``; these are pure data-shape definitions.
"""

from .social_account import SocialAccount
from .social_conversation import SocialConversation
from .social_message import SocialMessage
from .social_post import SocialPost
from .social_campaign import SocialCampaign, SocialCampaignPost
from .social_message_template import SocialMessageTemplate
from .social_follow_gate import SocialFollowGate
from .social_consent import SocialConsent

__all__ = [
    "SocialAccount",
    "SocialConversation",
    "SocialMessage",
    "SocialPost",
    "SocialCampaign",
    "SocialCampaignPost",
    "SocialMessageTemplate",
    "SocialFollowGate",
    "SocialConsent",
]
