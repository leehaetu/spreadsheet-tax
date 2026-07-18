/** Onboarding: manage mode, HMRC sources, period type */

let sources = [];
let manageMode = 'self';

async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function showErr(msg) {
  const el = document.getElementById('err');
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
}

function renderSources() {
  const root = document.getElementById('sources-editor');
  if (!root) return;
  if (!sources.length) {
    root.innerHTML =
      '<p class="muted">No sources yet. Load from HMRC or add manually.</p>';
    return;
  }
  root.innerHTML = sources
    .map(
      (s, i) => `
    <div class="form-row" data-i="${i}" style="border-bottom:1px solid var(--border);padding:0.5rem 0">
      <label>Type
        <select data-field="type">
          <option value="self_employment" ${s.type === 'self_employment' ? 'selected' : ''}>Self-employment</option>
          <option value="uk_property" ${s.type === 'uk_property' ? 'selected' : ''}>UK property</option>
          <option value="foreign_property" ${s.type === 'foreign_property' ? 'selected' : ''}>Foreign property</option>
        </select>
      </label>
      <label>Nickname
        <input data-field="nickname" value="${escapeAttr(s.nickname || s.label || '')}" placeholder="e.g. Leeds flat" />
      </label>
      <label>Business ID (from HMRC)
        <input data-field="businessId" value="${escapeAttr(s.businessId || '')}" placeholder="Optional if connected" />
      </label>
      <label>Country (foreign)
        <input data-field="countryCode" value="${escapeAttr(s.countryCode || '')}" placeholder="ESP" maxlength="3" />
      </label>
      <button type="button" class="btn btn-ghost btn-sm" data-remove="${i}">Remove</button>
    </div>`
    )
    .join('');
  root.querySelectorAll('[data-field]').forEach((el) => {
    el.addEventListener('change', () => {
      const row = el.closest('[data-i]');
      const i = Number(row.getAttribute('data-i'));
      const field = el.getAttribute('data-field');
      sources[i][field] = el.value;
      if (field === 'nickname') sources[i].label = el.value;
    });
  });
  root.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sources.splice(Number(btn.getAttribute('data-remove')), 1);
      renderSources();
    });
  });
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

document.querySelectorAll('.manage-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    manageMode = btn.getAttribute('data-mode') || 'self';
    document.querySelectorAll('.manage-btn').forEach((b) =>
      b.classList.remove('tag', 'green')
    );
    btn.classList.add('tag', 'green');
  });
});

document.getElementById('add-se')?.addEventListener('click', () => {
  sources.push({
    type: 'self_employment',
    label: 'Self-employment',
    nickname: 'My trade',
  });
  renderSources();
});
document.getElementById('add-uk')?.addEventListener('click', () => {
  sources.push({
    type: 'uk_property',
    label: 'UK property',
    nickname: 'UK rental',
  });
  renderSources();
});
document.getElementById('add-fp')?.addEventListener('click', () => {
  sources.push({
    type: 'foreign_property',
    label: 'Foreign property',
    nickname: 'Overseas property',
    countryCode: 'ESP',
  });
  renderSources();
});

document.getElementById('load-hmrc-sources')?.addEventListener('click', async () => {
  showErr('');
  const note = document.getElementById('hmrc-note');
  const { res, data } = await api('/api/me/income-sources/from-hmrc', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    showErr(data.error || 'Could not load from HMRC — connect OAuth or add manually.');
    if (note) note.textContent = data.error || '';
    return;
  }
  sources = data.sources || [];
  renderSources();
  if (note) {
    note.textContent = `Loaded ${sources.length} source(s) from HMRC (confirm nicknames).`;
  }
});

document.getElementById('save-setup')?.addEventListener('click', async () => {
  showErr('');
  const periodType =
    document.querySelector('input[name="periodType"]:checked')?.value ||
    'standard';
  const taxYear = document.getElementById('tax-year')?.value || '2024-25';
  const profile = await api('/api/me/taxpayer-profile', {
    method: 'PUT',
    body: JSON.stringify({
      manageMode,
      periodType,
      taxYear,
      onboardingComplete: true,
    }),
  });
  if (!profile.res.ok) {
    showErr(profile.data.error || 'Profile save failed');
    return;
  }
  // collect sources from DOM state
  const save = await api('/api/me/income-sources', {
    method: 'PUT',
    body: JSON.stringify({ sources }),
  });
  if (!save.res.ok) {
    showErr(save.data.error || 'Sources save failed');
    return;
  }
  location.href = '/home';
});

(async function init() {
  const { res, data } = await api('/api/me/income-sources');
  if (res.ok && data.sources?.length) {
    sources = data.sources;
    renderSources();
  }
  const p = await api('/api/me/taxpayer-profile');
  if (p.res.ok && p.data.profile) {
    manageMode = p.data.profile.manageMode || 'self';
    const ty = document.getElementById('tax-year');
    if (ty && p.data.profile.taxYear) ty.value = p.data.profile.taxYear;
    document
      .querySelectorAll(`input[name="periodType"][value="${p.data.profile.periodType}"]`)
      .forEach((el) => {
        el.checked = true;
      });
    document
      .querySelector(`.manage-btn[data-mode="${manageMode}"]`)
      ?.classList.add('tag', 'green');
  }
})();
