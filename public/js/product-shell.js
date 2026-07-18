/**
 * Shared authenticated product shell helpers.
 * Customer-facing labels stay production-like; operator diagnostics stay off this path.
 */
(function () {
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Neutral connection label for the product chrome. */
  window.stConnectionLabel = function stConnectionLabel(data) {
    if (!data) return 'Checking…';
    const conn = data.connection || {};
    const connected = Boolean(
      data.oauthConnected ||
        data.hmrcConnected ||
        (conn.connected && !conn.mock)
    );
    const mock = Boolean(data.oauthMock || conn.mock || data.oauth?.mock);
    if (connected && !mock) return 'Connected';
    return 'Not connected';
  };

  window.stApplyConnectionStatus = function stApplyConnectionStatus(data) {
    const label = window.stConnectionLabel(data);
    document.querySelectorAll('#connection-status, #setup-mode, #history-mode, #account-mode').forEach((el) => {
      el.textContent = label;
    });
    document.querySelectorAll('.cc-status-dot').forEach((dot) => {
      dot.classList.toggle('offline', label === 'Not connected' || label === 'Checking…');
      dot.classList.toggle('warn', false);
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
      const res = await fetch('/api/status');
      const data = await res.json().catch(() => ({}));
      // Prefer explicit OAuth session when present
      try {
        const me = await fetch('/api/hmrc/status');
        if (me.ok) {
          const conn = await me.json();
          Object.assign(data, conn);
          data.oauthConnected = Boolean(conn?.connection?.connected);
          data.oauthMock = Boolean(conn?.connection?.mock || conn?.oauth?.mock);
        }
      } catch {
        /* optional */
      }
      window.stApplyConnectionStatus(data);
      return data;
    } catch {
      window.stApplyConnectionStatus({ previewOnly: true });
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
      const name = user.name || user.displayName || (user.email ? String(user.email).split('@')[0] : '');
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
    wireMenu();
    const today = document.getElementById('today-label');
    if (today && !today.dataset.locked) today.textContent = window.stTodayLabel();
    refreshConnection();
    fillAccountChip();
  });

  // Export for pages that load status themselves
  window.stRefreshConnection = refreshConnection;
  window.stEsc = esc;
})();
