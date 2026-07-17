/** Client portal via firm invite token */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function openWithToken(token) {
  const err = document.getElementById('portal-error');
  err.hidden = true;
  if (!token) {
    err.textContent = 'Enter a portal token from your accountant.';
    err.hidden = false;
    return;
  }
  const res = await fetch(`/api/portal/client?token=${encodeURIComponent(token)}`);
  const data = await res.json();
  if (!res.ok) {
    err.textContent = data.error || 'Invalid portal link';
    err.hidden = false;
    return;
  }
  const c = data.client;
  document.getElementById('client-view').hidden = false;
  document.getElementById('client-name').textContent = c.name;
  document.getElementById('client-firm-line').textContent = c.firmName
    ? `Managed by ${c.firmName}`
    : 'Your firm';
  document.getElementById('client-status').textContent = c.statusLabel || c.status || '—';
  document.getElementById('profile-list').innerHTML = [
    ['Status', c.statusLabel || c.status],
    ['Due', c.dueDate || '—'],
    ['Firm', c.firmName || '—'],
  ]
    .map(
      ([k, v]) =>
        `<li><span>${esc(k)}</span><span><strong>${esc(v)}</strong></span></li>`
    )
    .join('');
  document.getElementById('upload-link').href = `/app?portal=1`;
}

document.getElementById('open-portal')?.addEventListener('click', () => {
  openWithToken(document.getElementById('token-input').value.trim());
});

const q = new URLSearchParams(location.search).get('token');
if (q) {
  document.getElementById('token-input').value = q;
  openWithToken(q);
}
