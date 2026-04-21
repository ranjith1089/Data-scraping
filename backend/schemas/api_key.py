"""Schemas for tenant-scoped API keys used by public REST integrations."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class APIKeyCreatedResponse(BaseModel):
    """Returned once at creation time — includes the plaintext key.

    The plaintext key is never stored; only a bcrypt hash lives in the
    database. The caller must copy this value now because it cannot be
    retrieved later.
    """

    id: UUID
    name: str
    key: str = Field(..., description="Plaintext API key. Shown once.")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class APIKeyResponse(BaseModel):
    id: UUID
    name: str
    # Masked preview of the key (last 4 chars only) so the list view can
    # help users disambiguate keys without exposing any secret.
    preview: str
    last_used: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
