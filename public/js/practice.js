/** Multi-accountant practice dashboard client */

let firmsById = {};

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
    card.innerHTML = `<h3>${esc(f.name)}</h3><p>Type: ${esc(f.type)} · Plan: ${esc(f.plan)}</p>`;
    firmsList.appendChild(card);
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    firmFilter.appendChild(opt);
  }

  const accRes = await fetch('/api/accountants');
  const accData = await accRes.json();
  const tbody = document.querySelector('#team-table tbody');
  tbody.innerHTML = '';
  for (const a of accData.accountants || []) {
    const firm = firmsById[a.firmId];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${esc(a.name)}</td><td>${esc(a.role)}</td><td>${esc(firm?.name || a.firmId)}</td><td>${esc(a.email)}</td>`;
    tbody.appendChild(tr);
  }

  await loadClients();
  firmFilter.addEventListener('change', loadClients);
}

async function loadClients() {
  const firmId = document.getElementById('practice-firm-filter').value;
  const q = firmId ? `?firmId=${encodeURIComponent(firmId)}` : '';
  const res = await fetch(`/api/clients${q}`);
  const data = await res.json();
  const accRes = await fetch('/api/accountants');
  const accData = await accRes.json();
  const accById = Object.fromEntries((accData.accountants || []).map((a) => [a.id, a]));
  const tbody = document.querySelector('#practice-clients tbody');
  tbody.innerHTML = '';
  for (const c of data.clients || []) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(c.name)}</td>
      <td>${esc(firmsById[c.firmId]?.name || c.firmId)}</td>
      <td>${esc(accById[c.accountantId]?.name || c.accountantId)}</td>
      <td>${esc((c.sources || []).join(', '))}</td>
      <td>${c.portalAccess ? 'Yes' : 'No'}</td>`;
    tbody.appendChild(tr);
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

init();
