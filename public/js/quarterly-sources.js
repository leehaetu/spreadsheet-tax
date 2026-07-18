(async function initialiseQuarterlySources() {
  const root = document.getElementById('quarterly-source-list');
  const note = document.getElementById('quarterly-source-note');
  if (!root) return;
  const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  try {
    const response = await fetch('/api/me/income-sources');
    if (response.status === 401) {
      root.innerHTML = '<a class="btn btn-primary" href="/signin?next=/app">Sign in to continue</a>';
      return;
    }
    const data = await response.json();
    const sources = data.sources || [];
    if (!sources.length) {
      root.innerHTML = '<div class="empty-setup"><strong>No income sources set up</strong><span>Add self-employment, UK property or foreign property before preparing an update.</span><a class="btn btn-primary" href="/onboarding">Set up income sources</a></div>';
      return;
    }
    root.innerHTML = sources.map((source, index) => {
      const short = source.type === 'self_employment' ? 'SE' : source.type === 'uk_property' ? 'UK' : source.countryCode || 'FP';
      const type = source.type === 'self_employment' ? 'Self-employment' : source.type === 'uk_property' ? 'UK property' : 'Foreign property';
      return `<button type="button" class="quarterly-source-row${index === 0 ? ' selected' : ''}" data-source-id="${esc(source.id)}" data-source-type="${esc(source.type)}"><span class="source-avatar">${esc(short)}</span><span><strong>${esc(source.nickname || source.label || type)}</strong><small>${type}${source.countryCode ? ` · ${esc(source.countryCode)}` : ''}</small></span><span class="source-quarter-state">Add or review figures</span><b>Continue</b></button>`;
    }).join('');
    root.querySelectorAll('.quarterly-source-row').forEach((button) => {
      button.addEventListener('click', () => {
        root.querySelectorAll('.quarterly-source-row').forEach((row) => row.classList.remove('selected'));
        button.classList.add('selected');
        sessionStorage.setItem('st_quarterly_source_id', button.dataset.sourceId || '');
        sessionStorage.setItem('st_quarterly_source_type', button.dataset.sourceType || '');
        note.hidden = false;
        note.textContent = 'Source selected. Upload a spreadsheet, use a fictional sample, or enter a nil update below.';
        document.getElementById('upload-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  } catch (error) {
    root.innerHTML = '<p class="error">Income sources could not be loaded. Refresh and try again.</p>';
  }
})();
