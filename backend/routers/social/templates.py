"""CRUD + preview for SocialMessageTemplate rows."""

from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.social.social_message_template import SocialMessageTemplate
from models.user import User
from schemas.social.campaigns import (
    TemplateCreate,
    TemplatePreviewRequest,
    TemplatePreviewResponse,
    TemplateResponse,
    TemplateUpdate,
)
from services.social.action_executor import _render

router = APIRouter(prefix="/social/templates", tags=["social-templates"])


@router.get("/", response_model=List[TemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SocialMessageTemplate)
        .where(SocialMessageTemplate.tenant_id == current_user.tenant_id)
        .order_by(SocialMessageTemplate.created_at.desc())
    )
    return [TemplateResponse.model_validate(r) for r in result.scalars().all()]


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = SocialMessageTemplate(
        tenant_id=current_user.tenant_id,
        name=body.name.strip(),
        content=body.content,
        language=body.language,
        variables=body.variables or [],
    )
    db.add(row)
    await db.flush()
    return TemplateResponse.model_validate(row)


@router.patch("/{tpl_id}", response_model=TemplateResponse)
async def update_template(
    tpl_id: UUID,
    body: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.get(SocialMessageTemplate, tpl_id)
    if not row or row.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Template not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(row, k, v)
    await db.flush()
    return TemplateResponse.model_validate(row)


@router.delete("/{tpl_id}", status_code=status.HTTP_200_OK)
async def delete_template(
    tpl_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.get(SocialMessageTemplate, tpl_id)
    if not row or row.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(row)
    return {"detail": "Template deleted", "id": str(tpl_id)}


@router.post("/{tpl_id}/preview", response_model=TemplatePreviewResponse)
async def preview_template(
    tpl_id: UUID,
    body: TemplatePreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = await db.get(SocialMessageTemplate, tpl_id)
    if not row or row.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplatePreviewResponse(rendered=_render(row.content, body.variables))
