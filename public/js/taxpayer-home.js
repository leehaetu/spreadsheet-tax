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
  if (type === 'self_employment') {
    return {
      icon: 'SE',
      kind: 'Self-employment',
      detail: source.nickname || source.label || 'Sole trader business',
    };
  }
  if (type === 'uk_property') {
    return {
      icon: 'UK',
      kind: 'UK property',
      detail: source.nickname || source.label || 'UK rental property',
    };
  }
  if (type === 'foreign_property') {
    const country = source.countryCode ? ` · ${source.countryCode}` : '';
    return {
      icon: 'FP',
      kind: source.nickname || source.label || 'Foreign property',
      detail: `Overseas rental property${country}`,
    };
  }
  return {
    icon: 'IS',
    kind: source.nickname || source.label || 'Income source',
    detail: type.replace(/_/g, ' '),
  };
}

function readiness(source) {
  const value = source.readiness || source.status;
  if (value === 'ready_to_review' || value === 'ready' || value === 'approved') {
    return {
      className: 'ready',
      label: 'Ready to review',
      detail: 'Figures are available for this quarter',
      action: 'Review figures',
    };
  }
  if (value === 'no_activity' || value === 'nil') {
    return {
      className: 'quiet',
      label: 'No activity this quarter',
      detail: 'Nothing to report',
      action: 'View details',
    };
  }
  return {
    className: 'review',
    label: 'Spreadsheet needed',
    detail: 'Upload figures for this source',
    action: 'Add figures',
  };
}

function renderSources(sources, { connected = false } = {}) {
  const list = document.getElementById('source-list');
  const empty = document.getElementById('source-empty');
  const count = document.getElementById('source-count');
  const refresh = document.getElementById('sources-refresh-link');

  if (!connected) {
    if (count) count.textContent = 'Connect HMRC to load sources';
    if (refresh) {
      refresh.href = '/connect-hmrc';
      refresh.textContent = 'Connect HMRC';
    }
    if (list) list.innerHTML = '';
    if (empty) {
      empty.hidden = false;
      empty.innerHTML =
        'Connect HMRC first, then load the businesses HMRC already holds for you. ' +
        '<a href="/connect-hmrc">Connect HMRC</a>. ' +
        'Missing a business later? <a href="/guide#hmrc-businesses">Add it with HMRC</a>.';
    }
    return;
  }

  if (refresh) {
    refresh.href = '/onboarding';
    refresh.textContent = 'Refresh from HMRC';
  }

  if (count) {
    count.textContent = `${sources.length} ${
      sources.length === 1 ? 'source' : 'sources'
    } in this tax year`;
  }
  if (!sources.length) {
    if (list) list.innerHTML = '';
    if (empty) {
      empty.hidden = false;
      empty.innerHTML =
        'No HMRC income sources have been loaded yet. ' +
        '<a href="/onboarding">Load your sources from HMRC</a>. ' +
        'Missing a business? <a href="/guide#hmrc-businesses">Add it with HMRC</a>.';
    }
    return;
  }
  if (empty) empty.hidden = true;
  if (!list) return;
  list.innerHTML = sources
    .map((source) => {
      const meta = sourceMeta(source);
      const state = readiness(source);
      return `<article class="cc-source-row">
      <span class="cc-source-icon ${state.className}" aria-hidden="true">${escapeHtml(meta.icon)}</span>
      <span class="cc-source-name"><strong>${escapeHtml(meta.kind)}</strong><small>${escapeHtml(meta.detail)}</small></span>
      <span class="cc-source-state ${state.className}"><strong>${escapeHtml(state.label)}</strong><small>${escapeHtml(state.detail)}</small></span>
      <a href="/app?flow=quarterly&sourceId=${encodeURIComponent(source.id || '')}" aria-label="${escapeHtml(state.action)} for ${escapeHtml(meta.kind)}">${escapeHtml(state.action)} <span aria-hidden="true">→</span></a>
    </article>`;
    })
    .join('');
}

async function loadConnection() {
  try {
    const res = await fetch('/api/hmrc/status');
    if (!res.ok) return { connected: false };
    const data = await res.json();
    const conn = data.connection || {};
    return {
      connected: Boolean(conn.connected && !conn.mock && !conn.expired),
      data,
    };
  } catch {
    return { connected: false };
  }
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

  const sources = Array.isArray(data.sources) ? data.sources : [];
  const nextTask = data.nextTask || {};
  const titleEl = document.getElementById('next-task-title');
  const periodEl = document.getElementById('next-task-period');
  const cta = document.getElementById('next-task-cta');
  const lead = document.getElementById('deadline-lead');
  const secondary = document.querySelector('.cc-task-actions .btn-ghost');

  const { connected, data: connData } = await loadConnection();
  if (typeof window.stApplyConnectionStatus === 'function' && connData) {
    window.stApplyConnectionStatus(connData);
  }

  if (!connected) {
    if (titleEl) titleEl.textContent = 'Connect HMRC to continue';
    if (periodEl) {
      periodEl.textContent =
        'Authorise Spreadsheet Tax for your individual tax account, then load income sources from HMRC.';
    }
    if (lead) {
      lead.textContent =
        'Your confirmed obligation and deadline appear after HMRC is connected.';
    }
    if (cta) {
      cta.href = '/connect-hmrc';
      cta.innerHTML =
        'Connect HMRC <span aria-hidden="true">→</span>';
    }
    if (secondary) {
      secondary.href = '/onboarding';
      secondary.textContent = 'Set up your account';
    }
  } else if (!sources.length) {
    if (titleEl) titleEl.textContent = 'Load your income sources';
    if (periodEl) {
      periodEl.textContent =
        'Pull self-employment, UK property, and foreign property businesses HMRC already holds for you.';
    }
    if (lead) {
      lead.textContent =
        data.nextDeadline?.due
          ? `Due to HMRC by ${data.nextDeadline.due}`
          : 'Sources must be loaded before a quarterly update can start.';
    }
    if (cta) {
      cta.href = '/onboarding';
      cta.innerHTML =
        'Load sources from HMRC <span aria-hidden="true">→</span>';
    }
    if (secondary) {
      secondary.href = '/guide#hmrc-businesses';
      secondary.textContent = 'Help: missing a business?';
    }
  } else {
    if (titleEl) {
      titleEl.textContent =
        nextTask.title || 'Prepare this quarter’s update';
    }
    if (periodEl) {
      periodEl.textContent =
        nextTask.detail ||
        'Review each active income source before anything is sent. Year-end includes HMRC Assist after your tax calculation.';
    }
    if (cta) {
      cta.href = nextTask.href || '/app?flow=quarterly';
      cta.innerHTML =
        'Continue quarterly update <span aria-hidden="true">→</span>';
    }
    if (secondary) {
      secondary.href = '/year-end';
      secondary.textContent = 'Year end & HMRC Assist';
    }
    if (lead) {
      lead.textContent = data.nextDeadline?.due
        ? `Due to HMRC by ${data.nextDeadline.due}${
            data.nextDeadline.periodEnd
              ? ` · period ending ${data.nextDeadline.periodEnd}`
              : ''
          }`
        : 'Your next deadline will appear when HMRC returns obligations for this year.';
    }
  }

  // Never show local/preview sources as actionable while HMRC is disconnected.
  renderSources(connected ? sources : [], { connected });

  if (typeof window.stRefreshConnection === 'function') {
    await window.stRefreshConnection();
  }
}

load();
