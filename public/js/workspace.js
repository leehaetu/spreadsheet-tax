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

  const statusFilter = document.getElementById('status-filter');
  if (statusFilter && statusFilter.options.length <= 1) {
    fetch('/api/me/workflow-statuses')
      .then((r) => r.json())
      .then((data) => {
        for (const s of data.statuses || []) {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.label;
          statusFilter.appendChild(opt);
        }
      })
      .catch(() => {});
  }
  statusFilter?.addEventListener('change', () => {
    needsActionOnly = false;
    loadClients();
  });
  const searchEl = document.getElementById('client-search');
  searchEl?.addEventListener('input', () => loadClients());
  let needsActionOnly = false;
  let needsActionIds = new Set();
  document.getElementById('needs-action-btn')?.addEventListener('click', () => {
    needsActionOnly = !needsActionOnly;
    const btn = document.getElementById('needs-action-btn');
    if (btn) {
      btn.textContent = needsActionOnly ? 'Show all clients' : 'Show needs action';
    }
    if (needsActionOnly && statusFilter) statusFilter.value = '';
    loadClients();
  });

  async function loadDashboard() {
    const firmId = firmSel.value;
    if (!firmId) return;
    try {
      const res = await fetch(
        `/api/me/practice-dashboard?firmId=${encodeURIComponent(firmId)}`
      );
      const data = await res.json();
      const d = data.dashboard;
      if (!d) return;
      document.getElementById('dash-total').textContent = String(d.totalClients);
      document.getElementById('dash-needs').textContent = String(d.needsActionCount);
      document.getElementById('dash-overdue').textContent = String(d.overdue);
      document.getElementById('dash-soon').textContent = String(d.dueSoon);
      needsActionIds = new Set((d.needsAction || []).map((c) => c.id));
    } catch {
      /* ignore dashboard errors */
    }
  }

  async function loadClients() {
    const firmId = firmSel.value;
    await loadDashboard();
    const res = await fetch(`/api/me/clients?firmId=${encodeURIComponent(firmId)}`);
    const data = await res.json();
    const tbody = document.getElementById('client-body');
    tbody.innerHTML = '';
    const filter = statusFilter?.value || '';
    const q = (searchEl?.value || '').trim().toLowerCase();
    const list = (data.clients || []).filter((c) => {
      if (needsActionOnly && !needsActionIds.has(c.id)) return false;
      if (filter && c.status !== filter) return false;
      if (q && !String(c.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="4"><div class="empty-state"><strong>No clients match</strong>Try another filter or add a client.</div></td></tr>';
      return;
    }
    for (const c of list) {
      const tr = document.createElement('tr');
      const overdue =
        c.dueDate &&
        c.dueDate < new Date().toISOString().slice(0, 10) &&
        c.status !== 'submitted';
      tr.innerHTML = `
        <td><strong>${esc(c.name)}</strong>${overdue ? ' <span class="status-pill review">Overdue</span>' : ''}</td>
        <td><span class="status-pill">${esc(c.statusLabel || c.status)}</span></td>
        <td>${esc(c.dueDate || '—')}</td>
        <td>
          <button type="button" class="btn btn-primary btn-sm import-for" data-id="${esc(c.id)}" data-name="${esc(c.name)}">Import file</button>
          <button type="button" class="btn btn-ghost btn-sm invite" data-id="${esc(c.id)}">Portal link</button>
          <button type="button" class="btn btn-ghost btn-sm due" data-id="${esc(c.id)}" data-due="${esc(c.dueDate || '')}">Due date</button>
          <button type="button" class="btn btn-ghost btn-sm advance" data-id="${esc(c.id)}" data-status="${esc(c.status)}">Advance</button>
        </td>`;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('.due').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const current = btn.getAttribute('data-due') || '';
        const dueDate = window.prompt('Due date (YYYY-MM-DD)', current);
        if (dueDate === null) return;
        const res = await fetch(`/api/me/clients/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dueDate }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'Could not update due date');
          return;
        }
        loadClients();
      });
    });
    tbody.querySelectorAll('.invite').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const res = await fetch(
          `/api/me/clients/${encodeURIComponent(id)}/portal-invite`,
          { method: 'POST' }
        );
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'Could not create invite');
          return;
        }
        const url = data.url || `${location.origin}${data.path}`;
        try {
          await navigator.clipboard.writeText(url);
          alert(`Portal link copied:\n${url}`);
        } catch {
          prompt('Copy portal link:', url);
        }
      });
    });
    tbody.querySelectorAll('.import-for').forEach((btn) => {
      btn.addEventListener('click', () => {
        const panel = document.getElementById('import-panel');
        const idEl = document.getElementById('import-client-id');
        const label = document.getElementById('import-client-label');
        if (panel) panel.hidden = false;
        if (idEl) idEl.value = btn.getAttribute('data-id') || '';
        if (label) {
          label.textContent = `Importing for: ${btn.getAttribute('data-name') || 'client'}`;
        }
        panel?.scrollIntoView({ behavior: 'smooth' });
      });
    });
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

  const addBtn = document.getElementById('add-client-btn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const name = window.prompt('Client name');
      if (!name) return;
      const res = await fetch('/api/me/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmId: firmSel.value, name }),
      });
      const body = await res.json();
      if (!res.ok) {
        alert(body.error || 'Could not add client');
        return;
      }
      loadClients();
    });
  }

  document.getElementById('export-clients-btn')?.addEventListener('click', () => {
    const firmId = firmSel.value;
    if (!firmId) return;
    window.location.href = `/api/me/clients/export?firmId=${encodeURIComponent(firmId)}`;
  });

  document.getElementById('reminders-btn')?.addEventListener('click', async () => {
    const res = await fetch('/api/me/jobs/deadline-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ withinDays: 30 }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Could not run reminders');
      return;
    }
    alert(`Deadline reminders queued (stub email): ${data.count || 0}`);
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.href = '/signin';
  });

  document.getElementById('client-import-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('import-msg');
    const err = document.getElementById('import-err');
    if (msg) msg.hidden = true;
    if (err) err.hidden = true;
    const clientId = document.getElementById('import-client-id')?.value;
    const fileInput = document.getElementById('client-file');
    const file = fileInput?.files?.[0];
    if (!clientId || !file) {
      if (err) {
        err.textContent = 'Choose a client and a spreadsheet file.';
        err.hidden = false;
      }
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(
      `/api/me/clients/${encodeURIComponent(clientId)}/import`,
      { method: 'POST', body: fd }
    );
    const data = await res.json();
    if (!res.ok) {
      if (err) {
        err.textContent = data.error || 'Import failed';
        err.hidden = false;
      }
      return;
    }
    if (msg) {
      msg.hidden = false;
      msg.innerHTML = `Draft created. <a href="${esc(data.redirectApp || '/app')}">Review in the app</a>`;
    }
  });
}

init();
