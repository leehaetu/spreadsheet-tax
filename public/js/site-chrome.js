/**
 * Site chrome: quiet legal honesty + environment mode label.
 * Sales pages: footer note only — no yellow status banner.
 * App pages: compact legal strip + mode pill (sandbox / preview / live).
 */
(function () {
  const FOOTER_LEGAL =
    'Spreadsheet Tax is independent software for Making Tax Digital quarterly updates. ' +
    'Not affiliated with HMRC. Not yet on HMRC’s recognised software list.';

  function isSalesSurface() {
    // Product shell paths are never sales (mode pill allowed)
    if (isProductShellPath()) return false;
    const b = document.body;
    if (b.classList.contains('practice-shell')) return false;
    if (b.classList.contains('control-centre')) return false;
    // Public auth entry uses app-simple but is still a sales surface (no mode pill)
    if (b.classList.contains('sales-surface')) return true;
    if (b.classList.contains('app-body') && !b.classList.contains('app-simple')) {
      return false;
    }
    // app-simple alone (sign-in/register) is public entry, not product shell
    if (b.classList.contains('app-simple')) return true;
    if (b.classList.contains('app-body')) return false;
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
      '';

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

  function modeLabel(status) {
    if (!status) return null;
    if (status.liveSubmitEnabled && status.hmrcMode !== 'double' && !status.oauthMock) {
      return {
        text: 'Live HMRC mode (operator-enabled)',
        cls: 'mode-live',
      };
    }
    if (status.hmrcMode === 'sandbox' || (status.liveSubmitEnabled && status.oauthMock === false)) {
      return { text: 'HMRC sandbox', cls: 'mode-sandbox' };
    }
    return { text: 'Preview only — not sent to HMRC', cls: 'mode-preview' };
  }

  function isProductShellPath() {
    const p = (location.pathname || '/').replace(/\/$/, '') || '/';
    const prefixes = [
      '/home',
      '/app',
      '/onboarding',
      '/records',
      '/year-end',
      '/workspace',
      '/connect-hmrc',
      '/account',
      '/history',
      '/billing',
      '/admin',
      '/mtd',
    ];
    return prefixes.some((pre) => p === pre || p.startsWith(pre + '/'));
  }

  function ensureModePill(status) {
    // Never show product mode chrome on marketing or public auth entry
    if (isSalesSurface()) return;
    if (!isProductShellPath()) return;
    if (document.getElementById('st-mode-pill')) return;
    const m = modeLabel(status);
    if (!m) return;
    const pill = document.createElement('div');
    pill.id = 'st-mode-pill';
    pill.setAttribute('role', 'status');
    pill.className = 'st-mode-pill ' + m.cls;
    pill.textContent = m.text;
    const nav = document.querySelector('.site-header nav');
    if (nav) {
      nav.appendChild(pill);
    } else {
      document.body.insertBefore(pill, document.body.firstChild);
    }
  }

  function ensureModeStyles() {
    if (document.getElementById('st-mode-styles')) return;
    const s = document.createElement('style');
    s.id = 'st-mode-styles';
    s.textContent =
      '.st-mode-pill{display:inline-block;margin-left:0.5rem;padding:0.15rem 0.5rem;border-radius:999px;font-size:0.72rem;font-weight:600;letter-spacing:0.01em}' +
      '.st-mode-pill.mode-preview{background:#fef3c7;color:#92400e}' +
      '.st-mode-pill.mode-sandbox{background:#dbeafe;color:#1e3a8a}' +
      '.st-mode-pill.mode-live{background:#fee2e2;color:#991b1b}' +
      '.legal-quiet-line{font-size:0.8rem;color:#64748b;margin-top:0.75rem}';
    document.head.appendChild(s);
  }

  async function boot() {
    ensureModeStyles();
    ensureFooterLine();
    try {
      const res = await fetch('/api/status');
      if (!res.ok) return;
      const status = await res.json();
      ensureModePill(status);
    } catch {
      /* offline / static */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
