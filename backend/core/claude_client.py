"""AI client factory.

Historically this returned an `anthropic.AsyncAnthropic` client and
nothing else. After production billing on the direct Anthropic surface
ran out of credits and took down chat, we standardised on OpenRouter
(OpenAI-compatible router) so that switching models / providers becomes
a single env var change.

This module exposes:

- ``get_ai_client()``  — the canonical entry point. Returns an
  ``openai.AsyncOpenAI`` instance configured for OpenRouter when
  ``settings.AI_PROVIDER == "openrouter"`` (the default), or for the
  legacy direct-Anthropic path when it's set to ``"anthropic"``.

- ``get_claude_client()`` — kept as a backwards-compat alias so any old
  call sites that imported it still work. New code should use
  ``get_ai_client()``.
"""

from __future__ import annotations

import logging
from typing import Any

from core.config import settings

logger = logging.getLogger(__name__)


_openai_client: Any | None = None
_anthropic_client: Any | None = None


def _build_openrouter_client() -> Any:
    """Build an ``openai.AsyncOpenAI`` pointed at OpenRouter."""
    # Imported lazily so installs that don't have the openai package yet
    # (e.g. an old image still on the way out) don't fail at import time.
    from openai import AsyncOpenAI

    if not settings.OPENROUTER_API_KEY:
        logger.warning(
            "[ai] OPENROUTER_API_KEY is empty — every AI call will fail "
            "with a 401. Set it on Railway → backend → Variables."
        )

    # OpenRouter recommends sending HTTP-Referer + X-Title for
    # attribution in their dashboard. Both are optional.
    default_headers = {
        "HTTP-Referer": settings.PUBLIC_BASE_URL or "https://leadforge.ai",
        "X-Title": settings.OPENROUTER_APP_NAME or "LeadForge AI",
    }

    return AsyncOpenAI(
        api_key=settings.OPENROUTER_API_KEY or "missing",
        base_url=settings.OPENROUTER_BASE_URL,
        default_headers=default_headers,
    )


def _build_anthropic_client() -> Any:
    """Build the legacy direct-Anthropic client."""
    import anthropic

    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


def get_ai_client() -> Any:
    """Return the cached AI client for the configured provider."""
    global _openai_client, _anthropic_client

    provider = (settings.AI_PROVIDER or "openrouter").lower()

    if provider == "anthropic":
        if _anthropic_client is None:
            _anthropic_client = _build_anthropic_client()
        return _anthropic_client

    # Default → OpenRouter
    if _openai_client is None:
        _openai_client = _build_openrouter_client()
    return _openai_client


def get_claude_client() -> Any:
    """Backwards-compat alias. Prefer ``get_ai_client()`` in new code."""
    return get_ai_client()
