/**
 * Shared authenticated product shell — single source of truth for nav + connection chrome.
 * Boards: output/product-design/01–03. HMRC-mirror only; no create-business UI.
 */
(function () {
  const NAV = [
    { href: '/home', label: 'Home', match: ['/home'], icon: 'home' },
    { href: '/app?flow=quarterly', label: 'Quarterly updates', match: ['/app'], icon: 'cal' },
    { href: '/year-end', label: 'Year end', match: ['/year-end'], icon: 'doc' },
    { href: '/records', label: 'Sources', match: ['/records', '/onboarding'], icon: 'list' },
    { href: '/history', label: 'History', match: ['/history'], icon: 'clock' },
    { href: '/account', label: 'Settings', match: ['/account'], icon: 'user' },
    { href: '/guide', label: 'Help', match: ['/guide'], icon: 'help' },
  ];


  const ICONS = {
    home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    doc: '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    list: '<path d="M8 4h9a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2Z"/><path d="M10 9h6M10 13h6"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v5l3 2"/>',
    user: '<circle cx="12" cy="9" r="3.5"/><path d="M5 19.5c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5"/>',
    help: '<circle cx="12" cy="12" r="8"/><path d="M12 11v5M12 8h.01"/>',
  };

  function pathActive(item) {
    const p = location.pathname.replace(/\/$/, '') || '/';
    return item.match.some((m) => p === m || p.startsWith(m + '/'));
  }

  function svg(name) {
    return `<span class="cc-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${ICONS[name] || ''}</svg></span>`;
  }

  function buildNavHtml() {
    return NAV.map((item) => {
      const active = pathActive(item) ? ' class="active"' : '';
      return `<a href="${item.href}"${active}>${svg(item.icon)}${item.label}</a>`;
    }).join('');
  }

  function ensureShell() {
    const nav = document.querySelector('aside.cc-sidebar nav.cc-nav, nav.cc-nav');
    if (nav && nav.closest('aside.cc-sidebar, .cc-shell, body.control-centre, body.cc-page, body.journey-page')) {
      nav.innerHTML = buildNavHtml();
      nav.setAttribute('aria-label', 'Application navigation');
    }

    // Ensure sidebar bottom has connection + person
    document.querySelectorAll('aside.cc-sidebar').forEach((side) => {
      let bottom = side.querySelector('.cc-sidebar-bottom');
      if (!bottom) {
        bottom = document.createElement('div');
        bottom.className = 'cc-sidebar-bottom';
        side.appendChild(bottom);
      }
      if (!bottom.querySelector('.cc-connection')) {
        bottom.insertAdjacentHTML(
          'afterbegin',
          `<a class="cc-connection" href="/connect-hmrc"><span class="cc-status-dot" aria-hidden="true"></span><span><small>HMRC connection</small><strong id="connection-status">Checking…</strong><em>MTD for Income Tax</em></span></a>`
        );
      }
      if (!bottom.querySelector('.cc-person')) {
        bottom.insertAdjacentHTML(
          'beforeend',
          `<a class="cc-person" href="/account"><span class="cc-avatar">ST</span><span><strong id="account-name">Your account</strong><small>Taxpayer</small></span></a>`
        );
      }
      // Normalize connection status id
      const st = bottom.querySelector('.cc-connection strong');
      if (st && !st.id) st.id = 'connection-status';
    });
  }

  window.stConnectionLabel = function stConnectionLabel(data) {
    if (!data) return 'Checking…';
    // Only a real, non-mock, non-expired stored HMRC token counts as Connected.
    // Never promote mock OAuth, app-status flags, or missing connection objects.
    const conn = data.connection;
    if (!conn || typeof conn !== 'object') return 'Not connected';
    const really = Boolean(conn.connected && !conn.mock && !conn.expired);
    return really ? 'Connected' : 'Not connected';
  };

  window.stApplyConnectionStatus = function stApplyConnectionStatus(data) {
    const label = window.stConnectionLabel(data);
    document
      .querySelectorAll('#connection-status, #setup-mode, #history-mode, #account-mode')
      .forEach((el) => {
        el.textContent = label;
      });
    document.querySelectorAll('.cc-status-dot').forEach((dot) => {
      dot.classList.toggle('offline', label !== 'Connected');
    });
  };

  window.stGreeting = function stGreeting(name) {
    const hour = new Date().getHours();
    let part = 'Good evening';
    if (hour < 12) part = 'Good morning';
    else if (hour < 18) part = 'Good afternoon';
    return name ? `${part}, ${name}` : part;
  };

  window.stTodayLabel = function stTodayLabel(date = new Date()) {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
    } catch {
      return date.toISOString().slice(0, 10);
    }
  };

  async function refreshConnection() {
    try {
      // Prefer user HMRC status; /api/status alone must never mark Connected.
      const me = await fetch('/api/hmrc/status');
      if (me.ok) {
        const data = await me.json().catch(() => ({}));
        window.stApplyConnectionStatus(data);
        return data;
      }
      window.stApplyConnectionStatus({ connection: null });
      return null;
    } catch {
      window.stApplyConnectionStatus({ connection: null });
      return null;
    }
  }

  function wireMenu() {
    const toggle = document.getElementById('cc-menu-toggle') || document.getElementById('cc-menu');
    const side = document.getElementById('cc-sidebar');
    const mobile = document.getElementById('cc-mobile-nav');
    toggle?.addEventListener('click', () => {
      if (side) {
        const open = side.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      }
      if (mobile) {
        mobile.hidden = !mobile.hidden;
        toggle.setAttribute('aria-expanded', String(!mobile.hidden));
      }
    });
  }

  async function fillAccountChip() {
    const nameEl = document.getElementById('account-name');
    const avatar = document.querySelector('.cc-avatar');
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return;
      const data = await res.json();
      const user = data.user || data;
      const name =
        user.name || user.displayName || (user.email ? String(user.email).split('@')[0] : '');
      if (nameEl && name) nameEl.textContent = name;
      if (avatar && name) {
        const parts = String(name).trim().split(/\s+/);
        const initials =
          parts.length >= 2
            ? `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
            : String(name).slice(0, 2).toUpperCase();
        avatar.textContent = initials || 'ST';
      }
      const greet = document.getElementById('home-greeting');
      if (greet) greet.textContent = window.stGreeting(name.split(/\s+/)[0] || '');
    } catch {
      /* signed out */
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    ensureShell();
    wireMenu();
    const today = document.getElementById('today-label');
    if (today && !today.dataset.locked) today.textContent = window.stTodayLabel();
    refreshConnection();
    fillAccountChip();
  });

  window.stRefreshConnection = refreshConnection;
  window.stEnsureShell = ensureShell;
})();
