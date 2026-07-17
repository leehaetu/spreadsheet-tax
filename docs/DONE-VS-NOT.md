# Spreadsheet Tax — done vs not (truth inventory)

**Checked live:** 2026-07-17  
**Live URL:** https://spreadsheet-tax-production.up.railway.app  
**Live version:** **1.10.0** (not 1.9.0 — that was the previous deploy mid-rollout)

This file exists so we stop re-listing finished work as “next steps.”

---

## Access this agent has

| Access | Yes? | What it can do |
|--------|------|----------------|
| GitHub repo | Yes | Commit, push, read code |
| Railway CLI + MCP | Yes | Deploy, vars, status, logs |
| Live product HTTP | Yes | Health, integrity, app-restricted sandbox checks |
| HMRC Developer Hub UI | **No** | Cannot click Hub for you |
| Interactive browser OAuth as you | Partial | Playwright can complete **sandbox test user** OAuth; cannot use your personal Government Gateway |

---

## Software identifiers (what we have)

| Identifier | Value / behaviour | Notes |
|------------|-------------------|--------|
| Product name (code + FPH) | `SpreadsheetTax` | `Gov-Vendor-Product-Name` |
| Deployed app version | From `/health` → **1.10.0** | Also `Gov-Vendor-Version` |
| Vendor license id (FPH) | SHA-256 of license statement | Not an HMRC-issued number |
| HMRC Hub application | Sandbox client credentials on Railway | **Sandbox** app, not Production credentials |
| Official HMRC “recognised software” list ID | **None yet** | Only after Production access + listing process |
| Railway service | `spreadsheet-tax` online | Volume `/app/data` |

There is **no separate HMRC “software number”** issued until you are further through Production / recognition. What we have is product name + version + Hub client id (secret stays on Railway).

---

## User identifiers (layers — do not confuse)

| Layer | What | Unique per? |
|-------|------|-------------|
| **Spreadsheet Tax account** | UUID `users.id` on register | Each product user |
| **Session** | Cookie `st_session` | Each login session |
| **FPH Gov-Client-User-IDs** | `spreadsheet-tax=<user UUID>` when signed in | Product user (not HMRC NINO) |
| **HMRC sandbox test user** | e.g. userId + password from Create Test User | Sandbox GG-style identity |
| **NINO** | e.g. sandbox `TB116925D` | HMRC individual tax identity |
| **MTD IT ID** | e.g. `XPIT00010386888` | HMRC MTD enrolment id |
| **Business ID** | e.g. `XBIS…` from Business Details | Each SE/property business |

We do **not** invent a second fake “SE individual” id. Real HMRC business ids come from **Business Details** after OAuth. Product users are unique UUIDs on register.

---

## HMRC APIs you subscribed (Hub) vs what code uses

| API you added | Used in product code? | Proven with real sandbox HTTP? |
|---------------|----------------------|--------------------------------|
| Self Employment Business 5.0 | **Yes** | **Yes** — period create 200 + periodId (fixture) |
| Property Business 6.0 | **Yes** | Paths + pilot UI; **full HTTP 200 not re-run this session** |
| Business Details 2.0 | **Yes** | **Yes** — list returned business id |
| Obligations 3.0 | **Yes** | Code + UI; **re-run after OAuth** |
| Test Fraud Prevention Headers 1.0 | **Yes** | Validate called; honest omit / may be POTENTIALLY_INVALID |
| Create Test User 1.0 | **Yes** | **Yes** |
| Self Assessment Test Support 1.0 | Available | Setup tooling (not customer UI) |
| Hello World 1.0 | **Yes** | **Yes** sandbox-check |
| Individual Calculations 8.0 | **No** (signpost to HMRC) | Not required if we signpost estimates |
| Business Income Source Summary 3.0 | **No** yet | Optional read |
| Business Source Adjustable Summary 7.0 | **No** yet | End-of-year / later stage |

Subscribing APIs on the Hub ≠ wiring them in software. Extra subscriptions are fine; unused ones do not block in-year bridging.

---

## Product / platform — done

- Railway deploy + volume SQLite  
- Auth (register/login/session) with unique user UUIDs  
- Spreadsheet import → map → validate → server draft  
- Preview submit (double) + sandbox submit when flag + real OAuth  
- Connect HMRC OAuth (sandbox) — Playwright E2E previously passed  
- Receipts / history / drafts  
- Fraud headers honest-omit policy  
- Sales pages, privacy, terms, integrity endpoint  
- `VENDOR_PUBLIC_IP` set to Railway egress **195.180.20.214** (2026-07-17)

## Not done / not claimed

- HMRC **Production** application credentials (and you are right: **not next** until more sandbox evidence)  
- Full VALID_HEADERS green (MFA missing by design for now)  
- Property period HTTP 200 evidence pack completed this session  
- Individual Calculations / BISS / BSAS product journeys  
- Card billing, real email delivery  
- Agent multi-client production path  
- “Recognised software” listing  

---

## E2E UI/UX testing — honest status

| Test | Status |
|------|--------|
| Unit tests (Node) | **102 pass** locally |
| Playwright smoke / visual | Specs exist under `tests/e2e/` |
| Playwright **real sandbox OAuth** against production | Spec exists; **was proven earlier** (`connected: true`, `mock: false`) |
| Full UX journey every release (upload → review → businesses → obligations → all three submits) | **Not continuous CI on every push** — must be re-run deliberately |

---

## What this agent will not do again without reason

- Tell you to create a **Production** Hub app while sandbox property/obligations evidence is still open  
- Claim live health is an old version when `/health` says otherwise  
- Ask you to re-do Hub API subscriptions you already have  
- Invent FPH fields or software ids  

## What still needs a human browser (or Playwright with test user)

- HMRC sandbox **login + Give permission** (can be automated with stored **test** user; cannot use your real GG account without you)  
- Developer Hub form clicks (Production app, checklist) — **your Hub login only**
