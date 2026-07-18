#!/usr/bin/env node
/**
 * Bump package.json version.
 * Usage: node scripts/bump-version.js patch|minor|major
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const kind = (process.argv[2] || '').toLowerCase();

if (!['patch', 'minor', 'major'].includes(kind)) {
  console.error('Usage: node scripts/bump-version.js patch|minor|major');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const parts = String(pkg.version || '0.0.0')
  .split('.')
  .map((n) => parseInt(n, 10) || 0);
while (parts.length < 3) parts.push(0);
let [maj, min, pat] = parts;

if (kind === 'major') {
  maj += 1;
  min = 0;
  pat = 0;
} else if (kind === 'minor') {
  min += 1;
  pat = 0;
} else {
  pat += 1;
}

const next = `${maj}.${min}.${pat}`;
const prev = pkg.version;
pkg.version = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`${prev} → ${next} (${kind})`);
console.log(`Commit subject should include: v${next}: …`);
