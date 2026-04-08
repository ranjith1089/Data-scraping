"""LeadForge AI - FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.config import settings
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title="LeadForge AI",
    description="AI-powered B2B Lead Generation SaaS",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
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
app.include_router(users.router, prefix=PREFIX)
app.include_router(leads.router, prefix=PREFIX)
app.include_router(campaigns.router, prefix=PREFIX)
app.include_router(outreach.router, prefix=PREFIX)
app.include_router(pipeline.router, prefix=PREFIX)
app.include_router(activities.router, prefix=PREFIX)
app.include_router(analytics.router, prefix=PREFIX)
app.include_router(import_export.router, prefix=PREFIX)
app.include_router(webhooks.router, prefix=PREFIX)

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
