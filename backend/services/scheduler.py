"""APScheduler singleton — the job runner for the integration module.

Why APScheduler in-process (Phase 1 decision)
---------------------------------------------
AveonApex deploys as a single FastAPI container on Railway. We need
support for delayed follow-ups, retries with exponential backoff, and
periodic polling (LinkedIn Lead Gen Forms, token refresh) — all
trigger types native to APScheduler. Using APScheduler inside the
uvicorn process means:

* Zero new deploy units (no worker dyno, no extra Dockerfile).
* Jobs persist across restarts via the ``apscheduler_jobs`` Postgres
  table (created by migration ``003``).
* The same async event loop that serves HTTP runs the jobs, so we
  can reuse existing database sessions and service code directly.

If we later need to scale out, swap the ``SQLAlchemyJobStore`` for
``RedisJobStore`` and boot a second process as a pure worker — no
caller-side code changes required because every job is addressed by
string reference.

Usage
-----
    from services.scheduler import scheduler, add_one_shot_job

    await add_one_shot_job(
        func="services.campaign_runner:retry_outreach",
        run_at=datetime.utcnow() + timedelta(minutes=5),
        kwargs={"outreach_log_id": "..."},
    )

All job targets MUST be addressable by dotted string reference (not
closures or lambdas) so APScheduler can serialise them into the
jobstore.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from apscheduler.executors.asyncio import AsyncIOExecutor
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

from core.config import settings

logger = logging.getLogger(__name__)


def _sync_database_url() -> str:
    """APScheduler's SQLAlchemyJobStore needs a SYNC DB URL, not asyncpg."""
    url = settings.DATABASE_URL or ""
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    return url


_jobstores: dict[str, Any] = {
    "default": SQLAlchemyJobStore(
        url=_sync_database_url(), tablename="apscheduler_jobs"
    ),
}

_executors: dict[str, Any] = {"default": AsyncIOExecutor()}

_job_defaults: dict[str, Any] = {
    "coalesce": True,
    "max_instances": 1,
    "misfire_grace_time": 60,
}

scheduler = AsyncIOScheduler(
    jobstores=_jobstores,
    executors=_executors,
    job_defaults=_job_defaults,
    timezone="UTC",
)


async def heartbeat() -> None:
    """Tiny no-op job used for smoke-testing the scheduler is alive."""
    logger.info("[scheduler] heartbeat")


def start() -> None:
    """Boot the scheduler. Idempotent — safe to call multiple times."""
    if scheduler.running:
        return
    try:
        scheduler.start()
        # Schedule a 60-second heartbeat so ops can verify the scheduler
        # is actually running in production logs.
        scheduler.add_job(
            heartbeat,
            trigger=IntervalTrigger(seconds=60),
            id="integration_scheduler_heartbeat",
            replace_existing=True,
        )

        # Social module (Phase 1) — registered by dotted-string reference
        # so APScheduler can serialise into the persistent jobstore.
        scheduler.add_job(
            "services.social.jobs:dispatch_pending_dms",
            trigger=IntervalTrigger(seconds=30),
            id="social_dispatch_pending_dms",
            replace_existing=True,
            max_instances=1,
        )
        scheduler.add_job(
            "services.social.jobs:fulfill_follow_gates",
            trigger=IntervalTrigger(minutes=5),
            id="social_fulfill_follow_gates",
            replace_existing=True,
            max_instances=1,
        )
        scheduler.add_job(
            "services.social.jobs:refresh_meta_tokens",
            trigger=CronTrigger(hour=3, minute=0),
            id="social_refresh_meta_tokens",
            replace_existing=True,
        )
        scheduler.add_job(
            "services.social.jobs:cleanup_old_messages",
            trigger=CronTrigger(hour=4, minute=0),
            id="social_cleanup_old_messages",
            replace_existing=True,
        )

        # Campaign email dispatch — runs every hour, walks all active
        # campaigns and sends the next batch of emails/messages to leads
        # that haven't received each step yet.
        scheduler.add_job(
            "services.campaign_runner:dispatch_active_campaigns",
            trigger=IntervalTrigger(hours=1),
            id="campaign_dispatch_active",
            replace_existing=True,
            max_instances=1,
        )

        logger.info("[scheduler] APScheduler started")
    except Exception as exc:  # noqa: BLE001 — never block app startup
        logger.exception("[scheduler] failed to start: %s", exc)


def shutdown(wait: bool = False) -> None:
    """Stop the scheduler. Called from FastAPI lifespan on shutdown."""
    if not scheduler.running:
        return
    try:
        scheduler.shutdown(wait=wait)
        logger.info("[scheduler] APScheduler stopped")
    except Exception as exc:  # noqa: BLE001
        logger.exception("[scheduler] shutdown error: %s", exc)


# ----------------------------------------------------------------------
# Typed helpers (thin wrappers around scheduler.add_job with consistent
# defaults). Job functions are passed by dotted-string reference so
# APScheduler can serialise them into the Postgres jobstore.
# ----------------------------------------------------------------------

def add_one_shot_job(
    func: str,
    run_at: datetime,
    *,
    job_id: Optional[str] = None,
    kwargs: Optional[dict[str, Any]] = None,
    replace_existing: bool = True,
) -> str:
    """Schedule ``func`` to run exactly once at ``run_at``."""
    job = scheduler.add_job(
        func,
        trigger=DateTrigger(run_date=run_at),
        id=job_id,
        kwargs=kwargs or {},
        replace_existing=replace_existing,
    )
    return job.id


def add_interval_job(
    func: str,
    *,
    seconds: int = 0,
    minutes: int = 0,
    hours: int = 0,
    job_id: Optional[str] = None,
    kwargs: Optional[dict[str, Any]] = None,
    replace_existing: bool = True,
) -> str:
    """Schedule ``func`` to run on an interval."""
    job = scheduler.add_job(
        func,
        trigger=IntervalTrigger(seconds=seconds, minutes=minutes, hours=hours),
        id=job_id,
        kwargs=kwargs or {},
        replace_existing=replace_existing,
    )
    return job.id


def add_cron_job(
    func: str,
    cron_expr: str,
    *,
    job_id: Optional[str] = None,
    kwargs: Optional[dict[str, Any]] = None,
    replace_existing: bool = True,
) -> str:
    """Schedule ``func`` on a crontab expression (e.g. ``0 */4 * * *``)."""
    job = scheduler.add_job(
        func,
        trigger=CronTrigger.from_crontab(cron_expr),
        id=job_id,
        kwargs=kwargs or {},
        replace_existing=replace_existing,
    )
    return job.id


def retry_backoff_seconds(retry_count: int) -> int:
    """Exponential backoff: 1m → 5m → 30m → 2h → 8h (capped)."""
    schedule = [60, 300, 1800, 7200, 28800]
    if retry_count <= 0:
        return schedule[0]
    if retry_count >= len(schedule):
        return schedule[-1]
    return schedule[retry_count]
