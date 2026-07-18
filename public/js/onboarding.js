let sources = [];
let step = 1;
let detailIndex = 0;
let profileMeta = {};

const labels = {
  self_employment: 'Self-employment',
  uk_property: 'UK property',
  foreign_property: 'Foreign property',
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  return { res, data: await res.json().catch(() => ({})) };
}

function showError(message = '') {
  const el = document.getElementById('err');
  el.textContent = message;
  el.hidden = !message;
}

function newSource(type) {
  return {
    id: crypto.randomUUID(),
    type,
    label: labels[type],
    nickname:
      type === 'self_employment'
        ? 'My trade'
        : type === 'uk_property'
          ? 'UK property business'
          : 'Foreign property business',
    countryCode: null,
    joint: false,
    ownershipShare: null,
    details: { accountingPeriod: '6 April to 5 April', trade: '', startDate: '' },
  };
}

function ninoValue() {
  return String(document.getElementById('setup-nino')?.value || '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function setStep(next) {
  step = Math.max(1, Math.min(4, next));
  document.querySelectorAll('.setup-step').forEach((el) => {
    el.hidden = Number(el.dataset.step) !== step;
  });
  document.querySelectorAll('[data-progress]').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.progress) === step);
    el.classList.toggle('done', Number(el.dataset.progress) < step);
  });
  document.getElementById('prev-step').hidden = step === 1;
  document.getElementById('next-step').hidden = step === 4;
  document.getElementById('save-setup').hidden = step !== 4;
  const titles = [
    '',
    'Welcome to Spreadsheet Tax',
    'Confirm your income sources',
    'Name each income source',
    'Review your setup',
  ];
  const subtitles = [
    '',
    'Making Tax Digital for Income Tax — connect HMRC and confirm the businesses you report.',
    'Businesses returned by HMRC. Spreadsheet Tax only mirrors this list.',
    'Display names for your quarterly workflow. Nothing is created at HMRC.',
    'Confirm your setup. You can refresh from HMRC later.',
  ];
  document.getElementById('setup-title').textContent = titles[step];
  const sub = document.getElementById('setup-subtitle');
  if (sub) sub.textContent = subtitles[step];
  if (step === 2) renderChosen();
  if (step === 3) renderDetails();
  if (step === 4) renderReview();
  showError('');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderChosen() {
  const root = document.getElementById('chosen-sources');
  root.innerHTML = sources.length
    ? sources
        .map((s, i) => {
          const icon =
            s.type === 'self_employment' ? 'SE' : s.type === 'uk_property' ? 'UK' : 'FP';
          const desc =
            s.type === 'self_employment'
              ? 'Sole trader business'
              : s.type === 'uk_property'
                ? 'UK property business (HMRC)'
                : 'Foreign property business (HMRC)';
          return `<div class="chosen-source source-confirm-row">
            <span class="source-avatar">${icon}</span>
            <span>
              <strong>${esc(s.nickname || labels[s.type])}</strong>
              <small>${esc(desc)}${s.businessId ? ` · ID on file` : ''}</small>
            </span>
            <span class="source-from-hmrc" title="Loaded from HMRC">From HMRC</span>
            <button type="button" data-edit-source="${i}">Check details</button>
          </div>`;
        })
        .join('')
    : `<div class="empty-setup">
        <strong>No HMRC businesses loaded</strong>
        <span>Connect HMRC, then load your registered businesses. If one is missing, create it with HMRC first — not in Spreadsheet Tax.</span>
        <a class="btn btn-ghost btn-sm" href="/guide#hmrc-businesses">How to add a business with HMRC</a>
      </div>`;
  document.querySelectorAll('[data-edit-source]').forEach((btn) => {
    btn.onclick = () => {
      detailIndex = Number(btn.dataset.editSource);
      setStep(3);
    };
  });
}

function renderDetails() {
  const root = document.getElementById('source-details');
  const s = sources[detailIndex];
  if (!s) {
    root.innerHTML =
      '<div class="empty-setup"><strong>Load your HMRC businesses first</strong><button class="btn btn-primary" type="button" id="back-to-sources">Return to income sources</button></div>';
    root.querySelector('#back-to-sources')?.addEventListener('click', () => setStep(2));
    return;
  }
  document.getElementById('setup-title').textContent =
    s.type === 'self_employment'
      ? 'Self-employment details'
      : s.type === 'uk_property'
        ? 'UK property business'
        : 'Foreign property business';
  document.getElementById('next-step').textContent =
    detailIndex < sources.length - 1 ? 'Save and continue' : 'Continue to review';
  root.innerHTML = `<p class="source-detail-progress">Income source ${detailIndex + 1} of ${
    sources.length
  }</p><section class="source-detail" data-source-index="${detailIndex}"><header><span class="source-avatar">${
    s.type === 'self_employment' ? 'SE' : s.type === 'uk_property' ? 'UK' : 'FP'
  }</span><div><h3>${labels[s.type]}</h3><p>${esc(s.nickname)}</p></div></header><div class="detail-grid">
      <label>Display name<input data-field="nickname" value="${esc(s.nickname)}" required></label>
      ${
        s.type === 'self_employment'
          ? `<label>Trade or profession<input data-detail="trade" value="${esc(
              s.details.trade
            )}" placeholder="For example, graphic design"></label><label>Business start date<input type="date" data-detail="startDate" value="${esc(
              s.details.startDate
            )}"></label><label>Accounting period<select data-detail="accountingPeriod"><option>6 April to 5 April</option><option>1 April to 31 March</option></select></label>`
          : ''
      }
      ${
        s.type === 'uk_property'
          ? `<p class="span-2 muted">This is the UK property business returned by HMRC. Keep each property and transaction in your spreadsheet.</p>`
          : ''
      }
      ${
        s.type === 'foreign_property'
          ? `<p class="span-2 muted">This is the foreign property business returned by HMRC. Keep each country, property, currency and transaction in your spreadsheet.</p>`
          : ''
      }
    </div></section>`;
  const section = root.querySelector('[data-source-index]');
  section.querySelectorAll('[data-field]').forEach((el) => {
    el.onchange = () => {
      s[el.dataset.field] = el.value;
    };
  });
  section.querySelectorAll('[data-detail]').forEach((el) => {
    el.onchange = () => {
      s.details[el.dataset.detail] = el.value;
    };
  });
}

function renderReview() {
  const root = document.getElementById('setup-review');
  root.innerHTML = sources
    .map(
      (s, i) =>
        `<div class="review-source"><span class="source-avatar">${
          s.type === 'self_employment' ? 'SE' : s.type === 'uk_property' ? 'UK' : 'FP'
        }</span><div><strong>${esc(s.nickname)}</strong><span>${labels[s.type]}</span><small>${esc(
          s.details.trade || s.details.accountingPeriod || 'Ready for quarterly uploads'
        )}</small></div><button type="button" data-review-edit="${i}">Edit</button></div>`
    )
    .join('');
  root.querySelectorAll('[data-review-edit]').forEach((btn) => {
    btn.onclick = () => {
      detailIndex = Number(btn.dataset.reviewEdit);
      setStep(3);
    };
  });
}

function validateStep() {
  if (step === 1) {
    const nino = ninoValue();
    if (!/^[A-Z]{2}\d{6}[A-D]$/i.test(nino)) {
      showError('Enter a valid National Insurance number before continuing.');
      document.getElementById('setup-nino')?.focus();
      return false;
    }
  }
  if (step === 2 && !sources.length) {
    showError('Load at least one HMRC business to continue.');
    return false;
  }
  if (step === 3) {
    const invalid = [...document.querySelectorAll('#source-details [required]')].find(
      (el) => !el.value.trim()
    );
    if (invalid) {
      invalid.focus();
      showError('Complete the highlighted source details before continuing.');
      return false;
    }
  }
  return true;
}

async function persistNino() {
  const nino = ninoValue();
  const taxYear = document.getElementById('setup-tax-year')?.value || '2026-27';
  await api('/api/me/preferences', {
    method: 'PUT',
    body: JSON.stringify({ identifiers: { nino, taxYear } }),
  });
  profileMeta = { ...profileMeta, nino };
  await api('/api/me/taxpayer-profile', {
    method: 'PUT',
    body: JSON.stringify({
      taxYear,
      meta: { ...profileMeta, nino },
    }),
  });
}

document.getElementById('next-step').addEventListener('click', async () => {
  if (!validateStep()) return;
  if (step === 1) {
    try {
      await persistNino();
    } catch {
      showError('Could not save your National Insurance number.');
      return;
    }
  }
  if (step === 3 && detailIndex < sources.length - 1) {
    detailIndex += 1;
    renderDetails();
    showError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  document.getElementById('next-step').textContent = 'Continue';
  setStep(step + 1);
});

document.getElementById('prev-step').addEventListener('click', () => {
  if (step === 3 && detailIndex > 0) {
    detailIndex -= 1;
    renderDetails();
    showError('');
    return;
  }
  document.getElementById('next-step').textContent = 'Continue';
  setStep(step - 1);
});

document.getElementById('setup-back').addEventListener('click', (e) => {
  if (step > 1) {
    e.preventDefault();
    setStep(step - 1);
  }
});

document.getElementById('load-hmrc-sources').addEventListener('click', async () => {
  showError('');
  const nino = ninoValue();
  if (!nino) {
    showError('Enter your National Insurance number in step 1 first.');
    setStep(1);
    return;
  }
  const { res, data } = await api('/api/me/income-sources/from-hmrc', {
    method: 'POST',
    body: JSON.stringify({ nino }),
  });
  if (!res.ok) {
    showError(data.error || 'HMRC businesses could not be loaded.');
    return;
  }
  sources = (data.sources || []).map((s) => {
    const base = newSource(s.type);
    return {
      ...base,
      ...s,
      ownershipShare: Number(s.ownershipShare) > 0 ? Number(s.ownershipShare) : base.ownershipShare,
      details: { ...base.details, ...(s.details || {}) },
    };
  });
  detailIndex = 0;
  renderChosen();
  document.getElementById('hmrc-note').textContent =
    sources.length === 1
      ? 'Loaded 1 business from HMRC.'
      : `Loaded ${sources.length} businesses from HMRC.`;
});

document.getElementById('save-setup').addEventListener('click', async () => {
  showError('');
  const periodType = document.querySelector('[name="periodType"]:checked')?.value || 'standard';
  const taxYear = document.getElementById('setup-tax-year')?.value || '2026-27';
  const sourceDetails = Object.fromEntries(sources.map((s) => [s.id, s.details]));
  const profile = await api('/api/me/taxpayer-profile', {
    method: 'PUT',
    body: JSON.stringify({
      manageMode: 'self',
      periodType,
      taxYear,
      onboardingComplete: true,
      meta: { ...profileMeta, nino: ninoValue(), sourceDetails },
    }),
  });
  if (!profile.res.ok) {
    showError(profile.data.error || 'Profile could not be saved.');
    return;
  }
  await api('/api/me/preferences', {
    method: 'PUT',
    body: JSON.stringify({ identifiers: { nino: ninoValue(), taxYear } }),
  });
  const saved = await api('/api/me/income-sources', {
    method: 'PUT',
    body: JSON.stringify({ sources }),
  });
  if (!saved.res.ok) {
    showError(saved.data.error || 'Income sources could not be saved.');
    return;
  }
  location.href = '/home';
});

(async () => {
  const [sourceRes, profileRes, prefRes] = await Promise.all([
    api('/api/me/income-sources'),
    api('/api/me/taxpayer-profile'),
    api('/api/me/preferences'),
  ]);
  if (sourceRes.res.status === 401) {
    location.href = '/signin?next=/onboarding';
    return;
  }
  if (profileRes.data.profile) {
    const p = profileRes.data.profile;
    profileMeta = p.meta || {};
    document.querySelector(`[name="periodType"][value="${p.periodType}"]`)?.click();
    if (p.taxYear) document.getElementById('setup-tax-year').value = p.taxYear;
  }
  const nino =
    profileMeta.nino ||
    prefRes.data?.preferences?.identifiers?.nino ||
    prefRes.data?.identifiers?.nino ||
    '';
  if (nino) document.getElementById('setup-nino').value = nino;
  if (sourceRes.data.sources?.length) {
    sources = sourceRes.data.sources.map((s) => {
      const base = newSource(s.type);
      return {
        ...base,
        ...s,
        ownershipShare:
          Number(s.ownershipShare) > 0 ? Number(s.ownershipShare) : base.ownershipShare,
        details: {
          ...base.details,
          ...(profileMeta.sourceDetails?.[s.id] || {}),
          ...(s.details || {}),
        },
      };
    });
  }
  if (typeof window.stRefreshConnection === 'function') {
    await window.stRefreshConnection();
  }
  setStep(1);
})();
