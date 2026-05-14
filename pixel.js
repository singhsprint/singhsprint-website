/* =========================================================================
 * Meta Pixel - CLIENT HELPER (SP_PIXEL)
 * -------------------------------------------------------------------------
 * Single source of truth for firing events. Every call:
 *   1. Generates a UUID v4 as event_id
 *   2. Pushes the event (with event_id) to window.dataLayer
 *   3. Fires fbq('track', ...) with { eventID: event_id }    <- client Pixel
 *   4. POSTs to /api/meta-capi with the same event_id        <- server CAPI
 *
 * Meta de-duplicates when client + server arrive with matching event_name
 * AND event_id within ~48h. See CAPI-SETUP.md for verification steps.
 *
 * Usage:
 *   SP_PIXEL.track('Lead', { content_name: 'Quote Form' }, { em: userEmail });
 *   SP_PIXEL.track('ViewContent', { content_ids: ['hoodie-01'] });
 *
 * PII (em, ph, fn, ln, ...) is sent RAW from the browser to OUR server only;
 * the server hashes with SHA-256 before forwarding to Meta. Never email/phone
 * the Graph API directly from the client.
 * ========================================================================= */

(function () {
  // -- UUID v4 generator (no deps; works in every browser with crypto API) --
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // -- POST the event to our own CAPI proxy. Uses sendBeacon when possible
  //    so it survives page unload (important for outbound-link / form-submit
  //    events). Falls back to fetch+keepalive. Fire-and-forget by design.  --
  function sendToCAPI(payload) {
    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(window.SP_CAPI_ENDPOINT, blob);
        return;
      }
      fetch(window.SP_CAPI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function () { /* swallow - CAPI failures must not break UX */ });
    } catch (e) { /* swallow */ }
  }

  // -- Build the CAPI payload. IMPORTANT: same event_id the client Pixel used.
  //    event_source_url + fbp/fbc cookies give Meta richer matching signals. --
  function buildCAPIPayload(eventName, eventId, customData, userData) {
    function cookie(name) {
      var m = document.cookie.match('(?:^|; )' + name + '=([^;]+)');
      return m ? decodeURIComponent(m[1]) : undefined;
    }
    return {
      event_name: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: window.location.href,
      action_source: 'website',
      user_data: Object.assign({
        fbp: cookie('_fbp'),
        fbc: cookie('_fbc')
      }, userData || {}),
      custom_data: customData || {}
    };
  }

  // -- Public API ------------------------------------------------------------
  var SP_PIXEL = {
    /**
     * Fire a Meta standard or custom event.
     * @param {string} eventName  e.g. 'PageView', 'ViewContent', 'Lead', 'Purchase'
     * @param {object} [customData]  content_ids, value, currency, ...
     * @param {object} [userData]    { em, ph, fn, ln, ct, st, zp, country } — RAW; hashed server-side.
     * @returns {string} the event_id used (useful for tests/debugging)
     */
    track: function (eventName, customData, userData) {
      var eventId = uuid();

      // 1. dataLayer (debugging + future GTM compatibility)
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'meta_pixel_event',
        event_name: eventName,
        event_id: eventId,
        custom_data: customData || {}
      });

      // 2. Client Pixel fire with eventID  -> de-duplication key for Meta
      if (window.fbq) {
        window.fbq('track', eventName, customData || {}, { eventID: eventId });
      }

      // 3. Server-side CAPI with matching event_id
      sendToCAPI(buildCAPIPayload(eventName, eventId, customData, userData));

      return eventId;
    },

    // Convenience wrapper so callers don't have to remember the event name.
    trackPageView: function () { return SP_PIXEL.track('PageView'); }
  };

  window.SP_PIXEL = SP_PIXEL;

  // -- Auto-fire PageView on load. Base code has already called fbq('init').
  //    We call fbq('track', 'PageView', ...) with eventID for dedup, which
  //    REPLACES the default auto-PageView from the base snippet. The base
  //    snippet's fbq('track', 'PageView') is intentionally omitted so we
  //    don't double-fire without dedup.                                   --
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', SP_PIXEL.trackPageView);
  } else {
    SP_PIXEL.trackPageView();
  }
})();
