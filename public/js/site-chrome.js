/**
 * Site-wide chrome: HMRC recognition status (always visible).
 * Single place — do not invent a second wording on random pages without this.
 */
(function () {
  const SHORT = 'Goal: HMRC Recognised · Not yet recognised';
  const BANNER =
    'Goal: HMRC Recognised · Status: not yet recognised — sandbox / pilot only. Not for live recognised MTD filing until recognition is granted.';
  const FOOTER =
    'Goal: HMRC Recognised. Status: not yet on HMRC’s recognised list. Sandbox/pilot only. Not affiliated with or endorsed by HMRC.';

  function ensureBanner() {
    if (document.getElementById('hmrc-recognition-banner')) return;
    const el = document.createElement('div');
    el.id = 'hmrc-recognition-banner';
    el.className = 'hmrc-recognition-banner';
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<div class="wrap hmrc-recognition-inner">' +
      '<span class="hmrc-recognition-badge">' +
      SHORT +
      '</span>' +
      '<span class="hmrc-recognition-text">' +
      BANNER +
      '</span>' +
      '<a class="hmrc-recognition-link" href="/integrity">Integrity</a>' +
      '</div>';
    const header = document.querySelector('.site-header');
    if (header && header.parentNode) {
      header.insertAdjacentElement('afterend', el);
    } else {
      document.body.insertAdjacentElement('afterbegin', el);
    }
  }

  function ensureFooterLine() {
    if (document.getElementById('hmrc-recognition-footer')) return;
    const line = document.createElement('p');
    line.id = 'hmrc-recognition-footer';
    line.className = 'hmrc-recognition-footer-line';
    line.innerHTML =
      '<strong>' +
      SHORT +
      '</strong> — ' +
      FOOTER.replace(SHORT + '. ', '') +
      ' <a href="/security">Security &amp; HMRC</a> · <a href="/integrity">Integrity</a>';

    const footer = document.querySelector('.site-footer');
    if (footer) {
      const wrap =
        footer.querySelector('.footer-bottom') ||
        footer.querySelector('.wrap') ||
        footer;
      wrap.appendChild(line);
    } else {
      const bar = document.createElement('div');
      bar.className = 'site-footer';
      bar.innerHTML = '<div class="wrap footer-bottom"></div>';
      bar.querySelector('.wrap').appendChild(line);
      document.body.appendChild(bar);
    }
  }

  function boot() {
    ensureBanner();
    ensureFooterLine();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
