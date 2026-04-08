import httpx
import logging

from core.config import settings

logger = logging.getLogger(__name__)


class WhatsAppService:
    BASE_URL = "https://graph.facebook.com/v18.0"

    def __init__(self):
        self.api_key = settings.WA_API_KEY
        self.phone_id = settings.WA_PHONE_ID
        self.enabled = bool(self.api_key and self.phone_id)

    async def send_message(self, to_phone: str, message: str) -> dict:
        """Send a WhatsApp text message via the Business API."""
        if not self.enabled:
            logger.warning("WhatsApp not configured")
            return {"status": "skipped", "error": "WhatsApp not configured"}

        url = f"{self.BASE_URL}/{self.phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "text",
            "text": {"body": message},
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, headers=headers, timeout=30)
                resp.raise_for_status()
                data = resp.json()
                return {
                    "status": "sent",
                    "message_id": data.get("messages", [{}])[0].get("id"),
                }
        except Exception as e:
            logger.error(f"WhatsApp send failed: {e}")
            return {"status": "failed", "error": str(e)}


whatsapp_service = WhatsAppService()
