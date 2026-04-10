"""AI service facade.

Originally a thin wrapper around the Anthropic SDK. Now dispatches to
either OpenRouter (default, OpenAI-compatible) or direct Anthropic
based on ``settings.AI_PROVIDER``. The public surface
(``generate``, ``generate_json``, ``generate_stream``) is unchanged so
none of the routers in ``routers/ai/`` had to be touched.

Why we moved off direct Anthropic: production billing on a single
direct API key is a single point of failure — when it ran out of
credits the chat endpoint started returning ``Your credit balance is
too low...`` to end users. OpenRouter routes to dozens of providers
behind one key + one balance, so swapping models or providers becomes
a single env var change.
"""

import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text as sa_text

from core.claude_client import get_ai_client
from core.config import settings
from core.exceptions import AIQuotaExceeded
from models.ai_interaction import AIInteraction
from models.tenant import Tenant

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
INITIAL_BACKOFF = 1.0


def _model_for_provider() -> str:
    """Resolve the model identifier for the active provider."""
    provider = (settings.AI_PROVIDER or "openrouter").lower()
    if provider == "anthropic":
        # Direct-Anthropic legacy path uses raw model ids.
        return "claude-sonnet-4-20250514"
    return settings.OPENROUTER_MODEL or "anthropic/claude-sonnet-4"


def _is_openrouter() -> bool:
    return (settings.AI_PROVIDER or "openrouter").lower() != "anthropic"


def _friendly_error(exc: Exception) -> str:
    """Translate raw provider errors into a single-line user-friendly message.

    Anything that mentions ``credit balance`` or ``insufficient_quota``
    is rewritten so end users see a billing-style message instead of a
    raw stack trace in the chat bubble.
    """
    msg = str(exc)
    lowered = msg.lower()
    if "credit balance" in lowered or "insufficient_quota" in lowered or "402" in lowered:
        return (
            "AI service is temporarily unavailable (provider account out of "
            "credits). Please contact your administrator."
        )
    if "rate limit" in lowered or "429" in lowered:
        return "AI service is rate-limited. Please try again in a moment."
    if "401" in lowered or "unauthorized" in lowered or "invalid api key" in lowered:
        return "AI service authentication failed. Please contact your administrator."
    return f"AI service error: {msg}"


class ClaudeService:
    def __init__(self):
        self.client = get_ai_client()

    async def _log_interaction(
        self,
        tenant_id: UUID,
        user_id: Optional[UUID],
        lead_id: Optional[UUID],
        interaction_type: str,
        prompt_tokens: int,
        completion_tokens: int,
        model: str,
        input_summary: str,
        output_text: str,
    ) -> None:
        """Persist an AI interaction in an isolated short-lived session.

        Why not just reuse the request's session?

        1. ``ai_interactions`` is protected by a Postgres RLS policy
           that requires ``app.current_tenant`` to be set. ``SET LOCAL``
           only applies to the current transaction, so if the outer
           request session has already committed or rolled back by the
           time we get here (which is especially easy to hit with
           ``StreamingResponse`` in FastAPI — dependency cleanup timing
           is unreliable relative to the stream generator finishing),
           the insert silently vanishes. That's exactly how the AI Usage
           tab ended up permanently stuck at ``0 calls`` while Anthropic
           was being billed: every chat completion succeeded upstream,
           but nothing landed in the table.

        2. The request session is tenant-scoped and may be in a broken
           state after an error downstream; a dedicated session
           isolates logging so a DB hiccup can never break the AI
           response that the user is waiting for.

        Any failure here is caught and logged — logging must never
        propagate an exception into the caller.
        """
        from core.database import AsyncSessionLocal

        try:
            async with AsyncSessionLocal() as log_session:
                # Re-apply tenant context so the RLS policy accepts the
                # insert. SET LOCAL only lasts for the current
                # transaction, so this must run inside whatever
                # transaction the upcoming INSERT runs in.
                await log_session.execute(
                    sa_text(
                        f"SET LOCAL app.current_tenant = '{str(tenant_id)}'"
                    )
                )
                interaction = AIInteraction(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    lead_id=lead_id,
                    type=interaction_type,
                    prompt_tokens=prompt_tokens or 0,
                    completion_tokens=completion_tokens or 0,
                    model=model,
                    input_summary=(input_summary or "")[:500],
                    output_text=(output_text or "")[:2000],
                )
                log_session.add(interaction)
                await log_session.commit()
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "Failed to log AI interaction for tenant=%s type=%s: %s",
                tenant_id,
                interaction_type,
                exc,
                exc_info=True,
            )

    async def _check_quota(self, db: AsyncSession, tenant_id: UUID) -> None:
        """Check if tenant has remaining AI quota for this month."""
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        limit = settings.get_ai_monthly_limit(tenant.plan)

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

    # ------------------------------------------------------------------
    # generate — single-shot completion (no streaming)
    # ------------------------------------------------------------------
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
        if max_tokens == 0:
            max_tokens = settings.AI_MAX_TOKENS_PER_CALL

        await self._check_quota(db, tenant_id)

        model = _model_for_provider()
        last_error: Exception | None = None

        for attempt in range(MAX_RETRIES):
            try:
                if _is_openrouter():
                    output_text, in_tokens, out_tokens = await self._openrouter_generate(
                        system=system,
                        user_message=user_message,
                        model=model,
                        max_tokens=max_tokens,
                    )
                else:
                    output_text, in_tokens, out_tokens = await self._anthropic_generate(
                        system=system,
                        user_message=user_message,
                        model=model,
                        max_tokens=max_tokens,
                    )

                # Log to a dedicated session (see _log_interaction
                # docstring for the RLS + streaming lifecycle rationale).
                await self._log_interaction(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    lead_id=lead_id,
                    interaction_type=interaction_type,
                    prompt_tokens=in_tokens,
                    completion_tokens=out_tokens,
                    model=model,
                    input_summary=user_message,
                    output_text=output_text,
                )

                return output_text

            except Exception as exc:  # noqa: BLE001
                last_error = exc
                # Retry only on transient signals; everything else (auth,
                # billing, validation) is permanent and should bubble up
                # immediately so the user sees a useful error.
                msg = str(exc).lower()
                transient = "rate limit" in msg or "429" in msg or "timeout" in msg
                if transient and attempt < MAX_RETRIES - 1:
                    wait = INITIAL_BACKOFF * (2**attempt)
                    logger.warning(
                        "AI call transient error (%s), retrying in %ss (attempt %s)",
                        type(exc).__name__,
                        wait,
                        attempt + 1,
                    )
                    await asyncio.sleep(wait)
                    continue
                logger.error("AI call failed: %s", exc)
                raise

        assert last_error is not None
        raise last_error

    async def _openrouter_generate(
        self,
        system: str,
        user_message: str,
        model: str,
        max_tokens: int,
    ) -> tuple[str, int, int]:
        response = await self.client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_message},
            ],
        )
        choice = response.choices[0]
        text = choice.message.content or ""
        usage = response.usage
        in_tokens = getattr(usage, "prompt_tokens", 0) or 0
        out_tokens = getattr(usage, "completion_tokens", 0) or 0
        return text, in_tokens, out_tokens

    async def _anthropic_generate(
        self,
        system: str,
        user_message: str,
        model: str,
        max_tokens: int,
    ) -> tuple[str, int, int]:
        response = await self.client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_message}],
        )
        text = response.content[0].text
        return text, response.usage.input_tokens, response.usage.output_tokens

    # ------------------------------------------------------------------
    # generate_json — wraps generate with a JSON-only system prompt
    # ------------------------------------------------------------------
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
        json_system = (
            system
            + "\n\nRespond ONLY with valid JSON. No markdown. No explanation. No code fences."
        )
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

    # ------------------------------------------------------------------
    # generate_stream — token-by-token streaming for the chat endpoint
    # ------------------------------------------------------------------
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
        await self._check_quota(db, tenant_id)

        if messages is None:
            messages = [{"role": "user", "content": user_message}]

        model = _model_for_provider()
        total_input = 0
        total_output = 0
        full_text: list[str] = []

        try:
            if _is_openrouter():
                async for piece, in_tok, out_tok in self._openrouter_stream(
                    system=system, messages=messages, model=model
                ):
                    if piece:
                        full_text.append(piece)
                        yield piece
                    if in_tok:
                        total_input = in_tok
                    if out_tok:
                        total_output = out_tok
            else:
                async for piece, in_tok, out_tok in self._anthropic_stream(
                    system=system, messages=messages, model=model
                ):
                    if piece:
                        full_text.append(piece)
                        yield piece
                    if in_tok:
                        total_input = in_tok
                    if out_tok:
                        total_output = out_tok
        except Exception as exc:  # noqa: BLE001
            logger.error("AI stream error: %s", exc, exc_info=True)
            yield f"\n\n[{_friendly_error(exc)}]"
            return

        # Log the interaction once streaming completes successfully.
        # Uses a dedicated short-lived session so that RLS + FastAPI
        # StreamingResponse cleanup timing can't swallow the insert
        # (see _log_interaction docstring for the full rationale).
        await self._log_interaction(
            tenant_id=tenant_id,
            user_id=user_id,
            lead_id=lead_id,
            interaction_type=interaction_type,
            prompt_tokens=total_input,
            completion_tokens=total_output,
            model=model,
            input_summary=user_message,
            output_text="".join(full_text),
        )

    async def _openrouter_stream(
        self,
        system: str,
        messages: list[dict],
        model: str,
    ) -> AsyncGenerator[tuple[str, int, int], None]:
        """Yield ``(text_piece, prompt_tokens, completion_tokens)`` tuples.

        Token counts are 0 until the very last chunk (some providers send
        a final usage chunk via ``stream_options={"include_usage": True}``).
        """
        full_messages = [{"role": "system", "content": system}, *messages]
        stream = await self.client.chat.completions.create(
            model=model,
            messages=full_messages,
            max_tokens=settings.AI_MAX_TOKENS_PER_CALL,
            stream=True,
            stream_options={"include_usage": True},
        )
        async for chunk in stream:
            in_tok = 0
            out_tok = 0
            usage = getattr(chunk, "usage", None)
            if usage is not None:
                in_tok = getattr(usage, "prompt_tokens", 0) or 0
                out_tok = getattr(usage, "completion_tokens", 0) or 0
            piece = ""
            if chunk.choices:
                delta = chunk.choices[0].delta
                piece = (getattr(delta, "content", None) or "")
            yield piece, in_tok, out_tok

    async def _anthropic_stream(
        self,
        system: str,
        messages: list[dict],
        model: str,
    ) -> AsyncGenerator[tuple[str, int, int], None]:
        async with self.client.messages.stream(
            model=model,
            max_tokens=settings.AI_MAX_TOKENS_PER_CALL,
            system=system,
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield text, 0, 0
            final = await stream.get_final_message()
            yield "", final.usage.input_tokens, final.usage.output_tokens

    @staticmethod
    def _parse_json(raw: str) -> dict:
        """Parse JSON from a model response, tolerant of code fences."""
        text = raw.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines).strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass
            logger.error("Failed to parse JSON from AI response: %s", text[:200])
            raise ValueError("Could not parse JSON from AI response")


# Singleton — keep the historical name so existing imports still work.
claude_service = ClaudeService()
ai_service = claude_service  # New canonical name; both are aliased.
