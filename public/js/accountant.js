/** Accountant / bookkeeper workspace client */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function statusClass(status) {
  if (status === 'ready_to_submit') return 'ready';
  if (status === 'awaiting_file') return 'awaiting';
  if (status === 'submitted') return 'submitted';
  if (status === 'in_review') return 'review';
  if (status === 'client_query' || status === 'correction_required') return 'awaiting';
  if (status === 'mapping_required') return 'review';
  return '';
}

const transitions = {
  awaiting_file: [['mapping_required', 'Records received'], ['client_query', 'Raise client query']],
  mapping_required: [['in_review', 'Send to review'], ['client_query', 'Raise client query']],
  in_review: [['ready_to_submit', 'Approve for submission'], ['client_query', 'Raise client query']],
  client_query: [['awaiting_file', 'Await revised records'], ['in_review', 'Return to review']],
  ready_to_submit: [['submitted', 'Mark submitted'], ['in_review', 'Return to review']],
  submitted: [['correction_required', 'Start correction']],
  correction_required: [['in_review', 'Send correction to review']],
};

function sourceLabels(c) {
  if (c.sourceLabels?.length) return c.sourceLabels.join(', ');
  return (c.sources || [])
    .map((s) => {
      if (s === 'self_employment') return 'Self-employment';
      if (s === 'uk_property') return 'UK property';
      if (s === 'foreign_property') return 'Foreign property';
      return s;
    })
    .join(', ');
}

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

function updateStats(clients) {
  const list = clients || [];
  const set = (id, n) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(n);
  };
  set('stat-clients', list.length);
  set(
    'stat-ready',
    list.filter((c) => c.status === 'ready_to_submit').length
  );
  set(
    'stat-awaiting',
    list.filter((c) => c.status === 'awaiting_file').length
  );
  set(
    'stat-portal',
    list.filter((c) => c.status === 'in_review' || c.status === 'client_query').length
  );
}

async function loadClients() {
  const firmId = document.getElementById('firm-filter').value;
  const accountantId = document.getElementById('acc-filter').value;
  const params = new URLSearchParams();
  if (firmId) params.set('firmId', firmId);
  if (accountantId) params.set('accountantId', accountantId);
  const res = await fetch(`/api/clients?${params}`);
  const data = await res.json();
  const clients = data.clients || [];
  const status = document.getElementById('status-filter')?.value || '';
  const filtered = status ? clients.filter((c) => c.status === status) : clients;
  updateStats(filtered);

  const tbody = document.querySelector('#clients-table tbody');
  tbody.innerHTML = '';
  if (!filtered.length) {
    tbody.innerHTML =
      '<tr><td colspan="8"><div class="empty-state"><strong>No clients match these filters</strong>Try another firm, practitioner or workflow status.</div></td></tr>';
    return;
  }
  for (const c of filtered) {
    const tr = document.createElement('tr');
    const statusLabel = c.statusLabel || c.status || '—';
    const cls = statusClass(c.status);
    tr.innerHTML = `
      <td><strong>${esc(c.name)}</strong></td>
      <td>${esc(c.typeLabel || c.type)}</td>
      <td>${esc(sourceLabels(c))}</td>
      <td>${esc(c.lastPeriod || '—')}</td>
      <td>${esc(c.dueDate || '—')}</td>
      <td><span class="status-pill ${cls}">${esc(statusLabel)}</span></td>
      <td><select class="workflow-select" data-client-id="${esc(c.id)}"><option value="">Choose action…</option>${(transitions[c.status] || []).map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join('')}</select></td>
      <td><a class="btn btn-primary btn-sm" href="/app?client=${encodeURIComponent(c.id)}">Open</a></td>`;
    tbody.appendChild(tr);
  }
}

document.getElementById('firm-filter')?.addEventListener('change', async () => {
  await loadAccountants(document.getElementById('firm-filter').value);
  await loadClients();
});
document.getElementById('acc-filter')?.addEventListener('change', loadClients);
document.getElementById('status-filter')?.addEventListener('change', loadClients);

document.querySelector('#clients-table tbody')?.addEventListener('change', async (event) => {
  const select = event.target.closest('.workflow-select');
  if (!select || !select.value) return;
  select.disabled = true;
  const res = await fetch(`/api/clients/${encodeURIComponent(select.dataset.clientId)}/workflow`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: select.value, actor: 'Practitioner workspace' }),
  });
  const data = await res.json();
  if (!res.ok) window.alert(data.error || 'The workflow could not be updated.');
  await loadClients();
});

(async () => {
  await loadFirms();
  await loadAccountants('');
  await loadClients();
})();
