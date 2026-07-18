/** Customer year-end guided tax return case — stages + HMRC workflows. */

/** @type {{ id: string, title: string, detail: string }[]} */
let eoyStages = [];
/** @type {Record<string, unknown> | null} */
let eoyCase = null;

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
  showOut(data);
}

function showError(msg) {
  const err = document.getElementById('wf-error');
  const ok = document.getElementById('wf-success');
  if (ok) ok.hidden = true;
  if (err) {
    err.textContent = msg;
    err.hidden = false;
  }
}

async function runWorkflow(name) {
  const body = { workflow: name, ...ids() };
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
      btn.addEventListener('click', () => runWorkflow(a.wf));
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
            `<li><strong>${esc(s.label || s.type)}</strong> · ${esc(
              s.type || ''
            )}${s.businessId ? ` · ${esc(s.businessId)}` : ''}</li>`
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
  await patchCase({ stageId });
}

async function completeCurrent() {
  const note = document.getElementById('stage-note')?.value || '';
  await patchCase({
    completeCurrent: true,
    note: note || undefined,
  });
}

async function saveNoteOnly() {
  const note = document.getElementById('stage-note')?.value || '';
  await patchCase({ note });
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
