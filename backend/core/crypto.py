"""Fernet-based symmetric encryption for third-party integration credentials.

All OAuth tokens, API keys, and webhook secrets belonging to an *external*
provider (Meta Ads, Google Ads, LinkedIn, WhatsApp, SMTP, etc.) are stored
encrypted at rest in Postgres. The encryption key comes from the
``INTEGRATIONS_ENCRYPTION_KEY`` environment variable.

Design notes
------------
* Fernet gives us AES-128-CBC + HMAC-SHA256 authentication in a single
  battle-tested primitive from ``cryptography``.
* The key is a URL-safe base64-encoded 32-byte value. Generate one with
  ``Fernet.generate_key()`` and set it in the deploy environment.
* If the env var is missing or invalid, we fall back to a key derived
  from the existing ``SECRET_KEY`` so the backend still boots in local
  development — but we emit a loud warning.
* This module is intentionally tiny (pure functions) so every call site
  goes through a single code path and key rotation is a one-line change.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    """Return a singleton Fernet instance built from the configured key."""
    raw = getattr(settings, "INTEGRATIONS_ENCRYPTION_KEY", "") or ""

    if raw:
        try:
            return Fernet(raw.encode() if isinstance(raw, str) else raw)
        except Exception as exc:  # noqa: BLE001 — log and fall through
            logger.warning(
                "INTEGRATIONS_ENCRYPTION_KEY is invalid (%s). "
                "Falling back to SECRET_KEY-derived key.",
                exc,
            )

    # Fallback: derive a Fernet-compatible 32-byte key from SECRET_KEY.
    # This keeps local development ergonomic but is NOT recommended for
    # production — set INTEGRATIONS_ENCRYPTION_KEY explicitly there.
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    derived = base64.urlsafe_b64encode(digest)
    logger.warning(
        "INTEGRATIONS_ENCRYPTION_KEY not set — using SECRET_KEY-derived key. "
        "Set INTEGRATIONS_ENCRYPTION_KEY in production."
    )
    return Fernet(derived)


def encrypt_str(plaintext: str) -> bytes:
    """Encrypt a UTF-8 string, return ciphertext bytes suitable for BYTEA."""
    if plaintext is None:
        return b""
    return _get_fernet().encrypt(plaintext.encode("utf-8"))


def decrypt_str(ciphertext: bytes | memoryview | None) -> str:
    """Decrypt BYTEA ciphertext back to a UTF-8 string.

    Returns an empty string if ``ciphertext`` is falsy so callers can
    safely chain attribute access on missing values.
    """
    if not ciphertext:
        return ""
    if isinstance(ciphertext, memoryview):
        ciphertext = ciphertext.tobytes()
    try:
        return _get_fernet().decrypt(bytes(ciphertext)).decode("utf-8")
    except InvalidToken:
        logger.error("Failed to decrypt integration credential — key rotated?")
        return ""


def encrypt_json(payload: dict[str, Any] | None) -> bytes:
    """JSON-encode ``payload`` and encrypt. ``None`` → empty bytes."""
    if not payload:
        return b""
    return encrypt_str(json.dumps(payload, separators=(",", ":"), sort_keys=True))


def decrypt_json(ciphertext: bytes | memoryview | None) -> dict[str, Any]:
    """Decrypt and JSON-decode. Returns empty dict on any failure."""
    text = decrypt_str(ciphertext)
    if not text:
        return {}
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        logger.error("Decrypted integration payload was not valid JSON")
        return {}


def mask_secret(value: str, keep: int = 4) -> str:
    """Mask a secret string for display in the UI (keeps last ``keep`` chars)."""
    if not value:
        return ""
    if len(value) <= keep:
        return "•" * len(value)
    return "•" * (len(value) - keep) + value[-keep:]
