# Versioning and commits (mandatory)

**Source of truth:** `package.json` → `"version"`  
**Runtime display:** `/health` and `X-App-Version` read that field (do not hardcode in `src/server.js`).

## Semver shape

`MAJOR.MINOR.PATCH` (example: `1.60.0`)

| Bump | When | Example |
|------|------|---------|
| **PATCH** (`1.60.0` → `1.60.1`) | Same line of work: fix, polish, follow-up, docs for that release, small related ops | Worker healthcheck fix after worker was just added |
| **MINOR** (`1.60.0` → `1.61.0`) | Different feature or workstream; new capability area | Sales chrome done, then start capacity/security track |
| **MAJOR** (`1.60.0` → `2.0.0`) | Breaking product/API contract or launch milestone Lee designates | Rare; explicit only |

## Rules for every material commit

1. **Decide bump type first** (same stream → patch; different stream → minor).  
2. **Update `package.json` `"version"`** before or in the same commit.  
3. **Commit message must include the version**, e.g.  
   - `v1.60.1: fix worker Railway healthcheck`  
   - `v1.61.0: capacity platform track + Postgres seed evidence`  
4. **Update `docs/STATUS.md` app version** to match when the change is user-facing or ops-visible.  
5. **Never** leave package at `1.60.0` while the commit is “the next thing” after `1.60.0` without a bump.  
6. **Never** invent a version only in the commit title without changing `package.json`.

## What counts as “same” vs “different”

**Same stream (patch):**  
- Bugfix / regression for the last shipped behaviour  
- Docs/STATUS that only record that ship  
- Config tweak required for that ship to work  

**Different stream (minor):**  
- New feature area (sales vs auth vs HMRC vs capacity vs practice)  
- New Railway service or platform capability line  
- Taxpayer overhaul checkpoint after an unrelated ops ship  

If unsure: prefer **minor** over hiding unrelated work under a patch of the previous number.

## Commands

```bash
# Patch: 1.60.0 → 1.60.1
npm run version:patch

# Minor: 1.60.0 → 1.61.0
npm run version:minor

# Major (rare)
npm run version:major
```

Then commit with the new version in the message.

## Agents

Standing order: every material commit ships a **bumped** `package.json` version and names that version in the commit subject. No “silent” versionless product commits.
