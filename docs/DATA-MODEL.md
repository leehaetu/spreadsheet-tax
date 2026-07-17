# Data model (authoritative)

**Status:** Draft for approval (Phase 0.9 / Phase 4)  
**Accountable:** Lee Hine  
**Linked:** [ARCHITECTURE.md](./ARCHITECTURE.md) · [COMPLIANCE-REGISTER.md](./COMPLIANCE-REGISTER.md)

**Rule:** Approve this schema (or a revised version) before expanding Practice features beyond freeze.

---

## 1. Conventions

| Convention | Value |
|------------|--------|
| IDs | UUID v4 (or ULID) as text/uuid |
| Timestamps | `timestamptz` UTC |
| Money | `numeric(14,2)` |
| Soft delete | Prefer `deleted_at` where legal retention allows; hard delete where required |
| Tenant column | `firm_id` on all firm-scoped tables; Personal users may use a personal firm or `owner_user_id` |
| Roles | String constants only (no language enums): `bookkeeper`, `accountant`, `practice_admin`, `client`, `individual` |

---

## 2. Entity list

| Table | Tenant boundary | Purpose |
|-------|-----------------|---------|
| users | self | Identity |
| firms | self | Practice / personal container |
| firm_memberships | firm_id | User ↔ firm + role |
| clients | firm_id | Client records |
| businesses | firm_id (+ client_id) | Income sources (SE / UK / foreign) |
| tax_periods | firm_id | Period windows |
| imports | firm_id | Upload metadata |
| mapping_profiles | firm_id | Reusable mappings |
| validation_results | firm_id | Snapshot of checks |
| draft_submissions | firm_id | Server-owned payload source of truth |
| hmrc_connections | firm_id / user_id | OAuth |
| submission_attempts | firm_id | Attempts + idempotency |
| receipts | firm_id | User-facing confirmation |
| workflow_events | firm_id | Status history |
| audit_events | firm_id (nullable system) | Immutable audit |
| subscriptions | firm_id / user_id | Commercial entitlements |
| entitlements | firm_id / user_id | Feature flags / seats |

---

## 3. Core tables (logical schema)

### users

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| email | citext unique | |
| password_hash | text null | if password auth |
| name | text | |
| mfa_enabled | boolean | |
| created_at / updated_at | timestamptz | |
| deleted_at | timestamptz null | |

### firms

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| name | text | |
| type | text | `personal` \| `sole_practice` \| `multi_accountant` |
| created_at | timestamptz | |

### firm_memberships

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid FK → firms | **tenant** |
| user_id | uuid FK → users | |
| role | text | string role |
| unique | (firm_id, user_id) | |

### clients

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid FK | **tenant** |
| display_name | text | |
| nino_encrypted | bytea/text null | encrypt; minimise storage |
| portal_enabled | boolean | |
| assignee_membership_id | uuid null | |
| workflow_status | text | see transitions |
| period_deadline | date null | |
| created_at / updated_at | timestamptz | |

**Unique:** optional external_ref per firm.

### businesses (income sources)

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid | **tenant** |
| client_id | uuid FK | |
| source_type | text | `self_employment` \| `uk_property` \| `foreign_property` |
| hmrc_business_id | text null | |
| label | text | |
| country_code | char(3) null | foreign |

### tax_periods

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid | **tenant** |
| client_id | uuid | |
| tax_year | text | e.g. 2024-25 |
| period_start / period_end | date | |
| cumulative_rule | text | ref decision ADR |

### imports

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid | **tenant** |
| client_id | uuid null | personal may omit |
| uploaded_by | uuid | user |
| filename | text | |
| content_sha256 | text | |
| storage_uri | text null | if retained |
| retained_until | timestamptz null | |
| created_at | timestamptz | |

**Retention:** see ADR 0006; default prefer process-and-delete bytes; keep metadata.

### mapping_profiles

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid | **tenant** |
| client_id | uuid null | |
| name | text | |
| mapping_json | jsonb | column → canonical field |

### validation_results

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid | **tenant** |
| import_id | uuid FK | |
| ready | boolean | |
| errors_json / warnings_json | jsonb | |

### draft_submissions

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid | **tenant** |
| import_id | uuid FK | |
| client_id | uuid null | |
| state | text | `draft` \| `ready` \| `submitted` \| `rejected` |
| figures_json | jsonb | |
| payloads_json | jsonb | **server-built only** |
| tax_year | text | |
| period_start / period_end | date | |
| created_at / updated_at | timestamptz | |

### hmrc_connections

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid null | |
| user_id | uuid | |
| mode | text | `sandbox` \| `production` |
| authority_type | text | `individual` \| `agent` |
| access_token_encrypted | bytea | |
| refresh_token_encrypted | bytea null | |
| scopes | text | |
| expires_at | timestamptz | |
| revoked_at | timestamptz null | |

### submission_attempts

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid | **tenant** |
| draft_submission_id | uuid FK | |
| idempotency_key | text unique | |
| source_type | text | |
| http_status | int null | |
| hmrc_correlation_id | text null | |
| request_meta_json | jsonb | redacted |
| response_json | jsonb | |
| ok | boolean | |
| created_at | timestamptz | |

### receipts

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid | **tenant** |
| submission_attempt_id | uuid | |
| body_json | jsonb | user-facing summary |
| created_at | timestamptz | |

### workflow_events

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid | **tenant** |
| client_id | uuid | |
| from_status / to_status | text | |
| actor_user_id | uuid | |
| note | text null | |
| created_at | timestamptz | |

### audit_events

| Column | Type | Notes |
|--------|------|--------|
| id | uuid PK | |
| firm_id | uuid null | |
| actor_user_id | uuid null | |
| action | text | |
| entity_type / entity_id | text | |
| meta_json | jsonb | no secrets/NINO plaintext |
| created_at | timestamptz | **append-only** |

### subscriptions / entitlements

Commercial plan, seats, period, resale_flag (Practice license), status.

---

## 4. Workflow status transitions (clients)

```text
awaiting_records → records_received → mapping_required → needs_review
  → client_query → ready_for_approval → ready_to_submit
  → submitted → rejected → correction_required
```

Invalid jumps rejected at application layer; log `workflow_events`.

---

## 5. Deletion and retention (summary)

| Data | Default intent |
|------|----------------|
| Raw spreadsheet bytes | Prefer delete after map; or short retain with `retained_until` |
| Draft payloads | Retain for tax year + N per policy |
| Tokens | Delete on revoke; encrypt at rest |
| Audit events | Long retain; immutable |
| Users | Subject-access / deletion process |

Full schedule: [COMPLIANCE-REGISTER.md](./COMPLIANCE-REGISTER.md).

---

## 6. Seed / test data

| Env | Data |
|-----|------|
| Local / CI | Synthetic only; double mode |
| Staging | Synthetic |
| Pilot | Real only with consent |
| Production | Real |

Never seed production with demo NINOs as live identifiers.

---

## 7. Migration strategy

1. Introduce DB alongside existing in-memory (feature flag).  
2. Migrate Personal drafts first.  
3. Re-implement Practice on DB; retire public demo store.  
4. Backfill forbidden for fake demo clients into production.  

---

## 8. Approval

| Role | Name | Date | Approved |
|------|------|------|----------|
| Product | Lee Hine | | ☐ |
| Engineering | | | ☐ |

---

## 9. Change log

| Date | Change |
|------|--------|
| 2026-07-17 | Initial authoritative draft |
