/** Taxpayer home — obligation-led next task */

async function api(url, opts) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function load() {
  const gate = document.getElementById('gate');
  const { res, data } = await api('/api/me/dashboard');
  if (res.status === 401) {
    gate.hidden = false;
    gate.textContent = 'Sign in to see your tax updates.';
    gate.innerHTML += ' <a href="/signin">Sign in</a>';
    return;
  }
  if (!res.ok) {
    gate.hidden = false;
    gate.textContent = data.error || 'Could not load dashboard';
    return;
  }

  const ty = document.getElementById('tax-year-label');
  if (ty) ty.textContent = `${data.taxYear || ''} tax year`;
  const lead = document.getElementById('deadline-lead');
  if (lead) {
    if (data.nextDeadline?.due) {
      lead.textContent = `Next deadline: ${data.nextDeadline.due}${
        data.nextDeadline.periodEnd
          ? ` · period to ${data.nextDeadline.periodEnd}`
          : ''
      }`;
    } else {
      lead.textContent =
        'Connect HMRC to load deadlines, or continue with a spreadsheet update.';
    }
  }

  const title = document.getElementById('next-task-title');
  const detail = document.getElementById('next-task-detail');
  const cta = document.getElementById('next-task-cta');
  if (title) title.textContent = data.nextTask?.title || 'Prepare an update';
  if (detail) detail.textContent = data.nextTask?.detail || '';
  if (cta && data.nextTask?.href) {
    cta.href = data.nextTask.href;
    cta.textContent =
      data.sources?.length === 0 ? 'Start setup' : 'Continue quarterly update';
  }

  const list = document.getElementById('source-list');
  const empty = document.getElementById('source-empty');
  if (!data.sources?.length) {
    if (empty) empty.hidden = false;
    if (list) list.innerHTML = '';
  } else {
    if (empty) empty.hidden = true;
    if (list) {
      list.innerHTML = '';
      for (const s of data.sources) {
        const li = document.createElement('li');
        const ready =
          s.readiness === 'ready_to_review'
            ? 'Ready to review'
            : 'Spreadsheet needed';
        const name = s.nickname || s.label;
        li.innerHTML = `<span><strong>${escapeHtml(name)}</strong> · ${escapeHtml(
          s.type.replace(/_/g, ' ')
        )}</span><span class="tag ${
          s.readiness === 'ready_to_review' ? 'green' : 'amber'
        }">${ready}</span>`;
        list.appendChild(li);
      }
    }
  }

  try {
    const st = await api('/api/status');
    const el = document.getElementById('connection-status');
    if (el && st.data) {
      el.textContent = st.data.previewOnly
        ? 'Preview mode'
        : st.data.liveSubmitEnabled
          ? 'Submit available'
          : 'Preview mode';
    }
  } catch {
    /* ignore */
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

load();
