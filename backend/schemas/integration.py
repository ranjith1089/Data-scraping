"""Pydantic schemas for the third-party integration module."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class IntegrationProvider(str, Enum):
    META_ADS = "meta_ads"
    GOOGLE_ADS = "google_ads"
    LINKEDIN_ADS = "linkedin_ads"
    WHATSAPP = "whatsapp"  # Direct Meta WhatsApp Business Cloud API
    WHATSAPP_GUPSHUP = "whatsapp_gupshup"  # WhatsApp via Gupshup BSP (India)
    SENDGRID = "sendgrid"
    SMTP = "smtp"
    GA4 = "ga4"
    FB_PIXEL = "fb_pixel"


class IntegrationStatus(str, Enum):
    DISCONNECTED = "disconnected"
    CONNECTED = "connected"
    ERROR = "error"
    EXPIRED = "expired"


class IntegrationCreate(BaseModel):
    """Admin-initiated creation of an integration row.

    ``credentials`` is plaintext on the wire (over HTTPS/JWT) and is
    immediately encrypted with Fernet before hitting the database.
    """

    provider: IntegrationProvider
    display_name: Optional[str] = Field(None, max_length=120)
    credentials: Optional[dict[str, Any]] = Field(
        None, description="Secret values: tokens, keys, passwords. Encrypted at rest."
    )
    config: Optional[dict[str, Any]] = Field(
        default_factory=dict,
        description="Non-secret values: account IDs, form IDs, from addresses.",
    )


class IntegrationUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=120)
    credentials: Optional[dict[str, Any]] = None
    config: Optional[dict[str, Any]] = None
    status: Optional[IntegrationStatus] = None


class IntegrationResponse(BaseModel):
    """Safe response — never returns plaintext credentials."""

    id: UUID
    tenant_id: UUID
    provider: str
    display_name: Optional[str] = None
    status: str
    config: Optional[dict[str, Any]] = None
    has_credentials: bool = False
    credential_preview: Optional[dict[str, str]] = Field(
        None, description="Masked preview of credential field names (e.g. api_key: ****abcd)."
    )
    last_sync_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class IntegrationTestResult(BaseModel):
    ok: bool
    provider: str
    message: str
    details: Optional[dict[str, Any]] = None


class WebhookEndpointResponse(BaseModel):
    id: UUID
    provider: str
    path_token: str
    public_url: str = Field(..., description="Fully-qualified URL to give the provider.")
    is_active: bool
    event_count: int
    last_event_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IntegrationEventResponse(BaseModel):
    id: int
    integration_id: Optional[UUID] = None
    direction: str
    event_type: str
    status: str
    error: Optional[str] = None
    lead_id: Optional[UUID] = None
    payload: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
