from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://leadforge:leadforge_pass@localhost:5432/leadforge"
    SECRET_KEY: str = "change-me-in-production"
    ANTHROPIC_API_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = "noreply@leadforge.ai"
    WA_API_KEY: str = ""
    WA_PHONE_ID: str = ""
    REDIS_URL: str = "redis://localhost:6379"
    CORS_ORIGINS: str = "http://localhost:5173"
    AI_MAX_TOKENS_PER_CALL: int = 4096
    AI_MONTHLY_LIMIT_STARTER: int = 500
    AI_MONTHLY_LIMIT_GROWTH: int = 5000
    AI_MONTHLY_LIMIT_ENTERPRISE: int = 50000

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        """Railway/Heroku provide postgresql:// — SQLAlchemy async needs postgresql+asyncpg://"""
        if not v:
            return v
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://") and "+asyncpg" not in v:
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    def get_ai_monthly_limit(self, plan: str) -> int:
        limits = {
            "starter": self.AI_MONTHLY_LIMIT_STARTER,
            "growth": self.AI_MONTHLY_LIMIT_GROWTH,
            "enterprise": self.AI_MONTHLY_LIMIT_ENTERPRISE,
        }
        return limits.get(plan, self.AI_MONTHLY_LIMIT_STARTER)

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
