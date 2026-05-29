/* =========================================================================
 * Google Tag (gtag.js) - CLIENT-SIDE CONFIG
 * -------------------------------------------------------------------------
 * Singhs Print Google measurement stack: GA4 + Google Ads conversions.
 * Mirrors the same shape as pixel-config.js so there is exactly one place
 * to rotate IDs.
 *
 * Loaded BEFORE the gtag base code in the <head> of every page so both
 * the GA4 property and the Google Ads conversion action read the same IDs.
 *
 * What lives here (PUBLIC — visible in the browser, that's fine):
 *   SP_GA4_MEASUREMENT_ID   GA4 property ID (G-XXXXXXXXXX)
 *   SP_GOOGLE_ADS_ID        Google Ads account-level conversion ID (AW-XXXXXXXXX)
 *   SP_GADS_QUOTE_LABEL     Per-conversion label for the Quote submit action
 *
 * What does NOT live here (it has no server-side secret — Google's
 * client-side conversion model doesn't require a token like Meta's CAPI).
 *
 * ROTATION:
 *   GA4    — replace SP_GA4_MEASUREMENT_ID below and redeploy.
 *   Ads    — replace SP_GOOGLE_ADS_ID + SP_GADS_QUOTE_LABEL below and redeploy.
 * ========================================================================= */

// GA4 Measurement ID — pulled from Analytics → Admin → Data streams.
// Property: a380096618 / p519346179.
window.SP_GA4_MEASUREMENT_ID = 'G-JB622HXG06';

// Google Ads conversion linker / account-level ID.
// Account 597-296-7449. Wired up 2026-05-30 from the "Quote Submit — Website
// (gtag)" conversion action (Goals → Conversions). send_to was
// 'AW-17792396715/e5RNCKD857UcEKvbiaRC'.
window.SP_GOOGLE_ADS_ID = 'AW-17792396715';

// Per-conversion-action send_to label for the Quote form submit conversion.
// This is the part AFTER the "/" in the event snippet's send_to value.
// Fires from SP_GTAG.trackConversion('quote_submit', ...) inside showSuccess()
// on quote.html — i.e. only on a confirmed successful submission (slice 78 fix).
window.SP_GADS_QUOTE_LABEL = 'e5RNCKD857UcEKvbiaRC';

// Helper: returns true when the Google Ads ID has been wired up. Used by
// gtag.js to decide whether to skip the AW config + conversion firings
// while we're still waiting on verification. Once you set a real AW- id
// this flips to true and the conversion logic activates automatically.
window.SP_GADS_ENABLED = function () {
  return typeof window.SP_GOOGLE_ADS_ID === 'string'
      && window.SP_GOOGLE_ADS_ID.indexOf('AW-') === 0
      && window.SP_GOOGLE_ADS_ID !== 'AW-REPLACE_ME';
};
