/** Client portal entry */

async function loadClients() {
  const res = await fetch('/api/clients');
  const data = await res.json();
  const sel = document.getElementById('client-select');
  for (const c of data.clients || []) {
    if (!c.portalAccess) continue;
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
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
  document.getElementById('client-view').hidden = false;
  document.getElementById('client-name').textContent = c.name;
  document.getElementById('client-json').textContent = JSON.stringify(c, null, 2);
  const tags = document.getElementById('client-summary');
  tags.innerHTML = '';
  for (const s of c.sources || []) {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = s;
    tags.appendChild(span);
  }
});

loadClients();
