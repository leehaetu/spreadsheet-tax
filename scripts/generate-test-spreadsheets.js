/**
 * Generate test-spreadsheets/ files that exercise the shipped pipeline.
 * Run: node scripts/generate-test-spreadsheets.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'test-spreadsheets');

/** @type {Record<string, string[][]>} */
const sheets = {
  '01-self-employment-plumber.csv': [
    ['section', 'field', 'value', 'country'],
    ['meta', 'tax_year', '2024-25', ''],
    ['meta', 'period_start', '2024-04-06', ''],
    ['meta', 'period_end', '2024-07-05', ''],
    ['meta', 'nino', 'AA123456A', ''],
    ['meta', 'business_id', 'XAISPLUMBER001', ''],
    ['self_employment', 'turnover', '15750.00', ''],
    ['self_employment', 'other', '125.00', ''],
    ['self_employment', 'cost_of_goods', '3200.50', ''],
    ['self_employment', 'payments_to_subcontractors', '800.00', ''],
    ['self_employment', 'car_van_travel_expenses', '640.25', ''],
    ['self_employment', 'premises_running_costs', '0', ''],
    ['self_employment', 'admin_costs', '95.00', ''],
    ['self_employment', 'advertising_costs', '40.00', ''],
    ['self_employment', 'professional_fees', '250.00', ''],
    ['self_employment', 'other_expenses', '88.75', ''],
  ],
  '02-uk-property-landlord.csv': [
    ['section', 'field', 'value', 'country'],
    ['meta', 'tax_year', '2024-25', ''],
    ['meta', 'period_start', '2024-04-06', ''],
    ['meta', 'period_end', '2024-07-05', ''],
    ['uk_property', 'period_amount', '7200.00', ''],
    ['uk_property', 'other_income', '150.00', ''],
    ['uk_property', 'premiums_of_lease_grant', '0', ''],
    ['uk_property', 'premises_running_costs', '420.00', ''],
    ['uk_property', 'repairs_and_maintenance', '675.50', ''],
    ['uk_property', 'financial_costs', '310.00', ''],
    ['uk_property', 'professional_fees', '180.00', ''],
    ['uk_property', 'cost_of_services', '95.00', ''],
    ['uk_property', 'travel_costs', '45.00', ''],
    ['uk_property', 'other', '35.00', ''],
  ],
  '03-foreign-property-spain.csv': [
    ['section', 'field', 'value', 'country'],
    ['meta', 'tax_year', '2024-25', ''],
    ['meta', 'period_start', '2024-04-06', ''],
    ['meta', 'period_end', '2024-07-05', ''],
    ['foreign_property', 'rent_income', '4100.00', 'ESP'],
    ['foreign_property', 'other_property_income', '200.00', 'ESP'],
    ['foreign_property', 'foreign_tax_paid_or_deducted', '50.00', 'ESP'],
    ['foreign_property', 'premises_running_costs', '280.00', 'ESP'],
    ['foreign_property', 'repairs_and_maintenance', '190.00', 'ESP'],
    ['foreign_property', 'professional_fees', '110.00', 'ESP'],
    ['foreign_property', 'other', '60.00', 'ESP'],
  ],
  '04-combined-trade-and-property.csv': [
    ['section', 'field', 'value', 'country'],
    ['meta', 'tax_year', '2024-25', ''],
    ['meta', 'period_start', '2024-04-06', ''],
    ['meta', 'period_end', '2024-07-05', ''],
    ['meta', 'nino', 'BB987654C', ''],
    ['self_employment', 'turnover', '9200.00', ''],
    ['self_employment', 'cost_of_goods', '1100.00', ''],
    ['self_employment', 'car_van_travel_expenses', '220.00', ''],
    ['self_employment', 'professional_fees', '150.00', ''],
    ['uk_property', 'period_amount', '3600.00', ''],
    ['uk_property', 'other_income', '50.00', ''],
    ['uk_property', 'repairs_and_maintenance', '200.00', ''],
    ['uk_property', 'other', '15.00', ''],
    ['foreign_property', 'rent_income', '1800.00', 'FRA'],
    ['foreign_property', 'premises_running_costs', '120.00', 'FRA'],
    ['foreign_property', 'other', '25.00', 'FRA'],
  ],
  '05-hairdresser-trade.csv': [
    ['section', 'field', 'value', 'country'],
    ['meta', 'tax_year', '2024-25', ''],
    ['meta', 'period_start', '2024-04-06', ''],
    ['meta', 'period_end', '2024-07-05', ''],
    ['self_employment', 'sales', '6800.00', ''],
    ['self_employment', 'other_income', '90.00', ''],
    ['self_employment', 'materials', '950.00', ''],
    ['self_employment', 'wages', '0', ''],
    ['self_employment', 'travel', '120.00', ''],
    ['self_employment', 'rent', '1800.00', ''],
    ['self_employment', 'advertising', '75.00', ''],
    ['self_employment', 'accountancy', '200.00', ''],
    ['self_employment', 'sundry', '40.00', ''],
  ],
};

function rowsToCsv(rows) {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? '');
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(',')
    )
    .join('\n') + '\n';
}

fs.mkdirSync(outDir, { recursive: true });

for (const [name, rows] of Object.entries(sheets)) {
  const csvPath = path.join(outDir, name);
  fs.writeFileSync(csvPath, rowsToCsv(rows), 'utf8');
  console.log('wrote', csvPath);
}

// XLSX multi-sheet workbook: one sheet per source + meta
const xlsxRows = sheets['04-combined-trade-and-property.csv'];
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(xlsxRows);
XLSX.utils.book_append_sheet(wb, ws, 'period_summary');
const xlsxPath = path.join(outDir, '06-combined-workbook.xlsx');
XLSX.writeFile(wb, xlsxPath);
console.log('wrote', xlsxPath);

// README for testers
fs.writeFileSync(
  path.join(outDir, 'README.md'),
  `# Test spreadsheets

Use these files in the bridging app (**Open app → Import local file**).

| File | What it tests |
|------|----------------|
| \`01-self-employment-plumber.csv\` | Self-employment period summary (trade) |
| \`02-uk-property-landlord.csv\` | UK property income + expenses (\`other_income\` vs \`other\`) |
| \`03-foreign-property-spain.csv\` | Foreign property (ESP) |
| \`04-combined-trade-and-property.csv\` | SE + UK + foreign in one file |
| \`05-hairdresser-trade.csv\` | Common aliases (sales, materials, rent, sundry) |
| \`06-combined-workbook.xlsx\` | Excel workbook import path |

Empty or wrong-section files are **not** included — every file must produce mapped figures via the shipped pipeline.
`,
  'utf8'
);
console.log('done');
