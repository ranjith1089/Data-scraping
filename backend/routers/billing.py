"""Billing visibility endpoints (GAP 6) — plan + usage + upgrade request.

No payment processing; upgrades are an audit-logged request that goes
to the super-admin, who then flips the plan manually from
``/admin/tenants/{id}``.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.ai_interaction import AIInteraction
from models.integration_event import IntegrationEvent
from models.lead import Lead
from models.plan import Plan
from models.tenant import Tenant
from models.user import User
from schemas.billing import (
    BillingCurrentResponse,
    PlanDetail,
    PlanLimits,
    PlanUsage,
    UpgradeRequest,
    UpgradeResponse,
    UsagePercent,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


def _pct(num: int, denom: int) -> float:
    if denom <= 0:
        return 0.0
    return round(min(num / denom * 100, 999.9), 1)


def _start_of_next_month(now: datetime) -> datetime:
    year = now.year + (1 if now.month == 12 else 0)
    month = 1 if now.month == 12 else now.month + 1
    return datetime(year, month, 1, tzinfo=timezone.utc)


@router.get("/current", response_model=BillingCurrentResponse)
async def current(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Resolve plan by name (tenants.plan is a string "starter"/"growth"/"enterprise")
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    plan_name = (tenant.plan or "starter").strip().lower()
    plan_row = (
        await db.execute(select(Plan).where(func.lower(Plan.name) == plan_name))
    ).scalar_one_or_none()

    if not plan_row:
        # Plan row might not be seeded — fall back to sensible defaults
        # so the UI doesn't crash on a fresh DB.
        plan_detail = PlanDetail(
            code=plan_name,
            name=plan_name.title(),
            price_inr=0 if plan_name == "starter" else (4999 if plan_name == "growth" else 14999),
            features={},
        )
        limits = PlanLimits(
            users={"starter": 3, "growth": 10, "enterprise": 1_000_000}.get(plan_name, 3),
            leads={"starter": 1_000, "growth": 10_000, "enterprise": 100_000}.get(plan_name, 1_000),
            ai_calls_per_month={
                "starter": 500, "growth": 5_000, "enterprise": 50_000
            }.get(plan_name, 500),
        )
    else:
        plan_detail = PlanDetail(
            code=plan_name,
            name=plan_row.name,
            price_inr=plan_row.price_inr,
            features=plan_row.features or {},
        )
        limits = PlanLimits(
            users=plan_row.max_users,
            leads=plan_row.max_leads,
            ai_calls_per_month=plan_row.max_ai_calls,
        )

    # Usage counters — simple COUNT(*) queries, RLS already filters.
    users_used = await db.scalar(
        select(func.count(User.id)).where(
            User.tenant_id == current_user.tenant_id,
            User.is_active.is_(True),
        )
    ) or 0
    leads_used = await db.scalar(
        select(func.count(Lead.id)).where(
            Lead.tenant_id == current_user.tenant_id
        )
    ) or 0

    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    ai_calls_this_month = await db.scalar(
        select(func.count(AIInteraction.id)).where(
            AIInteraction.tenant_id == current_user.tenant_id,
            AIInteraction.created_at >= month_start,
        )
    ) or 0
    ai_tokens_this_month = await db.scalar(
        select(
            func.coalesce(
                func.sum(AIInteraction.prompt_tokens + AIInteraction.completion_tokens),
                0,
            )
        ).where(
            AIInteraction.tenant_id == current_user.tenant_id,
            AIInteraction.created_at >= month_start,
        )
    ) or 0

    usage = PlanUsage(
        users=users_used,
        leads=leads_used,
        ai_calls_this_month=ai_calls_this_month,
        ai_tokens_this_month=int(ai_tokens_this_month),
    )
    percent = UsagePercent(
        users=_pct(users_used, limits.users),
        leads=_pct(leads_used, limits.leads),
        ai_calls=_pct(ai_calls_this_month, limits.ai_calls_per_month),
    )

    return BillingCurrentResponse(
        plan=plan_detail,
        limits=limits,
        usage=usage,
        percent_used=percent,
        next_reset_at=_start_of_next_month(now),
    )


@router.post("/request-upgrade", response_model=UpgradeResponse)
async def request_upgrade(
    body: UpgradeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a plan-upgrade request. Super-admin flips the plan manually.

    We don't run payment collection here — the constraint is explicit
    "NO complex billing engine". An audit row lands in
    ``integration_events`` (same pattern used for tenant lifecycle
    changes) so the operator can see pending requests in the super-admin
    console.
    """
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if (tenant.plan or "").lower() == body.target_plan:
        return UpgradeResponse(
            ok=True, message=f"You're already on the {body.target_plan} plan."
        )

    db.add(
        IntegrationEvent(
            tenant_id=current_user.tenant_id,
            direction="inbound",
            event_type="billing.upgrade_requested",
            status="ok",
            payload={
                "from_plan": tenant.plan,
                "to_plan": body.target_plan,
                "requested_by": str(current_user.id),
                "requested_by_email": current_user.email,
            },
        )
    )
    await db.flush()
    return UpgradeResponse(
        ok=True,
        message=(
            "Upgrade request received. Our team will reach out within 1 "
            "business day to confirm and enable the new plan."
        ),
    )
