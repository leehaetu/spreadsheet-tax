(async function initialiseQuarterlySources() {
  const root = document.getElementById('quarterly-source-list');
  const note = document.getElementById('quarterly-source-note');
  const gate = document.getElementById('quarterly-gate');
  if (!root) return;

  const esc = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');

  function goToUpload(source) {
    sessionStorage.setItem('st_quarterly_source_id', source.id || '');
    sessionStorage.setItem('st_quarterly_source_type', source.type || '');
    sessionStorage.setItem(
      'st_quarterly_source_name',
      source.nickname || source.label || source.type || 'Income source'
    );
    if (typeof window.stQuarterlyShowStep === 'function') {
      window.stQuarterlyShowStep('upload');
    } else {
      document.getElementById('quarterly-source-panel').hidden = true;
      document.getElementById('upload-panel').hidden = false;
      document.getElementById('review-panel').hidden = true;
      document.getElementById('submit-panel').hidden = true;
    }
    const label = document.getElementById('upload-source-label');
    if (label) {
      const name = source.nickname || source.label || 'this income source';
      label.textContent = `Excel or CSV for ${name}. Upload this quarter’s figures for this source.`;
    }
    if (note) {
      note.hidden = true;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  try {
    // Gate: prefer HMRC connection before quarterly work
    try {
      const statusRes = await fetch('/api/status');
      const status = await statusRes.json().catch(() => ({}));
      let connected = false;
      try {
        const connRes = await fetch('/api/hmrc/status');
        if (connRes.ok) {
          const conn = await connRes.json();
          connected = Boolean(conn?.connection?.connected && !conn?.connection?.mock);
        }
      } catch {
        /* optional */
      }
      if (!connected && gate) {
        // Soft gate: warn, still allow sources already saved for offline prep
        gate.hidden = false;
        gate.innerHTML =
          'Connect HMRC before sending a quarterly update. You can still prepare figures once your income sources are loaded. <a href="/connect-hmrc">Connect HMRC</a> · <a href="/onboarding">Set up sources</a>';
      }
    } catch {
      /* ignore */
    }

    const response = await fetch('/api/me/income-sources');
    if (response.status === 401) {
      root.innerHTML = '<a class="btn btn-primary" href="/signin?next=/app">Sign in to continue</a>';
      return;
    }
    const data = await response.json();
    const sources = data.sources || [];
    if (!sources.length) {
      root.innerHTML =
        '<div class="empty-setup"><strong>No income sources loaded</strong><span>Connect HMRC and load your registered businesses before preparing an update.</span><a class="btn btn-primary" href="/onboarding">Set up income sources</a></div>';
      return;
    }

    const params = new URLSearchParams(location.search);
    const preselect = params.get('sourceId') || sessionStorage.getItem('st_quarterly_source_id') || '';

    root.innerHTML = sources
      .map((source, index) => {
        const short =
          source.type === 'self_employment'
            ? 'SE'
            : source.type === 'uk_property'
              ? 'UK'
              : source.countryCode || 'FP';
        const type =
          source.type === 'self_employment'
            ? 'Self-employment'
            : source.type === 'uk_property'
              ? 'UK property'
              : 'Foreign property';
        const selected = preselect ? source.id === preselect : index === 0;
        return `<button type="button" class="quarterly-source-row${
          selected ? ' selected' : ''
        }" data-source-id="${esc(source.id)}" data-source-type="${esc(
          source.type
        )}" data-source-name="${esc(source.nickname || source.label || type)}"><span class="source-avatar">${esc(
          short
        )}</span><span><strong>${esc(
          source.nickname || source.label || type
        )}</strong><small>${type}${
          source.countryCode ? ` · ${esc(source.countryCode)}` : ''
        }</small></span><span class="source-quarter-state">Add or review figures</span><b>Continue</b></button>`;
      })
      .join('');

    root.querySelectorAll('.quarterly-source-row').forEach((button) => {
      button.addEventListener('click', () => {
        root.querySelectorAll('.quarterly-source-row').forEach((row) => row.classList.remove('selected'));
        button.classList.add('selected');
        goToUpload({
          id: button.dataset.sourceId,
          type: button.dataset.sourceType,
          nickname: button.dataset.sourceName,
        });
      });
    });

    // Deep-link: jump straight to upload for a known source
    if (preselect) {
      const match = sources.find((s) => s.id === preselect);
      if (match) goToUpload(match);
    }
  } catch {
    root.innerHTML = '<p class="error">Income sources could not be loaded. Refresh and try again.</p>';
  }
})();
