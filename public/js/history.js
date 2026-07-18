let historyItems = [];
let deleteDraftId = '';

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function formatDate(value) {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value));
}

function renderHistory() {
  const filter = document.getElementById('history-filter').value;
  const items = historyItems.filter((item) => filter === 'all' || item.status === filter);
  const root = document.getElementById('history-list');
  if (!items.length) {
    root.innerHTML = '<div class="empty-setup"><strong>No matching history</strong><span>Change the filter or start a quarterly update.</span></div>';
    return;
  }
  root.innerHTML = items.map((item) => `
    <article class="history-event ${item.status}">
      <span class="history-marker"></span>
      <div><time>${esc(formatDate(item.createdAt))}</time><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p><span class="history-status">${esc(item.statusLabel)}</span></div>
      <div class="history-event-actions">${item.kind === 'draft'
        ? `<a class="btn btn-primary btn-sm" href="/app?draftId=${encodeURIComponent(item.id)}">Open draft</a><button class="btn btn-ghost btn-sm" data-delete-draft="${esc(item.id)}">Delete</button>`
        : `<a class="btn btn-ghost btn-sm" href="/api/receipts/${encodeURIComponent(item.id)}">View receipt</a><a class="btn btn-ghost btn-sm" href="/api/receipts/${encodeURIComponent(item.id)}?download=1">Download</a>`}
      </div>
    </article>`).join('');
  root.querySelectorAll('[data-delete-draft]').forEach((button) => {
    button.addEventListener('click', () => {
      deleteDraftId = button.dataset.deleteDraft;
      document.getElementById('delete-draft-dialog').showModal();
    });
  });
}

function renderRecovery(connection, service, failedReceipts) {
  const authority = document.getElementById('recovery-authority');
  const authorityCopy = document.getElementById('recovery-authority-copy');
  if (connection.connection?.expired) {
    authority.classList.add('active-warning');
    authorityCopy.textContent = 'Your saved HMRC authorisation has expired. Reconnect before an HMRC-backed action.';
  } else if (connection.connection?.connected) {
    authorityCopy.textContent = `Connected in ${connection.connection.mode || 'HMRC'} mode until ${formatDate(connection.connection.expiresAt)}.`;
  } else if (connection.connection?.mock) {
    authorityCopy.textContent = 'A local mock connection is active. It is not an HMRC authorisation.';
  } else {
    authorityCopy.textContent = 'No real HMRC authorisation is stored. Preview remains available.';
  }

  const serviceCard = document.getElementById('recovery-service');
  document.getElementById('recovery-service-copy').textContent = service.message || 'No operator service status has been recorded.';
  if (!['available', 'ok', 'green'].includes(String(service.status || '').toLowerCase())) {
    serviceCard.classList.add('active-warning');
  }

  const duplicate = failedReceipts.find((receipt) => {
    const text = JSON.stringify(receipt).toLowerCase();
    return text.includes('duplicate') || text.includes('already submitted');
  });
  const duplicateCard = document.getElementById('recovery-duplicate');
  const duplicateCopy = document.getElementById('recovery-duplicate-copy');
  if (duplicate) {
    duplicateCard.classList.add('active-warning');
    duplicateCopy.textContent = 'A failed receipt indicates a duplicate or already-submitted update. Review the existing attempt before retrying.';
  } else {
    duplicateCopy.textContent = 'No duplicate-submission error was found in the recent failed receipts.';
  }
}

async function load() {
  const me = await fetch('/api/auth/me').then((response) => response.json());
  if (!me.user) {
    const gate = document.getElementById('gate');
    gate.hidden = false;
    gate.innerHTML = '<a href="/signin?next=/history">Sign in</a> to view your submission history.';
    return;
  }
  const [draftResponse, submissionResponse, statusResponse, connectionResponse, serviceResponse] = await Promise.all([
    fetch('/api/drafts'), fetch('/api/me/submissions'), fetch('/api/status'),
    fetch('/api/hmrc/status'), fetch('/api/hmrc/service-status'),
  ]);
  const drafts = (await draftResponse.json()).drafts || [];
  const submissions = (await submissionResponse.json()).submissions || [];
  const status = await statusResponse.json();
  const connection = await connectionResponse.json();
  const service = await serviceResponse.json();
  document.getElementById('history-mode').textContent = status.hmrcMode === 'live'
    ? 'Production HMRC configured'
    : status.oauthMock === false ? 'HMRC sandbox configured' : 'Preview mode';

  const failedReceipts = await Promise.all(submissions.filter((item) => !item.ok).slice(0, 8).map(async (item) => {
    const response = await fetch(`/api/receipts/${encodeURIComponent(item.id)}`);
    return response.ok ? response.json() : null;
  }));
  renderRecovery(connection, service, failedReceipts.filter(Boolean));

  historyItems = [
    ...drafts.map((draft) => ({ kind: 'draft', id: draft.id, createdAt: draft.createdAt, title: draft.filename || 'Spreadsheet draft', detail: 'Saved draft · not submitted', status: 'draft', statusLabel: 'Draft' })),
    ...submissions.map((submission) => ({ kind: 'submission', id: submission.id, createdAt: submission.createdAt, title: submission.ok ? 'Submission attempt completed' : 'Submission attempt failed', detail: `${submission.mode || 'unknown'} mode · receipt ${submission.id.slice(0, 8)}`, status: submission.ok ? 'ok' : 'failed', statusLabel: submission.ok ? (submission.mode === 'double' ? 'Preview completed' : 'Submitted') : 'Failed' })),
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  document.getElementById('history-total').textContent = historyItems.length;
  document.getElementById('history-success').textContent = submissions.filter((item) => item.ok).length;
  document.getElementById('history-action').textContent = submissions.filter((item) => !item.ok).length;
  renderHistory();
}

document.getElementById('history-filter').addEventListener('change', renderHistory);
document.getElementById('delete-draft-dialog').addEventListener('close', async (event) => {
  if (event.target.returnValue !== 'confirm' || !deleteDraftId) return;
  const response = await fetch(`/api/drafts/${encodeURIComponent(deleteDraftId)}`, { method: 'DELETE' });
  deleteDraftId = '';
  if (!response.ok) {
    const gate = document.getElementById('gate');
    gate.hidden = false;
    gate.textContent = 'The draft could not be deleted.';
    return;
  }
  await load();
});
document.getElementById('cc-menu-toggle').addEventListener('click', () => {
  const sidebar = document.getElementById('cc-sidebar');
  const open = sidebar.classList.toggle('open');
  document.getElementById('cc-menu-toggle').setAttribute('aria-expanded', String(open));
});
load();
