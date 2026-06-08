from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://aveonapex:aveonapex_pass@localhost:5432/aveonapex"
    SECRET_KEY: str = "change-me-in-production"

    # ------------------------------------------------------------------
    # AI provider — see services/claude_service.py for the dispatch.
    #
    # The product was originally wired direct to Anthropic. After
    # ``Your credit balance is too low`` started taking down chat in
    # production, we moved to OpenRouter (OpenAI-compatible router that
    # exposes Anthropic, OpenAI, Google, Mistral, etc. behind one key
    # and one billing surface). The classic ANTHROPIC_API_KEY env var
    # still works as a fallback when AI_PROVIDER=anthropic.
    #
    # AI_PROVIDER values: "openrouter" (default) | "anthropic"
    # ------------------------------------------------------------------
    AI_PROVIDER: str = "openrouter"

    ANTHROPIC_API_KEY: str = ""

    # OpenRouter — https://openrouter.ai
    # OPENROUTER_MODEL is the slug of the model on OpenRouter; see
    # https://openrouter.ai/models for the list. ``anthropic/claude-sonnet-4``
    # is the closest match to what we used to call directly. Cheaper
    # alternatives that still work well for our prompts:
    #   ``openai/gpt-4o-mini``        — fast & cheap, fine for chat
    #   ``anthropic/claude-3.5-haiku`` — cheap & fast, fine for scoring
    #   ``openai/gpt-4o``             — premium, on par with sonnet
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "anthropic/claude-sonnet-4"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    # Sent as HTTP-Referer + X-Title to OpenRouter for app attribution.
    # Optional but recommended; OpenRouter shows this in their dashboard.
    OPENROUTER_APP_NAME: str = "AveonApex"

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = "noreply@aveonapex.ai"
    WA_API_KEY: str = ""
    WA_PHONE_ID: str = ""
    REDIS_URL: str = "redis://localhost:6379"
    CORS_ORIGINS: str = "http://localhost:5173"
    AI_MAX_TOKENS_PER_CALL: int = 4096
    AI_MONTHLY_LIMIT_STARTER: int = 500
    AI_MONTHLY_LIMIT_GROWTH: int = 5000
    AI_MONTHLY_LIMIT_ENTERPRISE: int = 50000

    # ------------------------------------------------------------------
    # Third-Party Integration Module
    # ------------------------------------------------------------------
    # Fernet key used to encrypt every stored third-party credential
    # (OAuth tokens, API keys, webhook secrets). Generate with
    # ``python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"``
    # and set via env. If empty, core/crypto.py derives a fallback key
    # from SECRET_KEY (local-dev only, logs a loud warning).
    INTEGRATIONS_ENCRYPTION_KEY: str = ""

    # The public base URL at which this backend is reachable. Used when
    # rendering webhook URLs for providers to call back into AveonApex.
    PUBLIC_BASE_URL: str = "http://localhost:8000"

    # Meta Ads (Facebook/Instagram Lead Ads) — OAuth 2.0
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_WEBHOOK_VERIFY_TOKEN: str = ""

    # Google Ads — OAuth 2.0 + developer token
    GOOGLE_ADS_CLIENT_ID: str = ""
    GOOGLE_ADS_CLIENT_SECRET: str = ""
    GOOGLE_ADS_DEVELOPER_TOKEN: str = ""

    # LinkedIn Ads — OAuth 2.0
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""

    # ------------------------------------------------------------------
    # Lead Enrichment (Phase 2 — Apollo.io + Hunter.io)
    # ------------------------------------------------------------------
    # Apollo.io — People Match API. Free tier: 50 credits/month.
    # Get key at https://app.apollo.io/#/settings/integrations/api
    APOLLO_API_KEY: str = ""

    # Hunter.io — Email Finder API. Free tier: 25 requests/month.
    # Get key at https://hunter.io/api
    HUNTER_API_KEY: str = ""

    # ------------------------------------------------------------------
    # LinkedIn Prospecting (Phase 4 — ProxyCurl profile enrichment)
    # ------------------------------------------------------------------
    # ProxyCurl — LinkedIn data API. Free trial: 10 credits.
    # Get key at https://nubela.co/proxycurl
    PROXYCURL_API_KEY: str = ""

    # SMTP alternative to SendGrid
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        """Railway/Heroku provide postgresql:// — SQLAlchemy async needs postgresql+asyncpg://

        Important: this MUST NOT raise on bad input. config.py is imported
        at app startup; raising here crashes uvicorn before it can bind a
        port, and Railway then sees no logs at all (just a failed
        healthcheck). Instead we log a warning and let the eventual DB
        connection surface the error in a place where logs are visible.
        """
        if v is None or str(v).strip() == "":
            print(
                "[config] WARNING: DATABASE_URL is empty. On Railway, set this "
                "variable to the reference '${{Postgres.DATABASE_URL}}' or paste "
                "the full postgres:// URL from the Postgres service → Variables.",
                flush=True,
            )
            # Return a syntactically valid placeholder so SQLAlchemy can be
            # constructed; the connection will fail when actually used,
            # which is logged from a background task in main.py.
            return "postgresql+asyncpg://invalid:invalid@invalid:5432/invalid"
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
