"""External webhook handlers (SendGrid, Meta Lead Ads, etc.)."""

import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, cast
from sqlalchemy.dialects.postgresql import JSONB

from core.crypto import decrypt_json
from core.database import AsyncSessionLocal
from core.dependencies import get_db_no_auth
from models.integration import Integration
from models.lead import Lead
from models.outreach_log import OutreachLog
from models.task import Task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# ── Meta / Facebook shared constants ──────────────────────────────────────────
_META_GRAPH_BASE = "https://graph.facebook.com/v19.0"
_ADMISSION_SECTORS = {"college", "education"}


class SendGridEvent(BaseModel):
    email: Optional[str] = None
    event: str  # "open", "click", "bounce", "dropped", "delivered", "spamreport"
    sg_message_id: Optional[str] = None
    timestamp: Optional[int] = None
    url: Optional[str] = None
    reason: Optional[str] = None


@router.post("/sendgrid", status_code=status.HTTP_200_OK)
async def sendgrid_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db_no_auth),
):
    """
    Process SendGrid event webhooks.

    SendGrid posts a JSON array of event objects.
    We match each event to an OutreachLog by message_id and update timestamps.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    if not isinstance(body, list):
        body = [body]

    processed = 0
    skipped = 0

    for event_data in body:
        try:
            sg_message_id = event_data.get("sg_message_id")
            event_type = event_data.get("event", "")
            timestamp_unix = event_data.get("timestamp")

            if not sg_message_id:
                skipped += 1
                continue

            # SendGrid message IDs sometimes have a filter suffix; strip it
            clean_id = sg_message_id.split(".")[0] if sg_message_id else None
            if not clean_id:
                skipped += 1
                continue

            # Find outreach log by message_id
            result = await db.execute(
                select(OutreachLog).where(OutreachLog.message_id == clean_id)
            )
            log = result.scalar_one_or_none()

            # Also try the full message_id if short form didn't match
            if not log:
                result = await db.execute(
                    select(OutreachLog).where(OutreachLog.message_id == sg_message_id)
                )
                log = result.scalar_one_or_none()

            if not log:
                skipped += 1
                continue

            ts = (
                datetime.fromtimestamp(timestamp_unix, tz=timezone.utc)
                if timestamp_unix
                else datetime.now(timezone.utc)
            )

            if event_type == "delivered":
                log.status = "sent"
                if not log.sent_at:
                    log.sent_at = ts

            elif event_type == "open":
                if not log.opened_at:
                    log.opened_at = ts

            elif event_type == "click":
                if not log.clicked_at:
                    log.clicked_at = ts
                if not log.opened_at:
                    log.opened_at = ts

            elif event_type in ("bounce", "dropped"):
                log.status = "bounced"
                log.error_msg = event_data.get("reason", f"Email {event_type}")

            elif event_type == "spamreport":
                log.status = "spam"
                log.error_msg = "Recipient reported as spam"

            processed += 1

        except Exception as e:
            logger.warning(f"Error processing SendGrid event: {e}")
            skipped += 1
            continue

    await db.flush()

    return {
        "detail": "SendGrid events processed",
        "processed": processed,
        "skipped": skipped,
    }


# =============================================================================
# Meta Lead Ads Webhook
# =============================================================================
# Setup checklist (Railway env vars):
#   META_WEBHOOK_VERIFY_TOKEN   — any string you type into Meta App → Webhooks
#   META_APP_SECRET             — your Meta App's App Secret (for sig verification)
#
# Meta Developer Console:
#   1. App → Add Product → Webhooks
#   2. Subscribe to object: "Page", field: "leadgen"
#   3. Callback URL: https://your-api.railway.app/api/v1/webhooks/meta-leads
#   4. Verify token: value of META_WEBHOOK_VERIFY_TOKEN
#   5. Subscribe your Page to the app's leadgen permission
# =============================================================================

def _map_meta_fields(field_data: list) -> dict:
    """Map Meta Lead Ad field_data array → Lead kwarg dict.

    Meta returns: [{"name": "full_name", "values": ["Arun Kumar"]}, ...]
    Field names are set by the advertiser; we normalize and do best-effort
    matching so common naming variations all resolve correctly.
    """
    mapping: dict = {}

    # Normalize: lower + strip, collapse spaces/hyphens to underscores
    def _norm(s: str) -> str:
        return s.strip().lower().replace(" ", "_").replace("-", "_")

    for field in field_data:
        raw_name = _norm(str(field.get("name", "")))
        values = field.get("values") or []
        val = str(values[0]).strip() if values else None
        if not val:
            continue

        # Standard Meta fields
        if raw_name in ("full_name", "name", "student_name"):
            mapping["contact_name"] = val
        elif raw_name in ("email",):
            mapping["email"] = val
        elif raw_name in ("phone_number", "phone", "mobile", "student_phone"):
            mapping["phone"] = val
        elif raw_name in ("city", "city_field"):
            mapping["city"] = val
        elif raw_name in ("state", "state_field"):
            mapping["state"] = val
        elif raw_name in ("zip_code", "postal_code", "pincode"):
            mapping["pincode"] = val
        # Admission / college fields
        elif raw_name in ("course", "course_interested", "program", "programme"):
            mapping["course_interested"] = val
        elif raw_name in ("stream", "stream_12th"):
            mapping["stream"] = val
        elif raw_name in ("board", "board_12th", "board_of_education"):
            mapping["board"] = val
        elif raw_name in ("percentage", "marks", "percentage_marks", "12th_percentage", "percentage_12th"):
            try:
                pct = float(val)
                if 0 <= pct <= 100:
                    mapping["percentage_marks"] = pct
            except ValueError:
                pass
        elif raw_name in ("school", "school_name", "previous_school", "previous_institution", "last_school"):
            mapping["school_name"] = val
        elif raw_name in ("parent_name", "father_name", "mother_name", "guardian_name"):
            mapping["parent_name"] = val
        elif raw_name in ("parent_phone", "father_phone", "mother_phone", "guardian_phone", "parent_mobile"):
            mapping["parent_phone"] = val
        # Fallback: store any unrecognised field in a "meta_fields" block
        else:
            mapping.setdefault("_extra", {})[raw_name] = val

    return mapping


@router.get(
    "/meta-leads",
    response_class=PlainTextResponse,
    summary="Meta webhook hub.challenge verification",
)
async def meta_leads_verify(request: Request) -> PlainTextResponse:
    """Meta calls this GET to verify the callback URL.

    Returns hub.challenge as plain text when hub.verify_token matches
    the META_WEBHOOK_VERIFY_TOKEN env var.
    """
    params = dict(request.query_params)
    expected_token = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "aveonapex-meta-webhook")
    if (
        params.get("hub.mode") == "subscribe"
        and params.get("hub.verify_token") == expected_token
    ):
        return PlainTextResponse(content=params.get("hub.challenge", ""))
    raise HTTPException(status_code=403, detail="Invalid verify token")


@router.post(
    "/meta-leads",
    status_code=200,
    summary="Receive Meta Lead Ads leadgen notifications",
)
async def meta_leads_webhook(request: Request):
    """Process inbound Meta Lead Ad notifications.

    Flow per lead:
      1. Verify X-Hub-Signature-256 (if META_APP_SECRET is configured).
      2. For each page entry + leadgen change, look up the tenant whose
         meta_ads integration has a matching page_id in its config JSON.
      3. Fetch full lead data from Meta Graph API using the tenant's
         decrypted access_token.
      4. Map field_data → Lead columns (best-effort, see _map_meta_fields).
      5. Create Lead (source = facebook / instagram) + auto-task for
         college/education sector leads.

    Always returns 200 — Meta retries on non-200 which would flood logs.
    """
    body_bytes = await request.body()

    # ── Signature verification (optional but recommended) ─────────────
    app_secret = os.getenv("META_APP_SECRET", "")
    if app_secret:
        sig_header = request.headers.get("x-hub-signature-256", "")
        if sig_header.startswith("sha256="):
            expected_sig = hmac.new(
                app_secret.encode(), body_bytes, hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(sig_header[7:], expected_sig):
                logger.warning("meta-leads: invalid signature — ignoring payload")
                return {"ok": False, "error": "bad_signature"}

    try:
        payload = json.loads(body_bytes)
    except Exception:
        logger.warning("meta-leads: non-JSON payload")
        return {"ok": False}

    if payload.get("object") != "page":
        return {"ok": True, "detail": "not a page event"}

    created_count = 0

    for entry in payload.get("entry", []):
        page_id = str(entry.get("id", ""))
        for change in entry.get("changes", []):
            if change.get("field") != "leadgen":
                continue
            value = change.get("value", {})
            leadgen_id = value.get("leadgen_id")
            if not leadgen_id:
                continue
            try:
                ok = await _handle_meta_leadgen(page_id, str(leadgen_id))
                if ok:
                    created_count += 1
            except Exception as exc:  # noqa: BLE001
                logger.exception("meta-leads: error processing leadgen %s: %s", leadgen_id, exc)

    return {"ok": True, "created": created_count}


async def _handle_meta_leadgen(page_id: str, leadgen_id: str) -> bool:
    """Look up integration, fetch lead from Graph API, create Lead row."""
    async with AsyncSessionLocal() as db:
        # Find the tenant that owns this page
        result = await db.execute(
            select(Integration).where(
                Integration.provider == "meta_ads",
                Integration.status == "connected",
            )
        )
        integrations = result.scalars().all()

        # Match by page_id stored in config JSON
        integration = None
        for integ in integrations:
            cfg = integ.config or {}
            if str(cfg.get("page_id", "")) == page_id:
                integration = integ
                break

        if not integration:
            logger.info("meta-leads: no connected meta_ads integration for page_id=%s", page_id)
            return False

        # Decrypt credentials
        try:
            creds = decrypt_json(integration.credentials_encrypted) or {}
        except Exception as exc:
            logger.warning("meta-leads: credential decrypt failed: %s", exc)
            return False

        access_token = creds.get("access_token")
        if not access_token:
            logger.warning("meta-leads: integration %s has no access_token", integration.id)
            return False

        # Fetch lead data from Meta Graph API
        url = f"{_META_GRAPH_BASE}/{leadgen_id}"
        params = {
            "fields": "field_data,created_time,ad_id,form_id,platform",
            "access_token": access_token,
        }
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(15.0)) as client:
                resp = await client.get(url, params=params)
        except httpx.HTTPError as exc:
            logger.warning("meta-leads: Graph API network error: %s", exc)
            return False

        if resp.status_code != 200:
            logger.warning("meta-leads: Graph API returned %s: %s", resp.status_code, resp.text[:200])
            return False

        data = resp.json()
        field_data = data.get("field_data", [])
        platform = data.get("platform", "facebook").lower()  # "facebook" | "instagram"

        # Map fields
        mapped = _map_meta_fields(field_data)
        extra_fields = mapped.pop("_extra", {})

        # Determine source
        source = "instagram" if "instagram" in platform else "facebook"

        # Build company_name (required): use school_name, then contact_name, then fallback
        company_name = (
            mapped.get("school_name")
            or mapped.get("contact_name")
            or f"Meta Lead {leadgen_id[:8]}"
        )

        # Build custom_fields
        custom: dict = {"meta_leadgen_id": leadgen_id, "meta_page_id": page_id}
        if extra_fields:
            custom["meta_extra_fields"] = extra_fields

        # Resolve sector_code from integration config (admin can set it)
        sector_code = str(integration.config.get("sector_code", "college")) if integration.config else "college"

        # Create lead
        lead = Lead(
            tenant_id=integration.tenant_id,
            sector_code=sector_code,
            company_name=company_name[:200],
            contact_name=mapped.get("contact_name"),
            email=mapped.get("email"),
            phone=mapped.get("phone"),
            city=mapped.get("city"),
            state=mapped.get("state", "Tamil Nadu"),
            pincode=mapped.get("pincode"),
            source=source,
            stage="new",
            tags=[source, "meta-lead-ad"],
            custom_fields=custom,
            # Admission fields
            course_interested=mapped.get("course_interested"),
            stream=mapped.get("stream"),
            board=mapped.get("board"),
            percentage_marks=mapped.get("percentage_marks"),
            school_name=mapped.get("school_name"),
            parent_name=mapped.get("parent_name"),
            parent_phone=mapped.get("parent_phone"),
        )
        db.add(lead)
        await db.flush()

        # Auto-task for admission leads (mirrors the logic in routers/leads.py)
        if sector_code in _ADMISSION_SECTORS:
            student = lead.contact_name or lead.company_name
            course = lead.course_interested or "Enquiry"
            task = Task(
                tenant_id=integration.tenant_id,
                lead_id=lead.id,
                title=f"📞 Follow up with {student} — {course}"[:200],
                task_type="follow_up",
                priority="high",
                status="pending",
                due_date=datetime.now(timezone.utc) + timedelta(days=1),
            )
            db.add(task)
            await db.flush()

        # Fire webhook fan-out
        try:
            from services.webhook_dispatcher import publish_event
            from schemas.lead import LeadResponse
            response = LeadResponse.model_validate(lead)
            await publish_event(
                db, integration.tenant_id, "lead.created", response.model_dump(mode="json")
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("meta-leads: webhook fan-out failed: %s", exc)

        logger.info(
            "meta-leads: created lead %s for tenant %s from %s",
            lead.id, integration.tenant_id, source,
        )
        return True
