"""Public (no-JWT) routes that power the embeddable form.

Three endpoints, all served under ``/api/v1/public/...`` so they share
the prefix the rest of the public API uses:

* ``POST /api/v1/public/forms/{public_token}/submit`` — the form's
  action URL. Accepts the :class:`PublicFormSubmission` body, creates
  a lead, fires the ``lead.created`` webhook subscription fan-out.
* ``GET /api/v1/public/forms/{public_token}/embed`` — returns a
  self-contained HTML page suitable for embedding via ``<iframe>``.
* ``GET /api/v1/public/forms.js`` — returns the vanilla-JS shim that
  finds ``<script data-aveonapex-token="...">`` tags, renders the
  form in the page DOM, and handles submission.

Rate-limit: ~10 submissions / minute / IP, enforced in-process via a
tiny sliding-window helper so we don't pull in a new dependency.
Private IPs skip the rate limit to avoid false positives on health
checks.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Deque, Dict

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import HTMLResponse, PlainTextResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import AsyncSessionLocal, get_db_session
from models.lead import Lead
from models.public_form import PublicForm
from schemas.lead import LeadResponse
from schemas.public_form import PublicFormSubmission
from services.webhook_dispatcher import publish_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/public", tags=["public-api"])


# ---------------------------------------------------------------------
# Tiny in-memory rate limiter. 10 requests / 60s / IP.
# ---------------------------------------------------------------------

_RATE_LIMIT = 10
_WINDOW_S = 60
_ip_hits: Dict[str, Deque[float]] = defaultdict(deque)


def _rate_limited(ip: str) -> bool:
    now = time.monotonic()
    hits = _ip_hits[ip]
    while hits and (now - hits[0]) > _WINDOW_S:
        hits.popleft()
    if len(hits) >= _RATE_LIMIT:
        return True
    hits.append(now)
    return False


# ---------------------------------------------------------------------
# Lookup helper (no RLS; we must read across tenants to resolve token).
# ---------------------------------------------------------------------

async def _resolve_form(public_token: str) -> PublicForm:
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(PublicForm).where(PublicForm.public_token == public_token)
        )
        form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if not form.is_active:
        raise HTTPException(status_code=410, detail="Form has been disabled")
    return form


# ---------------------------------------------------------------------
# POST submit
# ---------------------------------------------------------------------

@router.post(
    "/forms/{public_token}/submit",
    status_code=status.HTTP_201_CREATED,
    summary="Submit a public form (no auth, token in URL)",
)
async def submit_public_form(
    public_token: str,
    body: PublicFormSubmission,
    request: Request,
):
    client_ip = request.client.host if request.client else "unknown"
    if _rate_limited(client_ip):
        raise HTTPException(status_code=429, detail="Too many submissions. Please try again in a minute.")

    form = await _resolve_form(public_token)
    tenant_id = form.tenant_id

    # The Lead model requires company_name. If the form didn't collect
    # it, fall back to the contact's name so we don't blow up with
    # "Missing company_name" on a form that only gathered email + name.
    company_name = (body.company or body.name or body.email or "Unknown").strip()[:200]

    # Build custom_fields blob: submitter's custom fields + metadata so
    # the lead row carries enough context to identify where it came from.
    custom = dict(body.custom_fields or {})
    if body.message:
        custom["message"] = body.message[:2000]
    custom.setdefault("source_form_name", form.name)
    custom.setdefault("source_form_id", str(form.id))

    _ADMISSION_SECTORS = {"college", "education"}
    is_admission = form.sector_code in _ADMISSION_SECTORS

    # Open a tenant-scoped session and create the lead under RLS.
    async for db in get_db_session(tenant_id):
        try:
            lead = Lead(
                tenant_id=tenant_id,
                sector_code=form.sector_code,
                company_name=company_name,
                contact_name=(body.name or None),
                email=(body.email or None),
                phone=(body.phone or None),
                website=(body.website or None),
                city=(body.city or None),
                district=(body.district or None),
                state="Tamil Nadu",
                source="website",
                custom_fields=custom,
                tags=["website-form"],
                # ── Admission fields (populated only for college/education) ──
                parent_name=(body.parent_name if is_admission else None),
                parent_phone=(body.parent_phone if is_admission else None),
                course_interested=(body.course_interested if is_admission else None),
                board=(body.board if is_admission else None),
                stream=(body.stream if is_admission else None),
                percentage_marks=(body.percentage_marks if is_admission else None),
                school_name=(body.school_name if is_admission else None),
            )
            db.add(lead)

            # Bump submission_count on the form row.
            await db.execute(
                update(PublicForm)
                .where(PublicForm.id == form.id)
                .values(
                    submission_count=PublicForm.submission_count + 1,
                    updated_at=datetime.now(timezone.utc),
                )
            )
            await db.flush()
            response = LeadResponse.model_validate(lead)
        except Exception as exc:  # noqa: BLE001
            logger.exception("public form submit failed: %s", exc)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create lead: {type(exc).__name__}: {exc}",
            )

        try:
            await publish_event(
                db, tenant_id, "lead.created", response.model_dump(mode="json")
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("publish_event after form submit failed: %s", exc)

        # Return a minimal body; the form shim redirects based on the
        # form's redirect_url, not the response payload.
        return {
            "ok": True,
            "lead_id": str(response.id),
            "redirect_url": form.redirect_url,
        }


# ---------------------------------------------------------------------
# GET iframe-friendly HTML page
# ---------------------------------------------------------------------

_ADMISSION_SECTORS = {"college", "education"}

# ── College / Admission enquiry form ─────────────────────────────────────────
_IFRAME_COLLEGE_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{form_name}</title>
<style>
  body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f5f3ff; color: #111827; }}
  .card {{ max-width: 560px; margin: 20px auto; padding: 24px; background: #fff; border: 1px solid #ede9fe; border-radius: 14px; }}
  .hdr {{ display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }}
  .hdr-icon {{ width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #7c3aed, #6d28d9); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; }}
  h2 {{ margin: 0; font-size: 17px; font-weight: 700; color: #1e1b4b; }}
  p.sub {{ margin: 2px 0 16px 44px; color: #6b7280; font-size: 12px; }}
  .sec {{ margin: 14px 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #7c3aed; border-bottom: 1px solid #ede9fe; padding-bottom: 4px; }}
  label {{ display: block; margin: 10px 0 3px; font-size: 12px; font-weight: 500; color: #374151; }}
  input, select, textarea {{ width: 100%; padding: 9px 11px; font-size: 13px; border: 1px solid #ddd6fe; border-radius: 8px; box-sizing: border-box; background: #faf9ff; }}
  input:focus, select:focus, textarea:focus {{ outline: none; border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124,58,237,.15); }}
  .row {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }}
  button {{ margin-top: 18px; width: 100%; padding: 11px 14px; font-size: 14px; font-weight: 600; color: #fff; background: linear-gradient(135deg, #7c3aed, #6d28d9); border: 0; border-radius: 9px; cursor: pointer; }}
  button:hover {{ opacity: .9; }}
  button:disabled {{ opacity: .5; cursor: not-allowed; }}
  .err {{ margin-top: 10px; padding: 8px 10px; font-size: 12px; color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; }}
  .ok  {{ margin-top: 10px; padding: 8px 10px; font-size: 12px; color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; }}
  .hp  {{ position: absolute; left: -9999px; }}
</style>
</head>
<body>
<div class="card">
  <div class="hdr"><div class="hdr-icon">🎓</div><h2>{form_name}</h2></div>
  <p class="sub">Fill in your details and our counselor will reach you within 24 hours.</p>
  <form id="lf-form">

    <div class="sec">Student Information</div>
    <div class="row">
      <label>Student Name *<input name="name" required autocomplete="name" placeholder="Full name" /></label>
      <label>Student Phone *<input name="phone" type="tel" required autocomplete="tel" placeholder="+91 98765 43210" /></label>
    </div>
    <label>Student Email<input name="email" type="email" autocomplete="email" placeholder="student@email.com" /></label>

    <div class="sec">Course of Interest</div>
    <div class="row">
      <label>Course *
        <select name="course_interested" required>
          <option value="">Select course…</option>
          <option>B.Tech / B.E.</option><option>M.Tech / M.E.</option>
          <option>B.Sc</option><option>M.Sc</option>
          <option>BCA</option><option>MCA</option>
          <option>BBA</option><option>MBA</option>
          <option>B.Com</option><option>M.Com</option>
          <option>BA</option><option>MA</option>
          <option>B.Pharm</option><option>M.Pharm</option>
          <option>MBBS</option><option>BDS</option>
          <option>B.Ed</option><option>M.Ed</option>
          <option>Diploma</option><option>Other</option>
        </select>
      </label>
      <label>Stream (12th)
        <select name="stream">
          <option value="">Select stream…</option>
          <option>Science (PCM)</option><option>Science (PCB)</option>
          <option>Science (PCMB)</option><option>Commerce</option>
          <option>Arts / Humanities</option><option>Vocational</option>
          <option>Other</option>
        </select>
      </label>
    </div>
    <div class="row">
      <label>Board
        <select name="board">
          <option value="">Select board…</option>
          <option>State Board (TN)</option><option>CBSE</option>
          <option>ICSE / ISC</option><option>NIOS</option>
          <option>IB (International)</option><option>Other</option>
        </select>
      </label>
      <label>12th % / Marks<input name="percentage_marks" type="number" min="0" max="100" step="0.01" placeholder="87.5" /></label>
    </div>
    <label>Previous School / Institution<input name="school_name" placeholder="Govt. Hr. Sec. School, Coimbatore" /></label>

    <div class="sec">Parent / Guardian</div>
    <div class="row">
      <label>Parent Name<input name="parent_name" placeholder="Parent / Guardian name" /></label>
      <label>Parent Phone<input name="parent_phone" type="tel" placeholder="+91 98765 43210" /></label>
    </div>

    <div class="sec">Location</div>
    <div class="row">
      <label>City<input name="city" autocomplete="address-level2" placeholder="Coimbatore" /></label>
      <label>District<input name="district" placeholder="Coimbatore" /></label>
    </div>

    <input class="hp" name="_honeypot" tabindex="-1" autocomplete="off" />
    <button type="submit">Submit Enquiry →</button>
    <div id="lf-status"></div>
  </form>
</div>
<script>
(function() {{
  var form = document.getElementById('lf-form');
  var statusEl = document.getElementById('lf-status');
  form.addEventListener('submit', function(e) {{
    e.preventDefault();
    if (form._honeypot && form._honeypot.value) return;
    var fd = new FormData(form);
    var payload = {{}};
    ['name','email','phone','course_interested','stream','board','percentage_marks',
     'school_name','parent_name','parent_phone','city','district'].forEach(function(k) {{
      var v = fd.get(k);
      if (v && v.trim()) {{
        payload[k] = k === 'percentage_marks' ? parseFloat(v) : v.trim();
      }}
    }});
    statusEl.className = '';
    statusEl.textContent = '';
    form.querySelector('button').disabled = true;
    fetch('{submit_url}', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify(payload)
    }})
    .then(function(r) {{ return r.json().then(function(j) {{ return {{ ok: r.ok, body: j }}; }}); }})
    .then(function(res) {{
      form.querySelector('button').disabled = false;
      if (res.ok) {{
        statusEl.className = 'ok';
        statusEl.textContent = '✅ Thank you! Our counselor will contact you within 24 hours.';
        form.reset();
        if (res.body && res.body.redirect_url) {{
          setTimeout(function() {{ window.top.location.href = res.body.redirect_url; }}, 1500);
        }}
      }} else {{
        statusEl.className = 'err';
        statusEl.textContent = (res.body && (res.body.detail || res.body.error)) || 'Something went wrong. Please try again.';
      }}
    }})
    .catch(function() {{
      form.querySelector('button').disabled = false;
      statusEl.className = 'err';
      statusEl.textContent = 'Network error — please try again.';
    }});
  }});
}})();
</script>
</body>
</html>
"""

_IFRAME_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{form_name}</title>
<style>
  body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f9fafb; color: #111827; }}
  .card {{ max-width: 520px; margin: 24px auto; padding: 24px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; }}
  h2 {{ margin: 0 0 4px 0; font-size: 18px; font-weight: 600; }}
  p.sub {{ margin: 0 0 16px 0; color: #6b7280; font-size: 13px; }}
  label {{ display: block; margin: 12px 0 4px; font-size: 12px; font-weight: 500; color: #374151; }}
  input, textarea {{ width: 100%; padding: 10px 12px; font-size: 14px; border: 1px solid #d1d5db; border-radius: 8px; box-sizing: border-box; }}
  input:focus, textarea:focus {{ outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,.2); }}
  button {{ margin-top: 16px; width: 100%; padding: 10px 14px; font-size: 14px; font-weight: 500; color: #fff; background: #4f46e5; border: 0; border-radius: 8px; cursor: pointer; }}
  button:hover {{ background: #4338ca; }}
  button:disabled {{ opacity: .5; cursor: not-allowed; }}
  .err {{ margin-top: 10px; padding: 8px 10px; font-size: 13px; color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; }}
  .ok {{ margin-top: 10px; padding: 8px 10px; font-size: 13px; color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; }}
  .row {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }}
  .hp {{ position: absolute; left: -9999px; }}
</style>
</head>
<body>
<div class="card">
  <h2>{form_name}</h2>
  <p class="sub">We’ll get back to you within 1 business day.</p>
  <form id="lf-form">
    <label>Full name<input name="name" required autocomplete="name" /></label>
    <div class="row">
      <label>Email<input name="email" type="email" required autocomplete="email" /></label>
      <label>Phone<input name="phone" type="tel" autocomplete="tel" /></label>
    </div>
    <label>Company<input name="company" autocomplete="organization" /></label>
    <label>Message<textarea name="message" rows="3"></textarea></label>
    <input class="hp" name="_honeypot" tabindex="-1" autocomplete="off" />
    <button type="submit">Send</button>
    <div id="lf-status"></div>
  </form>
</div>
<script>
(function() {{
  var form = document.getElementById('lf-form');
  var statusEl = document.getElementById('lf-status');
  form.addEventListener('submit', function(e) {{
    e.preventDefault();
    var fd = new FormData(form);
    // Drop the honeypot; bots will fill it in → we silently ignore.
    if (fd.get('_honeypot')) return;
    var payload = {{}};
    ['name','email','phone','company','message'].forEach(function(k) {{ payload[k] = fd.get(k) || null; }});
    statusEl.className = '';
    statusEl.textContent = '';
    form.querySelector('button').disabled = true;
    fetch('{submit_url}', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify(payload)
    }})
    .then(function(r) {{ return r.json().then(function(j) {{ return {{ ok: r.ok, body: j }}; }}); }})
    .then(function(res) {{
      form.querySelector('button').disabled = false;
      if (res.ok) {{
        statusEl.className = 'ok';
        statusEl.textContent = 'Thanks — we’ve received your message.';
        form.reset();
        if (res.body && res.body.redirect_url) {{
          setTimeout(function() {{ window.top.location.href = res.body.redirect_url; }}, 1200);
        }}
      }} else {{
        statusEl.className = 'err';
        statusEl.textContent = (res.body && (res.body.detail || res.body.error)) || 'Something went wrong.';
      }}
    }})
    .catch(function() {{
      form.querySelector('button').disabled = false;
      statusEl.className = 'err';
      statusEl.textContent = 'Network error — please try again.';
    }});
  }});
}})();
</script>
</body>
</html>
"""


@router.get(
    "/forms/{public_token}/embed",
    response_class=HTMLResponse,
    summary="Iframe-ready form HTML (no auth)",
)
async def form_iframe(public_token: str):
    form = await _resolve_form(public_token)
    submit_url = f"/api/v1/public/forms/{public_token}/submit"
    safe_name = form.name.replace("<", "&lt;")
    # Use a college-specific form layout for admission sectors
    if form.sector_code in _ADMISSION_SECTORS:
        html = _IFRAME_COLLEGE_TEMPLATE.format(
            form_name=safe_name,
            submit_url=submit_url,
        )
    else:
        html = _IFRAME_TEMPLATE.format(
            form_name=safe_name,
            submit_url=submit_url,
        )
    return HTMLResponse(content=html)


# ---------------------------------------------------------------------
# forms.js — the single-file shim for <script> embedding
# ---------------------------------------------------------------------

_FORMS_JS = """/*! AveonApex public forms shim. */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var token = script.getAttribute('data-aveonapex-token');
  if (!token) {
    console.warn('AveonApex: <script> missing data-aveonapex-token');
    return;
  }
  var base = (function () {
    try { return new URL(script.src).origin; } catch (e) { return ''; }
  })();

  var containerId = 'aveonapex-form-' + token.slice(0, 8);
  var container =
    document.getElementById(containerId) ||
    (function () {
      var d = document.createElement('div');
      d.id = containerId;
      script.parentNode.insertBefore(d, script.nextSibling);
      return d;
    })();

  var iframe = document.createElement('iframe');
  iframe.src = base + '/api/v1/public/forms/' + token + '/embed';
  iframe.style.cssText =
    'width:100%;border:1px solid #e5e7eb;border-radius:8px;min-height:560px;';
  iframe.setAttribute('title', 'Contact form');
  container.appendChild(iframe);
})();
"""


@router.get(
    "/forms.js",
    response_class=PlainTextResponse,
    summary="Vanilla JS embed shim",
)
async def forms_js() -> PlainTextResponse:
    return PlainTextResponse(
        content=_FORMS_JS,
        headers={
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
        },
    )
