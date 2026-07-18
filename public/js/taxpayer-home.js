/** Taxpayer control centre — obligation-led, source-aware next task. */

async function api(url, opts) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sourceMeta(source) {
  const type = String(source.type || 'income_source');
  if (type === 'self_employment') return { icon: 'SE', kind: 'Self-employment', detail: source.nickname || source.label || 'Sole trader business' };
  if (type === 'uk_property') return { icon: 'UK', kind: 'UK property', detail: source.nickname || source.label || 'UK rental property' };
  if (type === 'foreign_property') {
    const country = source.countryCode ? ` · ${source.countryCode}` : '';
    return { icon: 'FP', kind: source.nickname || source.label || 'Foreign property', detail: `Overseas rental property${country}` };
  }
  return { icon: 'IS', kind: source.nickname || source.label || 'Income source', detail: type.replace(/_/g, ' ') };
}

function readiness(source) {
  const value = source.readiness || source.status;
  if (value === 'ready_to_review' || value === 'ready' || value === 'approved') {
    return { className: 'ready', label: 'Ready to review', detail: 'Figures are available for this quarter', action: 'Review figures' };
  }
  if (value === 'no_activity' || value === 'nil') {
    return { className: 'quiet', label: 'No activity this quarter', detail: 'Nothing to report', action: 'View details' };
  }
  return { className: 'review', label: 'Spreadsheet needed', detail: 'Upload or choose the figures for this source', action: 'Add figures' };
}

function renderSources(sources) {
  const list = document.getElementById('source-list');
  const empty = document.getElementById('source-empty');
  const count = document.getElementById('source-count');
  if (count) count.textContent = `${sources.length} ${sources.length === 1 ? 'source' : 'sources'} in this tax year`;
  if (!sources.length) {
    if (list) list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  if (!list) return;
  list.innerHTML = sources.map((source) => {
    const meta = sourceMeta(source);
    const state = readiness(source);
    return `<article class="cc-source-row">
      <span class="cc-source-icon ${state.className}" aria-hidden="true">${escapeHtml(meta.icon)}</span>
      <span class="cc-source-name"><strong>${escapeHtml(meta.kind)}</strong><small>${escapeHtml(meta.detail)}</small></span>
      <span class="cc-source-state ${state.className}"><strong>${escapeHtml(state.label)}</strong><small>${escapeHtml(state.detail)}</small></span>
      <a href="/app?flow=quarterly" aria-label="${escapeHtml(state.action)} for ${escapeHtml(meta.kind)}">${escapeHtml(state.action)} <span aria-hidden="true">→</span></a>
    </article>`;
  }).join('');
}

async function load() {
  const gate = document.getElementById('gate');
  const { res, data } = await api('/api/me/dashboard');
  if (res.status === 401) {
    window.location.replace('/signin?next=/home');
    return;
  }
  if (!res.ok) {
    gate.hidden = false;
    gate.textContent = data.error || 'Could not load your tax dashboard.';
    return;
  }

  const taxYear = data.taxYear || '2026-27';
  document.getElementById('tax-year-label').textContent = `Tax year ${taxYear}`;
  const [start] = taxYear.split('-');
  const end = Number(start) + 1;
  document.getElementById('tax-year-dates').textContent = `6 April ${start} to 5 April ${end}`;

  const nextTask = data.nextTask || {};
  document.getElementById('next-task-title').textContent = nextTask.title || 'Prepare this quarter’s update';
  document.getElementById('next-task-period').textContent = nextTask.detail || 'Review all active income sources before anything is sent';
  const cta = document.getElementById('next-task-cta');
  if (nextTask.href) cta.href = nextTask.href;

  const lead = document.getElementById('deadline-lead');
  lead.textContent = data.nextDeadline?.due
    ? `Due to HMRC by ${data.nextDeadline.due}${data.nextDeadline.periodEnd ? ` · period ending ${data.nextDeadline.periodEnd}` : ''}`
    : 'Connect HMRC to load your confirmed obligation and deadline.';

  renderSources(Array.isArray(data.sources) ? data.sources : []);

  const status = await api('/api/status').catch(() => ({ data: {} }));
  const connection = document.getElementById('connection-status');
  const explainer = document.getElementById('mode-explainer');
  if (status.data?.previewOnly || status.data?.hmrcMode === 'double') {
    connection.textContent = 'Preview mode';
    explainer.textContent = 'Nothing is sent to HMRC while preview mode is active.';
  } else if (status.data?.hmrcMode === 'sandbox') {
    connection.textContent = 'HMRC sandbox connected';
    explainer.textContent = 'Connected to HMRC sandbox for testing — not live taxpayer submission.';
  } else {
    connection.textContent = status.data?.liveSubmitEnabled ? 'HMRC submission available' : 'HMRC not connected';
    explainer.textContent = 'Your connection status controls whether an approved update can be sent.';
  }
}

const menu = document.getElementById('cc-menu');
menu?.addEventListener('click', () => {
  const nav = document.getElementById('cc-mobile-nav');
  nav.hidden = !nav.hidden;
  menu.setAttribute('aria-expanded', String(!nav.hidden));
});

load();
