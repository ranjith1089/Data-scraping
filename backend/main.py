"""AveonApex - FastAPI application entry point."""

import asyncio
import logging
import sys
import time as _time
import traceback

# ---------------------------------------------------------------------------
# Log timezone: shift all Python-level log timestamps to IST (UTC+5:30).
# Railway's system clock runs UTC; without this every [INFO] line in the
# Railway log stream carries a UTC timestamp that needs mental conversion.
# Patching logging.Formatter.converter here — before any handler is created
# — means uvicorn's own access-log and error-log handlers inherit IST
# automatically.  The converter receives a POSIX timestamp and must return a
# time.struct_time; we add the +05:30 offset before calling gmtime().
# ---------------------------------------------------------------------------
_IST_OFFSET_SEC = 5 * 3600 + 30 * 60  # 19 800 s


def _ist_converter(*args):  # noqa: ARG001
    return _time.gmtime(_time.time() + _IST_OFFSET_SEC)


logging.Formatter.converter = _ist_converter

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
        public_api,
        public_forms,
        public_form_submit,
        api_keys,
        webhook_subscriptions,
        billing,
    )
    from routers.ai import (
        email_gen,
        lead_scorer,
        chat,
        sector_brief,
        sector_analysis,
        personalise,
        reply_analyser,
        vernacular,
        proposal,
    )
    from routers.integrations import management as integrations_management
    from routers import enrichment
    from routers import lead_discovery
    from routers import linkedin as linkedin_router
    from routers import whatsapp as whatsapp_router
    from routers.social import oauth as social_oauth
    from routers.social import webhook_inbound as social_webhook_inbound
    from routers.social import automations as social_automations
    from routers.social import conversations as social_conversations
    from routers.social import templates as social_templates
    from routers.social import campaigns as social_campaigns
    from routers.social import analytics as social_analytics
    from routers.social import posts as social_posts
    from routers.social import consents as social_consents
    from services import scheduler as integration_scheduler
    print("[startup] all routers imported OK", flush=True)
except Exception:
    print("[startup] FATAL: import failed:", flush=True)
    traceback.print_exc()
    sys.stdout.flush()
    sys.stderr.flush()
    raise


# Module-level migration result, surfaced via /health/db so we can see
# what happened without needing access to Railway logs. The first deploy
# of the blocking-migrations fix confirmed that `alembic upgrade head`
# was *still* failing silently — Railway kept serving traffic with the
# schema pinned at 002 while the code expected 004. Exposing the actual
# subprocess stdout/stderr here is the fastest way to diagnose it from a
# dev machine with just curl.
_migration_result: dict = {"status": "pending"}


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
    alembic output is captured into ``_migration_result`` and surfaced by
    the ``/health/db`` endpoint so we can diagnose it without Railway
    log access.
    """
    global _migration_result
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
        # Tail the output so we don't blow the JSON response size up.
        tail = output[-4000:]
        if proc.returncode == 0:
            _migration_result = {
                "status": "ok",
                "returncode": 0,
                "output_tail": tail,
            }
            print("[migrations] alembic upgrade head: OK", flush=True)
            if output.strip():
                print(output, flush=True)
        else:
            _migration_result = {
                "status": "failed",
                "returncode": proc.returncode,
                "output_tail": tail,
            }
            print(
                f"[migrations] alembic FAILED with exit code {proc.returncode}",
                flush=True,
            )
            print(output, flush=True)
    except Exception as exc:  # pragma: no cover — last-resort diagnostic
        _migration_result = {
            "status": "exception",
            "error": repr(exc),
            "traceback": traceback.format_exc(),
        }
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
    title="AveonApex",
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


# ---------------------------------------------------------------------------
# Catch-all exception handler — guarantees every 500 ships with CORS headers
# AND a structured JSON body.
#
# Without this, an unhandled exception inside a request handler can slip past
# FastAPI's default handler in some edge cases (e.g., async generator
# dependencies raising during cleanup, ResponseValidationError on response_model
# coercion). When that happens, uvicorn emits its raw 21-byte
# "Internal Server Error" text/plain response, CORS headers are never attached,
# and the browser turns it into an opaque "Network Error" on the client.
#
# The handler below logs the traceback (visible in Railway logs) AND returns a
# JSON 500 through FastAPI's response pipeline — so CORSMiddleware wraps it.
# ---------------------------------------------------------------------------
from fastapi import Request  # noqa: E402
from fastapi.responses import JSONResponse  # noqa: E402


# Origins allowed to read error bodies. We mirror the CORSMiddleware
# config here because Starlette's middleware is skipped on responses
# produced by user-defined exception handlers in several FastAPI
# versions — meaning a raw 500 from a route would come back WITHOUT
# Access-Control-Allow-Origin, and the browser would hide the body as
# "Network Error" even though the server sent a nice JSON payload.
# That's exactly what happened on GET /leads/ when the ResponseValidation
# error fired, and why the Leads page showed "Network Error" instead of
# the real detail. Rebuilding the CORS reflection here guarantees every
# error response goes out with the right headers.
import re as _re  # noqa: E402

_VERCEL_ORIGIN_RE = _re.compile(r"^https://.*\.vercel\.app$")


def _cors_headers_for(request: Request) -> dict[str, str]:
    origin = request.headers.get("origin") or request.headers.get("Origin") or ""
    allowed = False
    if origin:
        if origin in settings.cors_origins_list:
            allowed = True
        elif _VERCEL_ORIGIN_RE.match(origin):
            allowed = True
    if not allowed:
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Log the full traceback to stdout so it shows up in `railway logs`.
    print(
        f"[unhandled] {request.method} {request.url.path} → {type(exc).__name__}: {exc}",
        flush=True,
    )
    traceback.print_exc()
    sys.stdout.flush()
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"{type(exc).__name__}: {exc}",
            "path": str(request.url.path),
        },
        headers=_cors_headers_for(request),
    )


# FastAPI raises ResponseValidationError when `response_model` coercion
# fails (e.g. a row in a List[LeadResponse] has a field that violates
# a validator). Starlette treats it as an internal server error and its
# own default handler is the one that was leaking past CORSMiddleware on
# /leads/. Handle it explicitly so we both (a) get a structured JSON body
# with the actual Pydantic error list, and (b) attach CORS headers so
# the browser lets axios read it.
from fastapi.exceptions import ResponseValidationError  # noqa: E402


@app.exception_handler(ResponseValidationError)
async def response_validation_exception_handler(
    request: Request, exc: ResponseValidationError
):
    print(
        f"[response-validation] {request.method} {request.url.path}: {exc.errors()}",
        flush=True,
    )
    sys.stdout.flush()
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Response validation failed.",
            "errors": [
                {
                    "loc": list(err.get("loc", [])),
                    "msg": err.get("msg", ""),
                    "type": err.get("type", ""),
                }
                for err in exc.errors()[:20]  # cap so the body stays readable
            ],
            "path": str(request.url.path),
        },
        headers=_cors_headers_for(request),
    )

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
app.include_router(sector_analysis.router, prefix=PREFIX)
app.include_router(personalise.router, prefix=PREFIX)
app.include_router(reply_analyser.router, prefix=PREFIX)
app.include_router(vernacular.router, prefix=PREFIX)
# AI Proposal Generation (Phase 1)
app.include_router(proposal.router, prefix=PREFIX)
# Lead Enrichment (Phase 2 — Apollo.io + Hunter.io)
app.include_router(enrichment.router, prefix=PREFIX)
# Lead Discovery (Phase 3 — Apollo.io people search)
app.include_router(lead_discovery.router, prefix=PREFIX)
# LinkedIn Prospecting (Phase 4 — ProxyCurl + AI messages)
app.include_router(linkedin_router.router, prefix=PREFIX)
# WhatsApp Outreach (Phase 5 — Meta Cloud API + AI messages + inbound webhook)
app.include_router(whatsapp_router.router, prefix=PREFIX)

# Public API (X-API-Key auth), public forms, and the public form shim/iframe
app.include_router(public_api.router, prefix=PREFIX)
app.include_router(public_forms.router, prefix=PREFIX)
app.include_router(public_form_submit.router, prefix=PREFIX)

# Tenant-management tooling for external integrations (API keys, outbound webhooks)
app.include_router(api_keys.router, prefix=PREFIX)
app.include_router(webhook_subscriptions.router, prefix=PREFIX)

# Billing visibility (plan + usage + upgrade request)
app.include_router(billing.router, prefix=PREFIX)

# Social module (Phase 1 — Instagram DM automation)
app.include_router(social_oauth.router, prefix=PREFIX)
app.include_router(social_webhook_inbound.router, prefix=PREFIX)
app.include_router(social_automations.router, prefix=PREFIX)
app.include_router(social_conversations.router, prefix=PREFIX)
app.include_router(social_templates.router, prefix=PREFIX)
app.include_router(social_campaigns.router, prefix=PREFIX)
app.include_router(social_analytics.router, prefix=PREFIX)
app.include_router(social_posts.router, prefix=PREFIX)
app.include_router(social_consents.router, prefix=PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "aveonapex-api"}


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

    info: dict = {"status": "ok", "migration_result": _migration_result}
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
