from .tenant import Tenant
from .plan import Plan
from .user import User
from .sector import Sector
from .lead import Lead
from .campaign import Campaign
from .campaign_step import CampaignStep
from .outreach_log import OutreachLog
from .ai_interaction import AIInteraction
from .activity import Activity
from .deal import Deal
from .pipeline_stage import PipelineStage
from .api_key import APIKey
from .integration import Integration
from .integration_event import IntegrationEvent
from .webhook_endpoint import WebhookEndpoint
from .webhook_subscription import WebhookSubscription
from .automation_rule import AutomationRule
from .lead_assignment_rule import LeadAssignmentRule
from .public_form import PublicForm

# AI Proposal module (Phase 1 — AI-generated sales proposals; migration 009).
from .proposal import Proposal

# Lead Enrichment module (Phase 2 — Apollo.io / Hunter.io; migration 010).
from .enrichment_log import EnrichmentLog

# LinkedIn Prospecting module (Phase 4 — ProxyCurl + AI messages; migration 011).
from .linkedin_message import LinkedInMessage

# WhatsApp Outreach module (Phase 5 — Meta Cloud API + AI messages; migration 012).
from .whatsapp_message import WhatsAppMessage

# Email Sequences module (Phase 6 — drip campaigns; migration 013).
from .email_sequence import EmailSequence, SequenceStep, SequenceEnrollment, SequenceEmailLog

# Deal Activities module (Phase 7 — won/lost tracking + deal timeline; migration 014).
from .deal_activity import DealActivity

# Tasks module (Phase 9 — tasks & follow-ups; migration 015).
from .task import Task

# Social module (Phase 1 — Instagram DM automation; migration 006).
from .social.social_account import SocialAccount
from .social.social_conversation import SocialConversation
from .social.social_message import SocialMessage
from .social.social_post import SocialPost
from .social.social_campaign import SocialCampaign, SocialCampaignPost
from .social.social_message_template import SocialMessageTemplate
from .social.social_follow_gate import SocialFollowGate
from .social.social_consent import SocialConsent

__all__ = [
    "Tenant",
    "Plan",
    "User",
    "Sector",
    "Lead",
    "Campaign",
    "CampaignStep",
    "OutreachLog",
    "AIInteraction",
    "Activity",
    "Deal",
    "PipelineStage",
    "APIKey",
    "Integration",
    "IntegrationEvent",
    "WebhookEndpoint",
    "WebhookSubscription",
    "AutomationRule",
    "LeadAssignmentRule",
    "PublicForm",
    # AI Proposal module
    "Proposal",
    # Lead Enrichment module
    "EnrichmentLog",
    # LinkedIn Prospecting module
    "LinkedInMessage",
    # WhatsApp Outreach module
    "WhatsAppMessage",
    # Email Sequences module
    "EmailSequence",
    "SequenceStep",
    "SequenceEnrollment",
    "SequenceEmailLog",
    # Deal Activities module
    "DealActivity",
    # Tasks module
    "Task",
    # Social module
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
