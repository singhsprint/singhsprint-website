/* =========================================================================
 * consent.js — cookie / tracking consent banner (Quebec Law 25 + GDPR)
 * -------------------------------------------------------------------------
 * Added 2026-06-05 compliance pass.
 *
 * The Consent Mode v2 DEFAULTS (everything denied until accept) are set
 * synchronously at the top of components.js so Google honours them from the
 * first gtag call. This file is the UI + controller: it shows the banner when
 * the visitor has not chosen yet, and on a choice it (a) persists it,
 * (b) updates Google Consent Mode, and (c) grants/revokes the Meta Pixel.
 *
 * Storage: localStorage 'sp_consent' = 'granted' | 'denied'.
 * Public API: window.SP_CONSENT.reopen()  (wired to the footer link).
 * ========================================================================= */
(function () {
  'use strict';

  var KEY = 'sp_consent';
  var FR = (document.documentElement.lang || 'en').toLowerCase().indexOf('fr') === 0;

  var T = {
    title:  FR ? 'Nous respectons votre vie privee' : 'We value your privacy',
    body:   FR
      ? 'Nous utilisons des temoins (cookies) pour faire fonctionner le site et ameliorer votre experience. Vous pouvez accepter, refuser, ou en savoir plus dans notre '
      : 'We use cookies to run the site and improve your experience. You can accept, decline, or learn more in our ',
    policy: FR ? 'Politique de temoins' : 'Cookie Policy',
    accept: FR ? 'Tout accepter' : 'Accept all',
    reject: FR ? 'Refuser le non-essentiel' : 'Decline non-essential',
  };

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  function gtagUpdate(granted) {
    if (typeof window.gtag !== 'function') return;
    var v = granted ? 'granted' : 'denied';
    window.gtag('consent', 'update', {
      ad_storage: v, analytics_storage: v, ad_user_data: v, ad_personalization: v,
    });
  }

  // Meta Pixel is inlined per page; we grant/revoke defensively if fbq exists.
  function metaConsent(granted) {
    if (typeof window.fbq !== 'function') return;
    try { window.fbq('consent', granted ? 'grant' : 'revoke'); } catch (e) {}
  }

  function apply(choice) {
    var granted = choice === 'granted';
    window.SP_CONSENT_STATE = choice;
    gtagUpdate(granted);
    metaConsent(granted);
  }

  function removeBanner() {
    var el = document.getElementById('sp-consent-banner');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function choose(choice) {
    write(choice);
    apply(choice);
    removeBanner();
  }

  function showBanner() {
    if (document.getElementById('sp-consent-banner')) return;

    var wrap = document.createElement('div');
    wrap.id = 'sp-consent-banner';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-label', T.title);
    wrap.style.cssText = [
      'position:fixed', 'left:16px', 'right:16px', 'bottom:16px', 'z-index:2147483000',
      'max-width:760px', 'margin:0 auto', 'background:#fff', 'color:#1a1a1a',
      'border:1px solid rgba(0,0,0,.12)', 'border-radius:14px',
      'box-shadow:0 12px 40px rgba(0,0,0,.18)', 'padding:18px 20px',
      'font-family:Inter,-apple-system,system-ui,sans-serif', 'font-size:.9rem', 'line-height:1.55',
    ].join(';');

    var msg = document.createElement('div');
    msg.style.cssText = 'margin-bottom:14px';
    var strong = document.createElement('strong');
    strong.textContent = T.title;
    strong.style.cssText = 'display:block;font-size:1rem;margin-bottom:6px';
    msg.appendChild(strong);
    msg.appendChild(document.createTextNode(T.body));
    var link = document.createElement('a');
    link.href = '/cookies';
    link.textContent = T.policy;
    link.style.cssText = 'color:#1a1a1a;text-decoration:underline;font-weight:600';
    msg.appendChild(link);
    msg.appendChild(document.createTextNode('.'));
    wrap.appendChild(msg);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end';

    var reject = document.createElement('button');
    reject.type = 'button';
    reject.textContent = T.reject;
    reject.style.cssText = 'padding:10px 18px;border-radius:50px;border:1.5px solid #d0d0d0;background:#fff;color:#1a1a1a;font-weight:600;font-size:.86rem;cursor:pointer';
    reject.addEventListener('click', function () { choose('denied'); });

    var accept = document.createElement('button');
    accept.type = 'button';
    accept.textContent = T.accept;
    accept.style.cssText = 'padding:10px 18px;border-radius:50px;border:1.5px solid #1a1a1a;background:#1a1a1a;color:#fff;font-weight:600;font-size:.86rem;cursor:pointer';
    accept.addEventListener('click', function () { choose('granted'); });

    row.appendChild(reject);
    row.appendChild(accept);
    wrap.appendChild(row);

    (document.body || document.documentElement).appendChild(wrap);
  }

  // Public API: reopen the banner from the footer "Cookie preferences" link.
  window.SP_CONSENT = {
    reopen: function () { showBanner(); },
    state: function () { return read() || 'unset'; },
  };

  function init() {
    var stored = read();
    if (stored === 'granted' || stored === 'denied') {
      apply(stored); // re-assert on every page load
    } else {
      apply('denied'); // hold trackers until an explicit choice
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
