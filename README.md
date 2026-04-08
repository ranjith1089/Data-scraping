# LeadForge AI

AI-powered B2B Lead Generation SaaS platform for sales teams targeting companies across 9 key Indian industry sectors. Built with Claude AI (Anthropic) as the intelligence layer.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start (Docker)](#quick-start-docker)
- [Local Development](#local-development)
- [Cloud Deployment](#cloud-deployment)
- [API Documentation](#api-documentation)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Plans and Pricing](#plans-and-pricing)
- [License](#license)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11, FastAPI 0.109, SQLAlchemy 2.0 (async with asyncpg), Alembic, Pydantic v2 |
| **Database** | PostgreSQL 15 with Row-Level Security (multi-tenant isolation) |
| **Frontend** | React 18, TypeScript, Vite, TanStack Query v5, Zustand, Tailwind CSS v3 |
| **AI** | Anthropic Claude API (`claude-sonnet-4-20250514`) via `anthropic` Python SDK |
| **Cache** | Redis 7 (session cache, sector brief cache, rate limiting) |
| **Object Storage** | MinIO (S3-compatible, for CSV imports and file attachments) |
| **Email** | SendGrid (transactional email + webhook event tracking) |
| **Auth** | JWT (access + refresh tokens), bcrypt password hashing, RBAC |
| **Deploy** | Docker Compose (PostgreSQL, Redis, MinIO, Backend, Frontend) |

---

## Features

### AI-Powered Features (Claude Integration)

All AI features are powered by Anthropic's Claude API, routed through a centralized `claude_service.py` with retry logic, quota enforcement, token tracking, and cost logging.

| # | Feature | Endpoint | Description |
|---|---------|----------|-------------|
| 1 | **Sector-Aware Email Generator** | `POST /api/v1/ai/generate-email` | Generates personalised cold outreach emails with sector-specific pain points, value propositions, and a WhatsApp-friendly version. Supports configurable tone and multi-step sequences. |
| 2 | **AI Lead Scorer** | `POST /api/v1/ai/score-leads` | Batch scores up to 50 leads (0-100) based on ICP match, contact quality, deal potential, red/green flags, and recommended next step. |
| 3 | **Sales Chat Assistant** | `POST /api/v1/ai/chat` | Conversational AI that knows your leads, campaigns, and sector intelligence. Supports SSE streaming for real-time responses. Optionally scoped to a specific lead for context-aware advice. |
| 4 | **Sector Intelligence Briefs** | `GET /api/v1/ai/sector-brief/{code}` | Fresh market analysis per sector including trends, challenges, and opportunities. Cached for 24 hours in Redis. |
| 5 | **Personalisation Engine** | `POST /api/v1/ai/personalise-batch` | Batch personalises campaign step emails for up to 50 leads with company-specific openings, subject lines, and body content. |
| 6 | **Reply Analyser** | `POST /api/v1/ai/analyse-reply` | Analyses incoming email replies for sentiment (positive/neutral/negative/out_of_office), intent (interested/not_interested/asking_for_info/wants_demo/unsubscribe/referring_someone), suggests a response, and recommends a pipeline stage change. |

### Industry Sectors (9 supported)

Each sector has a dedicated AI persona, curated pain points, and value propositions stored in the `sectors` table:

| Code | Sector |
|------|--------|
| `tech` | Technology & IT Services |
| `agriculture` | Agriculture & Allied Sectors |
| `manufacturing` | Manufacturing |
| `education` | Education |
| `marketing` | Marketing, Media & Services |
| `finance` | Finance & Professional Services |
| `construction` | Construction & Real Estate |
| `retail` | Retail & E-commerce |
| `energy` | Energy & Utilities |

### Core Platform Features

- **Multi-tenant architecture** with PostgreSQL Row-Level Security -- complete data isolation per tenant
- **JWT authentication** with short-lived access tokens (15 min) and long-lived refresh tokens (7 days)
- **Role-Based Access Control (RBAC)** with three roles: `owner`, `admin`, `member`
- **Lead management** with full-text search, filtering by sector/stage/score/city/district/company size, and pagination
- **Bulk operations** -- bulk update and bulk delete up to 500 leads at a time
- **Campaign builder** with multi-step email sequences, configurable daily send limits, and AI tone selection
- **Campaign execution** -- start, pause, execute individual steps, and track per-campaign stats (sent/opened/replied)
- **Deal pipeline** with customisable stages, drag-and-drop Kanban board, deal values in INR, and probability tracking
- **Activity logging** -- calls, emails, meetings, notes, tasks with next-action scheduling
- **Outreach tracking** -- full email lifecycle (pending/sent/delivered/opened/clicked/replied/bounced) via SendGrid webhooks
- **CSV import/export** -- import up to 10,000 leads from CSV, export filtered leads to CSV
- **Analytics dashboard** with lead counts, conversion rates, pipeline value, and AI-generated insights
- **API key management** for external integrations

---

## Architecture

### Project Structure

```
CRM/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── requirements.txt         # Python dependencies
│   ├── Dockerfile
│   ├── alembic/                 # Database migrations
│   ├── alembic.ini
│   ├── core/
│   │   ├── config.py            # Settings (Pydantic BaseSettings)
│   │   ├── dependencies.py      # DI: get_db, get_current_user, require_role
│   │   ├── security.py          # JWT creation/validation, password hashing
│   │   └── exceptions.py        # Custom exception handlers
│   ├── models/                  # SQLAlchemy ORM models
│   │   ├── tenant.py
│   │   ├── user.py
│   │   ├── lead.py
│   │   ├── campaign.py
│   │   ├── campaign_step.py
│   │   ├── outreach_log.py
│   │   ├── deal.py
│   │   ├── pipeline_stage.py
│   │   ├── activity.py
│   │   ├── ai_interaction.py
│   │   ├── api_key.py
│   │   ├── plan.py
│   │   └── sector.py
│   ├── schemas/                 # Pydantic v2 request/response schemas
│   │   ├── auth.py
│   │   ├── lead.py
│   │   ├── campaign.py
│   │   ├── pipeline.py
│   │   ├── activity.py
│   │   ├── ai.py
│   │   ├── analytics.py
│   │   ├── tenant.py
│   │   ├── user.py
│   │   ├── sector.py
│   │   └── import_export.py
│   ├── routers/                 # API route handlers
│   │   ├── auth.py
│   │   ├── tenants.py
│   │   ├── users.py
│   │   ├── leads.py
│   │   ├── campaigns.py
│   │   ├── outreach.py
│   │   ├── pipeline.py
│   │   ├── activities.py
│   │   ├── analytics.py
│   │   ├── import_export.py
│   │   ├── webhooks.py
│   │   └── ai/
│   │       ├── email_gen.py
│   │       ├── lead_scorer.py
│   │       ├── chat.py
│   │       ├── sector_brief.py
│   │       ├── personalise.py
│   │       └── reply_analyser.py
│   └── services/
│       ├── claude_service.py    # Central Anthropic API client
│       ├── analytics_service.py # Dashboard aggregation queries
│       ├── campaign_runner.py   # Campaign step execution engine
│       ├── csv_importer.py      # CSV parsing and lead creation
│       ├── email_service.py     # SendGrid integration
│       ├── sector_config.py     # Sector metadata and AI personas
│       └── whatsapp_service.py  # WhatsApp Business API integration
├── frontend/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── Dockerfile
├── schema.sql                   # Full PostgreSQL schema with RLS policies
└── docker-compose.yml           # All services: db, redis, minio, backend, frontend
```

### Multi-Tenancy

LeadForge uses PostgreSQL Row-Level Security for tenant data isolation:

1. Every tenant-scoped table includes a `tenant_id UUID NOT NULL REFERENCES tenants(id)` column.
2. RLS policies enforce `tenant_id = current_setting('app.current_tenant')::uuid` on all SELECT, INSERT, UPDATE, and DELETE operations.
3. On every database request, the backend extracts `tenant_id` from the JWT token and sets it as a PostgreSQL session variable via `SET app.current_tenant = '<uuid>'`.
4. Tables with RLS: `users`, `leads`, `campaigns`, `campaign_steps`, `outreach_log`, `ai_interactions`, `activities`, `deals`.
5. Global tables (no RLS): `tenants`, `plans`, `sectors`.

### AI Integration

All Claude API calls go through `services/claude_service.py`:

- **Automatic retry** with exponential backoff on transient failures
- **Monthly quota enforcement** per tenant plan (Starter: 500, Growth: 5,000, Enterprise: 50,000 calls/month)
- **JSON response parsing** with markdown fence-stripping for structured outputs
- **Full interaction logging** -- every AI call is recorded in `ai_interactions` with prompt/completion token counts and model info
- **SSE streaming** for the chat assistant endpoint (real-time token-by-token delivery)
- **Configurable max tokens** per call (`AI_MAX_TOKENS_PER_CALL`, default 4096)

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
- An Anthropic API key (get one at https://console.anthropic.com)
- (Optional) A SendGrid API key for email delivery

### 1. Clone and Configure

```bash
git clone https://github.com/your-org/leadforge-ai.git
cd leadforge-ai
```

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set your API keys:

```dotenv
DATABASE_URL=postgresql+asyncpg://leadforge:leadforge_pass@db:5432/leadforge
SECRET_KEY=your-secure-secret-key-change-this
ANTHROPIC_API_KEY=sk-ant-...your-key-here
SENDGRID_API_KEY=SG.your-sendgrid-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
REDIS_URL=redis://redis:6379
CORS_ORIGINS=http://localhost:5173
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
| Email | `admin@leadforge.ai` |
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
   | `ANTHROPIC_API_KEY` | Your Claude API key |
   | `CORS_ORIGINS` | `https://<your-vercel-project>.vercel.app` |
   | `SENDGRID_API_KEY` | Optional |
   | `SENDGRID_FROM_EMAIL` | `noreply@leadforge.ai` |
   | `AI_MAX_TOKENS_PER_CALL` | `4096` |
   | `AI_MONTHLY_LIMIT_STARTER` | `500` |
   | `AI_MONTHLY_LIMIT_GROWTH` | `5000` |
   | `AI_MONTHLY_LIMIT_ENTERPRISE` | `50000` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` |
   | `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |

7. In the backend service → **Settings** → **Networking** → **Generate Domain**
8. Railway runs on startup: `alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`
9. Verify: `https://<your-backend>.up.railway.app/health` should return `{"status":"ok","service":"leadforge-api"}`

> **`DATABASE_URL` auto-normalization:** Railway provides the URL as `postgresql://...`, but SQLAlchemy async needs `postgresql+asyncpg://...`. The `core/config.py` validator converts this automatically, so you don't need to transform the URL manually.

### Backup: Render.com Blueprint

A `render.yaml` blueprint is included at the repo root. To deploy to Render instead of Railway:

1. Push this repo to GitHub
2. In Render dashboard → **New** → **Blueprint**
3. Select the repo — Render reads `render.yaml` and provisions:
   - `leadforge-api` web service (FastAPI)
   - `leadforge-db` PostgreSQL
   - `leadforge-redis` Redis
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
| `DATABASE_URL` | Yes | `postgresql+asyncpg://leadforge:leadforge_pass@localhost:5432/leadforge` | Async PostgreSQL connection string |
| `SECRET_KEY` | Yes | `change-me-in-production` | JWT signing secret (use a strong random string in production) |
| `ANTHROPIC_API_KEY` | Yes | _(empty)_ | Anthropic API key for Claude (`sk-ant-...`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `15` | JWT access token lifetime in minutes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | JWT refresh token lifetime in days |
| `SENDGRID_API_KEY` | No | _(empty)_ | SendGrid API key for transactional email |
| `SENDGRID_FROM_EMAIL` | No | `noreply@leadforge.ai` | Sender email address for outbound emails |
| `WA_API_KEY` | No | _(empty)_ | WhatsApp Business API key |
| `WA_PHONE_ID` | No | _(empty)_ | WhatsApp Business phone number ID |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL |
| `CORS_ORIGINS` | No | `http://localhost:5173` | Comma-separated list of allowed CORS origins |
| `AI_MAX_TOKENS_PER_CALL` | No | `4096` | Maximum tokens per Claude API call |
| `AI_MONTHLY_LIMIT_STARTER` | No | `500` | Monthly AI call limit for Starter plan |
| `AI_MONTHLY_LIMIT_GROWTH` | No | `5000` | Monthly AI call limit for Growth plan |
| `AI_MONTHLY_LIMIT_ENTERPRISE` | No | `50000` | Monthly AI call limit for Enterprise plan |

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
| `users` | Team members with email, role (owner/admin/member), password hash |
| `leads` | B2B leads with company info, contact details, sector, score, stage |
| `campaigns` | Email campaigns with sector targeting, status, daily limits |
| `campaign_steps` | Individual steps in a campaign sequence (subject, body, delay) |
| `outreach_log` | Email send/delivery/open/click/reply tracking per lead |
| `ai_interactions` | Log of every AI API call (tokens, model, input/output summary) |
| `activities` | Activity log (calls, emails, meetings, notes, tasks) per lead |
| `deals` | Pipeline deals with stage, value (INR), probability, close date |
| `pipeline_stages` | Customisable pipeline stages per tenant |
| `api_keys` | API keys for external integrations |

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

**Proprietary** -- LeadForge AI. All rights reserved.

Unauthorized copying, modification, distribution, or use of this software is strictly prohibited without explicit written permission from LeadForge AI.
