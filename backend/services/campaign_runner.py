import logging
from datetime import datetime, timezone
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

            if channel == "email" and lead.email:
                subject = (step.subject or "").replace(
                    "{{company_name}}", lead.company_name or ""
                )
                body = (
                    (step.body or "")
                    .replace("{{company_name}}", lead.company_name or "")
                    .replace("{{contact_name}}", lead.contact_name or "there")
                )
                result = await email_service.send_email(lead.email, subject, body)
                log_entry.status = result["status"]
                log_entry.message_id = result.get("message_id")
                log_entry.error_msg = result.get("error")
                if result["status"] == "sent":
                    log_entry.sent_at = datetime.now(timezone.utc)
                    sent_count += 1
                else:
                    failed_count += 1

            elif channel == "whatsapp" and lead.phone:
                body = (
                    (step.body or "")
                    .replace("{{company_name}}", lead.company_name or "")
                    .replace("{{contact_name}}", lead.contact_name or "there")
                )
                result = await whatsapp_service.send_message(lead.phone, body)
                log_entry.status = result["status"]
                log_entry.message_id = result.get("message_id")
                log_entry.error_msg = result.get("error")
                if result["status"] == "sent":
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
