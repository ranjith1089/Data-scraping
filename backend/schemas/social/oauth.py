"""Schemas for the Instagram Connect OAuth flow + connection status."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class OAuthStartResponse(BaseModel):
    """Returned by GET /social/oauth/instagram/start."""

    auth_url: str
    state: str  # CSRF token; client stores it and we verify on callback


class InstagramConnectionStatus(BaseModel):
    """Returned by GET /social/oauth/instagram/status."""

    connected: bool
    instagram_business_id: Optional[str] = None
    page_id: Optional[str] = None
    handle: Optional[str] = None
    webhook_url: Optional[str] = None  # the public URL the tenant configured at Meta
    connected_at: Optional[datetime] = None
    last_test_at: Optional[datetime] = None
    last_test_ok: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)
