# AveonApex Social — Phase 1 (Instagram DM Automation)

> **Status:** All 6 commits shipped on `fix/ai-usage-and-create-campaign`.
> **Critical path remaining:** Meta App Review (4–6 weeks, parallel admin task).
> **Reference plan:** `C:/Users/Ranjith/.claude/plans/act-as-a-senior-valiant-lagoon.md`

This document is the operator/handover reference for the Social module.
For the design rationale, decision log, and architecture diagrams,
read the plan file above.

---

## 1. What Phase 1 ships

A LinkPlease-class Instagram DM automation feature, **integrated into
the existing CRM** (not bolted-on). End-to-end path:

```
Follower comments "course" on a tenant's IG post
  → Meta webhook → /api/v1/webhooks/instagram
  → SocialMessage persisted (deduped on external_message_id)
  → rule_engine evaluates matching automation_rules
  → action_executor runs: send_dm, create_lead, tag_lead, …
  → Lead lands in /leads with custom_fields.instagram_handle
  → Tenant's Zapier webhook subscription receives `lead.created`
```

### What works on day-of-merge

| Capability | Status |
|---|---|
| Per-tenant Instagram OAuth (single AveonApex Meta App) | ✅ |
| Inbound webhook ingestion + signature verification | ✅ |
| Persistence: SocialAccount → SocialConversation → SocialMessage | ✅ |
| Rule engine (trigger → conditions → actions) | ✅ |
| Action handlers: send_dm, create_lead, tag_lead, apply_follow_gate, create_activity | ✅ |
| Action handlers: assign_lead, update_stage, send_email, send_whatsapp, webhook_publish | 🟡 stubbed (return `not_yet_implemented`) |
| Per-tenant outbound rate limiter (Redis sliding window, 200/hr default) | ✅ |
| Webhook dedup (24h via partial unique index + Redis hint) | ✅ |
| Cooldown per (rule, social_account) | ✅ |
| Recursion guard (rule chain depth ≤ 3) | ✅ |
| Opt-out + GDPR data-deletion endpoints | ✅ |
| APScheduler jobs: dispatch_pending_dms, fulfill_follow_gates, refresh_meta_tokens, cleanup_old_messages | ✅ |
| Rule retrigger over historical comments | 🟡 endpoint exists, walker is a stub (lands in Phase 2) |
| Frontend: Sidebar nav, Connect, Automations + RuleEditor, Conversations inbox, Campaigns, Templates, Analytics | ✅ |
| LeadDrawer Activity tab showing DM thread | ⏸ deferred (existing tab works for the linked Lead via Activity rows; rich thread is Phase 2) |
| AI auto-replies (Phase 2 hook) | ⏸ Phase 2 |
| Drag-drop visual workflow builder | ⏸ Phase 3 |

---

## 2. Commit map

```
8169dce  Schema foundation               1,497 LOC  migration 006 + 9 ORM models + 4 ALTERs + 5 schemas
195b698  Rule engine core                1,444 LOC  keyword_matcher, message_persistence, rule_engine,
                                                    action_executor, matcher unit tests
d6ae5f9  Instagram plugin + OAuth +      1,380 LOC  instagram_dm.py plugin (BaseIntegration), OAuth flow
         webhook receiver                            with state-token Redis storage, webhook_inbound.py
                                                    with X-Hub-Signature-256 verification, instagram_service
                                                    (per-tenant send_dm), rate_limiter (Redis sliding window)
f4fc6e2  CRUD routers + APScheduler      1,516 LOC  automations / conversations / templates / campaigns /
         jobs + GDPR endpoints                       analytics / posts / consents routers, 4 scheduler jobs,
                                                    main.py wiring
732b83c  Frontend                        2,150 LOC  4 hooks files, 6 pages (Connect / Automations /
                                                    Conversations / Campaigns / Templates / Analytics),
                                                    RuleEditor modal, Sidebar nav, App.tsx routes
[this]   E2E test scaffold + summary doc          backend/tests/social/test_phase1_e2e.py + this file
                                       ──────────
                                       ~8,000 LOC backend + frontend
```

---

## 3. Configuration required on deploy

Existing env vars (already present in `core/config.py`):

```
META_APP_ID                 AveonApex's Meta App id
META_APP_SECRET             AveonApex's Meta App secret (used for
                            both OAuth code exchange AND webhook
                            signature verification)
META_WEBHOOK_VERIFY_TOKEN   Random string set on the Meta App's
                            Webhooks panel; we echo hub.challenge
                            when it matches
PUBLIC_BASE_URL             Public URL of the FastAPI host (used as
                            the OAuth redirect_uri)
REDIS_URL                   Required for the OAuth state cache + the
                            outbound rate limiter (in-memory fallback
                            exists for local dev but not production)
INTEGRATIONS_ENCRYPTION_KEY Fernet key — already used by the rest of
                            the integrations module
```

Meta App Review must approve all of these scopes before live tenants
can connect:

```
instagram_basic
instagram_manage_messages
instagram_manage_comments
pages_show_list
pages_messaging
pages_read_engagement
business_management
```

Until review approves, only Test Users added on the Meta App
dashboard can complete the OAuth flow. The `ConnectPage` shows an
amber banner reminding tenants of this.

---

## 4. Operator runbook

### After deploying the branch

1. `alembic upgrade head` — applies migration 006 (additive, RLS-enabled).
2. Verify scheduler jobs registered:
   ```sql
   SELECT id, next_run_time FROM apscheduler_jobs
   WHERE id LIKE 'social_%';
   ```
   Expect 4 rows.
3. Hit `GET /api/v1/health/db` — should report `alembic_version=006`.
4. Hit `GET /api/v1/webhooks/instagram?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=ping`
   — expect plaintext `ping` back.

### Onboarding a tenant

1. Add the tenant's Meta user as a Test User on the Meta App
   dashboard (until App Review completes).
2. They click **Sidebar → Social → Connect Instagram**.
3. They redirect to Meta, approve the page, return to
   `/social?connected=instagram`.
4. Connect status flips green; they click "Build your first
   automation" → `/social/automations`.

### Watching the system

```sql
-- Recent automation firings
SELECT created_at, event_type, payload
FROM integration_events
WHERE event_type LIKE 'automation.%'
ORDER BY created_at DESC LIMIT 50;

-- Queued outbound DMs (should drain every 30s)
SELECT tenant_id, count(*)
FROM social_messages
WHERE status = 'queued' AND direction = 'outbound'
GROUP BY tenant_id;

-- Failed deliveries
SELECT tenant_id, error, count(*)
FROM social_messages
WHERE status = 'failed' AND created_at > now() - interval '1 day'
GROUP BY tenant_id, error
ORDER BY count(*) DESC;

-- Rate limiter pressure (in Redis, sorted set per tenant)
ZCARD social:dm:rate:<tenant_id>
```

### Common operator issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Webhook returns 401 on POST | `X-Hub-Signature-256` mismatch | Double-check `META_APP_SECRET` matches the Meta App's app-secret panel |
| Webhook returns 403 on GET | `hub.verify_token` mismatch | Check `META_WEBHOOK_VERIFY_TOKEN` matches the value pasted into Meta's webhook panel |
| Rule fires but DM never sent | `social_messages.status='queued'` and dispatcher hasn't picked it up | Confirm scheduler job `social_dispatch_pending_dms` is in `apscheduler_jobs`; check rate limiter via `ZCARD` |
| OAuth callback redirects to `/social?error=expired_state` | Redis stored the state but the user took >5min | They retry; raise `_OAUTH_STATE_TTL_S` in `routers/social/oauth.py` if it's a real complaint |
| OAuth callback redirects to `/social?error=no_ig_business_page` | The user's FB page isn't linked to an IG Business Account | Send them to instagram.com → Settings → Connected Accounts to link first |

---

## 5. Test plan (for the manual acceptance run)

```
[ ] Migration 006 applies cleanly on a copy of staging.
[ ] /social/connect renders in disconnected state for a fresh tenant.
[ ] Connect Instagram → OAuth round-trip → returns to /social with handle.
[ ] /social/automations → "+ New automation" → trigger=comment.received,
    keyword="course", actions=[send_dm("Hi {{name}}, link → ..."),
    create_lead, tag_lead(["instagram"])] → Save.
[ ] In Instagram (test account), comment "course" on a connected post.
[ ] Within 30s, /social/conversations shows the inbound comment +
    queued outbound DM.
[ ] Within ~60s the outbound row flips to status='sent'.
[ ] /leads shows a new lead with source='instagram' + custom_fields.
[ ] /leads → click row → Activity tab shows the timeline entries.
[ ] Tenant's Zapier subscription on lead.created received the event.
[ ] Comment "course" again from same account → social_messages shows
    inbound comment but no second outbound DM (cooldown active).
[ ] POST /social/consents/opt-out → next comment from that account
    triggers no rule firing (visible in integration_events as 'skipped').
[ ] Force 250 fake comments via /webhooks/instagram → the 201st DM
    sits in queued, doesn't go to Meta. (Optional load test.)
```

The test scaffold at `backend/tests/social/test_phase1_e2e.py` codifies
the first three checkpoints with environment-driven configuration; the
rest are manual today.

---

## 6. Phase 2 + 3 hooks (already built into Phase 1's schema)

* **Phase 2 multi-channel.** `social_accounts.platform` already
  supports `'whatsapp'` and `'facebook'`; rule engine routes on
  `platform` so a WhatsApp inbound message triggers WhatsApp rules
  exactly the same way. Just need `whatsapp_inbound_router.py` that
  upserts via `message_persistence.upsert_inbound_message` and calls
  `rule_engine.evaluate_event`.

* **Phase 2 AI auto-reply.** Add a new action type `ai_reply` to
  `action_executor.ACTION_HANDLERS` that calls
  `claude_service.generate_json` with conversation context. The
  rule engine, schemas, and audit trail need no changes.

* **Phase 3 drag-drop builder.** `automation_rules.conditions /
  actions` are already JSONB. A react-flow canvas can write the same
  JSON the form-builder writes today. Migration unnecessary.

* **Phase 3 omnichannel inbox.** `/conversations` (without `/social`
  prefix) page that UNIONs `social_conversations` + (existing
  email/WhatsApp activity). Schema-side, conversations are already
  channel-agnostic; just need the unified UI.

* **Phase 3 predictive scoring.** `Lead.lead_score` already exists.
  An APScheduler job that calls `claude_service.generate_json` over
  the first ~5 messages of any new conversation can populate it.

---

## 7. Risks + mitigations (live)

| Risk | Mitigation in code |
|---|---|
| Meta App Review delay | All UX gracefully degrades when no Integration is connected; tenant sees "Connect Instagram" CTA on every social page |
| Rule infinite loop | `rule_engine` checks `chain_depth > 3` and refuses to evaluate |
| Webhook spoofing | `verify_webhook_signature` rejects mismatched HMAC; production deploy MUST set `META_APP_SECRET` |
| Webhook backlog | Dispatcher has `max_instances=1` so two ticks don't run concurrently; queue drains at 200/hr/tenant per rate limit |
| GDPR / DPDP | `social_consents` opt-out + data-deletion endpoints + 90-day retention job |
| Token expiry mid-flight | `instagram_dm.test_connection` can be called by ops; daily refresh job stub in place |
| SSRF via webhook | `webhook_dispatcher` (existing) blocks private IPs; not a Phase 1 vector since we receive, not send |

---

## 8. Out of scope (deferred to Phase 2/3)

* Drag-drop visual workflow builder
* AI auto-reply via Claude (Phase 2)
* WhatsApp + Facebook Messenger as social platforms (Phase 2)
* Live session engagement (Phase 3)
* Predictive scoring on first-DM
* Twitter / Threads / TikTok integrations
* Pixel / conversion attribution beyond what existing `fb_pixel`
  plugin already does
