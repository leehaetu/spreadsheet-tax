/**
 * Site chrome: quiet legal honesty on sales only.
 * Product shell pages never show sandbox / preview / live mode pills.
 */
(function () {
  const FOOTER_LEGAL =
    'Spreadsheet Tax is independent software for Making Tax Digital quarterly updates. ' +
    'Not affiliated with HMRC. Not yet on HMRC’s recognised software list.';

  function isProductShellPath() {
    const p = (location.pathname || '/').replace(/\/$/, '') || '/';
    const prefixes = [
      '/home',
      '/app',
      '/onboarding',
      '/records',
      '/year-end',
      '/connect-hmrc',
      '/account',
      '/history',
      '/guide',
      '/billing',
    ];
    return prefixes.some((pre) => p === pre || p.startsWith(pre + '/'));
  }

  function isSalesSurface() {
    if (isProductShellPath()) return false;
    const b = document.body;
    if (b.classList.contains('practice-shell')) return false;
    if (b.classList.contains('control-centre')) return false;
    if (b.classList.contains('cc-page') || b.classList.contains('journey-page')) return false;
    if (b.classList.contains('auth-product-shell')) return true;
    if (b.classList.contains('sales-surface')) return true;
    if (b.classList.contains('app-body') && !b.classList.contains('app-simple')) {
      return false;
    }
    if (b.classList.contains('app-simple')) return true;
    if (b.classList.contains('app-body')) return false;
    return true;
  }

  function ensureFooterLine() {
    // No marketing footers inside product shell
    if (isProductShellPath()) return;
    if (document.getElementById('hmrc-recognition-footer')) return;
    const line = document.createElement('p');
    line.id = 'hmrc-recognition-footer';
    line.className = 'legal-quiet-line';
    line.innerHTML =
      FOOTER_LEGAL + ' <a href="/security">Security &amp; privacy</a>';

    const footer = document.querySelector('.site-footer');
    if (footer) {
      const wrap =
        footer.querySelector('.footer-bottom') ||
        footer.querySelector('.wrap') ||
        footer;
      wrap.appendChild(line);
    }
  }

  function ensureModeStyles() {
    if (document.getElementById('st-mode-styles')) return;
    const s = document.createElement('style');
    s.id = 'st-mode-styles';
    s.textContent =
      '.legal-quiet-line{font-size:0.8rem;color:#64748b;margin-top:0.75rem}';
    document.head.appendChild(s);
  }

  function boot() {
    ensureModeStyles();
    ensureFooterLine();
    // Explicitly remove any legacy mode pills on product pages
    if (isProductShellPath()) {
      document.getElementById('st-mode-pill')?.remove();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
