/** Lightweight CTA event beacon — no tax data */

export function trackCta(event, meta = {}) {
  try {
    const payload = {
      event,
      path: typeof location !== 'undefined' ? location.pathname : '',
      meta,
    };
    if (typeof fetch === 'function') {
      fetch('/api/analytics/cta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a[data-cta],button[data-cta]');
    if (!a) return;
    trackCta(a.getAttribute('data-cta') || 'click', {
      href: a.getAttribute('href') || null,
    });
  });
}
