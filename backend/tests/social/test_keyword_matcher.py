"""Unit tests for keyword_matcher — pure functions, no DB."""

from __future__ import annotations

import pytest

from services.social.keyword_matcher import (
    all_conditions_match,
    contains_any,
    evaluate_condition,
    get_path,
    matches_regex,
)


# ---------------------------------------------------------------------
# contains_any
# ---------------------------------------------------------------------

class TestContainsAny:
    def test_empty_text_returns_false(self):
        assert contains_any("", ["course"]) is False
        assert contains_any(None, ["course"]) is False

    def test_empty_needles_returns_false(self):
        assert contains_any("anything", []) is False
        assert contains_any("anything", None) is False

    def test_case_insensitive_default(self):
        assert contains_any("I want the COURSE link", ["course"]) is True
        assert contains_any("Join", ["join", "buy"]) is True

    def test_case_sensitive_when_requested(self):
        assert contains_any("course", ["COURSE"], case_insensitive=False) is False
        assert contains_any("COURSE", ["COURSE"], case_insensitive=False) is True

    def test_skips_blank_needles(self):
        # An empty string in the needles list shouldn't match every text.
        assert contains_any("hello", ["", "world"]) is False
        assert contains_any("hello world", ["", "world"]) is True


# ---------------------------------------------------------------------
# matches_regex
# ---------------------------------------------------------------------

class TestMatchesRegex:
    def test_basic_match(self):
        assert matches_regex("price is 100", r"\d+") is True
        assert matches_regex("no digits here", r"\d+") is False

    def test_invalid_regex_returns_false(self):
        # Unbalanced bracket — must not raise
        assert matches_regex("anything", "(") is False

    def test_empty_inputs(self):
        assert matches_regex("", "abc") is False
        assert matches_regex("abc", "") is False
        assert matches_regex(None, "abc") is False

    def test_truncates_long_input(self):
        # Build pathological input that would slow a bad regex; we just
        # care that it returns a bool quickly without raising.
        big = "a" * 50_000
        assert isinstance(matches_regex(big, r"^a+$"), bool)


# ---------------------------------------------------------------------
# get_path
# ---------------------------------------------------------------------

class TestGetPath:
    def test_flat_lookup(self):
        assert get_path({"a": 1}, "a") == 1
        assert get_path({"a": 1}, "b") is None

    def test_dotted_path(self):
        assert get_path({"a": {"b": {"c": 42}}}, "a.b.c") == 42

    def test_missing_intermediate_returns_none(self):
        assert get_path({"a": {}}, "a.b.c") is None
        assert get_path({}, "a.b.c") is None

    def test_list_index(self):
        assert get_path({"items": [{"name": "x"}, {"name": "y"}]}, "items.1.name") == "y"

    def test_list_index_out_of_range(self):
        assert get_path({"items": [1]}, "items.5") is None

    def test_primitive_at_intermediate(self):
        assert get_path({"a": 1}, "a.b") is None


# ---------------------------------------------------------------------
# evaluate_condition
# ---------------------------------------------------------------------

class TestEvaluateCondition:
    def _ev(self, **kwargs):
        return evaluate_condition(kwargs, {"comment_text": "I want the course",
                                            "post_id": "media_abc",
                                            "commenter": {"handle": "@priya", "tag": "vip"}})

    def test_eq(self):
        assert self._ev(field="post_id", op="eq", value="media_abc") is True
        assert self._ev(field="post_id", op="eq", value="other") is False

    def test_neq(self):
        assert self._ev(field="post_id", op="neq", value="other") is True

    def test_in(self):
        assert self._ev(field="post_id", op="in", value=["media_abc", "media_def"]) is True
        assert self._ev(field="post_id", op="in", value=["x", "y"]) is False

    def test_in_coerces_scalar_to_list(self):
        assert self._ev(field="post_id", op="in", value="media_abc") is True

    def test_not_in(self):
        assert self._ev(field="post_id", op="not_in", value=["x", "y"]) is True
        assert self._ev(field="post_id", op="not_in", value=["media_abc"]) is False

    def test_contains_any(self):
        assert self._ev(field="comment_text", op="contains_any", value=["course", "buy"]) is True
        assert self._ev(field="comment_text", op="contains_any", value=["zzz"]) is False

    def test_not_contains_any(self):
        assert self._ev(field="comment_text", op="not_contains_any", value=["zzz"]) is True
        assert self._ev(field="comment_text", op="not_contains_any", value=["course"]) is False

    def test_matches_regex(self):
        assert self._ev(field="commenter.handle", op="matches_regex", value=r"^@[a-z]+$") is True
        assert self._ev(field="commenter.handle", op="matches_regex", value=r"^\d+$") is False

    def test_exists(self):
        assert self._ev(field="commenter.handle", op="exists") is True
        assert self._ev(field="nope.nada", op="exists") is False

    def test_not_exists(self):
        assert self._ev(field="nope", op="not_exists") is True
        assert self._ev(field="post_id", op="not_exists") is False

    def test_unknown_op_returns_false(self):
        assert self._ev(field="post_id", op="bogus", value="anything") is False


# ---------------------------------------------------------------------
# all_conditions_match
# ---------------------------------------------------------------------

class TestAllConditionsMatch:
    def test_empty_conditions_matches(self):
        ok, failed = all_conditions_match([], {})
        assert ok is True
        assert failed == []

    def test_none_conditions_matches(self):
        ok, failed = all_conditions_match(None, {})
        assert ok is True
        assert failed == []

    def test_all_match(self):
        ok, failed = all_conditions_match(
            [
                {"field": "x", "op": "eq", "value": 1},
                {"field": "y", "op": "exists"},
            ],
            {"x": 1, "y": "yes"},
        )
        assert ok is True
        assert failed == []

    def test_some_fail(self):
        ok, failed = all_conditions_match(
            [
                {"field": "x", "op": "eq", "value": 1},
                {"field": "y", "op": "eq", "value": "expected"},
            ],
            {"x": 1, "y": "different"},
        )
        assert ok is False
        assert len(failed) == 1
        assert "y" in failed[0]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
