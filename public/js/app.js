/** Customer bridging app: upload → review figures → submit */

let lastPayloads = null;
let lastSummary = null;
let lastDraftId = null;
let lastValidation = null;

/** Customer-friendly connection label (no developer mode names in the UI). */
function connectionLabel(mode) {
  if (mode === 'sandbox') return 'Connected to HMRC test environment';
  if (mode === 'double') return 'Ready to submit (preview mode)';
  return 'Ready';
}

function setWizardStep(step) {
  document.querySelectorAll('.wizard-step').forEach((el) => {
    const n = Number(el.getAttribute('data-step'));
    el.classList.remove('active', 'done');
    if (n < step) el.classList.add('done');
    if (n === step) el.classList.add('active');
  });
}

async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const el = document.getElementById('connection-status');
    if (el) {
      el.textContent = connectionLabel(data.hmrcMode);
      el.classList.add('ok');
    }
  } catch {
    const el = document.getElementById('connection-status');
    if (el) el.textContent = 'Ready';
  }
}

/** Prefill NI / business IDs from saved account preferences when empty. */
async function loadSavedIdentifiers() {
  try {
    const res = await fetch('/api/me/preferences');
    if (!res.ok) return;
    const data = await res.json();
    const id = data.preferences?.identifiers;
    if (!id) return;
    const fill = (elId, value) => {
      const el = document.getElementById(elId);
      if (el && !el.value && value) el.value = value;
    };
    fill('nino', id.nino);
    fill('tax-year', id.taxYear);
    fill('bid-se', id.businessIdSe);
    fill('bid-uk', id.businessIdUk);
    fill('bid-fp', id.businessIdForeign);
  } catch {
    /* signed out or offline */
  }
}

const fileInput = document.getElementById('file-input');
const fileLabel = document.getElementById('file-label');
const fileChosen = document.getElementById('file-chosen');
const dropzone = document.getElementById('dropzone');

function showChosenFile(name) {
  if (fileLabel) fileLabel.textContent = name || 'No file chosen';
  if (fileChosen) fileChosen.classList.toggle('show', Boolean(name));
}

if (fileInput) {
  fileInput.addEventListener('change', () => {
    showChosenFile(fileInput.files?.[0]?.name || '');
  });
}

if (dropzone) {
  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('dragover');
    });
  });
  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files?.length && fileInput) {
      fileInput.files = files;
      showChosenFile(files[0].name);
    }
  });
}

function setImportBusy(busy, label) {
  const btn = document.getElementById('import-btn');
  if (!btn) return;
  btn.disabled = busy;
  btn.textContent = label || (busy ? 'Reading your file…' : 'Review my figures');
  btn.setAttribute('aria-busy', busy ? 'true' : 'false');
  document.querySelectorAll('.sample-btn').forEach((b) => {
    b.disabled = busy;
  });
  const drop = document.getElementById('dropzone');
  if (drop) drop.classList.toggle('loading', Boolean(busy));
}

async function importFromFormData(fd) {
  const res = await fetch('/api/import', { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'We could not read that file.');
  return data;
}

async function importSample(sampleId) {
  const res = await fetch('/api/import/sample', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sample: sampleId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'We could not load that sample.');
  return data;
}

function handleImportSuccess(data) {
  lastPayloads = data.payloads;
  lastSummary = data.summary || null;
  lastDraftId = data.draftId || null;
  lastValidation = data.validation || { ready: true, errors: [], warnings: [] };
  showPreview(data);

  if (data.payloads?.meta?.taxYear) {
    const ty = document.getElementById('tax-year');
    if (ty) ty.value = data.payloads.meta.taxYear;
  }
  if (data.metadata?.nino) {
    const nino = document.getElementById('nino');
    if (nino) nino.value = data.metadata.nino;
  }
  if (data.metadata?.business_id) {
    const se = document.getElementById('bid-se');
    if (se && !se.value) se.value = data.metadata.business_id;
  }

  setWizardStep(2);
  document.getElementById('preview-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('upload-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('upload-error');
  if (errEl) errEl.hidden = true;
  const file = fileInput?.files?.[0];
  if (!file) {
    if (errEl) {
      errEl.textContent = 'Please choose a spreadsheet file to upload.';
      errEl.hidden = false;
    }
    return;
  }

  setImportBusy(true, 'Reading your file…');
  try {
    const fd = new FormData();
    fd.append('file', file);
    const data = await importFromFormData(fd);
    handleImportSuccess(data);
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || String(err);
      errEl.hidden = false;
    }
  } finally {
    setImportBusy(false);
  }
});

document.querySelectorAll('.sample-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const errEl = document.getElementById('upload-error');
    if (errEl) errEl.hidden = true;
    const sampleId = btn.getAttribute('data-sample') || 'combined';
    setImportBusy(true, 'Loading sample…');
    showChosenFile(`Sample: ${btn.querySelector('strong')?.textContent || sampleId}`);
    try {
      const data = await importSample(sampleId);
      handleImportSuccess(data);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || String(err);
        errEl.hidden = false;
      }
    } finally {
      setImportBusy(false);
    }
  });
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
  const p = String(path || '');
  if (/turnover|periodAmount|rentAmount|rentIncome/i.test(p)) return 'Income';
  if (/otherIncome|otherPropertyIncome|periodIncome\.other/i.test(p))
    return 'Other income';
  if (
    /expense|costOf|Fees|Costs|repairs|financial|travel|admin|advertising|wages|goods|subcontractor|depreciation|entertainment|interest|finance|debts|maintenance|premises|services/i.test(
      p
    )
  )
    return 'Expense';
  if (/tax/i.test(p)) return 'Tax';
  return 'Included amount';
}

function formatMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '—');
  return n.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
  });
}

function tag(text, cls) {
  const s = document.createElement('span');
  s.className = cls ? `tag ${cls}` : 'tag';
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
  return lines.length ? lines.join('\n') : 'Quarterly update package prepared.';
}

function renderSourceCards(summary) {
  const root = document.getElementById('source-cards');
  if (!root) return;
  root.innerHTML = '';

  for (const src of summary?.sources || []) {
    const card = document.createElement('article');
    card.className = 'source-card';

    const incomeHtml = (src.incomeLines || [])
      .map(
        (l) =>
          `<div class="line-item"><span>${esc(l.label)}</span><span class="amt">${esc(formatMoney(l.amount))}</span></div>`
      )
      .join('');
    const expenseHtml = (src.expenseLines || [])
      .map(
        (l) =>
          `<div class="line-item"><span>${esc(l.label)}</span><span class="amt expense">${esc(formatMoney(l.amount))}</span></div>`
      )
      .join('');

    card.innerHTML = `
      <div class="source-card-head">
        <div>
          <h3>${esc(src.title)}</h3>
          ${src.subtitle ? `<p class="sub">${esc(src.subtitle)}</p>` : ''}
        </div>
        <div class="source-totals">
          <span>Income <strong>${esc(formatMoney(src.totalIncome))}</strong></span>
          <span>Expenses <strong>${esc(formatMoney(src.totalExpenses))}</strong></span>
          <span>Net <strong>${esc(formatMoney(src.net))}</strong></span>
        </div>
      </div>
      <div class="line-grid">
        <div class="line-col">
          <h4>Income</h4>
          ${incomeHtml || '<p class="muted">No income lines</p>'}
        </div>
        <div class="line-col">
          <h4>Expenses</h4>
          ${expenseHtml || '<p class="muted">No expense lines</p>'}
        </div>
      </div>
    `;
    root.appendChild(card);
  }
}

function showPreview(data) {
  const preview = document.getElementById('preview-panel');
  const submit = document.getElementById('submit-panel');
  if (preview) preview.hidden = false;
  if (submit) submit.hidden = false;

  const success = document.getElementById('submit-success');
  if (success) success.hidden = true;
  const submitErr = document.getElementById('submit-error');
  if (submitErr) submitErr.hidden = true;

  const summary = data.summary;
  lastSummary = summary;
  lastValidation = data.validation || { ready: true, errors: [], warnings: [] };

  const validationBox = document.getElementById('validation-summary');
  const validationTitle = document.getElementById('validation-title');
  const validationList = document.getElementById('validation-list');
  const issues = [...(lastValidation.errors || []), ...(lastValidation.warnings || [])];
  if (validationBox && validationTitle && validationList) {
    validationBox.hidden = false;
    validationBox.classList.remove('blocked', 'ok');
    validationList.innerHTML = '';
    if (lastValidation.errors?.length) {
      validationBox.classList.add('blocked');
      validationTitle.textContent = 'Fix these items before continuing';
    } else if (lastValidation.warnings?.length) {
      validationTitle.textContent = 'Check these items before continuing';
    } else {
      validationBox.classList.add('ok');
      validationTitle.textContent = 'Spreadsheet checks passed';
    }
    for (const item of issues) {
      const li = document.createElement('li');
      li.textContent = item.message;
      validationList.appendChild(li);
    }
    if (!issues.length) {
      const li = document.createElement('li');
      li.textContent = 'Dates, sources and mapped figures are ready for review.';
      validationList.appendChild(li);
    }
  }
  const continueBtn = document.getElementById('goto-submit');
  if (continueBtn) {
    continueBtn.disabled = !lastValidation.ready;
    continueBtn.title = lastValidation.ready ? '' : 'Resolve the blocking spreadsheet checks first';
  }

  const meta = document.getElementById('period-meta');
  if (meta) {
    meta.innerHTML = '';
    const taxYear = summary?.taxYear || data.payloads?.meta?.taxYear;
    const start = summary?.periodStart || data.payloads?.meta?.periodStartDate;
    const end = summary?.periodEnd || data.payloads?.meta?.periodEndDate;
    if (taxYear) meta.appendChild(tag(`Tax year ${taxYear}`, 'green'));
    if (start && end) meta.appendChild(tag(`Period ${start} → ${end}`));
    if (data.filename) meta.appendChild(tag(data.filename, 'amber'));
    if (data.rowCount != null) meta.appendChild(tag(`${data.rowCount} rows read`));
  }

  const tags = document.getElementById('sources-summary');
  if (tags) {
    tags.innerHTML = '';
    if (data.sources?.selfEmployment) tags.appendChild(tag('Self-employment', 'green'));
    if (data.sources?.ukProperty) tags.appendChild(tag('UK property', 'green'));
    for (const c of data.sources?.foreignProperty || []) {
      tags.appendChild(tag(`Foreign property (${c})`, 'green'));
    }
  }

  const totals = summary?.totals || {};
  const setMetric = (id, value, netStyle) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
    el.classList.remove('positive', 'negative');
    if (netStyle) {
      const n = Number(totals.net);
      if (Number.isFinite(n)) {
        el.classList.add(n >= 0 ? 'positive' : 'negative');
      }
    }
  };
  setMetric('metric-income', formatMoney(totals.totalIncome ?? 0));
  setMetric('metric-expenses', formatMoney(totals.totalExpenses ?? 0));
  setMetric('metric-net', formatMoney(totals.net ?? 0), true);
  setMetric(
    'metric-sources',
    String(summary?.sourceCount ?? (data.sources?.selfEmployment ? 1 : 0))
  );

  // Fix source count if summary missing
  if (!summary) {
    let count = 0;
    if (data.sources?.selfEmployment) count += 1;
    if (data.sources?.ukProperty) count += 1;
    count += (data.sources?.foreignProperty || []).length;
    setMetric('metric-sources', String(count));
  }

  renderSourceCards(summary);

  const tbody = document.querySelector('#links-table tbody');
  if (tbody) {
    tbody.innerHTML = '';
    for (const link of data.fieldLinks || []) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(friendlySource(link.source))}</td><td>${esc(link.sourceField)}</td><td>${esc(friendlyPath(link.path))}</td><td class="amount-cell">${esc(formatMoney(link.value))}</td>`;
      tbody.appendChild(tr);
    }
  }

  const payloadsOut = document.getElementById('payloads-out');
  if (payloadsOut) {
    payloadsOut.textContent = formatSubmissionPreview(data.payloads);
  }
}

function resetToUpload() {
  lastPayloads = null;
  lastSummary = null;
  lastDraftId = null;
  lastValidation = null;
  const preview = document.getElementById('preview-panel');
  const submit = document.getElementById('submit-panel');
  if (preview) preview.hidden = true;
  if (submit) submit.hidden = true;
  const success = document.getElementById('submit-success');
  if (success) success.hidden = true;
  if (fileInput) fileInput.value = '';
  showChosenFile('');
  setWizardStep(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('reset-upload')?.addEventListener('click', resetToUpload);
document.getElementById('reset-upload-2')?.addEventListener('click', resetToUpload);
document.getElementById('another-file')?.addEventListener('click', resetToUpload);

document.getElementById('goto-submit')?.addEventListener('click', () => {
  if (lastValidation && !lastValidation.ready) return;
  setWizardStep(3);
  document.getElementById('submit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('back-to-review')?.addEventListener('click', () => {
  setWizardStep(2);
  document.getElementById('preview-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('submit-btn')?.addEventListener('click', async () => {
  const errEl = document.getElementById('submit-error');
  const successBox = document.getElementById('submit-success');
  const summary = document.getElementById('submit-summary');
  const list = document.getElementById('submit-result-list');
  if (errEl) errEl.hidden = true;
  if (successBox) successBox.hidden = true;

  if (!lastDraftId && !lastPayloads) {
    if (errEl) {
      errEl.textContent = 'Please upload your spreadsheet first.';
      errEl.hidden = false;
    }
    return;
  }

  const btn = document.getElementById('submit-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending…';
  }

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: lastDraftId || undefined,
        // Fallback only if draft store failed; server still defaults to double mode
        payloads: lastDraftId ? undefined : lastPayloads,
        idempotencyKey:
          lastDraftId ||
          `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        nino: document.getElementById('nino')?.value || undefined,
        taxYear: document.getElementById('tax-year')?.value || undefined,
        businessIdSe: document.getElementById('bid-se')?.value || undefined,
        businessIdUk: document.getElementById('bid-uk')?.value || undefined,
        businessIdForeign: document.getElementById('bid-fp')?.value || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const messages = data.validation?.errors?.map((item) => item.message).filter(Boolean) || [];
      throw new Error(messages.length ? messages.join(' ') : (data.error || 'Submission failed. Please try again.'));
    }

    const count = Array.isArray(data.results) ? data.results.length : 0;
    const ok = data.ok;
    if (summary) {
      const receiptBit = data.attemptId ? ` Receipt: ${data.attemptId}.` : '';
      const replay = data.idempotentReplay ? ' (safe replay)' : '';
      summary.textContent = ok
        ? `Your quarterly update${count === 1 ? ' was' : 's were'} accepted (${count} income source${count === 1 ? '' : 's'}).${receiptBit}${replay}`
        : 'Something went wrong with one or more updates. Review the details below.';
    }
    if (list) {
      list.innerHTML = '';
      for (const r of data.results || []) {
        const li = document.createElement('li');
        const src = friendlySource(r.request?.source || 'update');
        const id = r.response?.submissionId || r.response?.message || r.status || '';
        li.innerHTML = `<span>${esc(src)}</span><span>${r.ok ? 'Accepted' : 'Not accepted'}${id ? ` · ${esc(String(id))}` : ''}</span>`;
        list.appendChild(li);
      }
    }
    if (successBox) successBox.hidden = false;
    setWizardStep(4);
    successBox?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || String(err);
      errEl.hidden = false;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Submit quarterly update';
    }
  }
});

setWizardStep(1);
loadStatus();
loadSavedIdentifiers();

// Audience mode from sales CTAs (?mode=self-employed|property|landlord)
(function applyAudienceMode() {
  const mode = new URLSearchParams(location.search).get('mode') || '';
  const lead = document.querySelector('.app-hero .lead');
  const h1 = document.querySelector('.app-hero h1');
  if (mode === 'self-employed' || mode === 'self_employment') {
    if (h1) h1.textContent = 'Submit your self-employment quarterly update';
    if (lead) {
      lead.innerHTML =
        'Built for sole traders and trades. Upload your period spreadsheet, review turnover and expenses, then submit — <strong>no retyping totals</strong>.';
    }
    // Prefer self-employment sample first
    const se = document.querySelector('.sample-btn[data-sample="self_employment"]');
    if (se) se.classList.add('tag', 'green');
  } else if (mode === 'property' || mode === 'landlord' || mode === 'landlords') {
    if (h1) h1.textContent = 'Submit your property quarterly update';
    if (lead) {
      lead.innerHTML =
        'Built for UK and foreign property landlords. Map rental income and costs from your spreadsheet, then review before sending.';
    }
    const uk = document.querySelector('.sample-btn[data-sample="uk_property"]');
    if (uk) uk.classList.add('tag', 'green');
  }
})();

// Resume a server draft when opened from history (?draftId=)
(async function resumeDraftFromQuery() {
  const id = new URLSearchParams(location.search).get('draftId');
  if (!id) return;
  try {
    const res = await fetch(`/api/drafts/${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok || !data.draft) return;
    const d = data.draft;
    handleImportSuccess({
      payloads: d.payloads,
      summary: d.summary,
      figures: d.figures,
      validation: d.validation || { ready: true, errors: [], warnings: [] },
      draftId: d.id,
      filename: d.filename,
      sources: {
        selfEmployment: Boolean(d.payloads?.selfEmployment),
        ukProperty: Boolean(d.payloads?.ukProperty),
        foreignProperty: (d.payloads?.foreignProperty?.foreignProperty || []).map(
          (f) => f.countryCode
        ),
      },
      fieldLinks: [],
      metadata: {},
    });
  } catch {
    /* ignore */
  }
})();
