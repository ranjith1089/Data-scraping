"""Super-admin tenant management routes.

Cross-tenant CRUD + lifecycle management for the platform operator.
Every endpoint is gated by :func:`require_superuser`, which checks the
``users.is_superuser`` flag introduced in migration 004.

These routes intentionally **do not** filter by ``current_user.tenant_id``
in their WHERE clauses — they are the one place in the codebase where a
user can touch data belonging to other tenants.

Every mutation writes an audit row into ``integration_events`` with
``event_type='tenant.<action>'`` so the platform operator has a complete
paper trail.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db, require_superuser
from core.security import hash_password
from models.campaign import Campaign
from models.integration import Integration
from models.integration_event import IntegrationEvent
from models.lead import Lead
from models.tenant import Tenant
from models.user import User
from schemas.tenant import (
    AdminTenantCreate,
    AdminTenantListResponse,
    AdminTenantResponse,
    AdminTenantStatsResponse,
    AdminTenantUpdate,
    AdminUserInTenantCreate,
    AdminUserResponse,
)

router = APIRouter(prefix="/admin/tenants", tags=["admin-tenants"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _record_event(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    actor_user_id: UUID,
    action: str,
    payload: Optional[dict] = None,
    lead_id: Optional[UUID] = None,
) -> None:
    """Append a best-effort audit row. Never raises.

    Re-uses the ``integration_events`` table to avoid spinning up a
    second audit-log table for the admin surface.
    """
    try:
        db.add(
            IntegrationEvent(
                tenant_id=tenant_id,
                integration_id=None,
                direction="inbound",
                event_type=f"tenant.{action}",
                payload={
                    "actor_user_id": str(actor_user_id),
                    **(payload or {}),
                },
                status="ok",
                lead_id=lead_id,
            )
        )
        await db.flush()
    except Exception:  # noqa: BLE001 — audit must never block the mutation
        # Roll back only the failed event insert — we don't want to
        # nuke the outer transaction that successfully mutated the
        # tenant row. SQLAlchemy doesn't give us a cheap savepoint for
        # a single add, so the simplest safe thing is to swallow.
        pass


async def _tenant_with_counts(
    db: AsyncSession, tenant: Tenant
) -> AdminTenantResponse:
    """Hydrate a Tenant ORM row into the API response DTO with counts."""
    user_count_result = await db.execute(
        select(func.count(User.id)).where(User.tenant_id == tenant.id)
    )
    lead_count_result = await db.execute(
        select(func.count(Lead.id)).where(Lead.tenant_id == tenant.id)
    )
    return AdminTenantResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        plan=tenant.plan,
        status=getattr(tenant, "status", "active") or "active",
        is_active=tenant.is_active,
        settings=tenant.settings,
        owner_id=getattr(tenant, "owner_id", None),
        suspended_at=getattr(tenant, "suspended_at", None),
        cancelled_at=getattr(tenant, "cancelled_at", None),
        created_at=tenant.created_at,
        updated_at=getattr(tenant, "updated_at", None),
        user_count=int(user_count_result.scalar() or 0),
        lead_count=int(lead_count_result.scalar() or 0),
    )


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@router.get("/", response_model=AdminTenantListResponse)
async def list_tenants(
    q: Optional[str] = Query(None, description="Search name or slug"),
    status_filter: Optional[str] = Query(None, alias="status"),
    plan: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superuser),
):
    """List every tenant on the platform with optional filtering."""
    conds = []
    if q:
        like = f"%{q.lower()}%"
        conds.append(
            or_(func.lower(Tenant.name).like(like), func.lower(Tenant.slug).like(like))
        )
    if status_filter:
        conds.append(Tenant.status == status_filter)
    if plan:
        conds.append(Tenant.plan == plan)

    where_clause = and_(*conds) if conds else None

    # Total
    count_stmt = select(func.count(Tenant.id))
    if where_clause is not None:
        count_stmt = count_stmt.where(where_clause)
    total_result = await db.execute(count_stmt)
    total = int(total_result.scalar() or 0)

    # Page
    stmt = select(Tenant).order_by(Tenant.created_at.desc())
    if where_clause is not None:
        stmt = stmt.where(where_clause)
    stmt = stmt.limit(limit).offset(offset)

    result = await db.execute(stmt)
    tenants = result.scalars().all()

    items = [await _tenant_with_counts(db, t) for t in tenants]
    return AdminTenantListResponse(
        items=items, total=total, limit=limit, offset=offset
    )


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@router.post(
    "/",
    response_model=AdminTenantResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tenant(
    body: AdminTenantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superuser),
):
    """Create a new tenant, optionally with its initial owner user."""
    # Slug uniqueness
    dupe = await db.execute(select(Tenant).where(Tenant.slug == body.slug))
    if dupe.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant slug already taken",
        )

    tenant = Tenant(
        name=body.name,
        slug=body.slug,
        plan=body.plan.value,
        settings=body.settings or {},
        status="active",
        is_active=True,
        updated_at=_now(),
    )
    db.add(tenant)
    await db.flush()  # assigns tenant.id

    owner_user: Optional[User] = None
    if body.owner is not None:
        owner_user = User(
            tenant_id=tenant.id,
            email=body.owner.email,
            password_hash=hash_password(body.owner.password),
            full_name=body.owner.full_name,
            role="owner",
            is_active=True,
        )
        db.add(owner_user)
        await db.flush()
        tenant.owner_id = owner_user.id
        await db.flush()

    await _record_event(
        db,
        tenant_id=tenant.id,
        actor_user_id=current_user.id,
        action="created",
        payload={
            "name": tenant.name,
            "slug": tenant.slug,
            "plan": tenant.plan,
            "owner_created": owner_user is not None,
        },
    )

    return await _tenant_with_counts(db, tenant)


# ---------------------------------------------------------------------------
# Detail
# ---------------------------------------------------------------------------


@router.get("/{tenant_id}", response_model=AdminTenantResponse)
async def get_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superuser),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )
    return await _tenant_with_counts(db, tenant)


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


@router.patch("/{tenant_id}", response_model=AdminTenantResponse)
async def update_tenant(
    tenant_id: UUID,
    body: AdminTenantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superuser),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    changes = body.model_dump(exclude_unset=True)

    # Validate owner_id belongs to this tenant
    if "owner_id" in changes and changes["owner_id"] is not None:
        owner_result = await db.execute(
            select(User).where(
                User.id == changes["owner_id"],
                User.tenant_id == tenant_id,
            )
        )
        if not owner_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="owner_id must reference a user in this tenant",
            )

    for field, value in changes.items():
        if field == "plan" and value is not None:
            setattr(tenant, field, value.value if hasattr(value, "value") else value)
        else:
            setattr(tenant, field, value)

    tenant.updated_at = _now()
    await db.flush()

    await _record_event(
        db,
        tenant_id=tenant.id,
        actor_user_id=current_user.id,
        action="updated",
        payload={"changes": {k: str(v) for k, v in changes.items()}},
    )
    return await _tenant_with_counts(db, tenant)


# ---------------------------------------------------------------------------
# Lifecycle actions
# ---------------------------------------------------------------------------


def _reject_self(current_user: User, tenant_id: UUID) -> None:
    if current_user.tenant_id == tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot perform this action on your own tenant",
        )


@router.post("/{tenant_id}/suspend", response_model=AdminTenantResponse)
async def suspend_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superuser),
):
    _reject_self(current_user, tenant_id)
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suspend a cancelled tenant",
        )
    tenant.status = "suspended"
    tenant.is_active = False
    tenant.suspended_at = _now()
    tenant.updated_at = _now()
    await db.flush()
    await _record_event(
        db,
        tenant_id=tenant.id,
        actor_user_id=current_user.id,
        action="suspended",
    )
    return await _tenant_with_counts(db, tenant)


@router.post("/{tenant_id}/reactivate", response_model=AdminTenantResponse)
async def reactivate_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superuser),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reactivate a cancelled tenant",
        )
    tenant.status = "active"
    tenant.is_active = True
    tenant.suspended_at = None
    tenant.updated_at = _now()
    await db.flush()
    await _record_event(
        db,
        tenant_id=tenant.id,
        actor_user_id=current_user.id,
        action="reactivated",
    )
    return await _tenant_with_counts(db, tenant)


@router.post("/{tenant_id}/cancel", response_model=AdminTenantResponse)
async def cancel_tenant(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superuser),
):
    """Soft-cancel a tenant. Data is retained; login is blocked."""
    _reject_self(current_user, tenant_id)
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.status = "cancelled"
    tenant.is_active = False
    tenant.cancelled_at = _now()
    tenant.updated_at = _now()
    await db.flush()
    await _record_event(
        db,
        tenant_id=tenant.id,
        actor_user_id=current_user.id,
        action="cancelled",
    )
    return await _tenant_with_counts(db, tenant)


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------


@router.get("/{tenant_id}/stats", response_model=AdminTenantStatsResponse)
async def tenant_stats(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_superuser),
):
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    user_total = await db.execute(
        select(func.count(User.id)).where(User.tenant_id == tenant_id)
    )
    user_active = await db.execute(
        select(func.count(User.id)).where(
            User.tenant_id == tenant_id, User.is_active == True  # noqa: E712
        )
    )
    lead_total = await db.execute(
        select(func.count(Lead.id)).where(Lead.tenant_id == tenant_id)
    )
    campaign_total = await db.execute(
        select(func.count(Campaign.id)).where(Campaign.tenant_id == tenant_id)
    )
    integration_total = await db.execute(
        select(func.count(Integration.id)).where(Integration.tenant_id == tenant_id)
    )
    last_activity = await db.execute(
        select(func.max(IntegrationEvent.created_at)).where(
            IntegrationEvent.tenant_id == tenant_id
        )
    )

    return AdminTenantStatsResponse(
        tenant_id=tenant_id,
        user_count=int(user_total.scalar() or 0),
        active_user_count=int(user_active.scalar() or 0),
        lead_count=int(lead_total.scalar() or 0),
        campaign_count=int(campaign_total.scalar() or 0),
        integration_count=int(integration_total.scalar() or 0),
        last_activity_at=last_activity.scalar(),
    )


# ---------------------------------------------------------------------------
# Admin-scoped user create
# ---------------------------------------------------------------------------


@router.post(
    "/{tenant_id}/users",
    response_model=AdminUserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_user_in_tenant(
    tenant_id: UUID,
    body: AdminUserInTenantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_superuser),
):
    """Create a user inside a target tenant. Used by super-admins to
    seed owners/members without going through the public /auth/register
    flow (which creates a whole new tenant)."""
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Unique check on (tenant_id, email). The ORM has a
    # ``uq_users_tenant_email`` UniqueConstraint that will also catch
    # this, but we pre-check so we return 409 instead of 500.
    dupe = await db.execute(
        select(User).where(User.tenant_id == tenant_id, User.email == body.email)
    )
    if dupe.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with that email already exists in this tenant",
        )

    user = User(
        tenant_id=tenant_id,
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    # If this is the first owner for a tenant that has none, link it.
    if body.role == "owner" and tenant.owner_id is None:
        tenant.owner_id = user.id
        tenant.updated_at = _now()
        await db.flush()

    await _record_event(
        db,
        tenant_id=tenant_id,
        actor_user_id=current_user.id,
        action="user_created",
        payload={"user_id": str(user.id), "role": user.role, "email": user.email},
    )

    return AdminUserResponse.model_validate(user)
