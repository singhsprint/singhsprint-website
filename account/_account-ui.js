/* =========================================================================
 * /account/_account-ui.js — shared chrome + helpers for the customer portal
 *
 * Loaded by every /account/* page. Responsibilities:
 *
 *   1. Inject a single <style> block with unified card / empty-state /
 *      sub-nav styles. Each page kept its own page-specific CSS; this only
 *      adds the cross-page primitives so the portal feels consistent.
 *
 *   2. Render the inline sub-nav into <div id="acct-subnav"></div>, with
 *      the current page underlined in lime. If the placeholder isn't on
 *      the page (e.g. signin), this is a no-op.
 *
 *   3. Expose window.acctUI with small helpers used by the page scripts:
 *        - fmtMoney(cents, locale?)
 *        - fmtDate(dateLike, opts?)   "May 19, 2026"
 *        - shareReferral({ url, text }) — Web Share API, fallback to
 *          clipboard + toast.
 *        - emptyState({ icon, title, body, ctaHref, ctaLabel })
 *        - toast(msg) — small bottom-center pill
 *
 * IMPORTANT: bilingual via document.documentElement.lang OR /fr/ prefix.
 * Strings are English-first; FR equivalents are passed through lang.js
 * data-i18n where the markup is static, and provided in-line here for the
 * dynamically-rendered bits.
 * ========================================================================= */

(function () {
  'use strict';

  // Path-based locale detection mirrors components.js.
  var IS_FR = /^\/fr(\/|$)/.test(window.location.pathname);
  var BASE  = IS_FR ? '/fr' : '';
  function t(en, fr) { return IS_FR ? fr : en; }

  // -----------------------------------------------------------------------
  // 1. Shared CSS (one <style> block, deduped)
  // -----------------------------------------------------------------------
  if (!document.getElementById('acct-ui-styles')) {
    var s = document.createElement('style');
    s.id = 'acct-ui-styles';
    s.textContent = [
      // Sub-nav — small text links above the page title.
      '.acct-subnav{display:flex;flex-wrap:wrap;align-items:center;gap:4px 0;margin:6px 0 22px;font-size:.86rem;color:#888;font-weight:600}',
      '.acct-subnav a{color:#888;text-decoration:none;padding:6px 10px;border-radius:8px;transition:color .12s,background .12s;position:relative}',
      '.acct-subnav a:hover{color:#1a1a1a;background:#f4f2eb}',
      '.acct-subnav a.is-active{color:#1a1a1a}',
      '.acct-subnav a.is-active::after{content:"";position:absolute;left:10px;right:10px;bottom:2px;height:2px;background:#e8ff3c;border-radius:2px}',
      '.acct-subnav .sep{color:#ddd;user-select:none;padding:0 2px}',
      // Unified card primitives. Pages can compose: .acct-card for the
      // surface, .acct-card--accent for the lime variant.
      '.acct-card{background:#fff;border:1px solid #e9e7df;border-radius:18px;padding:22px;box-shadow:0 2px 10px rgba(0,0,0,.03);transition:transform .12s,border-color .15s}',
      'a.acct-card,button.acct-card{color:inherit;text-decoration:none;display:block;width:100%;text-align:left;font-family:inherit;cursor:pointer}',
      'a.acct-card:hover,button.acct-card:hover{border-color:#1a1a1a;transform:translateY(-1px)}',
      '.acct-card--accent{background:#e8ff3c;border-color:#1a1a1a}',
      '.acct-card--accent .acct-stat__label,.acct-card--accent .acct-stat__sub{color:#1a1a1a;opacity:.7}',
      // Stat tile internals.
      '.acct-stat__label{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:#888;font-weight:700;margin-bottom:10px}',
      '.acct-stat__value{font-family:"Playfair Display",Georgia,serif;font-size:2rem;font-weight:800;line-height:1;color:#1a1a1a;margin-bottom:6px}',
      '.acct-stat__sub{font-size:.78rem;color:#888;line-height:1.4}',
      '.acct-stat__row{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:4px}',
      '.acct-stat__row .pip{display:inline-flex;align-items:center;gap:4px;font-size:.74rem;color:#1a1a1a;background:rgba(26,26,26,.06);padding:3px 8px;border-radius:50px;font-weight:700}',
      '.acct-card--accent .acct-stat__row .pip{background:rgba(26,26,26,.18);color:#1a1a1a}',
      // Empty states with a small SVG illustration on the left.
      '.acct-empty{display:flex;gap:18px;align-items:center;padding:28px 24px;background:#fff;border:1px dashed #d8d6cb;border-radius:18px}',
      '.acct-empty__icon{flex:0 0 56px;width:56px;height:56px;display:flex;align-items:center;justify-content:center;background:#f4f2eb;border-radius:14px;color:#666}',
      '.acct-empty__icon svg{width:30px;height:30px}',
      '.acct-empty__body{flex:1;min-width:0}',
      '.acct-empty__title{font-weight:700;color:#1a1a1a;margin-bottom:4px}',
      '.acct-empty__text{font-size:.88rem;color:#666;margin-bottom:10px}',
      '.acct-empty__cta{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;background:#1a1a1a;color:#fff;border-radius:10px;font-weight:700;font-size:.85rem;text-decoration:none;transition:opacity .15s,box-shadow .15s}',
      '.acct-empty__cta:hover{opacity:.92;box-shadow:0 4px 14px rgba(232,255,60,.5)}',
      // Toast.
      '.acct-toast{position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(20px);background:#1a1a1a;color:#fff;padding:10px 18px;border-radius:50px;font-size:.86rem;font-weight:600;opacity:0;pointer-events:none;z-index:9999;transition:opacity .2s,transform .2s;box-shadow:0 10px 30px rgba(0,0,0,.2)}',
      '.acct-toast.is-show{opacity:1;transform:translateX(-50%) translateY(0)}',
      // Inline editable field.
      '.acct-editable{display:flex;align-items:center;gap:8px}',
      '.acct-editable input{flex:1;min-width:0;padding:8px 12px;border:1px solid #e0ddd1;border-radius:10px;font-family:inherit;font-size:.95rem;outline:none}',
      '.acct-editable input:focus{border-color:#1a1a1a}',
      '.acct-editable__pencil{background:none;border:none;cursor:pointer;color:#888;font-size:.78rem;font-weight:700;padding:4px 8px;border-radius:6px}',
      '.acct-editable__pencil:hover{color:#1a1a1a;background:#f4f2eb}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // -----------------------------------------------------------------------
  // 2. Sub-nav — render into #acct-subnav (if present on this page)
  // -----------------------------------------------------------------------
  function renderSubnav() {
    var el = document.getElementById('acct-subnav');
    if (!el) return;
    var here = window.location.pathname.replace(/\/$/, '').toLowerCase();
    // Normalize /account → /account/ for matching against link paths.
    if (here === '' || here === BASE) here = BASE + '/account';
    var links = [
      { href: BASE + '/account/',             en: 'Dashboard',   fr: 'Tableau de bord', match: /\/account\/?$|\/account\/index/ },
      { href: BASE + '/account/orders.html',  en: 'Orders',      fr: 'Commandes',       match: /orders/ },
      { href: BASE + '/account/referrals.html', en: 'Referrals', fr: 'Parrainages',     match: /referrals/ },
      { href: BASE + '/account/business.html', en: 'Business',   fr: 'Entreprise',      match: /business/ },
      { href: BASE + '/account/programs.html', en: 'Programs',   fr: 'Programmes',      match: /programs/ },
      { href: BASE + '/account/settings.html', en: 'Settings',   fr: 'Paramètres',      match: /settings/ }
    ];
    var html = links.map(function (l, i) {
      var isActive = l.match.test(here);
      var sep = i > 0 ? '<span class="sep">·</span>' : '';
      return sep
        + '<a class="' + (isActive ? 'is-active' : '') + '" href="' + l.href + '">'
        + t(l.en, l.fr)
        + '</a>';
    }).join('');
    el.className = 'acct-subnav';
    el.innerHTML = html;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSubnav);
  } else {
    renderSubnav();
  }

  // -----------------------------------------------------------------------
  // 3. Helpers — exposed on window.acctUI
  // -----------------------------------------------------------------------
  function fmtMoney(cents, locale) {
    return new Intl.NumberFormat(locale || (IS_FR ? 'fr-CA' : 'en-CA'),
      { style: 'currency', currency: 'CAD' }
    ).format((cents || 0) / 100);
  }

  function fmtDate(dateLike, opts) {
    var d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(
      IS_FR ? 'fr-CA' : 'en-CA',
      opts || { year: 'numeric', month: 'long', day: 'numeric' }
    );
  }

  function toast(msg, ms) {
    var el = document.createElement('div');
    el.className = 'acct-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    // Force layout then add the show class so the transition fires.
    el.offsetWidth;
    el.classList.add('is-show');
    setTimeout(function () {
      el.classList.remove('is-show');
      setTimeout(function () { el.remove(); }, 250);
    }, ms || 1800);
  }

  async function shareReferral(opts) {
    opts = opts || {};
    var url   = opts.url   || window.location.href;
    var title = opts.title || t('Singhs Print', 'Singhs Print');
    var text  = opts.text  || t(
      'Use my code for $25 off your first order at Singhs Print:',
      'Utilise mon code pour 25 $ de rabais sur ta première commande chez Singhs Print :'
    );
    // Web Share API first (works on iOS/Android and most modern desktop
    // browsers). If declined or unavailable, fall back to clipboard.
    if (navigator.share) {
      try {
        await navigator.share({ title: title, text: text, url: url });
        return { method: 'native' };
      } catch (e) {
        // User cancelled — don't fall back, just exit silently.
        if (e && e.name === 'AbortError') return { method: 'cancelled' };
      }
    }
    try {
      await navigator.clipboard.writeText(text + ' ' + url);
      toast(t('Link copied — paste it anywhere!', 'Lien copié — colle-le partout !'));
      return { method: 'clipboard' };
    } catch (e) {
      toast(t('Could not copy — long-press to share', 'Copie impossible — appuie long pour partager'));
      return { method: 'failed' };
    }
  }

  // Empty-state SVG icons (kept here so pages don't need to embed SVGs).
  var ICONS = {
    quote:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
    box:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
    sparkle:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/></svg>',
    invoice:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>'
  };

  function emptyState(opts) {
    opts = opts || {};
    var icon = ICONS[opts.icon] || ICONS.box;
    var cta = '';
    if (opts.ctaHref && opts.ctaLabel) {
      cta = '<a class="acct-empty__cta" href="' + opts.ctaHref + '">' + opts.ctaLabel + ' →</a>';
    }
    return ''
      + '<div class="acct-empty">'
      + '  <div class="acct-empty__icon">' + icon + '</div>'
      + '  <div class="acct-empty__body">'
      + '    <div class="acct-empty__title">' + (opts.title || '') + '</div>'
      + '    <div class="acct-empty__text">' + (opts.body  || '') + '</div>'
      + '    ' + cta
      + '  </div>'
      + '</div>';
  }

  window.acctUI = {
    fmtMoney:      fmtMoney,
    fmtDate:       fmtDate,
    toast:         toast,
    shareReferral: shareReferral,
    emptyState:    emptyState,
    isFr:          IS_FR,
    t:             t
  };
})();
