"""Lead Discovery Service — Apollo.io People Search.

Flow:
  1. User specifies sector + roles + location + company size
  2. We map those to Apollo's search payload
  3. Apollo returns matching people with company context
  4. We map the results to DiscoveredLead objects
  5. Caller can check which ones already exist in the CRM
  6. Caller creates Lead rows for the selected ones
"""

from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import urlparse

import httpx

from core.config import settings
from schemas.lead_discovery import DiscoveredLead, DiscoverRequest, DiscoverResponse

logger = logging.getLogger(__name__)

_APOLLO_PEOPLE_SEARCH = "https://api.apollo.io/v1/mixed_people/search"
_HTTP_TIMEOUT = 20.0


# ---------------------------------------------------------------------------
# Sector configurations
# ---------------------------------------------------------------------------

_SECTOR_CONFIGS: dict[str, dict] = {
    # ── Core three industries ────────────────────────────────────────────────────
    "college": {
        "keywords": [
            "college", "university", "deemed university", "autonomous college",
            "engineering college", "medical college", "professional institution",
            "higher education", "degree college", "NAAC", "NBA accredited",
        ],
        "default_titles": [
            "Principal", "Dean", "Vice Chancellor", "Pro-Vice Chancellor",
            "Registrar", "Director of Admissions",
            "Head of Department", "HOD", "Academic Director",
            "Controller of Examinations", "Director",
        ],
    },
    "software": {
        "keywords": [
            "software product", "saas", "software company", "b2b saas",
            "product startup", "tech startup", "isv", "independent software vendor",
            "cloud software", "enterprise software", "platform company",
        ],
        "default_titles": [
            "CEO", "Founder", "Co-Founder",
            "CTO", "Chief Technology Officer",
            "VP Product", "VP of Product", "Chief Product Officer", "CPO",
            "VP Engineering", "VP of Engineering",
            "Head of Sales", "VP Sales",
        ],
    },
    "manufacturing": {
        "keywords": [
            "manufacturing", "industrial", "factory", "production", "oem",
            "fabrication", "process industry", "auto component", "engineering company",
            "ISO certified manufacturer",
        ],
        "default_titles": [
            "Plant Head", "Plant Manager",
            "Operations Manager", "Head of Operations",
            "General Manager Manufacturing", "GM Manufacturing",
            "MD", "Managing Director", "CEO",
            "Quality Head", "Head of Quality",
            "Purchase Manager", "Director Operations",
        ],
    },
    # ── Additional industries ────────────────────────────────────────────────────
    "it_ites": {
        "keywords": ["software", "saas", "information technology", "it services", "tech startup", "product company"],
        "default_titles": [
            "CTO", "Chief Technology Officer",
            "VP Engineering", "VP of Engineering",
            "Head of Technology", "Head of Engineering",
            "CEO", "Founder", "Co-Founder",
            "Technical Director", "Director of Engineering",
            "Engineering Manager", "Software Director",
        ],
    },
    "education": {
        "keywords": ["education", "edtech", "e-learning", "school", "college", "university", "training", "learning management"],
        "default_titles": [
            "Principal", "Director", "Academic Director",
            "Vice Chancellor", "Head of Institution",
            "L&D Manager", "Learning and Development Manager",
            "Training Manager", "Head of Learning",
            "CEO", "Founder", "Managing Director",
            "Academic Head", "Dean",
        ],
    },
    "marketing_media": {
        "keywords": ["marketing", "advertising", "digital marketing", "creative agency", "media agency", "performance marketing"],
        "default_titles": [
            "Founder", "CEO", "Co-Founder",
            "Marketing Director", "Head of Marketing",
            "Head of Growth", "Growth Director",
            "Creative Director", "Managing Director",
            "VP Marketing", "CMO", "Chief Marketing Officer",
        ],
    },
}

_DEFAULT_SECTOR_CONFIG: dict = {
    "keywords": [],
    "default_titles": ["CEO", "Founder", "Managing Director", "Director", "Head"],
}

# ---------------------------------------------------------------------------
# Apollo employee-count range format: "min,max"
# ---------------------------------------------------------------------------

_SIZE_TO_APOLLO_RANGE: dict[str, str] = {
    "1-10":    "1,10",
    "11-50":   "11,50",
    "51-200":  "51,200",
    "201-500": "201,500",
    "501-1000": "501,1000",
    "1000+":   "1001,100000",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _map_employee_count(count: Optional[int]) -> Optional[str]:
    if count is None:
        return None
    if count <= 10:   return "1-10"
    if count <= 50:   return "11-50"
    if count <= 200:  return "51-200"
    if count <= 500:  return "201-500"
    if count <= 1000: return "501-1000"
    return "1000+"


def _clean_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    if "://" not in url:
        url = "https://" + url
    return url.rstrip("/")


def _map_person(person: dict, sector_code: str) -> DiscoveredLead:
    """Map an Apollo person dict → DiscoveredLead."""
    org = person.get("organization") or person.get("current_employer") or {}
    phones = person.get("phone_numbers") or []
    phone = phones[0].get("sanitized_number") if phones else None

    # Build full name
    full_name = (
        person.get("name")
        or f"{person.get('first_name', '')} {person.get('last_name', '')}".strip()
    )

    # Employee count
    emp = (
        org.get("estimated_num_employees")
        or org.get("num_employees")
        or person.get("employment_history", [{}])[0].get("estimated_num_employees") if person.get("employment_history") else None
    )
    company_size = _map_employee_count(emp)

    # Industries
    industries = (
        org.get("industries")
        or org.get("industry_tag_ids")
        or []
    )
    industry = industries[0] if industries and isinstance(industries[0], str) else None

    # Location
    city = person.get("city") or org.get("city") or ""
    state = person.get("state") or org.get("state") or ""
    # Normalise: Apollo returns US-format "Tamil Nadu, India" sometimes
    if state and ", India" in state:
        state = state.replace(", India", "").strip()

    return DiscoveredLead(
        apollo_id=person.get("id"),
        company_name=org.get("name") or person.get("organization_name") or "Unknown",
        contact_name=full_name or "Unknown",
        designation=person.get("title") or person.get("headline") or "",
        email=person.get("email") or "",
        phone=phone,
        linkedin_url=person.get("linkedin_url") or "",
        website=_clean_url(org.get("website_url")),
        company_size=company_size,
        industry=industry,
        city=city,
        state=state,
    )


# ---------------------------------------------------------------------------
# Main search function
# ---------------------------------------------------------------------------


async def search_leads(req: DiscoverRequest) -> DiscoverResponse:
    """Call Apollo mixed_people/search and return DiscoverResponse."""
    if not settings.APOLLO_API_KEY:
        return DiscoverResponse(
            leads=[],
            total=0,
            page=req.page,
            per_page=req.per_page,
            total_pages=0,
            warning=(
                "APOLLO_API_KEY is not configured. "
                "Set it on Railway to enable lead discovery. "
                "Free tier: https://app.apollo.io/#/settings/integrations/api"
            ),
        )

    sector = _SECTOR_CONFIGS.get(req.sector_code, _DEFAULT_SECTOR_CONFIG)

    # Merge sector defaults with user-provided roles
    titles = req.target_roles if req.target_roles else sector["default_titles"]
    keywords = sector["keywords"] + req.keywords

    payload: dict = {
        "per_page": req.per_page,
        "page": req.page,
    }

    if titles:
        payload["person_titles"] = titles[:15]  # Apollo caps at ~15 titles per call

    if keywords:
        payload["q_organization_keyword_tags"] = keywords[:8]

    # Location — always target India; optionally narrow to state/city
    locations: list[str] = []
    if req.location_city and req.location_state:
        locations.append(f"{req.location_city}, {req.location_state}, India")
    elif req.location_state:
        locations.append(f"{req.location_state}, India")
    else:
        locations.append("India")

    payload["person_locations"] = locations
    payload["organization_locations"] = ["India"]

    if req.company_size and req.company_size in _SIZE_TO_APOLLO_RANGE:
        payload["organization_num_employees_ranges"] = [_SIZE_TO_APOLLO_RANGE[req.company_size]]

    logger.info(
        "[discovery] Apollo search: sector=%s titles=%d keywords=%d location=%s",
        req.sector_code, len(titles), len(keywords), locations,
    )

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.post(
                _APOLLO_PEOPLE_SEARCH,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Api-Key": settings.APOLLO_API_KEY,
                    "Cache-Control": "no-cache",
                },
            )
    except httpx.TimeoutException:
        return DiscoverResponse(
            leads=[], total=0, page=req.page, per_page=req.per_page, total_pages=0,
            warning="Apollo API timed out. Please try again.",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("[discovery] request error: %s", exc)
        return DiscoverResponse(
            leads=[], total=0, page=req.page, per_page=req.per_page, total_pages=0,
            warning=f"Apollo API error: {exc}",
        )

    if resp.status_code == 401:
        return DiscoverResponse(
            leads=[], total=0, page=req.page, per_page=req.per_page, total_pages=0,
            warning="Apollo API key is invalid or expired.",
        )
    if resp.status_code == 422:
        # Usually means search params don't match any results
        return DiscoverResponse(
            leads=[], total=0, page=req.page, per_page=req.per_page, total_pages=0,
            warning="No results found for the selected filters.",
        )
    if resp.status_code != 200:
        logger.warning("[discovery] Apollo HTTP %d: %s", resp.status_code, resp.text[:300])
        return DiscoverResponse(
            leads=[], total=0, page=req.page, per_page=req.per_page, total_pages=0,
            warning=f"Apollo returned HTTP {resp.status_code}.",
        )

    body = resp.json()
    people = body.get("people") or []
    pagination = body.get("pagination") or {}

    total = pagination.get("total_entries", len(people))
    per_page_resp = pagination.get("per_page", req.per_page)
    total_pages = pagination.get("total_pages", max(1, -(-total // per_page_resp)))  # ceil div

    leads = [_map_person(p, req.sector_code) for p in people]
    # Filter out entries with no company name
    leads = [l for l in leads if l.company_name and l.company_name != "Unknown"]

    logger.info(
        "[discovery] Apollo returned %d people, %d total (page %d/%d)",
        len(leads), total, req.page, total_pages,
    )

    warning = None
    if not leads and total == 0:
        warning = "No results found. Try broadening your filters."
    elif len(people) > 0 and not any(p.get("email") for p in people):
        warning = (
            "Apollo returned results but emails are masked on the free/starter plan. "
            "Use 'Enrich Lead' after importing to reveal emails via Hunter.io."
        )

    return DiscoverResponse(
        leads=leads,
        total=total,
        page=pagination.get("page", req.page),
        per_page=per_page_resp,
        total_pages=total_pages,
        warning=warning,
    )
