from fastapi import Request
from fastapi.responses import JSONResponse


class AIQuotaExceeded(Exception):
    def __init__(self, tenant_id: str, limit: int, used: int):
        self.tenant_id = tenant_id
        self.limit = limit
        self.used = used
        super().__init__(f"AI quota exceeded: {used}/{limit}")


class LeadImportError(Exception):
    def __init__(self, errors: list[dict]):
        self.errors = errors
        super().__init__(f"Import failed with {len(errors)} errors")


class SectorNotFoundError(Exception):
    def __init__(self, sector_code: str):
        self.sector_code = sector_code
        super().__init__(f"Sector not found: {sector_code}")


async def ai_quota_handler(request: Request, exc: AIQuotaExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": "AI usage quota exceeded for this billing period",
            "limit": exc.limit,
            "used": exc.used,
        },
    )


async def sector_not_found_handler(request: Request, exc: SectorNotFoundError):
    return JSONResponse(
        status_code=404,
        content={"detail": f"Sector '{exc.sector_code}' not found"},
    )
