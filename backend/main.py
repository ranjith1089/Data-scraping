"""LeadForge AI - FastAPI application entry point."""

import asyncio
import sys
import traceback

# Heartbeat — proves the Python process actually started. If this is the
# only line in Railway logs, something below crashed at import time.
print("[startup] main.py loading...", flush=True)

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from contextlib import asynccontextmanager

    from core.config import settings
    print("[startup] core.config imported OK", flush=True)

    from core.exceptions import (
        AIQuotaExceeded,
        SectorNotFoundError,
        ai_quota_handler,
        sector_not_found_handler,
    )

    # Import all routers
    from routers import (
        auth,
        tenants,
        admin_tenants,
        users,
        leads,
        campaigns,
        outreach,
        pipeline,
        activities,
        analytics,
        import_export,
        webhooks,
    )
    from routers.ai import (
        email_gen,
        lead_scorer,
        chat,
        sector_brief,
        personalise,
        reply_analyser,
    )
    from routers.integrations import management as integrations_management
    from services import scheduler as integration_scheduler
    print("[startup] all routers imported OK", flush=True)
except Exception:
    print("[startup] FATAL: import failed:", flush=True)
    traceback.print_exc()
    sys.stdout.flush()
    sys.stderr.flush()
    raise


async def _run_migrations() -> None:
    """Run ``alembic upgrade head`` synchronously at lifespan startup.

    Earlier this was fire-and-forget via ``asyncio.create_task`` so that
    Railway's healthcheck window wouldn't be blocked by a long initial
    migration. That turned out to be worse than the disease: if the
    alembic subprocess failed or was killed mid-run, the app happily kept
    serving traffic with a stale schema. ORM SELECTs then crashed with
    ``UndefinedColumn`` the instant new mapped columns landed — which is
    exactly what took the login endpoint down after the
    super-admin-tenant-management migration (004) shipped.

    Running it synchronously here means the container simply won't serve
    traffic until the schema is up to date. Every migration we've shipped
    completes well under Railway's startup healthcheck window, so the
    delay is acceptable; and if something *does* go wrong, the full
    alembic output is printed right here in the startup logs instead of
    being swallowed by a background task.
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "alembic",
            "upgrade",
            "head",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await proc.communicate()
        output = stdout.decode(errors="replace") if stdout else ""
        if proc.returncode == 0:
            print("[migrations] alembic upgrade head: OK", flush=True)
            if output.strip():
                print(output, flush=True)
        else:
            print(
                f"[migrations] alembic FAILED with exit code {proc.returncode}",
                flush=True,
            )
            print(output, flush=True)
    except Exception as exc:  # pragma: no cover — last-resort diagnostic
        print(f"[migrations] unexpected exception: {exc!r}", flush=True)
        traceback.print_exc()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: run alembic upgrade head BEFORE serving traffic. This used
    # to be fire-and-forget, which meant a silently-failed migration left
    # the app serving 500s on every DB query. See ``_run_migrations`` for
    # the full story. The call is wrapped in a try/except so the app still
    # boots (and /health still returns 200) even if migrations blow up —
    # we want the startup logs visible in Railway, not a crash loop.
    try:
        await _run_migrations()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] migration step raised: {exc!r}", flush=True)
        traceback.print_exc()

    # Boot APScheduler in-process. This is best-effort — if the jobstore
    # table doesn't exist yet (first-run before migrations complete) the
    # scheduler will log and keep retrying on the first add_job call.
    try:
        integration_scheduler.start()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] scheduler start failed: {exc!r}", flush=True)

    yield

    # Shutdown: stop the scheduler cleanly so Postgres connections aren't
    # left dangling when uvicorn reloads.
    try:
        integration_scheduler.shutdown(wait=False)
    except Exception:  # noqa: BLE001
        pass


app = FastAPI(
    title="LeadForge AI",
    description="AI-powered B2B Lead Generation SaaS",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow explicit origins + any Vercel preview deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(AIQuotaExceeded, ai_quota_handler)
app.add_exception_handler(SectorNotFoundError, sector_not_found_handler)

# Mount routers
PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(tenants.router, prefix=PREFIX)
app.include_router(admin_tenants.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(leads.router, prefix=PREFIX)
app.include_router(campaigns.router, prefix=PREFIX)
app.include_router(outreach.router, prefix=PREFIX)
app.include_router(pipeline.router, prefix=PREFIX)
app.include_router(activities.router, prefix=PREFIX)
app.include_router(analytics.router, prefix=PREFIX)
app.include_router(import_export.router, prefix=PREFIX)
app.include_router(webhooks.router, prefix=PREFIX)

# Third-Party Integration Module
app.include_router(integrations_management.router, prefix=PREFIX)

# AI routers
app.include_router(email_gen.router, prefix=PREFIX)
app.include_router(lead_scorer.router, prefix=PREFIX)
app.include_router(chat.router, prefix=PREFIX)
app.include_router(sector_brief.router, prefix=PREFIX)
app.include_router(personalise.router, prefix=PREFIX)
app.include_router(reply_analyser.router, prefix=PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "leadforge-api"}


@app.get("/health/db")
async def health_db():
    """Diagnostic: report the current alembic revision and presence of
    key columns added by recent migrations.

    This is deliberately unauthenticated — it reveals only schema
    metadata, never user data — so we can verify post-deploy that
    migrations landed without needing a working login. If a future
    deploy starts 500-ing on /auth/login again, hitting this endpoint
    tells us instantly whether it's a stale-schema problem.
    """
    from sqlalchemy import text
    from core.database import AsyncSessionLocal

    info: dict = {"status": "ok"}
    try:
        async with AsyncSessionLocal() as session:
            rev = await session.execute(text("SELECT version_num FROM alembic_version"))
            row = rev.first()
            info["alembic_version"] = row[0] if row else None

            # Column presence checks for the two migrations most likely
            # to be missing during a rolling upgrade.
            checks = {
                "users.is_superuser": (
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = 'users' AND column_name = 'is_superuser'"
                ),
                "tenants.status": (
                    "SELECT 1 FROM information_schema.columns "
                    "WHERE table_name = 'tenants' AND column_name = 'status'"
                ),
                "integrations_table": (
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_name = 'integrations'"
                ),
            }
            present: dict = {}
            for name, sql in checks.items():
                res = await session.execute(text(sql))
                present[name] = res.first() is not None
            info["schema"] = present
    except Exception as exc:  # noqa: BLE001
        info["status"] = "error"
        info["error"] = repr(exc)
    return info
