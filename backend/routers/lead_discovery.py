"""Lead Discovery router — Phase 3.

POST /api/v1/lead-discovery/search   — search Apollo for new prospects
POST /api/v1/lead-discovery/import   — import selected results into the CRM
"""

from __future__ import annotations

import logging
import uuid
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.lead import Lead
from models.user import User
from schemas.lead import LeadResponse
from schemas.lead_discovery import (
    DiscoverRequest,
    DiscoverResponse,
    DiscoveredLead,
    ImportLeadsRequest,
    ImportLeadsResult,
)
from services import lead_discovery_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lead-discovery", tags=["lead-discovery"])

_IMPORT_LIMIT = 100  # max leads per import call


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------


@router.post("/search", response_model=DiscoverResponse)
async def search_leads(
    req: DiscoverRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search Apollo.io for potential leads matching the given criteria.

    Returns a list of DiscoveredLead objects that are NOT yet in the CRM.
    Also marks any result whose email already exists in this tenant's leads
    (``already_exists=True``) so the frontend can highlight them.
    """
    result = await lead_discovery_service.search_leads(req)

    if result.leads:
        # Check for duplicates against this tenant's existing leads
        emails = [l.email for l in result.leads if l.email and "@" in l.email]
        if emails:
            existing_rows = (
                await db.execute(
                    select(Lead.email, Lead.id).where(
                        Lead.tenant_id == current_user.tenant_id,
                        Lead.email.in_(emails),
                    )
                )
            ).all()
            existing_map: dict[str, UUID] = {row.email: row.id for row in existing_rows}

            for lead in result.leads:
                if lead.email and lead.email in existing_map:
                    lead.already_exists = True
                    lead.existing_lead_id = existing_map[lead.email]

    return result


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------


@router.post("/import", response_model=ImportLeadsResult)
async def import_leads(
    req: ImportLeadsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import a list of DiscoveredLead objects into the CRM as Lead rows.

    Duplicate detection:
    - By email: if ``skip_duplicates=True`` (default) and a lead with the
      same email already exists, it is skipped.
    - By apollo_id stored in ``custom_fields``: if a lead was imported from
      the same Apollo person before, it is skipped.
    """
    if len(req.leads) > _IMPORT_LIMIT:
        raise HTTPException(400, f"Maximum {_IMPORT_LIMIT} leads per import call.")
    if not req.leads:
        raise HTTPException(400, "No leads provided.")

    # Pre-fetch existing emails for this tenant
    all_emails = [l.email for l in req.leads if l.email and "@" in l.email]
    existing_emails: set[str] = set()
    if all_emails and req.skip_duplicates:
        rows = (
            await db.execute(
                select(Lead.email).where(
                    Lead.tenant_id == current_user.tenant_id,
                    Lead.email.in_(all_emails),
                )
            )
        ).scalars().all()
        existing_emails = set(rows)

    # Pre-fetch existing apollo_ids
    all_apollo_ids = [l.apollo_id for l in req.leads if l.apollo_id]
    existing_apollo_ids: set[str] = set()
    if all_apollo_ids and req.skip_duplicates:
        # apollo_id stored in custom_fields->discovery->apollo_id
        rows_cf = (
            await db.execute(
                select(Lead.custom_fields).where(
                    Lead.tenant_id == current_user.tenant_id,
                    Lead.custom_fields["discovery"]["apollo_id"].as_string().in_(all_apollo_ids),
                )
            )
        ).scalars().all()
        for cf in rows_cf:
            if cf and cf.get("discovery", {}).get("apollo_id"):
                existing_apollo_ids.add(cf["discovery"]["apollo_id"])

    imported_ids: list[UUID] = []
    skipped = 0

    for dl in req.leads:
        # Duplicate checks
        if req.skip_duplicates:
            if dl.email and dl.email in existing_emails:
                skipped += 1
                continue
            if dl.apollo_id and dl.apollo_id in existing_apollo_ids:
                skipped += 1
                continue

        # Build Lead row
        lead = Lead(
            id=uuid.uuid4(),
            tenant_id=current_user.tenant_id,
            sector_code=req.sector_code,
            company_name=dl.company_name or "Unknown",
            contact_name=dl.contact_name or None,
            designation=dl.designation or None,
            email=dl.email or None,
            phone=dl.phone or None,
            linkedin_url=dl.linkedin_url or None,
            website=dl.website or None,
            company_size=dl.company_size or None,
            industry=dl.industry or None,
            city=dl.city or None,
            state=dl.state or "India",
            source="discovery",
            custom_fields={
                "discovery": {
                    "apollo_id": dl.apollo_id,
                    "imported_by": str(current_user.id),
                }
            },
        )
        db.add(lead)
        imported_ids.append(lead.id)
        if dl.email:
            existing_emails.add(dl.email)  # prevent same-batch dupes

    await db.commit()

    logger.info(
        "[discovery] import: tenant=%s imported=%d skipped=%d",
        current_user.tenant_id, len(imported_ids), skipped,
    )

    return ImportLeadsResult(
        imported=len(imported_ids),
        skipped_duplicates=skipped,
        imported_ids=imported_ids,
    )
