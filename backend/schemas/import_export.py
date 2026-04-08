from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class ImportMode(str, Enum):
    CREATE_ONLY = "create_only"
    UPDATE_ONLY = "update_only"
    UPSERT = "upsert"


class ImportRequest(BaseModel):
    sector_code: str = Field(..., min_length=2, max_length=20)
    mode: ImportMode = Field(default=ImportMode.UPSERT)
    dedupe_field: str = Field(
        default="email",
        description="Field used for deduplication: email | phone | company_name",
    )
    tag_all: Optional[str] = Field(
        None, max_length=50, description="Tag to apply to all imported leads"
    )


class ImportError(BaseModel):
    row: int
    field: Optional[str] = None
    message: str
    value: Optional[str] = None


class ImportResult(BaseModel):
    imported: int = 0
    updated: int = 0
    skipped: int = 0
    errors: List[ImportError] = Field(default_factory=list)
    total_processed: int = 0


class ExportRequest(BaseModel):
    sector_code: Optional[str] = None
    stage: Optional[str] = None
    format: str = Field(default="csv", pattern=r"^(csv|xlsx)$")
    fields: Optional[List[str]] = Field(
        None, description="Specific fields to export; null for all"
    )


class ExportResponse(BaseModel):
    file_url: str
    record_count: int
    format: str
