"""Tenant-scoped API key management — JWT-authenticated.

Each tenant can mint multiple keys (e.g. "Zapier", "Make", "Custom
script"). The plaintext value is shown ONCE at creation; afterwards
only the SHA-256 hash is retained.
"""

from __future__ import annotations

import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from core.security import generate_api_key
from models.api_key import APIKey
from models.user import User
from schemas.api_key import APIKeyCreate, APIKeyCreatedResponse, APIKeyResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


def _preview(raw_key: str) -> str:
    """Return a masked key preview for list views."""
    if len(raw_key) <= 8:
        return "•" * len(raw_key)
    return f"{raw_key[:5]}•••••{raw_key[-4:]}"


@router.get("/", response_model=List[APIKeyResponse])
async def list_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(APIKey)
        .where(APIKey.tenant_id == current_user.tenant_id)
        .order_by(APIKey.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        APIKeyResponse(
            id=row.id,
            name=row.name,
            # Hash is 64 hex chars; use last 4 as a visual disambiguator.
            preview=f"lf_•••••{row.key_hash[-4:]}",
            last_used=row.last_used,
            created_at=row.created_at,
        )
        for row in rows
    ]


@router.post(
    "/",
    response_model=APIKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_key(
    body: APIKeyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    raw, hashed = generate_api_key()
    row = APIKey(
        tenant_id=current_user.tenant_id,
        name=body.name.strip(),
        key_hash=hashed,
        created_by=current_user.id,
    )
    db.add(row)
    await db.flush()
    return APIKeyCreatedResponse(
        id=row.id, name=row.name, key=raw, created_at=row.created_at
    )


@router.delete("/{key_id}", status_code=status.HTTP_200_OK)
async def revoke_key(
    key_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id, APIKey.tenant_id == current_user.tenant_id
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="API key not found")
    await db.delete(row)
    return {"detail": "API key revoked", "id": str(key_id)}
