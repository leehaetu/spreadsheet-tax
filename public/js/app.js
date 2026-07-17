/** Customer bridging app: upload → review figures → submit */

let lastPayloads = null;

/** Customer-friendly connection label (no developer mode names in the UI). */
function connectionLabel(mode) {
  if (mode === 'sandbox') return 'Connected to HMRC test environment';
  if (mode === 'double') return 'Ready to submit (preview mode)';
  return 'Ready';
}

async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const el = document.getElementById('connection-status');
    if (el) el.textContent = connectionLabel(data.hmrcMode);
  } catch {
    const el = document.getElementById('connection-status');
    if (el) el.textContent = 'Ready';
  }
}

const fileInput = document.getElementById('file-input');
const fileLabel = document.getElementById('file-label');
if (fileInput && fileLabel) {
  fileInput.addEventListener('change', () => {
    fileLabel.textContent =
      fileInput.files?.[0]?.name || 'Choose your spreadsheet…';
  });
}

document.getElementById('upload-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('upload-error');
  errEl.hidden = true;
  const file = fileInput?.files?.[0];
  if (!file) {
    errEl.textContent = 'Please choose a spreadsheet file to upload.';
    errEl.hidden = false;
    return;
  }

  const btn = document.getElementById('import-btn');
  btn.disabled = true;
  btn.textContent = 'Reading your file…';

  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'We could not read that file.');

    lastPayloads = data.payloads;
    showPreview(data);

    if (data.payloads?.meta?.taxYear) {
      document.getElementById('tax-year').value = data.payloads.meta.taxYear;
    }
    if (data.metadata?.nino) {
      document.getElementById('nino').value = data.metadata.nino;
    }
  } catch (err) {
    errEl.textContent = err.message || String(err);
    errEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Review my figures';
  }
});

function friendlySource(source) {
  if (source === 'self_employment') return 'Self-employment';
  if (source === 'uk_property') return 'UK property';
  if (String(source).startsWith('foreign_property')) {
    const country = String(source).split(':')[1];
    return country ? `Foreign property (${country})` : 'Foreign property';
  }
  return source;
}

function friendlyPath(path) {
  // Present a short plain-language label rather than a developer API path
  const p = String(path || '');
  if (/turnover|periodAmount|rentAmount|rentIncome/i.test(p)) return 'Income';
  if (/otherIncome|otherPropertyIncome|periodIncome\.other/i.test(p))
    return 'Other income';
  if (/expense|costOf|Fees|Costs|repairs|financial|travel|admin|advertising|wages|goods|subcontractor|depreciation|entertainment|interest|finance|debts|maintenance|premises|services/i.test(
    p
  ))
    return 'Expense';
  if (/tax/i.test(p)) return 'Tax';
  return 'Included amount';
}

function showPreview(data) {
  document.getElementById('preview-panel').hidden = false;
  document.getElementById('submit-panel').hidden = false;

  const tags = document.getElementById('sources-summary');
  tags.innerHTML = '';
  if (data.sources.selfEmployment) {
    tags.appendChild(tag('Self-employment'));
  }
  if (data.sources.ukProperty) {
    tags.appendChild(tag('UK property'));
  }
  for (const c of data.sources.foreignProperty || []) {
    tags.appendChild(tag(`Foreign property (${c})`));
  }

  document.getElementById('figures-out').textContent = formatFiguresForCustomer(
    data.figures
  );
  document.getElementById('payloads-out').textContent =
    formatSubmissionPreview(data.payloads);

  const tbody = document.querySelector('#links-table tbody');
  tbody.innerHTML = '';
  for (const link of data.fieldLinks || []) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(friendlySource(link.source))}</td><td>${esc(link.sourceField)}</td><td>${esc(friendlyPath(link.path))}</td><td>${esc(formatMoney(link.value))}</td>`;
    tbody.appendChild(tr);
  }
}

/**
 * Present figures as readable lines, not raw API JSON when possible.
 * @param {object} figures
 */
function formatFiguresForCustomer(figures) {
  const lines = [];
  if (figures?.selfEmployment) {
    lines.push('Self-employment');
    for (const [k, v] of Object.entries(figures.selfEmployment)) {
      lines.push(`  ${labelKey(k)}: ${formatMoney(v)}`);
    }
  }
  if (figures?.ukProperty) {
    lines.push('UK property');
    for (const [k, v] of Object.entries(figures.ukProperty)) {
      lines.push(`  ${labelKey(k)}: ${formatMoney(v)}`);
    }
  }
  if (figures?.foreignProperty?.length) {
    for (const fp of figures.foreignProperty) {
      lines.push(`Foreign property (${fp.countryCode})`);
      for (const [k, v] of Object.entries(fp.figures || {})) {
        lines.push(`  ${labelKey(k)}: ${formatMoney(v)}`);
      }
    }
  }
  return lines.length ? lines.join('\n') : JSON.stringify(figures, null, 2);
}

/**
 * Compact customer preview of what is ready to send.
 * @param {object} payloads
 */
function formatSubmissionPreview(payloads) {
  const lines = [];
  if (payloads?.meta) {
    lines.push(
      `Tax year: ${payloads.meta.taxYear || '—'}`,
      `Period: ${payloads.meta.periodStartDate || '—'} to ${payloads.meta.periodEndDate || '—'}`
    );
  }
  if (payloads?.selfEmployment) {
    const se = payloads.selfEmployment;
    lines.push('', 'Self-employment quarterly update ready');
    if (se.periodIncome?.turnover != null)
      lines.push(`  Turnover: ${formatMoney(se.periodIncome.turnover)}`);
    if (se.periodIncome?.other != null)
      lines.push(`  Other income: ${formatMoney(se.periodIncome.other)}`);
  }
  if (payloads?.ukProperty) {
    const uk = payloads.ukProperty.ukOtherProperty;
    lines.push('', 'UK property quarterly update ready');
    if (uk?.income?.periodAmount != null)
      lines.push(`  Rental income: ${formatMoney(uk.income.periodAmount)}`);
    if (uk?.income?.otherIncome != null)
      lines.push(`  Other income: ${formatMoney(uk.income.otherIncome)}`);
  }
  if (payloads?.foreignProperty?.foreignProperty?.length) {
    lines.push('', 'Foreign property quarterly update ready');
    for (const fp of payloads.foreignProperty.foreignProperty) {
      const rent = fp.income?.rentIncome?.rentAmount;
      lines.push(
        `  ${fp.countryCode || 'Property'}: rent ${rent != null ? formatMoney(rent) : '—'}`
      );
    }
  }
  return lines.length ? lines.join('\n') : JSON.stringify(payloads, null, 2);
}

function labelKey(k) {
  return String(k)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
  });
}

function tag(text) {
  const s = document.createElement('span');
  s.className = 'tag';
  s.textContent = text;
  return s;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.getElementById('submit-btn')?.addEventListener('click', async () => {
  const errEl = document.getElementById('submit-error');
  const successBox = document.getElementById('submit-success');
  const out = document.getElementById('submit-out');
  const summary = document.getElementById('submit-summary');
  errEl.hidden = true;
  if (successBox) {
    successBox.hidden = true;
    successBox.style.display = 'none';
  }
  if (out) out.hidden = true;

  if (!lastPayloads) {
    errEl.textContent = 'Please upload your spreadsheet first.';
    errEl.hidden = false;
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payloads: lastPayloads,
        nino: document.getElementById('nino').value || undefined,
        taxYear: document.getElementById('tax-year').value || undefined,
        businessIdSe: document.getElementById('bid-se').value || undefined,
        businessIdUk: document.getElementById('bid-uk').value || undefined,
        businessIdForeign: document.getElementById('bid-fp').value || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submission failed. Please try again.');

    const count = Array.isArray(data.results) ? data.results.length : 0;
    const ok = data.ok;
    if (summary) {
      summary.textContent = ok
        ? `Your quarterly update${count === 1 ? ' was' : 's were'} accepted (${count} income source${count === 1 ? '' : 's'}).`
        : 'Something went wrong with one or more updates. Review the details below.';
    }
    if (successBox) {
      successBox.hidden = false;
      successBox.style.display = 'block';
    }
    // Optional detail for the customer if they want to see confirmation IDs
    if (out && data.results) {
      const lines = data.results.map((r) => {
        const src = friendlySource(r.request?.source || 'update');
        const id = r.response?.submissionId || r.response?.message || r.status;
        return `${src}: ${r.ok ? 'Accepted' : 'Not accepted'} — ${id}`;
      });
      out.textContent = lines.join('\n');
      out.hidden = false;
    }
  } catch (err) {
    errEl.textContent = err.message || String(err);
    errEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit quarterly update';
  }
});

loadStatus();
