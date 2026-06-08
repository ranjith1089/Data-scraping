"""Lead Enrichment router — Phase 2.

POST /api/v1/leads/{id}/enrich          — single lead enrichment
POST /api/v1/leads/bulk-enrich          — batch enrichment (max 50 leads)
GET  /api/v1/leads/{id}/enrichment-logs — audit trail for a lead
"""

from __future__ import annotations

import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user, get_db
from models.enrichment_log import EnrichmentLog
from models.lead import Lead
from models.user import User
from schemas.enrichment import (
    BulkEnrichRequest,
    BulkEnrichResult,
    EnrichmentLogResponse,
    EnrichmentResult,
    EnrichRequest,
)
from services import enrichment_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/leads", tags=["leads"])

_BULK_ENRICH_LIMIT = 50


# ---------------------------------------------------------------------------
# Single enrichment
# ---------------------------------------------------------------------------


@router.post("/{lead_id}/enrich", response_model=EnrichmentResult)
async def enrich_lead(
    lead_id: UUID,
    req: EnrichRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enrich a lead using Apollo.io and/or Hunter.io.

    Only fills empty fields by default — pass ``overwrite: true`` to replace
    existing values.
    """
    lead = await db.get(Lead, lead_id)
    if not lead or lead.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Lead not found")

    result = await enrichment_service.enrich_lead(lead, overwrite=req.overwrite)

    # Persist enriched fields
    if result["fields_updated"]:
        await db.commit()
        await db.refresh(lead)

    # Audit log
    log = EnrichmentLog(
        tenant_id=current_user.tenant_id,
        lead_id=lead_id,
        source=result["source"],
        fields_found=result["fields_found"],
        fields_updated=result["fields_updated"] or None,
        status=result["status"],
        error=result.get("error"),
    )
    db.add(log)
    await db.commit()

    updated_count = len(result["fields_updated"])
    skipped_count = len(result["skipped_fields"])
    found_count = len(result["fields_found"])

    if result["status"] == "no_api_key":
        message = result["error"] or "No API keys configured."
    elif result["status"] == "not_found":
        message = "Person not found in provider databases."
    elif updated_count == 0 and skipped_count > 0:
        message = f"All {skipped_count} found field(s) already had data (overwrite=false)."
    elif updated_count > 0:
        message = (
            f"{updated_count} field(s) updated"
            + (f"; {skipped_count} already had data" if skipped_count else "")
            + f" via {result['source']}."
        )
    else:
        message = "No new data found."

    logger.info(
        "[enrich] lead=%s status=%s updated=%s source=%s",
        lead_id,
        result["status"],
        result["fields_updated"],
        result["source"],
    )

    return EnrichmentResult(
        lead_id=lead_id,
        status=result["status"],
        source=result["source"],
        fields_found=result["fields_found"],
        fields_updated=result["fields_updated"],
        skipped_fields=result["skipped_fields"],
        message=message,
    )


# ---------------------------------------------------------------------------
# Bulk enrichment
# ---------------------------------------------------------------------------


@router.post("/bulk-enrich", response_model=BulkEnrichResult)
async def bulk_enrich_leads(
    req: BulkEnrichRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enrich up to 50 leads in one call.

    Processes each lead sequentially to respect provider rate limits.
    Returns a per-lead result summary.
    """
    if len(req.lead_ids) > _BULK_ENRICH_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {_BULK_ENRICH_LIMIT} leads per bulk-enrich call.",
        )

    results: list[EnrichmentResult] = []
    enriched_count = 0
    not_found_count = 0
    failed_count = 0

    for lead_id in req.lead_ids:
        lead = await db.get(Lead, lead_id)
        if not lead or lead.tenant_id != current_user.tenant_id:
            results.append(
                EnrichmentResult(
                    lead_id=lead_id,
                    status="failed",
                    source="none",
                    fields_found={},
                    fields_updated=[],
                    skipped_fields=[],
                    message="Lead not found or access denied.",
                )
            )
            failed_count += 1
            continue

        result = await enrichment_service.enrich_lead(lead, overwrite=req.overwrite)

        if result["fields_updated"]:
            await db.commit()
            await db.refresh(lead)

        log = EnrichmentLog(
            tenant_id=current_user.tenant_id,
            lead_id=lead_id,
            source=result["source"],
            fields_found=result["fields_found"],
            fields_updated=result["fields_updated"] or None,
            status=result["status"],
            error=result.get("error"),
        )
        db.add(log)
        await db.commit()

        updated_count = len(result["fields_updated"])
        if result["status"] == "not_found":
            not_found_count += 1
            message = "Not found in provider databases."
        elif result["status"] in ("failed", "no_api_key"):
            failed_count += 1
            message = result.get("error") or "Failed."
        elif updated_count > 0:
            enriched_count += 1
            message = f"{updated_count} field(s) updated via {result['source']}."
        else:
            message = "No new data found."

        results.append(
            EnrichmentResult(
                lead_id=lead_id,
                status=result["status"],
                source=result["source"],
                fields_found=result["fields_found"],
                fields_updated=result["fields_updated"],
                skipped_fields=result["skipped_fields"],
                message=message,
            )
        )

    return BulkEnrichResult(
        results=results,
        total=len(req.lead_ids),
        enriched=enriched_count,
        not_found=not_found_count,
        failed=failed_count,
    )


# ---------------------------------------------------------------------------
# Enrichment history for a lead
# ---------------------------------------------------------------------------


@router.get("/{lead_id}/enrichment-logs", response_model=List[EnrichmentLogResponse])
async def get_enrichment_logs(
    lead_id: UUID,
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the enrichment audit trail for a lead."""
    lead = await db.get(Lead, lead_id)
    if not lead or lead.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Lead not found")

    rows = (
        await db.execute(
            select(EnrichmentLog)
            .where(
                EnrichmentLog.lead_id == lead_id,
                EnrichmentLog.tenant_id == current_user.tenant_id,
            )
            .order_by(EnrichmentLog.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()

    return rows
