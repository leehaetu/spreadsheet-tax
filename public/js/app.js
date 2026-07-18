/** Customer bridging app: upload → review figures → submit */

let lastPayloads = null;
let lastSummary = null;
let lastDraftId = null;
let lastValidation = null;
let lastFieldLinks = null;
let lastSources = null;
let lastFilename = null;
let lastRowCount = null;
/** @type {object|null} */
let lastSpreadsheetCheck = null;

/**
 * Honest client metadata for FPH — only real browser-reported values.
 * Never invent public port (browser cannot observe client public TCP port).
 */
function fraudClientHeaders() {
  /** @type {Record<string, string>} */
  const h = {};
  try {
    h['X-Client-Timezone-Offset'] = String(-new Date().getTimezoneOffset());
    if (window.innerWidth > 0 && window.innerHeight > 0) {
      h['X-Client-Window-Size'] = `${window.innerWidth}x${window.innerHeight}`;
    }
    if (window.screen?.width > 0 && window.screen?.height > 0) {
      h['X-Client-Screens'] = `${window.screen.width}x${window.screen.height}`;
      if (window.devicePixelRatio) {
        h['X-Client-Screen-Scale'] = String(window.devicePixelRatio);
      }
      if (window.screen.colorDepth) {
        h['X-Client-Screen-Depth'] = String(window.screen.colorDepth);
      }
    }
    let deviceId = localStorage.getItem('st_device_id');
    if (
      !deviceId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        deviceId
      )
    ) {
      deviceId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : null;
      if (deviceId) localStorage.setItem('st_device_id', deviceId);
    }
    if (deviceId) h['X-Client-Device-Id'] = deviceId;
  } catch {
    /* private mode */
  }
  return h;
}

async function apiFetch(url, options = {}) {
  const headers = {
    ...fraudClientHeaders(),
    ...(options.headers || {}),
  };
  return fetch(url, { ...options, headers });
}

/** Customer-facing connection label for product chrome. */
function connectionLabel(data) {
  if (typeof window.stConnectionLabel === 'function') {
    return window.stConnectionLabel(data);
  }
  if (data?.oauthConnected && !data.oauthMock) return 'Connected';
  if (data?.previewOnly || data?.hmrcMode === 'double' || data?.oauthMock) {
    return 'Not connected';
  }
  if (data?.liveSubmitEnabled) return 'Connected';
  return 'Not connected';
}

function setWizardStep(step) {
  document.querySelectorAll('.wizard-step').forEach((el) => {
    const n = Number(el.getAttribute('data-step'));
    el.classList.remove('active', 'done');
    if (n < step) el.classList.add('done');
    if (n === step) el.classList.add('active');
  });
}

function panel(id) {
  return document.getElementById(id);
}

function showPanels({
  sources = false,
  upload = false,
  map = false,
  review = false,
  submit = false,
}) {
  const q = panel('quarterly-source-panel');
  const u = panel('upload-panel');
  const m = panel('map-panel');
  const r = panel('review-panel');
  const s = panel('submit-panel');
  if (q) q.hidden = !sources;
  if (u) u.hidden = !upload;
  if (m) m.hidden = !map;
  if (r) r.hidden = !review;
  if (s) s.hidden = !submit;
}

window.stQuarterlyShowStep = function stQuarterlyShowStep(step) {
  // Wizard: 1 select source · 2 upload · 3 check figures · 4 review & send
  if (step === 'sources') {
    showPanels({ sources: true });
    setWizardStep(1);
  } else if (step === 'upload') {
    showPanels({ upload: true });
    setWizardStep(2);
  } else if (step === 'map') {
    // Column mapping is part of "check figures"
    showPanels({ map: true });
    setWizardStep(3);
  } else if (step === 'review') {
    showPanels({ review: true });
    setWizardStep(3);
  } else if (step === 'submit') {
    showPanels({ submit: true });
    setWizardStep(4);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function showQuarterlyReviewState(state) {
  const review = panel('review-panel');
  if (review) review.dataset.reviewState = state;
  document.querySelectorAll('[data-quarterly-state]').forEach((element) => {
    element.hidden = element.dataset.quarterlyState !== 'figures';
  });
  setWizardStep(3);
}

async function loadStatus() {
  try {
    const res = await apiFetch('/api/status');
    const data = await res.json();
    try {
      const connRes = await apiFetch('/api/hmrc/status');
      if (connRes.ok) {
        const conn = await connRes.json();
        Object.assign(data, conn);
        data.oauthConnected = Boolean(conn?.connection?.connected);
        data.oauthMock = Boolean(conn?.connection?.mock || conn?.oauth?.mock);
      }
    } catch { /* optional */ }
    const el = document.getElementById('connection-status');
    if (el) {
      el.textContent = connectionLabel(data);
      el.classList.add('ok');
    }
    const btn = document.getElementById('submit-btn');
    if (btn) {
      btn.textContent = 'Send quarterly update';
      btn.removeAttribute('title');
    }
  } catch {
    const el = document.getElementById('connection-status');
    if (el) el.textContent = 'Not connected';
  }
}

async function loadSavedIdentifiers() {
  try {
    const res = await apiFetch('/api/me/preferences');
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
  btn.textContent = label || (busy ? 'Reading your file…' : 'Continue');
  btn.setAttribute('aria-busy', busy ? 'true' : 'false');
  const drop = document.getElementById('dropzone');
  if (drop) drop.classList.toggle('loading', Boolean(busy));
}

async function importFromFormData(fd) {
  const res = await apiFetch('/api/import', { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'We could not read that file.');
  return data;
}

async function importSample(sampleId) {
  const res = await apiFetch('/api/import/sample', {
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
  lastFieldLinks = data.fieldLinks || [];
  lastSources = data.sources || null;
  lastFilename = data.filename || null;
  lastRowCount = data.rowCount ?? null;
  lastSpreadsheetCheck = data.spreadsheetCheck || null;
  showReview(data);
  renderSpreadsheetCheck(lastSpreadsheetCheck);
  // After upload → check figures (map columns, then totals)
  showPanels({ map: true });
  setWizardStep(3);
  const ssPanel = document.getElementById('spreadsheet-check-panel');
  if (ssPanel) ssPanel.hidden = false;

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
  bindTaxpayerIds().catch(() => {});

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/** Prefill NINO and business IDs from profile + income sources */
async function bindTaxpayerIds() {
  try {
    const [profRes, srcRes] = await Promise.all([
      apiFetch('/api/me/taxpayer-profile'),
      apiFetch('/api/me/income-sources'),
    ]);
    if (profRes.ok) {
      const p = await profRes.json();
      const nino = p.profile?.nino || p.nino || p.profile?.meta?.nino;
      if (nino) {
        const el = document.getElementById('nino');
        if (el && !el.value) el.value = nino;
      }
      const ty = p.profile?.taxYear || p.taxYear;
      if (ty) {
        const el = document.getElementById('tax-year');
        if (el && !el.dataset.userEdited) el.value = ty;
      }
    }
    if (srcRes.ok) {
      const d = await srcRes.json();
      for (const s of d.sources || []) {
        if (s.type === 'self_employment' && s.businessId) {
          const el = document.getElementById('bid-se');
          if (el && !el.value) el.value = s.businessId;
        }
        if (s.type === 'uk_property' && s.businessId) {
          const el = document.getElementById('bid-uk');
          if (el && !el.value) el.value = s.businessId;
        }
        if (s.type === 'foreign_property' && s.businessId) {
          const el = document.getElementById('bid-fp');
          if (el && !el.value) el.value = s.businessId;
        }
      }
    }
  } catch {
    /* ignore — guest or offline */
  }
}

/**
 * "Check your spreadsheet" — multi-sheet sanitised grid + map proof.
 * @param {object|null} model
 */
function renderSpreadsheetCheck(model) {
  const panel = document.getElementById('spreadsheet-check-panel');
  if (!panel) return;
  if (!model || (!(model.gridRows || []).length && !(model.sheets || []).length)) {
    panel.dataset.available = '0';
    panel.hidden = true;
    return;
  }
  panel.dataset.available = '1';
  panel.hidden = false;
  lastSpreadsheetCheck = model;

  const note = document.getElementById('ss-security-note');
  if (note) note.textContent = model.securityNote || '';

  const legend = document.getElementById('ss-legend');
  if (legend) {
    legend.innerHTML = (model.legend || [])
      .map(
        (l) =>
          `<span style="display:inline-block;margin-right:0.75rem"><span style="display:inline-block;width:0.7rem;height:0.7rem;border-radius:2px;background:${esc(
            l.color || '#ccc'
          )}"></span> ${esc(l.label)}</span>`
      )
      .join('');
  }

  const diffBox = document.getElementById('ss-reupload-diff');
  if (diffBox) {
    const d = model.reuploadDiff;
    if (d?.hasChanges) {
      diffBox.hidden = false;
      let html = `<strong>Replacement file differs from previous upload</strong> — previous approvals are invalidated.<br/>`;
      html += `<div class="table-wrap"><table class="data-table"><thead><tr><th>Change</th><th>Previous file</th><th>Replacement</th></tr></thead><tbody>`;
      for (const c of d.categoryChanges || []) {
        html += `<tr><td>${esc(c.label)}</td><td>${
          c.previous == null ? '—' : esc(formatMoney(c.previous))
        }</td><td>${
          c.replacement == null ? '—' : esc(formatMoney(c.replacement))
        }</td></tr>`;
      }
      html += `</tbody></table></div>`;
      html += `<span class="muted">Cells added: ${d.cellsAdded || 0} · removed: ${
        d.cellsRemoved || 0
      }</span>`;
      diffBox.innerHTML = html;
      const approve = document.getElementById('approve-cells');
      if (approve) {
        approve.checked = false;
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) submitBtn.disabled = true;
      }
    } else {
      diffBox.hidden = true;
    }
  }

  const meta = document.getElementById('ss-meta');
  if (meta) {
    meta.textContent = [
      model.filename ? `File: ${model.filename}` : null,
      model.fileSha256 ? `Hash: ${model.fileSha256.slice(0, 12)}…` : null,
      model.mappingVersion ? `Mapping: ${model.mappingVersion}` : null,
      `${(model.gridRows || []).length} mapped cells`,
      model.sheets ? `${model.sheets.length} sheet(s)` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  const sheetSel = document.getElementById('ss-sheet');
  if (sheetSel) {
    sheetSel.innerHTML = (model.sheets || [])
      .map((s, i) => `<option value="${i}">${esc(s.name)} (${s.rowCount} rows)</option>`)
      .join('');
  }
  const outlineSel = document.getElementById('ss-outline');
  if (outlineSel) {
    outlineSel.innerHTML =
      '<option value="">All sources</option>' +
      (model.outline || [])
        .map((o) => `<option value="${esc(o.id)}">${esc(o.label)}</option>`)
        .join('');
  }
  const sel = document.getElementById('ss-category');
  if (sel) {
    sel.innerHTML =
      '<option value="">All mapped cells</option>' +
      (model.categories || [])
        .map(
          (c) =>
            `<option value="${esc(c.id)}">${esc(c.label)} (${esc(
              formatMoney(c.total)
            )}, ${c.cellCount} cells)</option>`
        )
        .join('');
  }

  const paintMapped = (filterId, outlineId) => {
    const body = document.getElementById('ss-grid-body');
    if (!body) return;
    body.innerHTML = '';
    let rows = model.gridRows || [];
    if (filterId) rows = rows.filter((r) => r.categoryId === filterId);
    if (outlineId && outlineId !== 'unassigned') {
      if (outlineId.startsWith('foreign_property:')) {
        const cc = outlineId.split(':')[1];
        rows = rows.filter((r) => r.country === cc);
      } else {
        rows = rows.filter((r) => r.section === outlineId);
      }
    }
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      if (filterId && r.categoryId === filterId) {
        tr.style.background = 'var(--primary-soft, #e8f2ff)';
      }
      const state = r.mapState || 'included';
      tr.innerHTML = `<td><span class="tag ${stateTagClass(state)}">${esc(
        state
      )}</span></td>
        <td><code>${esc(r.cell || '—')}</code></td>
        <td>${esc(r.description || '—')}</td>
        <td class="amount-cell">${esc(formatMoney(r.value))}</td>
        <td><code style="font-size:0.8em">${esc(r.formula || '—')}</code></td>
        <td>${esc(r.hmrcPath || '—')}</td>`;
      tr.addEventListener('click', () => showCellDetail(r, model));
      body.appendChild(tr);
    }
  };

  const paintSheet = (sheetIndex) => {
    const sheets = model.sheets || [];
    const sheet = sheets[sheetIndex] || sheets[0];
    const head = document.getElementById('ss-sheet-head');
    const body = document.getElementById('ss-sheet-body');
    if (!head || !body || !sheet) return;
    const headers = sheet.headers || [];
    head.innerHTML =
      `<tr><th>#</th>` +
      headers.map((h) => `<th>${esc(h)}</th>`).join('') +
      `</tr>`;
    body.innerHTML = '';
    // Virtual window: first N rows (scroll loads more via same model)
    const windowSize = model.virtualisation?.rowWindow || 40;
    const rows = (sheet.rows || []).slice(0, windowSize);
    for (const row of rows) {
      const tr = document.createElement('tr');
      let tds = `<td>${esc(String(row.row))}</td>`;
      for (const h of headers) {
        const cell = row.cells?.[h];
        const bg = stateBg(cell?.mapState);
        const title = cell
          ? `${cell.mapState || ''}: ${cell.reason || ''}`
          : '';
        tds += `<td style="background:${bg};cursor:pointer" title="${esc(
          title
        )}" data-cell="${esc(cell?.cell || '')}">${esc(
          cell?.value ?? ''
        )}${
          cell?.formula
            ? `<br/><code style="font-size:0.7em">${esc(cell.formula)}</code>`
            : ''
        }</td>`;
      }
      tr.innerHTML = tds;
      tr.querySelectorAll('[data-cell]').forEach((td) => {
        td.addEventListener('click', () => {
          const ref = td.getAttribute('data-cell');
          const mapped = (model.gridRows || []).find((g) => g.cell === ref);
          if (mapped) showCellDetail(mapped, model);
          else {
            showCellDetail(
              {
                cell: ref,
                value: td.textContent,
                description: '—',
                hmrcPath: 'Unassigned / structural',
                reason: 'Not mapped to HMRC',
                mapState: 'unassigned',
              },
              model
            );
          }
        });
      });
      body.appendChild(tr);
    }
    if ((sheet.rows || []).length > windowSize) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="${headers.length + 1}" class="muted">Showing first ${windowSize} of ${sheet.rows.length} rows (virtualised).</td>`;
      body.appendChild(tr);
    }
  };

  paintMapped('', '');
  paintSheet(0);

  const onFilter = () => {
    paintMapped(sel?.value || '', outlineSel?.value || '');
    const id = sel?.value;
    const proof = document.getElementById('ss-total-proof');
    if (!proof) return;
    if (!id) {
      proof.hidden = true;
      return;
    }
    const cat = (model.categories || []).find((c) => c.id === id);
    if (!cat) {
      proof.hidden = true;
      return;
    }
    proof.hidden = false;
    proof.innerHTML = `<strong>${esc(cat.label)}</strong><br/>
      Total for this HMRC category: <strong>${esc(formatMoney(cat.total))}</strong><br/>
      ${cat.cellCount} spreadsheet cell${cat.cellCount === 1 ? '' : 's'} contribute.
      <button type="button" class="btn btn-ghost btn-sm" id="ss-jump-cells">Jump to cells</button>`;
    document.getElementById('ss-jump-cells')?.addEventListener('click', () => {
      document.getElementById('ss-grid')?.scrollIntoView({ behavior: 'smooth' });
    });
  };
  sel?.addEventListener('change', onFilter);
  outlineSel?.addEventListener('change', onFilter);
  sheetSel?.addEventListener('change', () =>
    paintSheet(Number(sheetSel.value) || 0)
  );
  document.getElementById('ss-show-cells')?.addEventListener('click', () => {
    onFilter();
    document.getElementById('ss-grid')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    });
  });

  if (lastDraftId) loadCellComments(lastDraftId);
}

function stateTagClass(state) {
  if (state === 'included') return 'green';
  if (state === 'invalid') return '';
  if (state === 'duplicate') return 'amber';
  return 'amber';
}

function stateBg(state) {
  if (state === 'included') return 'rgba(22,163,74,0.15)';
  if (state === 'needs_review') return 'rgba(217,119,6,0.18)';
  if (state === 'invalid') return 'rgba(220,38,38,0.15)';
  if (state === 'duplicate') return 'rgba(124,58,237,0.12)';
  if (state === 'ignored') return 'rgba(100,116,139,0.12)';
  return 'transparent';
}

/**
 * @param {object} r
 * @param {object} model
 */
function showCellDetail(r, model) {
  const box = document.getElementById('ss-cell-detail');
  const body = document.getElementById('ss-cell-detail-body');
  if (!box || !body) return;
  box.hidden = false;
  box.dataset.cellRef = r.cell || '';
  let fx = '';
  if (r.fx || r.section === 'foreign_property') {
    const f = r.fx || {};
    fx = `<br/><strong>FX:</strong> ${esc(
      f.note ||
        'If not GBP, provide rate + date — never invent exchange rates.'
    )}`;
  }
  body.innerHTML = `
    <strong>Cell:</strong> <code>${esc(r.cell || '—')}</code><br/>
    <strong>State:</strong> ${esc(r.mapState || '—')}<br/>
    <strong>Value:</strong> ${esc(
      typeof r.value === 'number' ? formatMoney(r.value) : String(r.value ?? '—')
    )}
    ${
      r.formula
        ? `<br/><strong>Formula:</strong> <code>${esc(
            r.formula
          )}</code> <span class="muted">(cached value — not recalculated here)</span>`
        : ''
    }<br/>
    <strong>Description:</strong> ${esc(r.description || '—')}<br/>
    <strong>Included in:</strong> ${esc(r.hmrcPath || '—')}<br/>
    <strong>Reason:</strong> ${esc(r.reason || '—')}${fx}<br/>
    <span class="muted">${esc(model.securityNote || '')}</span>
  `;
}

async function loadCellComments(draftId) {
  const ul = document.getElementById('ss-comments');
  if (!ul) return;
  try {
    const res = await apiFetch(
      `/api/me/drafts/${encodeURIComponent(draftId)}/cell-comments`
    );
    if (!res.ok) {
      ul.innerHTML = '';
      return;
    }
    const data = await res.json();
    ul.innerHTML = (data.comments || [])
      .map(
        (c) =>
          `<li><code>${esc(c.cellRef)}</code> · ${esc(c.authorRole)}: ${esc(
            c.body
          )}</li>`
      )
      .join('');
  } catch {
    ul.innerHTML = '';
  }
}

document.getElementById('ss-comment-save')?.addEventListener('click', async () => {
  if (!lastDraftId) return;
  const box = document.getElementById('ss-cell-detail');
  const cellRef = box?.dataset?.cellRef;
  const body = document.getElementById('ss-comment-body')?.value || '';
  if (!cellRef || !body.trim()) return;
  const res = await apiFetch(
    `/api/me/drafts/${encodeURIComponent(lastDraftId)}/cell-comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cellRef, body, authorRole: 'preparer' }),
    }
  );
  if (res.ok) {
    const ta = document.getElementById('ss-comment-body');
    if (ta) ta.value = '';
    loadCellComments(lastDraftId);
  }
});

/**
 * HMRC cumulative review: this quarter vs previously recorded vs year-to-date.
 * @param {string|null|undefined} draftId
 */
async function loadCumulativeReview(draftId) {
  const host = document.getElementById('cumulative-review');
  if (!host || !draftId) return;
  host.hidden = false;
  host.innerHTML = '<p class="muted">Loading year-to-date comparison…</p>';
  try {
    const res = await apiFetch(
      `/api/me/drafts/${encodeURIComponent(draftId)}/cumulative-review`
    );
    if (res.status === 401) {
      host.innerHTML =
        '<p class="muted">Sign in to see year-to-date totals against prior updates.</p>';
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      host.innerHTML = `<p class="muted">${esc(
        data.error || 'Review unavailable'
      )}</p>`;
      return;
    }
    const rev = data.review || {};
    let html = `<p class="muted" style="margin-top:0">${esc(
      rev.note ||
        'HMRC updates are cumulative from the start of the tax year through this period end.'
    )}</p>`;
    if (rev.periodStart && rev.periodEnd) {
      html += `<p><strong>Period</strong> ${esc(rev.periodStart)} → ${esc(
        rev.periodEnd
      )} · <strong>Tax year</strong> ${esc(rev.taxYear || '—')}</p>`;
    }
    if ((rev.sections || []).length) {
      html += '<details class="quarterly-breakdown"><summary>Show year-to-date category breakdown</summary>';
    }
    for (const sec of rev.sections || []) {
      html += `<h3 style="font-size:1rem;margin:1rem 0 0.35rem">${esc(
        sec.title
      )}</h3>`;
      html +=
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Category</th><th>This period</th><th>Previously recorded</th><th>Year-to-date for HMRC</th></tr></thead><tbody>';
      for (const row of sec.rows || []) {
        html += `<tr><td>${esc(row.label)}${
          row.note
            ? `<br/><span class="muted" style="font-size:0.85em">${esc(
                row.note
              )}</span>`
            : ''
        }</td><td class="amount-cell">${esc(
          formatMoney(row.thisQuarter)
        )}</td><td class="amount-cell">${esc(
          formatMoney(row.previouslyRecorded)
        )}</td><td class="amount-cell"><strong>${esc(
          formatMoney(row.yearToDate)
        )}</strong></td></tr>`;
      }
      html += '</tbody></table></div>';
    }
    if ((rev.sections || []).length) html += '</details>';
    if (!(rev.sections || []).length) {
      html += '<p class="muted">No line items to compare yet.</p>';
    }
    host.innerHTML = html;
  } catch {
    host.innerHTML = '<p class="muted">Could not load cumulative review.</p>';
  }
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

function renderDeclarationSummary() {
  const root = document.getElementById('declaration-summary');
  if (!root) return;
  const totals = lastSummary?.totals || {};
  const sources = lastSummary?.sources || [];
  const sourceRows = sources.length
    ? sources.map((source) => { const amount = Number(source.net ?? source.profit); return `<li><span>${esc(source.title || friendlySource(source.source || 'Income source'))}</span><strong>${Number.isFinite(amount) ? esc(formatMoney(amount)) : 'Included'}</strong></li>`; }).join('')
    : `<li><span>Income sources in this update</span><strong>${esc(String(lastSummary?.sourceCount || 1))}</strong></li>`;
  root.innerHTML = `<div><p class="eyebrow">Quarterly update summary</p><h3>Declare and submit</h3><p>Review the figures you are approving for this update.</p></div><ul>${sourceRows}<li class="declaration-total"><span>Total income</span><strong>${esc(formatMoney(totals.totalIncome ?? 0))}</strong></li><li><span>Total expenses</span><strong>${esc(formatMoney(totals.totalExpenses ?? 0))}</strong></li><li class="declaration-profit"><span>Profit for this period</span><strong>${esc(formatMoney(totals.net ?? 0))}</strong></li></ul>`;
}

function formatMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '—');
  return n.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
  });
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build review UI into review-panel elements in app.html.
 * @param {object} data
 */
function renderValidationInto(rootId, validation) {
  const validationRoot = document.getElementById(rootId);
  if (!validationRoot) return;
  const issues = [...(validation.errors || []), ...(validation.warnings || [])];
  let cls = 'ok';
  let title = 'Spreadsheet checks passed';
  if (validation.errors?.length) {
    cls = 'blocked';
    title = 'Fix these items before continuing';
  } else if (validation.warnings?.length) {
    title = 'Check these items before continuing';
  }
  const items =
    issues.length > 0
      ? issues.map((item) => `<li>${esc(item.message)}</li>`).join('')
      : '<li>Dates, sources and mapped figures are ready for review.</li>';
  validationRoot.innerHTML = `
      <div class="validation-box ${cls}" data-ready="${validation.ready ? '1' : '0'}">
        <strong>${esc(title)}</strong>
        <ul>${items}</ul>
      </div>
    `;
}

function showReview(data) {
  const success = document.getElementById('submit-success');
  if (success) success.hidden = true;
  const submitErr = document.getElementById('submit-error');
  if (submitErr) submitErr.hidden = true;

  const summary = data.summary;
  lastSummary = summary;
  lastValidation = data.validation || { ready: true, errors: [], warnings: [] };

  renderValidationInto('map-validation-panel', lastValidation);
  renderValidationInto('validation-panel', lastValidation);

  const mapContinue = document.getElementById('goto-figures');
  if (mapContinue) {
    mapContinue.disabled = !lastValidation.ready;
    mapContinue.title = lastValidation.ready
      ? ''
      : 'Resolve the blocking spreadsheet checks first';
  }
  const continueBtn = document.getElementById('goto-submit');
  if (continueBtn) {
    continueBtn.disabled = !lastValidation.ready;
    continueBtn.title = lastValidation.ready
      ? ''
      : 'Resolve the blocking spreadsheet checks first';
  }

  // Summary cards
  const cards = document.getElementById('summary-cards');
  if (cards) {
    const totals = summary?.totals || {};
    const taxYear = summary?.taxYear || data.payloads?.meta?.taxYear || '—';
    const start =
      summary?.periodStart || data.payloads?.meta?.periodStartDate || '—';
    const end = summary?.periodEnd || data.payloads?.meta?.periodEndDate || '—';
    let sourceCount =
      summary?.sourceCount ??
      0;
    if (!summary?.sourceCount) {
      if (data.sources?.selfEmployment) sourceCount += 1;
      if (data.sources?.ukProperty) sourceCount += 1;
      sourceCount += (data.sources?.foreignProperty || []).length;
    }
    const net = Number(totals.net);
    const netCls =
      Number.isFinite(net) && net < 0
        ? 'negative'
        : Number.isFinite(net)
          ? 'positive'
          : '';
    cards.innerHTML = `
      <div class="stat-card"><div class="n" id="metric-income">${esc(formatMoney(totals.totalIncome ?? 0))}</div><div class="l">Income</div></div>
      <div class="stat-card"><div class="n" id="metric-expenses">${esc(formatMoney(totals.totalExpenses ?? 0))}</div><div class="l">Expenses</div></div>
      <div class="stat-card"><div class="n ${netCls}" id="metric-net">${esc(formatMoney(totals.net ?? 0))}</div><div class="l">Net</div></div>
      <div class="stat-card"><div class="n" id="metric-sources">${esc(String(sourceCount))}</div><div class="l">Sources</div></div>
      <div class="stat-card"><div class="n" style="font-size:0.95rem">${esc(String(taxYear))}</div><div class="l">Tax year · ${esc(String(start))} → ${esc(String(end))}</div></div>
    `;
  }

  // Mapping / lines table
  const tableWrap = document.getElementById('mapping-table-wrap');
  if (tableWrap) {
    const links = data.fieldLinks || lastFieldLinks || [];
    const sourceBlocks = [];

    // Prefer structured summary sources if present
    if (summary?.sources?.length) {
      for (const src of summary.sources) {
        sourceBlocks.push({
          title: src.title || friendlySource(src.source || ''),
          lines: [
            ...(src.incomeLines || []).map((l) => ({
              ...l,
              kind: 'Income',
            })),
            ...(src.expenseLines || []).map((l) => ({
              ...l,
              kind: 'Expense',
            })),
          ],
        });
      }
    } else if (links.length) {
      const bySource = new Map();
      for (const link of links) {
        const key = link.source || 'unknown';
        if (!bySource.has(key)) bySource.set(key, []);
        bySource.get(key).push(link);
      }
      for (const [source, rows] of bySource) {
        sourceBlocks.push({
          title: friendlySource(source),
          lines: rows.map((link) => ({
            label: link.sourceField || friendlyPath(link.path),
            amount: link.value,
            kind: friendlyPath(link.path),
          })),
        });
      }
    }

    // Fallback from payloads when no links/summary
    if (!sourceBlocks.length && data.payloads) {
      const p = data.payloads;
      if (p.selfEmployment) {
        const se = p.selfEmployment;
        const lines = [];
        if (se.periodIncome?.turnover != null)
          lines.push({
            label: 'Turnover',
            amount: se.periodIncome.turnover,
            kind: 'Income',
          });
        if (se.periodIncome?.other != null)
          lines.push({
            label: 'Other income',
            amount: se.periodIncome.other,
            kind: 'Income',
          });
        const exp = se.periodExpenses || {};
        for (const [k, v] of Object.entries(exp)) {
          if (v != null && typeof v !== 'object')
            lines.push({ label: k, amount: v, kind: 'Expense' });
          else if (v && typeof v === 'object' && v.amount != null)
            lines.push({ label: k, amount: v.amount, kind: 'Expense' });
        }
        sourceBlocks.push({ title: 'Self-employment', lines });
      }
      if (p.ukProperty?.ukOtherProperty) {
        const uk = p.ukProperty.ukOtherProperty;
        const lines = [];
        if (uk.income?.periodAmount != null)
          lines.push({
            label: 'Rental income',
            amount: uk.income.periodAmount,
            kind: 'Income',
          });
        if (uk.income?.otherIncome != null)
          lines.push({
            label: 'Other income',
            amount: uk.income.otherIncome,
            kind: 'Income',
          });
        sourceBlocks.push({ title: 'UK property', lines });
      }
      for (const fp of p.foreignProperty?.foreignProperty || []) {
        const rent = fp.income?.rentIncome?.rentAmount;
        sourceBlocks.push({
          title: `Foreign property (${fp.countryCode || '??'})`,
          lines: [
            {
              label: 'Rent',
              amount: rent,
              kind: 'Income',
            },
          ],
        });
      }
    }

    let html = '';
    if (data.filename || data.rowCount != null) {
      html += `<p class="muted" id="period-meta">${esc(data.filename || lastFilename || 'Spreadsheet')}${
        data.rowCount != null || lastRowCount != null
          ? ` · ${esc(String(data.rowCount ?? lastRowCount))} rows`
          : ''
      }</p>`;
    }
    if (!sourceBlocks.length) {
      html += '<p class="muted">No line items found to display.</p>';
    } else {
      html += '<table class="data-table" id="links-table"><thead><tr><th>Source</th><th>Line</th><th>Type</th><th>Amount</th></tr></thead><tbody>';
      for (const block of sourceBlocks) {
        for (const line of block.lines) {
          html += `<tr><td>${esc(block.title)}</td><td>${esc(line.label || '—')}</td><td>${esc(line.kind || '—')}</td><td class="amount-cell">${esc(formatMoney(line.amount))}</td></tr>`;
        }
      }
      html += '</tbody></table>';
    }
    tableWrap.innerHTML = html;
  }
}

function resetToUpload() {
  lastPayloads = null;
  lastSummary = null;
  lastDraftId = null;
  lastValidation = null;
  lastFieldLinks = null;
  lastSources = null;
  lastFilename = null;
  lastRowCount = null;
  showPanels({ upload: true });
  const success = document.getElementById('submit-success');
  if (success) success.hidden = true;
  if (fileInput) fileInput.value = '';
  showChosenFile('');
  setWizardStep(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('back-to-upload')?.addEventListener('click', resetToUpload);
document.getElementById('another-file')?.addEventListener('click', resetToUpload);
document.getElementById('reset-upload')?.addEventListener('click', resetToUpload);
document.getElementById('reset-upload-2')?.addEventListener('click', resetToUpload);

document.getElementById('goto-figures')?.addEventListener('click', () => {
  if (lastValidation && !lastValidation.ready) return;
  showQuarterlyReviewState('figures');
  showPanels({ review: true });
  setWizardStep(3);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('goto-submit')?.addEventListener('click', () => {
  if (lastValidation && !lastValidation.ready) return;
  renderDeclarationSummary();
  showPanels({ submit: true });
  setWizardStep(4);
  const approve = document.getElementById('approve-cells');
  const submitBtn = document.getElementById('submit-btn');
  if (approve && submitBtn) {
    submitBtn.disabled = !approve.checked;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('approve-cells')?.addEventListener('change', (e) => {
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) submitBtn.disabled = !e.target.checked;
});

document.getElementById('back-to-review')?.addEventListener('click', () => {
  showPanels({ review: true });
  showQuarterlyReviewState('figures');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
document.getElementById('back-to-review-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('back-to-review')?.click();
});
document.getElementById('back-to-map-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  showPanels({ map: true });
  setWizardStep(3);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
document.getElementById('back-to-upload-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('back-to-upload')?.click();
});
document.getElementById('back-to-upload-from-map')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('back-to-upload')?.click();
});
document.getElementById('back-to-sources')?.addEventListener('click', (e) => {
  e.preventDefault();
  showPanels({ sources: true });
  setWizardStep(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
document.getElementById('open-ss-viewer')?.addEventListener('click', () => {
  document.getElementById('ss-viewer-dialog')?.showModal();
});
document.getElementById('close-ss-viewer')?.addEventListener('click', () => {
  document.getElementById('ss-viewer-dialog')?.close();
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

  const approved = document.getElementById('approve-cells');
  if (approved && !approved.checked) {
    if (errEl) {
      errEl.textContent =
        'Please confirm you have checked the figures and any issues before sending.';
      errEl.hidden = false;
    }
    return;
  }

  const btn = document.getElementById('submit-btn');
  let submissionProcessed = false;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending…';
  }

  try {
    const res = await apiFetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: lastDraftId || undefined,
        payloads: lastDraftId ? undefined : lastPayloads,
        cellsApproved: true,
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
      const messages =
        data.validation?.errors?.map((item) => item.message).filter(Boolean) ||
        [];
      throw new Error(
        messages.length
          ? messages.join(' ')
          : data.error || 'Submission failed. Please try again.'
      );
    }

    const count = Array.isArray(data.results) ? data.results.length : 0;
    const ok = data.ok;
    const previewOnly = data.previewOnly || data.mode === 'double';
    if (summary) {
      const receiptBit = data.attemptId
        ? ` Local record: ${data.attemptId}.`
        : '';
      const replay = data.idempotentReplay ? ' (safe replay)' : '';
      if (ok && previewOnly) {
        summary.textContent = `Update prepared for ${count} income source${count === 1 ? '' : 's'}. NOT sent to HMRC yet — check connection and try again when ready.${receiptBit}${replay}`;
      } else if (ok) {
        summary.textContent = `HMRC response received for ${count} income source${count === 1 ? '' : 's'}.${receiptBit}${replay}`;
      } else {
        summary.textContent =
          'Something went wrong with one or more updates. Review the details below.';
      }
    }
    if (list) {
      list.innerHTML = '';
      for (const r of data.results || []) {
        const li = document.createElement('li');
        const src = friendlySource(r.request?.source || 'update');
        const id =
          r.response?.previewReceiptId ||
          r.response?.submissionId ||
          r.response?.message ||
          r.status ||
          '';
        const statusLabel = !r.ok
          ? 'Not accepted'
          : previewOnly || r.mode === 'double'
            ? 'Not sent to HMRC yet'
            : 'HMRC response OK';
        li.innerHTML = `<span>${esc(src)}</span><span>${esc(statusLabel)}${id ? ` · ${esc(String(id))}` : ''}</span>`;
        list.appendChild(li);
      }
    }
    if (successBox) successBox.hidden = false;
    submissionProcessed = true;
    setWizardStep(3);
    successBox?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Persist cumulative totals for next update comparison (signed-in)
    if (lastDraftId) {
      apiFetch(`/api/me/drafts/${encodeURIComponent(lastDraftId)}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: data.attemptId || null }),
      }).catch(() => {});
    }
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message || String(err);
      errEl.hidden = false;
    }
  } finally {
    if (btn) {
      btn.disabled = submissionProcessed;
      btn.textContent = submissionProcessed
        ? 'Update already processed'
        : 'Send quarterly update';
    }
  }
});

function applyBusinessId(typeOfBusiness, businessId) {
  if (!businessId) return;
  const t = String(typeOfBusiness || '').toLowerCase();
  if (t.includes('self-employment') || t.includes('self_employment')) {
    const el = document.getElementById('bid-se');
    if (el) el.value = businessId;
  } else if (
    t.includes('uk-property') ||
    t.includes('uk_property') ||
    t === 'uk property'
  ) {
    const el = document.getElementById('bid-uk');
    if (el) el.value = businessId;
  } else if (t.includes('foreign-property') || t.includes('foreign_property')) {
    const el = document.getElementById('bid-fp');
    if (el) el.value = businessId;
  } else {
    for (const id of ['bid-se', 'bid-uk', 'bid-fp']) {
      const el = document.getElementById(id);
      if (el && !el.value) {
        el.value = businessId;
        break;
      }
    }
  }
}

function ninoFromForm() {
  return (document.getElementById('nino')?.value || '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

document
  .getElementById('load-businesses-btn')
  ?.addEventListener('click', async () => {
    const panelEl = document.getElementById('hmrc-businesses-panel');
    const list = document.getElementById('hmrc-businesses-list');
    const errEl = document.getElementById('hmrc-businesses-error');
    if (panelEl) panelEl.hidden = false;
    if (list) list.innerHTML = '';
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    const nino = ninoFromForm();
    if (!nino) {
      if (errEl) {
        errEl.textContent = 'Enter your National Insurance number first.';
        errEl.hidden = false;
      }
      return;
    }
    try {
      const res = await apiFetch(
        `/api/hmrc/businesses?nino=${encodeURIComponent(nino)}`
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(
          data.error ||
            data.body?.message ||
            `HMRC businesses failed (${res.status})`
        );
      }
      const businesses =
        data.body?.listOfBusinesses || data.body?.businesses || data.body || [];
      const rows = Array.isArray(businesses) ? businesses : [];
      if (!rows.length) {
        if (list) {
          list.innerHTML =
            '<li class="muted">No businesses returned for this NINO in the current environment.</li>';
        }
        return;
      }
      for (const b of rows) {
        const id = b.businessId || b.id || '';
        const type = b.typeOfBusiness || b.businessType || b.type || 'business';
        const trading = b.tradingName || b.trading_name || '';
        const li = document.createElement('li');
        li.innerHTML = `<strong>${esc(type)}</strong> · <code>${esc(id)}</code>${trading ? ` · ${esc(trading)}` : ''}`;
        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'btn btn-ghost';
        useBtn.style.marginLeft = '0.5rem';
        useBtn.textContent = 'Use ID';
        useBtn.addEventListener('click', () => applyBusinessId(type, id));
        li.appendChild(useBtn);
        list?.appendChild(li);
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent =
          err.message ||
          'Could not load businesses. Connect HMRC first from Connect HMRC.';
        errEl.hidden = false;
      }
    }
  });

document
  .getElementById('load-obligations-btn')
  ?.addEventListener('click', async () => {
    const panelEl = document.getElementById('hmrc-obligations-panel');
    const list = document.getElementById('hmrc-obligations-list');
    const errEl = document.getElementById('hmrc-obligations-error');
    if (panelEl) panelEl.hidden = false;
    if (list) list.innerHTML = '';
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    const nino = ninoFromForm();
    if (!nino) {
      if (errEl) {
        errEl.textContent = 'Enter your National Insurance number first.';
        errEl.hidden = false;
      }
      return;
    }
    try {
      const q = new URLSearchParams({ nino });
      const bid =
        document.getElementById('bid-se')?.value ||
        document.getElementById('bid-uk')?.value ||
        document.getElementById('bid-fp')?.value;
      if (bid) q.set('businessId', bid);
      const res = await apiFetch(`/api/hmrc/obligations?${q.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(
          data.error ||
            data.body?.message ||
            `HMRC obligations failed (${res.status})`
        );
      }
      const body = data.body || {};
      const obligations =
        body.obligations ||
        body.obligationDetails ||
        body.incomeAndExpenditureObligations ||
        (Array.isArray(body) ? body : []);
      const flat = [];
      if (Array.isArray(obligations)) {
        for (const group of obligations) {
          const type = group.typeOfBusiness || group.businessType || '';
          const businessId = group.businessId || '';
          const periods =
            group.obligationDetails || group.obligations || [group];
          for (const p of periods) {
            flat.push({
              type,
              businessId: businessId || p.businessId || '',
              status: p.status || group.status || '',
              start: p.periodStartDate || p.fromDate || p.start || '',
              end: p.periodEndDate || p.toDate || p.end || '',
              due: p.dueDate || p.due || '',
            });
          }
        }
      }
      if (!flat.length) {
        if (list) {
          list.innerHTML =
            '<li class="muted">No open periods returned for this NINO.</li>';
        }
        return;
      }
      for (const o of flat) {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${esc(o.status || 'obligation')}</strong> · ${esc(o.start || '?')} → ${esc(o.end || '?')}${
          o.due ? ` · due ${esc(o.due)}` : ''
        }${o.businessId ? ` · <code>${esc(o.businessId)}</code>` : ''}`;
        if (o.businessId) {
          const useBtn = document.createElement('button');
          useBtn.type = 'button';
          useBtn.className = 'btn btn-ghost';
          useBtn.style.marginLeft = '0.5rem';
          useBtn.textContent = 'Use ID';
          useBtn.addEventListener('click', () =>
            applyBusinessId(o.type, o.businessId)
          );
          li.appendChild(useBtn);
        }
        list?.appendChild(li);
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent =
          err.message ||
          'Could not load obligations. Connect HMRC first from Connect HMRC.';
        errEl.hidden = false;
      }
    }
  });

document.getElementById('nil-update-btn')?.addEventListener('click', async () => {
  const errEl = document.getElementById('upload-error');
  try {
    const res = await apiFetch('/api/me/nil-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'self_employment',
        taxYear: document.getElementById('tax-year')?.value || '2024-25',
        periodStartDate: '2024-04-06',
        periodEndDate: '2024-07-05',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Nil update failed');
    handleImportSuccess({
      payloads: data.payloads,
      summary: {
        taxYear: data.payloads.meta.taxYear,
        periodStart: data.payloads.meta.periodStartDate,
        periodEnd: data.payloads.meta.periodEndDate,
        totals: { totalIncome: 0, totalExpenses: 0, net: 0 },
        sourceCount: 1,
        sources: [],
      },
      validation: { ready: true, errors: [], warnings: [] },
      draftId: data.draftId,
      filename: 'nil-update',
      sources: { selfEmployment: true, ukProperty: false, foreignProperty: [] },
      fieldLinks: [],
      metadata: {},
    });
  } catch (e) {
    if (errEl) {
      errEl.textContent = e.message || String(e);
      errEl.hidden = false;
    }
  }
});

// After successful submit, snapshot cumulative YTD for next period comparison
const _origSubmitHandlerNote = true;
document.getElementById('submit-btn')?.addEventListener(
  'click',
  async () => {
    /* snapshot hooked after success inside existing handler via patch below */
  },
  true
);

setWizardStep(1);
showPanels({ sources: true });
loadStatus();
loadSavedIdentifiers();

/** Self Assessment Assist (MTD) — HMRC fields only via HmrcAssist renderer. */
document.getElementById('assist-report-btn')?.addEventListener('click', async () => {
  const err = document.getElementById('assist-error');
  const view = document.getElementById('assist-view');
  if (err) err.hidden = true;
  const calculationId =
    document.getElementById('assist-calculation-id')?.value?.trim() ||
    sessionStorage.getItem('st_last_calculation_id') ||
    '';
  const taxYear =
    document.getElementById('assist-tax-year')?.value?.trim() ||
    document.getElementById('tax-year')?.value?.trim() ||
    '';
  const nino = document.getElementById('nino')?.value?.trim() || '';
  if (!calculationId) {
    if (err) {
      err.textContent =
        'An HMRC calculation reference is required first. Complete a tax calculation (usually at year-end), or enter the reference under Advanced.';
      err.hidden = false;
    }
    return;
  }
  try {
    const res = await apiFetch('/api/hmrc/mtd/assist/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calculationId, taxYear, nino }),
    });
    const data = await res.json().catch(() => ({}));
    if (!view) return;
    const payload = {
      ...data,
      status: data.status ?? res.status,
      hmrcStatus: data.status ?? data.hmrcStatus ?? res.status,
      noContent: res.status === 204 || data.status === 204,
      correlationId: data.correlationId || data.body?.correlationId || null,
    };
    if (res.status === 401) {
      view.hidden = false;
      view.innerHTML = '<p><a href="/signin?next=/app">Sign in</a></p>';
      return;
    }
    if (!window.HmrcAssist) {
      view.hidden = false;
      view.textContent = '';
      return;
    }
    if (res.status === 204 || payload.noContent) {
      window.HmrcAssist.renderAssist(view, { ...payload, noContent: true });
      if (err) {
        err.hidden = false;
        err.textContent = '';
        err.hidden = true;
      }
      // Product note only: HMRC returned no content — show empty state without invented advice
      view.hidden = false;
      view.dataset.assistStatus = '204';
      view.innerHTML = '';
      return;
    }
    window.HmrcAssist.renderAssist(view, payload, {
      onAcknowledge: async ({ reportId, correlationId }) => {
        const ack = await apiFetch('/api/hmrc/mtd/assist/acknowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportId, correlationId, nino, taxYear }),
        });
        const aj = await ack.json().catch(() => ({}));
        if (ack.ok || aj.ok || aj.status === 204 || ack.status === 204) {
          window.HmrcAssist.renderAcknowledged(view);
        } else if (err) {
          err.textContent = aj.error || `HMRC ${aj.status || ack.status}`;
          err.hidden = false;
        }
      },
    });
  } catch (e) {
    if (err) {
      err.textContent = e.message || String(e);
      err.hidden = false;
    }
  }
});

// Prefer business IDs from saved income sources (no manual typing)
(async function prefillFromIncomeSources() {
  try {
    const res = await apiFetch('/api/me/income-sources');
    if (!res.ok) return;
    const data = await res.json();
    for (const s of data.sources || []) {
      if (s.type === 'self_employment' && s.businessId) {
        const el = document.getElementById('bid-se');
        if (el && !el.value) el.value = s.businessId;
      }
      if (s.type === 'uk_property' && s.businessId) {
        const el = document.getElementById('bid-uk');
        if (el && !el.value) el.value = s.businessId;
      }
      if (s.type === 'foreign_property' && s.businessId) {
        const el = document.getElementById('bid-fp');
        if (el && !el.value) el.value = s.businessId;
      }
    }
  } catch {
    /* signed out */
  }
})();

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
