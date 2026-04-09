"""Integration management routes — CRUD + test_connection.

Endpoints:
    GET    /integrations                 list all integrations for tenant
    GET    /integrations/providers       list supported provider codes
    GET    /integrations/{id}            fetch one
    POST   /integrations                 create (or upsert per provider)
    PATCH  /integrations/{id}            update display_name/config/credentials
    DELETE /integrations/{id}            disconnect and remove
    POST   /integrations/{id}/test       run BaseIntegration.test_connection
    GET    /integrations/{id}/events     tail the audit log

Credentials always travel over HTTPS + JWT and are immediately encrypted
with Fernet before being persisted. Responses never include plaintext
credentials — only masked previews of the keys that exist.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.crypto import decrypt_json, encrypt_json, mask_secret
from core.dependencies import get_current_user, get_db
from models.integration import Integration
from models.integration_event import IntegrationEvent
from models.user import User
from schemas.integration import (
    IntegrationCreate,
    IntegrationEventResponse,
    IntegrationProvider,
    IntegrationResponse,
    IntegrationTestResult,
    IntegrationUpdate,
)
from services.integrations import get_integration

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["integrations"])


# ----------------------------------------------------------------------
# Serialisation helpers
# ----------------------------------------------------------------------

_CREDENTIAL_PREVIEW_KEEP = 4
_SUPPORTED_PROVIDERS = [p.value for p in IntegrationProvider]


def _serialise(integration: Integration) -> IntegrationResponse:
    """Build a safe, masked response — never returns plaintext secrets."""
    creds = decrypt_json(integration.credentials_encrypted)
    preview: dict[str, str] = {}
    for key, value in creds.items():
        if isinstance(value, str) and value:
            preview[key] = mask_secret(value, keep=_CREDENTIAL_PREVIEW_KEEP)
        elif value:
            preview[key] = "••••"
    return IntegrationResponse(
        id=integration.id,
        tenant_id=integration.tenant_id,
        provider=integration.provider,
        display_name=integration.display_name,
        status=integration.status,
        config=integration.config or {},
        has_credentials=bool(creds),
        credential_preview=preview or None,
        last_sync_at=integration.last_sync_at,
        last_error=integration.last_error,
        created_at=integration.created_at,
        updated_at=integration.updated_at,
    )


async def _record_event(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    integration_id: Optional[UUID],
    event_type: str,
    direction: str = "inbound",
    status_str: str = "ok",
    payload: Optional[dict] = None,
    error: Optional[str] = None,
) -> None:
    """Append an audit row. Never raises — audit must not break the flow."""
    try:
        db.add(
            IntegrationEvent(
                tenant_id=tenant_id,
                integration_id=integration_id,
                direction=direction,
                event_type=event_type,
                status=status_str,
                payload=payload,
                error=error,
            )
        )
        await db.flush()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to record integration_event: %s", exc)


# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------

@router.get("/providers", response_model=list[str])
async def list_providers() -> list[str]:
    """Return the list of provider codes this backend knows about."""
    return _SUPPORTED_PROVIDERS


@router.get("/", response_model=List[IntegrationResponse])
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all integrations for the current tenant."""
    result = await db.execute(
        select(Integration)
        .where(Integration.tenant_id == current_user.tenant_id)
        .order_by(Integration.created_at.desc())
    )
    rows = result.scalars().all()
    return [_serialise(row) for row in rows]


@router.get("/{integration_id}", response_model=IntegrationResponse)
async def get_integration_by_id(
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.tenant_id == current_user.tenant_id,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found"
        )
    return _serialise(integration)


@router.post(
    "/",
    response_model=IntegrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_integration(
    body: IntegrationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new integration or update the existing one for (tenant, provider).

    We enforce one row per (tenant, provider) via a unique constraint,
    so calling POST for a provider that already exists returns the
    existing row with its credentials/config merged in.
    """
    if body.provider.value not in _SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider '{body.provider.value}'",
        )

    # Upsert-ish: if a row exists for this tenant+provider, update it.
    existing = await db.execute(
        select(Integration).where(
            Integration.tenant_id == current_user.tenant_id,
            Integration.provider == body.provider.value,
        )
    )
    integration = existing.scalar_one_or_none()

    if integration:
        # Merge: non-null values in the request overwrite.
        if body.display_name is not None:
            integration.display_name = body.display_name
        if body.config is not None:
            integration.config = {**(integration.config or {}), **body.config}
        if body.credentials:
            merged = {**decrypt_json(integration.credentials_encrypted), **body.credentials}
            integration.credentials_encrypted = encrypt_json(merged)
            integration.status = "connected"
            integration.last_error = None
        integration.updated_at = datetime.now(timezone.utc)
    else:
        integration = Integration(
            tenant_id=current_user.tenant_id,
            provider=body.provider.value,
            display_name=body.display_name or body.provider.value.replace("_", " ").title(),
            status="connected" if body.credentials else "disconnected",
            credentials_encrypted=(
                encrypt_json(body.credentials) if body.credentials else None
            ),
            config=body.config or {},
            created_by=current_user.id,
        )
        db.add(integration)

    await db.flush()
    await _record_event(
        db,
        tenant_id=current_user.tenant_id,
        integration_id=integration.id,
        event_type="integration.configured",
        direction="inbound",
        payload={"provider": integration.provider, "has_credentials": bool(body.credentials)},
    )
    return _serialise(integration)


@router.patch("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: UUID,
    body: IntegrationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.tenant_id == current_user.tenant_id,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found"
        )

    if body.display_name is not None:
        integration.display_name = body.display_name
    if body.config is not None:
        integration.config = body.config
    if body.credentials is not None:
        merged = {**decrypt_json(integration.credentials_encrypted), **body.credentials}
        integration.credentials_encrypted = encrypt_json(merged)
        integration.status = "connected"
        integration.last_error = None
    if body.status is not None:
        integration.status = body.status.value
    integration.updated_at = datetime.now(timezone.utc)

    await db.flush()
    return _serialise(integration)


@router.delete("/{integration_id}", status_code=status.HTTP_200_OK)
async def delete_integration(
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.tenant_id == current_user.tenant_id,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found"
        )

    provider = integration.provider
    await db.delete(integration)
    await db.flush()
    await _record_event(
        db,
        tenant_id=current_user.tenant_id,
        integration_id=None,
        event_type="integration.disconnected",
        direction="inbound",
        payload={"provider": provider},
    )
    return {"detail": "Integration removed", "provider": provider}


@router.post("/{integration_id}/test", response_model=IntegrationTestResult)
async def test_integration(
    integration_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Call the plugin's ``test_connection`` method."""
    result = await db.execute(
        select(Integration).where(
            Integration.id == integration_id,
            Integration.tenant_id == current_user.tenant_id,
        )
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found"
        )

    plugin_cls = get_integration(integration.provider)
    if not plugin_cls:
        return IntegrationTestResult(
            ok=False,
            provider=integration.provider,
            message=(
                f"No plugin registered for provider '{integration.provider}'. "
                "This provider will be enabled in a later phase."
            ),
        )

    try:
        plugin = plugin_cls(integration, credentials=decrypt_json(integration.credentials_encrypted))
        outcome = await plugin.test_connection()
        integration.last_sync_at = datetime.now(timezone.utc)
        integration.last_error = None if outcome.ok else outcome.message
        integration.status = "connected" if outcome.ok else "error"
        await db.flush()
        return IntegrationTestResult(
            ok=outcome.ok,
            provider=outcome.provider or integration.provider,
            message=outcome.message,
            details=outcome.details,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("test_connection failed for %s", integration.provider)
        integration.status = "error"
        integration.last_error = str(exc)
        await db.flush()
        return IntegrationTestResult(
            ok=False,
            provider=integration.provider,
            message=f"Test failed: {exc}",
        )


@router.get(
    "/{integration_id}/events",
    response_model=List[IntegrationEventResponse],
)
async def list_integration_events(
    integration_id: UUID,
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tail the audit log for a single integration."""
    # Verify the integration belongs to this tenant before dumping events.
    owner_check = await db.execute(
        select(Integration.id).where(
            Integration.id == integration_id,
            Integration.tenant_id == current_user.tenant_id,
        )
    )
    if not owner_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found"
        )

    result = await db.execute(
        select(IntegrationEvent)
        .where(
            IntegrationEvent.tenant_id == current_user.tenant_id,
            IntegrationEvent.integration_id == integration_id,
        )
        .order_by(desc(IntegrationEvent.created_at))
        .limit(limit)
    )
    rows = result.scalars().all()
    return [IntegrationEventResponse.model_validate(row) for row in rows]
