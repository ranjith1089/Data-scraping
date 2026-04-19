"""Third-party integration plugin registry.

Each provider (Meta Ads, Google Ads, WhatsApp, ...) lives in its own
module as a subclass of :class:`BaseIntegration`. Call
:func:`get_integration` to look one up by provider code at runtime.
"""

from __future__ import annotations

from typing import Dict, Type

from .base import BaseIntegration, IntegrationTestResult

# Registered providers are added lazily as modules are imported below.
_REGISTRY: Dict[str, Type[BaseIntegration]] = {}


def register(provider: str):
    """Decorator — registers a BaseIntegration subclass for ``provider``."""

    def _wrap(cls: Type[BaseIntegration]) -> Type[BaseIntegration]:
        _REGISTRY[provider] = cls
        return cls

    return _wrap


def get_integration(provider: str) -> Type[BaseIntegration] | None:
    return _REGISTRY.get(provider)


def list_providers() -> list[str]:
    return sorted(_REGISTRY.keys())


__all__ = [
    "BaseIntegration",
    "IntegrationTestResult",
    "register",
    "get_integration",
    "list_providers",
]

# ---------------------------------------------------------------------------
# Eager plugin imports — each module self-registers via the @register
# decorator on import. Keep this block at the bottom so the decorator has the
# ``register`` symbol available. New connectors should be added here.
# ---------------------------------------------------------------------------
from . import whatsapp  # noqa: E402,F401  WhatsApp Cloud API (Option B)
from . import whatsapp_gupshup  # noqa: E402,F401  Gupshup BSP (Option D)
from . import sendgrid as _sendgrid_plugin  # noqa: E402,F401  SendGrid REST
from . import smtp as _smtp_plugin  # noqa: E402,F401  Generic SMTP
