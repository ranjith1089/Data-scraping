"""Trigger → Condition → Action evaluator for the social module.

The codebase has carried the ``automation_rules`` table since migration
003 with no runtime evaluator behind it. This module is that evaluator.

Public entry point:

    await evaluate_event(
        db, tenant_id,
        event_type="comment.received",
        event_payload={...},
        social_account_id=...,
        social_message_id=...,
    )

What it does:

1. Loads enabled rules for ``(tenant_id, platform_inferred, event_type)``
   ordered by ``priority`` ASC.
2. Walks each rule:
   - Cooldown gate (per-rule, per-account, per ``cooldown_minutes``)
   - Consent gate (refuses to fire on opted-out accounts)
   - Recursion guard (a rule fired by an earlier rule won't trigger
     more than 3 levels deep — keeps a misconfigured pair from
     spam-looping forever)
   - All conditions match (ALL-AND via keyword_matcher.all_conditions_match)
3. Hands the matched rules to ``action_executor.execute_actions`` which
   runs the action list.
4. Bumps ``run_count`` + ``last_run_at`` on every fired rule.
5. Writes one ``automation.fired`` audit row per firing into
   ``integration_events`` so analytics + forensics work later.

The function is async and returns a list of ``RuleFiring`` records so
callers (webhook receivers, replay jobs) can summarise what happened.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.automation_rule import AutomationRule
from models.integration_event import IntegrationEvent
from models.social.social_consent import SocialConsent
from models.social.social_message import SocialMessage

from . import action_executor as ae
from .keyword_matcher import all_conditions_match

logger = logging.getLogger(__name__)

# Maximum recursive firing depth. A rule whose actions cause another
# event to fire is allowed up to this many hops; beyond that we log
# and drop. Stops circular rule sets from running forever.
_MAX_CHAIN_DEPTH = 3

# Trigger types the engine accepts. Extending this requires no code
# change here — the rule_engine routes on free-form trigger_type. The
# allow-list is enforced at the API layer (Pydantic Literal type in
# schemas/social/automation.py).
_SOCIAL_TRIGGERS = {
    "comment.received",
    "dm.received",
    "story_reply.received",
    "story_reaction.received",
    "mention.received",
}


@dataclass
class RuleFiring:
    """One rule's evaluation result. Returned by evaluate_event."""

    rule_id: UUID
    rule_name: str
    fired: bool
    reasons: list[str] = field(default_factory=list)
    action_results: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class EvaluationContext:
    """Carry-along state for a single evaluate_event call."""

    db: AsyncSession
    tenant_id: UUID
    event_type: str
    event_payload: dict[str, Any]
    platform: str
    social_account_id: Optional[UUID]
    social_message_id: Optional[UUID]
    chain_depth: int = 0


async def _load_candidate_rules(
    ctx: EvaluationContext,
) -> list[AutomationRule]:
    """Fetch enabled rules matching this event's platform + trigger."""
    stmt = (
        select(AutomationRule)
        .where(
            AutomationRule.tenant_id == ctx.tenant_id,
            AutomationRule.enabled.is_(True),
            AutomationRule.trigger_type == ctx.event_type,
            (AutomationRule.platform == ctx.platform)
            | (AutomationRule.platform.is_(None)),
        )
        .order_by(AutomationRule.priority.asc())
    )
    result = await ctx.db.execute(stmt)
    return list(result.scalars().all())


async def _is_opted_out(ctx: EvaluationContext) -> bool:
    """Check the most recent consent row for this social account."""
    if not ctx.social_account_id:
        return False
    stmt = (
        select(SocialConsent)
        .where(
            SocialConsent.tenant_id == ctx.tenant_id,
            SocialConsent.social_account_id == ctx.social_account_id,
        )
        .order_by(desc(SocialConsent.recorded_at))
        .limit(1)
    )
    result = await ctx.db.execute(stmt)
    most_recent = result.scalar_one_or_none()
    if not most_recent:
        return False
    return most_recent.consent_type == "opt_out"


async def _is_in_cooldown(
    ctx: EvaluationContext, rule: AutomationRule
) -> bool:
    """Has this rule fired for this same social_account within
    ``cooldown_minutes``?"""
    if not rule.cooldown_minutes or rule.cooldown_minutes <= 0:
        return False
    if not ctx.social_account_id:
        return False
    cutoff = datetime.now(timezone.utc) - timedelta(
        minutes=rule.cooldown_minutes
    )
    # Cheapest possible check: any social_messages.rule_id == rule.id
    # for messages in this account's conversation since the cutoff.
    # We join via conversation indirectly through tenant + sender.
    from models.social.social_conversation import SocialConversation

    stmt = (
        select(SocialMessage.id)
        .join(
            SocialConversation,
            SocialMessage.conversation_id == SocialConversation.id,
        )
        .where(
            SocialMessage.tenant_id == ctx.tenant_id,
            SocialMessage.rule_id == rule.id,
            SocialConversation.social_account_id == ctx.social_account_id,
            SocialMessage.created_at >= cutoff,
        )
        .limit(1)
    )
    result = await ctx.db.execute(stmt)
    return result.scalar_one_or_none() is not None


async def _record_firing_audit(
    ctx: EvaluationContext,
    rule: AutomationRule,
    fired: bool,
    reasons: list[str],
    action_results: list[dict[str, Any]],
) -> None:
    """Append an integration_events row for forensics + analytics."""
    try:
        ctx.db.add(
            IntegrationEvent(
                tenant_id=ctx.tenant_id,
                integration_id=None,
                direction="inbound",
                event_type=f"automation.{ 'fired' if fired else 'skipped' }",
                status="ok" if fired else "skipped",
                payload={
                    "rule_id": str(rule.id),
                    "rule_name": rule.name,
                    "trigger": ctx.event_type,
                    "platform": ctx.platform,
                    "reasons": reasons[:5],
                    "action_count": len(action_results),
                    "chain_depth": ctx.chain_depth,
                },
            )
        )
    except Exception as exc:  # noqa: BLE001 — audit must not break the flow
        logger.warning("Failed to write automation.fired audit row: %s", exc)


async def evaluate_event(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    event_type: str,
    event_payload: dict[str, Any],
    platform: str = "instagram",
    social_account_id: Optional[UUID] = None,
    social_message_id: Optional[UUID] = None,
    chain_depth: int = 0,
) -> list[RuleFiring]:
    """Match every enabled rule for this event and execute the matched
    rules' actions. Returns one :class:`RuleFiring` per rule we
    considered (fired or skipped).

    Safe to call from inside a webhook handler — runs synchronously in
    the caller's transaction so the receiver gets back-pressure if the
    engine is slow.
    """
    if event_type not in _SOCIAL_TRIGGERS:
        logger.debug("evaluate_event called with non-social trigger %s", event_type)
        return []
    if chain_depth > _MAX_CHAIN_DEPTH:
        logger.warning(
            "rule chain depth exceeded (>%d) for tenant=%s event=%s — refusing",
            _MAX_CHAIN_DEPTH,
            tenant_id,
            event_type,
        )
        return []

    ctx = EvaluationContext(
        db=db,
        tenant_id=tenant_id,
        event_type=event_type,
        event_payload=event_payload,
        platform=platform,
        social_account_id=social_account_id,
        social_message_id=social_message_id,
        chain_depth=chain_depth,
    )

    if await _is_opted_out(ctx):
        logger.info(
            "tenant=%s account=%s is opted out — skipping all rules",
            tenant_id,
            social_account_id,
        )
        return []

    rules = await _load_candidate_rules(ctx)
    firings: list[RuleFiring] = []

    for rule in rules:
        # Conditions
        ok, failed = all_conditions_match(
            list(rule.conditions or []), event_payload
        )
        if not ok:
            firings.append(
                RuleFiring(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    fired=False,
                    reasons=failed,
                )
            )
            continue

        # Cooldown
        if await _is_in_cooldown(ctx, rule):
            reasons = [f"cooldown active ({rule.cooldown_minutes}m)"]
            firings.append(
                RuleFiring(
                    rule_id=rule.id, rule_name=rule.name, fired=False, reasons=reasons
                )
            )
            await _record_firing_audit(ctx, rule, False, reasons, [])
            continue

        # Execute actions
        try:
            action_results = await ae.execute_actions(
                db=db,
                tenant_id=tenant_id,
                rule=rule,
                actions=list(rule.actions or []),
                event_payload=event_payload,
                social_account_id=social_account_id,
                social_message_id=social_message_id,
                chain_depth=chain_depth,
            )
            firing = RuleFiring(
                rule_id=rule.id,
                rule_name=rule.name,
                fired=True,
                action_results=action_results,
            )
        except Exception as exc:  # noqa: BLE001 — never crash the receiver
            logger.exception(
                "action_executor crashed for rule=%s tenant=%s: %s",
                rule.id,
                tenant_id,
                exc,
            )
            firing = RuleFiring(
                rule_id=rule.id,
                rule_name=rule.name,
                fired=False,
                reasons=[f"action_executor error: {type(exc).__name__}: {exc}"],
            )

        # Bump usage counters (best-effort)
        try:
            rule.run_count = (rule.run_count or 0) + 1
            rule.last_run_at = datetime.now(timezone.utc)
        except Exception:  # noqa: BLE001
            pass

        await _record_firing_audit(
            ctx, rule, firing.fired, firing.reasons, firing.action_results
        )
        firings.append(firing)

    return firings
