import csv
import io
import logging
from uuid import UUID
from typing import BinaryIO

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from models.lead import Lead
from models.sector import Sector

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = {"company_name", "sector_code"}
VALID_FIELDS = {
    "company_name",
    "sector_code",
    "industry",
    "sub_industry",
    "state",
    "district",
    "city",
    "address",
    "pincode",
    "website",
    "company_size",
    "contact_name",
    "designation",
    "email",
    "phone",
    "linkedin_url",
    "source",
    "annual_revenue_inr",
    # ── Admission / student fields (college & education sectors) ──────
    "parent_name",
    "parent_phone",
    "course_interested",
    "board",
    "stream",
    "percentage_marks",
    "school_name",
}

# Columns that store simple strings and can be set directly without special parsing.
_STRING_ONLY_FIELDS = VALID_FIELDS - {
    "company_name", "sector_code", "company_size", "annual_revenue_inr", "percentage_marks",
}

VALID_COMPANY_SIZES = {"micro", "small", "medium", "large", "enterprise"}


class CSVImporter:
    async def import_csv(
        self,
        db: AsyncSession,
        file_content: bytes,
        tenant_id: UUID,
    ) -> dict:
        """Import leads from CSV. Returns {imported, updated, skipped, errors}."""
        imported = 0
        updated = 0
        skipped = 0
        errors = []

        # Get valid sector codes
        result = await db.execute(select(Sector.code))
        valid_sectors = {row[0] for row in result.fetchall()}

        try:
            text = file_content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = file_content.decode("latin-1")

        reader = csv.DictReader(io.StringIO(text))

        if not reader.fieldnames:
            return {
                "imported": 0,
                "updated": 0,
                "skipped": 0,
                "errors": [{"row": 0, "error": "Empty CSV or no headers"}],
            }

        # Check required columns exist
        headers = {h.strip().lower() for h in reader.fieldnames}
        missing = REQUIRED_FIELDS - headers
        if missing:
            return {
                "imported": 0,
                "updated": 0,
                "skipped": 0,
                "errors": [{"row": 0, "error": f"Missing required columns: {missing}"}],
            }

        for row_num, raw_row in enumerate(reader, start=2):
            row = {
                k.strip().lower(): (v.strip() if v else None)
                for k, v in raw_row.items()
            }

            # Validate required
            if not row.get("company_name"):
                errors.append({"row": row_num, "error": "Missing company_name"})
                skipped += 1
                continue

            if not row.get("sector_code") or row["sector_code"] not in valid_sectors:
                errors.append(
                    {"row": row_num, "error": f"Invalid sector_code: {row.get('sector_code')}"}
                )
                skipped += 1
                continue

            # Validate email format (basic)
            email = row.get("email")
            if email and "@" not in email:
                errors.append({"row": row_num, "error": f"Invalid email: {email}"})
                email = None

            # Validate company_size
            company_size = row.get("company_size")
            if company_size and company_size not in VALID_COMPANY_SIZES:
                company_size = None

            # Check if lead exists (upsert by company_name + district)
            existing = await db.execute(
                select(Lead).where(
                    Lead.tenant_id == tenant_id,
                    Lead.company_name == row["company_name"],
                    Lead.district == row.get("district"),
                )
            )
            existing_lead = existing.scalar_one_or_none()

            revenue = None
            if row.get("annual_revenue_inr"):
                try:
                    revenue = int(row["annual_revenue_inr"])
                except ValueError:
                    pass

            percentage = None
            if row.get("percentage_marks"):
                try:
                    pct = float(row["percentage_marks"])
                    if 0 <= pct <= 100:
                        percentage = pct
                except ValueError:
                    pass

            if existing_lead:
                # Update existing — apply any non-empty column from the row
                for field in VALID_FIELDS - REQUIRED_FIELDS:
                    val = row.get(field)
                    if val is not None:
                        if field == "annual_revenue_inr":
                            val = revenue
                        elif field == "company_size":
                            val = company_size
                        elif field == "percentage_marks":
                            val = percentage
                        if val is not None:
                            setattr(existing_lead, field, val)
                updated += 1
            else:
                # Insert new
                lead = Lead(
                    tenant_id=tenant_id,
                    company_name=row["company_name"],
                    sector_code=row["sector_code"],
                    industry=row.get("industry"),
                    sub_industry=row.get("sub_industry"),
                    state=row.get("state", "Tamil Nadu"),
                    district=row.get("district"),
                    city=row.get("city"),
                    address=row.get("address"),
                    pincode=row.get("pincode"),
                    website=row.get("website"),
                    company_size=company_size,
                    annual_revenue_inr=revenue,
                    contact_name=row.get("contact_name"),
                    designation=row.get("designation"),
                    email=email,
                    phone=row.get("phone"),
                    linkedin_url=row.get("linkedin_url"),
                    source=row.get("source") or "import",
                    # ── Admission / student fields ─────────────────────
                    parent_name=row.get("parent_name"),
                    parent_phone=row.get("parent_phone"),
                    course_interested=row.get("course_interested"),
                    board=row.get("board"),
                    stream=row.get("stream"),
                    percentage_marks=percentage,
                    school_name=row.get("school_name"),
                )
                db.add(lead)
                imported += 1

            # Flush every 100 rows
            if (imported + updated) % 100 == 0:
                await db.flush()

        await db.flush()

        return {
            "imported": imported,
            "updated": updated,
            "skipped": skipped,
            "errors": errors[:50],  # Cap errors at 50
        }


csv_importer = CSVImporter()
