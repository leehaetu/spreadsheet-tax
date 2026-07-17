/** Accountant / bookkeeper workspace client */

async function loadFirms() {
  const res = await fetch('/api/firms');
  const data = await res.json();
  const sel = document.getElementById('firm-filter');
  for (const f of data.firms || []) {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    sel.appendChild(opt);
  }
}

async function loadAccountants(firmId) {
  const q = firmId ? `?firmId=${encodeURIComponent(firmId)}` : '';
  const res = await fetch(`/api/accountants${q}`);
  const data = await res.json();
  const sel = document.getElementById('acc-filter');
  sel.innerHTML = '<option value="">All practitioners</option>';
  for (const a of data.accountants || []) {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.name} (${a.role})`;
    sel.appendChild(opt);
  }
}

async function loadClients() {
  const firmId = document.getElementById('firm-filter').value;
  const accountantId = document.getElementById('acc-filter').value;
  const params = new URLSearchParams();
  if (firmId) params.set('firmId', firmId);
  if (accountantId) params.set('accountantId', accountantId);
  const res = await fetch(`/api/clients?${params}`);
  const data = await res.json();
  const tbody = document.querySelector('#clients-table tbody');
  tbody.innerHTML = '';
  for (const c of data.clients || []) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(c.name)}</td>
      <td>${esc(c.type)}</td>
      <td>${esc((c.sources || []).join(', '))}</td>
      <td>${esc(c.lastPeriod || '—')}</td>
      <td>${c.portalAccess ? 'Yes' : 'No'}</td>
      <td><a class="btn btn-primary" href="/app">Import file</a></td>`;
    tbody.appendChild(tr);
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

document.getElementById('firm-filter')?.addEventListener('change', async () => {
  await loadAccountants(document.getElementById('firm-filter').value);
  await loadClients();
});
document.getElementById('acc-filter')?.addEventListener('change', loadClients);

(async () => {
  await loadFirms();
  await loadAccountants('');
  await loadClients();
})();
