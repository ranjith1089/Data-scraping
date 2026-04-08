import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator
from uuid import UUID

import anthropic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, extract

from core.claude_client import get_claude_client
from core.config import settings
from core.exceptions import AIQuotaExceeded
from models.ai_interaction import AIInteraction
from models.tenant import Tenant

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
MAX_RETRIES = 3
INITIAL_BACKOFF = 1.0


class ClaudeService:
    def __init__(self):
        self.client = get_claude_client()

    async def _check_quota(self, db: AsyncSession, tenant_id: UUID) -> None:
        """Check if tenant has remaining AI quota for this month."""
        # Get tenant plan
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        limit = settings.get_ai_monthly_limit(tenant.plan)

        # Count this month's AI calls
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        count_result = await db.execute(
            select(func.count(AIInteraction.id))
            .where(AIInteraction.tenant_id == tenant_id)
            .where(AIInteraction.created_at >= month_start)
        )
        used = count_result.scalar() or 0

        if used >= limit:
            raise AIQuotaExceeded(str(tenant_id), limit, used)

    async def generate(
        self,
        system: str,
        user_message: str,
        db: AsyncSession,
        tenant_id: UUID,
        user_id: Optional[UUID] = None,
        lead_id: Optional[UUID] = None,
        interaction_type: str = "general",
        max_tokens: int = 0,
        stream: bool = False,
    ) -> str:
        """Generate a response from Claude with retry logic."""
        if max_tokens == 0:
            max_tokens = settings.AI_MAX_TOKENS_PER_CALL

        await self._check_quota(db, tenant_id)

        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                response = await self.client.messages.create(
                    model=MODEL,
                    max_tokens=max_tokens,
                    system=system,
                    messages=[{"role": "user", "content": user_message}],
                )

                output_text = response.content[0].text

                # Log interaction
                interaction = AIInteraction(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    lead_id=lead_id,
                    type=interaction_type,
                    prompt_tokens=response.usage.input_tokens,
                    completion_tokens=response.usage.output_tokens,
                    model=MODEL,
                    input_summary=user_message[:500],
                    output_text=output_text[:2000],
                )
                db.add(interaction)
                await db.flush()

                return output_text

            except anthropic.RateLimitError as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    wait = INITIAL_BACKOFF * (2 ** attempt)
                    logger.warning(f"Rate limited, retrying in {wait}s (attempt {attempt + 1})")
                    await asyncio.sleep(wait)
            except anthropic.APIError as e:
                logger.error(f"Anthropic API error: {e}")
                raise

        raise last_error  # type: ignore

    async def generate_json(
        self,
        system: str,
        user_message: str,
        db: AsyncSession,
        tenant_id: UUID,
        user_id: Optional[UUID] = None,
        lead_id: Optional[UUID] = None,
        interaction_type: str = "general",
    ) -> dict:
        """Generate a JSON response from Claude."""
        json_system = system + "\n\nRespond ONLY with valid JSON. No markdown. No explanation. No code fences."

        raw = await self.generate(
            system=json_system,
            user_message=user_message,
            db=db,
            tenant_id=tenant_id,
            user_id=user_id,
            lead_id=lead_id,
            interaction_type=interaction_type,
        )

        return self._parse_json(raw)

    async def generate_stream(
        self,
        system: str,
        user_message: str,
        db: AsyncSession,
        tenant_id: UUID,
        user_id: Optional[UUID] = None,
        lead_id: Optional[UUID] = None,
        interaction_type: str = "chat",
        messages: list[dict] | None = None,
    ) -> AsyncGenerator[str, None]:
        """Stream response from Claude token by token."""
        await self._check_quota(db, tenant_id)

        if messages is None:
            messages = [{"role": "user", "content": user_message}]

        total_input = 0
        total_output = 0
        full_text = []

        try:
            async with self.client.messages.stream(
                model=MODEL,
                max_tokens=settings.AI_MAX_TOKENS_PER_CALL,
                system=system,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    full_text.append(text)
                    yield text

                # Get final message for token counts
                final = await stream.get_final_message()
                total_input = final.usage.input_tokens
                total_output = final.usage.output_tokens
        except anthropic.RateLimitError:
            yield "\n\n[Rate limit reached. Please try again in a moment.]"
            return
        except anthropic.APIError as e:
            yield f"\n\n[AI service error: {str(e)}]"
            return

        # Log interaction after streaming completes
        interaction = AIInteraction(
            tenant_id=tenant_id,
            user_id=user_id,
            lead_id=lead_id,
            type=interaction_type,
            prompt_tokens=total_input,
            completion_tokens=total_output,
            model=MODEL,
            input_summary=user_message[:500],
            output_text="".join(full_text)[:2000],
        )
        db.add(interaction)
        await db.flush()

    @staticmethod
    def _parse_json(raw: str) -> dict:
        """Parse JSON from Claude response, handling code fences."""
        text = raw.strip()
        # Strip markdown code fences
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove first line (```json or ```) and last line (```)
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines).strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON object in the text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass
            logger.error(f"Failed to parse JSON from Claude: {text[:200]}")
            raise ValueError("Could not parse JSON from Claude response")


# Singleton
claude_service = ClaudeService()
