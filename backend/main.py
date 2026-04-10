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


async def _run_migrations_in_background() -> None:
    """Run ``alembic upgrade head`` without blocking uvicorn startup.

    Railway's healthcheck starts hitting ``/health`` within seconds of the
    container booting. A large initial migration (tables + RLS + indexes +
    seed data) can easily exceed that window if we run it inline before
    uvicorn binds the port — which causes the deploy to fail even though
    the migration itself would have succeeded a moment later.

    By scheduling it as a fire-and-forget task from the lifespan, uvicorn
    accepts connections immediately (``/health`` returns 200), and
    migrations complete in parallel. DB-dependent routes will briefly 503
    while the upgrade runs; once it finishes, everything works normally.
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: schedule migrations in the background so the port is bound
    # immediately and Railway's healthcheck can pass.
    asyncio.create_task(_run_migrations_in_background())

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
