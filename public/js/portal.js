/** Client portal entry */

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
  return '';
}

function sourceLabels(c) {
  if (c.sourceLabels?.length) return c.sourceLabels;
  return (c.sources || []).map((s) => {
    if (s === 'self_employment') return 'Self-employment';
    if (s === 'uk_property') return 'UK property';
    if (s === 'foreign_property') return 'Foreign property';
    return s;
  });
}

let firmsById = {};

async function loadClients() {
  const [clientsRes, firmsRes] = await Promise.all([
    fetch('/api/clients'),
    fetch('/api/firms'),
  ]);
  const data = await clientsRes.json();
  const firmsData = await firmsRes.json();
  firmsById = Object.fromEntries(
    (firmsData.firms || []).map((f) => [f.id, f])
  );

  const sel = document.getElementById('client-select');
  for (const c of data.clients || []) {
    if (!c.portalAccess) continue;
    const opt = document.createElement('option');
    opt.value = c.id;
    const firm = firmsById[c.firmId];
    opt.textContent = firm ? `${c.name} · ${firm.name}` : c.name;
    sel.appendChild(opt);
  }
}

document.getElementById('enter-portal')?.addEventListener('click', async () => {
  const err = document.getElementById('portal-error');
  err.hidden = true;
  const id = document.getElementById('client-select').value;
  if (!id) {
    err.textContent = 'Please choose a client profile.';
    err.hidden = false;
    return;
  }
  const res = await fetch(`/api/clients/${encodeURIComponent(id)}`);
  const data = await res.json();
  if (!res.ok) {
    err.textContent = data.error || 'Unable to load client';
    err.hidden = false;
    return;
  }
  const c = data.client;
  const firm = firmsById[c.firmId];

  document.getElementById('client-view').hidden = false;
  document.getElementById('client-name').textContent = c.name;
  document.getElementById('client-firm-line').textContent = firm
    ? `Managed by ${firm.name}`
    : 'Your firm workspace';

  const statusEl = document.getElementById('client-status');
  statusEl.textContent = c.statusLabel || c.status || 'Active';
  statusEl.className = `status-pill ${statusClass(c.status)}`;

  const tags = document.getElementById('client-summary');
  tags.innerHTML = '';
  for (const label of sourceLabels(c)) {
    const span = document.createElement('span');
    span.className = 'tag green';
    span.textContent = label;
    tags.appendChild(span);
  }

  const list = document.getElementById('client-profile-list');
  const rows = [
    ['Client name', c.name],
    ['Income type', c.typeLabel || c.type || '—'],
    ['Last period', c.lastPeriod || '—'],
    ['Status', c.statusLabel || c.status || '—'],
    ['Portal access', c.portalAccess ? 'Enabled' : 'Not enabled'],
    ['Contact', c.contactEmail || '—'],
    ['Firm', firm?.name || c.firmId || '—'],
  ];
  list.innerHTML = rows
    .map(
      ([k, v]) =>
        `<li><span>${esc(k)}</span><span><strong>${esc(v)}</strong></span></li>`
    )
    .join('');

  document
    .getElementById('client-view')
    .scrollIntoView({ behavior: 'smooth', block: 'start' });
});

loadClients();
