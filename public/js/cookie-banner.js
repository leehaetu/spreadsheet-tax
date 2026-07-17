/** Minimal cookie notice — session cookies only; no marketing trackers */

(function () {
  try {
    if (localStorage.getItem('st_cookie_ok') === '1') return;
  } catch {
    /* private mode */
  }
  const bar = document.createElement('div');
  bar.id = 'cookie-banner';
  bar.setAttribute('role', 'dialog');
  bar.setAttribute('aria-label', 'Cookie notice');
  bar.innerHTML =
    '<div class="cookie-inner wrap">' +
    '<p>We use <strong>essential cookies</strong> for sign-in sessions. We do not use advertising trackers. ' +
    'Period files are uploaded for mapping when you use the app. ' +
    '<a href="/security">Privacy details</a></p>' +
    '<button type="button" class="btn btn-primary btn-sm" id="cookie-ok">OK</button>' +
    '</div>';
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(bar);
    document.getElementById('cookie-ok')?.addEventListener('click', () => {
      try {
        localStorage.setItem('st_cookie_ok', '1');
      } catch {
        /* ignore */
      }
      bar.remove();
    });
  });
})();
