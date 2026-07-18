/**
 * Public product surface inventory — freeze incomplete customer promises.
 * KEEP | FIX | HIDE | DELETE_LATER classification for navigation and CTAs.
 *
 * CARD billing and fake “live payments” stay HIDE until STRIPE_SECRET_KEY is set.
 * Internal MTD diagnostics stay HIDE from customer nav (route may remain for operators).
 */

/**
 * @typedef {'KEEP'|'FIX'|'HIDE'|'DELETE_LATER'} SurfaceClass
 * @typedef {{
 *   path: string,
 *   role: 'sales'|'app'|'practice'|'internal'|'legal',
 *   class: SurfaceClass,
 *   nav: boolean,
 *   note: string
 * }} Surface
 */

/** @type {Surface[]} */
export const PRODUCT_SURFACES = [
  { path: '/', role: 'sales', class: 'KEEP', nav: true, note: 'Sales hub' },
  { path: '/self-employed', role: 'sales', class: 'KEEP', nav: true, note: 'Audience' },
  { path: '/landlords', role: 'sales', class: 'KEEP', nav: true, note: 'Audience' },
  { path: '/professionals', role: 'sales', class: 'FIX', nav: true, note: 'Honest pilot copy only' },
  { path: '/firms', role: 'sales', class: 'FIX', nav: true, note: 'Honest pilot copy only' },
  { path: '/pricing', role: 'sales', class: 'FIX', nav: true, note: 'Experimental prices; no charge CTA' },
  { path: '/how-it-works', role: 'sales', class: 'KEEP', nav: true, note: 'Real screenshots preferred' },
  { path: '/templates', role: 'sales', class: 'KEEP', nav: true, note: 'Download templates' },
  { path: '/security', role: 'sales', class: 'KEEP', nav: true, note: 'Security & privacy claims' },
  { path: '/help', role: 'sales', class: 'KEEP', nav: true, note: 'Support' },
  { path: '/privacy', role: 'legal', class: 'KEEP', nav: false, note: 'Legal' },
  { path: '/terms', role: 'legal', class: 'KEEP', nav: false, note: 'Legal' },
  { path: '/legal', role: 'legal', class: 'KEEP', nav: false, note: 'Legal hub' },
  {
    path: '/integrity',
    role: 'internal',
    class: 'HIDE',
    nav: false,
    note: 'Not public HTTP — honesty map in src/lib/integrity-map.js only',
  },

  { path: '/signin', role: 'app', class: 'KEEP', nav: true, note: 'Auth' },
  { path: '/register', role: 'app', class: 'KEEP', nav: true, note: 'Auth' },
  { path: '/home', role: 'app', class: 'KEEP', nav: true, note: 'Taxpayer home' },
  { path: '/app', role: 'app', class: 'KEEP', nav: true, note: 'Quarterly core journey' },
  { path: '/onboarding', role: 'app', class: 'KEEP', nav: true, note: 'Income sources setup' },
  { path: '/records', role: 'app', class: 'KEEP', nav: true, note: 'Drafts & sources' },
  { path: '/connect-hmrc', role: 'app', class: 'FIX', nav: true, note: 'OAuth — individual vs agent separate' },
  { path: '/history', role: 'app', class: 'KEEP', nav: true, note: 'Receipts / messages' },
  { path: '/account', role: 'app', class: 'FIX', nav: true, note: 'Settings; no fake billing' },
  { path: '/year-end', role: 'app', class: 'FIX', nav: true, note: 'Guided EOY; live HMRC partial' },

  { path: '/workspace', role: 'practice', class: 'FIX', nav: true, note: 'Practice queue — hide incomplete bulk actions' },
  { path: '/portal', role: 'practice', class: 'KEEP', nav: false, note: 'Client portal by token' },

  { path: '/billing', role: 'app', class: 'HIDE', nav: false, note: 'No card processor until STRIPE_SECRET_KEY' },
  { path: '/admin', role: 'internal', class: 'HIDE', nav: false, note: 'Operator metrics — not customer nav' },
  { path: '/mtd', role: 'internal', class: 'HIDE', nav: false, note: 'Internal diagnostics' },
  { path: '/accountant', role: 'practice', class: 'HIDE', nav: false, note: 'Demo portfolio only' },
  { path: '/practice', role: 'practice', class: 'HIDE', nav: false, note: 'Demo portfolio only' },
];

/**
 * Whether card payments are live (real Stripe). Never claim charged without this.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function paymentsLive(env = process.env) {
  return Boolean(env.STRIPE_SECRET_KEY && String(env.STRIPE_SECRET_KEY).trim());
}

/**
 * Whether a surface path should appear in customer navigation.
 * @param {string} path
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isCustomerNavPath(path, env = process.env) {
  const base = path.split('?')[0];
  const row = PRODUCT_SURFACES.find((s) => s.path === base);
  if (!row) return false;
  if (row.class === 'HIDE' || row.class === 'DELETE_LATER') return false;
  if (base === '/billing' && !paymentsLive(env)) return false;
  return row.nav;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function productSurfacePublicStatus(env = process.env) {
  const byClass = { KEEP: 0, FIX: 0, HIDE: 0, DELETE_LATER: 0 };
  for (const s of PRODUCT_SURFACES) {
    byClass[s.class] = (byClass[s.class] || 0) + 1;
  }
  return {
    freezeActive: true,
    paymentsLive: paymentsLive(env),
    billingCustomerNav: paymentsLive(env),
    surfaces: PRODUCT_SURFACES,
    counts: byClass,
    primaryJourney: [
      '/pricing',
      '/register',
      '/connect-hmrc',
      '/app',
      '/history',
    ],
    hiddenFromCustomerNav: PRODUCT_SURFACES.filter(
      (s) => s.class === 'HIDE' || s.class === 'DELETE_LATER' || !s.nav
    ).map((s) => s.path),
  };
}
