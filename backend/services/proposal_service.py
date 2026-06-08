"""Proposal generation service — sector-aware AI prompts + content renderers.

Sector mapping:
  it_ites           → Software / IT Services
  education         → EdTech / Educational Institutions
  marketing_media   → Agencies / Marketing & Media
  (default)         → Generic B2B
"""

from __future__ import annotations

import html as _html_module
import logging
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.lead import Lead
from models.sector import Sector
from services.claude_service import claude_service
from services.sector_config import get_sector_config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sector personas
# ---------------------------------------------------------------------------

_SECTOR_PERSONAS: dict[str, dict] = {
    "it_ites": {
        "sector_name": "IT & Software Services",
        "buyer": "CTO / VP Engineering / IT Head",
        "pain_points": [
            "scaling tech teams without ballooning HR costs",
            "missed project deadlines due to talent gaps",
            "integration complexity with legacy systems",
            "data security and compliance pressure",
            "high attrition in technical roles",
        ],
        "value_angles": [
            "faster time-to-market via dedicated development pods",
            "significant cost savings vs. in-house hiring",
            "deep domain expertise in cloud, AI, and DevOps",
            "transparent milestone-based delivery with daily standups",
            "IP protection and NDA-first engagement model",
        ],
    },
    "education": {
        "sector_name": "Education & EdTech",
        "buyer": "Principal / Director / Academic Head / L&D Manager",
        "pain_points": [
            "student engagement and retention challenges",
            "digital transformation without disrupting existing workflows",
            "teacher training and upskilling overhead",
            "compliance with NEP 2020 and accreditation bodies",
            "budget constraints vs. learning outcome expectations",
        ],
        "value_angles": [
            "outcome-based learning with measurable impact metrics",
            "seamless LMS integration with existing tools",
            "turnkey implementation with on-site faculty training",
            "NAAC / NBA accreditation documentation support",
            "multi-lingual content for regional language institutions",
        ],
    },
    "marketing_media": {
        "sector_name": "Marketing, Media & Agencies",
        "buyer": "Founder / Marketing Director / Head of Growth",
        "pain_points": [
            "rising client acquisition costs and shrinking margins",
            "white-label service gaps causing scope creep",
            "creative fatigue and campaign stagnation",
            "attribution and ROI reporting pressure from clients",
            "scaling delivery without proportional headcount increase",
        ],
        "value_angles": [
            "white-label AI tools you can resell to your clients",
            "proven playbooks for performance marketing in India",
            "reduced CAC through smart outreach automation",
            "real-time ROI dashboards that impress clients",
            "a scalable retainer model that grows with you",
        ],
    },
}

_DEFAULT_PERSONA: dict = {
    "sector_name": "B2B",
    "buyer": "Decision Maker",
    "pain_points": [
        "operational inefficiency slowing growth",
        "scaling challenges without proportional cost increase",
        "manual processes consuming team bandwidth",
    ],
    "value_angles": [
        "measurable ROI from day one",
        "proven implementation track record",
        "dedicated onboarding and support",
    ],
}

_TYPE_LABEL: dict[str, str] = {
    "service_proposal": "Service Proposal",
    "project_quote": "Project Quote",
    "intro_letter": "Introduction Letter",
}

_TONE_DESC: dict[str, str] = {
    "professional": "professional and authoritative",
    "friendly": "warm and conversational",
    "formal": "highly formal and precise",
    "consultative": "consultative and advisory",
}


# ---------------------------------------------------------------------------
# Core AI generation
# ---------------------------------------------------------------------------


async def generate_proposal(
    *,
    db: AsyncSession,
    tenant_id: UUID,
    user_id: UUID,
    lead_id: UUID,
    proposal_type: str = "service_proposal",
    tone: str = "professional",
    product_description: Optional[str] = None,
) -> dict:
    """Call the AI and return the raw sections dict.

    The caller is responsible for persisting the Proposal ORM row.
    """
    # ── Load lead ─────────────────────────────────────────────────────────
    lead = await db.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")

    # ── Sector context ────────────────────────────────────────────────────
    sector_code = lead.sector_code or ""
    persona = _SECTOR_PERSONAS.get(sector_code, _DEFAULT_PERSONA)
    sector_config = get_sector_config(sector_code) or {}

    result = await db.execute(select(Sector).where(Sector.code == sector_code))
    db_sector = result.scalar_one_or_none()
    sector_name = (
        (db_sector.name if db_sector else None)
        or sector_config.get("name")
        or persona["sector_name"]
    )

    tone_desc = _TONE_DESC.get(tone, "professional and authoritative")
    doc_type = _TYPE_LABEL.get(proposal_type, "Service Proposal")
    product_line = (
        f"Service/Product being proposed: {product_description}"
        if product_description
        else "Service/Product: AveonApex CRM & AI Outreach Platform (AI-powered B2B sales automation for Indian markets)"
    )

    # ── Prompts ───────────────────────────────────────────────────────────
    pain_bullet = "\n".join(f"- {p}" for p in persona["pain_points"])
    value_bullet = "\n".join(f"- {v}" for v in persona["value_angles"])

    system = (
        f"You are a senior B2B sales consultant drafting a compelling {doc_type} "
        f"for the {sector_name} sector in India.\n"
        f"Buyer persona: {persona['buyer']}.\n\n"
        f"Their pain points:\n{pain_bullet}\n\n"
        f"Our value angles:\n{value_bullet}\n\n"
        f"Writing style: {tone_desc}.\n\n"
        "Rules:\n"
        "- Be specific to the sector — no generic corporate jargon.\n"
        "- Use Indian market context (₹ for currency, real India-specific examples).\n"
        "- Every field must contain substantive, usable content — never placeholder text.\n"
        "- Respond ONLY with valid JSON. No markdown fences. No prose outside the JSON."
    )

    company = lead.company_name or "the company"
    contact = lead.contact_name or "the decision maker"
    designation = lead.designation or persona["buyer"]
    location = ", ".join(filter(None, [lead.district, lead.state])) or "India"
    size = lead.company_size or "mid-size"

    user_msg = (
        f"Draft a {doc_type} for this prospect:\n\n"
        f"Company: {company} ({size} company, {location})\n"
        f"Contact: {contact}, {designation}\n"
        f"Sector: {sector_name}\n"
        f"{product_line}\n"
        f"Tone: {tone_desc}\n\n"
        "Return this exact JSON (fill every field with real content):\n"
        "{\n"
        '  "title": "Compelling proposal title specific to this company",\n'
        '  "executive_summary": "2–3 paragraphs addressing their specific pain points. Show you understand their world.",\n'
        '  "scope_of_work": "Detailed description of exactly what will be delivered.",\n'
        '  "key_deliverables": ["Specific deliverable 1", "Specific deliverable 2", "Specific deliverable 3", "Specific deliverable 4"],\n'
        '  "pricing": [\n'
        '    {"item": "Core service name", "description": "What it includes", "price": "₹X,XXX / month"},\n'
        '    {"item": "Add-on or setup", "description": "What it includes", "price": "₹X,XXX one-time"}\n'
        "  ],\n"
        '  "timeline": "Phased implementation plan. E.g.: Phase 1 (Week 1–2): Onboarding & setup. Phase 2 (Week 3–4): ...",\n'
        f'  "why_us": "3–4 specific reasons why AveonApex is the right partner for {company}.",\n'
        '  "next_steps": "Clear 3-step CTA: what happens after they say yes.",\n'
        '  "terms": "Standard terms: payment schedule, proposal validity (30 days), confidentiality. 3–4 lines."\n'
        "}"
    )

    # ── AI call ───────────────────────────────────────────────────────────
    raw = await claude_service.generate_json(
        system=system,
        user_message=user_msg,
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        lead_id=lead_id,
        interaction_type="proposal_gen",
    )

    logger.info(
        "[proposal_service] generated proposal for lead=%s type=%s tone=%s",
        lead_id,
        proposal_type,
        tone,
    )
    return raw


# ---------------------------------------------------------------------------
# Markdown renderer
# ---------------------------------------------------------------------------


def sections_to_markdown(sections: dict, lead_company: str = "") -> str:
    """Convert AI sections dict → clean Markdown document."""
    title = sections.get("title", "Proposal")
    deliverables = sections.get("key_deliverables", [])
    pricing_rows = sections.get("pricing", [])
    next_steps_raw = sections.get("next_steps", "")

    del_lines = "\n".join(f"- {d}" for d in deliverables)

    pricing_md = "| Service | Description | Investment |\n|---------|-------------|------------|\n"
    for row in pricing_rows:
        item = str(row.get("item", "")).replace("|", "\\|")
        desc = str(row.get("description", "")).replace("|", "\\|")
        price = str(row.get("price", "")).replace("|", "\\|")
        pricing_md += f"| {item} | {desc} | {price} |\n"

    # Turn next_steps into bullet list
    if "\n" in next_steps_raw:
        steps_md = next_steps_raw
    else:
        parts = [s.strip() for s in next_steps_raw.split(".") if s.strip()]
        steps_md = "\n".join(f"- {p}" for p in parts) if parts else next_steps_raw

    return f"""# {title}

**Prepared for:** {lead_company}
**Prepared by:** AveonApex

---

## Executive Summary

{sections.get('executive_summary', '')}

---

## Scope of Work

{sections.get('scope_of_work', '')}

---

## Key Deliverables

{del_lines}

---

## Pricing

{pricing_md}

---

## Timeline

{sections.get('timeline', '')}

---

## Why AveonApex

{sections.get('why_us', '')}

---

## Next Steps

{steps_md}

---

## Terms & Conditions

{sections.get('terms', '')}

---

*This proposal is valid for 30 days from the date of issue.*
"""


# ---------------------------------------------------------------------------
# HTML renderer (styled; browser Ctrl+P → PDF)
# ---------------------------------------------------------------------------


def sections_to_html(sections: dict, lead_company: str = "") -> str:
    """Convert sections dict → professionally styled HTML document."""

    def esc(s: object) -> str:
        return _html_module.escape(str(s or ""))

    def paras(text: str) -> str:
        """Wrap double-newline-separated blocks in <p> tags."""
        if not text:
            return ""
        blocks = str(text).split("\n\n")
        return "".join(f"<p>{esc(b.strip())}</p>" for b in blocks if b.strip())

    title = esc(sections.get("title", "Proposal"))
    deliverables = sections.get("key_deliverables", [])
    pricing_rows = sections.get("pricing", [])

    del_html = "".join(f"<li>{esc(d)}</li>" for d in deliverables)

    pricing_html = ""
    for row in pricing_rows:
        pricing_html += (
            f"<tr>"
            f"<td>{esc(row.get('item', ''))}</td>"
            f"<td>{esc(row.get('description', ''))}</td>"
            f"<td class='price'>{esc(row.get('price', ''))}</td>"
            f"</tr>"
        )

    # Format next steps as an ordered list
    next_raw = sections.get("next_steps", "")
    for sep in ("•", "\n-", "\n•", "\n1.", "\n2.", "\n3."):
        next_raw = next_raw.replace(sep, "\n")
    parts = [p.strip().lstrip("-•1234567890.)").strip() for p in next_raw.split("\n") if p.strip().lstrip("-•1234567890.)").strip()]
    if not parts:
        parts = [s.strip() for s in sections.get("next_steps", "").split(".") if s.strip()]
    next_html = "".join(f"<li>{esc(p)}</li>" for p in parts) if parts else f"<li>{esc(sections.get('next_steps', ''))}</li>"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.75;color:#1a1a2e;background:#fff;padding:48px;max-width:900px;margin:0 auto}}
  h1{{font-size:28px;color:#1a1a2e;margin-bottom:8px;font-weight:800;letter-spacing:-0.5px}}
  h2{{font-size:13px;font-weight:700;color:#4f46e5;margin:36px 0 14px;padding-bottom:6px;border-bottom:2px solid #e0e7ff;text-transform:uppercase;letter-spacing:.07em}}
  p{{margin-bottom:14px;color:#374151;font-size:14px}}
  ul,ol{{margin:8px 0 8px 22px}}
  li{{margin-bottom:8px;color:#374151}}
  .header{{border-bottom:3px solid #4f46e5;padding-bottom:22px;margin-bottom:4px}}
  .meta{{color:#6b7280;font-size:12px;margin-top:12px;line-height:2}}
  .meta span{{display:inline-block;margin-right:28px}}
  table{{width:100%;border-collapse:collapse;margin-top:14px;border-radius:8px;overflow:hidden}}
  th{{background:#4f46e5;color:#fff;padding:11px 16px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:600}}
  td{{padding:11px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151}}
  td.price{{font-weight:700;color:#059669;white-space:nowrap}}
  tr:last-child td{{border-bottom:none}}
  tr:nth-child(even) td{{background:#f9fafb}}
  .footer{{margin-top:56px;padding-top:18px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}}
  @media print{{
    body{{padding:24px}}
    h2{{break-after:avoid}}
    table{{break-inside:avoid}}
    .footer{{position:fixed;bottom:0;width:100%}}
  }}
</style>
</head>
<body>
<div class="header">
  <h1>{title}</h1>
  <div class="meta">
    <span><strong>Prepared for:</strong> {esc(lead_company)}</span>
    <span><strong>Prepared by:</strong> AveonApex</span>
  </div>
</div>

<h2>Executive Summary</h2>
{paras(sections.get('executive_summary', ''))}

<h2>Scope of Work</h2>
{paras(sections.get('scope_of_work', ''))}

<h2>Key Deliverables</h2>
<ul>{del_html}</ul>

<h2>Pricing</h2>
<table>
  <thead><tr><th>Service</th><th>Description</th><th>Investment</th></tr></thead>
  <tbody>{pricing_html}</tbody>
</table>

<h2>Timeline</h2>
{paras(sections.get('timeline', ''))}

<h2>Why AveonApex</h2>
{paras(sections.get('why_us', ''))}

<h2>Next Steps</h2>
<ol>{next_html}</ol>

<h2>Terms &amp; Conditions</h2>
{paras(sections.get('terms', ''))}

<div class="footer">This proposal is confidential and valid for 30 days from the date of issue. &copy; AveonApex</div>
</body>
</html>"""
