/**
 * Shared marketing chrome: one nav + footer + mobile menu for sales surfaces.
 * data-sales-nav="v1" marks standardized chrome for tests.
 */
(function () {
  const PRODUCT_PREFIXES = [
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
    '/portal',
  ];

  function pathOnly() {
    return (location.pathname || '/').replace(/\/$/, '') || '/';
  }

  function isProductPath() {
    const p = pathOnly();
    return PRODUCT_PREFIXES.some((pre) => p === pre || p.startsWith(pre + '/'));
  }

  /** Marketing / public auth entry — not product shell */
  function isSalesChromePage() {
    if (isProductPath()) return false;
    if (document.body.classList.contains('practice-shell')) return false;
    // Explicit marketing + public entry pages
    return true;
  }

  function isActive(href) {
    const p = pathOnly();
    if (href === '/' || href === '/sales') return p === '/' || p === '/sales';
    return p === href || p.startsWith(href + '/');
  }

  const NAV = [
    { href: '/self-employed', label: 'Self-employed' },
    { href: '/landlords', label: 'Landlords' },
    { href: '/professionals', label: 'Accountants' },
    { href: '/how-it-works', label: 'How it works' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/help', label: 'Help' },
  ];

  function navLinksHtml() {
    return NAV.map((item) => {
      const active = isActive(item.href) ? ' class="is-active"' : '';
      return `<a href="${item.href}"${active}>${item.label}</a>`;
    }).join('');
  }

  function ensureHeader() {
    let header = document.querySelector('.site-header');
    if (!header) {
      header = document.createElement('header');
      header.className = 'site-header';
      document.body.insertBefore(header, document.body.firstChild);
    }
    header.setAttribute('data-sales-nav', 'v1');
    header.innerHTML = `
      <div class="wrap header-inner sales-header-inner">
        <a class="logo" href="/"><span class="logo-mark">ST</span> Spreadsheet Tax</a>
        <button type="button" class="sales-nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="sales-nav-drawer">
          <span></span><span></span><span></span>
        </button>
        <nav class="sales-nav-desktop" aria-label="Main">
          ${navLinksHtml()}
          <a class="btn btn-ghost btn-sm" href="/signin?next=/home" data-cta="sign-in">Sign in</a>
          <a class="btn btn-primary btn-sm" href="/register" data-cta="get-started-free">Get started free</a>
        </nav>
      </div>
      <div id="sales-nav-drawer" class="sales-nav-drawer" hidden>
        <nav aria-label="Mobile">
          ${navLinksHtml()}
          <a href="/signin?next=/home" data-cta="sign-in">Sign in</a>
          <a class="btn btn-primary btn-block" href="/register" data-cta="get-started-free">Get started free</a>
        </nav>
      </div>`;

    const toggle = header.querySelector('.sales-nav-toggle');
    const drawer = header.querySelector('#sales-nav-drawer');
    toggle?.addEventListener('click', () => {
      const open = drawer.hasAttribute('hidden');
      if (open) {
        drawer.removeAttribute('hidden');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Close menu');
        document.body.classList.add('sales-nav-open');
      } else {
        drawer.setAttribute('hidden', '');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
        document.body.classList.remove('sales-nav-open');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer && !drawer.hasAttribute('hidden')) {
        drawer.setAttribute('hidden', '');
        toggle?.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('sales-nav-open');
      }
    });
  }

  function ensureFooter() {
    let footer = document.querySelector('.site-footer');
    if (!footer) {
      footer = document.createElement('footer');
      footer.className = 'site-footer';
      document.body.appendChild(footer);
    }
    footer.setAttribute('data-sales-footer', 'v1');
    footer.innerHTML = `
      <div class="wrap footer-bottom">
        <p>
          <a href="/help">Help</a> ·
          <a href="/pricing">Pricing</a> ·
          <a href="/security">Security</a> ·
          <a href="/privacy">Privacy</a> ·
          <a href="/terms">Terms</a> ·
          <a href="/legal">Legal</a> ·
          <a href="/license">Licensing</a>
        </p>
        <p class="muted">Independent software by Lee Hine. Not affiliated with HMRC. Not on HMRC’s recognised software list.</p>
      </div>`;
  }

  function forceLightTheme() {
    document.body.classList.add('theme-light');
    document.body.classList.add('sales-surface');
    // Auth entry pages sometimes carry app-body for layout; keep light sales look
    if (
      ['/signin', '/register', '/forgot-password', '/reset-password', '/accept-invite'].includes(
        pathOnly()
      )
    ) {
      document.body.classList.remove('app-body');
      document.body.classList.add('app-simple');
    }
  }

  function unifyCtaLabels() {
    document.querySelectorAll('a.btn, button.btn').forEach((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (
        t === 'Create free account' ||
        t === 'Create account' ||
        t === 'Start free' ||
        t === 'Start now'
      ) {
        if (el.tagName === 'A' && (el.getAttribute('href') || '').includes('register')) {
          el.textContent = 'Get started free';
        } else if (el.tagName === 'BUTTON' && el.closest('#reg-form, form')) {
          el.textContent = 'Get started free';
        }
      }
      if (t === 'Get free template') {
        el.textContent = 'Download free template';
        if (el.tagName === 'A' && !el.getAttribute('href')) {
          el.setAttribute('href', '/download/template');
        }
      }
    });
  }

  /** SALE-12 light instrumentation: data attributes for CTA analytics hooks */
  function tagPrimaryCtas() {
    document.querySelectorAll('a.btn[href*="register"], button.btn').forEach((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t === 'Get started free' || (el.getAttribute('href') || '').includes('/register')) {
        if (!el.getAttribute('data-cta')) el.setAttribute('data-cta', 'get-started-free');
      }
    });
    document.querySelectorAll('a.btn[href*="template"], a.btn[href*="/download/"]').forEach((el) => {
      if (!el.getAttribute('data-cta')) el.setAttribute('data-cta', 'download-template');
    });
    document.querySelectorAll('a.btn[href="/how-it-works"], a.btn[href*="how-it-works"]').forEach((el) => {
      if (!el.getAttribute('data-cta')) el.setAttribute('data-cta', 'how-it-works');
    });
  }

  function boot() {
    if (!isSalesChromePage()) return;
    forceLightTheme();
    ensureHeader();
    ensureFooter();
    unifyCtaLabels();
    tagPrimaryCtas();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
