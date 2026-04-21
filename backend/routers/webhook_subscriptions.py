"""Outbound webhook subscription management — JWT-authenticated.

Complements the public REST API. A tenant creates a subscription with
one or more event types and a URL; our dispatcher fans out every
matching event to that URL with an HMAC signature header.

Secret handling mirrors the API key pattern: plaintext shown ONCE
on creation, only Fernet-encrypted form persisted.
"""

from __future__ import annotations

import logging
import secrets
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.crypto import decrypt_str, encrypt_str
from core.dependencies import get_current_user, get_db
from models.user import User
from models.webhook_subscription import WebhookSubscription
from schemas.webhook_subscription import (
    WebhookDeliveryTestResult,
    WebhookSubscriptionCreate,
    WebhookSubscriptionCreatedResponse,
    WebhookSubscriptionResponse,
    WebhookSubscriptionUpdate,
)
from services.webhook_dispatcher import test_deliver

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/subscriptions", tags=["webhooks"])


def _serialise(sub: WebhookSubscription) -> WebhookSubscriptionResponse:
    secret = decrypt_str(sub.secret_encrypted) if sub.secret_encrypted else ""
    return WebhookSubscriptionResponse(
        id=sub.id,
        url=sub.url,
        event_types=list(sub.event_types or []),
        is_active=sub.is_active,
        last_delivery_at=sub.last_delivery_at,
        last_error=sub.last_error,
        failure_count=sub.failure_count,
        has_secret=bool(secret),
        secret_preview=(f"•••••{secret[-4:]}" if secret else None),
        created_at=sub.created_at,
    )


@router.get("/", response_model=List[WebhookSubscriptionResponse])
async def list_subscriptions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WebhookSubscription)
        .where(WebhookSubscription.tenant_id == current_user.tenant_id)
        .order_by(WebhookSubscription.created_at.desc())
    )
    return [_serialise(row) for row in result.scalars().all()]


@router.post(
    "/",
    response_model=WebhookSubscriptionCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_subscription(
    body: WebhookSubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    secret_plain = f"whsec_{secrets.token_urlsafe(32)}"
    row = WebhookSubscription(
        tenant_id=current_user.tenant_id,
        url=str(body.url),
        event_types=list(body.event_types),
        secret_encrypted=encrypt_str(secret_plain),
        created_by=current_user.id,
    )
    db.add(row)
    await db.flush()
    base = _serialise(row)
    # Merge the plaintext secret into the response. This is the only
    # time it's returned.
    return WebhookSubscriptionCreatedResponse(
        **base.model_dump(),
        secret=secret_plain,
    )


@router.patch("/{sub_id}", response_model=WebhookSubscriptionResponse)
async def update_subscription(
    sub_id: UUID,
    body: WebhookSubscriptionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WebhookSubscription).where(
            WebhookSubscription.id == sub_id,
            WebhookSubscription.tenant_id == current_user.tenant_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if body.url is not None:
        row.url = str(body.url)
    if body.event_types is not None:
        row.event_types = list(body.event_types)
    if body.is_active is not None:
        row.is_active = body.is_active
    await db.flush()
    return _serialise(row)


@router.delete("/{sub_id}", status_code=status.HTTP_200_OK)
async def delete_subscription(
    sub_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WebhookSubscription).where(
            WebhookSubscription.id == sub_id,
            WebhookSubscription.tenant_id == current_user.tenant_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    await db.delete(row)
    return {"detail": "Subscription removed", "id": str(sub_id)}


@router.post("/{sub_id}/test", response_model=WebhookDeliveryTestResult)
async def test_subscription(
    sub_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a dummy ``ping`` event to the URL and report the first-attempt
    outcome. No retries — the user wants to see the real error."""
    result = await db.execute(
        select(WebhookSubscription).where(
            WebhookSubscription.id == sub_id,
            WebhookSubscription.tenant_id == current_user.tenant_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    outcome = await test_deliver(row, current_user.tenant_id)
    return WebhookDeliveryTestResult(
        ok=outcome.get("ok", False),
        status_code=outcome.get("status_code"),
        error=outcome.get("error"),
    )
