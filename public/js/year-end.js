/** Customer year-end guided workflows — same server MTD adapter as quarterly. */

function fraudClientHeaders() {
  /** @type {Record<string, string>} */
  const h = {};
  try {
    h['X-Client-Timezone-Offset'] = String(-new Date().getTimezoneOffset());
    if (window.innerWidth > 0 && window.innerHeight > 0) {
      h['X-Client-Window-Size'] = `${window.innerWidth}x${window.innerHeight}`;
    }
    let deviceId = localStorage.getItem('st_device_id');
    if (
      !deviceId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        deviceId
      )
    ) {
      deviceId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : null;
      if (deviceId) localStorage.setItem('st_device_id', deviceId);
    }
    if (deviceId) h['X-Client-Device-Id'] = deviceId;
  } catch {
    /* ignore */
  }
  return h;
}

async function api(url, options = {}) {
  const headers = {
    ...fraudClientHeaders(),
    ...(options.headers || {}),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(url, { ...options, headers });
}

function ids() {
  return {
    nino: (document.getElementById('nino')?.value || '')
      .replace(/\s+/g, '')
      .toUpperCase(),
    taxYear: document.getElementById('tax-year')?.value || '2024-25',
    businessIdSe: document.getElementById('bid-se')?.value || '',
    businessIdUk: document.getElementById('bid-uk')?.value || '',
    businessIdForeign: document.getElementById('bid-fp')?.value || '',
    periodId: document.getElementById('period-id')?.value || '',
  };
}

function showOut(obj) {
  const el = document.getElementById('wf-out');
  if (el) el.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
}

function showResult(data) {
  const err = document.getElementById('wf-error');
  const ok = document.getElementById('wf-success');
  const sum = document.getElementById('wf-summary');
  const rec = document.getElementById('wf-receipt');
  const link = document.getElementById('wf-receipt-link');
  if (err) err.hidden = true;
  if (ok) ok.hidden = false;
  if (sum) {
    sum.textContent = data.ok
      ? `Step “${data.workflow}” completed (mode: ${data.mode}).`
      : `Step “${data.workflow}” failed or returned non-success from HMRC.`;
  }
  if (rec) {
    rec.textContent = data.receiptId
      ? `Receipt id: ${data.receiptId}`
      : 'No receipt id (check error output).';
  }
  if (link && data.receiptId) {
    link.href = `/api/receipts/${encodeURIComponent(data.receiptId)}`;
    link.textContent = 'Download receipt JSON';
  }
  showOut(data);
}

function showError(msg) {
  const err = document.getElementById('wf-error');
  const ok = document.getElementById('wf-success');
  if (ok) ok.hidden = true;
  if (err) {
    err.textContent = msg;
    err.hidden = false;
  }
}

async function runWorkflow(name) {
  const body = { workflow: name, ...ids() };
  try {
    const res = await api('/api/workflows/run', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || `Request failed (${res.status})`);
      showOut(data);
      return;
    }
    showResult(data);
  } catch (e) {
    showError(e.message || String(e));
  }
}

document.querySelectorAll('[data-wf]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const name = btn.getAttribute('data-wf');
    if (name) runWorkflow(name);
  });
});

document.getElementById('load-biz')?.addEventListener('click', async () => {
  const { nino } = ids();
  const note = document.getElementById('biz-note');
  if (!nino) {
    if (note) note.textContent = 'Enter NINO first.';
    return;
  }
  try {
    const res = await api(
      `/api/hmrc/mtd/businesses?nino=${encodeURIComponent(nino)}`
    );
    const data = await res.json();
    const list =
      data.body?.listOfBusinesses || data.body?.businesses || [];
    for (const b of list) {
      const t = String(b.typeOfBusiness || '').toLowerCase();
      const id = b.businessId || '';
      if (t.includes('self-employment')) {
        const el = document.getElementById('bid-se');
        if (el) el.value = id;
      } else if (t.includes('uk-property')) {
        const el = document.getElementById('bid-uk');
        if (el) el.value = id;
      } else if (t.includes('foreign-property')) {
        const el = document.getElementById('bid-fp');
        if (el) el.value = id;
      }
    }
    if (note) {
      note.textContent = list.length
        ? `Loaded ${list.length} business(es).`
        : data.error || 'No businesses returned.';
    }
    showOut(data);
  } catch (e) {
    if (note) note.textContent = e.message || String(e);
  }
});

(async function status() {
  try {
    const res = await api('/api/status');
    const data = await res.json();
    const el = document.getElementById('connection-status');
    if (el) {
      el.textContent = data.previewOnly
        ? 'Preview mode'
        : data.liveSubmitEnabled
          ? 'Submit flag on'
          : 'Preview mode';
    }
  } catch {
    /* ignore */
  }
})();
