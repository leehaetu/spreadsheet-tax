# Hard security test — live website + live app

**Date:** 2026-07-18  
**Target:** https://spreadsheet-tax-production.up.railway.app  
**Version under test:** 1.33.3 → fixes shipped **1.33.4**  
**Method:** Live HTTP probing, two-user IDOR, unauth POST matrix, path fuzz, auth/session checks, open-redirect review.  
**Not claimed:** formal CREST pen-test, dependency CVE audit, or red-team social engineering.

---

## Executive summary

A harder pass found **real production issues** beyond the earlier integrity leak:

| Sev | Issue | Status |
|-----|--------|--------|
| **Critical** | `/api/hmrc/sandbox-check` public — leaked credential presence, redirect URI, **sandbox NINO / userId / mtdItId**, passwordStored | **Fixed 1.33.4** (JOBS_SECRET) |
| **High** | Anonymous `POST /api/import/sample` created UUID drafts | **Fixed** (sign-in required) |
| **High** | Anonymous `GET /api/drafts/:id` returned full payloads for unowned drafts | **Fixed** (sign-in + deny null owner without session) |
| **High** | Anonymous `POST /api/submit` could reach approval gate on leaked draft UUIDs | **Fixed** (sign-in required) |
| **High** | Open redirect after login via `?next=https://evil.com` in `signin.html` | **Fixed** (relative path only) |
| **Medium** | Session cookie lacked `Secure` unless `COOKIE_SECURE=1` | **Fixed** (Secure in production/Railway) |
| **Medium** | Forgot-password response leaked “email not configured” | **Fixed** (generic message) |
| **Medium** | No HSTS / Permissions-Policy on all routes | **Fixed** (middleware) |
| **Low** | `X-Powered-By: Express` | **Fixed** (`app.disable`) |
| **OK** | Cross-user draft IDOR (User B → User A draft) | **403** |
| **OK** | Login rate limit | **429** after burst |
| **OK** | Admin HTML | **302 → signin** |
| **OK** | Jobs / metrics / posture without secret | **403** |
| **OK** | Path traversal to package.json/etc | No file leak (template always same CSV) |
| **OK** | Portal token enum | Uniform 404 |

---

## Attack matrix (pre-fix evidence)

### Public info leak — sandbox-check (Critical)

```http
GET /api/hmrc/sandbox-check
→ 200 {
  hasClientId: true,
  hasClientSecret: true,
  redirectUri: "https://…/api/hmrc/callback",
  storedTestUser: {
    userId: "…",
    nino: "TB116925D",
    mtdItId: "XPIT…",
    passwordStored: true
  },
  subscriptionsExpected: [ … ]
}
```

**Impact:** Attack surface map + real sandbox identity material for HMRC test environment.

### Anonymous draft pipeline (High)

1. `POST /api/import/sample` → 200 + `draftId` (no cookie)  
2. `GET /api/drafts/{draftId}` → 200 full payloads including sample NINO  
3. `POST /api/submit` with that draftId → reached `APPROVAL_REQUIRED` (not fully filed, but unauthenticated progress)

### Open redirect (High)

`public/signin.html` after successful login:

```js
location.href = new URLSearchParams(location.search).get('next') || '/home';
```

`?next=https://evil.com` would navigate there after credential entry (phishing).

### IDOR (negative — good)

Two registered users: B could not read or submit A’s draft → **403 Not allowed**.

### Rate limit (good)

Login brute force: 401×5 then **429**.

---

## Fixes in v1.33.4

1. `sandbox-check` → `requireJobsSecret`  
2. Import + sample import → `requireUser`  
3. Submit → `requireUser`  
4. Draft GET by id → `requireUser`  
5. `assertDraftAccess` denies signed-out access to anonymous drafts  
6. Sign-in `next` only allows same-origin relative paths  
7. Cookie `Secure` default on production / Railway  
8. HSTS + Permissions-Policy middleware  
9. Generic forgot-password message  

---

## Residual risks (honest)

| Item | Notes |
|------|--------|
| CSP `unsafe-inline` | XSS impact reduced but not eliminated |
| Sample import still returns sample NINO to **authenticated** users | Fixture data; not customer NINO |
| No automated dependency audit (`npm audit`) in this pass | Run separately |
| No authenticated admin privilege-escalation suite | Admin is sign-in gated HTML only |
| Email reset links when EMAIL_WEBHOOK unset | Token created server-side; response no longer says so |
| Probe accounts created on live | `sec-a-*@probe.example` / `sec-b-*@probe.example` — clean up if desired |

---

## Re-verify after deploy

```bash
# Must be 403
curl -s -o /dev/null -w "%{http_code}\n" https://spreadsheet-tax-production.up.railway.app/api/hmrc/sandbox-check
# Must be 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST …/api/import/sample -H 'Content-Type: application/json' -d '{"sample":"combined"}'
curl -s -o /dev/null -w "%{http_code}\n" -X POST …/api/submit -H 'Content-Type: application/json' -d '{}'
```

---

## Honesty

This was a **thorough agent-driven live security exercise**, not a certified pen-test.  
**Do not** claim “production hardened” or “no vulnerabilities” — claim only what was tested and fixed with evidence.
