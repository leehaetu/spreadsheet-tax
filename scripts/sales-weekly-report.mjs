/**
 * Weekly sales funnel readout (CTA events + new registers).
 * No tax data. Requires JOBS_SECRET on the target server.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3456 JOBS_SECRET=dev-jobs-secret node scripts/sales-weekly-report.mjs
 *   BASE_URL=https://spreadsheet-tax-production.up.railway.app JOBS_SECRET=… DAYS=7 node scripts/sales-weekly-report.mjs
 *
 * Optional: OUT=docs/audits/sales-weekly/2026-07-18.md writes a markdown snapshot.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3456').replace(/\/$/, '');
const SECRET = process.env.JOBS_SECRET || 'dev-jobs-secret';
const DAYS = Math.min(90, Math.max(1, Number(process.env.DAYS) || 7));

const url = `${BASE}/api/metrics/sales-weekly?days=${DAYS}`;
const res = await fetch(url, {
  headers: { 'x-jobs-secret': SECRET },
});
const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error('Non-JSON response', res.status, text.slice(0, 400));
  process.exit(1);
}
if (!res.ok) {
  console.error(res.status, data);
  process.exit(1);
}

const lines = [
  `# Sales weekly funnel (${data.days} days)`,
  ``,
  `**Base:** ${BASE}`,
  `**Window:** ${data.since} → ${data.until}`,
  `**Generated:** ${new Date().toISOString()}`,
  ``,
  `## Headline`,
  ``,
  `| Metric | Value |`,
  `|--------|------:|`,
  `| New registers | **${data.registers}** |`,
  `| CTA events | **${data.ctaEvents}** |`,
  `| Users (all time) | ${data.usersTotal} |`,
  `| CTA events (all time) | ${data.ctaEventsAllTime} |`,
  ``,
  `## CTA by event`,
  ``,
  ...(data.ctaByEvent?.length
    ? [
        `| Event | Count |`,
        `|-------|------:|`,
        ...data.ctaByEvent.map((r) => `| \`${r.event}\` | ${r.count} |`),
      ]
    : ['- No CTA events in this window.']),
  ``,
  `## CTA by path (top 30)`,
  ``,
  ...(data.ctaByPath?.length
    ? [
        `| Path | Count |`,
        `|------|------:|`,
        ...data.ctaByPath.map((r) => `| \`${r.path}\` | ${r.count} |`),
      ]
    : ['- No path data.']),
  ``,
  `## Notes`,
  ``,
  `- ${data.note}`,
  `- Primary KPI over time: **registers / sales visits** — unique visits are not stored here; pair with host analytics if needed.`,
  `- Do not paste emails or tax identifiers into these reports.`,
  ``,
];

const md = lines.join('\n');
console.log(md);

if (process.env.OUT) {
  const outPath = path.isAbsolute(process.env.OUT)
    ? process.env.OUT
    : path.join(root, process.env.OUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
  console.error('Wrote', outPath);
} else {
  // Default snapshot under docs/audits/sales-weekly/
  const day = new Date().toISOString().slice(0, 10);
  const outPath = path.join(root, 'docs/audits/sales-weekly', `${day}.md`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
  fs.writeFileSync(
    path.join(root, 'docs/audits/sales-weekly', `${day}.json`),
    JSON.stringify({ base: BASE, ...data }, null, 2)
  );
  console.error('Wrote', outPath);
}
