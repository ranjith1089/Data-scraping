"""Authentication routes: register, login, refresh, me."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.dependencies import get_db_no_auth, get_current_user
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from models.tenant import Tenant
from models.user import User
from schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token_payload(user: User) -> dict:
    return {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        "role": user.role,
        "email": user.email,
        # Platform super-admin flag. Absent on pre-004 tokens; consumers
        # default to False, so this is backwards compatible.
        "is_superuser": bool(getattr(user, "is_superuser", False)),
    }


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db_no_auth),
):
    """Create a new tenant and its first owner user."""
    # Check slug uniqueness
    existing = await db.execute(
        select(Tenant).where(Tenant.slug == body.tenant_slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant slug already taken",
        )

    # Check email uniqueness (global, since no tenant yet for this user)
    existing_user = await db.execute(
        select(User).where(User.email == body.email)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Create tenant
    tenant = Tenant(
        name=body.tenant_name,
        slug=body.tenant_slug,
        plan="starter",
    )
    db.add(tenant)
    await db.flush()

    # Create owner user
    user = User(
        tenant_id=tenant.id,
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role="owner",
    )
    db.add(user)
    await db.flush()

    payload = _build_token_payload(user)
    return TokenResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db_no_auth),
):
    """Authenticate user and return tokens."""
    result = await db.execute(
        select(User).where(User.email == body.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Block login if the user's tenant is suspended or cancelled.
    # Super-admins are exempt so they can always get back in and
    # reactivate their own tenant if something goes wrong.
    if not getattr(user, "is_superuser", False):
        tenant = await db.get(Tenant, user.tenant_id)
        tenant_status = getattr(tenant, "status", None) if tenant else None
        if tenant_status and tenant_status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Tenant is {tenant_status}. Contact support.",
            )

    # Update last_login — defensively wrapped so a DB-side failure on this
    # cosmetic write NEVER blocks the actual login response. We learned this
    # the hard way: a SQLAlchemy model/column type mismatch on last_login
    # (tz-aware datetime being bound to a column declared without
    # timezone=True) caused every login to 500 even though the password
    # verification succeeded. The type mismatch is fixed in models/user.py,
    # but this try/except is cheap insurance: if anything else related to
    # the DB write fails, we roll back the dirty session state and proceed
    # to issue tokens rather than taking the whole login flow down.
    from datetime import datetime, timezone

    try:
        user.last_login = datetime.now(timezone.utc)
        await db.flush()
    except Exception as exc:  # pragma: no cover — diagnostic only
        print(
            f"[auth.login] non-fatal: failed to update last_login for "
            f"user {user.id}: {exc!r}",
            flush=True,
        )
        await db.rollback()
        # Re-fetch the user row into a clean session state so the token
        # payload below still has a valid, attached ORM object.
        result = await db.execute(
            select(User).where(User.id == user.id)
        )
        user = result.scalar_one()

    payload = _build_token_payload(user)
    return TokenResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db_no_auth),
):
    """Issue new access and refresh tokens from a valid refresh token."""
    from jose import JWTError

    try:
        payload = decode_token(body.refresh_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is not a refresh token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Verify user still exists and is active
    from uuid import UUID

    result = await db.execute(
        select(User).where(User.id == UUID(user_id), User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer active",
        )

    new_payload = _build_token_payload(user)
    return TokenResponse(
        access_token=create_access_token(new_payload),
        refresh_token=create_refresh_token(new_payload),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the current authenticated user's info."""
    return current_user
