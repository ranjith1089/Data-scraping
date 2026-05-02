"""LeadForge Social — runtime engine for the social automation module.

Public entry points used by webhook receivers and APScheduler jobs:

* :func:`rule_engine.evaluate_event` — given a normalised event from
  Instagram (``comment.received`` / ``dm.received`` / etc.), find the
  matching automation rules, evaluate their conditions, and dispatch
  actions.

* :func:`message_persistence.upsert_inbound_message` — atomically
  create-or-update the ``SocialAccount`` + ``SocialConversation`` +
  ``SocialMessage`` rows for an inbound platform event. Returns the
  message and a boolean signalling whether it was a webhook duplicate
  we should ignore.

Internal modules:

* ``keyword_matcher`` — string / regex matching utilities for rule
  conditions.
* ``action_executor`` — registry of action handlers
  (``send_dm``, ``create_lead`` …).
* ``rate_limiter`` — per-tenant sliding-window throttle.

Everything is async, multi-tenant, and writes to ``integration_events``
for forensic auditing.
"""
