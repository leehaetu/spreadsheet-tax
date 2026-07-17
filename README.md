# Spreadsheet Tax — HMRC MTD ITSA Bridging App

**Bridging only.** Your records stay in your local spreadsheet. We map your file and submit HMRC Making Tax Digital (Income Tax Self Assessment) quarterly updates for:

- **Self-employment** (trade / business — e.g. hairdresser, plumber)
- **UK property** (landlord)
- **Foreign property** (landlord)

No re-keying of line totals as the primary path: upload → map → preview → submit.

## Quick start

```bash
npm install
npm test
npm start
```

Open http://localhost:3000 for the sales site, http://localhost:3000/app for the bridging app.

## Local file template

Download the CSV template from the app (`/templates/period-summary-template.csv`) or use the fixtures under `fixtures/`.

Supported sheets/sections:

| Section | Purpose |
|---------|---------|
| `self_employment` | Period summary income & expenses for a trade |
| `uk_property` | UK property business period summary |
| `foreign_property` | Foreign property period summary (per country) |

CSV columns: `section`, `field`, `value` (optional `country` for foreign property, optional `business_id` / `tax_year` / `period_start` / `period_end` metadata rows).

## Environment

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `3000`) |
| `HMRC_CLIENT_ID` | Optional HMRC sandbox OAuth client id |
| `HMRC_CLIENT_SECRET` | Optional HMRC sandbox client secret |
| `HMRC_REDIRECT_URI` | Optional OAuth redirect |
| `HMRC_BASE_URL` | Defaults to HMRC test API base |
| `HMRC_MODE` | `sandbox` or `double` (default: `double` if no client id) |

Without HMRC credentials the app uses an in-process **test double** that accepts the same request shape as the sandbox client.

## Architecture

- `src/lib/parse.js` — spreadsheet/CSV → rows
- `src/lib/map.js` — rows → normalized SE / UK / foreign figures
- `src/lib/payloads.js` — normalized figures → HMRC quarterly period-summary payloads
- `src/lib/hmrc-client.js` — sandbox HTTP client + test double (shared request construction)

## Deploy (Railway)

```bash
railway up
```

Or connect the GitHub repo in the Railway dashboard. `railway.toml` / `nixpacks` use `npm start`.

## License

MIT
