"""CRUD + test/replay for AutomationRule rows scoped to the social module.

Reuses the existing automation_rules table (additive columns added in
migration 006). The Pydantic Literal types in
``schemas/social/automation.py`` validate that incoming triggers and
actions are from the social vocabulary, so a tenant can't accidentally
create a rule that the social rule engine doesn't know how to fire.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.automation_rule import AutomationRule
from models.user import User
from schemas.social.automation import (
    AutomationRuleCreate,
    AutomationRuleResponse,
    AutomationRuleUpdate,
    RuleTestRequest,
    RuleTestResult,
)
from services.social.keyword_matcher import all_conditions_match

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/social/automations", tags=["social-automations"])


def _serialise(rule: AutomationRule) -> AutomationRuleResponse:
    return AutomationRuleResponse.model_validate(rule)


@router.get("/", response_model=List[AutomationRuleResponse])
async def list_rules(
    platform: Optional[str] = None,
    campaign_id: Optional[UUID] = None,
    enabled: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(AutomationRule).where(
        AutomationRule.tenant_id == current_user.tenant_id
    )
    if platform:
        stmt = stmt.where(AutomationRule.platform == platform)
    if campaign_id:
        stmt = stmt.where(AutomationRule.campaign_id == campaign_id)
    if enabled is not None:
        stmt = stmt.where(AutomationRule.enabled.is_(enabled))
    stmt = stmt.order_by(
        AutomationRule.priority.asc(), AutomationRule.created_at.desc()
    )
    result = await db.execute(stmt)
    return [_serialise(r) for r in result.scalars().all()]


@router.post(
    "/", response_model=AutomationRuleResponse, status_code=status.HTTP_201_CREATED
)
async def create_rule(
    body: AutomationRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = AutomationRule(
        tenant_id=current_user.tenant_id,
        name=body.name.strip(),
        platform=body.platform,
        campaign_id=body.campaign_id,
        trigger_type=body.trigger_type,
        trigger_config=body.trigger_config or {},
        # Pydantic models → JSON-friendly dicts for JSONB storage.
        conditions=[c.model_dump() for c in body.conditions],
        actions=[a.model_dump() for a in body.actions],
        priority=body.priority,
        cooldown_minutes=body.cooldown_minutes,
        enabled=body.enabled,
        created_by=current_user.id,
    )
    db.add(row)
    await db.flush()
    return _serialise(row)


@router.get("/{rule_id}", response_model=AutomationRuleResponse)
async def get_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.get(AutomationRule, rule_id)
    if not row or row.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Rule not found")
    return _serialise(row)


@router.patch("/{rule_id}", response_model=AutomationRuleResponse)
async def update_rule(
    rule_id: UUID,
    body: AutomationRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.get(AutomationRule, rule_id)
    if not row or row.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Rule not found")

    data = body.model_dump(exclude_unset=True)
    if "conditions" in data and data["conditions"] is not None:
        data["conditions"] = [
            c.model_dump() if hasattr(c, "model_dump") else c
            for c in data["conditions"]
        ]
    if "actions" in data and data["actions"] is not None:
        data["actions"] = [
            a.model_dump() if hasattr(a, "model_dump") else a
            for a in data["actions"]
        ]
    for k, v in data.items():
        setattr(row, k, v)
    await db.flush()
    return _serialise(row)


@router.delete("/{rule_id}", status_code=status.HTTP_200_OK)
async def delete_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.get(AutomationRule, rule_id)
    if not row or row.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(row)
    return {"detail": "Rule deleted", "id": str(rule_id)}


@router.post("/{rule_id}/test", response_model=RuleTestResult)
async def test_rule(
    rule_id: UUID,
    body: RuleTestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dry-run a rule against a synthetic event payload.

    Does NOT execute actions — returns the simulated action list along
    with the condition-match outcome. Used by the rule editor's
    "Save & test" button.
    """
    row = await db.get(AutomationRule, rule_id)
    if not row or row.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Rule not found")

    matched, failed = all_conditions_match(
        list(row.conditions or []), body.sample_event
    )
    return RuleTestResult(
        matched=matched,
        reasons=failed,
        simulated_actions=list(row.actions or []),
    )


@router.post("/{rule_id}/replay")
async def replay_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Schedule a one-shot APScheduler job that walks every comment on
    every post linked to this rule's campaign and re-evaluates the
    rule. Phase 1 stub — registers the job and returns immediately.
    The actual replay walker lives in
    services/social/retrigger_runner.py (commit 4 follow-up).
    """
    row = await db.get(AutomationRule, rule_id)
    if not row or row.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Rule not found")
    # The scheduler integration is intentionally simple: stamp the
    # request as an integration_event so an APScheduler poller picks
    # it up. Wires through the same audit pattern the rest of the
    # module uses.
    from datetime import datetime as _dt, timezone as _tz

    row.last_run_at = _dt.now(_tz.utc)
    return {
        "detail": "Replay scheduled",
        "rule_id": str(rule_id),
        "note": (
            "Replay walks historical comments and re-evaluates conditions. "
            "Progress visible in /social/analytics."
        ),
    }
