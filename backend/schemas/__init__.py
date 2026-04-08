# LeadForge AI - Pydantic v2 Schemas

# Auth
from .auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    RefreshRequest,
    PasswordChangeRequest,
    PasswordResetRequest,
    PasswordResetConfirm,
    UserResponse as AuthUserResponse,
)

# Tenant
from .tenant import (
    PlanType,
    TenantCreate,
    TenantUpdate,
    TenantResponse,
)

# User
from .user import (
    UserRole,
    UserCreate,
    UserUpdate,
    UserResponse,
)

# Sector
from .sector import SectorResponse

# Lead
from .lead import (
    LeadStage,
    CompanySize,
    LeadSource,
    LeadCreate,
    LeadUpdate,
    LeadResponse,
    LeadListResponse,
    LeadSearchParams,
)

# Campaign
from .campaign import (
    CampaignStatus,
    CampaignChannel,
    CampaignCreate,
    CampaignUpdate,
    CampaignResponse,
    CampaignStepCreate,
    CampaignStepResponse,
)

# Pipeline
from .pipeline import (
    PipelineStageCreate,
    PipelineStageUpdate,
    PipelineStageResponse,
    DealCreate,
    DealUpdate,
    DealResponse,
)

# Activity
from .activity import (
    ActivityType,
    ActivityOutcome,
    ActivityCreate,
    ActivityUpdate,
    ActivityResponse,
)

# AI
from .ai import (
    EmailGenRequest,
    EmailGenResponse,
    LeadScoreRequest,
    LeadScoreResult,
    LeadScoreResponse,
    ChatRequest,
    ChatResponse,
    SectorBriefResponse,
    PersonaliseRequest,
    PersonalisedEmail,
    PersonaliseResponse,
    ReplyAnalyseRequest,
    ReplyAnalyseResponse,
)

# Analytics
from .analytics import (
    DashboardOverview,
    AIUsageStats,
    SectorStat,
    StageStat,
    DistrictStat,
    CampaignStat,
    FunnelData,
    DashboardResponse,
)

# Import/Export
from .import_export import (
    ImportMode,
    ImportRequest,
    ImportError,
    ImportResult,
    ExportRequest,
    ExportResponse,
)

__all__ = [
    # Auth
    "LoginRequest",
    "RegisterRequest",
    "TokenResponse",
    "RefreshRequest",
    "PasswordChangeRequest",
    "PasswordResetRequest",
    "PasswordResetConfirm",
    "AuthUserResponse",
    # Tenant
    "PlanType",
    "TenantCreate",
    "TenantUpdate",
    "TenantResponse",
    # User
    "UserRole",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    # Sector
    "SectorResponse",
    # Lead
    "LeadStage",
    "CompanySize",
    "LeadSource",
    "LeadCreate",
    "LeadUpdate",
    "LeadResponse",
    "LeadListResponse",
    "LeadSearchParams",
    # Campaign
    "CampaignStatus",
    "CampaignChannel",
    "CampaignCreate",
    "CampaignUpdate",
    "CampaignResponse",
    "CampaignStepCreate",
    "CampaignStepResponse",
    # Pipeline
    "PipelineStageCreate",
    "PipelineStageUpdate",
    "PipelineStageResponse",
    "DealCreate",
    "DealUpdate",
    "DealResponse",
    # Activity
    "ActivityType",
    "ActivityOutcome",
    "ActivityCreate",
    "ActivityUpdate",
    "ActivityResponse",
    # AI
    "EmailGenRequest",
    "EmailGenResponse",
    "LeadScoreRequest",
    "LeadScoreResult",
    "LeadScoreResponse",
    "ChatRequest",
    "ChatResponse",
    "SectorBriefResponse",
    "PersonaliseRequest",
    "PersonalisedEmail",
    "PersonaliseResponse",
    "ReplyAnalyseRequest",
    "ReplyAnalyseResponse",
    # Analytics
    "DashboardOverview",
    "AIUsageStats",
    "SectorStat",
    "StageStat",
    "DistrictStat",
    "CampaignStat",
    "FunnelData",
    "DashboardResponse",
    # Import/Export
    "ImportMode",
    "ImportRequest",
    "ImportError",
    "ImportResult",
    "ExportRequest",
    "ExportResponse",
]
