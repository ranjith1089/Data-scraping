import logging
from typing import Optional

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

from core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self):
        self.client = None
        if settings.SENDGRID_API_KEY:
            self.client = SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
        self.from_email = settings.SENDGRID_FROM_EMAIL

    async def send_email(
        self,
        to_email: str,
        subject: str,
        body: str,
        from_name: str = "LeadForge AI",
    ) -> dict:
        """Send an email via SendGrid. Returns message_id and status."""
        if not self.client:
            logger.warning("SendGrid not configured, skipping email send")
            return {"status": "skipped", "message_id": None, "error": "SendGrid not configured"}

        try:
            message = Mail(
                from_email=Email(self.from_email, from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=Content("text/html", body),
            )
            response = self.client.send(message)
            message_id = response.headers.get("X-Message-Id", "")
            return {
                "status": "sent",
                "message_id": message_id,
                "status_code": response.status_code,
            }
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return {"status": "failed", "message_id": None, "error": str(e)}


email_service = EmailService()
