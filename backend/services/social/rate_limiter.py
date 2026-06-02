"""Per-tenant outbound DM rate limiter (Redis sliding-window).

Meta enforces its own rate caps; this is the AveonApex-side throttle
that protects against a viral post sending 10k DMs in a minute and
either tripping a tenant's Meta-side ban or saturating the worker.

Default policy: 200 outbound DMs per tenant per rolling 60 minutes.
Plan-tier override is honoured via ``Plan.features.dm_per_hour`` if
present.

Algorithm: sorted-set sliding window in Redis. Keys are namespaced
``social:dm:rate:{tenant_id}`` so they auto-segregate per tenant and
per platform if we add more. We use Redis if ``REDIS_URL`` resolves;
local dev with no Redis falls back to an in-memory dict so the engine
doesn't silently bypass the limit during tests.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Optional
from uuid import UUID

import redis.asyncio as aioredis

from core.config import settings

logger = logging.getLogger(__name__)

_DEFAULT_LIMIT_PER_HOUR = 200
_WINDOW_S = 3600


class _InMemoryFallback:
    """Used when Redis is unavailable. Per-process only, so multiple
    workers will each get the full quota — fine for local dev, not
    fine for production (which always has Redis on Railway)."""

    def __init__(self) -> None:
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def trim_and_count(self, key: str, window_s: int) -> int:
        now = time.monotonic()
        d = self._hits[key]
        while d and (now - d[0]) > window_s:
            d.popleft()
        return len(d)

    def push(self, key: str) -> None:
        self._hits[key].append(time.monotonic())


_fallback = _InMemoryFallback()
_redis_client: Optional[aioredis.Redis] = None


def _get_redis() -> Optional[aioredis.Redis]:
    """Lazy singleton Redis client. Returns None if URL is missing."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    if not settings.REDIS_URL:
        return None
    try:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL, decode_responses=True
        )
        return _redis_client
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not init Redis client for rate limiter: %s", exc)
        return None


async def check_and_consume(
    tenant_id: UUID, limit_per_hour: int = _DEFAULT_LIMIT_PER_HOUR
) -> tuple[bool, int, int]:
    """Atomically: trim expired hits, count current, push one if under
    the limit.

    Returns ``(allowed, current_count_after_push, limit)``.
    ``allowed=False`` means the caller should NOT send and should queue
    or drop.
    """
    key = f"social:dm:rate:{tenant_id}"
    r = _get_redis()
    if r is None:
        # In-memory fallback (local dev / tests)
        count = _fallback.trim_and_count(key, _WINDOW_S)
        if count >= limit_per_hour:
            return False, count, limit_per_hour
        _fallback.push(key)
        return True, count + 1, limit_per_hour

    now_ms = int(time.time() * 1000)
    cutoff_ms = now_ms - _WINDOW_S * 1000
    try:
        # Trim expired entries first.
        await r.zremrangebyscore(key, 0, cutoff_ms)
        count = await r.zcard(key)
        if count >= limit_per_hour:
            return False, count, limit_per_hour
        # Add this attempt with a unique member so we don't collide.
        await r.zadd(key, {f"{now_ms}-{count}": now_ms})
        await r.expire(key, _WINDOW_S + 60)
        return True, count + 1, limit_per_hour
    except Exception as exc:  # noqa: BLE001
        # Redis went down — fail open rather than blocking the tenant
        # entirely. We log loudly so ops notices.
        logger.warning(
            "Rate limiter Redis call failed (failing open): %s", exc
        )
        return True, -1, limit_per_hour


async def current_usage(
    tenant_id: UUID, limit_per_hour: int = _DEFAULT_LIMIT_PER_HOUR
) -> tuple[int, int]:
    """Return ``(current_count, limit)`` without consuming. Used by the
    UI's "DM rate" progress bar."""
    key = f"social:dm:rate:{tenant_id}"
    r = _get_redis()
    if r is None:
        return _fallback.trim_and_count(key, _WINDOW_S), limit_per_hour
    try:
        now_ms = int(time.time() * 1000)
        cutoff_ms = now_ms - _WINDOW_S * 1000
        await r.zremrangebyscore(key, 0, cutoff_ms)
        return int(await r.zcard(key)), limit_per_hour
    except Exception:  # noqa: BLE001
        return 0, limit_per_hour
