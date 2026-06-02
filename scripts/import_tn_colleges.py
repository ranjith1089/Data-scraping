"""
One-shot importer that reads the TN College Directory HTML file and POSTs
every college as a Lead under the `education` sector in AveonApex.

Why a standalone script (not a backend migration)?
- The source file is a local browser artifact the user downloaded; it is
  not something we want to bake into the backend repo or its migrations.
- Lead creation already goes through the hardened `/api/v1/leads/` POST
  endpoint, which enforces the same validation (regex on email/phone,
  sector FK, tenant scoping, etc.) that the web app uses. Reusing it
  keeps the import path identical to the production write path.

Usage (from the repo root):

    py scripts/import_tn_colleges.py \
        --file "C:/Users/Ranjith/Downloads/TN_Directory_2022_Final_2.html" \
        --email admin@aveonapex.ai \
        --password admin123 \
        --api https://data-scraping-production.up.railway.app/api/v1

Optional flags:
    --sector education      sector_code to attach every lead to (default: education)
    --workers 16            number of parallel HTTP workers (default: 16)
    --dry-run               parse + normalize but don't POST anything
    --limit N               only import the first N rows (handy for smoke tests)
    --dedupe                skip rows whose company_name is already in the DB
                            for this tenant + sector

The HTML file encodes the directory as a single JavaScript array
`var D = [[...], [...], ...]` embedded in a <script> block. Each row has
this shape (see the column header table in the HTML):

    [
      0  district,
      1  college_name,
      2  city,
      3  stream                 ("Arts & Science" | "Engineering" | ...)
      4  stream_code            ("arts" | "eng" | "poly" | "iti" | ...)
      5  coordinator_name,
      6  coordinator_email,
      7  phone,
      8  principal_name,
      9  naac_status            ("YES" | "NO" | "")
      10 naac_cert_no,
      11 naac_date,
      12 naac_source,
      13 (unused),
      14 (unused),
      15 source                 (where AveonApex originally scraped this row)
      16 link,
      17 naac_grade             ("A+" | "A" | "B++" | ...)
    ]

The importer is idempotent-friendly: it catches 4xx duplicates, retries
transient 5xx once, and prints a tidy summary at the end.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def extract_rows(html_path: Path) -> List[List[str]]:
    """Pull the `var D = [...]` JS array out of the HTML file.

    The JS array uses double-quoted strings exclusively, so after we strip
    the `var D = ` prefix and the trailing `;`, the payload is valid JSON
    and can be parsed with `json.loads` — no JS engine required.
    """
    text = html_path.read_text(encoding="utf-8", errors="replace")

    # Use a non-greedy match up to the first `];` that closes the array.
    match = re.search(r"var\s+D\s*=\s*(\[.*?\])\s*;", text, re.DOTALL)
    if not match:
        raise RuntimeError(
            "Could not locate the `var D = [...]` data array in the HTML file. "
            "Has the file format changed?"
        )

    raw = match.group(1)
    try:
        rows = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Failed to parse data array as JSON: {exc}. "
            "The JS array may contain single-quoted strings or trailing commas."
        )

    if not isinstance(rows, list) or not rows:
        raise RuntimeError("Parsed data array is empty or not a list.")

    return rows


# ---------------------------------------------------------------------------
# Normalization — match backend/schemas/lead.py::LeadCreate validation
# ---------------------------------------------------------------------------

# Backend regex: ^[^@\s]+@[^@\s]+\.[^@\s]+$
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# Backend regex: ^\+?[\d\s-]{7,20}$
_PHONE_RE = re.compile(r"^\+?[\d\s-]{7,20}$")


def _clean(value: Any) -> Optional[str]:
    """Strip + coerce empty-ish values to None."""
    if value is None:
        return None
    s = str(value).strip()
    if not s or s.lower() in {"na", "n/a", "none", "null", "-"}:
        return None
    return s


def _normalize_phone(value: Any) -> Optional[str]:
    """Massage raw phone strings into the backend's strict regex shape.

    The source file has formats like `(044) 42062100`, `04652-236220`,
    `+91 9490491322`. The backend only accepts digits, spaces, hyphens, and
    an optional leading +, with length 7-20. We strip parens/dots/slashes
    and collapse internal whitespace.
    """
    s = _clean(value)
    if not s:
        return None

    # Remove parentheses, dots, forward slashes, commas — anything that's
    # not digit / space / hyphen / plus.
    cleaned = re.sub(r"[^\d\s\-\+]", "", s)
    # Collapse runs of whitespace.
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    if _PHONE_RE.match(cleaned):
        return cleaned

    # Fall back: keep digits only. If it fits, use it; else drop.
    digits_only = re.sub(r"\D", "", s)
    if 7 <= len(digits_only) <= 20:
        return digits_only

    return None


def _normalize_email(value: Any) -> Optional[str]:
    s = _clean(value)
    if not s:
        return None
    # Lowercase, strip surrounding whitespace.
    s = s.lower()
    # Sometimes the HTML has "email1,email2" — keep the first.
    s = s.split(",")[0].strip()
    if _EMAIL_RE.match(s):
        return s
    return None


def _build_sub_industry(stream: Optional[str], stream_code: Optional[str]) -> Optional[str]:
    """Preserve the stream info as sub_industry so it isn't lost."""
    stream = _clean(stream)
    code = _clean(stream_code)
    if stream and code:
        return f"{stream} ({code})"
    return stream or code


def normalize_row(row: List[Any], sector_code: str) -> Optional[Dict[str, Any]]:
    """Convert one HTML row into a LeadCreate-compatible dict.

    Returns None if the row has no usable company_name (required field).
    """
    # Defensive index access — the HTML has 18-column rows but we don't
    # want a one-off short row to blow up the whole import.
    def at(i: int) -> Any:
        return row[i] if i < len(row) else None

    company_name = _clean(at(1))
    if not company_name:
        return None

    district = _clean(at(0))
    city = _clean(at(2))
    stream = at(3)
    stream_code = at(4)
    coordinator = _clean(at(5))
    email = _normalize_email(at(6))
    phone = _normalize_phone(at(7))
    principal = _clean(at(8))
    naac_status = _clean(at(9))
    naac_cert = _clean(at(10))
    naac_date = _clean(at(11))
    source_tag = _clean(at(15))
    link = _clean(at(16))
    naac_grade = _clean(at(17))

    # Prefer principal name as the primary contact (it's the decision maker);
    # fall back to the coordinator if no principal is listed.
    contact_name = principal or coordinator

    # Build a website field from the link column if it looks like a URL.
    website = link if link and link.startswith(("http://", "https://")) else None

    # Stash the auxiliary fields in custom_fields so the front-end can
    # surface them later without losing anything on the way in.
    custom_fields: Dict[str, Any] = {}
    if naac_status:
        custom_fields["naac_status"] = naac_status
    if naac_grade:
        custom_fields["naac_grade"] = naac_grade
    if naac_cert:
        custom_fields["naac_cert_no"] = naac_cert
    if naac_date:
        custom_fields["naac_date"] = naac_date
    if source_tag:
        custom_fields["source_dataset"] = source_tag
    if coordinator and principal and coordinator != principal:
        custom_fields["coordinator_name"] = coordinator
    if link and not website:
        custom_fields["link"] = link

    # Tag each row with its stream so users can filter inside the
    # Education sector (Engineering vs Arts & Science vs Polytechnic, etc.)
    tags: List[str] = []
    code_str = _clean(stream_code)
    stream_str = _clean(stream)
    if code_str:
        tags.append(f"stream:{code_str}")
    if naac_status == "YES":
        tags.append("naac:yes")
    elif naac_status == "NO":
        tags.append("naac:no")
    if naac_grade:
        tags.append(f"grade:{naac_grade}")

    payload: Dict[str, Any] = {
        "sector_code": sector_code,
        "company_name": company_name[:200],
        "industry": "Education",
        "sub_industry": (_build_sub_industry(stream_str, code_str) or "")[:100] or None,
        "state": "Tamil Nadu",
        "district": district[:100] if district else None,
        "city": city[:100] if city else None,
        "website": website[:500] if website else None,
        "contact_name": contact_name[:100] if contact_name else None,
        "designation": "Principal" if principal else ("Coordinator" if coordinator else None),
        "email": email,
        "phone": phone,
        "tags": tags,
        "source": "import",
        "custom_fields": custom_fields or None,
    }

    # Strip None-valued keys so we don't send nulls that trip validation
    # on optional regex fields (email/phone/pincode).
    return {k: v for k, v in payload.items() if v is not None}


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------


class AveonApexClient:
    def __init__(self, base_url: str, email: str, password: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self._login(email, password)

    def _login(self, email: str, password: str) -> None:
        resp = self.session.post(
            f"{self.base_url}/auth/login",
            json={"email": email, "password": password},
            timeout=30,
        )
        resp.raise_for_status()
        token = resp.json()["access_token"]
        self.session.headers["Authorization"] = f"Bearer {token}"

    def list_company_names(self, sector_code: str) -> set:
        """Return every existing company_name for this tenant + sector.

        We page through /leads/?sector_code=... so we can cheaply dedupe
        client-side without adding a backend endpoint.
        """
        names: set = set()
        page = 1
        per_page = 200
        while True:
            resp = self.session.get(
                f"{self.base_url}/leads/",
                params={
                    "sector_code": sector_code,
                    "page": page,
                    "per_page": per_page,
                },
                timeout=60,
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("items", [])
            for row in items:
                name = row.get("company_name")
                if name:
                    names.add(name.strip().lower())
            total_pages = data.get("total_pages", 1)
            if page >= total_pages or not items:
                break
            page += 1
        return names

    def create_lead(self, payload: Dict[str, Any]) -> tuple[int, str]:
        """POST one lead. Returns (status_code, short_message)."""
        for attempt in (1, 2):
            try:
                resp = self.session.post(
                    f"{self.base_url}/leads/",
                    json=payload,
                    timeout=30,
                )
            except requests.RequestException as exc:
                if attempt == 2:
                    return 0, f"network: {exc}"
                time.sleep(0.5)
                continue

            if resp.status_code == 201:
                return 201, "ok"
            if 500 <= resp.status_code < 600 and attempt == 1:
                time.sleep(0.5)
                continue
            # Return 4xx immediately — the payload itself is bad.
            body = resp.text[:160].replace("\n", " ")
            return resp.status_code, body
        return 0, "unreachable"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", required=True, help="Path to TN_Directory HTML file")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument(
        "--api",
        default="https://data-scraping-production.up.railway.app/api/v1",
        help="Base URL of the AveonApex API (default: production Railway)",
    )
    parser.add_argument("--sector", default="education", help="sector_code (default: education)")
    parser.add_argument("--workers", type=int, default=16, help="parallel HTTP workers")
    parser.add_argument("--limit", type=int, default=0, help="stop after N rows (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="parse + normalize only")
    parser.add_argument(
        "--dedupe",
        action="store_true",
        help="skip rows whose company_name already exists in the tenant+sector",
    )
    args = parser.parse_args()

    html_path = Path(args.file)
    if not html_path.is_file():
        print(f"[!] File not found: {html_path}", file=sys.stderr)
        return 2

    print(f"[1/4] Parsing {html_path.name}...")
    rows = extract_rows(html_path)
    print(f"      extracted {len(rows)} raw rows")

    print(f"[2/4] Normalizing rows...")
    payloads: List[Dict[str, Any]] = []
    skipped = 0
    for row in rows:
        p = normalize_row(row, sector_code=args.sector)
        if p is None:
            skipped += 1
            continue
        payloads.append(p)
    print(f"      {len(payloads)} importable, {skipped} skipped (missing company_name)")

    if args.limit and len(payloads) > args.limit:
        print(f"      --limit={args.limit} -> truncating")
        payloads = payloads[: args.limit]

    if args.dry_run:
        print("\n[DRY RUN] Sample payload:")
        print(json.dumps(payloads[0], indent=2, ensure_ascii=False))
        print(f"\n[DRY RUN] Would POST {len(payloads)} leads. Exiting.")
        return 0

    print(f"[3/4] Authenticating as {args.email} against {args.api} ...")
    try:
        client = AveonApexClient(args.api, args.email, args.password)
    except requests.HTTPError as exc:
        print(f"[!] Login failed: {exc.response.status_code} {exc.response.text[:200]}")
        return 3

    if args.dedupe:
        print(f"      fetching existing company_names in sector={args.sector} ...")
        existing = client.list_company_names(args.sector)
        print(f"      found {len(existing)} existing leads, filtering...")
        before = len(payloads)
        payloads = [
            p for p in payloads
            if p["company_name"].strip().lower() not in existing
        ]
        print(f"      filtered {before - len(payloads)} duplicates, {len(payloads)} remain")

    print(f"[4/4] Uploading {len(payloads)} leads with {args.workers} workers...")
    start = time.time()
    created = 0
    failed = 0
    failures: List[tuple[str, int, str]] = []

    def _submit(payload):
        status, msg = client.create_lead(payload)
        return payload, status, msg

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(_submit, p) for p in payloads]
        for idx, fut in enumerate(as_completed(futures), start=1):
            payload, status, msg = fut.result()
            if status == 201:
                created += 1
            else:
                failed += 1
                failures.append((payload.get("company_name", "?"), status, msg))
            if idx % 100 == 0 or idx == len(futures):
                elapsed = time.time() - start
                rate = idx / elapsed if elapsed > 0 else 0
                print(
                    f"      {idx}/{len(futures)}  ok={created}  fail={failed}  "
                    f"rate={rate:.1f}/s  elapsed={elapsed:.1f}s"
                )

    elapsed = time.time() - start
    print(f"\n--- DONE in {elapsed:.1f}s ---")
    print(f"  created: {created}")
    print(f"  failed:  {failed}")
    if failures:
        print("\nFirst 10 failures:")
        for name, status, msg in failures[:10]:
            print(f"  [{status}] {name}: {msg}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
