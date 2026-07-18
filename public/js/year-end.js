/** Customer year-end guided tax return case — stages + HMRC workflows. */

/** @type {{ id: string, title: string, detail: string }[]} */
let eoyStages = [];
/** @type {Record<string, unknown> | null} */
let eoyCase = null;
let eoyDirty = false;
let pendingYearEndHref = '';
let pendingYearEndStage = '';

/** Stage → primary HMRC workflow button(s) */
const STAGE_ACTIONS = {
  quarterly_complete: [
    { wf: 'final_obligations', label: 'Load year-end obligations', primary: true },
  ],
  review_totals: [
    { href: '/history', label: 'Review submission history' },
    { href: '/records', label: 'Open digital records' },
  ],
  se_adjustments: [
    { wf: 'se_annual', label: 'Submit SE annual adjustments', primary: true },
  ],
  uk_adjustments: [
    { wf: 'uk_annual', label: 'Submit UK property annual', primary: true },
  ],
  foreign_adjustments: [
    { wf: 'fp_annual', label: 'Submit foreign property annual', primary: true },
  ],
  other_income_losses: [
    { wf: 'losses', label: 'Brought-forward loss', primary: true },
    { wf: 'other_income', label: 'Other income adjustment', primary: true },
  ],
  calculation: [
    { wf: 'calc', label: 'Trigger tax calculation', primary: true },
    { wf: 'calc_list', label: 'List calculations' },
  ],
  bsas: [
    { wf: 'bsas_trigger', label: 'Trigger BSAS', primary: true },
    { wf: 'bsas_list', label: 'List BSAS' },
    { wf: 'bsas_adjust', label: 'Adjust BSAS (SE)' },
    { wf: 'bsas_adjust_uk', label: 'Adjust BSAS (UK)' },
    { wf: 'bsas_adjust_fp', label: 'Adjust BSAS (foreign)' },
  ],
  final_declaration: [
    { wf: 'final_calc', label: 'Intent to finalise', primary: true },
  ],
  complete: [
    { href: '/history', label: 'View receipts & history' },
  ],
};

function fraudClientHeaders() {
  /** @type {Record<string, string>} */
  const h = {};
  try {
    h['X-Client-Timezone-Offset'] = String(-new Date().getTimezoneOffset());
    if (window.innerWidth > 0 && window.innerHeight > 0) {
      h['X-Client-Window-Size'] = `${window.innerWidth}x${window.innerHeight}`;
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
    /* ignore */
  }
  return h;
}

async function api(url, options = {}) {
  const headers = {
    ...fraudClientHeaders(),
    ...(options.headers || {}),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(url, { ...options, headers });
}

function ids() {
  return {
    nino: (document.getElementById('nino')?.value || '')
      .replace(/\s+/g, '')
      .toUpperCase(),
    taxYear: document.getElementById('tax-year')?.value || '2024-25',
    businessIdSe: document.getElementById('bid-se')?.value || '',
    businessIdUk: document.getElementById('bid-uk')?.value || '',
    businessIdForeign: document.getElementById('bid-fp')?.value || '',
    periodId: document.getElementById('period-id')?.value || '',
    calculationId: document.getElementById('bsas-calc-id')?.value || '',
  };
}

function showOut(obj) {
  const el = document.getElementById('wf-out');
  if (el) el.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
}

function showResult(data) {
  const resultPanel = document.getElementById('year-end-result');
  if (resultPanel) resultPanel.hidden = false;
  const err = document.getElementById('wf-error');
  const ok = document.getElementById('wf-success');
  const sum = document.getElementById('wf-summary');
  const rec = document.getElementById('wf-receipt');
  const link = document.getElementById('wf-receipt-link');
  if (err) err.hidden = true;
  if (ok) ok.hidden = false;
  if (sum) {
    sum.textContent = data.ok
      ? `Step “${data.workflow}” completed (mode: ${data.mode}).`
      : `Step “${data.workflow}” failed or returned non-success from HMRC.`;
  }
  const rb = data.readback;
  let rbLine = '';
  if (rb && rb.attempted) {
    rbLine = ` Readback attempted (HMRC ${rb.hmrcStatus ?? '—'}${rb.ok === false ? ', not OK' : rb.ok ? ', OK' : ''}).`;
  } else if (rb && rb.note) {
    rbLine = ` Readback: ${rb.note}`;
  }
  if (rec) {
    rec.textContent = data.receiptId
      ? `Receipt id: ${data.receiptId}.${rbLine}`
      : `No receipt id (check error output).${rbLine}`;
  }
  if (link && data.receiptId) {
    link.href = `/api/receipts/${encodeURIComponent(data.receiptId)}`;
    link.textContent = 'Download receipt JSON';
  }
  renderCalculationResult(data);
  showOut(data);
}

function renderCalculationResult(data) {
  const root = document.getElementById('calculation-view');
  if (!root) return;
  const isCalculation = ['calc', 'calc_list', 'final_calc'].includes(data.workflow);
  if (!isCalculation) { root.hidden = true; root.innerHTML = ''; return; }
  root.hidden = false;
  if (data.previewOnly) {
    root.innerHTML = '<h3>Calculation not available in preview</h3><p>No HMRC calculation HTTP request was made. This preview receipt does not contain a tax estimate.</p>';
    return;
  }
  const source = data.readback?.body || data.body || {};
  const values = [];
  const visit = (object, prefix = '') => {
    if (!object || typeof object !== 'object' || values.length >= 12) return;
    for (const [key, value] of Object.entries(object)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'number' && /(tax|income|profit|liability|allowance|expense|amount|due)/i.test(path)) values.push([path, value]);
      else if (value && typeof value === 'object') visit(value, path);
      if (values.length >= 12) break;
    }
  };
  visit(source);
  if (!values.length) {
    root.innerHTML = '<h3>HMRC response received</h3><p>The response did not contain calculation amounts this screen can safely label. Download the receipt for the complete response.</p>';
    return;
  }
  root.innerHTML = `<h3>HMRC calculation figures</h3><p>Values below are read from the HMRC response; they are not calculated locally.</p><dl>${values.map(([path,value]) => `<div><dt>${esc(path.replace(/[._]/g,' '))}</dt><dd>${new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value)}</dd></div>`).join('')}</dl>`;
}

function showError(msg) {
  const resultPanel = document.getElementById('year-end-result');
  if (resultPanel) resultPanel.hidden = false;
  const err = document.getElementById('wf-error');
  const ok = document.getElementById('wf-success');
  if (ok) ok.hidden = true;
  if (err) {
    err.textContent = msg;
    err.hidden = false;
  }
}

async function runWorkflow(name) {
  const body = { workflow: name, ...ids(), ...workflowPayload(name) };
  try {
    const res = await api('/api/workflows/run', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || `Request failed (${res.status})`);
      showOut(data);
      return;
    }
    showResult(data);
  } catch (e) {
    showError(e.message || String(e));
  }
}

function money(id) {
  const value = Number(document.getElementById(id)?.value || 0);
  return Number.isFinite(value) ? value : 0;
}

function workflowPayload(name) {
  if (name === 'se_annual') {
    return { body: { allowances: { annualInvestmentAllowance: money('eoy-se-aia'), otherCapitalAllowance: money('eoy-se-other-allowance') }, adjustments: { includedNonTaxableProfits: money('eoy-se-nontaxable'), basisAdjustment: money('eoy-se-basis') } } };
  }
  if (name === 'uk_annual') {
    return { body: { ukOtherProperty: { adjustments: { privateUseAdjustment: money('eoy-uk-private'), balancingCharge: money('eoy-uk-balancing') }, allowances: { annualInvestmentAllowance: money('eoy-uk-aia'), otherCapitalAllowance: money('eoy-uk-other-allowance') } } } };
  }
  if (name === 'fp_annual') {
    const countries = (eoyCase?.foreignPropertyRecords || []).filter((record) => /^[A-Z]{3}$/.test(record.countryCode || ''));
    return { body: { foreignProperty: countries.map((record) => ({ countryCode: record.countryCode, adjustments: { privateUseAdjustment: money(`eoy-fp-private-${record.id}`), balancingCharge: money(`eoy-fp-balancing-${record.id}`) }, allowances: { annualInvestmentAllowance: money(`eoy-fp-aia-${record.id}`), otherCapitalAllowance: money(`eoy-fp-other-${record.id}`) } })) } };
  }
  if (name === 'losses') {
    return { body: { businessId: ids().businessIdSe, typeOfLoss: 'self-employment', lossAmount: money('eoy-loss'), taxYearBroughtForwardFrom: ids().taxYear } };
  }
  return {};
}

function field(id, label, hint = '') {
  return `<label>${label}<span class="money-input"><span>£</span><input id="${id}" type="number" min="0" step="0.01" value="0"></span>${hint ? `<small>${hint}</small>` : ''}</label>`;
}

function renderEditor(stageId) {
  const root = document.getElementById('eoy-editor');
  if (!root) return;
  if (stageId === 'se_adjustments') {
    root.innerHTML = `<div class="eoy-form"><h4>Self-employment annual adjustments</h4><div class="detail-grid">${field('eoy-se-aia','Annual investment allowance')}${field('eoy-se-other-allowance','Other capital allowance')}${field('eoy-se-nontaxable','Included non-taxable profits')}${field('eoy-se-basis','Basis adjustment')}</div><p class="help-tip">These are annual adjustments, not quarterly income and expenses. Enter only amounts supported by your records.</p></div>`;
  } else if (stageId === 'uk_adjustments') {
    const uk = (eoyCase?.sources || []).find((source) => source.type === 'uk_property');
    root.innerHTML = `<div class="eoy-form"><h4>UK property annual adjustments</h4>${uk?.joint ? `<p class="help-tip">Jointly owned source · saved ownership share ${esc(uk.ownershipShare || 50)}%. Check that uploaded records already represent the reportable share.</p>` : ''}<div class="detail-grid">${field('eoy-uk-private','Private-use adjustment')}${field('eoy-uk-balancing','Balancing charge')}${field('eoy-uk-aia','Annual investment allowance')}${field('eoy-uk-other-allowance','Other capital allowance')}</div></div>`;
  } else if (stageId === 'foreign_adjustments') {
    const foreign = (eoyCase?.foreignPropertyRecords || []).filter((record) => /^[A-Z]{3}$/.test(record.countryCode || ''));
    root.innerHTML = foreign.length ? `<div class="eoy-form"><h4>Foreign property annual adjustments</h4><div class="foreign-tabs" role="tablist" aria-label="Foreign property countries">${foreign.map((record,index) => `<button type="button" role="tab" data-foreign-tab="${esc(record.id)}" aria-selected="${index === 0}">${esc(record.label || record.countryCode)} <span>${esc(record.countryCode)}</span></button>`).join('')}</div><p class="help-tip">Enter GBP values only. Keep evidence of the exchange-rate method and foreign tax with your digital records.</p>${foreign.map((record,index) => `<section class="foreign-adjustment" data-foreign-panel="${esc(record.id)}" ${index === 0 ? '' : 'hidden'}><div class="foreign-heading"><div><h5>${esc(record.label || record.countryCode)} adjustments</h5><p>For tax year ${esc(eoyCase?.taxYear || '')}</p></div><strong>${esc(record.countryCode)}</strong></div><div class="detail-grid">${field(`eoy-fp-private-${record.id}`,'Private-use adjustment')}${field(`eoy-fp-balancing-${record.id}`,'Balancing charge')}${field(`eoy-fp-aia-${record.id}`,'Annual investment allowance')}${field(`eoy-fp-other-${record.id}`,'Other capital allowance')}<label>Exchange-rate evidence<select id="eoy-fp-rate-${record.id}"><option>HMRC monthly average rate</option><option>HMRC annual average rate</option><option>Transaction-date rate with evidence</option></select><small>Saved as evidence; this choice is not silently sent as an annual adjustment.</small></label>${field(`eoy-fp-tax-${record.id}`,'Foreign tax paid (evidence only)','Saved with this case. It is not added to an unsupported HMRC field.')}</div></section>`).join('')}</div>` : '<div class="eoy-form"><h4>Foreign property annual adjustments</h4><p class="help-tip">No country records have been carried forward from an uploaded spreadsheet. Spreadsheet Tax will not invent a country or create a separate HMRC income source. Upload and review the foreign-property spreadsheet before this step.</p><a class="btn btn-primary" href="/app?flow=quarterly">Upload foreign-property spreadsheet</a></div>';
  } else if (stageId === 'other_income_losses') {
    root.innerHTML = `<div class="eoy-form"><h4>Losses and other income</h4><div class="detail-grid">${field('eoy-loss','Brought-forward self-employment loss','Use only a loss supported by earlier records.')}</div></div>`;
  } else if (stageId === 'calculation') {
    root.innerHTML = '<div class="eoy-form"><h4>HMRC calculation</h4><p class="help-tip">The product requests a calculation from HMRC. It does not invent or locally calculate your final tax bill.</p></div>';
  } else if (stageId === 'final_declaration') {
    root.innerHTML = '<div class="eoy-form declaration-box"><h4>Review before finalising</h4><label><input type="checkbox" id="eoy-declaration"> I confirm I have reviewed the figures and understand that finalising may create a submission to HMRC when live mode is explicitly enabled.</label><p class="muted">The current connection mode remains visible at the top of this page.</p></div>';
  } else {
    root.innerHTML = '';
  }
  const saved = eoyCase?.data?.[stageId] || {};
  root.querySelectorAll('input[id], select[id]').forEach((input) => {
    if (Object.prototype.hasOwnProperty.call(saved, input.id)) {
      if (input.type === 'checkbox') input.checked = Boolean(saved[input.id]);
      else input.value = String(saved[input.id]);
    }
    input.addEventListener('input', () => { eoyDirty = true; });
    input.addEventListener('change', () => { eoyDirty = true; });
  });
  root.querySelectorAll('[data-foreign-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.foreignTab;
      root.querySelectorAll('[data-foreign-tab]').forEach((tab) => tab.setAttribute('aria-selected', String(tab === button)));
      root.querySelectorAll('[data-foreign-panel]').forEach((panel) => { panel.hidden = panel.dataset.foreignPanel !== id; });
    });
  });
}

function collectEditorData() {
  const out = {};
  document.querySelectorAll('#eoy-editor input[id], #eoy-editor select[id]').forEach((input) => {
    out[input.id] = input.type === 'checkbox' ? input.checked : input.value;
  });
  return out;
}

function renderProgress() {
  const wrap = document.getElementById('eoy-progress');
  if (!wrap || !eoyCase) return;
  const completed = new Set(eoyCase.completedStages || []);
  wrap.innerHTML = '';
  for (const s of eoyStages) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'eoy-chip';
    btn.setAttribute('role', 'listitem');
    btn.dataset.stageId = s.id;
    if (s.id === eoyCase.stageId) btn.classList.add('active');
    if (completed.has(s.id) || s.id === 'complete' && eoyCase.stageId === 'complete') {
      btn.classList.add('done');
    }
    btn.textContent = s.title;
    btn.addEventListener('click', () => jumpToStage(s.id));
    wrap.appendChild(btn);
  }
}

function renderStageActions(stageId) {
  const box = document.getElementById('stage-actions');
  if (!box) return;
  box.innerHTML = '';
  const actions = STAGE_ACTIONS[stageId] || [];
  if (!actions.length) {
    box.innerHTML = '<p class="muted">No HMRC call on this step — review and mark done when ready.</p>';
    return;
  }
  for (const a of actions) {
    if (a.href) {
      const link = document.createElement('a');
      link.className = 'btn btn-ghost';
      link.href = a.href;
      link.textContent = a.label;
      box.appendChild(link);
    } else if (a.wf) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = a.primary ? 'btn btn-primary' : 'btn btn-ghost';
      btn.setAttribute('data-wf', a.wf);
      btn.textContent = a.label;
      btn.addEventListener('click', () => {
        if (a.wf === 'fp_annual' && !(eoyCase?.foreignPropertyRecords || []).some((record) => /^[A-Z]{3}$/.test(record.countryCode || ''))) {
          showError('Upload and review foreign-property spreadsheet records first. No country will be invented or typed in as an HMRC income source.');
          return;
        }
        if (a.wf === 'final_calc' && !document.getElementById('eoy-declaration')?.checked) {
          showError('Confirm the final declaration review before continuing.');
          return;
        }
        runWorkflow(a.wf);
      });
      box.appendChild(btn);
    }
  }
}

function renderCase() {
  if (!eoyCase) return;
  const meta = document.getElementById('case-meta');
  const stage = eoyStages.find((s) => s.id === eoyCase.stageId) || eoyStages[0];
  if (meta) {
    const done = (eoyCase.completedStages || []).length;
    meta.textContent = `Tax year ${eoyCase.taxYear} · step ${
      (eoyCase.stageIndex ?? 0) + 1
    } of ${eoyStages.length} · ${done} step(s) marked done`;
  }
  const title = document.getElementById('stage-title');
  const detail = document.getElementById('stage-detail');
  if (title) title.textContent = stage?.title || eoyCase.stageId;
  if (detail) detail.textContent = stage?.detail || '';
  const noteEl = document.getElementById('stage-note');
  if (noteEl) {
    noteEl.value = (eoyCase.notes && eoyCase.notes[eoyCase.stageId]) || '';
  }
  renderProgress();
  renderStageActions(eoyCase.stageId);
  renderEditor(eoyCase.stageId);

  const sources = eoyCase.sources || [];
  const list = document.getElementById('source-list');
  if (list) {
    if (!sources.length) {
      list.innerHTML =
        '<li class="muted">No income sources saved yet — add them on Home / Onboarding or fill IDs from HMRC.</li>';
    } else {
      list.innerHTML = sources
        .map(
          (s) =>
            `<li><span class="source-avatar">${s.type === 'self_employment' ? 'SE' : s.type === 'uk_property' ? 'UK' : 'FP'}</span><span><strong>${esc(s.nickname || s.label || s.type)}</strong><small>${esc(s.label || s.type || '')}${s.businessId ? ` · ${esc(s.businessId)}` : ''}</small></span><b>${s.type === 'foreign_property' ? 'Countries come from spreadsheet' : 'Review adjustments'}</b></li>`
        )
        .join('');
    }
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function loadCase() {
  const taxYear = document.getElementById('tax-year')?.value || '';
  const q = taxYear ? `?taxYear=${encodeURIComponent(taxYear)}` : '';
  try {
    const res = await api(`/api/me/eoy-case${q}`);
    if (res.status === 401) {
      const gate = document.getElementById('gate');
      if (gate) {
        gate.hidden = false;
        gate.innerHTML =
          'Sign in required for a saved tax return case. <a href="/signin?next=/year-end">Sign in</a>';
      }
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Could not load year-end case');
      return;
    }
    eoyCase = data.case;
    eoyStages = data.case?.stages || data.stages || [];
    if (eoyCase?.taxYear) {
      const ty = document.getElementById('tax-year');
      if (ty && !ty.dataset.userEdited) ty.value = eoyCase.taxYear;
    }
    renderCase();
  } catch (e) {
    showError(e.message || String(e));
  }
}

async function patchCase(body) {
  const taxYear = document.getElementById('tax-year')?.value || undefined;
  const res = await api('/api/me/eoy-case', {
    method: 'PUT',
    body: JSON.stringify({ taxYear, ...body }),
  });
  const data = await res.json();
  if (!res.ok) {
    showError(data.error || 'Could not update case');
    showOut(data);
    return null;
  }
  eoyCase = data.case;
  eoyStages = data.case?.stages || eoyStages;
  renderCase();
  return data;
}

async function jumpToStage(stageId) {
  if (eoyDirty) {
    pendingYearEndStage = stageId;
    document.getElementById('unsaved-year-end-dialog')?.showModal();
    return;
  }
  await patchCase({ stageId });
}

async function completeCurrent() {
  const note = document.getElementById('stage-note')?.value || '';
  const stageId = eoyCase?.stageId;
  await patchCase({
    completeCurrent: true,
    note: note || undefined,
    data: stageId ? { [stageId]: collectEditorData() } : undefined,
  });
  eoyDirty = false;
}

async function saveNoteOnly() {
  const note = document.getElementById('stage-note')?.value || '';
  const stageId = eoyCase?.stageId;
  await patchCase({ note, data: stageId ? { [stageId]: collectEditorData() } : undefined });
  eoyDirty = false;
}

document.querySelectorAll('[data-wf]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const name = btn.getAttribute('data-wf');
    if (name) runWorkflow(name);
  });
});

document.getElementById('complete-stage')?.addEventListener('click', () => {
  completeCurrent();
});
document.getElementById('save-note')?.addEventListener('click', () => {
  saveNoteOnly();
});
document.getElementById('reload-case')?.addEventListener('click', () => {
  loadCase();
});
document.getElementById('tax-year')?.addEventListener('change', () => {
  const ty = document.getElementById('tax-year');
  if (ty) ty.dataset.userEdited = '1';
  loadCase();
});

window.addEventListener('beforeunload', (event) => {
  if (!eoyDirty) return;
  event.preventDefault();
  event.returnValue = '';
});
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link || !eoyDirty || link.target === '_blank') return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  pendingYearEndHref = url.href;
  document.getElementById('unsaved-year-end-dialog')?.showModal();
});
document.getElementById('unsaved-year-end-dialog')?.addEventListener('close', (event) => {
  if (event.target.returnValue !== 'discard') {
    pendingYearEndHref = '';
    pendingYearEndStage = '';
    return;
  }
  eoyDirty = false;
  if (pendingYearEndHref) {
    location.href = pendingYearEndHref;
    return;
  }
  if (pendingYearEndStage) {
    const stage = pendingYearEndStage;
    pendingYearEndStage = '';
    patchCase({ stageId: stage });
  }
});

document.getElementById('load-biz')?.addEventListener('click', async () => {
  const { nino } = ids();
  const note = document.getElementById('biz-note');
  // Prefer saved income sources first
  try {
    const srcRes = await api('/api/me/income-sources');
    if (srcRes.ok) {
      const d = await srcRes.json();
      for (const s of d.sources || []) {
        if (s.type === 'self_employment' && s.businessId) {
          const el = document.getElementById('bid-se');
          if (el) el.value = s.businessId;
        }
        if (s.type === 'uk_property' && s.businessId) {
          const el = document.getElementById('bid-uk');
          if (el) el.value = s.businessId;
        }
        if (s.type === 'foreign_property' && s.businessId) {
          const el = document.getElementById('bid-fp');
          if (el) el.value = s.businessId;
        }
      }
    }
  } catch {
    /* ignore */
  }
  if (!nino) {
    if (note) note.textContent = 'Sources applied where available. Enter NINO to load from HMRC.';
    return;
  }
  try {
    const res = await api(
      `/api/hmrc/mtd/businesses?nino=${encodeURIComponent(nino)}`
    );
    const data = await res.json();
    const list =
      data.body?.listOfBusinesses || data.body?.businesses || [];
    for (const b of list) {
      const t = String(b.typeOfBusiness || '').toLowerCase();
      const id = b.businessId || '';
      if (t.includes('self-employment')) {
        const el = document.getElementById('bid-se');
        if (el) el.value = id;
      } else if (t.includes('uk-property')) {
        const el = document.getElementById('bid-uk');
        if (el) el.value = id;
      } else if (t.includes('foreign-property')) {
        const el = document.getElementById('bid-fp');
        if (el) el.value = id;
      }
    }
    if (note) {
      note.textContent = list.length
        ? `Loaded ${list.length} business(es) from HMRC.`
        : data.error || 'No businesses returned from HMRC.';
    }
    showOut(data);
  } catch (e) {
    if (note) note.textContent = e.message || String(e);
  }
});

(async function boot() {
  try {
    const res = await api('/api/status');
    const data = await res.json();
    const el = document.getElementById('connection-status');
    if (el) {
      el.textContent = data.previewOnly
        ? 'Preview mode'
        : data.liveSubmitEnabled
          ? 'Submit flag on'
          : 'Preview mode';
    }
  } catch {
    /* ignore */
  }
  // Prefill from income sources silently
  try {
    const r = await api('/api/me/income-sources');
    if (r.ok) {
      const d = await r.json();
      for (const s of d.sources || []) {
        if (s.type === 'self_employment' && s.businessId) {
          const el = document.getElementById('bid-se');
          if (el) el.value = s.businessId;
        }
        if (s.type === 'uk_property' && s.businessId) {
          const el = document.getElementById('bid-uk');
          if (el) el.value = s.businessId;
        }
        if (s.type === 'foreign_property' && s.businessId) {
          const el = document.getElementById('bid-fp');
          if (el) el.value = s.businessId;
        }
      }
    }
  } catch {
    /* ignore */
  }
  await loadCase();
})();
