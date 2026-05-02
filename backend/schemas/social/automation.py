"""Schemas for social automation rules.

Reuses the existing ``automation_rules`` table — same trigger /
condition / action JSONB shape — but adds the social-scoped fields
(platform, campaign_id, priority, cooldown_minutes) and a fixed list
of social trigger / action types that the rule_engine knows how to
evaluate.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# Allowed trigger types for social-scoped rules. Free-form on the
# database side (existing legacy triggers like 'lead.created' keep
# working) but the API validates incoming social rules against this set.
SocialTriggerType = Literal[
    "comment.received",
    "dm.received",
    "story_reply.received",
    "story_reaction.received",
    "mention.received",
]


# Action vocabulary the action_executor can dispatch on.
SocialActionType = Literal[
    "send_dm",
    "send_dm_with_quick_replies",
    "create_lead",
    "tag_lead",
    "assign_lead",
    "update_stage",
    "apply_follow_gate",
    "wait_for_event",
    "create_activity",
    "send_email",
    "send_whatsapp",
    "webhook_publish",
]


class RuleCondition(BaseModel):
    """One condition in a rule. All conditions are AND-ed together."""

    field: str = Field(..., description="e.g. 'comment_text', 'commenter.handle', 'post_id'")
    op: Literal[
        "eq",
        "neq",
        "in",
        "not_in",
        "contains_any",
        "not_contains_any",
        "matches_regex",
        "exists",
        "not_exists",
    ]
    value: Any = None


class RuleAction(BaseModel):
    """One action in a rule. Actions execute in order."""

    type: SocialActionType
    config: dict[str, Any] = Field(default_factory=dict)


class AutomationRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    platform: Literal["instagram", "facebook", "whatsapp"] = "instagram"
    campaign_id: Optional[UUID] = None
    trigger_type: SocialTriggerType
    trigger_config: dict[str, Any] = Field(default_factory=dict)
    conditions: List[RuleCondition] = Field(default_factory=list)
    actions: List[RuleAction] = Field(..., min_length=1)
    priority: int = Field(default=100, ge=1, le=1000)
    cooldown_minutes: int = Field(default=0, ge=0, le=10_080)  # max 1 week
    enabled: bool = True


class AutomationRuleUpdate(BaseModel):
    name: Optional[str] = None
    campaign_id: Optional[UUID] = None
    trigger_config: Optional[dict[str, Any]] = None
    conditions: Optional[List[RuleCondition]] = None
    actions: Optional[List[RuleAction]] = None
    priority: Optional[int] = None
    cooldown_minutes: Optional[int] = None
    enabled: Optional[bool] = None


class AutomationRuleResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    platform: Optional[str] = None
    campaign_id: Optional[UUID] = None
    trigger_type: str
    trigger_config: Optional[dict[str, Any]] = None
    conditions: Optional[List[dict[str, Any]]] = None
    actions: Optional[List[dict[str, Any]]] = None
    priority: int
    cooldown_minutes: int
    enabled: bool
    run_count: int
    last_run_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RuleTestRequest(BaseModel):
    """Synthetic event payload for the dry-run endpoint."""

    sample_event: dict[str, Any]


class RuleTestResult(BaseModel):
    matched: bool
    reasons: List[str]
    simulated_actions: List[dict[str, Any]]
