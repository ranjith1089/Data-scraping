"""Schemas for outbound webhook subscriptions (Zapier / Make / custom)."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class WebhookSubscriptionCreate(BaseModel):
    url: HttpUrl
    event_types: List[str] = Field(
        default_factory=lambda: ["lead.created"],
        min_length=1,
    )

    @field_validator("event_types")
    @classmethod
    def _validate_events(cls, v: list[str]) -> list[str]:
        allowed = {"lead.created", "lead.updated", "lead.stage_changed"}
        for event in v:
            if event not in allowed:
                raise ValueError(
                    f"Unknown event type '{event}'. Supported: {sorted(allowed)}"
                )
        return v


class WebhookSubscriptionUpdate(BaseModel):
    url: Optional[HttpUrl] = None
    event_types: Optional[List[str]] = None
    is_active: Optional[bool] = None


class WebhookSubscriptionResponse(BaseModel):
    id: UUID
    url: str
    event_types: List[str]
    is_active: bool
    last_delivery_at: Optional[datetime] = None
    last_error: Optional[str] = None
    failure_count: int
    has_secret: bool = False
    secret_preview: Optional[str] = Field(
        None, description="Masked preview of the HMAC secret (last 4 chars)."
    )
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WebhookSubscriptionCreatedResponse(WebhookSubscriptionResponse):
    """Same as WebhookSubscriptionResponse but also includes the plaintext
    HMAC secret, which is shown once at creation time."""

    secret: str = Field(..., description="Plaintext HMAC secret. Shown once.")


class WebhookDeliveryTestResult(BaseModel):
    ok: bool
    status_code: Optional[int] = None
    response_body: Optional[str] = None
    error: Optional[str] = None
