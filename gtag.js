/* =========================================================================
 * Google Tag (gtag.js) - CLIENT HELPER (SP_GTAG)
 * -------------------------------------------------------------------------
 * Single source of truth for firing Google measurement events. Every call:
 *   1. Pushes the event to window.dataLayer
 *   2. Sends a GA4 event via gtag('event', ...)
 *   3. (For conversions) sends a Google Ads conversion via gtag('event',
 *      'conversion', { send_to: 'AW-XXX/LABEL', ... })
 *
 * gtag.js auto-subscribes to window.dataLayer, so existing spTrack('xyz', {...})
 * pushes from components.js flow into GA4 automatically. This helper exists
 * for the EXPLICIT Google Ads conversion events that the bidding algorithm
 * optimizes against — keep those isolated from the catch-all spTrack stream.
 *
 * Usage:
 *   SP_GTAG.trackConversion('quote_submit', { value: 747.50, currency: 'CAD' });
 *   SP_GTAG.event('view_catalog', { product_type: 'hoodie' });
 *
 * NOTE: This helper is intentionally lightweight — it doesn't handle PII
 * hashing (Google's Enhanced Conversions can do that, but we'll add it as
 * a follow-up once basic tracking is verified working).
 * ========================================================================= */

(function () {
  // Bootstrap the gtag global if the base snippet hasn't loaded it yet.
  // Safe to call this even if the page hasn't loaded https://www.googletagmanager.com/gtag/js
  // because the queue persists and is flushed when that script eventually arrives.
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  // Expose so callers / debug consoles can reach it directly if needed.
  window.gtag = window.gtag || gtag;

  // -- Configure GA4 ---------------------------------------------------------
  // send_page_view: true means each page load fires page_view to GA4. We also
  // get a parallel page_view via spTrack() in components.js, but GA4 dedupes
  // by client_id + timestamp so this won't double-count.
  if (window.SP_GA4_MEASUREMENT_ID) {
    gtag('js', new Date());
    gtag('config', window.SP_GA4_MEASUREMENT_ID, {
      send_page_view: true
    });
  }

  // -- Configure Google Ads conversion linker -------------------------------
  // Only fires once advertiser verification is done and we've filled in the
  // real AW- id in gtag-config.js (SP_GADS_ENABLED guard).
  if (typeof window.SP_GADS_ENABLED === 'function' && window.SP_GADS_ENABLED()) {
    gtag('config', window.SP_GOOGLE_ADS_ID, {
      // allow_enhanced_conversions enables sending hashed user_data with
      // future conversion events for better match rates. Off until we wire
      // PII hashing in trackConversion().
      allow_enhanced_conversions: false
    });
  }

  // -- Public API -----------------------------------------------------------
  var SP_GTAG = {
    /**
     * Fire a plain GA4 event. Goes to window.dataLayer + GA4. Use for
     * engagement signals you DON'T want Google Ads to bid on.
     * @param {string} name  e.g. 'view_catalog', 'cta_click', 'scroll_50pct'
     * @param {object} [params]
     */
    event: function (name, params) {
      if (!name) return;
      gtag('event', name, params || {});
    },

    /**
     * Fire a Google Ads CONVERSION + GA4 event in parallel. Google Ads
     * bidding uses these events to optimize Maximize Conversions / tCPA.
     *
     * @param {string} ga4EventName  GA4-side event name (e.g. 'quote_submit')
     * @param {object} [params]      { value, currency, transaction_id, ... }
     *                               value/currency drive ROAS reporting.
     */
    trackConversion: function (ga4EventName, params) {
      params = params || {};

      // 1. GA4 side — fire the human-readable event name. GA4 marks it as a
      //    key event if it's been flagged in the GA4 admin UI.
      if (window.SP_GA4_MEASUREMENT_ID) {
        gtag('event', ga4EventName, params);
      }

      // 2. Google Ads side — fire the 'conversion' event with the send_to
      //    target pointing at the specific conversion action. Skipped until
      //    SP_GADS_ENABLED() flips true.
      if (typeof window.SP_GADS_ENABLED === 'function' && window.SP_GADS_ENABLED()
          && window.SP_GADS_QUOTE_LABEL && window.SP_GADS_QUOTE_LABEL !== 'REPLACE_ME') {
        var conversionParams = {
          send_to: window.SP_GOOGLE_ADS_ID + '/' + window.SP_GADS_QUOTE_LABEL
        };
        if (typeof params.value === 'number') conversionParams.value = params.value;
        if (params.currency) conversionParams.currency = params.currency;
        if (params.transaction_id) conversionParams.transaction_id = params.transaction_id;
        gtag('event', 'conversion', conversionParams);
      }
    }
  };

  window.SP_GTAG = SP_GTAG;
})();
