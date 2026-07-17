/** Multi-accountant practice dashboard client */

let firmsById = {};
let accountantsById = {};

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

function planLabel(plan) {
  if (plan === 'practice_license') return 'Practice license';
  if (plan === 'practitioner_license') return 'Practitioner license';
  return plan || 'License';
}

function typeLabel(type) {
  if (type === 'multi_accountant_practice') return 'Multi-accountant practice';
  if (type === 'sole_bookkeeper') return 'Sole bookkeeper / firm';
  return type || 'Firm';
}

async function init() {
  const firmsRes = await fetch('/api/firms');
  const firmsData = await firmsRes.json();
  const firmsList = document.getElementById('firms-list');
  const firmFilter = document.getElementById('practice-firm-filter');
  firmsList.innerHTML = '';
  for (const f of firmsData.firms || []) {
    firmsById[f.id] = f;
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-icon">${esc((f.name || '?').slice(0, 1))}</div>
      <h3>${esc(f.name)}</h3>
      <p>${esc(typeLabel(f.type))}</p>
      <p><span class="tag">${esc(planLabel(f.plan))}</span></p>`;
    firmsList.appendChild(card);
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    firmFilter.appendChild(opt);
  }

  const accRes = await fetch('/api/accountants');
  const accData = await accRes.json();
  const team = accData.accountants || [];
  accountantsById = Object.fromEntries(team.map((a) => [a.id, a]));
  const tbody = document.querySelector('#team-table tbody');
  tbody.innerHTML = '';
  for (const a of team) {
    const firm = firmsById[a.firmId];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${esc(a.name)}</strong></td><td>${esc(a.role)}</td><td>${esc(firm?.name || a.firmId)}</td><td>${esc(a.email)}</td>`;
    tbody.appendChild(tr);
  }

  const clientsRes = await fetch('/api/clients');
  const clientsData = await clientsRes.json();
  const allClients = clientsData.clients || [];

  document.getElementById('ps-firms').textContent = String(
    (firmsData.firms || []).length
  );
  document.getElementById('ps-team').textContent = String(team.length);
  document.getElementById('ps-clients').textContent = String(allClients.length);
  document.getElementById('ps-portal').textContent = String(
    allClients.filter((c) => c.portalAccess).length
  );

  await loadClients();
  firmFilter.addEventListener('change', loadClients);
  document.getElementById('practice-status-filter')?.addEventListener('change', loadClients);
}

async function loadClients() {
  const firmId = document.getElementById('practice-firm-filter').value;
  const q = firmId ? `?firmId=${encodeURIComponent(firmId)}` : '';
  const res = await fetch(`/api/clients${q}`);
  const data = await res.json();
  const accRes = await fetch('/api/accountants');
  const accData = await accRes.json();
  const accById = Object.fromEntries((accData.accountants || []).map((a) => [a.id, a]));
  accountantsById = accById;
  const tbody = document.querySelector('#practice-clients tbody');
  tbody.innerHTML = '';
  const status = document.getElementById('practice-status-filter')?.value || '';
  const clients = status ? (data.clients || []).filter((c) => c.status === status) : (data.clients || []);
  if (!clients.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><strong>No clients match this queue</strong>Change the firm or workflow filter.</div></td></tr>';
    return;
  }
  for (const c of clients) {
    const tr = document.createElement('tr');
    const statusLabel = c.statusLabel || c.status || '—';
    const cls = statusClass(c.status);
    tr.innerHTML = `
      <td><strong>${esc(c.name)}</strong></td>
      <td>${esc(firmsById[c.firmId]?.name || c.firmId)}</td>
      <td>${esc(accById[c.accountantId]?.name || c.accountantId)}</td>
      <td>${esc(sourceLabels(c))}</td>
      <td>${esc(c.dueDate || '—')}</td>
      <td><span class="status-pill ${cls}">${esc(statusLabel)}</span></td>
      <td><select class="owner-select" data-client-id="${esc(c.id)}"><option value="">Change owner…</option>${Object.values(accById).filter((a) => a.firmId === c.firmId).map((a) => `<option value="${esc(a.id)}"${a.id === c.accountantId ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></td>
      <td><a class="btn btn-primary btn-sm" href="/app?client=${encodeURIComponent(c.id)}">Open</a></td>`;
    tbody.appendChild(tr);
  }
}

document.querySelector('#practice-clients tbody')?.addEventListener('change', async (event) => {
  const select = event.target.closest('.owner-select');
  if (!select || !select.value) return;
  select.disabled = true;
  const res = await fetch(`/api/clients/${encodeURIComponent(select.dataset.clientId)}/workflow`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountantId: select.value, actor: 'Practice manager' }),
  });
  const data = await res.json();
  if (!res.ok) window.alert(data.error || 'The client owner could not be changed.');
  await loadClients();
});

init();
