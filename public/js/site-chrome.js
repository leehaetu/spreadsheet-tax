/**
 * Site chrome: quiet legal honesty for HMRC inspectors.
 * Sales pages: footer note only — no yellow status banner.
 * App pages: compact legal strip, not a development status board.
 */
(function () {
  const FOOTER_LEGAL =
    'Spreadsheet Tax is independent software for Making Tax Digital quarterly updates. ' +
    'Not affiliated with HMRC. Not yet on HMRC’s recognised software list.';

  function isSalesSurface() {
    const b = document.body;
    if (b.classList.contains('app-body') || b.classList.contains('practice-shell')) {
      return false;
    }
    // Marketing pages: no app-body class
    return true;
  }

  function ensureFooterLine() {
    if (document.getElementById('hmrc-recognition-footer')) return;
    const line = document.createElement('p');
    line.id = 'hmrc-recognition-footer';
    line.className = 'legal-quiet-line';
    line.innerHTML =
      FOOTER_LEGAL +
      ' <a href="/security">Security &amp; privacy</a>' +
      (isSalesSurface() ? '' : ' · <a href="/integrity">For HMRC review</a>');

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
    // No site-wide yellow “status” banner — customers buy a product, not a project plan.
    ensureFooterLine();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
