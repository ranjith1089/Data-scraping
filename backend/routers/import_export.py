"""CSV import and lead export routes."""

import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.dependencies import get_db, get_current_user
from models.lead import Lead
from models.user import User
from schemas.import_export import ImportResult
from services.csv_importer import csv_importer

router = APIRouter(tags=["import_export"])


@router.post("/import/csv", response_model=ImportResult)
async def import_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import leads from a CSV file upload."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV files are accepted",
        )

    # Read file content (limit to 10MB)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 10MB.",
        )

    result = await csv_importer.import_csv(
        db=db,
        file_content=content,
        tenant_id=current_user.tenant_id,
    )

    return ImportResult(
        imported=result["imported"],
        updated=result["updated"],
        skipped=result["skipped"],
        errors=result.get("errors", []),
        total_processed=result["imported"] + result["updated"] + result["skipped"],
    )


@router.get("/export/leads")
async def export_leads_csv(
    sector_code: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export leads as a CSV file download."""
    query = select(Lead).where(Lead.tenant_id == current_user.tenant_id)

    if sector_code:
        query = query.where(Lead.sector_code == sector_code)
    if stage:
        query = query.where(Lead.stage == stage)

    query = query.order_by(Lead.created_at.desc())
    result = await db.execute(query)
    leads = result.scalars().all()

    # Build CSV in memory
    output = io.StringIO()
    fields = [
        "id", "company_name", "sector_code", "industry", "sub_industry",
        "state", "district", "city", "address", "pincode", "website",
        "company_size", "annual_revenue_inr", "contact_name", "designation",
        "email", "phone", "linkedin_url", "lead_score", "stage",
        "source", "tags", "created_at",
    ]
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()

    for lead in leads:
        row = {}
        for f in fields:
            value = getattr(lead, f, None)
            if f == "tags" and value:
                value = "; ".join(value)
            elif f == "id":
                value = str(value)
            elif hasattr(value, "isoformat"):
                value = value.isoformat()
            row[f] = value if value is not None else ""
        writer.writerow(row)

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=leads_export.csv",
        },
    )
