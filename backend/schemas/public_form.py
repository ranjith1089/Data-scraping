"""Schemas for tenant-owned public forms (embeddable on customer websites)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CustomFieldDef(BaseModel):
    """One custom field in a public form.

    Stored as JSONB on ``public_forms.custom_field_schema``. Values
    submitted against these fields land in ``leads.custom_fields``.
    """

    key: str = Field(..., min_length=1, max_length=50, pattern=r"^[a-z][a-z0-9_]*$")
    label: str = Field(..., min_length=1, max_length=100)
    required: bool = False
    type: str = Field(default="text")


class PublicFormCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sector_code: str = Field(..., min_length=2, max_length=20)
    redirect_url: Optional[str] = Field(None, max_length=2000)
    custom_field_schema: Optional[List[CustomFieldDef]] = Field(default_factory=list)


class PublicFormUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    sector_code: Optional[str] = Field(None, min_length=2, max_length=20)
    redirect_url: Optional[str] = Field(None, max_length=2000)
    custom_field_schema: Optional[List[CustomFieldDef]] = None
    is_active: Optional[bool] = None


class PublicFormResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    public_token: str
    sector_code: str
    redirect_url: Optional[str] = None
    custom_field_schema: Optional[List[CustomFieldDef]] = None
    is_active: bool
    submission_count: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicFormEmbed(BaseModel):
    """Response for GET /public-forms/{id}/embed — the snippets the
    tenant pastes into their website."""

    public_token: str
    script_snippet: str
    iframe_snippet: str
    submit_url: str


class PublicFormSubmission(BaseModel):
    """Payload accepted by POST /api/v1/public/forms/{token}/submit.

    Required fields mirror the human UX ('name' for contact, 'email',
    'phone'). A 'company' field gets stored as company_name; if absent
    we fall back to the contact's name so the lead row has a valid
    company_name (required by the Lead model).

    Admission / college-specific fields (ignored for non-admission sectors):
    parent_name, parent_phone, course_interested, board, stream,
    percentage_marks, school_name.
    """

    name: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    company: Optional[str] = Field(None, max_length=200)
    website: Optional[str] = Field(None, max_length=500)
    message: Optional[str] = Field(None, max_length=2000)
    city: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    custom_fields: Optional[dict[str, Any]] = Field(default_factory=dict)
    # ── Admission / student fields ────────────────────────────────────
    parent_name: Optional[str] = Field(None, max_length=100)
    parent_phone: Optional[str] = Field(None, max_length=20)
    course_interested: Optional[str] = Field(None, max_length=200)
    board: Optional[str] = Field(None, max_length=50)
    stream: Optional[str] = Field(None, max_length=50)
    percentage_marks: Optional[float] = Field(None, ge=0, le=100)
    school_name: Optional[str] = Field(None, max_length=200)
