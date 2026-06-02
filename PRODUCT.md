# AveonApex — Product Spec

> Single source of truth for _what_ AveonApex is, _who_ it's for, and _why_ it exists.
> For installation, API shapes, and env vars see [README.md](./README.md).

---

## 1. Vision

Give small and mid-sized Indian B2B sales teams the same AI-powered lead generation, outreach, and pipeline tooling that enterprises spend tens of thousands of dollars a year on — for the price of a single SDR seat, and in a stack where every feature understands the Indian market out of the box.

AveonApex is not another generic CRM. It is a **sector-aware, AI-native, multi-tenant SaaS** opinionated toward the nine industry verticals that matter most to Indian B2B sellers: Technology, Agriculture, Manufacturing, Education, Marketing, Finance, Construction, Retail, and Energy.

---

## 2. Mission

Replace the manual grind of prospecting, writing cold emails, scoring leads, and drafting follow-ups with a single workspace where:

1. Every lead is automatically scored against the user's ICP.
2. Every outreach email is personalised with sector-specific pain points, not generic templates.
3. Every reply is analysed for intent so the sales rep knows the next action in under five seconds.
4. Every third-party ad campaign (Meta / Google / LinkedIn) flows leads in automatically, enriched and scored on arrival.
5. The platform operator (us) can onboard, suspend, reactivate, and observe every customer tenant from a single admin console without touching the database.

---

## 3. Target Customers

### Primary ICP

| Attribute | Value |
|---|---|
| Company type | Indian B2B SaaS, services, or product companies |
| Team size | 5 – 50 people |
| Sales team | 1 – 10 reps, typically no dedicated ops function |
| Current stack | Gmail + spreadsheets, or a legacy CRM they don't really use |
| Pain | Spends more time writing emails than talking to prospects; lead quality is unknown until a rep burns a week on one |
| Budget | ₹5,000 – ₹15,000 / month is the "yes without a finance conversation" band |

### Secondary ICP

- Marketing agencies running outbound for multiple clients (each client becomes a sub-tenant in a future roadmap phase).
- Education institutes and ed-tech startups selling B2B to schools / colleges.
- Manufacturing and industrial suppliers whose buyers cluster around specific districts / cities.

### Non-ICP (explicitly out of scope)

- US / European enterprises. Every AI prompt, sector persona, and pricing tier is calibrated for the Indian market.
- B2C or D2C brands — AveonApex is B2B only.
- Teams that need highly custom object models (we have opinions on what a "lead" and a "deal" look like).

---

## 4. Core Value Proposition

> "The CRM that writes your outreach, scores your pipeline, and knows your sector."

Three value pillars:

1. **Sector intelligence baked in.** Every AI call is grounded in a curated persona and pain-point library for the lead's sector. A construction company lead is not pitched the same way as a SaaS lead — AveonApex knows this without any prompt engineering from the user.

2. **Provider-agnostic AI that never goes dark.** We learned the hard way that a single direct Anthropic key is a single point of failure — one credit exhaustion and every chat in production returns a raw error. The platform now defaults to OpenRouter, which routes to dozens of models behind one key and one balance. Swap between Claude, GPT, Gemini, or Mistral with a single env var.

3. **Multi-tenant from day one, with a platform operator console.** Every table is tenant-scoped, every RLS policy is enforced at the database, and every admin action is audit-logged. A super-admin (us) can onboard a new customer, assign their initial owner, suspend them for non-payment, or reactivate them — all from `/admin/tenants`, no psql required.

---

## 5. Feature Overview

> Full technical detail and endpoint shapes live in [README.md](./README.md). This section is the "what" — not the "how".

### 5.1 AI-powered sales assistant

- **Email generator** — sector-aware cold outreach with a WhatsApp-friendly variant.
- **Lead scorer** — batch scores 0–100 with ICP match, red flags, green flags, and recommended next step.
- **Chat assistant** — conversational AI that knows your leads, campaigns, and pipeline. SSE streaming.
- **Sector brief** — fresh market analysis per sector, cached 24h.
- **Personalisation engine** — batch personalises campaign step emails for up to 50 leads at a time.
- **Reply analyser** — classifies incoming replies (sentiment, intent, suggested response, stage change).

### 5.2 Lead and pipeline management

- Full-text lead search + filters (sector, stage, score, city, district, company size).
- URL-driven pagination with 20 / 50 / 100 rows-per-page selector.
- Bulk update and bulk delete up to 500 leads at a time.
- Customisable deal pipeline with drag-and-drop Kanban, INR values, probability tracking.
- Activity log (calls, emails, meetings, notes, tasks) with next-action scheduling.
- CSV import (up to 10,000 rows) and filtered CSV export.

### 5.3 Campaign execution

- Multi-step email sequences with configurable daily send limits and AI tone selection.
- SendGrid webhook integration for full lifecycle tracking (delivered / opened / clicked / replied / bounced).
- Per-campaign stats dashboard.

### 5.4 Third-party integration module

- OAuth 2.0 connectors for **Meta Lead Ads**, **Google Ads**, **LinkedIn Lead Gen Forms**.
- Fernet-encrypted credential storage, automatic token refresh via APScheduler.
- Webhook-driven lead ingestion — leads from ad platforms flow in, get scored, and land in the pipeline automatically.
- Full audit trail in `integration_events` (retry queue, dead-letter tracking).

### 5.5 Super-admin platform console

- Gated by `users.is_superuser` flag (orthogonal to tenant-scoped RBAC).
- Full tenant CRUD: list, create, edit, assign owner.
- Lifecycle transitions: `active` → `suspended` → `reactivated` / `cancelled` (soft delete only, never hard delete).
- Per-tenant stats (users, leads, campaigns, integrations, last activity).
- Login block: suspended / cancelled tenants are rejected at `POST /auth/login` with a friendly error; super-admins are exempt so the platform operator can always recover.
- Self-protection: a super-admin cannot suspend, cancel, or demote the tenant they themselves belong to.
- All actions audit-logged via the shared `integration_events` table.

### 5.6 Analytics and observability

- Dashboard with lead counts, conversion rates, pipeline value, AI-generated insights.
- Per-tenant AI usage tracking — call count, token spend, model mix.
- `GET /health/db` exposes startup migration output so production alembic failures are observable without shelling into the container.

---

## 6. Architecture Principles

These are the rules the codebase has earned the hard way. They are not aspirational — they are enforced.

1. **Every tenant-scoped table has RLS.** Isolation is enforced at the database, not in the ORM. A bug in a router query cannot leak another tenant's data, because the database refuses to return it.

2. **AI provider is a runtime configuration, not a code concern.** The `claude_service.py` facade exposes `generate` / `generate_json` / `generate_stream`. Routers never know which provider is active. Swapping providers is a single env var flip, zero code changes.

3. **User-facing AI errors are always friendly.** Credit exhaustion, rate limits, and auth failures are rewritten to safe strings at the service boundary. Raw stack traces never reach the chat bubble.

4. **Logging is isolated from request lifecycle.** AI interaction logging opens its own `AsyncSessionLocal()` to survive FastAPI `StreamingResponse` cleanup and RLS constraints. If the stream fails, the log still lands; if the log fails, the stream still succeeds.

5. **Migrations are blocking and observable.** The FastAPI lifespan runs alembic synchronously and captures subprocess output into a module-level dict exposed via `/health/db`. Production migration failures are debuggable from a curl.

6. **Migrations are idempotent against external state.** APScheduler lazily creates its job store; migration 003 uses `CREATE TABLE IF NOT EXISTS` via raw SQL to be safe against race conditions with the scheduler's first boot.

7. **Soft delete by default.** There is no hard-delete endpoint for tenants. Cancellation sets a status and stamps a timestamp. Data recovery always wins over storage savings.

8. **Audit everything the platform operator does.** Super-admin actions and integration syncs both write to `integration_events` — one audit table, not two.

9. **The frontend is URL-driven.** Pagination, filters, search, sort order all live in query params. Refreshing the page or sharing a link Just Works.

10. **Additive over rewrite.** Features are shipped as new files + narrow edits. No mass refactors. The super-admin module, the integration module, and the provider-agnostic AI layer all landed without rewriting a single existing router.

---

## 7. Plans and Pricing

| Feature | Starter (Free) | Growth | Enterprise |
|---|---|---|---|
| **Price** | Free | ₹4,999 / month | ₹14,999 / month |
| **Users** | 3 | 10 | Unlimited |
| **Leads** | 1,000 | 10,000 | 100,000 |
| **AI Calls / month** | 500 | 5,000 | 50,000 |
| **CSV Import** | 1,000 rows | 10,000 rows | 10,000 rows |
| **Email Campaigns** | 100 / day | 1,000 / day | 10,000 / day |
| **Integrations** | 1 connector | 3 connectors | Unlimited |
| **Priority Support** | Community | Email | Dedicated |

---

## 8. Roadmap

### Shipped

- ✅ Multi-tenant core with RLS
- ✅ Nine sector personas with AI-grounded prompts
- ✅ All six AI features (email gen, scorer, chat, sector brief, personalise batch, reply analyser)
- ✅ Deal pipeline and activity log
- ✅ CSV import/export
- ✅ SendGrid webhook integration
- ✅ Provider-agnostic AI layer (OpenRouter default, Anthropic fallback)
- ✅ Super-admin tenant management console
- ✅ Third-party integration module (Meta / Google / LinkedIn)
- ✅ APScheduler-backed delayed follow-ups and token refresh
- ✅ Production observability via `/health/db` migration capture

### Next up (Q2 2026)

- **WhatsApp Business API outreach** — treat WA as a first-class channel alongside email.
- **Sub-tenants for agencies** — let a marketing agency manage multiple client workspaces from one login.
- **Lead enrichment pipeline** — automatic company size, revenue, and tech stack enrichment on lead creation.
- **Custom fields at the schema level** — admin UI to add new columns to the `leads` table per tenant.
- **Team performance dashboards** — per-rep activity, pipeline, and conversion metrics.

### Later (H2 2026)

- **Voice AI for call summaries** — upload a call recording, get a structured activity log entry.
- **Meeting scheduler with two-way calendar sync** — Google Calendar + Outlook.
- **Multi-language AI personas** — Hindi, Tamil, Telugu, Bengali, Marathi outreach variants.
- **Public API + Zapier/Make integration** — expose lead / deal / activity CRUD for third-party automation.
- **SSO (Google Workspace, Microsoft Entra)** for enterprise customers.

### Not on the roadmap (and why)

- **Generic drag-and-drop form builder** — AveonApex is opinionated about what a lead looks like. Custom fields, yes. Arbitrary forms, no.
- **Gamification / leaderboards** — proven to fatigue sales teams faster than it motivates them.
- **A BI layer** — we ship the handful of dashboards sales teams actually use. For deeper analysis, export to CSV and point your BI tool at it.

---

## 9. Success Metrics

How we know AveonApex is working.

### Product metrics (per tenant)

| Metric | Target | Why |
|---|---|---|
| **AI call adoption rate** | > 60% of active users make at least one AI call per week | If reps aren't using the AI, we're just an expensive spreadsheet. |
| **Lead scoring coverage** | > 80% of leads scored within 24h of creation | An unscored lead is a lead a rep will waste time on. |
| **Reply-to-meeting conversion uplift** | +30% vs the tenant's pre-AveonApex baseline | The whole point of the reply analyser. |
| **Integration sync success rate** | > 99% over rolling 7 days | Broken integrations silently erode trust. |
| **AI Usage dashboard accuracy** | Logged calls == provider-billed calls, ±1% | Historical bug: dashboard stuck at 0 while providers were being billed. Never again. |

### Platform metrics (across all tenants)

| Metric | Target |
|---|---|
| **API 5xx rate** | < 0.1% over rolling 24h |
| **Login success rate (valid creds)** | > 99.9% |
| **Migration success rate on deploy** | 100% — any failure is a P0, and `/health/db` makes it visible within seconds |
| **Provider outage tolerance** | Chat feature degrades to a friendly error, never a raw stack trace. Swap to a fallback provider completes in < 5 minutes. |
| **Super-admin action audit completeness** | 100% — every create / update / suspend / reactivate / cancel lands in `integration_events` |

### Business metrics

| Metric | Target |
|---|---|
| **Time-to-first-value** | New tenant creates their first AI-generated email within 10 minutes of signup |
| **Starter → Growth conversion** | > 15% within 60 days |
| **Monthly churn** (Growth + Enterprise) | < 3% |
| **NPS** | > 40 |

---

## 10. Glossary

| Term | Definition |
|---|---|
| **Tenant** | A customer organisation. Every business table is scoped to a tenant. |
| **Owner** | The tenant-scoped role with full permissions inside a tenant. Every tenant has at least one. |
| **Super-admin** | A platform-wide role (`users.is_superuser = true`) with cross-tenant access via `/admin/tenants`. Orthogonal to the tenant-scoped owner/admin/member role. |
| **Sector** | One of nine curated industry verticals. Each has its own AI persona, pain points, and value props. |
| **Connector** | A plug-in module for a third-party ad platform (Meta / Google / LinkedIn). Implements OAuth, webhook, and lead fetch. |
| **Interaction** | A single AI call. Logged in `ai_interactions` with tokens and model. |
| **Audit event** | A row in `integration_events`. Reused by both the integration module and the super-admin module. |
| **RLS** | PostgreSQL Row-Level Security. The database-level enforcement that makes multi-tenancy safe. |

---

## 11. License

**Proprietary** — AveonApex. All rights reserved.

Unauthorised copying, modification, distribution, or use of this software is strictly prohibited without explicit written permission from AveonApex.
