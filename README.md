# AveonApex

AI-powered, multi-tenant B2B lead generation SaaS for sales teams targeting companies across 9 key Indian industry sectors. Provider-agnostic AI layer (OpenRouter by default, supports Anthropic Claude, OpenAI GPT, Google Gemini and more with a single env var swap), third-party ad-platform integrations (Meta / Google Ads / LinkedIn), and a super-admin console for platform operators to manage every tenant on the instance.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Features](#features)
  - [Admission / Education CRM](#admission--education-crm)
- [Architecture](#architecture)
- [Quick Start (Docker)](#quick-start-docker)
- [Local Development](#local-development)
- [Cloud Deployment](#cloud-deployment)
- [API Documentation](#api-documentation)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Plans and Pricing](#plans-and-pricing)
- [License](#license)

> **See also:** [PRODUCT.md](PRODUCT.md) — product spec, ICP & roadmap · [PROCESS.md](PROCESS.md) — engineering process, migrations & deploy runbook

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11, FastAPI 0.109, SQLAlchemy 2.0 (async with asyncpg), Alembic, Pydantic v2 |
| **Database** | PostgreSQL 15 with Row-Level Security (multi-tenant isolation) |
| **Frontend** | React 18, TypeScript, Vite, TanStack Query v5, Zustand, Tailwind CSS v3 |
| **AI** | Provider-agnostic layer. **Default:** OpenRouter via `openai` SDK (routes to Claude, GPT, Gemini, Mistral, etc. — swap models with `OPENROUTER_MODEL`). **Fallback:** direct Anthropic SDK when `AI_PROVIDER=anthropic`. |
| **Scheduler** | APScheduler 3.10 with SQLAlchemyJobStore (in-process, used for delayed follow-ups, token refreshes, integration retries) |
| **Integrations** | Fernet-encrypted credential store + plugin registry. OAuth 2.0 connectors for Meta Lead Ads, Google Ads, LinkedIn Lead Gen Forms. |
| **Cache** | Redis 7 (session cache, sector brief cache, rate limiting) |
| **Object Storage** | MinIO (S3-compatible, for CSV imports and file attachments) |
| **Email** | SendGrid (transactional email + webhook event tracking) |
| **Auth** | JWT (access + refresh tokens), bcrypt password hashing, RBAC, platform-level super-admin flag |
| **Deploy** | Docker Compose locally; Vercel (frontend) + Railway (backend + Postgres + Redis) in production |

---

## Features

### AI-Powered Features (Provider-Agnostic)

All AI features are routed through a centralized `services/claude_service.py` (aliased as `ai_service`) which dispatches to either **OpenRouter** (default, via the `openai` SDK — giving you access to Claude, GPT, Gemini, Mistral and dozens of other models behind a single key) or **direct Anthropic** (`AI_PROVIDER=anthropic`). Features work identically regardless of the active provider. The facade handles retry/backoff, per-tenant monthly quota enforcement, isolated AI-interaction logging (survives streaming responses and RLS), token/cost tracking, and friendly error translation (credit / rate-limit / auth failures become user-safe messages instead of raw stack traces).

| # | Feature | Endpoint | Description |
|---|---------|----------|-------------|
| 1 | **Sector-Aware Email Generator** | `POST /api/v1/ai/generate-email` | Generates personalised cold outreach emails with sector-specific pain points, value propositions, and a WhatsApp-friendly version. Supports configurable tone and multi-step sequences. |
| 2 | **AI Lead Scorer** | `POST /api/v1/ai/score-leads` | Batch scores up to 50 leads (0-100) based on ICP match, contact quality, deal potential, red/green flags, and recommended next step. |
| 3 | **Sales Chat Assistant** | `POST /api/v1/ai/chat` | Conversational AI that knows your leads, campaigns, and sector intelligence. Supports SSE streaming for real-time responses. Optionally scoped to a specific lead for context-aware advice. |
| 4 | **Sector Intelligence Briefs** | `GET /api/v1/ai/sector-brief/{code}` | Fresh market analysis per sector including trends, challenges, and opportunities. Cached for 24 hours in Redis. |
| 5 | **Personalisation Engine** | `POST /api/v1/ai/personalise-batch` | Batch personalises campaign step emails for up to 50 leads with company-specific openings, subject lines, and body content. |
| 6 | **Reply Analyser** | `POST /api/v1/ai/analyse-reply` | Analyses incoming email replies for sentiment (positive/neutral/negative/out_of_office), intent (interested/not_interested/asking_for_info/wants_demo/unsubscribe/referring_someone), suggests a response, and recommends a pipeline stage change. |

### Industry Sectors (11 supported)

Each sector has a dedicated AI persona, curated pain points, and value propositions stored in the `sectors` table. Selecting a sector reshapes the whole UI — form fields, pipeline-stage vocabulary, lead sources, and AI prompts all adapt to context.

| Code | Sector | Workflow |
|------|--------|----------|
| `it_ites` | Technology & IT | B2B |
| `agriculture` | Agriculture | B2B |
| `manufacturing` | Manufacturing | B2B |
| `software` | Software Products & SaaS | B2B |
| `marketing_media` | Marketing & Media | B2B |
| `finance_professional` | Finance & Professional | B2B |
| `construction_real_estate` | Construction & Real Estate | B2B |
| `retail_ecommerce` | Retail & E-commerce | B2B |
| `energy_utilities` | Energy & Utilities | B2B |
| `college` | Colleges & Universities | 🎓 Admission |
| `education` | Schools & Coaching | 🏫 Admission |

The two **admission sectors** (`college`, `education`) switch the app into a student-enquiry CRM — see [Admission / Education CRM](#admission--education-crm) below. The split is by *level*: `college` covers higher-ed (UG/PG courses, streams, 12th board & marks), while `education` covers K-12 schools, tuition, and NEET/JEE coaching (class/programme, current school). Both share the same admission workflow (parent contacts, admission pipeline stages, auto-tasks, drip sequences) but present level-appropriate labels and option lists.

### Core Platform Features

- **Multi-tenant architecture** with PostgreSQL Row-Level Security -- complete data isolation per tenant
- **Super-Admin Platform Console** (`/admin/tenants`) -- gated by a `users.is_superuser` flag and a `RequireSuperuser` route guard. Full tenant CRUD, lifecycle transitions (`active` / `suspended` / `cancelled`), owner assignment, per-tenant stats, and audit trail via `integration_events`. Suspended or cancelled tenants are blocked at login with a friendly error; super-admins are exempt so they can always recover.
- **Third-Party Integration Module** -- pluggable connector registry with Fernet-encrypted credential storage, OAuth 2.0 flows (Meta Lead Ads, Google Ads, LinkedIn Lead Gen Forms), automatic token refresh via APScheduler, webhook-driven lead ingestion, retry queue with dead-letter tracking, and a full audit log (`integration_events`).
- **JWT authentication** with short-lived access tokens (15 min) and long-lived refresh tokens (7 days). Token payload carries `is_superuser` so UI guards can flip instantly after promotion.
- **Role-Based Access Control (RBAC)** with tenant-scoped roles `owner` / `admin` / `member`, plus the orthogonal platform-wide `is_superuser` flag.
- **Lead management** with full-text search, filtering by sector/stage/score/city/district/company size, URL-driven pagination, and a rows-per-page selector (20 / 50 / 100).
- **Bulk operations** -- bulk update and bulk delete up to 500 leads at a time
- **Campaign builder** with multi-step email sequences, configurable daily send limits, and AI tone selection
- **Campaign execution** -- start, pause, execute individual steps, and track per-campaign stats (sent/opened/replied)
- **Deal pipeline** with customisable stages, drag-and-drop Kanban board, deal values in INR, and probability tracking
- **Activity logging** -- calls, emails, meetings, notes, tasks with next-action scheduling
- **Outreach tracking** -- full email lifecycle (pending/sent/delivered/opened/clicked/replied/bounced) via SendGrid webhooks
- **CSV import/export** -- import up to 10,000 leads from CSV, export filtered leads to CSV
- **Analytics dashboard** with lead counts, conversion rates, pipeline value, and AI-generated insights
- **AI usage tracking** -- per-tenant monthly call count, token spend, model mix, and most recent interactions, logged via an isolated session that survives StreamingResponse cleanup and RLS policies
- **API key management** for external integrations

### Admission / Education CRM

When a tenant operates in an **admission sector** (`college` or `education`), the platform transforms from a generic B2B CRM into a purpose-built student-admission system. This is driven by a single `isAdmissionSector(sector_code)` check on the frontend and an `_ADMISSION_SECTORS` set on the backend — no separate app, no forked codebase.

- **Context-aware lead form** — the *Add Lead* modal renders a *New Student Enquiry* form with student, parent/guardian, academic, and location sections instead of the B2B company form. Labels and option lists adapt to level: a college enquiry asks for *Course Interested In / Stream (12th) / 12th %*, while a school/coaching enquiry asks for *Class · Programme / Current School / Last Class %*.
- **Student data model** — leads carry admission columns: `parent_name`, `parent_phone`, `course_interested`, `board`, `stream`, `percentage_marks`, `school_name` (migration 017; back-filled idempotently by 018 and a startup safety-net).
- **Admission pipeline vocabulary** — the same underlying stage codes display as *New Enquiry → Contacted → Counseled → Applied → Docs Submitted → Enrolled / Not Joining / Follow-up Later*.
- **Admission lead sources** — Phone Enquiry, Walk-in, Education Stall, School Visit, Instagram, Facebook, Referral, Website.
- **Auto-task on enquiry** — creating a college/education lead automatically spawns a high-priority "Follow up with {student} — {course}" task due in 24h (best-effort, never blocks lead creation).
- **Pre-built admission email sequence** — a one-click 4-step drip (Day 0 / 2 / 5 / 10: Enquiry → Brochure → Counseling invite → Last-call) created from the Campaigns page.
- **Admission WhatsApp quick templates** — Enquiry Received, Counseling Invite, Document Reminder, Enrollment Confirm — pre-fill the AI WhatsApp composer on the lead detail page.
- **Bulk student CSV import** — a dedicated *Student Enquiries* import mode maps academic columns (course, board, stream, %, parent details) alongside the standard B2B mode.
- **Meta Lead Ads → student leads** — Facebook/Instagram Lead Ad submissions land via the `/webhooks/meta-leads` webhook, are mapped to the student schema, tagged with their source, and (for admission sectors) get the same auto-task treatment.
- **Student public form** — the hosted/iframe enquiry form switches to a violet-themed admission layout (course/stream/board selects, parent fields) when the form's sector is an admission sector.

---

## Architecture

### Project Structure

```
CRM/
├── backend/                       # FastAPI + SQLAlchemy (async) + Alembic
│   ├── main.py                    # App entry: router wiring, lifespan (migrations + schema safety-net), /health endpoints
│   ├── requirements.txt
│   ├── Dockerfile                 # python:3.11-slim; uvicorn entry
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/              # 19 sequential migrations (001 … 019); `alembic upgrade head` runs at startup
│   ├── core/
│   │   ├── config.py              # Pydantic settings (DATABASE_URL normalisation, AI provider)
│   │   ├── database.py            # Async engine + AsyncSessionLocal + Base
│   │   ├── dependencies.py        # get_db, get_current_user, require_role, require_superuser
│   │   ├── security.py            # JWT create/validate, password hashing
│   │   └── crypto.py              # Fernet encrypt/decrypt for integration credentials
│   ├── models/                    # SQLAlchemy ORM (35+ models)
│   │   ├── tenant.py user.py lead.py sector.py plan.py
│   │   ├── campaign.py campaign_step.py outreach_log.py email_sequence.py
│   │   ├── deal.py deal_activity.py pipeline_stage.py activity.py task.py
│   │   ├── proposal.py enrichment_log.py linkedin_message.py whatsapp_message.py
│   │   ├── integration.py integration_event.py api_key.py ai_interaction.py
│   │   ├── public_form.py webhook_endpoint.py webhook_subscription.py
│   │   ├── automation_rule.py lead_assignment_rule.py
│   │   └── social/                # Instagram/Meta DM automation models
│   ├── schemas/                   # Pydantic v2 request/response models (+ schemas/social/)
│   ├── routers/                   # 45+ route modules
│   │   ├── auth.py tenants.py admin_tenants.py users.py billing.py
│   │   ├── leads.py pipeline.py activities.py tasks.py analytics.py reports.py
│   │   ├── campaigns.py email_sequences.py outreach.py
│   │   ├── import_export.py public_forms.py public_form_submit.py public_api.py
│   │   ├── integrations/          # connector management
│   │   ├── webhooks.py            # SendGrid + Meta Lead Ads (/webhooks/meta-leads)
│   │   ├── webhook_subscriptions.py api_keys.py
│   │   ├── enrichment.py lead_discovery.py linkedin.py whatsapp.py
│   │   ├── ai/                    # email_gen, lead_scorer, chat, sector_brief,
│   │   │                          # personalise, reply_analyser, proposal, vernacular, sector_analysis
│   │   └── social/                # oauth, webhook_inbound, automations, conversations,
│   │                              # templates, campaigns, analytics, posts, consents
│   └── services/                  # Business logic
│       ├── claude_service.py      # Provider-agnostic AI facade (ai_service)
│       ├── analytics_service.py campaign_runner.py email_sequence_service.py
│       ├── csv_importer.py email_service.py sector_config.py
│       ├── proposal_service.py enrichment_service.py lead_discovery_service.py
│       ├── linkedin_service.py whatsapp_service.py whatsapp_ai_service.py
│       ├── scheduler.py           # APScheduler (token refresh, due-step processing)
│       ├── webhook_dispatcher.py  # Outbound webhook fan-out (lead.created, …)
│       ├── integrations/          # base + meta_ads, google_ads, linkedin_ads,
│       │                          # sendgrid, smtp, whatsapp, ga4, fb_pixel, …
│       └── social/                # rule_engine, action_executor, instagram_service, …
├── frontend/                      # React 18 + TypeScript + Vite + Tailwind
│   ├── src/
│   │   ├── pages/                 # 35+ pages (Leads, Pipeline, Campaigns, EmailSequences,
│   │   │                          # Tasks, Proposals, WhatsApp, LinkedIn, Integrations,
│   │   │                          # Reports, Billing, Admin*, social/, auth/, Landing)
│   │   ├── components/            # leads/ pipeline/ campaigns/ ai/ analytics/
│   │   │                          # integrations/ admin/ layout/ settings/ ui/
│   │   ├── hooks/                 # 20 React-Query hooks (useLeads, useEmailSequences, …)
│   │   ├── lib/                   # api client, utils (SECTOR_NAMES, isAdmissionSector, …)
│   │   └── store/                 # auth/global state
│   ├── index.html  package.json  vite.config.ts  tailwind.config.js  Dockerfile
├── docs/                          # SOCIAL_PHASE1.md, etc.
├── scripts/                       # import_tn_colleges.py (bulk seed helper)
├── schema.sql                     # Full PostgreSQL schema with RLS policies (reference)
├── docker-compose.yml             # db, redis, minio, backend, frontend
├── render.yaml                    # Render.com blueprint (backup deploy)
├── postman_collection.json        # Full API collection
├── README.md  PRODUCT.md  PROCESS.md
```

### Multi-Tenancy

AveonApex uses PostgreSQL Row-Level Security for tenant data isolation:

1. Every tenant-scoped table includes a `tenant_id UUID NOT NULL REFERENCES tenants(id)` column.
2. RLS policies enforce `tenant_id = current_setting('app.current_tenant')::uuid` on all SELECT, INSERT, UPDATE, and DELETE operations.
3. On every database request, the backend extracts `tenant_id` from the JWT token and sets it as a PostgreSQL session variable via `SET LOCAL app.current_tenant = '<uuid>'`.
4. Tables with RLS: `users`, `leads`, `campaigns`, `campaign_steps`, `outreach_log`, `ai_interactions`, `activities`, `deals`, `integrations`, `integration_events`.
5. Global tables (no RLS): `tenants`, `plans`, `sectors`.

#### Super-Admin Layer

Orthogonal to tenant-scoped RBAC, a platform-wide `users.is_superuser` boolean unlocks cross-tenant access:

- `require_superuser` FastAPI dependency gates every `/api/v1/admin/*` route
- JWT access + refresh tokens carry `is_superuser` so the UI (`RequireSuperuser` wrapper, conditional Sidebar section) reacts instantly
- `POST /auth/login` returns **403 Tenant suspended / cancelled** when a non-super-admin user's tenant is not `active`. Super-admins are always exempt so the platform operator can recover locked-out tenants.
- Super-admins cannot suspend, cancel, or demote **their own** tenant — the `admin_tenants` router rejects self-targeting actions.
- All admin actions (`tenant.created`, `tenant.updated`, `tenant.suspended`, `tenant.reactivated`, `tenant.cancelled`) are written to the shared `integration_events` audit table — zero new audit schema.

### AI Integration

All AI calls go through `services/claude_service.py` (exported as both `claude_service` and the canonical `ai_service`):

- **Provider-agnostic** — `AI_PROVIDER=openrouter` (default) talks to OpenRouter via the `openai` SDK; `AI_PROVIDER=anthropic` uses the direct Anthropic SDK. The public surface (`generate`, `generate_json`, `generate_stream`) is identical in both modes so routers never need to know which provider is active.
- **Why OpenRouter by default** — production billing on a single direct Anthropic key is a single point of failure: when the key ran out of credits every chat returned a raw `Your credit balance is too low...` to end users. OpenRouter routes to dozens of providers behind one key + one balance, so model or provider swaps become a single env var change.
- **Friendly error translation** — credit exhaustion, rate limits, and auth failures are rewritten to user-safe strings before reaching the chat bubble. Raw stack traces never leak.
- **Automatic retry** with exponential backoff on transient failures (rate limits, timeouts); permanent errors (auth, billing, validation) bubble up immediately so users see useful errors.
- **Monthly quota enforcement** per tenant plan (Starter: 500, Growth: 5,000, Enterprise: 50,000 calls/month)
- **JSON response parsing** with markdown fence-stripping for structured outputs
- **Isolated interaction logging** — every AI call is recorded in `ai_interactions` from a dedicated short-lived `AsyncSessionLocal()` that re-applies `SET LOCAL app.current_tenant`. This is how the AI Usage dashboard survives FastAPI `StreamingResponse` lifecycle timing and the RLS policy on `ai_interactions` (a previous bug left the dashboard permanently stuck at `0 calls` while providers were being billed — the isolated session pattern fixes it).
- **SSE streaming** for the chat assistant endpoint (real-time token-by-token delivery). For OpenRouter we pass `stream_options={"include_usage": True}` so token counts arrive in the final chunk.
- **Configurable max tokens** per call (`AI_MAX_TOKENS_PER_CALL`, default 4096)

### Integration Module

The `integrations/` subsystem is a pluggable connector layer for third-party ad platforms and CRMs. Each connector implements a small interface: OAuth flow, credential refresh, webhook handler, and lead fetch. Credentials are encrypted at rest with Fernet (key from `INTEGRATIONS_ENCRYPTION_KEY`) and APScheduler handles token refresh and retry queues so tokens never silently expire. Shipped connectors: **Meta Lead Ads**, **Google Ads**, **LinkedIn Lead Gen Forms**. Full audit trail lives in `integration_events` (reused by the super-admin module for tenant actions).

### Authentication Flow

1. **Register**: Creates a new tenant + owner user, returns JWT access + refresh tokens.
2. **Login**: Validates credentials, returns JWT tokens. Access token contains `sub` (user ID), `tenant_id`, `role`, and `email`.
3. **Refresh**: Exchanges a valid refresh token for a new access token.
4. **Access token lifetime**: 15 minutes (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`).
5. **Refresh token lifetime**: 7 days (configurable via `REFRESH_TOKEN_EXPIRE_DAYS`).
6. All protected endpoints require `Authorization: Bearer <access_token>` header.

---

## Quick Start (Docker)

### Prerequisites

- Docker and Docker Compose v2+
- An **AI provider key** — either an OpenRouter key (default, recommended — get one at https://openrouter.ai/keys) or an Anthropic key (https://console.anthropic.com)
- (Optional) A SendGrid API key for email delivery
- (Optional) OAuth app credentials for Meta / Google / LinkedIn if you enable the integration module

### 1. Clone and Configure

```bash
git clone https://github.com/your-org/aveonapex.git
cd aveonapex
```

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set your API keys:

```dotenv
DATABASE_URL=postgresql+asyncpg://aveonapex:aveonapex_pass@db:5432/aveonapex
SECRET_KEY=your-secure-secret-key-change-this

# AI provider — default is OpenRouter (one key, many models)
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...your-key-here
OPENROUTER_MODEL=anthropic/claude-sonnet-4

# If you prefer direct Anthropic instead, flip these and leave OpenRouter empty:
# AI_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-...your-key-here

SENDGRID_API_KEY=SG.your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
REDIS_URL=redis://redis:6379
CORS_ORIGINS=http://localhost:5173

# Required only if you're enabling the third-party integration module
# INTEGRATIONS_ENCRYPTION_KEY=<fernet-key-generated-with-cryptography>
```

Create the frontend environment file:

```bash
cp frontend/.env.example frontend/.env
```

Edit `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:8000/api/v1
```

### 2. Start with Docker Compose

```bash
docker-compose up -d
```

This starts five services:

| Service | Port | Description |
|---------|------|-------------|
| **db** | 5432 | PostgreSQL 15 (Alpine) with schema auto-init |
| **redis** | 6379 | Redis 7 (Alpine) for caching |
| **minio** | 9000 / 9001 | MinIO object storage (S3-compatible) |
| **backend** | 8000 | FastAPI with hot-reload |
| **frontend** | 5173 | Vite dev server |

The PostgreSQL container automatically runs `schema.sql` on first startup via the `docker-entrypoint-initdb.d` mount.

### 3. Run Database Migrations

```bash
docker-compose exec backend alembic upgrade head
```

### 4. Access the Application

| Resource | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| MinIO Console | http://localhost:9001 |
| Health Check | http://localhost:8000/health |

### Demo Account

| Field | Value |
|-------|-------|
| Email | `admin@aveonapex.ai` |
| Password | `admin123` |

> **Note**: The demo account is only available if seed data has been loaded. Run `docker-compose exec backend python seed.py` if a seed script is provided.

---

## Local Development

### Backend (without Docker)

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Linux/macOS)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment config
cp .env.example .env
# Edit .env -- set DATABASE_URL to point to your local PostgreSQL

# Run database migrations
alembic upgrade head

# Start the development server
uvicorn main:app --reload --port 8000
```

The backend requires PostgreSQL and Redis running locally. You can start just those services with Docker:

```bash
docker-compose up -d db redis
```

### Frontend (without Docker)

```bash
cd frontend

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env -- ensure VITE_API_URL=http://localhost:8000/api/v1

# Start the development server
npm run dev
```

The frontend dev server starts at http://localhost:5173 with hot module replacement.

### Running Tests

```bash
# Backend tests
cd backend
pytest -v

# Frontend tests
cd frontend
npm run test
```

---

## Cloud Deployment

The recommended free-tier production setup is **Vercel (frontend) + Railway (backend + Postgres + Redis)**. A `render.yaml` blueprint is also provided as a backup.

### Architecture

```
  ┌─────────────┐        HTTPS         ┌──────────────────────┐
  │   Vercel    │  ─────────────────▶  │       Railway        │
  │  (React UI) │   VITE_API_URL       │ FastAPI + Postgres   │
  └─────────────┘                      │    + Redis           │
                                       └──────────────────────┘
```

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → import the GitHub repo
2. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add environment variable:
   - `VITE_API_URL` = `https://<your-railway-backend>.up.railway.app/api/v1`
4. Click **Deploy**

Vercel will auto-redeploy on every push to `main`. Preview deployments are created for every PR.

### Backend → Railway

The backend ships with `railway.json`, `nixpacks.toml`, `Procfile`, and `runtime.txt` — Railway auto-detects these.

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select `ranjith1089/Data-scraping`
3. Add a **PostgreSQL** database: `+ New → Database → PostgreSQL`
4. Add a **Redis** instance: `+ New → Database → Redis`
5. Add the **backend service**: `+ New → GitHub Repo → Data-scraping`
   - In the service settings, set **Root Directory** to `backend`
6. In the backend service → **Variables** tab, set:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference syntax) |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` |
   | `SECRET_KEY` | `openssl rand -hex 32` output |
   | `AI_PROVIDER` | `openrouter` (or `anthropic` to use the legacy direct path) |
   | `OPENROUTER_API_KEY` | Your OpenRouter key (required when `AI_PROVIDER=openrouter`) |
   | `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4` (or any OpenRouter model slug) |
   | `ANTHROPIC_API_KEY` | Your Claude API key — only required when `AI_PROVIDER=anthropic` |
   | `PUBLIC_BASE_URL` | `https://<your-backend>.up.railway.app` |
   | `CORS_ORIGINS` | `https://<your-vercel-project>.vercel.app` |
   | `SENDGRID_API_KEY` | Optional |
   | `SENDGRID_FROM_EMAIL` | `noreply@aveonapex.ai` |
   | `INTEGRATIONS_ENCRYPTION_KEY` | Required if the integration module is enabled (Fernet key) |
   | `META_APP_ID` / `META_APP_SECRET` / `META_WEBHOOK_VERIFY_TOKEN` | Optional, Meta Lead Ads connector |
   | `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` / `GOOGLE_ADS_DEVELOPER_TOKEN` | Optional, Google Ads connector |
   | `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | Optional, LinkedIn connector |
   | `AI_MAX_TOKENS_PER_CALL` | `4096` |
   | `AI_MONTHLY_LIMIT_STARTER` | `500` |
   | `AI_MONTHLY_LIMIT_GROWTH` | `5000` |
   | `AI_MONTHLY_LIMIT_ENTERPRISE` | `50000` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` |
   | `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |

7. In the backend service → **Settings** → **Networking** → **Generate Domain**
8. Railway runs `alembic upgrade head` as part of the FastAPI lifespan (output is captured into a `_migration_result` dict so you can inspect it via `/health/db`), then starts `uvicorn main:app --host 0.0.0.0 --port $PORT`.
9. Verify: `https://<your-backend>.up.railway.app/health` should return `{"status":"ok","service":"aveonapex-api"}`.
10. Verify migrations applied: `https://<your-backend>.up.railway.app/health/db` should include `"alembic_version":"004"` and `"migration_result":{"status":"ok",...}`.

> **`DATABASE_URL` auto-normalization:** Railway provides the URL as `postgresql://...`, but SQLAlchemy async needs `postgresql+asyncpg://...`. The `core/config.py` validator converts this automatically, so you don't need to transform the URL manually.

### Backup: Render.com Blueprint

A `render.yaml` blueprint is included at the repo root. To deploy to Render instead of Railway:

1. Push this repo to GitHub
2. In Render dashboard → **New** → **Blueprint**
3. Select the repo — Render reads `render.yaml` and provisions:
   - `aveonapex-api` web service (FastAPI)
   - `aveonapex-db` PostgreSQL
   - `aveonapex-redis` Redis
4. After provisioning, set these **secret** env vars in the dashboard (they have `sync: false`):
   - `ANTHROPIC_API_KEY`
   - `SENDGRID_API_KEY` (optional)
   - `CORS_ORIGINS` (your Vercel URL)

### Continuous Integration

The repo includes `.github/workflows/ci.yml` which runs on every PR and push to `main`:

- **Frontend job** — `npm ci`, `tsc --noEmit`, `npm run build`, uploads `dist/` artifact
- **Backend job** — `pip install`, import-verification of `main.py`, byte-compile all Python files

This prevents broken TypeScript or Python imports from reaching `main` (the kind of errors that previously only surfaced inside the Vercel/Railway build logs).

### Line-Ending Normalization

`.gitattributes` at the repo root forces LF line endings for all text files. This eliminates Windows CRLF warnings (`LF will be replaced by CRLF`) when committing from Windows machines. If you cloned the repo before this was added, run:

```bash
git add --renormalize .
git commit -m "Normalize line endings"
```

---

## API Documentation

All endpoints are prefixed with `/api/v1`. Protected endpoints require `Authorization: Bearer <access_token>`.

### Health Check

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Service health status |
| GET | `/health/db` | No | Database-level health: current alembic revision, schema checks, and `migration_result` captured from the startup subprocess (crucial for diagnosing production migration failures) |

### Authentication (`/api/v1/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register a new tenant and owner user |
| POST | `/auth/login` | No | Login with email and password |
| POST | `/auth/refresh` | No | Refresh an expired access token |
| GET | `/auth/me` | Yes | Get current authenticated user info |

**Register Request Body:**

```json
{
  "tenant_name": "Acme Corp",
  "tenant_slug": "acme-corp",
  "email": "admin@acme.com",
  "password": "securePassword123",
  "full_name": "Rajesh Kumar"
}
```

**Login Request Body:**

```json
{
  "email": "admin@acme.com",
  "password": "securePassword123"
}
```

**Token Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 900
}
```

### Tenants (`/api/v1/tenants`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/tenants/current` | Yes | Owner | Get current tenant details |
| PATCH | `/tenants/current` | Yes | Owner | Update tenant name, settings, or plan |

### Super-Admin Tenant Management (`/api/v1/admin/tenants`)

Every endpoint below requires a user with `is_superuser = true` in the JWT payload. Non-super-admin callers receive **403 Super-admin required**. All mutations write an audit row to `integration_events` (`event_type='tenant.<action>'`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/tenants/` | List tenants with search (`q`), filter by `status`/`plan`, pagination. Returns user / lead counts per row. |
| POST | `/admin/tenants/` | Create a tenant. Body accepts an optional nested `owner` object — when present, the initial owner user is created atomically and linked via `tenants.owner_id`. |
| GET | `/admin/tenants/{tenant_id}` | Full tenant detail + stats. |
| PATCH | `/admin/tenants/{tenant_id}` | Partial update (`name`, `plan`, `settings`, `owner_id`). Lifecycle transitions use the action endpoints below, not this one. |
| POST | `/admin/tenants/{tenant_id}/suspend` | Sets `status='suspended'`. Rejects attempts to suspend the caller's own tenant. |
| POST | `/admin/tenants/{tenant_id}/reactivate` | Sets `status='active'`. Cannot reactivate a cancelled tenant. |
| POST | `/admin/tenants/{tenant_id}/cancel` | Soft delete — sets `status='cancelled'`. Rejects attempts to cancel the caller's own tenant. No hard-delete endpoint exists by design. |
| GET | `/admin/tenants/{tenant_id}/stats` | `{user_count, active_user_count, lead_count, campaign_count, integration_count, last_activity_at}` |
| POST | `/admin/tenants/{tenant_id}/users` | Create a user inside a target tenant (used for admin-seeding owners / members). |

### Integrations (`/api/v1/integrations`)

Pluggable connector module for third-party ad platforms. Credentials are encrypted at rest with Fernet (`INTEGRATIONS_ENCRYPTION_KEY`). All endpoints are tenant-scoped and require auth.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/integrations/providers` | List available connectors (Meta Lead Ads, Google Ads, LinkedIn Lead Gen Forms) and whether each is configured at the platform level. |
| GET | `/integrations/` | List this tenant's active integrations with connection status and last-sync timestamps. |
| POST | `/integrations/{provider}/oauth/start` | Returns an OAuth authorisation URL with a CSRF-protected `state` param. |
| GET | `/integrations/{provider}/oauth/callback` | OAuth redirect handler — exchanges code for tokens, encrypts, persists, schedules refresh job. |
| POST | `/integrations/{integration_id}/sync` | On-demand sync of leads / campaigns from the provider. |
| DELETE | `/integrations/{integration_id}` | Disconnect and revoke stored tokens. |
| GET | `/integrations/{integration_id}/events` | Audit tail — filters `integration_events` for this integration. |
| POST | `/webhooks/integrations/{provider}` | Public webhook receiver (Meta / Google / LinkedIn push new leads here — signature-verified). |

### Users (`/api/v1/users`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/users/` | Yes | Any | List all team members |
| POST | `/users/` | Yes | Owner/Admin | Create a new team member |
| GET | `/users/{user_id}` | Yes | Any | Get user details |
| PATCH | `/users/{user_id}` | Yes | Owner/Admin | Update user role or status |
| DELETE | `/users/{user_id}` | Yes | Owner/Admin | Deactivate a user |

### Leads (`/api/v1/leads`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/leads/` | Yes | List and search leads with filters |
| POST | `/leads/` | Yes | Create a new lead |
| GET | `/leads/{lead_id}` | Yes | Get lead details |
| PATCH | `/leads/{lead_id}` | Yes | Update a lead |
| DELETE | `/leads/{lead_id}` | Yes | Delete a lead |
| POST | `/leads/bulk-update` | Yes | Bulk update up to 500 leads |
| POST | `/leads/bulk-delete` | Yes | Bulk delete up to 500 leads |

**Query Parameters for `GET /leads/`:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sector_code` | string | Filter by sector code |
| `stage` | enum | Filter by stage: new, contacted, qualified, proposal, negotiation, won, lost, nurture |
| `min_score` | int (0-100) | Minimum lead score |
| `max_score` | int (0-100) | Maximum lead score |
| `district` | string | Filter by district |
| `city` | string | Filter by city |
| `company_size` | enum | Filter by size: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+ |
| `assigned_to` | UUID | Filter by assigned user |
| `search` | string | Full-text search across company name, contact name, email |
| `sort_by` | string | Sort field (default: created_at) |
| `sort_order` | string | asc or desc |
| `page` | int | Page number (default: 1) |
| `per_page` | int | Results per page (default: 50, max: 200) |

**Create Lead Request Body:**

```json
{
  "sector_code": "tech",
  "company_name": "Infosys Technologies",
  "industry": "IT Services",
  "sub_industry": "Software Consulting",
  "state": "Karnataka",
  "district": "Bangalore Urban",
  "city": "Bangalore",
  "website": "https://www.infosys.com",
  "company_size": "1000+",
  "annual_revenue_inr": 150000000000,
  "contact_name": "Priya Sharma",
  "designation": "VP of Engineering",
  "email": "priya.sharma@infosys.com",
  "phone": "+91-9876543210",
  "linkedin_url": "https://linkedin.com/in/priyasharma",
  "tags": ["enterprise", "high-value", "bangalore"],
  "source": "linkedin",
  "custom_fields": {"employees_count": 300000}
}
```

### Campaigns (`/api/v1/campaigns`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/campaigns/` | Yes | List all campaigns |
| POST | `/campaigns/` | Yes | Create a new campaign |
| GET | `/campaigns/{id}` | Yes | Get campaign with stats |
| PATCH | `/campaigns/{id}` | Yes | Update campaign settings |
| DELETE | `/campaigns/{id}` | Yes | Delete a campaign |
| POST | `/campaigns/{id}/start` | Yes | Start a draft campaign |
| POST | `/campaigns/{id}/pause` | Yes | Pause a running campaign |
| POST | `/campaigns/{id}/execute-step/{step_id}` | Yes | Execute a specific campaign step |
| GET | `/campaigns/{id}/stats` | Yes | Get campaign performance stats |

### Outreach (`/api/v1/outreach`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/outreach/` | Yes | List outreach logs with filters |
| GET | `/outreach/{log_id}` | Yes | Get outreach log detail |
| POST | `/outreach/track-event` | Yes | Manually track an outreach event |

### Pipeline (`/api/v1/pipeline`)

**Stages:**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/pipeline/stages` | Yes | List all pipeline stages (ordered) |
| POST | `/pipeline/stages` | Yes | Create a new pipeline stage |
| PATCH | `/pipeline/stages/{id}` | Yes | Update a pipeline stage |
| DELETE | `/pipeline/stages/{id}` | Yes | Delete a pipeline stage |

**Deals:**

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/pipeline/deals` | Yes | List all deals (filterable by stage) |
| POST | `/pipeline/deals` | Yes | Create a new deal |
| GET | `/pipeline/deals/{id}` | Yes | Get deal details |
| PATCH | `/pipeline/deals/{id}` | Yes | Update a deal (move stage, update value) |
| DELETE | `/pipeline/deals/{id}` | Yes | Delete a deal |

### Activities (`/api/v1/activities`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/activities/` | Yes | List activities (filter by lead, user, type) |
| POST | `/activities/` | Yes | Log a new activity |
| GET | `/activities/{id}` | Yes | Get activity details |

**Activity Types:** `call`, `email`, `meeting`, `note`, `task`, `whatsapp`, `linkedin`, `other`

### Analytics (`/api/v1/analytics`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/analytics/dashboard` | Yes | Aggregated dashboard metrics |
| GET | `/analytics/ai-insights` | Yes | AI-generated insights about your data (cached 1h) |

### Import / Export (`/api/v1`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/import/csv` | Yes | Import leads from CSV file (max 10MB, 10,000 rows) |
| GET | `/export/leads` | Yes | Export leads to CSV (respects current filters) |

### Webhooks (`/api/v1/webhooks`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/webhooks/sendgrid` | No | SendGrid event webhook (open, click, bounce, delivered, spamreport) |
| GET | `/webhooks/meta-leads` | No | Meta Lead Ads webhook verification (`hub.challenge`, validated against `META_WEBHOOK_VERIFY_TOKEN`) |
| POST | `/webhooks/meta-leads` | Signature | Meta Lead Ads `leadgen` notifications. Resolves the tenant by matching `page_id` to a connected `meta_ads` integration, fetches the lead from the Graph API, maps Facebook/Instagram fields to the (student) lead schema, and fires the `lead.created` fan-out. Always returns 200. |

### AI Endpoints (`/api/v1/ai`)

#### Generate Email

```
POST /api/v1/ai/generate-email
```

```json
{
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "step_number": 1,
  "tone": "professional",
  "campaign_context": "We help manufacturing companies automate quality inspection with computer vision.",
  "user_product_desc": "QualityVision AI is a computer vision platform that automates visual quality inspection on manufacturing lines, reducing defects by 95% and inspection costs by 70%."
}
```

**Response:**

```json
{
  "subject": "Reducing defect rates at Tata Steel with AI-powered inspection",
  "body": "Dear Mr. Agarwal,\n\nI noticed Tata Steel's recent expansion...",
  "whatsapp_version": "Hi Ravi, quick question about quality inspection at Tata Steel...",
  "key_hook": "95% defect reduction in automotive steel production",
  "personalisation_note": "Referenced their Q3 expansion into automotive-grade steel"
}
```

#### Score Leads

```
POST /api/v1/ai/score-leads
```

```json
{
  "lead_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001"
  ]
}
```

**Response:**

```json
{
  "results": [
    {
      "lead_id": "550e8400-e29b-41d4-a716-446655440000",
      "score": 87,
      "icp_match": "excellent",
      "score_reason": "Large manufacturing company with clear need for quality automation. Decision-maker contact available.",
      "recommended_step": "Schedule a product demo focusing on their steel production line",
      "best_outreach_time": "Tuesday-Thursday, 10:00-11:30 AM IST",
      "red_flags": [],
      "green_flags": ["Decision-maker contact", "Recent expansion", "Budget indicators"]
    }
  ],
  "total_scored": 2,
  "tokens_used": 1245
}
```

#### Chat Assistant

```
POST /api/v1/ai/chat
```

```json
{
  "message": "What are the top 3 leads I should focus on this week?",
  "lead_id": null,
  "conversation_history": []
}
```

Response is streamed via **Server-Sent Events (SSE)**.

#### Sector Intelligence Brief

```
GET /api/v1/ai/sector-brief/manufacturing
```

**Response:**

```json
{
  "sector_code": "manufacturing",
  "sector_name": "Manufacturing",
  "brief": "## Manufacturing Sector Brief\n\n### Current Trends\n...",
  "generated_at": "2026-04-07T10:30:00Z"
}
```

#### Personalise Batch

```
POST /api/v1/ai/personalise-batch
```

```json
{
  "lead_ids": ["550e8400-e29b-41d4-a716-446655440000"],
  "campaign_step_id": "660e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**

```json
{
  "emails": [
    {
      "lead_id": "550e8400-e29b-41d4-a716-446655440000",
      "subject": "How Tata Steel can cut inspection costs by 70%",
      "body": "Dear Ravi,\n\nWith Tata Steel's expansion into automotive-grade production...",
      "personalised_opening": "I was impressed by Tata Steel's Q3 results showing 12% growth in the automotive segment."
    }
  ],
  "tokens_used": 890
}
```

#### Analyse Reply

```
POST /api/v1/ai/analyse-reply
```

```json
{
  "reply_text": "Thanks for reaching out. We are currently evaluating solutions for our quality inspection line. Could you send over a case study and pricing details?",
  "lead_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**

```json
{
  "sentiment": "positive",
  "intent": "asking_for_info",
  "suggested_response": "Thank you for your interest, Ravi! I'd be happy to share our manufacturing case study...",
  "stage_recommendation": "qualified",
  "confidence": 0.92
}
```

---

## Environment Variables

All backend configuration is managed via environment variables (loaded from `backend/.env`).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgresql+asyncpg://aveonapex:aveonapex_pass@localhost:5432/aveonapex` | Async PostgreSQL connection string. Railway gives you `postgresql://...`; `core/config.py` auto-normalises to `postgresql+asyncpg://...`. |
| `SECRET_KEY` | Yes | `change-me-in-production` | JWT signing secret (use a strong random string in production) |
| `AI_PROVIDER` | No | `openrouter` | Active AI provider. `openrouter` (default) or `anthropic`. |
| `OPENROUTER_API_KEY` | Conditional | _(empty)_ | Required when `AI_PROVIDER=openrouter`. Get one at https://openrouter.ai/keys |
| `OPENROUTER_MODEL` | No | `anthropic/claude-sonnet-4` | Model slug on OpenRouter. Swap to `openai/gpt-4o`, `google/gemini-2.5-pro`, `mistralai/mistral-large`, etc. without touching code. |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenRouter API base (OpenAI-compatible). |
| `OPENROUTER_APP_NAME` | No | `AveonApex` | Sent as `X-Title` header for OpenRouter's provider routing dashboard. |
| `ANTHROPIC_API_KEY` | Conditional | _(empty)_ | Required when `AI_PROVIDER=anthropic`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `15` | JWT access token lifetime in minutes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | JWT refresh token lifetime in days |
| `SENDGRID_API_KEY` | No | _(empty)_ | SendGrid API key for transactional email |
| `SENDGRID_FROM_EMAIL` | No | `noreply@aveonapex.ai` | Sender email address for outbound emails |
| `SMTP_HOST` | No | _(empty)_ | Optional SMTP fallback host for outbound mail |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USERNAME` | No | _(empty)_ | SMTP username |
| `SMTP_PASSWORD` | No | _(empty)_ | SMTP password |
| `WA_API_KEY` | No | _(empty)_ | WhatsApp Business API key |
| `WA_PHONE_ID` | No | _(empty)_ | WhatsApp Business phone number ID |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated list of allowed CORS origins |
| `AI_MAX_TOKENS_PER_CALL` | No | `4096` | Maximum tokens per AI call (applies to any provider) |
| `AI_MONTHLY_LIMIT_STARTER` | No | `500` | Monthly AI call limit for Starter plan |
| `AI_MONTHLY_LIMIT_GROWTH` | No | `5000` | Monthly AI call limit for Growth plan |
| `AI_MONTHLY_LIMIT_ENTERPRISE` | No | `50000` | Monthly AI call limit for Enterprise plan |
| `INTEGRATIONS_ENCRYPTION_KEY` | Conditional | _(empty)_ | Fernet key (base64, 32-byte) used to encrypt stored OAuth tokens and webhook secrets. Required when the integration module is enabled. Generate with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `META_APP_ID` | No | _(empty)_ | Meta Lead Ads OAuth app id |
| `META_APP_SECRET` | No | _(empty)_ | Meta Lead Ads OAuth app secret |
| `META_WEBHOOK_VERIFY_TOKEN` | No | _(empty)_ | Static token Meta posts back during webhook subscription verification |
| `GOOGLE_ADS_CLIENT_ID` | No | _(empty)_ | Google Ads OAuth client id |
| `GOOGLE_ADS_CLIENT_SECRET` | No | _(empty)_ | Google Ads OAuth client secret |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | No | _(empty)_ | Google Ads API developer token |
| `LINKEDIN_CLIENT_ID` | No | _(empty)_ | LinkedIn Marketing Developer Platform client id |
| `LINKEDIN_CLIENT_SECRET` | No | _(empty)_ | LinkedIn Marketing Developer Platform client secret |
| `PUBLIC_BASE_URL` | No | _(empty)_ | Public URL of the backend (used as OAuth redirect host and as OpenRouter `HTTP-Referer`) |

---

## Database Schema

The full schema is defined in `schema.sql` and automatically applied on first Docker startup.

### Global Tables (No RLS)

| Table | Description |
|-------|-------------|
| `tenants` | Tenant organisations (id, name, slug, plan, settings) |
| `plans` | Subscription plans (max users, leads, AI calls, price in INR) |
| `sectors` | Industry sectors with AI personas, pain points, value props |

### Tenant-Scoped Tables (RLS Enforced)

| Table | Description |
|-------|-------------|
| `users` | Team members with email, tenant role (owner/admin/member), password hash, and the orthogonal platform-wide `is_superuser` flag |
| `leads` | Leads with company/contact info, sector, score, stage — plus admission columns (`parent_name`, `parent_phone`, `course_interested`, `board`, `stream`, `percentage_marks`, `school_name`) for student enquiries |
| `campaigns` | Email campaigns with sector targeting, status, daily limits |
| `campaign_steps` | Individual steps in a campaign sequence (subject, body, delay) |
| `outreach_log` | Email send/delivery/open/click/reply tracking per lead |
| `email_sequences` / `email_sequence_steps` / `email_sequence_enrollments` / `email_sequence_logs` | Drip-sequence engine: definitions, ordered steps, per-lead enrolment with scheduler state, and per-send delivery records |
| `ai_interactions` | Log of every AI API call (tokens, model, input/output summary). Written via an isolated session to survive StreamingResponse lifecycle + RLS. |
| `activities` | Activity log (calls, emails, meetings, notes, tasks) per lead |
| `tasks` | Standalone tasks (incl. auto-generated admission follow-ups) with assignee, priority, due date |
| `deals` / `deal_activities` | Pipeline deals (stage, INR value, probability, close date) and their activity trail |
| `pipeline_stages` | Customisable pipeline stages per tenant |
| `proposals` | AI-generated proposals per lead/deal |
| `enrichment_logs` / `linkedin_messages` / `whatsapp_messages` | Channel & enrichment activity records |
| `public_forms` / `webhook_endpoints` / `webhook_subscriptions` | Hosted lead-capture forms and outbound webhook config |
| `social_*` | Instagram/Meta DM automation (accounts, conversations, messages, templates, campaigns, consents, follow-gates) |
| `api_keys` | API keys for external integrations |
| `integrations` | Per-tenant third-party connector instances with encrypted credentials |
| `integration_events` | Audit log for connector sync events AND super-admin tenant lifecycle actions |
| `apscheduler_jobs` | APScheduler persistent job store (token refresh, delayed retries, due-step processing) |

> **Note on `tenants`:** Although the table is global (no RLS), migration 004 added `status` (`active`/`suspended`/`cancelled`), `owner_id`, `suspended_at`, `cancelled_at`, and `updated_at` columns to power the super-admin lifecycle feature. The legacy `is_active` column is kept as a compatibility mirror.

### Key Relationships

- A **tenant** has many **users**, **leads**, **campaigns**, **deals**, **pipeline stages**, and **api keys**.
- A **lead** belongs to a **sector** (via `sector_code`), can be assigned to a **user**, and can have many **activities**, **deals**, and **outreach logs**.
- A **campaign** has many **campaign steps** and **outreach logs**.
- A **deal** belongs to a **pipeline stage** and is linked to a **lead**.

---

## Plans and Pricing

| Feature | Starter (Free) | Growth | Enterprise |
|---------|----------------|--------|------------|
| **Price** | Free | Rs. 4,999/month | Rs. 14,999/month |
| **Users** | 3 | 10 | Unlimited |
| **Leads** | 1,000 | 10,000 | 100,000 |
| **AI Calls/month** | 500 | 5,000 | 50,000 |
| **CSV Import** | Up to 1,000 rows | Up to 10,000 rows | Up to 10,000 rows |
| **Email Campaigns** | 100/day | 1,000/day | 10,000/day |
| **Priority Support** | Community | Email | Dedicated |

---

## Troubleshooting

### Common Issues

**Database connection refused**
```bash
# Ensure PostgreSQL is running
docker-compose ps db
# Check logs
docker-compose logs db
```

**AI endpoints return 429 (quota exceeded)**
- Check your tenant's monthly AI call usage in the analytics dashboard.
- Upgrade your plan or wait for the monthly reset.

**Chat shows `AI service is temporarily unavailable (provider account out of credits)`**
- Your OpenRouter or Anthropic account has run out of credits. Top up the provider balance, or temporarily flip to the other provider by swapping `AI_PROVIDER` on Railway and redeploying.

**AI Usage dashboard shows 0 calls but the provider is clearly being billed**
- This was a historical bug: AI interaction logging used to share the request session, and FastAPI's dependency cleanup for `StreamingResponse` could roll back the insert. The fix lives in `services/claude_service.py::_log_interaction` — it opens an isolated `AsyncSessionLocal()`, re-applies `SET LOCAL app.current_tenant` (required by the RLS policy on `ai_interactions`), and commits immediately. If you see a regression, check the logs for `Failed to log AI interaction` entries.

**Production login returns 500**
- Hit `/health/db` on the backend host — the response includes `alembic_version` and `migration_result` captured from the startup subprocess. If `migration_result.status` is anything other than `ok`, read `output_tail` for the actual alembic traceback.

**A query 500s with `column <table>.<col> does not exist` (UndefinedColumn)**
- The ORM expects a column the database doesn't have — a migration didn't apply. The usual root cause is a **multi-statement `op.execute()`** in an earlier migration: `asyncpg` rejects it with `cannot insert multiple commands into a prepared statement`, rolling back that migration and freezing `alembic_version`, so every later migration silently never runs.
- **Immediate fix:** run the idempotent DDL directly in Railway → Postgres → Data → Query (`ALTER TABLE <t> ADD COLUMN IF NOT EXISTS <col> <type>;`), or hit `GET /health/db/repair`. **Root fix:** split the offending migration into single statements. Full runbook in [PROCESS.md §11](PROCESS.md#11-troubleshooting-runbook).

**`alembic upgrade head` fails with `DuplicateTable: apscheduler_jobs`**
- APScheduler lazily creates its job store on first boot. Migration 003 uses `CREATE TABLE IF NOT EXISTS` via raw SQL specifically to be idempotent against this race. If you see the error, you're on an older revision of 003 — pull latest.

**Register form returns 422 or white-screens after success**
- The backend expects `tenant_slug`, not `slug`, in the register payload. `RegisterPage.tsx` maps the local state correctly; if you see 422, you likely bypassed the form. The white-screen symptom was a separate bug where `TokenResponse` doesn't include the user object — `RegisterPage` now fetches `/auth/me` with the new token before calling `login()`.

**CORS errors in browser**
- Ensure `CORS_ORIGINS` in `backend/.env` includes your frontend URL.
- For local development: `CORS_ORIGINS=http://localhost:5173`

**SendGrid webhooks not working**
- Ensure your SendGrid webhook URL points to `https://your-domain.com/api/v1/webhooks/sendgrid`.
- The endpoint does not require authentication (SendGrid posts directly).

**Redis connection issues**
```bash
docker-compose ps redis
docker-compose exec redis redis-cli ping
```

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Commit your changes with clear commit messages.
4. Push to your branch and open a Pull Request.
5. Ensure all tests pass and code follows the existing style.

---

## License

**Proprietary** -- AveonApex. All rights reserved.

Unauthorized copying, modification, distribution, or use of this software is strictly prohibited without explicit written permission from AveonApex.
