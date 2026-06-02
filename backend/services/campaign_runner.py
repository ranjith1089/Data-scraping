import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from models.campaign import Campaign
from models.campaign_step import CampaignStep
from models.lead import Lead
from models.outreach_log import OutreachLog
from services.email_service import email_service
from services.whatsapp_service import whatsapp_service

logger = logging.getLogger(__name__)


def _pick_variant(
    step: CampaignStep, lead_id: UUID
) -> tuple[Optional[str], str, str]:
    """Return ``(variant_tag, subject, body)`` for this lead+step pair.

    - If the step has no variant_b configured, returns ``(None, primary_subject,
      primary_body)`` — not an A/B send.
    - Otherwise deterministically hashes ``(step.id, lead_id)`` and uses
      ``step.ab_split_pct`` to pick bucket 'a' or 'b'. Deterministic means
      retries keep the lead in whichever bucket they were first assigned to.
    """
    has_variant_b = bool(step.variant_b_subject) or bool(step.variant_b_body)
    if not has_variant_b:
        return None, step.subject or "", step.body or ""

    split = max(1, min(99, int(step.ab_split_pct or 50)))
    h = hashlib.sha256(f"{step.id}:{lead_id}".encode("utf-8")).digest()
    bucket = h[0]  # 0..255
    if (bucket * 100 / 256) < split:
        return "a", step.subject or "", step.body or ""
    return (
        "b",
        step.variant_b_subject or step.subject or "",
        step.variant_b_body or step.body or "",
    )


class CampaignRunner:
    async def execute_step(
        self,
        db: AsyncSession,
        campaign_id: UUID,
        step_id: UUID,
        tenant_id: UUID,
    ) -> dict:
        """Execute a campaign step: send emails/messages to qualified leads."""
        # Get campaign and step
        campaign = await db.get(Campaign, campaign_id)
        if not campaign or campaign.status != "active":
            return {"error": "Campaign not active"}

        step_result = await db.execute(
            select(CampaignStep).where(CampaignStep.id == step_id)
        )
        step = step_result.scalar_one_or_none()
        if not step:
            return {"error": "Step not found"}

        # Get leads that match campaign sectors and haven't received this step
        already_sent_subq = (
            select(OutreachLog.lead_id)
            .where(OutreachLog.step_id == step_id)
            .where(OutreachLog.status != "failed")
        ).scalar_subquery()

        leads_query = (
            select(Lead)
            .where(Lead.tenant_id == tenant_id)
            .where(Lead.sector_code.in_(campaign.sector_codes or []))
            .where(Lead.email.isnot(None))
            .where(Lead.id.notin_(already_sent_subq))
            .limit(campaign.daily_limit)
        )

        result = await db.execute(leads_query)
        leads = result.scalars().all()

        sent_count = 0
        failed_count = 0

        for lead in leads:
            channel = step.channel or campaign.channel
            log_entry = OutreachLog(
                tenant_id=tenant_id,
                campaign_id=campaign_id,
                step_id=step_id,
                lead_id=lead.id,
                channel=channel,
                recipient=lead.email if channel == "email" else lead.phone,
                status="pending",
            )

            variant_tag, variant_subject, variant_body = _pick_variant(step, lead.id)
            log_entry.variant = variant_tag

            if channel == "email" and lead.email:
                subject = variant_subject.replace(
                    "{{company_name}}", lead.company_name or ""
                )
                body = (
                    variant_body
                    .replace("{{company_name}}", lead.company_name or "")
                    .replace("{{contact_name}}", lead.contact_name or "there")
                )
                send_result = await email_service.send_email_for_tenant(
                    db=db,
                    tenant_id=tenant_id,
                    to_email=lead.email,
                    subject=subject,
                    body_html=body,
                )
                log_entry.status = send_result["status"]
                log_entry.message_id = send_result.get("message_id")
                log_entry.error_msg = send_result.get("error")
                if send_result["status"] == "sent":
                    log_entry.sent_at = datetime.now(timezone.utc)
                    sent_count += 1
                else:
                    if send_result["status"] == "skipped":
                        logger.warning(
                            "[campaign_runner] step=%s lead=%s SKIPPED — %s. "
                            "Set SENDGRID_API_KEY in Railway or connect a SendGrid "
                            "integration on the Integrations page.",
                            step_id, lead.id, send_result.get("error", "no email provider"),
                        )
                    failed_count += 1

            elif channel == "whatsapp" and lead.phone:
                body = (
                    variant_body
                    .replace("{{company_name}}", lead.company_name or "")
                    .replace("{{contact_name}}", lead.contact_name or "there")
                )
                send_result = await whatsapp_service.send_message_for_tenant(
                    db=db,
                    tenant_id=tenant_id,
                    to_phone=lead.phone,
                    message=body,
                )
                log_entry.status = send_result["status"]
                log_entry.message_id = send_result.get("message_id")
                log_entry.error_msg = send_result.get("error")
                if send_result["status"] == "sent":
                    log_entry.sent_at = datetime.now(timezone.utc)
                    sent_count += 1
                else:
                    failed_count += 1

            else:
                log_entry.status = "skipped"
                log_entry.error_msg = "No valid contact for channel"

            db.add(log_entry)

        await db.flush()
        return {"sent": sent_count, "failed": failed_count, "total_leads": len(leads)}


campaign_runner = CampaignRunner()


# ---------------------------------------------------------------------------
# APScheduler entry point — must be a module-level async function (not a
# method or closure) so APScheduler can serialise the dotted reference into
# the Postgres jobstore and call it across restarts.
# ---------------------------------------------------------------------------

async def dispatch_active_campaigns() -> None:
    """Walk every active campaign, execute all its steps against un-contacted leads.

    Called by APScheduler every hour. Each step is gated by the
    ``already_sent_subq`` inside ``execute_step`` — leads that already
    received this step (status != 'failed') are skipped, so re-running the
    job is idempotent and capped by ``campaign.daily_limit``.

    Error handling: per-step exceptions are logged and swallowed so a single
    broken campaign does not block the rest of the batch. The session is
    committed once at the end so OutreachLog rows land atomically.
    """
    from core.database import AsyncSessionLocal  # local import avoids circular deps

    logger.info("[campaign_dispatch] starting hourly dispatch run")
    async with AsyncSessionLocal() as db:
        try:
            active = (
                await db.execute(select(Campaign).where(Campaign.status == "active"))
            ).scalars().all()
            logger.info("[campaign_dispatch] %d active campaign(s) found", len(active))

            for campaign in active:
                steps = (
                    await db.execute(
                        select(CampaignStep)
                        .where(CampaignStep.campaign_id == campaign.id)
                        .order_by(CampaignStep.step_number)
                    )
                ).scalars().all()

                for step in steps:
                    try:
                        res = await campaign_runner.execute_step(
                            db=db,
                            campaign_id=campaign.id,
                            step_id=step.id,
                            tenant_id=campaign.tenant_id,
                        )
                        logger.info(
                            "[campaign_dispatch] campaign=%s step=%s → %s",
                            campaign.id, step.step_number, res,
                        )
                    except Exception as exc:  # noqa: BLE001
                        logger.exception(
                            "[campaign_dispatch] campaign=%s step=%s FAILED: %s",
                            campaign.id, step.step_number, exc,
                        )

            await db.commit()
            logger.info("[campaign_dispatch] dispatch run complete — session committed")
        except Exception as exc:  # noqa: BLE001
            logger.exception("[campaign_dispatch] unexpected error in dispatch run: %s", exc)
            await db.rollback()
