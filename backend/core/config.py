from pydantic_settings import BaseSettings
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

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

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


settings = Settings()
