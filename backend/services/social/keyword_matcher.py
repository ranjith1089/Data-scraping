"""Pure-function condition + keyword matching for the rule engine.

The condition vocabulary is the same one declared in
``schemas/social/automation.py::RuleCondition`` — eq, neq, in, not_in,
contains_any, not_contains_any, matches_regex, exists, not_exists.

A rule's ``conditions`` list is ALL-AND. We don't need OR semantics
yet because the same effect is achieved by writing two rules with the
same actions but different conditions; if that becomes painful we can
add an explicit ``any_of`` block later.

Field paths support dotted access into nested event payloads, e.g.
``commenter.handle`` → ``event["commenter"]["handle"]``. Missing
intermediate keys resolve to ``None`` rather than raising — that way a
rule referencing ``commenter.bio`` doesn't crash on platforms that
don't expose bio.
"""

from __future__ import annotations

import re
from typing import Any, Iterable

# How many regex/contains-any operations a single rule can do before we
# bail. Stops a tenant pasting in a regex like (a+)+$ that could DOS
# the rule engine; we evaluate input length first as a coarse guard.
_MAX_REGEX_INPUT_LEN = 10_000


# ---------------------------------------------------------------------
# Low-level matchers
# ---------------------------------------------------------------------

def contains_any(text: str | None, needles: Iterable[str], case_insensitive: bool = True) -> bool:
    """Substring-match any of ``needles`` in ``text``. Empty needles list → False."""
    if not text or not needles:
        return False
    haystack = text.lower() if case_insensitive else text
    for n in needles:
        if not n:
            continue
        candidate = n.lower() if case_insensitive else n
        if candidate in haystack:
            return True
    return False


def matches_regex(text: str | None, pattern: str, case_insensitive: bool = True) -> bool:
    """Regex match with an input-length guard to limit ReDoS exposure."""
    if not text or not pattern:
        return False
    if len(text) > _MAX_REGEX_INPUT_LEN:
        # Truncate; we'd rather match less than have a bad regex stall the
        # event loop. The rule engine logs a warning when this trips.
        text = text[:_MAX_REGEX_INPUT_LEN]
    flags = re.IGNORECASE if case_insensitive else 0
    try:
        return bool(re.search(pattern, text, flags=flags))
    except re.error:
        # Bad regex from the tenant — treat as "no match" rather than
        # erroring out the whole rule evaluation.
        return False


# ---------------------------------------------------------------------
# Dotted-path event accessor
# ---------------------------------------------------------------------

def get_path(event: dict[str, Any], path: str) -> Any:
    """Walk ``event`` along a dot-separated ``path``.

    Returns ``None`` if any segment is missing or if a non-dict is
    encountered partway through. Supports list-index access via
    ``items.0.title`` syntax for deep paths into Meta payloads.
    """
    if not path:
        return None
    cur: Any = event
    for raw in path.split("."):
        if cur is None:
            return None
        if isinstance(cur, dict):
            cur = cur.get(raw)
            continue
        if isinstance(cur, list):
            try:
                idx = int(raw)
            except ValueError:
                return None
            if 0 <= idx < len(cur):
                cur = cur[idx]
            else:
                return None
            continue
        # Primitive value before path exhausted → treat as miss.
        return None
    return cur


# ---------------------------------------------------------------------
# Condition evaluator
# ---------------------------------------------------------------------

def _coerce_iterable(v: Any) -> list[Any]:
    if v is None:
        return []
    if isinstance(v, (list, tuple, set)):
        return list(v)
    return [v]


def evaluate_condition(condition: dict[str, Any], event: dict[str, Any]) -> bool:
    """Evaluate one ``{field, op, value}`` condition against an event.

    Unknown ops return False rather than raising — defensive against
    schema drift between API versions.
    """
    field = condition.get("field")
    op = condition.get("op")
    expected = condition.get("value")
    actual = get_path(event, field) if field else None

    if op == "exists":
        return actual is not None
    if op == "not_exists":
        return actual is None
    if op == "eq":
        return actual == expected
    if op == "neq":
        return actual != expected
    if op == "in":
        return actual in _coerce_iterable(expected)
    if op == "not_in":
        return actual not in _coerce_iterable(expected)
    if op == "contains_any":
        return contains_any(
            str(actual) if actual is not None else None,
            _coerce_iterable(expected),
        )
    if op == "not_contains_any":
        return not contains_any(
            str(actual) if actual is not None else None,
            _coerce_iterable(expected),
        )
    if op == "matches_regex":
        return matches_regex(
            str(actual) if actual is not None else None,
            str(expected) if expected is not None else "",
        )
    return False


def all_conditions_match(
    conditions: list[dict[str, Any]] | None,
    event: dict[str, Any],
) -> tuple[bool, list[str]]:
    """Evaluate every condition. Returns (all_passed, failed_reasons).

    Empty / None ``conditions`` → ``(True, [])`` so a rule with no
    conditions always fires on its trigger.
    """
    if not conditions:
        return True, []
    failed: list[str] = []
    for c in conditions:
        if not evaluate_condition(c, event):
            field = c.get("field", "?")
            op = c.get("op", "?")
            failed.append(f"{field} {op} {c.get('value')!r} → did not match")
    return len(failed) == 0, failed
