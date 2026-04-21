"""Public REST API — tenant-authenticated via X-API-Key header.

Exposes the two endpoints Zapier / Make / custom integrations need to
wire LeadForge into the outside world without going through JWT:

* ``POST /api/v1/public/leads`` — create a lead. Same body shape as
  ``LeadCreate`` on the internal router. Fires the ``lead.created``
  webhook to every active subscription after commit.
* ``GET /api/v1/public/leads/{id}`` — retrieve a lead. Same shape as
  ``LeadResponse``.

Every call must carry ``X-API-Key: lf_<token>``. The key's tenant is
resolved in the ``require_api_key`` dependency, which also applies RLS
so the handler can't accidentally leak across tenants.
"""

from __future__ import annotations

import logging
from typing import Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import require_api_key
from models.lead import Lead
from schemas.lead import LeadCreate, LeadResponse
from services.webhook_dispatcher import publish_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["public-api"])


@router.post(
    "/leads",
    response_model=LeadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a lead (public API, X-API-Key auth)",
)
async def create_lead_public(
    body: LeadCreate,
    ctx: Tuple[UUID, AsyncSession] = Depends(require_api_key),
):
    tenant_id, db = ctx
    try:
        lead = Lead(
            tenant_id=tenant_id,
            sector_code=body.sector_code,
            company_name=body.company_name,
            industry=body.industry,
            sub_industry=body.sub_industry,
            state=body.state or "Tamil Nadu",
            district=body.district,
            city=body.city,
            address=body.address,
            pincode=body.pincode,
            website=body.website,
            company_size=body.company_size.value if body.company_size else None,
            annual_revenue_inr=body.annual_revenue_inr,
            contact_name=body.contact_name,
            designation=body.designation,
            email=body.email,
            phone=body.phone,
            linkedin_url=body.linkedin_url,
            tags=body.tags or [],
            source=(body.source.value if body.source else "api"),
            custom_fields=body.custom_fields,
        )
        db.add(lead)
        await db.flush()
        response = LeadResponse.model_validate(lead)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("public create_lead failed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create lead: {type(exc).__name__}: {exc}",
        )

    # Fan out the webhook subscription deliveries. Best-effort —
    # never fail the request if webhooks fail.
    try:
        await publish_event(db, tenant_id, "lead.created", response.model_dump(mode="json"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("publish_event(lead.created) failed: %s", exc)

    return response


@router.get(
    "/leads/{lead_id}",
    response_model=LeadResponse,
    summary="Get a lead by id (public API, X-API-Key auth)",
)
async def get_lead_public(
    lead_id: UUID,
    ctx: Tuple[UUID, AsyncSession] = Depends(require_api_key),
):
    tenant_id, db = ctx
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return LeadResponse.model_validate(lead)
