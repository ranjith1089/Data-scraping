"""Lead Enrichment Service — Apollo.io + Hunter.io.

Fills empty lead fields (email, phone, LinkedIn, designation, company size,
website, industry) by querying third-party data providers.

Priority:
  1. Apollo.io People Match  — comprehensive: email, phone, LinkedIn, title, org info
  2. Hunter.io Email Finder  — email only, used when Apollo has no API key or no email

Graceful degradation:
  - Neither key set  → status="no_api_key", no fields updated
  - One key set      → uses that provider only
  - Both keys set    → Apollo first; Hunter fills email gap if Apollo found none
  - Provider down    → logs error, returns partial result
  - Lead not found   → status="not_found"

Overwrite logic (default overwrite=False):
  - A field is only written if the lead row currently has NULL/empty for that field.
  - Pass overwrite=True to replace existing values.
"""

from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import urlparse

import httpx

from core.config import settings
from models.lead import Lead

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_APOLLO_PEOPLE_MATCH = "https://api.apollo.io/v1/people/match"
_HUNTER_EMAIL_FINDER = "https://api.hunter.io/v2/email-finder"
_HTTP_TIMEOUT = 15.0  # seconds

# Lead fields we can populate from external APIs
_ENRICHABLE_FIELDS = [
    "email",
    "phone",
    "linkedin_url",
    "designation",
    "company_size",
    "website",
    "industry",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _split_name(full_name: str) -> tuple[str, str]:
    """Split 'Rajesh Kumar' → ('Rajesh', 'Kumar'). Single word → (word, '')."""
    parts = full_name.strip().split()
    if not parts:
        return ("", "")
    if len(parts) == 1:
        return (parts[0], "")
    return (parts[0], " ".join(parts[1:]))


def _extract_domain(url_or_email: str) -> str:
    """Extract bare domain from a URL or email address.

    'https://www.techcorp.com/about' → 'techcorp.com'
    'contact@techcorp.com'          → 'techcorp.com'
    'techcorp.com'                  → 'techcorp.com'
    """
    s = (url_or_email or "").strip()
    if not s:
        return ""
    if "@" in s:
        return s.split("@")[-1].lower().strip()
    if "://" not in s:
        s = "https://" + s
    parsed = urlparse(s)
    host = parsed.netloc or parsed.path
    # Strip "www."
    return re.sub(r"^www\.", "", host).lower().strip()


def _map_employee_count(count: Optional[int]) -> Optional[str]:
    """Apollo returns an integer; map to our CompanySize strings."""
    if count is None:
        return None
    if count <= 10:
        return "1-10"
    if count <= 50:
        return "11-50"
    if count <= 200:
        return "51-200"
    if count <= 500:
        return "201-500"
    if count <= 1000:
        return "501-1000"
    return "1000+"


# ---------------------------------------------------------------------------
# Apollo.io client
# ---------------------------------------------------------------------------


async def _call_apollo(
    first_name: str,
    last_name: str,
    company_name: str,
    domain: str,
) -> dict:
    """Call Apollo People Match. Returns a flat dict of found fields or {}."""
    if not settings.APOLLO_API_KEY:
        return {}

    payload: dict = {
        "first_name": first_name or None,
        "last_name": last_name or None,
        "organization_name": company_name or None,
        "reveal_personal_emails": False,
        "reveal_phone_number": False,
    }
    if domain:
        payload["domain"] = domain

    # Remove None values — Apollo rejects unknown null fields on some plans
    payload = {k: v for k, v in payload.items() if v is not None}

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.post(
                _APOLLO_PEOPLE_MATCH,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Api-Key": settings.APOLLO_API_KEY,
                    "Cache-Control": "no-cache",
                },
            )
        if resp.status_code == 422:
            # Apollo returns 422 when the person is not in their DB
            logger.debug("[apollo] person not found for %s @ %s", company_name, domain)
            return {}
        if resp.status_code != 200:
            logger.warning("[apollo] HTTP %d: %s", resp.status_code, resp.text[:300])
            return {"_error": f"HTTP {resp.status_code}"}

        body = resp.json()
        person = body.get("person") or {}
        if not person:
            return {}

        org = person.get("organization") or {}
        phones = person.get("phone_numbers") or []
        phone = phones[0].get("sanitized_number") if phones else None

        # Map Apollo employee_count to our string range
        emp = org.get("estimated_num_employees") or org.get("num_employees")
        company_size = _map_employee_count(emp)

        result: dict = {}
        if person.get("email"):
            result["email"] = person["email"]
        if phone:
            result["phone"] = phone
        if person.get("linkedin_url"):
            result["linkedin_url"] = person["linkedin_url"]
        if person.get("title"):
            result["designation"] = person["title"]
        if org.get("website_url"):
            result["website"] = org["website_url"]
        if company_size:
            result["company_size"] = company_size
        industries = org.get("industries") or []
        if industries:
            result["industry"] = industries[0]

        logger.info("[apollo] found %d fields for %s", len(result), company_name)
        return result

    except httpx.TimeoutException:
        logger.warning("[apollo] timeout for %s", company_name)
        return {"_error": "timeout"}
    except Exception as exc:  # noqa: BLE001
        logger.exception("[apollo] unexpected error: %s", exc)
        return {"_error": str(exc)}


# ---------------------------------------------------------------------------
# Hunter.io client
# ---------------------------------------------------------------------------


async def _call_hunter(
    domain: str,
    first_name: str,
    last_name: str,
) -> dict:
    """Call Hunter.io Email Finder. Returns {'email': '...'} or {}."""
    if not settings.HUNTER_API_KEY or not domain:
        return {}

    params = {
        "domain": domain,
        "api_key": settings.HUNTER_API_KEY,
    }
    if first_name:
        params["first_name"] = first_name
    if last_name:
        params["last_name"] = last_name

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.get(_HUNTER_EMAIL_FINDER, params=params)

        if resp.status_code == 404:
            logger.debug("[hunter] email not found for %s %s @ %s", first_name, last_name, domain)
            return {}
        if resp.status_code != 200:
            logger.warning("[hunter] HTTP %d: %s", resp.status_code, resp.text[:200])
            return {"_error": f"HTTP {resp.status_code}"}

        body = resp.json()
        data = body.get("data") or {}
        email = data.get("email")
        score = data.get("score", 0)

        if not email:
            return {}

        # Only accept high-confidence results (Hunter score 0-100)
        if score < 50:
            logger.debug("[hunter] low confidence email %s (score=%d), skipping", email, score)
            return {}

        logger.info("[hunter] found email %s (confidence=%d) for %s @ %s", email, score, first_name, domain)
        return {"email": email, "_hunter_score": score}

    except httpx.TimeoutException:
        logger.warning("[hunter] timeout for %s", domain)
        return {"_error": "timeout"}
    except Exception as exc:  # noqa: BLE001
        logger.exception("[hunter] unexpected error: %s", exc)
        return {"_error": str(exc)}


# ---------------------------------------------------------------------------
# Core enrichment function
# ---------------------------------------------------------------------------


async def enrich_lead(
    lead: Lead,
    overwrite: bool = False,
) -> dict:
    """Enrich a Lead row using Apollo and/or Hunter.

    Returns a dict for building an EnrichmentResult / EnrichmentLog:
    {
      "status":          "success" | "partial" | "failed" | "no_api_key" | "not_found",
      "source":          "apollo" | "hunter" | "apollo+hunter" | "none",
      "fields_found":    {field: value, ...},   # everything the API returned
      "fields_updated":  [field, ...],           # written to the lead
      "skipped_fields":  [field, ...],           # found but already had data
      "error":           str | None,
    }
    """
    has_apollo = bool(settings.APOLLO_API_KEY)
    has_hunter = bool(settings.HUNTER_API_KEY)

    if not has_apollo and not has_hunter:
        return {
            "status": "no_api_key",
            "source": "none",
            "fields_found": {},
            "fields_updated": [],
            "skipped_fields": [],
            "error": (
                "No enrichment API keys configured. "
                "Set APOLLO_API_KEY and/or HUNTER_API_KEY on Railway."
            ),
        }

    first, last = _split_name(lead.contact_name or "")
    # Derive domain from website first, then email
    domain = _extract_domain(lead.website or "") or _extract_domain(lead.email or "")

    found: dict = {}
    sources_used: list[str] = []
    errors: list[str] = []

    # ── 1. Apollo ─────────────────────────────────────────────────────────
    if has_apollo:
        apollo_result = await _call_apollo(first, last, lead.company_name, domain)
        if "_error" in apollo_result:
            errors.append(f"Apollo: {apollo_result['_error']}")
        elif apollo_result:
            found.update({k: v for k, v in apollo_result.items() if not k.startswith("_")})
            sources_used.append("apollo")

    # ── 2. Hunter — fills email if Apollo didn't return one ────────────────
    if has_hunter:
        # Run Hunter if: no Apollo email found, or we have a domain to search
        apollo_email = found.get("email")
        if not apollo_email and domain:
            hunter_result = await _call_hunter(domain, first, last)
            if "_error" in hunter_result:
                errors.append(f"Hunter: {hunter_result['_error']}")
            elif hunter_result.get("email"):
                found["email"] = hunter_result["email"]
                sources_used.append("hunter")

    # ── 3. Nothing found ──────────────────────────────────────────────────
    clean_found = {k: v for k, v in found.items() if not k.startswith("_")}
    if not clean_found and not sources_used:
        return {
            "status": "not_found",
            "source": "+".join(sources_used) if sources_used else "none",
            "fields_found": {},
            "fields_updated": [],
            "skipped_fields": [],
            "error": "; ".join(errors) or "Person not found in provider databases",
        }

    # ── 4. Merge into lead ─────────────────────────────────────────────────
    updated: list[str] = []
    skipped: list[str] = []

    for field, value in clean_found.items():
        if field not in _ENRICHABLE_FIELDS:
            continue
        current = getattr(lead, field, None)
        if current and not overwrite:
            skipped.append(field)
            continue
        setattr(lead, field, value)
        updated.append(field)

    status = "success"
    if errors and not updated:
        status = "failed"
    elif errors or (clean_found and not updated):
        status = "partial"
    elif not updated:
        status = "not_found"

    return {
        "status": status,
        "source": "+".join(sources_used) if sources_used else "none",
        "fields_found": clean_found,
        "fields_updated": updated,
        "skipped_fields": skipped,
        "error": "; ".join(errors) if errors else None,
    }
