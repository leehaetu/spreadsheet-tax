/** Submission history — drafts, attempts, receipts and recovery states. */

let historyItems = [];
let deleteDraftId = '';
let historyExpanded = false;

const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatDateShort(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function connectionLabel(connection, status) {
  // Prefer the HMRC status payload shape: { connection: { connected, mock, expired } }
  const payload = {
    ...(status && typeof status === 'object' ? status : {}),
    connection:
      connection?.connection ||
      status?.connection ||
      (connection && typeof connection === 'object' && 'connected' in connection
        ? connection
        : null),
  };
  if (typeof window.stConnectionLabel === 'function') {
    return window.stConnectionLabel(payload);
  }
  const conn = payload.connection || {};
  if (conn.connected && !conn.mock && !conn.expired) return 'Connected';
  return 'Not connected';
}

function renderHistory() {
  const filter = document.getElementById('history-filter').value;
  const filtered = historyItems.filter(
    (item) => filter === 'all' || item.status === filter
  );
  const items = historyExpanded ? filtered : filtered.slice(0, 7);
  const root = document.getElementById('history-list');
  if (!items.length) {
    root.innerHTML =
      '<div class="empty-setup"><strong>No matching history</strong><span>Change the filter or start a quarterly update.</span><a class="btn btn-primary btn-sm" href="/app?flow=quarterly">Start quarterly update</a></div>';
    return;
  }
  root.innerHTML = `
    <div class="history-table-wrap">
      <table class="history-table" aria-label="Submission timeline">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Event</th>
            <th scope="col">Status</th>
            <th scope="col">Reference</th>
            <th scope="col">Evidence</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map((item) => {
              const ref =
                item.kind === 'draft'
                  ? '—'
                  : esc(String(item.id || '').slice(0, 12));
              const actions =
                item.kind === 'draft'
                  ? `<a class="btn btn-primary btn-sm" href="/app?draftId=${encodeURIComponent(item.id)}">Open</a>
                     <button type="button" class="btn btn-ghost btn-sm" data-delete-draft="${esc(item.id)}">Delete</button>`
                  : `<a class="btn btn-ghost btn-sm" href="/api/receipts/${encodeURIComponent(item.id)}">View</a>
                     <a class="btn btn-ghost btn-sm" href="/api/receipts/${encodeURIComponent(item.id)}?download=1">Download</a>`;
              return `<tr class="history-row ${esc(item.status)}">
                <td><time datetime="${esc(item.createdAt || '')}">${esc(formatDateShort(item.createdAt))}</time></td>
                <td><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></td>
                <td><span class="history-status-pill ${esc(item.status)}">${esc(item.statusLabel)}</span></td>
                <td class="history-ref">${ref}</td>
                <td class="history-actions">${actions}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>`;

  root.querySelectorAll('[data-delete-draft]').forEach((button) => {
    button.addEventListener('click', () => {
      deleteDraftId = button.dataset.deleteDraft;
      document.getElementById('delete-draft-dialog')?.showModal();
    });
  });
  const more = document.getElementById('history-more');
  more.hidden = filtered.length <= 7;
  more.textContent = historyExpanded
    ? 'Show recent only'
    : `Show all history (${filtered.length})`;
}

function renderRecovery(connection, service, failedReceipts) {
  const authority = document.getElementById('recovery-authority');
  const authorityCopy = document.getElementById('recovery-authority-copy');
  const conn = connection?.connection || {};
  authority?.classList.remove('active-warning');
  if (conn.expired) {
    authority?.classList.add('active-warning');
    authorityCopy.textContent =
      'Your HMRC authorisation has expired. Reconnect before sending an update.';
  } else if (conn.connected && !conn.mock) {
    authorityCopy.textContent =
      'HMRC is connected. You can prepare and send updates when you are ready.';
  } else {
    authorityCopy.textContent =
      'HMRC is not connected for this account. Connect HMRC before sending updates.';
  }

  const serviceCard = document.getElementById('recovery-service');
  serviceCard?.classList.remove('active-warning');
  document.getElementById('recovery-service-copy').textContent =
    service.message ||
    'No HMRC service disruption has been recorded for this account.';
  if (
    !['available', 'ok', 'green', 'unknown', ''].includes(
      String(service.status || '').toLowerCase()
    )
  ) {
    serviceCard?.classList.add('active-warning');
  }

  const duplicate = failedReceipts.find((receipt) => {
    const text = JSON.stringify(receipt).toLowerCase();
    return text.includes('duplicate') || text.includes('already submitted');
  });
  const duplicateCard = document.getElementById('recovery-duplicate');
  const duplicateCopy = document.getElementById('recovery-duplicate-copy');
  duplicateCard?.classList.remove('active-warning');
  if (duplicate) {
    duplicateCard?.classList.add('active-warning');
    duplicateCopy.textContent =
      'A failed receipt indicates a duplicate or already-submitted update. Review the existing attempt before retrying.';
  } else {
    duplicateCopy.textContent =
      'No duplicate-submission error was found in the recent failed receipts.';
  }
}

async function load() {
  const me = await fetch('/api/auth/me').then((response) => response.json());
  if (!me.user) {
    const gate = document.getElementById('gate');
    gate.hidden = false;
    gate.innerHTML =
      '<a href="/signin?next=/history">Sign in</a> to view your submission history.';
    return;
  }
  const [
    draftResponse,
    submissionResponse,
    statusResponse,
    connectionResponse,
    serviceResponse,
  ] = await Promise.all([
    fetch('/api/drafts'),
    fetch('/api/me/submissions'),
    fetch('/api/status'),
    fetch('/api/hmrc/status'),
    fetch('/api/hmrc/service-status'),
  ]);
  const drafts = (await draftResponse.json()).drafts || [];
  const submissions = (await submissionResponse.json()).submissions || [];
  const status = await statusResponse.json();
  const connection = await connectionResponse.json();
  const service = await serviceResponse.json();

  const label = connectionLabel(connection, status);
  const modeEl = document.getElementById('history-mode');
  if (modeEl) modeEl.textContent = label;
  if (typeof window.stApplyConnectionStatus === 'function') {
    // HMRC connection object only — do not let /api/status flags imply Connected.
    window.stApplyConnectionStatus(connection);
  }

  const failedReceipts = await Promise.all(
    submissions
      .filter((item) => !item.ok)
      .slice(0, 8)
      .map(async (item) => {
        const response = await fetch(
          `/api/receipts/${encodeURIComponent(item.id)}`
        );
        return response.ok ? response.json() : null;
      })
  );
  renderRecovery(connection, service, failedReceipts.filter(Boolean));

  historyItems = [
    ...drafts.map((draft) => ({
      kind: 'draft',
      id: draft.id,
      createdAt: draft.createdAt,
      title: draft.filename || 'Spreadsheet draft',
      detail: 'Saved draft · not submitted',
      status: 'draft',
      statusLabel: 'Draft',
    })),
    ...submissions.map((submission) => {
      const prepared =
        submission.mode === 'double' || submission.previewOnly === true;
      return {
        kind: 'submission',
        id: submission.id,
        createdAt: submission.createdAt,
        title: submission.ok
          ? prepared
            ? 'Quarterly update prepared'
            : 'Submission attempt completed'
          : 'Submission attempt failed',
        detail: prepared
          ? 'Local record · not sent to HMRC'
          : `Receipt ${String(submission.id).slice(0, 8)}`,
        status: submission.ok ? 'ok' : 'failed',
        statusLabel: submission.ok
          ? prepared
            ? 'Prepared'
            : 'Submitted'
          : 'Failed',
      };
    }),
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  document.getElementById('history-total').textContent = String(
    historyItems.length
  );
  document.getElementById('history-success').textContent = String(
    submissions.filter((item) => item.ok).length
  );
  document.getElementById('history-action').textContent = String(
    submissions.filter((item) => !item.ok).length
  );
  renderHistory();
}

document.getElementById('history-filter')?.addEventListener('change', renderHistory);
document.getElementById('history-more')?.addEventListener('click', () => {
  historyExpanded = !historyExpanded;
  renderHistory();
});
document
  .getElementById('delete-draft-dialog')
  ?.addEventListener('close', async (event) => {
    if (event.target.returnValue !== 'confirm' || !deleteDraftId) return;
    const response = await fetch(
      `/api/drafts/${encodeURIComponent(deleteDraftId)}`,
      { method: 'DELETE' }
    );
    deleteDraftId = '';
    if (!response.ok) {
      const gate = document.getElementById('gate');
      gate.hidden = false;
      gate.textContent = 'The draft could not be deleted.';
      return;
    }
    await load();
  });
document.getElementById('cc-menu-toggle')?.addEventListener('click', () => {
  const sidebar = document.getElementById('cc-sidebar');
  const open = sidebar?.classList.toggle('open');
  document
    .getElementById('cc-menu-toggle')
    ?.setAttribute('aria-expanded', String(Boolean(open)));
});
load();
