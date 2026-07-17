/** Bridging app client: upload → preview → submit */

let lastPayloads = null;

async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const el = document.getElementById('hmrc-mode');
    if (el) el.textContent = `HMRC: ${data.hmrcMode}`;
  } catch {
    /* ignore */
  }
}

const fileInput = document.getElementById('file-input');
const fileLabel = document.getElementById('file-label');
if (fileInput && fileLabel) {
  fileInput.addEventListener('change', () => {
    fileLabel.textContent = fileInput.files?.[0]?.name || 'Choose spreadsheet file…';
  });
}

document.getElementById('upload-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('upload-error');
  errEl.hidden = true;
  const file = fileInput?.files?.[0];
  if (!file) {
    errEl.textContent = 'Please choose a local file.';
    errEl.hidden = false;
    return;
  }

  const btn = document.getElementById('import-btn');
  btn.disabled = true;
  btn.textContent = 'Mapping…';

  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import failed');

    lastPayloads = data.payloads;
    showPreview(data);

    if (data.payloads?.meta?.taxYear) {
      document.getElementById('tax-year').value = data.payloads.meta.taxYear;
    }
    if (data.metadata?.nino) {
      document.getElementById('nino').value = data.metadata.nino;
    }
  } catch (err) {
    errEl.textContent = err.message || String(err);
    errEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Map file to quarterly figures';
  }
});

function showPreview(data) {
  document.getElementById('preview-panel').hidden = false;
  document.getElementById('submit-panel').hidden = false;

  const tags = document.getElementById('sources-summary');
  tags.innerHTML = '';
  if (data.sources.selfEmployment) {
    tags.appendChild(tag('Self-employment'));
  }
  if (data.sources.ukProperty) {
    tags.appendChild(tag('UK property'));
  }
  for (const c of data.sources.foreignProperty || []) {
    tags.appendChild(tag(`Foreign property (${c})`));
  }

  document.getElementById('figures-out').textContent = JSON.stringify(
    data.figures,
    null,
    2
  );
  document.getElementById('payloads-out').textContent = JSON.stringify(
    data.payloads,
    null,
    2
  );

  const tbody = document.querySelector('#links-table tbody');
  tbody.innerHTML = '';
  for (const link of data.fieldLinks || []) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(link.source)}</td><td>${esc(link.sourceField)}</td><td><code>${esc(link.path)}</code></td><td>${esc(String(link.value))}</td>`;
    tbody.appendChild(tr);
  }
}

function tag(text) {
  const s = document.createElement('span');
  s.className = 'tag';
  s.textContent = text;
  return s;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.getElementById('submit-btn')?.addEventListener('click', async () => {
  const errEl = document.getElementById('submit-error');
  const out = document.getElementById('submit-out');
  errEl.hidden = true;
  out.hidden = true;

  if (!lastPayloads) {
    errEl.textContent = 'Import a file first.';
    errEl.hidden = false;
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payloads: lastPayloads,
        nino: document.getElementById('nino').value || undefined,
        taxYear: document.getElementById('tax-year').value || undefined,
        businessIdSe: document.getElementById('bid-se').value || undefined,
        businessIdUk: document.getElementById('bid-uk').value || undefined,
        businessIdForeign: document.getElementById('bid-fp').value || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submit failed');
    out.textContent = JSON.stringify(data, null, 2);
    out.hidden = false;
  } catch (err) {
    errEl.textContent = err.message || String(err);
    errEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit quarterly update(s)';
  }
});

loadStatus();
