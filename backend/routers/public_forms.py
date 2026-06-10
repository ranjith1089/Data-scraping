"""Public-form management router — JWT-authenticated CRUD plus the
no-auth embed-snippet endpoint. The public submit endpoint lives in
``routers/public_form_submit.py`` so this file stays pure management.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.dependencies import get_current_user, get_db
from models.public_form import PublicForm
from models.user import User
from schemas.public_form import (
    PublicFormCreate,
    PublicFormEmbed,
    PublicFormResponse,
    PublicFormUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public-forms", tags=["public-forms"])


def _serialise(form: PublicForm) -> PublicFormResponse:
    return PublicFormResponse.model_validate(form)


@router.get("/", response_model=List[PublicFormResponse])
async def list_forms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PublicForm)
        .where(PublicForm.tenant_id == current_user.tenant_id)
        .order_by(PublicForm.created_at.desc())
    )
    return [_serialise(f) for f in result.scalars().all()]


@router.post(
    "/",
    response_model=PublicFormResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_form(
    body: PublicFormCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    public_token = f"pf_{secrets.token_urlsafe(32)}"
    form = PublicForm(
        tenant_id=current_user.tenant_id,
        name=body.name.strip(),
        public_token=public_token,
        sector_code=body.sector_code,
        redirect_url=body.redirect_url,
        custom_field_schema=[f.model_dump() for f in (body.custom_field_schema or [])],
        created_by=current_user.id,
    )
    db.add(form)
    await db.flush()
    return _serialise(form)


@router.get("/{form_id}", response_model=PublicFormResponse)
async def get_form(
    form_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PublicForm).where(
            PublicForm.id == form_id,
            PublicForm.tenant_id == current_user.tenant_id,
        )
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return _serialise(form)


@router.patch("/{form_id}", response_model=PublicFormResponse)
async def update_form(
    form_id: UUID,
    body: PublicFormUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PublicForm).where(
            PublicForm.id == form_id,
            PublicForm.tenant_id == current_user.tenant_id,
        )
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    data = body.model_dump(exclude_unset=True)
    if "custom_field_schema" in data and data["custom_field_schema"] is not None:
        data["custom_field_schema"] = [f.model_dump() if hasattr(f, "model_dump") else f for f in data["custom_field_schema"]]
    for field, value in data.items():
        setattr(form, field, value)
    form.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return _serialise(form)


@router.delete("/{form_id}", status_code=status.HTTP_200_OK)
async def delete_form(
    form_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PublicForm).where(
            PublicForm.id == form_id,
            PublicForm.tenant_id == current_user.tenant_id,
        )
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    await db.delete(form)
    return {"detail": "Form removed", "id": str(form_id)}


@router.get("/{form_id}/embed", response_model=PublicFormEmbed)
async def get_embed_snippets(
    form_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PublicForm).where(
            PublicForm.id == form_id,
            PublicForm.tenant_id == current_user.tenant_id,
        )
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")

    # Resolve the public base URL for the embed snippets. Prefer an explicit
    # PUBLIC_BASE_URL, but fall back to the real request host when it's unset
    # or still pointing at localhost (the common production case where the env
    # var was never configured). request.base_url honours the proxy headers
    # uvicorn applies on Railway, so it resolves to the real https backend URL
    # — never the hardcoded localhost that ends up in customers' embed code.
    configured = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    if not configured or "localhost" in configured or "127.0.0.1" in configured:
        base = str(request.base_url).rstrip("/")
    else:
        base = configured
    submit_url = f"{base}/api/v1/public/forms/{form.public_token}/submit"
    script_snippet = (
        f'<script async\n'
        f'  src="{base}/api/v1/public/forms.js"\n'
        f'  data-aveonapex-token="{form.public_token}"></script>\n'
        f'<div id="aveonapex-form-{form.public_token[:8]}"></div>'
    )
    iframe_snippet = (
        f'<iframe\n'
        f'  src="{base}/api/v1/public/forms/{form.public_token}/embed"\n'
        f'  width="100%" height="600"\n'
        f'  style="border: 1px solid #e5e7eb; border-radius: 8px;"\n'
        f'  title="AveonApex contact form"></iframe>'
    )
    return PublicFormEmbed(
        public_token=form.public_token,
        script_snippet=script_snippet,
        iframe_snippet=iframe_snippet,
        submit_url=submit_url,
    )
