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

(function initialiseManualEntry() {
  const dialog = document.getElementById('manual-entry-dialog');
  const form = document.getElementById('manual-entry-form');
  const rows = document.getElementById('manual-entry-rows');
  if (!dialog || !form || !rows) return;
  const fields = {
    self_employment: [['turnover','Turnover'],['other','Other business income'],['consolidated_expenses','Total allowable expenses']],
    uk_property: [['period_amount','Rent and property income'],['other_income','Other property income'],['consolidated_expenses','Total property expenses']],
    foreign_property: [['rent_income','Foreign rent income'],['other_property_income','Other foreign property income'],['foreign_tax_paid_or_deducted','Foreign tax paid or deducted'],['consolidated_expenses','Total foreign property expenses']],
  };
  function options(type) { return fields[type].map(([value,label]) => `<option value="${value}">${label}</option>`).join(''); }
  function addRow(type = sessionStorage.getItem('st_quarterly_source_type') || 'self_employment') {
    const row = document.createElement('div');
    row.className = 'manual-entry-row';
    row.innerHTML = `<label>Income source<select data-manual-source><option value="self_employment">Self-employment</option><option value="uk_property">UK property</option><option value="foreign_property">Foreign property</option></select></label><label>Figure<select data-manual-field>${options(type)}</select></label><label>Amount in GBP<input type="number" min="0" step="0.01" data-manual-value required></label><label class="manual-country" ${type === 'foreign_property' ? '' : 'hidden'}>Country code<input maxlength="3" value="ESP" data-manual-country></label><button type="button" class="btn btn-ghost btn-sm" data-remove-manual>Remove</button>`;
    const source = row.querySelector('[data-manual-source]');
    source.value = type;
    source.addEventListener('change', () => {
      row.querySelector('[data-manual-field]').innerHTML = options(source.value);
      row.querySelector('.manual-country').hidden = source.value !== 'foreign_property';
    });
    row.querySelector('[data-remove-manual]').addEventListener('click', () => { row.remove(); if (!rows.children.length) addRow(); });
    rows.appendChild(row);
  }
  function close() { dialog.close(); }
  document.getElementById('open-manual-entry')?.addEventListener('click', () => { if (!rows.children.length) addRow(); dialog.showModal(); });
  document.getElementById('add-manual-row')?.addEventListener('click', () => addRow());
  document.getElementById('close-manual-entry')?.addEventListener('click', close);
  document.getElementById('cancel-manual-entry')?.addEventListener('click', close);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const entries = [...rows.querySelectorAll('.manual-entry-row')].map((row) => ({
      section: row.querySelector('[data-manual-source]').value,
      field: row.querySelector('[data-manual-field]').value,
      value: row.querySelector('[data-manual-value]').value,
      country: row.querySelector('[data-manual-country]').value.trim().toUpperCase(),
    }));
    const error = document.getElementById('manual-entry-error');
    if (!entries.length || entries.some((entry) => entry.value === '')) { error.hidden = false; error.textContent = 'Enter an amount for every row.'; return; }
    if (entries.some((entry) => entry.section === 'foreign_property' && !/^[A-Z]{3}$/.test(entry.country))) { error.hidden = false; error.textContent = 'Foreign-property rows need a three-letter country code.'; return; }
    const start = document.getElementById('manual-period-start').value;
    const end = document.getElementById('manual-period-end').value;
    const year = start ? `${start.slice(0,4)}-${String(Number(start.slice(0,4)) + 1).slice(-2)}` : '2026-27';
    const csv = [['section','field','value','country'],['meta','tax_year',year,''],['meta','period_start',start,''],['meta','period_end',end,''],...entries.map((entry) => [entry.section,entry.field,entry.value,entry.section === 'foreign_property' ? entry.country : ''])].map((line) => line.join(',')).join('\n');
    const transfer = new DataTransfer();
    transfer.items.add(new File([csv], 'manual-quarterly-figures.csv', { type: 'text/csv' }));
    const input = document.getElementById('file-input');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
    document.getElementById('upload-form').requestSubmit();
  });
})();
