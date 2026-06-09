# AveonApex — Engineering Process & Runbook

How we build, migrate, and ship AveonApex. This is the operational companion to
[README.md](./README.md) (what the system is) and [PRODUCT.md](./PRODUCT.md)
(what we're building and why). Everything here is a convention the codebase has
earned — most rules exist because breaking them caused a production incident.

---

## Table of Contents

- [1. Repository & Branching](#1-repository--branching)
- [2. Commit & PR Conventions](#2-commit--pr-conventions)
- [3. Local Development](#3-local-development)
- [4. Database Migrations](#4-database-migrations) ← **read before writing any migration**
- [5. Deployment](#5-deployment)
- [6. Environment Variables](#6-environment-variables)
- [7. Adding a New Sector](#7-adding-a-new-sector)
- [8. Adding an Admission/Vertical Feature](#8-adding-an-admissionvertical-feature)
- [9. Testing](#9-testing)
- [10. Observability & Health](#10-observability--health)
- [11. Troubleshooting Runbook](#11-troubleshooting-runbook)

---

## 1. Repository & Branching

- **Remote:** `https://github.com/ranjith1089/Data-scraping.git`
- **Default branch:** `main` — this is what Railway (backend) and Vercel (frontend) auto-deploy from. A push to `main` ships to production.
- **Feature branches:** branch off `main` (`feat/...`, `fix/...`), open a PR, merge back. For small fixes during an active incident we commit to `main` directly — but only when the change is verified and minimal.
- **Sync before push:** the remote often moves under you (PR merges, bot commits). Always:
  ```bash
  git pull origin main --rebase && git push origin main
  ```
  A rejected push (`fetch first`) means rebase, don't force.

---

## 2. Commit & PR Conventions

- **Format:** `type: short imperative summary` (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`). Body explains *why* and references the symptom it fixes.
- **Always end commit messages with:**
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- **One logical change per commit.** Migrations, the ORM model change that depends on them, and the router that uses them can ship together — but unrelated fixes get their own commits.
- **Never** `--no-verify`, never force-push shared branches, never skip signing.

---

## 3. Local Development

Full setup lives in the README ([Quick Start](./README.md#quick-start-docker) /
[Local Development](./README.md#local-development)). The short version:

```bash
# Everything via Docker (db, redis, minio, backend, frontend)
docker compose up

# Or run pieces directly:
cd backend && uvicorn main:app --reload          # needs a local Postgres + .env
cd frontend && npm run dev                         # VITE_API_URL=http://localhost:8000/api/v1
```

- Backend `.env` lives in `backend/.env` (see `backend/.env.example`). The local `DATABASE_URL` points at a **local** Postgres — it is *not* the production database. There is no direct local connection to the Railway DB.
- Migrations run automatically when the backend boots (see §4). To run them by hand: `cd backend && python -m alembic upgrade head`.

---

## 4. Database Migrations

> ⚠️ **This is the most incident-prone area of the codebase. Read all of it.**

### How migrations run

`main.py`'s FastAPI lifespan runs `alembic upgrade head` as a subprocess
**synchronously at startup, before serving traffic**, and captures the output
into a module-level dict surfaced at `GET /health/db`. After alembic, a second
function `_ensure_schema()` runs an idempotent DDL safety-net (see below).

### The rules (each one is a scar)

1. **One SQL statement per `op.execute()`.** The async driver (`asyncpg`)
   rejects multi-statement strings with
   `cannot insert multiple commands into a prepared statement`. This is fatal:
   it aborts the migration's transaction, so the *entire* migration rolls back
   and `alembic_version` never advances — silently freezing the schema and
   blocking every later migration.
   ```python
   # ❌ WRONG — two statements in one execute()
   op.execute("ALTER TABLE x ENABLE ROW LEVEL SECURITY; CREATE POLICY ...;")

   # ✅ RIGHT — split them
   op.execute("ALTER TABLE x ENABLE ROW LEVEL SECURITY")
   op.execute("CREATE POLICY ... ON x USING (...)")
   ```

2. **Prefer idempotent DDL.** Use `ADD COLUMN IF NOT EXISTS`,
   `CREATE TABLE IF NOT EXISTS`, `DROP ... IF EXISTS`, and
   `ON CONFLICT DO NOTHING` for seeds. A migration that can safely re-run
   survives partial-apply states and the safety-net re-running it.

3. **Use `op.execute(sa.text(...))`, not `op.get_bind()`.** `get_bind()` is
   deprecated in Alembic 1.13 and behaves unreliably inside the async
   `run_sync` context. `op.execute()` is the portable path.

4. **Sequential revision IDs.** Files are `NNN_description.py` with
   `revision = "NNN"` / `down_revision = "NNN-1"`. Never branch the chain.
   Current head: **019**. Next migration is `020`.

5. **The startup safety-net (`_ensure_schema` in `main.py`).** For
   business-critical columns, the safety-net force-applies
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` via a raw `engine.begin()`
   connection — *each column in its own transaction* — after alembic runs. This
   guarantees the app's required columns exist even if the alembic chain is
   stuck. When you add a must-have column, add it to both the migration **and**
   the safety-net list.

### Writing a migration — checklist

- [ ] File named `0NN_thing.py`, `down_revision` points at the current head.
- [ ] Every `op.execute()` is a single statement.
- [ ] DDL is idempotent where practical.
- [ ] `python -m py_compile backend/alembic/versions/0NN_thing.py` passes.
- [ ] If it adds a column the ORM/UI hard-depends on, also add it to
      `_ensure_schema()`.
- [ ] Tested against a real Postgres locally (`alembic upgrade head`).

---

## 5. Deployment

| Target | Platform | Trigger | Notes |
|--------|----------|---------|-------|
| **Backend** | Railway | Auto-deploy on push to `main` | Root dir = `backend/`. Builds the Dockerfile, runs migrations at startup. |
| **Backend (backup)** | Render.com | `render.yaml` blueprint | Fallback only. |
| **Frontend** | Vercel | Auto-deploy on push to `main` | Vite build; `VITE_API_URL` points at the Railway API. |
| **Database** | Railway Postgres | — | Async (`postgresql+asyncpg://…`). Schema managed by alembic + safety-net. |

- A build can take a few minutes. If a fresh deploy hasn't taken effect, the
  old container keeps serving — confirm via `/health/db` (`migration_result`
  and `alembic_version`) rather than guessing.
- **Direct DB access:** Railway → Postgres service → **Data → Query** runs raw
  SQL. This is the escape hatch when alembic/app-level fixes are blocked (see
  §11).

---

## 6. Environment Variables

Full reference in the README ([Environment Variables](./README.md#environment-variables)).
The ones most often missed:

| Variable | Where | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | backend | `postgresql+asyncpg://…` — normalised in `core/config.py` |
| `SECRET_KEY` | backend | JWT signing (≥32 bytes) |
| `AI_PROVIDER` + `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` | backend | AI facade provider |
| `INTEGRATIONS_ENCRYPTION_KEY` | backend | Fernet key for connector credentials |
| `META_WEBHOOK_VERIFY_TOKEN` | backend | Verifies the Meta Lead Ads webhook GET handshake |
| `META_APP_SECRET` | backend | Validates Meta `leadgen` POST signatures |
| `SENDGRID_API_KEY` / `WA_*` | backend | Email + WhatsApp channels |
| `VITE_API_URL` | frontend | API base, e.g. `https://<app>.up.railway.app/api/v1` |

---

## 7. Adding a New Sector

Sectors are defined in **two** places that must stay in sync:

1. **Backend** — seed the `sectors` row in a new migration (`code`, `name`,
   `icon`, `description`, `ai_persona`, `pain_points`, `value_props`). Use
   `INSERT … ON CONFLICT (code) DO NOTHING`. See migration 016 for the pattern.
2. **Frontend** — add the `code: 'Label'` entry to `SECTOR_NAMES` in
   `frontend/src/lib/utils.ts`.

If the sector is admission-oriented, also extend `isAdmissionSector()` and
`getAdmissionKind()` in `utils.ts` and the backend `_ADMISSION_SECTORS` set.

---

## 8. Adding an Admission/Vertical Feature

The admission CRM is built on a single branching helper, not a forked app:

- **Frontend:** `isAdmissionSector(sector_code)` toggles admission UI;
  `getAdmissionKind(code)` returns `'college' | 'school' | null` for
  level-appropriate labels/options (`SCHOOL_CLASS_OPTIONS` vs
  `ADMISSION_COURSES`, `ADMISSION_STAGE_LABELS`, `ADMISSION_SOURCE_OPTIONS`).
- **Backend:** `_ADMISSION_SECTORS = {"college", "education"}` gates auto-task
  creation, the student public-form template, and Meta-lead mapping.

To extend the vertical, reuse these switches rather than adding a parallel
code path. New student columns go on the `leads` table (migration + safety-net).

---

## 9. Testing

```bash
cd backend && pytest                    # backend tests (tests/, tests/social/)
cd frontend && npx tsc --noEmit         # type-check (must be clean before push)
cd frontend && npm test                 # frontend tests
```

- **Always** type-check the frontend before pushing — a `tsc` error breaks the
  Vercel build.
- **Always** `py_compile` new/edited migrations and `main.py` before pushing —
  a syntax error there breaks the backend boot and migrations never run.

---

## 10. Observability & Health

| Endpoint | Auth | Use |
|----------|------|-----|
| `GET /health` | none | Liveness (`{"status":"ok"}`) |
| `GET /health/db` | none | Current `alembic_version`, captured migration stdout/stderr, and presence checks for key columns (incl. `leads.*` admission columns) |
| `GET /health/db/repair` | none | Idempotently force-adds the admission columns and returns per-column JSON — on-demand schema repair independent of alembic/deploy state |

When a deploy "doesn't seem to work," hit `/health/db` first. It tells you the
real schema state and the actual alembic error, which Railway's 500-logs/sec
rate limiter often drops from the deploy log.

---

## 11. Troubleshooting Runbook

### `column leads.<x> does not exist` (or any UndefinedColumn) — *the parent_name incident*

**Symptom:** Leads page (or any query) 500s with
`asyncpg.exceptions.UndefinedColumnError`. The ORM model has a column the
database doesn't.

**Root cause (real example):** A multi-statement `op.execute()` in migration
013 failed with `cannot insert multiple commands into a prepared statement`,
rolling back the migration and **freezing `alembic_version` at 012**. Every
later migration (013–019), including the one adding `parent_name`, silently
never ran — even though the code deployed.

**Fix, in order of preference:**
1. **Immediate unblock (always works):** run the idempotent DDL directly in
   Railway → Postgres → Data → Query:
   ```sql
   ALTER TABLE leads ADD COLUMN IF NOT EXISTS parent_name VARCHAR;
   -- … one statement per required column …
   ```
   (`ALTER TABLE` returns no rows — "Query returned no rows" is success.)
   Or hit `GET /health/db/repair`.
2. **Root fix:** split the offending multi-statement migration into single
   statements (§4 rule 1), make it idempotent, and ensure required columns are
   in `_ensure_schema()`. Push to `main`.

### A push doesn't seem to deploy

- Confirm Railway/Vercel auto-deploy is on `main` and the build finished.
- Check `/health/db` `migration_result` — a failed migration leaves the old
  container serving. The `alembic_version` tells you how far it actually got.

### Migration runs but a later one is skipped

- Almost always a multi-statement `op.execute()` earlier in the chain. Grep the
  migrations for `;` inside `op.execute("""…""")` blocks and split them.

### AI calls return raw credit/rate-limit errors to users

- Should be impossible — `claude_service.py` rewrites these to friendly
  strings. If one leaks, add the case to the service's error translation, not
  to the router.
