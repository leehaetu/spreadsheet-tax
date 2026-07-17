# Architecture

**Status:** Living architecture + ADR index  
**Accountable:** Lee Hine  
**Linked:** [DATA-MODEL.md](./DATA-MODEL.md) · [DECISIONS/](./DECISIONS/) · [HMRC-WORKSTREAM.md](./HMRC-WORKSTREAM.md)

---

## 1. Current system (as-is)

```
Browser (static HTML/CSS/JS)
    │
    ▼
Express (src/server.js)
    ├── static sales + app pages
    ├── POST /api/import (multer memory)
    ├── POST /api/import/sample
    ├── POST /api/submit  ← must not use credentials anonymously
    ├── GET  practice demo APIs (in-memory)
    └── HMRC client (double | sandbox token from env)
            │
            ├── parse → map → validate → payloads → summary
            └── in-memory practice-store (demo only)
```

**Constraints today:** no durable identity/tenancy; XLSX via `xlsx`; single process; Railway-ready.

---

## 2. Target system (to-be)

```
Sales site ──► Personal app ──► Practice workspace
                    │                  │
                    └────────┬─────────┘
                             ▼
              API (authn/authz, rate limits)
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         Import/parse   Draft submit   Practice domain
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    PostgreSQL (tenant-scoped)
                             │
                    HMRC OAuth tokens (encrypted)
                             │
                    HMRC APIs (sandbox / production)
```

**Principles**

1. One bridging engine; two UX shells.  
2. Server owns draft submissions.  
3. Tenant boundary on every query.  
4. No shared multi-client HMRC token.  
5. Demo ≠ pilot ≠ production (environments).  

---

## 3. Decision index (ADRs)

| ID | Title | Status |
|----|-------|--------|
| [0001](./DECISIONS/0001-database-and-hosting.md) | Database and hosting | Proposed |
| [0002](./DECISIONS/0002-authentication.md) | Authentication method | Proposed |
| [0003](./DECISIONS/0003-session-storage.md) | Session storage | Proposed |
| [0004](./DECISIONS/0004-firm-tenancy.md) | Firm tenancy enforcement | Proposed |
| [0005](./DECISIONS/0005-oauth-token-storage.md) | OAuth token storage | Proposed |
| [0006](./DECISIONS/0006-import-retention.md) | Import file retention | Proposed |
| [0007](./DECISIONS/0007-spreadsheet-parser.md) | Spreadsheet parser | Proposed |
| [0008](./DECISIONS/0008-draft-submission-model.md) | Server-owned drafts | Proposed |
| [0009](./DECISIONS/0009-idempotency.md) | Submission idempotency | Proposed |
| [0010](./DECISIONS/0010-audit-log.md) | Audit log immutability | Proposed |

Additional ADRs (email, billing, monitoring, backups) as needed — see delivery plan.

---

## 4. Security architecture (summary)

| Concern | Approach (target) |
|---------|-------------------|
| AuthN | See ADR 0002 |
| AuthZ | Role + firm_id on every protected route |
| CSRF | Token or same-site strategy (ADR) |
| Sessions | Short-lived; secure cookies (ADR 0003) |
| MFA | Required for practice admins (pilot+) |
| Secrets | Env / secret manager; rotation |
| Tokens | Encrypt at rest (ADR 0005) |
| Uploads | Size limits; type checks; safe parser (ADR 0007) |
| Logs | Redact NINO and tokens |
| Headers | Security headers + HMRC fraud-prevention |

Detail and evidence: [SECURITY-LAUNCH-GATE.md](./SECURITY-LAUNCH-GATE.md).

---

## 5. Tenancy enforcement pattern

```text
Request → authenticate user → resolve firm membership
  → authorize role → scope query WHERE firm_id = :firm
  → never accept firm_id solely from client body without membership check
```

Cross-tenant tests are mandatory before pilot multi-user.

---

## 6. Change log

| Date | Change |
|------|--------|
| 2026-07-17 | As-is / to-be + ADR index |
