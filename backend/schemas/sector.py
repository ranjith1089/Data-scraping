from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import Optional, List


class SectorResponse(BaseModel):
    id: UUID
    code: str
    name: str
    icon: Optional[str] = None
    description: Optional[str] = None
    ai_persona: Optional[str] = None
    pain_points: List[str] = []
    value_props: List[str] = []

    model_config = ConfigDict(from_attributes=True)
