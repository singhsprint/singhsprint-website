// promo.js — load the currently-active marketing promo from the CRM and
// rewrite any [data-promo] element on the page with the right localized copy.
//
// Wiring:
//   <span data-promo="short">$20 OFF your first order of $100+. No code needed.</span>
//   <span data-promo="sticky">$20 off first order ($100+)</span>
//   <h3   data-promo="popup-h3">Get $20 off your first order of $100+</h3>
//   <h4   data-promo="sidebar-h">$20 off your first order of $100+</h4>
//   <p    data-promo="sidebar-p">Automatically applied to all new customers. No code needed.</p>
//   <span data-promo="hero-tail">$20 off your first order of $100+.</span>
//
// The hardcoded text in those elements is the fallback. If the CRM is down,
// the network is blocked, or the script fails to load, visitors still see a
// sensible promo. SEO crawlers that don't run JS also pick up the fallback.
//
// Source of truth: the CRM at https://singhsprint-crm.vercel.app/api/promo.
// Promos are managed at https://singhsprint-crm.vercel.app/admin/promos.html.

(function () {
  // ----------------------------------------------------------------
  // Configuration
  // ----------------------------------------------------------------
  var PROMO_API = 'https://singhsprint-crm.vercel.app/api/promo';

  // Map of data-promo values → { en: API field, fr: API field }.
  // Add a new entry here, drop a matching <span data-promo="x"> in the HTML,
  // and the new slot becomes CRM-managed.
  var FIELDS = {
    'short':      { en: 'short_en',      fr: 'short_fr' },
    'sticky':     { en: 'sticky_en',     fr: 'sticky_fr' },
    'hero-tail':  { en: 'hero_tail_en',  fr: 'hero_tail_fr' },
    'popup-h3':   { en: 'title_en',      fr: 'title_fr' },
    'sidebar-h':  { en: 'sidebar_h_en',  fr: 'sidebar_h_fr' },
    'sidebar-p':  { en: 'sidebar_p_en',  fr: 'sidebar_p_fr' },
    'terms':      { en: 'terms_en',      fr: 'terms_fr' }
  };

  // ----------------------------------------------------------------
  // State — the fetched promo lives here and we re-apply on lang flip
  // ----------------------------------------------------------------
  var currentPromo = null;

  function getLang() {
    if (window.SP_LANG && typeof window.SP_LANG.getLang === 'function') {
      return window.SP_LANG.getLang();
    }
    var html = (document.documentElement.lang || 'en').toLowerCase();
    return html.indexOf('fr') === 0 ? 'fr' : 'en';
  }

  // ----------------------------------------------------------------
  // Apply — rewrite every [data-promo] on the page with the chosen lang
  // ----------------------------------------------------------------
  function apply() {
    if (!currentPromo) return;
    var lang = getLang();
    document.querySelectorAll('[data-promo]').forEach(function (el) {
      var slot = el.getAttribute('data-promo');
      var map = FIELDS[slot];
      if (!map) return;
      var key = map[lang] || map.en;
      var val = currentPromo[key];
      // Empty string is treated as "no override" so the fallback stays put.
      // null/undefined likewise. Only replace when the CRM actually has text.
      if (val == null || val === '') return;
      // Use textContent so admin-typed copy can't inject HTML. Safer for a
      // surface that's editable by a (trusted) human via a web form.
      el.textContent = val;
    });
    // Update the data-promo-code attribute (some CTAs may want to read it
    // for tracking). Stored once on <body> for easy access.
    document.body.setAttribute('data-promo-code', currentPromo.code || '');
    document.body.setAttribute('data-promo-slug', currentPromo.slug || '');
  }

  // ----------------------------------------------------------------
  // Fetch + apply once both DOM and network are ready
  // ----------------------------------------------------------------
  function fetchPromo() {
    return fetch(PROMO_API, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        currentPromo = (data && data.promo) || null;
      })
      .catch(function (e) {
        // Network or CORS issue — fall back to whatever's in the HTML.
        // We log but don't surface anything to the user.
        try { console.warn('[promo] fetch failed, using fallback copy', e); } catch (_) {}
      });
  }

  function whenDomReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  // Wait for BOTH (a) DOM ready AND (b) lang.js to have made its first pass.
  // lang.js does a setTimeout(applyLang, 50) inside its own DOMContentLoaded.
  // We delay 80ms so our overwrites land after that, and we listen for the
  // `sp-lang-change` event so toggling language still re-renders us.
  Promise.all([
    fetchPromo(),
    new Promise(function (resolve) { whenDomReady(function () { setTimeout(resolve, 80); }); })
  ]).then(apply);

  document.addEventListener('sp-lang-change', function () { apply(); });
})();
