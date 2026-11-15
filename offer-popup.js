// offer-popup.js — the free-tee claim, on every page that matters.
//
// 2026-11-15: phone first, email optional. A claim with a number or an email
// is a LEAD in the OS ("Free tee claim"), not a newsletter signup: five went
// unanswered in November because they were filed as signups. It fires the
// custom Meta event FreeTeeClaim, never Lead (Lead is a quote request).
//
// Was inline in index.html and nowhere else, so it only ever ran on the
// homepage: 33 captures in five months, not because it converted badly but
// because almost nobody was shown it. The Meta ads point at the landing
// pages, and those had no capture at all.
//
// Self-contained on purpose: injects its own CSS and markup so a page only
// has to include the script. Copy comes from lang.js (data-i18n) and can be
// overridden by the CRM promo row (data-promo), exactly as the inline
// version did — this is a move, not a rewrite of the wiring.
//
// Trigger is the earliest of: dwell, half-page scroll, or exit intent.
// On /quote it is exit-intent only — someone mid-build must never have a
// modal thrown over the form they are filling in.
//
// Opt out per page with <body data-no-offer-popup>.

(function () {
  'use strict';

  var PROMO_SLUG   = 'free-tee-15-units';
  var INBOUND_API  = 'https://singhsprint-crm.vercel.app/api/inbound';
  var DWELL_MS     = 7000;    // was 15s — longer than a lot of visits lasted
  var SCROLL_PCT   = 0.5;
  var DISMISS_DAYS = 7;

  var path      = location.pathname.replace(/\/+$/, '') || '/';
  var isQuote   = /\/quote$/.test(path) || /\/quote\.html$/.test(path);
  var isFr      = path.indexOf('/fr/') === 0 || path === '/fr';
  var quoteHref = (isFr ? '/fr/quote' : '/quote') + '?promo=' + encodeURIComponent(PROMO_SLUG);

  if (document.body && document.body.hasAttribute('data-no-offer-popup')) return;

  // ---- dismissal -----------------------------------------------------
  function dismissed() {
    try {
      if (sessionStorage.getItem('popupClosed')) return true;
      var t = parseInt(localStorage.getItem('sp_popup_dismissed_at') || '0', 10);
      return !!t && (Date.now() - t) < DISMISS_DAYS * 24 * 3600 * 1000;
    } catch (_) { return false; }
  }
  // Already gave us an address this session? Then there is nothing to ask for.
  function alreadyCaptured() {
    try { return !!(sessionStorage.getItem('sp_lead_email') || sessionStorage.getItem('sp_lead_phone')); } catch (_) { return false; }
  }

  if (dismissed() || alreadyCaptured()) return;

  // ---- styles --------------------------------------------------------
  var CSS = ''
    + '.sp-op-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147482000;display:none;align-items:center;justify-content:center;padding:24px}'
    + '.sp-op-overlay.show{display:flex}'
    + '.sp-op{background:#fff;color:#1a1a1a;border-radius:20px;max-width:480px;width:100%;padding:44px 36px;text-align:center;position:relative;font-family:Inter,-apple-system,system-ui,sans-serif;box-shadow:0 24px 60px rgba(0,0,0,.3)}'
    + '.sp-op-close{position:absolute;top:14px;right:14px;font-size:1.5rem;color:#aaa;cursor:pointer;background:none;border:none;line-height:1;padding:4px 8px}'
    + '.sp-op h3{font-family:"Playfair Display",Georgia,serif;font-size:1.7rem;font-weight:800;margin:0 0 8px;line-height:1.2}'
    + '.sp-op p{color:#666;font-size:.95rem;margin:0 0 22px;line-height:1.5}'
    + '.sp-op input{width:100%;padding:14px 16px;border:1.5px solid #e0e0e0;border-radius:12px;font-size:1rem;margin-bottom:12px;font-family:inherit;box-sizing:border-box}'
    + '.sp-op input:focus{outline:none;border-color:#1a1a1a}'
    + '.sp-op-cta{display:block;width:100%;text-align:center;padding:15px 24px;font-size:1.02rem;font-weight:700;border:none;border-radius:12px;background:#e8ff3c;color:#1a1a1a;cursor:pointer;font-family:inherit}'
    + '.sp-op-optin{display:flex;gap:10px;align-items:flex-start;text-align:left;font-size:.8rem;line-height:1.4;color:#555;margin:0 0 12px;cursor:pointer}'
    + '.sp-op-optin input{width:18px;height:18px;margin:1px 0 0;padding:0;flex:none;accent-color:#1a1a1a}'
    + '.sp-op-optin[hidden]{display:none}'
    + '.sp-op p.sp-op-fine{font-size:.72rem;color:#888;margin:-6px 0 12px;text-align:left;line-height:1.4}'
    + '.sp-op-err{font-size:.8rem;color:#c0392b;margin:-6px 0 10px;text-align:left}'
    + '.sp-op-err:empty{display:none}'
    + '.sp-op-skip{display:block;margin:12px auto 0;font-size:.85rem;color:#aaa;cursor:pointer;background:none;border:none;font-family:inherit}'
    + '@media(max-width:520px){.sp-op{padding:36px 22px}.sp-op h3{font-size:1.42rem}}';

  // ---- markup --------------------------------------------------------
  var overlay;
  function build() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    overlay = document.createElement('div');
    overlay.className = 'sp-op-overlay';
    overlay.id = 'popup';                       // keep the old id: closePopup() and any
    overlay.setAttribute('role', 'dialog');     // existing selectors still resolve
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
        '<div class="sp-op">'
      +   '<button class="sp-op-close" type="button" aria-label="Close">&times;</button>'
      +   '<h3 data-i18n="home.popup.h3" data-promo="popup-h3">Get a free tee on orders of 15+</h3>'
      +   '<p data-i18n="home.popup.p">Leave your number and we&#39;ll lock it to your quote. Orders of 15+, same design.</p>'
      +   '<form class="sp-op-form" novalidate>'
      +     '<input type="tel" name="phone" placeholder="Mobile number" data-i18n-placeholder="home.popup.phone" aria-label="Mobile number" required maxlength="40" autocomplete="tel" inputmode="tel">'
      +     '<input type="email" name="email" placeholder="Email (optional)" data-i18n-placeholder="home.popup.emailopt" aria-label="Email (optional)" maxlength="200" autocomplete="email">'
      +     '<div class="sp-op-err" role="alert"></div>'
      +     '<label class="sp-op-optin"><input type="checkbox" name="deals_optin"><span data-i18n="home.popup.optin">Yes, send me deals from Singhs Print.</span></label>'
      +     '<p class="sp-op-fine" data-i18n="home.popup.fine">A few messages a month. Reply STOP or unsubscribe anytime.</p>'
      +     '<button type="submit" class="sp-op-cta" data-i18n="home.popup.cta" data-sp-track="popup_submit_lead">Claim my free tee &rarr;</button>'
      +   '</form>'
      +   '<button class="sp-op-skip" type="button" data-i18n="home.popup.skip">Maybe later</button>'
      + '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.sp-op-close').addEventListener('click', close);
    overlay.querySelector('.sp-op-skip').addEventListener('click', skip);
    overlay.querySelector('.sp-op-form').addEventListener('submit', submit);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('show')) close();
    });

    // Paint the slots this markup owns. It is injected after both lang.js
    // and promo.js have already swept the document, so neither would touch
    // it on its own: lang.js exposes applyLang(), and promo.js only re-runs
    // on the sp-lang-change event, which is the handle it gives us.
    try { if (window.SP_LANG && window.SP_LANG.applyLang) window.SP_LANG.applyLang(); } catch (_) {}
    try { document.dispatchEvent(new CustomEvent('sp-lang-change', {
      detail: { lang: (window.SP_LANG && window.SP_LANG.getLang) ? window.SP_LANG.getLang() : 'en' }
    })); } catch (_) {}
  }

  function show() {
    if (!overlay || overlay.classList.contains('show') || dismissed()) return;
    overlay.classList.add('show');
    var i = overlay.querySelector('input[name="phone"]');
    if (i && window.matchMedia && window.matchMedia('(min-width:768px)').matches) i.focus();
    if (typeof window.spTrack === 'function') {
      window.spTrack('popup_shown', { promo_slug: PROMO_SLUG, path: path });
    }
  }

  function close() {
    if (overlay) overlay.classList.remove('show');
    try {
      sessionStorage.setItem('popupClosed', '1');
      localStorage.setItem('sp_popup_dismissed_at', String(Date.now()));
    } catch (_) {}
  }

  // "Maybe later" still attaches the promo, so a visitor who comes back to
  // the quote builder on their own is not silently dropped out of the offer.
  function skip() {
    try { sessionStorage.setItem('sp_promo_slug', PROMO_SLUG); } catch (_) {}
    close();
  }

  function submit(e) {
    e.preventDefault();
    var form  = e.target;
    var err   = form.querySelector('.sp-op-err');
    var phone = ((form.querySelector('input[name="phone"]') || {}).value || '').trim();
    var email = ((form.querySelector('input[name="email"]') || {}).value || '').trim();
    var digits = phone.replace(/\D/g, '');
    var phoneOk = digits.length >= 10 && digits.length <= 15;
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    // The number is what we ask for. Someone who would rather give an email
    // can: one of the two is enough to claim it.
    if (!phoneOk && !emailOk) {
      if (err) err.textContent = isFr ? 'Ajoutez un numéro de cellulaire (ou un courriel).' : 'Add a mobile number (or an email).';
      var first = form.querySelector('input[name="phone"]'); if (first) first.focus();
      return;
    }
    if (email && !emailOk) {
      if (err) err.textContent = isFr ? 'Ce courriel ne semble pas complet.' : 'That email looks incomplete.';
      return;
    }
    if (err) err.textContent = '';
    if (!phoneOk) phone = '';
    var deals      = !!(form.querySelector('input[name="deals_optin"]') || {}).checked;
    var emailOptin = deals && emailOk;
    var smsOptin   = deals && phoneOk;
    try {
      if (emailOk) sessionStorage.setItem('sp_lead_email', email);
      if (phoneOk) sessionStorage.setItem('sp_lead_phone', phone);
      sessionStorage.setItem('sp_promo_slug', PROMO_SLUG);
    } catch (_) {}
    // Meta: a claim is FreeTeeClaim, never Lead. Pixel and server copy share
    // one event id so Meta counts it once.
    try {
      var claimId = (window.SP_META && window.SP_META.newEventId) ? window.SP_META.newEventId() : ('ftc-' + Date.now());
      var claimData = { content_name: 'Free tee claim', promo_slug: PROMO_SLUG };
      if (typeof window.fbq === 'function') window.fbq('trackCustom', 'FreeTeeClaim', claimData, { eventID: claimId });
      if (window.SP_META && window.SP_META.send) window.SP_META.send('FreeTeeClaim', claimId, claimData);
    } catch (_) {}
    try {
      fetch(INBOUND_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'other',
          email: emailOk ? email : null,
          phone: phone || null,
          notes: 'Popup capture — visitor opted into the free-tee offer (15+).',
          cart_items: [],
          size_breakdown: {},
          meta: {
            popup_capture: true,
            promo_slug:    PROMO_SLUG,
            // Which page the capture came from now matters — this used to be
            // homepage-only, so a single constant told you nothing.
            source:        'offer_popup',
            source_path:   path
          },
          source_url: location.href
        }),
        keepalive: true
      }).catch(function () {});
    } catch (_) {}
    // Mailing list: only what they ticked. The free tee never depends on it.
    if ((emailOptin || smsOptin) && window.SP_MAILING) {
      window.SP_MAILING.subscribe({
        source: 'popup',
        email: emailOptin ? email : null,
        phone: smsOptin ? phone : null,
        email_optin: emailOptin,
        sms_optin: smsOptin
      });
    }
    if (typeof window.spTrack === 'function') {
      window.spTrack('popup_submit', { promo_slug: PROMO_SLUG, path: path, email_optin: emailOptin, sms_optin: smsOptin });
    }
    try { sessionStorage.setItem('popupClosed', '1'); } catch (_) {}

    // On /quote they are already where the CTA would send them. Navigating
    // would throw away a part-built cart, so just close and let them carry on.
    if (isQuote) {
      close();
      var banner = document.getElementById('promoApplied');
      if (banner) banner.setAttribute('data-promo-armed', '1');
      if (typeof window.updateCartTotal === 'function') { try { window.updateCartTotal(); } catch (_) {} }
      return;
    }
    window.location.href = quoteHref;
  }

  // ---- triggers ------------------------------------------------------
  function arm() {
    build();
    var fired = false;
    // Someone with a product open, or with pieces already in the cart, is
    // mid-build exactly as much as someone on /quote — and /quote is
    // exit-intent only for that reason. Measured on production 2026-10-17:
    // the 7s dwell fired over an open product modal on the fourth add of a
    // five-piece order, and the customer had to find "Maybe later" before
    // they could press "Add to quote". So: with a product modal open, the
    // dwell and scroll triggers wait and try again; with anything in the
    // cart, they stand down and only exit intent remains.
    function midBuild() {
      try {
        var m = document.getElementById('detailModal');
        if (m && m.classList.contains('open')) return 'modal';
        var c = JSON.parse(sessionStorage.getItem('singhsCart_v1') || '{"items":[]}');
        if (c && c.items && c.items.length) return 'cart';
      } catch (_) {}
      return '';
    }
    function fire(viaExit) {
      if (fired) return;
      if (!viaExit) {
        var why = midBuild();
        if (why === 'cart') { teardownSoft(); return; }
        if (why === 'modal') { if (timer) clearTimeout(timer); timer = setTimeout(fire, DWELL_MS); return; }
      }
      fired = true; teardown(); show();
    }

    var timer = null;
    function onScroll() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      if (h > 0 && (window.scrollY / h) >= SCROLL_PCT) fire();
    }
    function onExit(e) { if (e.clientY <= 0) fire(true); }
    function teardown() {
      teardownSoft();
      document.removeEventListener('mouseout', onExit);
    }
    // Drop dwell and scroll, keep exit intent.
    function teardownSoft() {
      if (timer) clearTimeout(timer);
      timer = null;
      window.removeEventListener('scroll', onScroll);
    }

    // Exit intent everywhere it exists; on /quote it is the ONLY trigger.
    document.addEventListener('mouseout', onExit);
    if (!isQuote) {
      timer = setTimeout(fire, DWELL_MS);
      window.addEventListener('scroll', onScroll, { passive: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm);
  } else {
    arm();
  }
})();
