/** Authenticated practice workspace */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function init() {
  const me = await fetch('/api/auth/me').then((r) => r.json());
  const badge = document.getElementById('user-badge');
  const gate = document.getElementById('gate');
  const panel = document.getElementById('ws-panel');

  if (!me.user) {
    badge.textContent = 'Not signed in';
    gate.hidden = false;
    gate.innerHTML =
      'Sign in required. <a href="/signin?next=/workspace">Sign in</a> (demo: demo@spreadsheet-tax.example / DemoPass123!)';
    return;
  }

  badge.textContent = me.user.email;
  panel.hidden = false;

  const firmSel = document.getElementById('firm-select');
  firmSel.innerHTML = '';
  for (const m of me.memberships || []) {
    const opt = document.createElement('option');
    opt.value = m.firmId;
    opt.textContent = `${m.firmName} (${m.role})`;
    firmSel.appendChild(opt);
  }
  if (!firmSel.options.length) {
    gate.hidden = false;
    gate.textContent = 'No firm membership on this account.';
    return;
  }

  async function loadClients() {
    const firmId = firmSel.value;
    const res = await fetch(`/api/me/clients?firmId=${encodeURIComponent(firmId)}`);
    const data = await res.json();
    const tbody = document.getElementById('client-body');
    tbody.innerHTML = '';
    for (const c of data.clients || []) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esc(c.name)}</strong></td>
        <td><span class="status-pill">${esc(c.statusLabel || c.status)}</span></td>
        <td>${esc(c.dueDate || '—')}</td>
        <td>
          <a class="btn btn-primary btn-sm" href="/app">Import</a>
          <button type="button" class="btn btn-ghost btn-sm advance" data-id="${esc(c.id)}" data-status="${esc(c.status)}">Advance</button>
        </td>`;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('.advance').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const cur = btn.getAttribute('data-status');
        const statuses = await fetch('/api/me/workflow-statuses').then((r) =>
          r.json()
        );
        // Ask server for allowed via client GET transitions — fetch client list transitions from advance map
        const order = (statuses.statuses || []).map((s) => s.id);
        const idx = order.indexOf(cur);
        const next = order[idx + 1] || order[0];
        const res2 = await fetch(`/api/me/clients/${encodeURIComponent(id)}/workflow`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next, note: 'Advanced from workspace' }),
        });
        const body = await res2.json();
        if (!res2.ok) {
          alert(body.error || 'Could not update');
          return;
        }
        loadClients();
      });
    });
  }

  firmSel.addEventListener('change', loadClients);
  await loadClients();

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.href = '/signin';
  });
}

init();
