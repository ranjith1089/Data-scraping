"""Action handlers for the social rule engine.

Each entry in ``ACTION_HANDLERS`` is a coroutine that takes the rule
context, mutates the database / fires an outbound effect, and returns
a small dict describing what happened. Handlers are intentionally
narrow — anything bigger than ~30 lines is delegated to a service
module so this file stays readable as the action vocabulary grows.

Action handlers MUST NOT raise on per-action errors; the rule engine
catches those, but a handler is the right place to translate a vendor
error into a structured ``{"ok": False, "error": "..."}`` so the
audit trail is useful.

Action types currently supported (mirrors
``schemas/social/automation.SocialActionType``):

    send_dm                    — outbound platform DM
    send_dm_with_quick_replies — same + IG quick-reply chips
    create_lead                — promote sender to a Lead row
    tag_lead                   — append tags to an existing Lead
    assign_lead                — round-robin / load-balanced assignment
    update_stage               — push a Lead to a new pipeline stage
    apply_follow_gate          — gate the link behind a follow
    wait_for_event             — pause N minutes via APScheduler
    create_activity            — log an Activity timeline entry
    send_email                 — outbound email via per-tenant SendGrid
    send_whatsapp              — outbound WA via per-tenant integration
    webhook_publish            — fan-out to tenant webhook subscriptions

The ``send_dm`` handler ships in this commit; the rest are
deliberately stubbed with structured "not_yet_implemented" returns so
the engine can be wired end-to-end and Commits 3–6 can swap in the
real implementations one at a time without changing the engine.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Awaitable, Callable, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from models.activity import Activity
from models.automation_rule import AutomationRule
from models.lead import Lead
from models.social.social_account import SocialAccount
from models.social.social_conversation import SocialConversation
from models.social.social_follow_gate import SocialFollowGate

from . import message_persistence as mp

logger = logging.getLogger(__name__)


ActionHandler = Callable[..., Awaitable[dict[str, Any]]]


def _render(template: str | None, ctx: dict[str, Any]) -> str:
    """Cheap ``{{key}}`` substitution. Keeps placeholders intact when
    a key is missing rather than blowing up.

    Supports flat keys and one level of dot-access via the same
    keyword_matcher.get_path helper.
    """
    if not template:
        return ""
    from .keyword_matcher import get_path

    out: list[str] = []
    i = 0
    while i < len(template):
        if template[i : i + 2] == "{{":
            close = template.find("}}", i + 2)
            if close == -1:
                out.append(template[i:])
                break
            key = template[i + 2 : close].strip()
            value = get_path(ctx, key)
            out.append(str(value) if value is not None else "{{" + key + "}}")
            i = close + 2
        else:
            out.append(template[i])
            i += 1
    return "".join(out)


# ---------------------------------------------------------------------
# Individual handlers
# ---------------------------------------------------------------------

async def _send_dm(
    *,
    db: AsyncSession,
    tenant_id: UUID,
    rule: AutomationRule,
    config: dict[str, Any],
    event_payload: dict[str, Any],
    social_account_id: Optional[UUID],
    **_: Any,
) -> dict[str, Any]:
    """Queue an outbound DM. The actual send hits Meta in
    ``services/social/instagram_service.py`` (Commit 3) — until that
    lands we persist the outbound message with status='queued' so the
    full conversation timeline still works."""
    if not social_account_id:
        return {"action": "send_dm", "ok": False, "error": "no social_account_id"}

    # Resolve template — either inline content or a templates row id.
    body = config.get("content") or ""
    template_id = config.get("template_id")
    if template_id and not body:
        from sqlalchemy import select

        from models.social.social_message_template import SocialMessageTemplate

        result = await db.execute(
            select(SocialMessageTemplate).where(
                SocialMessageTemplate.id == template_id,
                SocialMessageTemplate.tenant_id == tenant_id,
            )
        )
        tmpl = result.scalar_one_or_none()
        if tmpl:
            body = tmpl.content

    rendered = _render(body, event_payload)

    # Look up the conversation (it must exist; webhook receiver upserted
    # it before evaluating this rule).
    from sqlalchemy import select

    convo_q = await db.execute(
        select(SocialConversation).where(
            SocialConversation.tenant_id == tenant_id,
            SocialConversation.social_account_id == social_account_id,
        )
    )
    convo = convo_q.scalar_one_or_none()
    if not convo:
        return {"action": "send_dm", "ok": False, "error": "conversation missing"}

    msg, _dup = await mp.append_message(
        db=db,
        tenant_id=tenant_id,
        conversation=convo,
        direction="outbound",
        source="dm",
        content=rendered,
        rule_id=rule.id,
        sent_at=None,  # set when Commit 3's instagram_service confirms send
        status="queued",
    )
    return {
        "action": "send_dm",
        "ok": True,
        "message_id": str(msg.id) if msg else None,
        "queued": True,
    }


async def _create_lead(
    *,
    db: AsyncSession,
    tenant_id: UUID,
    rule: AutomationRule,
    config: dict[str, Any],
    event_payload: dict[str, Any],
    social_account_id: Optional[UUID],
    **_: Any,
) -> dict[str, Any]:
    """Promote the social_account to a Lead row.

    Idempotent: if the social_account already has ``lead_id`` set, we
    update tags/source on the existing lead rather than creating a
    duplicate.
    """
    if not social_account_id:
        return {"action": "create_lead", "ok": False, "error": "no social_account_id"}

    from sqlalchemy import select

    acct_q = await db.execute(
        select(SocialAccount).where(SocialAccount.id == social_account_id)
    )
    account = acct_q.scalar_one_or_none()
    if not account:
        return {"action": "create_lead", "ok": False, "error": "account missing"}

    sector_code = config.get("sector_code") or "education"
    new_tags = list(config.get("tags") or ["instagram", "social-dm"])
    source = config.get("source") or "instagram"

    if account.lead_id:
        # Lead exists; merge new tags + leave the rest alone.
        lead_q = await db.execute(select(Lead).where(Lead.id == account.lead_id))
        lead = lead_q.scalar_one_or_none()
        if lead:
            existing_tags = list(lead.tags or [])
            for t in new_tags:
                if t not in existing_tags:
                    existing_tags.append(t)
            lead.tags = existing_tags
            return {
                "action": "create_lead",
                "ok": True,
                "lead_id": str(lead.id),
                "merged": True,
            }

    # Build a fresh lead.
    company_name = (
        account.display_name
        or account.handle
        or f"Instagram user {account.external_user_id}"
    )[:200]
    custom = {
        "instagram_handle": account.handle,
        "instagram_user_id": account.external_user_id,
        "source_platform": account.platform,
    }
    if event_payload.get("post_id"):
        custom["source_post_id"] = event_payload["post_id"]
    if event_payload.get("comment_text"):
        custom["source_comment_text"] = event_payload["comment_text"]

    lead = Lead(
        tenant_id=tenant_id,
        sector_code=sector_code,
        company_name=company_name,
        contact_name=account.display_name or account.handle,
        source=source,
        tags=new_tags,
        custom_fields=custom,
        state="Tamil Nadu",
    )
    db.add(lead)
    await db.flush()

    # Link the social_account back to its lead.
    account.lead_id = lead.id

    # Fire the existing lead.created webhook fan-out so Zapier subscribers
    # get the same event regardless of source.
    try:
        from services.webhook_dispatcher import publish_event
        from schemas.lead import LeadResponse

        await publish_event(
            db,
            tenant_id,
            "lead.created",
            LeadResponse.model_validate(lead).model_dump(mode="json"),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("publish_event(lead.created) from social rule failed: %s", exc)

    return {"action": "create_lead", "ok": True, "lead_id": str(lead.id)}


async def _tag_lead(
    *,
    db: AsyncSession,
    tenant_id: UUID,
    config: dict[str, Any],
    social_account_id: Optional[UUID],
    **_: Any,
) -> dict[str, Any]:
    if not social_account_id:
        return {"action": "tag_lead", "ok": False, "error": "no social_account_id"}
    from sqlalchemy import select

    acct_q = await db.execute(
        select(SocialAccount).where(SocialAccount.id == social_account_id)
    )
    account = acct_q.scalar_one_or_none()
    if not account or not account.lead_id:
        return {"action": "tag_lead", "ok": False, "error": "no linked lead"}
    lead_q = await db.execute(select(Lead).where(Lead.id == account.lead_id))
    lead = lead_q.scalar_one_or_none()
    if not lead:
        return {"action": "tag_lead", "ok": False, "error": "lead missing"}
    add = list(config.get("tags") or [])
    existing = list(lead.tags or [])
    for t in add:
        if t not in existing:
            existing.append(t)
    lead.tags = existing
    return {"action": "tag_lead", "ok": True, "tags": existing}


async def _create_activity(
    *,
    db: AsyncSession,
    tenant_id: UUID,
    config: dict[str, Any],
    social_account_id: Optional[UUID],
    event_payload: dict[str, Any],
    **_: Any,
) -> dict[str, Any]:
    """Log to the existing Activity timeline. The drawer's Activity tab
    already renders these for the linked Lead."""
    if not social_account_id:
        return {"action": "create_activity", "ok": False, "error": "no account"}
    from sqlalchemy import select

    acct_q = await db.execute(
        select(SocialAccount).where(SocialAccount.id == social_account_id)
    )
    account = acct_q.scalar_one_or_none()
    if not account or not account.lead_id:
        # Activity in this codebase is lead-scoped; if there's no lead
        # yet, fall through silently — the social_messages timeline
        # already captures the conversation.
        return {"action": "create_activity", "ok": True, "skipped": "no lead"}

    activity_type = config.get("type") or "instagram_event"
    note = _render(config.get("note") or "", event_payload)

    db.add(
        Activity(
            tenant_id=tenant_id,
            lead_id=account.lead_id,
            type=activity_type,
            note=note[:2000] if note else None,
            outcome=config.get("outcome"),
        )
    )
    return {"action": "create_activity", "ok": True}


async def _apply_follow_gate(
    *,
    db: AsyncSession,
    tenant_id: UUID,
    rule: AutomationRule,
    config: dict[str, Any],
    social_account_id: Optional[UUID],
    event_payload: dict[str, Any],
    **_: Any,
) -> dict[str, Any]:
    """Create a pending follow-gate row + send the prompt DM now.

    The deferred follow-up DM gets sent by ``social.fulfill_follow_gates``
    APScheduler job in Commit 4 once Meta confirms the follow.
    """
    if not social_account_id:
        return {"action": "apply_follow_gate", "ok": False, "error": "no account"}

    timeout_h = int(config.get("timeout_hours") or 24)
    deferred_msg = _render(config.get("message_if_following") or "", event_payload)
    prompt_msg = _render(config.get("message_if_not_following") or "", event_payload)

    # Persist the gate. Commit 3's instagram_service will check follow
    # status when it tries to dispatch the queued DM and either send the
    # prompt or send the deferred message immediately.
    db.add(
        SocialFollowGate(
            tenant_id=tenant_id,
            social_account_id=social_account_id,
            rule_id=rule.id,
            message_to_send=deferred_msg,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=timeout_h),
        )
    )

    # Send the prompt DM right now — same path as send_dm.
    if prompt_msg:
        await _send_dm(
            db=db,
            tenant_id=tenant_id,
            rule=rule,
            config={"content": prompt_msg},
            event_payload=event_payload,
            social_account_id=social_account_id,
        )
    return {
        "action": "apply_follow_gate",
        "ok": True,
        "expires_in_hours": timeout_h,
    }


async def _stub(action_type: str) -> ActionHandler:
    async def _impl(**kwargs: Any) -> dict[str, Any]:
        return {
            "action": action_type,
            "ok": False,
            "error": "not_yet_implemented",
            "phase": "Phase 1 stub — wired in Commit 3+",
        }

    return _impl


# Eager-build the registry at import time. Stub handlers are sync
# functions returning a coroutine so we don't need extra await.

async def _ni_assign_lead(**_: Any) -> dict[str, Any]:
    return {"action": "assign_lead", "ok": False, "error": "not_yet_implemented"}


async def _ni_update_stage(**_: Any) -> dict[str, Any]:
    return {"action": "update_stage", "ok": False, "error": "not_yet_implemented"}


async def _ni_wait_for_event(**_: Any) -> dict[str, Any]:
    return {"action": "wait_for_event", "ok": False, "error": "not_yet_implemented"}


async def _ni_send_email(**_: Any) -> dict[str, Any]:
    return {"action": "send_email", "ok": False, "error": "not_yet_implemented"}


async def _ni_send_whatsapp(**_: Any) -> dict[str, Any]:
    return {"action": "send_whatsapp", "ok": False, "error": "not_yet_implemented"}


async def _ni_webhook_publish(**_: Any) -> dict[str, Any]:
    return {"action": "webhook_publish", "ok": False, "error": "not_yet_implemented"}


ACTION_HANDLERS: dict[str, ActionHandler] = {
    "send_dm": _send_dm,
    "send_dm_with_quick_replies": _send_dm,  # quick replies are a payload detail
    "create_lead": _create_lead,
    "tag_lead": _tag_lead,
    "assign_lead": _ni_assign_lead,
    "update_stage": _ni_update_stage,
    "apply_follow_gate": _apply_follow_gate,
    "wait_for_event": _ni_wait_for_event,
    "create_activity": _create_activity,
    "send_email": _ni_send_email,
    "send_whatsapp": _ni_send_whatsapp,
    "webhook_publish": _ni_webhook_publish,
}


# ---------------------------------------------------------------------
# Public entry point used by rule_engine
# ---------------------------------------------------------------------

async def execute_actions(
    *,
    db: AsyncSession,
    tenant_id: UUID,
    rule: AutomationRule,
    actions: list[dict[str, Any]],
    event_payload: dict[str, Any],
    social_account_id: Optional[UUID],
    social_message_id: Optional[UUID],
    chain_depth: int,
) -> list[dict[str, Any]]:
    """Run every action in order. Each result is a small dict that
    lands in ``integration_events.payload`` for the audit trail."""
    results: list[dict[str, Any]] = []
    for raw in actions or []:
        atype = raw.get("type")
        config = raw.get("config") or {}
        handler = ACTION_HANDLERS.get(atype)
        if handler is None:
            results.append(
                {"action": atype, "ok": False, "error": f"unknown action type {atype}"}
            )
            continue
        try:
            result = await handler(
                db=db,
                tenant_id=tenant_id,
                rule=rule,
                config=config,
                event_payload=event_payload,
                social_account_id=social_account_id,
                social_message_id=social_message_id,
                chain_depth=chain_depth,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("action handler %s crashed: %s", atype, exc)
            result = {
                "action": atype,
                "ok": False,
                "error": f"{type(exc).__name__}: {exc}",
            }
        results.append(result)
    return results
