from typing import AsyncGenerator, Optional, Tuple

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError
from uuid import UUID

from core.database import get_db_session
from core.security import decode_token

security_scheme = HTTPBearer()


async def get_current_user_token(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> dict:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
        tenant_id = payload.get("tenant_id")
        if not user_id or not tenant_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_db(token_data: dict = Depends(get_current_user_token)):
    tenant_id = UUID(token_data["tenant_id"])
    async for session in get_db_session(tenant_id):
        yield session


async def get_db_no_auth():
    """DB session without tenant context (for auth endpoints)."""
    async for session in get_db_session():
        yield session


async def get_current_user(
    token_data: dict = Depends(get_current_user_token),
    db: AsyncSession = Depends(get_db),
):
    from models.user import User

    user_id = UUID(token_data["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require_role(*roles: str):
    async def role_checker(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Required role: {', '.join(roles)}",
            )
        return current_user

    return role_checker


async def require_api_key(
    request: Request,
) -> AsyncGenerator[Tuple[UUID, AsyncSession], None]:
    """Resolve ``X-API-Key`` header → (tenant_id, tenant-scoped session).

    The returned session already has ``SET LOCAL app.current_tenant``
    applied, so RLS policies on leads / webhooks / etc. work correctly.

    Used as a FastAPI dependency. Because this yields, FastAPI
    correctly closes the underlying session after the handler returns::

        async def create_lead(
            body: LeadCreate,
            ctx: tuple[UUID, AsyncSession] = Depends(require_api_key),
        ):
            tenant_id, db = ctx
            ...
    """
    from datetime import datetime as _dt, timezone as _tz

    from core.database import AsyncSessionLocal
    from core.security import verify_api_key
    from models.api_key import APIKey

    raw = request.headers.get("X-API-Key") or request.headers.get("x-api-key")
    if not raw:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header.")

    # Match the key WITHOUT RLS — we don't know the tenant yet.
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(APIKey))
        matched: Optional[APIKey] = None
        for row in result.scalars().all():
            if verify_api_key(raw, row.key_hash):
                matched = row
                break
        if not matched:
            raise HTTPException(status_code=401, detail="Invalid API key.")
        try:
            matched.last_used = _dt.now(_tz.utc)
            await session.commit()
        except Exception:  # noqa: BLE001 — best-effort usage tracking
            await session.rollback()
    tenant_id = matched.tenant_id

    # Open a tenant-scoped session the same way JWT get_db does.
    async for db in get_db_session(tenant_id):
        yield tenant_id, db


async def require_superuser(current_user=Depends(get_current_user)):
    """Gate a route to platform super-admins only.

    Super-admin status is a platform-level flag (``users.is_superuser``),
    orthogonal to the tenant-scoped ``role`` column. This dependency is
    how the ``/admin/tenants/*`` routes enforce that only the platform
    operator can reach cross-tenant endpoints.
    """
    if not getattr(current_user, "is_superuser", False):
        raise HTTPException(
            status_code=403,
            detail="Super-admin privileges required",
        )
    return current_user
