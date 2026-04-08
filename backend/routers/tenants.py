"""Tenant management routes (owner only)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.dependencies import get_db, require_role
from models.tenant import Tenant
from models.user import User
from schemas.tenant import TenantUpdate, TenantResponse

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("/current", response_model=TenantResponse)
async def get_current_tenant(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    """Get the current tenant's details."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )
    return tenant


@router.patch("/current", response_model=TenantResponse)
async def update_current_tenant(
    body: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("owner")),
):
    """Update the current tenant (name, settings, plan)."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)

    await db.flush()
    return tenant
