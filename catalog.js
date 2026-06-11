// Extracted from catalog.html (was the main inline <script> block). Loaded with
// defer; shared by the EN page and its /fr/ mirror so it is parsed from cache.
// =========================================================================
  // Catalog state
  // =========================================================================
  // =========================================================================
  // Cart — shared with quote.html via sessionStorage. Items live for the
  // browser session (cleared on tab close). Multi-item quotes use this;
  // single-product ?product= URLs still work the old way for backwards
  // compatibility — the cart just stays empty.
  // =========================================================================
  // Cart abandonment recovery: a stable cart_id lives in localStorage so
  // the same browser keeps the same row across tab closes. After every
  // SinghsCart mutation we debounce-sync to /api/carts/upsert. If a
  // visitor enters their email on /quote and doesn't submit, the daily
  // sweeper emails them a recovery link.
  function getCartId() {
    var k = 'singhsCartId_v1';
    var existing = null;
    try { existing = localStorage.getItem(k); } catch(e){}
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    var id = '';
    try {
      if (window.crypto && crypto.randomUUID) id = crypto.randomUUID().replace(/-/g, '');
    } catch(e){}
    if (!id) id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    try { localStorage.setItem(k, id); } catch(e){}
    return id;
  }
  let SINGHS_CART_ID = getCartId();

  // Recovery-email link handling: when the URL has ?cart=<id>, hydrate
  // sessionStorage from /api/carts/<id> + adopt that cart_id as ours so
  // subsequent syncs target the same row. The query string is stripped
  // afterwards so reloads / bookmarks don't keep re-triggering it.
  (function hydrateFromRecoveryLink() {
    try {
      const params = new URLSearchParams(location.search);
      const recoverId = params.get('cart');
      if (!recoverId || !/^[a-zA-Z0-9_-]{8,64}$/.test(recoverId)) return;
      // Don't re-hydrate if we already restored this cart.
      if (sessionStorage.getItem('singhsCartHydrated') === recoverId) return;
      fetch('https://singhsprint-crm.vercel.app/api/carts/' + encodeURIComponent(recoverId))
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && Array.isArray(d.items) && d.items.length > 0) {
            sessionStorage.setItem('singhsCart_v1', JSON.stringify({ items: d.items }));
            sessionStorage.setItem('singhsCartHydrated', recoverId);
            localStorage.setItem('singhsCartId_v1', recoverId);
            SINGHS_CART_ID = recoverId;
            // Strip ?cart=... so reloads don't re-fire this path.
            params.delete('cart');
            const q = params.toString();
            history.replaceState({}, '', location.pathname + (q ? '?' + q : '') + location.hash);
            renderCartBar();
            // Subtle toast so they know their cart came back.
            showCartToast({ brand: '✓ Cart restored', style_number: '— ' + d.items.length + ' item' + (d.items.length === 1 ? '' : 's') });
          }
        })
        .catch(function(){});
    } catch(e) {}
  })();
  let _cartSyncTimer = null;
  function queueCartSync() {
    if (_cartSyncTimer) clearTimeout(_cartSyncTimer);
    _cartSyncTimer = setTimeout(function () {
      try {
        var c = JSON.parse(sessionStorage.getItem('singhsCart_v1') || '{"items":[]}');
        fetch('https://singhsprint-crm.vercel.app/api/carts/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cart_id: SINGHS_CART_ID, items: c.items || [], source_url: location.href }),
          keepalive: true,
        }).catch(function(){});
      } catch(e){}
    }, 800);
  }

  // Pick the most natural default placement for a freshly-added cart
  // item. Mirrors the (more elaborate) PLACEMENT_GROUPS_BY_GARMENT map in
  // quote.html, but we only need the FIRST option per garment here — the
  // quote page lets the customer add more.
  function _defaultPlacementForGarment(g) {
    const M = {
      hat: 'cap-front',
      tote: 'bag-front',
      joggers: 'leg-left-hip',
      shorts: 'leg-left-hip',
      scrub_pants: 'leg-left-hip',
      apron: 'apron-chest',
      vest: 'center-chest',
      hivis: 'center-chest',
      coverall: 'left-chest',
      chef_coat: 'left-chest',
      scrub_top: 'left-chest',
      lab_coat: 'left-chest',
      polo: 'left-chest',
      workshirt: 'left-chest',
      performance_shirt: 'left-chest'
    };
    return M[g] || 'center-chest';
  }

  const SinghsCart = {
    key: 'singhsCart_v1',
    read() { try { return JSON.parse(sessionStorage.getItem(this.key) || '{"items":[]}'); } catch(e){ return {items:[]}; } },
    write(c) { try { sessionStorage.setItem(this.key, JSON.stringify(c)); } catch(e){} renderCartBar(); queueCartSync(); try { window.dispatchEvent(new Event('singhsCartChange')); } catch(e){} },
    add(item) {
      const c = this.read();
      // Default placements/sides on add — garment-aware so a cap defaults
      // to ['cap-front'] not ['center-chest']. The /quote page lets the
      // customer edit per-item from there.
      if (!Array.isArray(item.placements) || item.placements.length === 0) {
        item.placements = [_defaultPlacementForGarment(item.garment_type)];
      }
      item.sides = item.placements.length;
      const dup = c.items.find(x => x.product_id === item.product_id && x.color_id === item.color_id);
      if (dup) dup.qty = (dup.qty || 0) + (item.qty || 0);
      else c.items.push(item);
      this.write(c);
    },
    count() { return this.read().items.length; },
    totalUnits() { return this.read().items.reduce((s, i) => s + (Number(i.qty) || 0), 0); },
  };

  function renderCartBar() {
    const bar = document.getElementById('cartBar');
    if (!bar) return;
    const n = SinghsCart.count();
    if (n === 0) { bar.classList.remove('open'); return; }
    bar.classList.add('open');
    document.getElementById('cartCount').textContent = n;
    document.getElementById('cartUnits').textContent = SinghsCart.totalUnits();
  }

  function showCartToast(item) {
    const t = document.getElementById('cartToast');
    if (!t) return;
    const _t = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
    t.innerHTML = '<strong>' + (_t('cat.toast.added') || '✓ Added to quote') + '</strong> · ' + (item.brand || '') + ' ' + (item.style_number || '');
    t.classList.add('show');
    clearTimeout(showCartToast._tid);
    showCartToast._tid = setTimeout(function(){ t.classList.remove('show'); }, 1800);
  }

  function goToQuote() { window.location.href = '/quote'; }

  // 2026-05-24 — Cart-bar touch fallback + tap-feedback animation.
  //
  // Touch fallback: the entire pill (`#cartBar`) is an <a href="/quote">,
  // but iOS Safari can still drop the native click when the anchor sits
  // inside a position:fixed container that just transitioned
  // (display:none → display:flex via the `.open` class). The touchend
  // handler is the safety net — explicitly preventDefault any iOS
  // touch heuristic and force-navigate. Idempotent with native click.
  //
  // Tap feedback: on pointerdown we add `.is-tapped` so the CSS
  // keyframe (yellow ring + count-badge pop + arrow glide) plays.
  // We start it on pointerdown rather than click so the animation
  // begins THE INSTANT the user touches — by the time the browser
  // navigates, the user has already seen the response. The class is
  // auto-removed after 500ms so re-taps re-trigger cleanly.
  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.getElementById('cartBar');
    if (!bar) return;

    function flashTap() {
      bar.classList.remove('is-tapped');
      // Force a reflow so re-adding the class restarts the animation
      // even if a previous one is still playing.
      void bar.offsetWidth;
      bar.classList.add('is-tapped');
      clearTimeout(flashTap._tid);
      flashTap._tid = setTimeout(function () {
        bar.classList.remove('is-tapped');
      }, 500);
    }

    // Pointerdown fires immediately on touch OR mouse-down — earliest
    // possible visual ack. addEventListener so it composes with the
    // native :active pseudo-class without conflict.
    bar.addEventListener('pointerdown', flashTap);

    // Touch fallback nav for iOS edge case (see comment above).
    bar.addEventListener('touchend', function (ev) {
      if (ev.cancelable) ev.preventDefault();
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
      try { window.location.assign(bar.getAttribute('href') || '/quote'); }
      catch (e) { window.location.href = '/quote'; }
    }, { passive: false });
  });

  // =====================================================================
  // Product detail modal — opened by the "View details ↗" link on each
  // card. Shows the full color grid (sized swatches + names), per-color
  // sizes_in_stock, weight, garment type, and lets the customer add to
  // cart in their picked color without leaving the catalog view.
  // =====================================================================
  let _detailProduct = null;
  let _detailColorIdx = 0;
  let _detailGalleryIdx = 0;  // 0=front, 1=back, 2=side (only views with a URL render)
  // S&S sends product descriptions as a single HTML <ul>. Parse into clean
  // text bullets so we can render them in our own style (no foreign HTML
  // injection, no <ul>-inside-modal weirdness, no &amp; / &nbsp; artifacts).
  function parseSpecBullets(descHtml) {
    if (!descHtml || typeof descHtml !== 'string') return [];
    const tmp = document.createElement('div');
    tmp.innerHTML = descHtml;
    const lis = tmp.querySelectorAll('li');
    return Array.from(lis).map(li => (li.textContent || '').trim()).filter(Boolean);
  }
  // =====================================================================
  // IN-MODAL PRODUCT CUSTOMIZER
  // ---------------------------------------------------------------------
  // Lets the customer pick a print method, choose placements, upload
  // artwork per placement and see a live all-in price BEFORE adding to
  // the quote. Lookup tables (DMCZ_*) are copied verbatim from quote.html
  // (placementPresets / PLACEMENT_GROUPS_BY_GARMENT + helpers) so the cart
  // item shape matches exactly what /quote and the CRM expect.
  // =====================================================================
  var DMCZ_placementPresets = {
    'left-chest':   { loc: 'front',        size: 'left-chest',  cx: 0.38, cy: 0.32, label: 'Left Chest',        desc: '~3-4" — logo / pocket', sil:'shirt-front', rect:{x:11,y:14,w:6, h:5}  },
    'center-chest': { loc: 'front',        size: 'medium',      cx: 0.50, cy: 0.40, label: 'Center Chest',      desc: '~7" mid-chest',         sil:'shirt-front', rect:{x:14,y:17,w:14,h:10} },
    'full-front':   { loc: 'front',        size: 'large',       cx: 0.50, cy: 0.50, label: 'Full Front',        desc: '~11" chest panel',      sil:'shirt-front', rect:{x:11,y:14,w:20,h:18} },
    'oversized':    { loc: 'front',        size: 'xl',          cx: 0.50, cy: 0.58, label: 'Oversized Front',   desc: '~14" chest to waist',   sil:'shirt-front', rect:{x:9, y:12,w:24,h:28} },
    'back-top':     { loc: 'back',         size: 'small',       cx: 0.50, cy: 0.22, label: 'Top Back',          desc: 'Under collar, ~5"',     sil:'shirt-back',  rect:{x:15,y:10,w:12,h:5}  },
    'back-across':  { loc: 'back',         size: 'large',       cx: 0.50, cy: 0.42, label: 'Across Back',       desc: '~12" upper back',       sil:'shirt-back',  rect:{x:11,y:15,w:20,h:16} },
    'back-full':    { loc: 'back',         size: 'xl',          cx: 0.50, cy: 0.55, label: 'Full Back',         desc: '~14" full panel',       sil:'shirt-back',  rect:{x:9, y:12,w:24,h:28} },
    'left-sleeve':  { loc: 'left-sleeve',  size: 'left-chest',  cx: 0.22, cy: 0.32, label: 'Left Sleeve',       desc: 'Bicep, small hit',      sil:'shirt-front', rect:{x:3, y:13,w:4, h:5}  },
    'right-sleeve': { loc: 'right-sleeve', size: 'right-chest', cx: 0.78, cy: 0.32, label: 'Right Sleeve',      desc: 'Bicep, small hit',      sil:'shirt-front', rect:{x:35,y:13,w:4, h:5}  },
    'hood':         { loc: 'front',        size: 'small',       cx: 0.50, cy: 0.12, label: 'Hood',              desc: 'On the hood itself',    sil:'hoodie',      rect:{x:17,y:1, w:8, h:4}  },
    'cap-front':       { loc: 'front', size: 'medium',      cx: 0.50, cy: 0.45, label: 'Cap Front',        desc: 'Front panel, ~3"',     sil:'cap', rect:{x:16,y:18,w:10,h:7} },
    'cap-left-side':   { loc: 'front', size: 'left-chest',  cx: 0.20, cy: 0.45, label: 'Left Side Panel',  desc: 'Side hit, ~2"',        sil:'cap', rect:{x:6, y:22,w:6, h:5} },
    'cap-right-side':  { loc: 'front', size: 'right-chest', cx: 0.80, cy: 0.45, label: 'Right Side Panel', desc: 'Side hit, ~2"',        sil:'cap', rect:{x:30,y:22,w:6, h:5} },
    'cap-back':        { loc: 'back',  size: 'small',       cx: 0.50, cy: 0.45, label: 'Back Panel',       desc: 'Behind closure',       sil:'cap', rect:{x:18,y:25,w:6, h:4} },
    'cap-brim':        { loc: 'front', size: 'small',       cx: 0.50, cy: 0.85, label: 'Brim',             desc: 'Underside / top edge', sil:'cap', rect:{x:16,y:29,w:10,h:3} },
    'bag-front':       { loc: 'front', size: 'medium',      cx: 0.50, cy: 0.45, label: 'Front of Bag',  desc: 'Main panel print',     sil:'bag', rect:{x:13,y:22,w:16,h:14} },
    'bag-back':        { loc: 'back',  size: 'medium',      cx: 0.50, cy: 0.45, label: 'Back of Bag',   desc: 'Reverse panel',        sil:'bag', rect:{x:13,y:22,w:16,h:14} },
    'bag-pocket':      { loc: 'front', size: 'small',       cx: 0.50, cy: 0.65, label: 'Front Pocket',  desc: 'Small logo, ~3"',      sil:'bag', rect:{x:17,y:35,w:8, h:6}  },
    'leg-left-hip':    { loc: 'front', size: 'small',       cx: 0.35, cy: 0.20, label: 'Left Hip',      desc: 'Small logo at hip',    sil:'pants', rect:{x:13,y:9, w:6, h:4} },
    'leg-right-hip':   { loc: 'front', size: 'small',       cx: 0.65, cy: 0.20, label: 'Right Hip',     desc: 'Small logo at hip',    sil:'pants', rect:{x:23,y:9, w:6, h:4} },
    'leg-back-pocket': { loc: 'back',  size: 'small',       cx: 0.40, cy: 0.30, label: 'Back Pocket',   desc: 'Back-pocket logo',     sil:'pants', rect:{x:14,y:14,w:6, h:4} },
    'leg-side':        { loc: 'front', size: 'medium',      cx: 0.35, cy: 0.55, label: 'Leg Side',      desc: 'Vertical stripe',      sil:'pants', rect:{x:13,y:18,w:5, h:18} },
    'apron-chest':     { loc: 'front', size: 'medium',      cx: 0.50, cy: 0.20, label: 'Chest',         desc: 'Upper bib area',       sil:'apron', rect:{x:14,y:12,w:14,h:8}  },
    'apron-pocket':    { loc: 'front', size: 'small',       cx: 0.50, cy: 0.55, label: 'Pocket',        desc: 'On the front pocket',  sil:'apron', rect:{x:16,y:28,w:10,h:6}  },
    'apron-full':      { loc: 'front', size: 'large',       cx: 0.50, cy: 0.50, label: 'Full Front',    desc: 'Large front panel',    sil:'apron', rect:{x:12,y:16,w:18,h:22} }
  };

  var DMCZ_PLACEMENT_GROUPS_BY_GARMENT = {
    tshirt: [
      { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front', 'oversized'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    longsleeve: [
      { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front', 'oversized'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    polo: [
      { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    performance_shirt: [
      { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    workshirt: [
      { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    hivis: [
      { label: 'Front',   ids: ['left-chest', 'center-chest'] },
      { label: 'Back',    ids: ['back-across', 'back-full'] }
    ],
    hoodie: [
      { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front'] },
      { label: 'Hood',    ids: ['hood'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    crewneck: [
      { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front', 'oversized'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    sweater: [
      { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    cardigan: [
      { label: 'Front',   ids: ['left-chest'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    pullover_jacket: [
      { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    softshell: [
      { label: 'Front',   ids: ['left-chest', 'center-chest'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    chore_coat: [
      { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    vest: [
      { label: 'Front', ids: ['left-chest', 'center-chest', 'full-front'] },
      { label: 'Back',  ids: ['back-top', 'back-across', 'back-full'] }
    ],
    coverall: [
      { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front'] },
      { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] },
      { label: 'Leg',     ids: ['leg-left-hip', 'leg-right-hip'] }
    ],
    hat: [
      { label: 'Cap', ids: ['cap-front', 'cap-left-side', 'cap-right-side', 'cap-back', 'cap-brim'] }
    ],
    tote: [
      { label: 'Bag', ids: ['bag-front', 'bag-back', 'bag-pocket'] }
    ],
    joggers: [
      { label: 'Front', ids: ['leg-left-hip', 'leg-right-hip'] },
      { label: 'Back',  ids: ['leg-back-pocket'] },
      { label: 'Side',  ids: ['leg-side'] }
    ],
    shorts: [
      { label: 'Front', ids: ['leg-left-hip', 'leg-right-hip'] },
      { label: 'Back',  ids: ['leg-back-pocket'] }
    ],
    scrub_pants: [
      { label: 'Front', ids: ['leg-left-hip'] }
    ],
    chef_coat: [
      { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front'] },
      { label: 'Back',    ids: ['back-top', 'back-across'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    scrub_top: [
      { label: 'Front', ids: ['left-chest', 'center-chest'] },
      { label: 'Back',  ids: ['back-across'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    lab_coat: [
      { label: 'Front',   ids: ['left-chest', 'center-chest'] },
      { label: 'Back',    ids: ['back-top', 'back-across'] },
      { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] }
    ],
    apron: [
      { label: 'Apron', ids: ['apron-chest', 'apron-full', 'apron-pocket'] }
    ]
  };

  function dmczPlacementGroupsFor(garmentType) {
    return DMCZ_PLACEMENT_GROUPS_BY_GARMENT[garmentType] || DMCZ_PLACEMENT_GROUPS_BY_GARMENT.tshirt;
  }
  function dmczDefaultPlacementFor(garmentType) {
    var groups = dmczPlacementGroupsFor(garmentType);
    if (groups && groups.length && groups[0].ids && groups[0].ids.length) {
      return groups[0].ids[0];
    }
    return 'center-chest';
  }

  // Placements we hide/disallow when Embroidery is the chosen method —
  // these are too large for an embroidery hoop.
  var EMB_DISALLOWED = { 'oversized':1, 'back-full':1 };

  // Three customer-facing methods. Map onto the pricing API's
  // decoration_method: Embroidery → 'embroidery', everything else → 'dtf'.
  var DMCZ_METHODS = [
    { id: 'DTG',         name: 'DTG',         desc: 'Soft full-color print',  method: 'dtf' },
    { id: 'DTF',         name: 'DTF',         desc: 'Durable transfer print', method: 'dtf' },
    { id: 'Embroidery',  name: 'Embroidery',  desc: 'Stitched, premium',      method: 'embroidery' }
  ];
  function dmczMethodApi(id) {
    var m = DMCZ_METHODS.filter(function(x){ return x.id === id; })[0];
    return (m && m.method) || 'dtf';
  }

  // Live customizer state — reset every time the modal opens.
  // boxes: { placementId:{x,y,w} } (% of stage), removeBg: white-knockout blend,
  // activePreview: which placement the inline canvas is currently showing.
  var _dmczState = { method: 'DTF', placements: [], uploads: {}, priceSeq: 0, boxes: {}, removeBg: false, activePreview: null };

  // Initialize the customizer for the product the modal just opened on.
  // Reveal/hide the full customizer behind the yellow button. The modal opens
  // in a simple state (button collapsed); clicking expands method/placements/
  // artwork with a grid-rows animation.
  function dmczToggleCustomize() {
    var body = document.getElementById('dmczCustomizeBody');
    var btn = document.getElementById('dmczCustomizeToggle');
    if (!body || !btn) return;
    var open = body.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setTimeout(function(){ try { body.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {} }, 120);
  }

  // Collapse the customizer back to the simple state (called when a product
  // modal opens so every product starts simple).
  function dmczResetCustomizeToggle() {
    var body = document.getElementById('dmczCustomizeBody');
    var btn = document.getElementById('dmczCustomizeToggle');
    if (body) body.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function initDmczCustomizer(p) {
    var gt = (p && p.garment_type) || 'tshirt';
    _dmczState = {
      method: 'DTF',
      placements: [dmczDefaultPlacementFor(gt)],
      uploads: {},          // { placementId: { path, signed_url, filename } }
      priceSeq: 0,
      boxes: {},            // { placementId: { x, y, w } } — % of the preview stage
      removeBg: false,      // knock out white backgrounds in the live preview
      activePreview: null   // placement the inline canvas is showing/editing
    };
    // The customizer is always expanded now (no accordion) — just render the
    // method picker, placements, uploads, and the live preview.
    renderDmczMethods();
    renderDmczPlacements();
    renderDmczUploads();
    renderDmczPreview();
    refreshDmczPrice();
    dmczResetCustomizeToggle();   // every product opens in the simple state
  }

  // Render the three method cards.
  function renderDmczMethods() {
    var host = document.getElementById('dmczMethods');
    if (!host) return;
    var t = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
    host.innerHTML = DMCZ_METHODS.map(function(m){
      var on = (_dmczState.method === m.id);
      var name = t('cat.detail.method.' + m.id.toLowerCase()) || m.name;
      var desc = t('cat.detail.methoddesc.' + m.id.toLowerCase()) || m.desc;
      return '<button type="button" class="dmcz__method" data-method="' + m.id + '" aria-pressed="' + on + '">' +
             '<span class="dmcz__method-name">' + name + '</span>' +
             '<span class="dmcz__method-desc">' + desc + '</span>' +
             '</button>';
    }).join('');
    host.querySelectorAll('.dmcz__method').forEach(function(btn){
      btn.addEventListener('click', function(){ dmczSelectMethod(btn.getAttribute('data-method')); });
    });
  }

  function dmczSelectMethod(id) {
    _dmczState.method = id;
    // Embroidery: drop disallowed placements from the current selection.
    if (id === 'Embroidery') {
      _dmczState.placements = _dmczState.placements.filter(function(pid){ return !EMB_DISALLOWED[pid]; });
      Object.keys(_dmczState.uploads).forEach(function(pid){
        if (EMB_DISALLOWED[pid]) delete _dmczState.uploads[pid];
      });
      if (_dmczState.placements.length === 0) {
        var gt = (_detailProduct && _detailProduct.garment_type) || 'tshirt';
        var def = dmczDefaultPlacementFor(gt);
        if (!EMB_DISALLOWED[def]) _dmczState.placements = [def];
      }
    }
    renderDmczMethods();
    renderDmczPlacements();
    renderDmczUploads();
    refreshDmczPrice();
  }

  // Render the placement groups for the current garment, with disallowed
  // (embroidery) presets hidden when Embroidery is selected.
  function renderDmczPlacements() {
    var host = document.getElementById('dmczPlacements');
    if (!host) return;
    var gt = (_detailProduct && _detailProduct.garment_type) || 'tshirt';
    var emb = (_dmczState.method === 'Embroidery');
    var groups = dmczPlacementGroupsFor(gt);
    var html = groups.map(function(g){
      var ids = g.ids.filter(function(pid){ return !(emb && EMB_DISALLOWED[pid]); });
      if (!ids.length) return '';
      var chips = ids.map(function(pid){
        var pre = DMCZ_placementPresets[pid] || { label: pid, desc: '' };
        var on = _dmczState.placements.indexOf(pid) >= 0;
        return '<button type="button" class="dmcz__chip" data-pid="' + pid + '" aria-pressed="' + on + '">' +
               '<span class="dmcz__chip-name">' + pre.label + '</span>' +
               '<span class="dmcz__chip-desc">' + (pre.desc || '') + '</span>' +
               '</button>';
      }).join('');
      return '<div class="dmcz__group"><div class="dmcz__group-label">' + g.label + '</div>' +
             '<div class="dmcz__chips">' + chips + '</div></div>';
    }).join('');
    host.innerHTML = html;
    host.querySelectorAll('.dmcz__chip').forEach(function(btn){
      btn.addEventListener('click', function(){ dmczTogglePlacement(btn.getAttribute('data-pid')); });
    });
  }

  // One preset per location: selecting a preset replaces any other selected
  // preset that shares the same .loc. Re-selecting the active one removes it.
  function dmczTogglePlacement(pid) {
    var pre = DMCZ_placementPresets[pid];
    if (!pre) return;
    var idx = _dmczState.placements.indexOf(pid);
    if (idx >= 0) {
      _dmczState.placements.splice(idx, 1);
      delete _dmczState.uploads[pid];
      delete _dmczState.boxes[pid];
      if (_dmczState.activePreview === pid) _dmczState.activePreview = null;
    } else {
      // Drop any existing preset in the same location.
      _dmczState.placements = _dmczState.placements.filter(function(other){
        var op = DMCZ_placementPresets[other];
        if (op && op.loc === pre.loc) {
          delete _dmczState.uploads[other];
          delete _dmczState.boxes[other];
          if (_dmczState.activePreview === other) _dmczState.activePreview = null;
          return false;
        }
        return true;
      });
      _dmczState.placements.push(pid);
    }
    renderDmczPlacements();
    renderDmczUploads();
    renderDmczPreview();
    refreshDmczPrice();
  }

  // One upload zone per selected placement. Upload happens immediately on
  // file pick; the stored result feeds the cart item later.
  function renderDmczUploads() {
    var host = document.getElementById('dmczUploads');
    if (!host) return;
    var t = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
    if (!_dmczState.placements.length) {
      host.innerHTML = '<div class="dmcz__upload-status">' +
        (t('cat.detail.noplacement') || 'Pick a placement above to add artwork.') + '</div>';
      return;
    }
    host.innerHTML = _dmczState.placements.map(function(pid){
      var pre = DMCZ_placementPresets[pid] || { label: pid };
      var up = _dmczState.uploads[pid];
      var inner;
      if (up && up.filename) {
        inner = '<span class="dmcz__file"><span class="dmcz__file-name">' + up.filename + '</span>' +
                '<button type="button" class="dmcz__file-remove" data-remove="' + pid + '" aria-label="Remove">✕</button></span>';
      } else {
        inner = '<label class="dmcz__upload-btn">' +
                (t('cat.detail.uploadbtn') || 'Upload artwork') +
                '<input type="file" accept="image/*,application/pdf,.ai,.eps,.svg" data-upload="' + pid + '"></label>' +
                '<span class="dmcz__upload-status" data-status="' + pid + '"></span>';
      }
      return '<div class="dmcz__upload" data-zone="' + pid + '">' +
             '<div class="dmcz__upload-head"><span class="dmcz__upload-title">' + pre.label + '</span></div>' +
             '<div class="dmcz__upload-row">' + inner + '</div></div>';
    }).join('');
    host.querySelectorAll('input[data-upload]').forEach(function(inp){
      inp.addEventListener('change', function(){ dmczHandleUpload(inp.getAttribute('data-upload'), inp); });
    });
    host.querySelectorAll('[data-remove]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var rid = btn.getAttribute('data-remove');
        delete _dmczState.uploads[rid];
        delete _dmczState.boxes[rid];
        if (_dmczState.activePreview === rid) _dmczState.activePreview = null;
        renderDmczUploads();
        renderDmczPreview();
      });
    });
  }

  // Upload one file to the CRM inbound endpoint. 15MB cap; friendly error
  // on failure but never blocks the customer from continuing.
  function dmczHandleUpload(pid, inp) {
    var file = inp && inp.files && inp.files[0];
    if (!file) return;
    var t = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
    var statusEl = document.querySelector('[data-status="' + pid + '"]');
    var setStatus = function(msg, isErr) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.className = 'dmcz__upload-status' + (isErr ? ' dmcz__upload-status--err' : '');
    };
    if (file.size > 15 * 1024 * 1024) {
      setStatus(t('cat.detail.toolarge') || 'File too large (max 15MB).', true);
      inp.value = '';
      return;
    }
    setStatus(t('cat.detail.uploading') || 'Uploading…', false);
    var fd = new FormData();
    fd.append('file', file);
    fd.append('kind', 'design');
    fetch('https://singhsprint-crm.vercel.app/api/inbound/upload', { method: 'POST', body: fd })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if (!d || !d.path) {
          setStatus(t('cat.detail.uploadfail') || 'Upload failed — you can try again.', true);
          return;
        }
        _dmczState.uploads[pid] = { path: d.path, signed_url: d.signed_url || '', filename: file.name, file: file };
        // Capture the artwork's aspect ratio (h/w). The canvas box only stores
        // a width; the center→top-left conversion needs the true half-HEIGHT,
        // which is (w * ar) / 2 — assuming square art shifts non-square logos
        // vertically in the baked mockup.
        (function(u){
          try {
            var probe = new Image();
            var ourl = URL.createObjectURL(file);
            probe.onload = function(){
              if (probe.naturalWidth > 0) u.ar = probe.naturalHeight / probe.naturalWidth;
              URL.revokeObjectURL(ourl);
            };
            probe.onerror = function(){ URL.revokeObjectURL(ourl); };
            probe.src = ourl;
          } catch(_) {}
        })(_dmczState.uploads[pid]);
        // Seed a starting box for this placement from its preset (cx/cy → %),
        // make it the active preview, and paint it onto the garment live.
        if (!_dmczState.boxes[pid]) {
          var pr = DMCZ_placementPresets[pid] || {};
          _dmczState.boxes[pid] = {
            x: Math.round((typeof pr.cx === 'number' ? pr.cx : 0.5) * 100),
            y: Math.round((typeof pr.cy === 'number' ? pr.cy : 0.4) * 100),
            w: 26
          };
        }
        _dmczState.activePreview = pid;
        renderDmczUploads();
        renderDmczPreview();
      })
      .catch(function(){
        setStatus(t('cat.detail.uploadfail') || 'Upload failed — you can try again.', true);
      });
  }

  // ---- Inline live preview canvas (replaces the popup mockup composer) ----
  // The customer drags their uploaded artwork onto the garment photo and
  // scales it with a slider, exactly like the jersey builder's #czStage. The
  // box {x,y,w} (% of the stage) is stored per placement in _dmczState.boxes
  // and threaded onto the cart item as design_boxes.

  // Which placement ids currently have uploaded artwork (drives tabs + stage).
  function dmczPlacementsWithArt() {
    return (_dmczState.placements || []).filter(function(pid){
      var u = _dmczState.uploads[pid];
      return u && u.signed_url;
    });
  }

  // Pick the garment photo for a placement's side. front-ish presets → front
  // image, back → back image, sleeve/side → side image; fall back front → hero.
  function dmczGarmentSideUrl(pid, color) {
    var pre = DMCZ_placementPresets[pid] || {};
    var loc = pre.loc || 'front';
    var front = color.mockup_front_url || (_detailProduct && _detailProduct.hero_image_url);
    if (loc === 'back') return color.mockup_back_url || front;
    if (loc === 'left-sleeve' || loc === 'right-sleeve' || loc === 'side') {
      // Prefer a real side photo if the color has one; otherwise fall back to
      // our neutral sleeve placeholder (matching the quote composer), not the
      // front garment — a logo on the chest reads wrong for a sleeve hit.
      if (color.mockup_side_url) return color.mockup_side_url;
      return (loc === 'right-sleeve') ? '/images/sleeve-right.png?v=2' : '/images/sleeve-left.png?v=2';
    }
    return front;  // front, hood, cap, bag, apron, leg → front view
  }

  // Make the #dmczArt overlay draggable around #dmczStage; mutates the active
  // box's x/y (% of stage), clamped 4–96%. Mirrors jerseys' makeDragEl.
  function dmczMakeDragEl(box) {
    var stage = document.getElementById('dmczStage');
    var el = document.getElementById('dmczArt');
    if (!stage || !el || !box) return;
    var dragging = false;
    el.addEventListener('pointerdown', function(e){ dragging = true; try { el.setPointerCapture(e.pointerId); } catch(_){} e.preventDefault(); e.stopPropagation(); });
    el.addEventListener('pointermove', function(e){
      if (!dragging) return;
      var r = stage.getBoundingClientRect();
      box.x = Math.max(4, Math.min(96, ((e.clientX - r.left) / r.width) * 100));
      box.y = Math.max(4, Math.min(96, ((e.clientY - r.top) / r.height) * 100));
      el.style.left = box.x + '%'; el.style.top = box.y + '%';
    });
    var end = function(e){ dragging = false; try { el.releasePointerCapture(e.pointerId); } catch(_){} };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // Build the inline stage: garment photo + draggable artwork overlay, with
  // per-placement tabs when more than one placement has art, plus a size
  // slider and a "remove white background" toggle below.
  function renderDmczPreview() {
    var host = document.getElementById('dmczPreviewWrap');
    if (!host) return;
    var t = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
    var withArt = dmczPlacementsWithArt();
    var hasArt = withArt.length > 0;
    var color = (_detailProduct && _detailProduct.colors || [])[_detailColorIdx] || {};

    // Always render the garment. When art exists, show it on the active
    // placement's side (and let the customer drag/scale it). When nothing's
    // uploaded yet, show the bare garment front with a caption prompting an
    // upload — no separate "hint-only" empty state.
    var active, garment, up, box, artImg;
    if (hasArt) {
      // Keep activePreview pointing at a placement that still has art.
      if (withArt.indexOf(_dmczState.activePreview) < 0) _dmczState.activePreview = withArt[0];
      active = _dmczState.activePreview;
      garment = imgUrl(dmczGarmentSideUrl(active, color));
      up = _dmczState.uploads[active] || {};
      if (!_dmczState.boxes[active]) {
        var pr = DMCZ_placementPresets[active] || {};
        _dmczState.boxes[active] = {
          x: Math.round((typeof pr.cx === 'number' ? pr.cx : 0.5) * 100),
          y: Math.round((typeof pr.cy === 'number' ? pr.cy : 0.4) * 100),
          w: 26
        };
      }
      box = _dmczState.boxes[active];
      var blend = _dmczState.removeBg ? 'mix-blend-mode:multiply;' : '';
      artImg = '<img id="dmczArt" src="' + esc(up.signed_url || '') + '" alt="" draggable="false" ' +
        'style="position:absolute;top:' + box.y + '%;left:' + box.x + '%;width:' + box.w + '%;' +
        'transform:translate(-50%,-50%);object-fit:contain;cursor:move;touch-action:none;' + blend +
        'filter:drop-shadow(0 1px 2px rgba(0,0,0,.2))">';
    } else {
      // Bare garment, default to the front view (first selected placement, or
      // the garment's default placement).
      var defPid = (_dmczState.placements && _dmczState.placements[0]) || null;
      garment = imgUrl(dmczGarmentSideUrl(defPid, color));
      artImg = '';
    }

    // Tabs (only when 2+ placements have art).
    var tabs = '';
    if (withArt.length > 1) {
      tabs = '<div class="dmcz__preview-tabs">' + withArt.map(function(pid){
        var pre = DMCZ_placementPresets[pid] || { label: pid };
        return '<button type="button" class="dmcz__preview-tab" data-prevtab="' + esc(pid) + '" aria-pressed="' + (pid === active) + '">' + esc(pre.label) + '</button>';
      }).join('') + '</div>';
    }

    // Caption shown only when there's no artwork yet.
    var caption = hasArt ? '' :
      '<div class="detail-modal__preview-cap">' +
      (t('cat.detail.uploadtosee') || 'Upload artwork to see it here') + '</div>';

    // Size slider + remove-bg toggle only apply when artwork is present.
    var controls = hasArt ?
      '<div class="dmcz__controls">' +
        '<div class="dmcz__size-row">' +
          '<span data-i18n="cat.detail.designsize">' + (t('cat.detail.designsize') || 'Size') + '</span>' +
          '<input type="range" id="dmczSize" min="10" max="80" step="1" value="' + Math.round(box.w) + '">' +
        '</div>' +
        '<label class="dmcz__rmbg">' +
          '<input type="checkbox" id="dmczRemoveBg"' + (_dmczState.removeBg ? ' checked' : '') + '> ' +
          '<span data-i18n="cat.detail.removebg">' + (t('cat.detail.removebg') || 'Remove white background') + '</span>' +
        '</label>' +
      '</div>' : '';

    host.innerHTML = tabs +
      '<div class="dmcz__stage dmcz__stage--loading" id="dmczStage">' +
        '<img class="dmcz__stage-garment" src="' + esc(garment) + '" alt="" loading="eager" decoding="async" onload="this.parentNode.classList.remove(\'dmcz__stage--loading\')">' +
        artImg +
      '</div>' +
      caption +
      controls;

    // Tab switching.
    host.querySelectorAll('[data-prevtab]').forEach(function(b){
      b.addEventListener('click', function(){ _dmczState.activePreview = b.getAttribute('data-prevtab'); renderDmczPreview(); });
    });
    if (hasArt) {
      // Size slider: live-resize the artwork without a full re-render.
      var size = document.getElementById('dmczSize');
      if (size) size.addEventListener('input', function(){
        box.w = parseInt(this.value, 10) || 26;
        var a = document.getElementById('dmczArt');
        if (a) a.style.width = box.w + '%';
      });
      // Remove-bg toggle: re-apply the blend mode live.
      var rb = document.getElementById('dmczRemoveBg');
      if (rb) rb.addEventListener('change', function(){
        _dmczState.removeBg = this.checked;
        var a = document.getElementById('dmczArt');
        if (a) a.style.mixBlendMode = this.checked ? 'multiply' : '';
      });
      // Drag the artwork around the garment.
      dmczMakeDragEl(box);
    }
  }

  // Live all-in price for the current method/placements/qty. Guarded
  // against races (only the latest request applies, and only if the modal
  // is still on the same product).
  function refreshDmczPrice() {
    var p = _detailProduct;
    if (!p) return;
    var priceEl = document.getElementById('detailModalPrice');
    if (!priceEl) return;
    var t = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
    var qtyInput = document.getElementById('detailModalQtyInput');
    var qty = Math.max(1, parseInt(qtyInput && qtyInput.value, 10) || (state && state.qty) || 25);
    var placements = _dmczState.placements.slice();
    var sides = placements.length || 1;
    var method = dmczMethodApi(_dmczState.method);
    var embPlac = (method === 'embroidery') ? placements.join(',') : '';
    var seq = ++_dmczState.priceSeq;
    var pidForGuard = p.product_id;

    var fallback = function() {
      priceEl.innerHTML = (typeof p.price_from === 'number' && p.price_from > 0)
        ? (t('cat.card.from') || 'From') + ' <strong>$' + p.price_from.toFixed(2) + '</strong> ' + (t('cat.card.perunit') || '/unit')
        : '<strong>' + (t('cat.card.quote-on-request') || 'Quote on request') + '</strong>';
    };

    var url = 'https://singhsprint-crm.vercel.app/api/pricing?product_id=' +
              encodeURIComponent(p.product_id) +
              '&qty=' + encodeURIComponent(qty) +
              '&sides=' + encodeURIComponent(sides) +
              '&decoration_method=' + encodeURIComponent(method) +
              '&embroidery_placements=' + encodeURIComponent(embPlac);

    fetch(url, { cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        // Race / product-switch guard.
        if (seq !== _dmczState.priceSeq) return;
        if (!_detailProduct || _detailProduct.product_id !== pidForGuard) return;
        var unit = d && typeof d.unit_price === 'number' ? d.unit_price : null;
        if (unit === null || isNaN(unit)) { fallback(); return; }
        var sideWord = sides === 1
          ? (t('cat.card.oneside') || '1-side print')
          : sides + (t('cat.detail.sideprint') || '-side print');
        priceEl.innerHTML = (t('cat.card.from') || 'From') + ' <strong>$' + unit.toFixed(2) + '</strong> ' +
          (t('cat.card.perunit') || '/unit') +
          ' · <span style="color:#888;font-weight:500">' + sideWord + '</span>';
      })
      .catch(function(){
        if (seq !== _dmczState.priceSeq) return;
        if (!_detailProduct || _detailProduct.product_id !== pidForGuard) return;
        fallback();
      });
  }

  function openProductDetail(p, initialColorIdx) {
    _detailProduct = p;
    _detailColorIdx = (Number.isFinite(initialColorIdx) && initialColorIdx >= 0 && initialColorIdx < (p.colors || []).length)
      ? initialColorIdx : 0;
    _detailGalleryIdx = 0;  // always start gallery on front view when opening a new product

    // The product object we have right now is the SLIM Algolia hit — it
    // lacks mockup_back_url, mockup_side_url, the full size arrays per
    // color, etc. Refetch the full row by product_id so the gallery thumb
    // strip (front / back / side) and the detail color grid have real
    // data. We render twice: once with the slim data for instant first
    // paint, then a second paintDetailHero() once the fat payload lands.
    if (p && p.product_id) {
      fetch('https://singhsprint-crm.vercel.app/api/catalog?product_id=' +
            encodeURIComponent(p.product_id) + '&limit=1', { cache: 'no-store' })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(d) {
          var full = (d && d.products && d.products[0]) || null;
          if (!full || _detailProduct !== p) return;     // modal closed / moved on
          // Preserve the user's currently-selected color across the swap.
          var selectedName = ((p.colors || [])[_detailColorIdx] || {}).color_name;
          _detailProduct = full;
          if (selectedName) {
            var ni = (full.colors || []).findIndex(function(c){ return c.color_name === selectedName; });
            if (ni >= 0) _detailColorIdx = ni;
          }
          // Re-render whatever the modal exposes from the fatter payload.
          paintDetailHero();
          if (typeof renderDetailModalSwatches === 'function') renderDetailModalSwatches();
          if (typeof renderDetailModalSpecs    === 'function') renderDetailModalSpecs();
          // The live preview is the garment view now — refresh it so it picks
          // up the fuller mockup set (back/side URLs) from the fat payload.
          if (typeof renderDmczPreview === 'function') renderDmczPreview();
        })
        .catch(function(){ /* keep the slim view */ });
    }
    document.getElementById('detailModalBrand').textContent = (p.brand || '').toUpperCase() + ' · ' + (p.style_number || '');
    document.getElementById('detailModalTitle').textContent = p.name || '';
    const _t = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
    document.getElementById('detailModalPrice').innerHTML = (typeof p.price_from === 'number' && p.price_from > 0)
      ? (_t('cat.card.from') || 'From') + ' <strong>$' + p.price_from.toFixed(2) + '</strong> ' + (_t('cat.card.perunit') || '/unit') + ' · <span style="color:#888;font-weight:500">' + (_t('cat.card.oneside') || '1-side print') + '</span>'
      : '<strong>' + (_t('cat.card.quote-on-request') || 'Quote on request') + '</strong>';
    const metaBits = [];
    if (p.weight_oz)     metaBits.push(p.weight_oz + ' oz');
    if (p.fabric)        metaBits.push(p.fabric);
    if (p.gender)        metaBits.push(p.gender);
    if (p.category || p.garment_type)  metaBits.push((p.category || p.garment_type).replace(/_/g, ' '));
    if (p.colors)        metaBits.push(p.colors.length + ' color' + (p.colors.length === 1 ? '' : 's'));
    document.getElementById('detailModalMeta').textContent = metaBits.join('  ·  ');
    document.getElementById('detailModalCount').textContent = (p.colors || []).length;

    // Tech specs panel — called twice: once with slim Algolia data
    // (description is plain text, no <li> tags so this hides the panel),
    // and again after the /api/catalog?product_id=… refetch lands with
    // the raw HTML description from the supplier.
    renderDetailModalSpecs();

    // Seed the qty stepper from the catalog page's current slider value.
    const qtyInput = document.getElementById('detailModalQtyInput');
    qtyInput.value = state.qty || 25;
    syncDetailAddBtn();

    // Full color grid with names underneath. Wrapped in a function so we
    // can re-render after the fat product_id fetch lands with the full
    // color array + back/side mockups.
    renderDetailModalSwatches();
    paintDetailHero();
    // Boot the in-modal customizer: method=DTF, default placement, no
    // uploads, then render the method picker + placements + upload zones
    // and fetch the live all-in price.
    initDmczCustomizer(p);
    document.getElementById('detailOverlay').classList.add('open');
    document.getElementById('detailModal').classList.add('open');
    document.body.style.overflow = 'hidden';
    // JS fallback for the CSS :has() rule that hides the sitewide sticky
    // CTA bar. Older Safari/Android don't yet support :has() — this body
    // class gives us a deterministic hook for the same CSS rule.
    document.body.classList.add('sp-detail-modal-open');
    // If FR is active, machine-translate the dynamic strings (title,
    // selected color, color names in the grid, spec bullets).
    maybeTranslateDetailModal();
  }

  // Build the list of available image views for THIS color. S&S gives us
  // up to 3 mockups (front, back, side) per color but coverage varies —
  // some hats only have a front shot, some tees have all three. We
  // filter to whatever's actually populated so the thumb strip doesn't
  // surface dead placeholders.
  function _galleryViewsForColor(c, fallback) {
    const out = [];
    if (c && c.mockup_front_url) out.push({ key: 'front', label: 'Front', url: imgUrl(c.mockup_front_url) });
    if (c && c.mockup_back_url)  out.push({ key: 'back',  label: 'Back',  url: imgUrl(c.mockup_back_url) });
    if (c && c.mockup_side_url)  out.push({ key: 'side',  label: 'Side',  url: imgUrl(c.mockup_side_url) });
    if (out.length === 0 && fallback) out.push({ key: 'hero', label: 'Front', url: imgUrl(fallback) });
    return out;
  }

  // Render the tech-specs panel from _detailProduct.description. Two
  // shapes from suppliers:
  //   1. Structured: <ul><li>5.3 oz/yd²</li><li>Classic fit</li>…</ul>
  //      → parseSpecBullets() lifts each <li> as a bullet.
  //   2. Plain text: "5.3 oz./yd² (US), 8.0 oz/L (CA), 100% cotton…"
  //      → split on sentence-like boundaries to make ad-hoc bullets, OR
  //      fall back to a single paragraph if nothing splits cleanly. Goal
  //      is that EVERY product with description text shows something —
  //      no more invisible specs panel.
  function _adhocSpecLines(text) {
    if (!text) return [];
    var cleaned = String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];
    // Try newlines first — some suppliers wedge \n between facts.
    if (/\n/.test(text)) {
      return text.split('\n').map(function(s){ return s.replace(/<[^>]+>/g,' ').trim(); }).filter(Boolean);
    }
    // Heuristic: split on common bullet separators. We won't blindly
    // split on every period (would break "5.3 oz"). Look for capital
    // letter starts after a period+space.
    var parts = cleaned.split(/(?<=\.)\s+(?=[A-Z])/);
    if (parts.length >= 2) return parts.map(function(s){ return s.trim(); }).filter(Boolean);
    // Last resort: one big paragraph.
    return [cleaned];
  }

  function renderDetailModalSpecs() {
    const p = _detailProduct; if (!p) return;
    let specs = parseSpecBullets(p.description);
    let kind  = 'bullets';
    if (specs.length === 0) {
      specs = _adhocSpecLines(p.description);
      kind  = specs.length === 1 ? 'paragraph' : 'bullets';
    }
    const specsWrap = document.getElementById('detailModalSpecsWrap');
    const specsList = document.getElementById('detailModalSpecs');
    const specsToggle = document.getElementById('detailModalSpecsToggle');
    if (!specsWrap || !specsList || !specsToggle) return;
    if (specs.length === 0) {
      specsWrap.style.display = 'none';
      return;
    }
    specsWrap.style.display = 'block';
    if (kind === 'paragraph') {
      // No bullet structure exists — render as a single muted paragraph.
      const esc = specs[0].replace(/</g, '&lt;');
      specsList.innerHTML = '<li style="padding-left:0;color:#444;line-height:1.55" data-flat="1">' + esc + '</li>';
      specsList.querySelectorAll('li[data-flat="1"]').forEach(li => {
        // Hide the round bullet for the paragraph case.
        li.style.setProperty('list-style', 'none');
      });
      specsToggle.style.display = 'none';
      return;
    }
    const PREVIEW = 4;
    specsList.innerHTML = specs.map((s, i) =>
      `<li${i >= PREVIEW ? ' data-extra="1" style="display:none"' : ''}>${s.replace(/</g, '&lt;')}</li>`
    ).join('');
    if (specs.length > PREVIEW) {
      specsToggle.style.display = 'inline-block';
      var _ts = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
      specsToggle.textContent = (_ts('cat.detail.showall') || 'Show all') + ' ' + specs.length + ' ' + (_ts('cat.detail.specs-suffix') || 'specs ▾');
      specsToggle.dataset.expanded = '0';
    } else {
      specsToggle.style.display = 'none';
    }
  }

  // Render (or re-render) the color grid inside the detail modal. Called
  // by openProductDetail with the slim Algolia data, then called again
  // when the full /api/catalog?product_id=… payload arrives so the
  // entire colorway (with names, swatch images, full size arrays) lands.
  function renderDetailModalSwatches() {
    const p = _detailProduct; if (!p) return;
    const host = document.getElementById('detailModalSwatches');
    if (!host) return;
    host.innerHTML = (p.colors || []).map((c, i) => {
      // No hex? Try the swatch thumbnail first, then the front mockup
      // (Blanks.ca colors often have only the latter), then grey as a
      // last resort. Route via imgUrl() so S&S URLs go through proxy.
      const hex     = c.hex_code;
      const swatch  = c.swatch_image_url || c.mockup_front_url;
      const bg      = (!hex && swatch) ? `url(${imgUrl(swatch, 64)}) center/cover #f3f1ea` : (hex || '#ccc');
      const hasStock = Array.isArray(c.sizes_in_stock) && c.sizes_in_stock.length > 0;
      const cleanName = (c.color_name || '').replace(/_\d+$/, '');
      const oosCls = hasStock ? '' : 'detail-modal__swatch--oos';
      const isSelected = i === _detailColorIdx;
      return `<button type="button" class="detail-modal__swatch ${oosCls}" data-idx="${i}" aria-selected="${isSelected ? 'true' : 'false'}" title="${cleanName}${hasStock ? '' : ' (out of stock)'}">
        <span class="detail-modal__swatch-dot" style="background:${bg}"></span>
        <span class="detail-modal__swatch-name">${cleanName || '—'}</span>
      </button>`;
    }).join('');
    host.querySelectorAll('.detail-modal__swatch').forEach(s => {
      s.addEventListener('click', () => {
        _detailColorIdx = parseInt(s.dataset.idx, 10) || 0;
        _detailGalleryIdx = 0;
        host.querySelectorAll('.detail-modal__swatch').forEach(x => x.setAttribute('aria-selected', 'false'));
        s.setAttribute('aria-selected', 'true');
        paintDetailHero();
        // Refresh the in-modal customizer preview so the garment switches to
        // the newly-picked colour too (it reads the live _detailColorIdx).
        if (typeof renderDmczPreview === 'function') renderDmczPreview();
      });
    });
  }

  function paintDetailHero() {
    const p = _detailProduct; if (!p) return;
    const c = (p.colors || [])[_detailColorIdx] || {};
    const _t = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };

    // Compute available views for this color + clamp the gallery index.
    const views = _galleryViewsForColor(c, p.hero_image_url);
    if (_detailGalleryIdx >= views.length) _detailGalleryIdx = 0;
    const currentView = views[_detailGalleryIdx] || { url: '', label: 'Front' };

    // Main image
    const mainImg = document.getElementById('detailModalImg');
    if (mainImg) {
      mainImg.src = currentView.url;
      mainImg.alt = (p.brand || '') + ' ' + (p.style_number || '') + ' — ' + ((c.color_name || '').replace(/_\d+$/, '')) + ' (' + currentView.label + ')';
    }
    // Main image click → open lightbox with the current full-size view
    const mainBtn = document.getElementById('detailModalMainBtn');
    if (mainBtn) {
      mainBtn.onclick = function(ev) {
        ev.preventDefault();
        openImgLightbox(currentView.url);
      };
    }

    // Thumbnail strip — one button per available view. Hidden entirely
    // when there's only one image so the UI doesn't show a single useless
    // thumb (most caps land here).
    const thumbsHost = document.getElementById('detailModalThumbs');
    if (thumbsHost) {
      if (views.length <= 1) {
        thumbsHost.innerHTML = '';
      } else {
        thumbsHost.innerHTML = views.map(function(v, i) {
          const active = (i === _detailGalleryIdx) ? ' is-active' : '';
          return '<button type="button" class="detail-modal__thumb' + active + '" data-gi="' + i + '" aria-label="' + v.label + '">' +
                 '<img src="' + v.url + '" alt="' + v.label + '" loading="lazy"/></button>';
        }).join('');
        thumbsHost.querySelectorAll('.detail-modal__thumb').forEach(function(b) {
          b.addEventListener('click', function() {
            _detailGalleryIdx = parseInt(b.dataset.gi, 10) || 0;
            paintDetailHero();
          });
        });
      }
    }

    document.getElementById('detailModalSelectedColor').textContent = (_t('cat.detail.color') || 'Color:') + ' ' + ((c.color_name || '').replace(/_\d+$/, '') || '—');
    const sizes = Array.isArray(c.sizes_in_stock) ? c.sizes_in_stock : [];
    document.getElementById('detailModalSelectedSizes').textContent = sizes.length
      ? (_t('cat.detail.sizes') || 'Sizes in stock:') + ' ' + sizes.join(', ')
      : (_t('cat.detail.sizes') || 'Sizes in stock:') + ' ' + (_t('cat.detail.contactus') || 'contact us');
  }

  function closeProductDetail() {
    document.getElementById('detailOverlay').classList.remove('open');
    document.getElementById('detailModal').classList.remove('open');
    document.body.style.overflow = '';
    document.body.classList.remove('sp-detail-modal-open');
  }

  // ---------------------------------------------------------------------
  // Image lightbox — full-viewport zoom on the detail modal's main image
  // ---------------------------------------------------------------------
  function openImgLightbox(url) {
    if (!url) return;
    const lb  = document.getElementById('imgLightbox');
    const img = document.getElementById('imgLightboxImg');
    if (!lb || !img) return;
    img.src = url;
    lb.classList.add('open');
    // Don't double-lock body scroll — the detail modal already did it,
    // we just stack the lightbox above it. If the lightbox is opened
    // standalone (no modal open), still lock scroll.
    if (!document.body.classList.contains('sp-detail-modal-open')) {
      document.body.style.overflow = 'hidden';
    }
    if (window.spTrack) window.spTrack('catalog_lightbox_open', { src: url });
  }
  function closeImgLightbox(ev, force) {
    // Only close on backdrop click or explicit close button — not on
    // the image itself (so a wandering click inside the image area
    // doesn't fight the user's zoom).
    if (!force && ev && ev.target && ev.target.tagName === 'IMG') return;
    const lb = document.getElementById('imgLightbox');
    if (!lb) return;
    lb.classList.remove('open');
    if (!document.body.classList.contains('sp-detail-modal-open')) {
      document.body.style.overflow = '';
    }
  }
  // ESC closes the lightbox first, then the modal. Reuses the existing
  // body-class hook so we don't conflict with the modal's own ESC path.
  document.addEventListener('keydown', function(ev) {
    if (ev.key !== 'Escape') return;
    const lb = document.getElementById('imgLightbox');
    if (lb && lb.classList.contains('open')) {
      closeImgLightbox(ev, true);
      ev.stopPropagation();
    }
  });

  // Sync the Add-button label to the qty input. Does NOT clamp the
  // input value during typing — that prevented users from erasing the
  // "1" to type their own number. Clamping happens only on blur and
  // when the customer actually hits "Add to quote".
  function syncDetailAddBtn() {
    const inp = document.getElementById('detailModalQtyInput');
    if (!inp) return;
    const raw = inp.value;
    const n = parseInt(raw, 10);
    // Label shows the typed value (or blank if mid-edit / invalid).
    const label = document.getElementById('detailModalAddQty');
    if (label) label.textContent = (raw === '' || isNaN(n)) ? '' : String(n);
  }
  // Final clamp — called on blur and on Add click.
  function clampDetailQty() {
    const inp = document.getElementById('detailModalQtyInput');
    if (!inp) return 1;
    let n = parseInt(inp.value, 10);
    if (!n || n < 1) n = 1;
    if (n > 10000) n = 10000;
    inp.value = n;
    syncDetailAddBtn();
    return n;
  }

  // Wire the modal's Add button, qty stepper, specs toggle, Esc-to-close.
  document.addEventListener('DOMContentLoaded', () => {
    // Qty stepper
    const qtyInp   = document.getElementById('detailModalQtyInput');
    const qtyMinus = document.getElementById('detailModalQtyMinus');
    const qtyPlus  = document.getElementById('detailModalQtyPlus');
    if (qtyMinus) qtyMinus.addEventListener('click', () => {
      qtyInp.value = Math.max(1, (parseInt(qtyInp.value, 10) || 1) - 1);
      syncDetailAddBtn();
      if (typeof refreshDmczPrice === 'function') refreshDmczPrice();
    });
    if (qtyPlus) qtyPlus.addEventListener('click', () => {
      qtyInp.value = Math.min(10000, (parseInt(qtyInp.value, 10) || 0) + 1);
      syncDetailAddBtn();
      if (typeof refreshDmczPrice === 'function') refreshDmczPrice();
    });
    // While typing: don't clamp. Just update the label.
    if (qtyInp) qtyInp.addEventListener('input', syncDetailAddBtn);
    // Debounced live-price refresh as the customer types a new qty.
    if (qtyInp) {
      let _dmczQtyTimer = null;
      qtyInp.addEventListener('input', () => {
        clearTimeout(_dmczQtyTimer);
        _dmczQtyTimer = setTimeout(() => {
          if (typeof refreshDmczPrice === 'function') refreshDmczPrice();
        }, 350);
      });
    }
    // On blur / leave: NOW clamp.
    if (qtyInp) qtyInp.addEventListener('blur',  clampDetailQty);
    // Select-all on focus so a tap-then-type replaces "1" cleanly.
    if (qtyInp) qtyInp.addEventListener('focus', (e) => e.target.select());

    // Mobile: the on-screen keyboard covers the footer (qty input sits at the
    // bottom of the modal). While the qty field is focused, lift the modal
    // inner above the keyboard using the visualViewport API so the customer
    // can see what they're typing. Resets on blur.
    if (qtyInp && window.visualViewport) {
      const vv = window.visualViewport;
      const innerEl = () => document.querySelector('.detail-modal__inner');
      let qtyFocused = false;
      const liftForKeyboard = () => {
        const el = innerEl(); if (!el) return;
        if (qtyFocused) {
          const overlap = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
          el.style.transform = overlap > 4 ? `translateY(-${overlap}px)` : '';
        } else {
          el.style.transform = '';
        }
      };
      vv.addEventListener('resize', liftForKeyboard);
      vv.addEventListener('scroll', liftForKeyboard);
      qtyInp.addEventListener('focus', () => { qtyFocused = true; setTimeout(liftForKeyboard, 150); });
      qtyInp.addEventListener('blur',  () => { qtyFocused = false; const el = innerEl(); if (el) el.style.transform = ''; });
    }

    // Specs "Show more / Show fewer" toggle
    const specsToggle = document.getElementById('detailModalSpecsToggle');
    if (specsToggle) specsToggle.addEventListener('click', () => {
      const expanded = specsToggle.dataset.expanded === '1';
      document.querySelectorAll('#detailModalSpecs li[data-extra="1"]').forEach(li => {
        li.style.display = expanded ? 'none' : '';
      });
      specsToggle.dataset.expanded = expanded ? '0' : '1';
      const allCount = document.querySelectorAll('#detailModalSpecs li').length;
      var _ts2 = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
      specsToggle.textContent = expanded
        ? (_ts2('cat.detail.showall') || 'Show all') + ' ' + allCount + ' ' + (_ts2('cat.detail.specs-suffix') || 'specs ▾')
        : (_ts2('cat.detail.showfewer') || 'Show fewer specs ▴');
    });

    // Add → cart, using the modal's own qty (not the page slider).
    const addBtn = document.getElementById('detailModalAddBtn');
    if (addBtn) addBtn.addEventListener('click', () => {
      const p = _detailProduct; if (!p) return;
      const c = (p.colors || [])[_detailColorIdx] || {};
      const n = Math.max(1, parseInt(qtyInp.value, 10) || 1);

      // Pull the customizer state. Default placement + DTF still apply
      // even if the customer skipped customizing entirely.
      const st = (typeof _dmczState === 'object' && _dmczState) ? _dmczState : { method: 'DTF', placements: [], uploads: {} };
      let placements = (st.placements || []).slice();
      if (!placements.length) {
        placements = [dmczDefaultPlacementFor(p.garment_type || 'tshirt')];
      }
      const decoration_type = dmczMethodApi(st.method || 'DTF');   // 'dtf' | 'embroidery'
      const uploads = st.uploads || {};
      // Per-placement upload map for ALL uploaded artwork.
      const placement_designs = {};
      Object.keys(uploads).forEach(function(pid){
        const u = uploads[pid];
        if (u && u.path) placement_designs[pid] = { path: u.path, signed_url: u.signed_url || '', filename: u.filename || '' };
      });
      // Primary artwork = first selected placement that actually has an
      // upload (for back-compat with /quote + the CRM).
      let design_path = null, design_url = null;
      for (let i = 0; i < placements.length; i++) {
        const u = uploads[placements[i]];
        if (u && u.path) { design_path = u.path; design_url = u.signed_url || null; break; }
      }

      // ---- Bake photoreal mockups for every placement that has art ----------
      // The inline canvas stores boxes as 0–100 CENTER coords; /api/shop/compose
      // wants 0–1 TOP-LEFT. Convert per the formula below, clamped to [0,1].
      const SHOP_COMPOSE_API = 'https://singhsprint-crm.vercel.app/api/shop/compose';
      const color = (_detailProduct && _detailProduct.colors || [])[_detailColorIdx] || {};
      function clamp01(v) { return Math.max(0, Math.min(1, v)); }
      // ar = artwork aspect ratio (naturalHeight / naturalWidth), captured at
      // upload time. The box height on the canvas is w * ar (the art img only
      // sets width), so the top edge is center.y minus HALF that — not w/2,
      // which is only correct for square art.
      function dmczBoxToCompose(b, ar) {
        var halfH = (b.w / 100) * (ar || 1) / 2;
        return {
          x: clamp01((b.x - b.w / 2) / 100),
          y: clamp01(b.y / 100 - halfH),
          w: clamp01(b.w / 100)
        };
      }
      const composeJobs = [];
      (st.placements || []).forEach(function(pid) {
        const up = uploads[pid];
        if (!up || !up.path) return;
        const b = (st.boxes && st.boxes[pid]) || { x: 50, y: 40, w: 26 };
        const composeBox = dmczBoxToCompose(b, up.ar);
        const job = fetch(SHOP_COMPOSE_API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            color_id:    color.color_id,
            placement:   pid,
            design_path: up.path,
            design_url:  up.signed_url || null,
            box:         composeBox,
            remove_bg:   !!st.removeBg,
            session_id:  (localStorage.getItem('singhsCartId_v1') || null)
          })
        }).then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
          .then(function(res) {
            if (!res.ok || !res.j) return null;
            var url = res.j.mockup_url || res.j.url;
            return url ? { placement: pid, url: url } : null;
          })
          .catch(function() { return null; });  // never block the add on a compose failure
        composeJobs.push(job);
      });

      // Disable the Add button + show a "Generating mockup…" state while baking.
      const _tAdd = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
      const _origAddHTML = addBtn.innerHTML;
      const _generatingTxt = _tAdd('cat.detail.adding') || 'Generating mockup…';
      if (composeJobs.length) {
        addBtn.disabled = true;
        addBtn.style.opacity = '0.7';
        addBtn.style.cursor = 'wait';
        addBtn.textContent = _generatingTxt;
      }

      Promise.all(composeJobs).then(function(results) {
        const mockups = results.filter(Boolean);
        if (composeJobs.length) {
          addBtn.disabled = false;
          addBtn.style.opacity = '';
          addBtn.style.cursor = '';
          addBtn.innerHTML = _origAddHTML;
        }
        addToCart(p.product_id, {
          color_id:     c.color_id || null,
          color_name:   (c.color_name || ''),
          brand:        p.brand || '',
          style_number: p.style_number || '',
          name:         p.name || '',
          garment_type: p.garment_type || null,
          hero_url:     imgUrl(c.mockup_front_url || p.hero_image_url, 480),
          qty:          n,
          // ---- Decoration carried up-front from the modal ----
          placements:        placements,
          sides:             placements.length,
          decoration_type:   decoration_type,
          design_path:       design_path,
          design_url:        design_url,
          placement_designs: placement_designs,
          // Inline live-preview output: per-placement box stored in the
          // editor's 0–1 TOP-LEFT format (converted from the canvas's 0–100
          // CENTER coords), matching what /quote's customizer expects.
          design_boxes:      (function(){
            if (!st.boxes) return null;
            var out = {};
            Object.keys(st.boxes).forEach(function(pid){
              if (st.boxes[pid]) out[pid] = dmczBoxToCompose(st.boxes[pid], (uploads[pid] || {}).ar);
            });
            return out;
          })(),
          design_remove_bg:  !!st.removeBg,
          // Photoreal mockups baked above (empty when no art was uploaded).
          mockups:           mockups.length ? mockups : undefined,
        });
        closeProductDetail();
        showCartToast({ brand: p.brand, style_number: p.style_number });
      });
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && document.getElementById('detailModal').classList.contains('open')) {
        closeProductDetail();
      }
    });
  });

  // Adds the currently-selected product to the cart with the qty from the
  // slider. Called from each card's "+ Add" button.
  function addToCart(productId, payload) {
    var qty = Math.max(1, parseInt(payload.qty, 10) || state.qty || 50);
    // Decoration carried up-front from the detail modal (when present).
    // Whole-card "+ Add" clicks omit these → fall back to a bare item
    // (default placement, dtf, no uploads) so /quote stays editable.
    var placements = Array.isArray(payload.placements) && payload.placements.length
      ? payload.placements.slice() : null;
    var sides = placements ? placements.length : (payload.sides || 1);
    SinghsCart.add({
      product_id:   productId,
      color_id:     payload.color_id || null,
      color_name:   payload.color_name || '',
      brand:        payload.brand || '',
      style_number: payload.style_number || '',
      name:         payload.name || '',
      garment_type: payload.garment_type || null,
      hero_url:     payload.hero_url || '',
      // Modal can override the page-slider qty per-item; fall back to the
      // catalog slider value (state.qty) for whole-card clicks.
      qty:          qty,
      sides:        sides,
      // Up-front decoration (read by /quote + the CRM). All optional —
      // omitted on bare whole-card adds.
      placements:        placements || undefined,
      decoration_type:   payload.decoration_type || undefined,
      design_path:       payload.design_path || undefined,
      design_url:        payload.design_url || undefined,
      placement_designs: payload.placement_designs || undefined,
      design_boxes:      payload.design_boxes || undefined,
      design_remove_bg:  payload.design_remove_bg || undefined,
      mockups:           payload.mockups || undefined,
    });
    // Funnel analytics — the strongest signal of intent on this page.
    if (window.spTrack) window.spTrack('catalog_add_to_quote', {
      product_id: productId,
      brand: payload.brand || '',
      style_number: payload.style_number || '',
      garment_type: payload.garment_type || null,
      color_name: payload.color_name || '',
      qty: qty
    });
    showCartToast(payload);
    // Visual confirmation on the card itself
    const btn = document.querySelector('button[data-add-id="' + productId + '"]');
    if (btn) {
      var _t = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
      btn.classList.add('added');
      btn.textContent = _t('cat.toast.added') || '✓ Added';
      setTimeout(function(){ btn.classList.remove('added'); btn.textContent = _t('cat.card.add-to-quote') || '+ Add to quote'; }, 1400);
    }
  }

  const state = {
    filters: {                       // active filter state — drives Algolia query
      type: getQueryParam('type') || null,
      brand: [],
      // Hydrate from `?canadian=1` so deep links from the nav's Canadian-Made
      // dropdown and the /designed-in-montreal page land on the catalog
      // pre-filtered to Rue Saint-Patrick / Canadian-made blanks.
      canadian: getQueryParam('canadian') === '1',
      csa: false,
      // Hydrate from `?q=` so deep links from the nav's search dropdown
      // (e.g. /catalog?q=hoodies) actually pre-filter the catalog instead
      // of landing on the unfiltered list with the search param ignored.
      q: getQueryParam('q') || '',
      inStockOnly: true,             // default ON — hide fully OOS items
      // Derived facet filters (2026-05-19). Each is an array because the
      // panel UI is multi-select within a category (e.g. show me red OR blue
      // products). Empty arrays = no constraint.
      colorFamilies:   [],
      genders:         [],
      fabricFamilies:  [],
      weightClasses:   [],
      sizes:           [],
      // Price range (CAD per piece, at qty=50). null = unbounded that side.
      priceMin:        null,
      priceMax:        null,
    },
    sort:    getQueryParam('sort') || 'bestseller',
    // Qty used to compute every card's "From $X" and the qty pre-filled
    // when a customer adds a product to their quote. 50 is the middle
    // tier in QTY_TIERS — realistic for the typical team / event order
    // and avoids cart accumulation when first-time shoppers add a few
    // items quickly. Bulk shoppers can drag the slider up. The URL can
    // pre-select any tier via ?qty=N.
    qty:     Math.max(1, Math.min(10000, parseInt(getQueryParam('qty') || '50', 10) || 50)),
    products: [],
    page: 0,
    loading: false,
    done: false
  };

  // =========================================================================
  // Qty control — slider snaps to canonical pricing tiers; the number input
  // lets the customer override to any qty in between. Both write into
  // state.qty and refetch the catalog (debounced).
  // =========================================================================
  const QTY_TIERS = [5, 10, 25, 50, 100, 200, 500];   // index = slider step
  let _qtyDebounce = null;

  // Map an arbitrary qty to the closest slider step (so the thumb stays in
  // a sensible position even after a custom number entry).
  function qtyToStep(q) {
    let bestIdx = 0, bestDist = Infinity;
    QTY_TIERS.forEach((t, i) => {
      const d = Math.abs(t - q);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    return bestIdx;
  }

  function onQtySliderChanged(stepStr) {
    const step = parseInt(stepStr, 10);
    setQty(QTY_TIERS[step] || 200);
  }
  function onQtyInputChanged(val) {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < 1) return;
    setQty(Math.min(10000, n));
  }
  function setQty(n) {
    state.qty = n;
    // Sync UI: slider position, readout, number input, tick highlight.
    const step = qtyToStep(n);
    const slider = document.getElementById('qtySlider');
    if (slider) {
      slider.value = step;
      slider.style.setProperty('--qty-pct', ((step / (QTY_TIERS.length - 1)) * 100) + '%');
    }
    const readout = document.getElementById('qtyReadout');
    if (readout) readout.textContent = n >= 500 ? '500+' : String(n);
    const input = document.getElementById('qtyInput');
    if (input && document.activeElement !== input) input.value = n;
    document.querySelectorAll('.qty-ticks span').forEach(s => s.classList.toggle('active', parseInt(s.dataset.step,10) === step));
    // Reflect in URL so deep links carry the qty
    const url = new URL(location.href);
    if (n === 50) url.searchParams.delete('qty'); else url.searchParams.set('qty', String(n));
    history.replaceState(null, '', url.toString());
    // Visual loading state — fade prices so the customer sees something
    // happens immediately, even if the API takes a beat. Cards stay legible
    // but the per-unit text greys out until fresh prices arrive.
    document.querySelectorAll('.card .price').forEach(p => p.style.opacity = '.4');
    // Debounced refetch (100ms — fast enough to feel instant but coalesces
    // rapid slider drags into a single request)
    if (_qtyDebounce) clearTimeout(_qtyDebounce);
    _qtyDebounce = setTimeout(() => resetAndFetch(), 100);
  }

  // Garment types we surface in the filter panel + chips, with friendly labels
  // matching the seed in pricing_configs. Keep in sync if a new garment_type
  // ever ships in the CRM.
  // 2026-06-10: switched from the old garment_type buckets to the corrected
  // `category` taxonomy (catalog re-tag). The sidebar now reads p.category and
  // the chips send ?type=<category> (the API maps it to category_effective).
  const GARMENT_TYPES = [
    ['tshirt','T-shirts'], ['longsleeve','Long sleeves'], ['tank','Tank tops'],
    ['performance_shirt','Performance / tech'], ['polo','Polos'], ['woven_shirt','Button-up shirts'],
    ['hoodie','Hoodies'], ['crewneck','Crewnecks'], ['quarter_zip','Quarter-zips'],
    ['sweater','Sweaters'], ['cardigan','Cardigans'], ['jacket','Jackets & outerwear'],
    ['vest','Vests'], ['joggers','Joggers'], ['sweatpants','Sweatpants'],
    ['shorts','Shorts'], ['pants','Pants'], ['leggings','Leggings'],
    ['jersey','Sports jerseys'], ['coverall','Coveralls'], ['scrubs','Scrubs'],
    ['apron','Aprons'], ['hat','Hats / caps'], ['beanie','Beanies / toques'],
    ['visor','Visors'], ['bag','Bags / backpacks'], ['scarf','Scarves'],
    ['gloves','Gloves'], ['socks','Socks'], ['headband','Headbands'],
    ['blanket','Blankets'], ['towel','Towels'], ['other','Other'],
  ];

  // Catalog API endpoint — singhsprint-crm Vercel project
  const CATALOG_API = 'https://singhsprint-crm.vercel.app/api/catalog';
  const IMAGE_PROXY = 'https://singhsprint-crm.vercel.app/api/image-proxy';

  // S&S Activewear started 403'ing direct hotlinks from external pages, so
  // every supplier image is routed through our /api/image-proxy endpoint
  // (server-side fetch with auth + 24h edge cache). Local /images/* URLs and
  // anything already on singhsprint.com is passed through untouched.
  // Both S&S and Blanks.ca started 403'ing direct hotlinks from external
  // referrers, so every supplier image gets routed through our
  // /api/image-proxy (server-side fetch with auth + 24h edge cache).
  // Local /images/* paths and anything already on singhsprint.com get
  // passed through untouched.
  const PROXIED_HOSTS = ['ssactivewear.com', 'blanks.ca', 'sanmarcanada.com'];
  // Optional `w` asks the proxy to downscale + re-encode to WebP (clamped
  // 32–2000 server-side, 30-day edge cache per width). Thumbnails/swatches
  // pass a width so the grid stops pulling full-res 200–300KB supplier
  // photos; omit `w` where full resolution matters.
  function imgUrl(raw, w) {
    if (!raw) return '/images/product-tshirt-white.jpg';
    if (raw.startsWith('/') || raw.indexOf('singhsprint.com') >= 0) return raw;
    if (PROXIED_HOSTS.some(h => raw.indexOf(h) >= 0)) {
      return IMAGE_PROXY + '?url=' + encodeURIComponent(raw) + (w ? '&w=' + w : '');
    }
    return raw;
  }

  function getQueryParam(name) {
    const m = new URLSearchParams(location.search).get(name);
    return m || null;
  }

  // =========================================================================
  // Fetch
  // =========================================================================
  async function fetchPage() {
    var _rspB = document.getElementById('rspBanner');
    if (_rspB) _rspB.style.display = state.filters.canadian ? 'block' : 'none';
    if (state.loading || state.done) return;
    state.loading = true;
    document.getElementById('catLoading').style.display = state.page === 0 ? 'none' : 'block';

    // ----------------------------------------------------------------------
    // ALGOLIA PATH — when /catalog-algolia.js has loaded with valid config,
    // route through Algolia's hosted index. Each request pulls 30 hits
    // server-side-filtered, so the browser never holds more than a couple
    // hundred products in memory even on the deepest scroll. The scroll
    // handler at the bottom of this file already calls fetchPage() on
    // approach to the bottom, which acts as natural infinite-scroll.
    // ----------------------------------------------------------------------
    if (window.SPCatalog) {
      try {
        const isFirstPage = state.page === 0;
        const r = await window.SPCatalog.search({
          type:           state.filters.type,
          brands:         state.filters.brand,
          canadian:       state.filters.canadian,
          csa:            state.filters.csa,
          inStockOnly:    state.filters.inStockOnly,
          q:              state.filters.q,
          // New derived facet filters.
          colorFamilies:  state.filters.colorFamilies,
          genders:        state.filters.genders,
          fabricFamilies: state.filters.fabricFamilies,
          weightClasses:  state.filters.weightClasses,
          sizes:          state.filters.sizes,
          priceMin:       state.filters.priceMin,
          priceMax:       state.filters.priceMax,
          page:           state.page,
          hitsPerPage:    30,
          qty:            state.qty,    // bridge resolves prices_by_qty[qty]
        });
        const fresh = r.products || [];
        state.products = isFirstPage ? fresh : state.products.concat(fresh);
        state.page = state.page + 1;
        state.done = state.page >= (r.totalPages || 1) || fresh.length === 0;
        state._algoliaFacets = r.facets;
        state._algoliaTotal  = r.total;
        render();
      } catch (e) {
        console.error('Algolia search failed; falling back to empty state:', e);
        if (state.page === 0) state.products = [];
        render();
      } finally {
        state.loading = false;
        document.getElementById('catLoading').style.display = 'none';
      }
      return;
    }

    // ----------------------------------------------------------------------
    // LEGACY PATH — direct /api/catalog two-phase fetch. Kept as a fallback
    // when /catalog-algolia.js fails to load or window.SP_ALGOLIA_CONFIG is
    // intentionally cleared.
    //   phase 1 — limit=120 (~520 KB) renders the first ~5 rows quickly
    //   phase 2 — fires in the background after first paint completes,
    //             pulls the full set (limit=20000, paginated server-side) and appends.
    // ----------------------------------------------------------------------
    const params = new URLSearchParams();
    if (state.filters.type)        params.set('type', state.filters.type);
    if (state.filters.q)           params.set('q', state.filters.q);
    if (state.filters.canadian)    params.set('canadian', '1');
    if (state.filters.csa)         params.set('csa', '1');
    state.filters.brand.forEach(b => params.append('brand', b));
    const FIRST_PAGE = 120;
    params.set('limit', String(FIRST_PAGE));
    // Drive the "From $X" cards by the customer-chosen qty (default 50).
    if (state.qty && state.qty !== 50) params.set('qty', String(state.qty));

    try {
      // Prefer the early-fired fetch kicked off from <head>. Only valid
      // on the very first paint (state.page===0). Saves ~150-300 ms vs
      // starting the fetch after the main script parses.
      let data;
      if (state.page === 0 && window.__SP_EARLY_CATALOG__) {
        data = await window.__SP_EARLY_CATALOG__;
        window.__SP_EARLY_CATALOG__ = null;
      }
      if (!data) {
        const res = await fetch(`${CATALOG_API}?${params.toString()}`);
        if (!res.ok) throw new Error(res.status);
        data = await res.json();
      }
      const fresh = data.products || [];
      state.products = fresh;
      // If we got the full set in one shot (filtered view smaller than
      // the page), mark done. Otherwise schedule the backfill.
      state.done = fresh.length < FIRST_PAGE;
      render();

      // Phase 2: backfill the rest in the background. Only when there's
      // likely more (we hit the page limit). Doesn't block first paint —
      // schedule via requestIdleCallback when available, setTimeout
      // otherwise.
      if (!state.done) {
        const bgToken = (state._bgFetchToken = (state._bgFetchToken || 0) + 1);
        const runBackfill = () => {
          const p2 = new URLSearchParams(params);
          p2.set('limit', '20000');
          fetch(`${CATALOG_API}?${p2.toString()}`)
            .then(r => r.ok ? r.json() : null)
            .then(d2 => {
              // Discard if a newer fetch has started since (filter change).
              if (state._bgFetchToken !== bgToken) return;
              const all = (d2 && d2.products) || [];
              if (all.length > state.products.length) {
                state.products = all;
                state.done = true;
                render();
              }
            })
            .catch(() => { /* best-effort */ });
        };
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(runBackfill, { timeout: 2000 });
        } else {
          setTimeout(runBackfill, 800);
        }
      }
    } catch (e) {
      // Empty-state fallback — until the S&S sync runs, render a curated mock so
      // the page isn't broken in front of customers.
      if (state.products.length === 0) {
        state.products = mockProducts();
        state.done = true;
        render();
      }
      console.warn('catalog fetch failed:', e);
    } finally {
      state.loading = false;
      document.getElementById('catLoading').style.display = 'none';
    }
  }

  // =========================================================================
  // Render
  // =========================================================================
  // Number of cards to inject synchronously on first paint. Above the
  // fold + a little buffer so the user sees a full grid immediately
  // instead of skeletons → flash → real cards. Remainder is rendered
  // in idle chunks below (requestIdleCallback) so the main thread isn't
  // pegged for 200 ms while 200 cards build their swatch grids.
  const INITIAL_RENDER = 24;
  const CHUNK_SIZE     = 12;

  // Emit an ItemList of Product JSON-LD entries for the currently visible
  // catalog. Google indexes JS-injected JSON-LD reliably and this is the
  // cheapest way to surface 1,100 individual blanks as searchable Product
  // entities without spinning up a separate URL per SKU. Re-injected on
  // every render so filter/sort changes refresh the structured data too.
  function emitCatalogJsonLd(visible) {
    try {
      var prev = document.getElementById('catalog-itemlist-jsonld');
      if (prev) prev.remove();
      if (!Array.isArray(visible) || visible.length === 0) return;
      // Cap the entity count so the page doesn't bloat for huge result sets.
      // Google only really uses the first ~100 anyway.
      var slice = visible.slice(0, 100);
      var BASE = 'https://www.singhsprint.com';
      // Brand-level enrichment reused across every emitted Product entity so
      // Google's "Product snippet" + "Merchant listing" rich-results validate.
      // Mirrors the values in scripts/generate-product-pages.mjs — edit both.
      var SHIPPING_DETAILS = {
        '@type': 'OfferShippingDetails',
        'shippingRate':        { '@type': 'MonetaryAmount',  'value': '0', 'currency': 'CAD' },
        'shippingDestination': { '@type': 'DefinedRegion',   'addressCountry': 'CA' },
        'deliveryTime': {
          '@type': 'ShippingDeliveryTime',
          'handlingTime': { '@type': 'QuantitativeValue', 'minValue': 7, 'maxValue': 10, 'unitCode': 'DAY' },
          'transitTime':  { '@type': 'QuantitativeValue', 'minValue': 1, 'maxValue': 5,  'unitCode': 'DAY' }
        }
      };
      var RETURN_POLICY = {
        '@type': 'MerchantReturnPolicy',
        'applicableCountry':    'CA',
        'returnPolicyCategory': 'https://schema.org/MerchantReturnFiniteReturnWindow',
        'merchantReturnDays':   14,
        'returnMethod':         'https://schema.org/ReturnByMail',
        'returnFees':           'https://schema.org/FreeReturn'
      };
      var AGGREGATE_RATING = {
        '@type': 'AggregateRating',
        'ratingValue': '5.0',
        'reviewCount': '23',
        'bestRating':  '5',
        'worstRating': '1'
      };
      var REVIEWS_LIST = [
        { name: 'Coodin',      date: '2024-06-01', body: 'Printed tees for my band on extremely short notice. Literally on the same day of our gig at Singhs Arcade. If you want a print shop that actually values their customers and isn’t strictly for profit, this is the place. 10/10' },
        { name: 'Keerit Kaur', date: '2024-04-15', body: 'Really happy with my order, the prints came out perfect, quality was great, and they got everything done on time.' },
        { name: 'Ori Peer',    date: '2024-03-10', body: 'I love my shirt they supported my vision!!! Best spot in MTL!' }
      ].map(function(r) {
        return {
          '@type': 'Review',
          'author':        { '@type': 'Person', 'name': r.name },
          'datePublished': r.date,
          'reviewRating':  { '@type': 'Rating', 'ratingValue': '5', 'bestRating': '5' },
          'reviewBody':    r.body
        };
      });

      var list = slice.map(function(p, i) {
        var heroColor = (p.colors || [])[0] || {};
        var heroImg = imgUrl(heroColor.mockup_front_url || p.hero_image_url || '');
        var prod = {
          '@type': 'Product',
          'name': ((p.brand || '') + ' ' + (p.style_number || '') + ' — ' + (p.name || '')).replace(/\s+/g, ' ').trim(),
          'brand': { '@type': 'Brand', 'name': p.brand || '' },
          'sku': p.style_number || p.product_id,
          'mpn': p.style_number || undefined,
          'image': heroImg ? [heroImg] : undefined,
          'description': (p.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500) || ((p.brand || '') + ' ' + (p.name || '') + ' decorated by Singhs Print Montreal — DTG, DTF, embroidery or screen.'),
          'category': p.garment_type || 'Custom Apparel',
          'url': BASE + '/catalog.html#p=' + encodeURIComponent(p.product_id || ''),
          'aggregateRating': AGGREGATE_RATING,
          'review':          REVIEWS_LIST,
          'offers': (typeof p.price_from === 'number' && p.price_from > 0) ? {
            '@type': 'Offer',
            'priceCurrency': 'CAD',
            'price': p.price_from.toFixed(2),
            'availability': (p.in_stock === false) ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
            'priceValidUntil': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            'seller': { '@id': BASE + '/#business' },
            'url': BASE + '/catalog.html#p=' + encodeURIComponent(p.product_id || ''),
            'shippingDetails':         SHIPPING_DETAILS,
            'hasMerchantReturnPolicy': RETURN_POLICY
          } : undefined
        };
        // Strip undefined keys so the JSON stays clean.
        Object.keys(prod).forEach(function(k){ if (prod[k] === undefined) delete prod[k]; });
        return { '@type': 'ListItem', 'position': i + 1, 'item': prod };
      });
      var payload = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': BASE + '/catalog.html#itemlist',
        'name': 'Singhs Print blank apparel catalog',
        'itemListOrder': 'https://schema.org/ItemListOrderAscending',
        'numberOfItems': slice.length,
        'itemListElement': list
      };
      var s = document.createElement('script');
      s.type = 'application/ld+json';
      s.id = 'catalog-itemlist-jsonld';
      s.textContent = JSON.stringify(payload);
      document.head.appendChild(s);
    } catch (e) { /* never break the page over a schema emit */ }
  }

  function render() {
    const grid = document.getElementById('catGrid');
    const empty = document.getElementById('catEmpty');
    grid.innerHTML = '';

    // Chip strip always re-renders so toggle state reflects current
    // filters even when the result set is empty. Previously this lived
    // below the early-return for empty.products, which left the
    // Canadian-made / Hi-Vis-CSA / brand chips visually stuck on
    // their previous state when a filter narrowed to zero hits.
    renderChips();
    document.getElementById('resultCount').textContent = (state._algoliaTotal != null
      ? state._algoliaTotal
      : state.products.length).toLocaleString();

    if (state.products.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    let visible = state.filters.inStockOnly
      ? state.products.filter(p => p.in_stock !== false)
      : state.products.slice();
    visible = sortProducts(visible, state.sort);
    emitCatalogJsonLd(visible);

    // First chunk: synchronous. The first 6 images get fetchpriority=high
    // so the browser starts pulling them before the rest of the JS runs.
    const head = visible.slice(0, INITIAL_RENDER);
    head.forEach((p, i) => grid.appendChild(productCard(p, { eager: i < 6 })));

    // "Bring your own" card sits at the end; append now if all products fit
    // in the head chunk, otherwise wait until lazy render finishes.
    if (visible.length <= INITIAL_RENDER) {
      grid.appendChild(byoCard());
    }

    // resultCount + chips were already painted at the top of render() so
    // they reflect state on the empty-state path too — no duplicate call.
    if (typeof SP_LANG !== 'undefined' && SP_LANG.applyLang) SP_LANG.applyLang();
    maybeTranslateCatalog();

    // Lazy-render the remainder in idle chunks so the first paint stays
    // snappy. Each chunk yields to the main thread, keeping scroll
    // smooth even on slower devices.
    if (visible.length > INITIAL_RENDER) {
      lazyRenderRemainder(grid, visible.slice(INITIAL_RENDER));
    }
  }

  function lazyRenderRemainder(grid, rest) {
    let i = 0;
    const ric = window.requestIdleCallback || function (cb) { return setTimeout(cb, 16); };
    function pump() {
      ric(function () {
        const end = Math.min(i + CHUNK_SIZE, rest.length);
        for (; i < end; i++) {
          grid.appendChild(productCard(rest[i], { eager: false }));
        }
        if (i < rest.length) {
          pump();
        } else {
          // Append the "Bring your own" card once the full grid is in place.
          grid.appendChild(byoCard());
          // Re-apply lang + AI translate to the freshly-rendered cards.
          if (typeof SP_LANG !== 'undefined' && SP_LANG.applyLang) SP_LANG.applyLang();
          maybeTranslateCatalog();
        }
      });
    }
    pump();
  }

  // ===== AI translate overlay for dynamic catalog content =====
  // Translates product names + color names on cards (and inside the
  // detail modal) when SP_LANG is 'fr'. Static UI strings still go
  // through lang.js. We use data-orig-en attributes so flipping back
  // to EN is instant — no network.
  function isAITranslateActive() {
    return typeof SP_LANG !== 'undefined' && SP_LANG.getLang && SP_LANG.getLang() === 'fr';
  }
  function maybeTranslateCatalog() {
    var grid = document.getElementById('catGrid');
    var badge = document.getElementById('aiTransBadge');
    if (!window.AITranslate || !grid) return;
    if (!isAITranslateActive()) {
      window.AITranslate.restoreContainer(grid);
      if (badge) badge.style.display = 'none';
      return;
    }
    if (badge) badge.style.display = 'block';
    // Translate product names + currently-selected color labels on each card.
    window.AITranslate.translateContainer(grid,
      ['.card .name', '.card .selected-color-name'], 'fr', 6);
  }
  function maybeTranslateDetailModal() {
    var modal = document.getElementById('detailModal');
    if (!window.AITranslate || !modal) return;
    if (!isAITranslateActive()) {
      window.AITranslate.restoreContainer(modal);
      return;
    }
    window.AITranslate.translateContainer(modal,
      ['#detailModalTitle', '.detail-modal__swatch-name',
       '#detailModalSelectedColor', '#detailModalSpecs li'],
      'fr', 6);
  }
  // Re-translate whenever the language toggles.
  document.addEventListener('sp-lang-change', function () {
    maybeTranslateCatalog();
    maybeTranslateDetailModal();
  });

  function productCard(p, opts) {
    // Card is now a clickable surface (not an anchor). Whole-card click =
    // "add to cart with the currently-selected color". Swatches inside it
    // act as a color picker for THIS card — clicking one selects the color
    // without adding to the cart. A small "Details" link in the corner
    // still allows the legacy single-product flow.
    //
    // opts.eager = first row cards get fetchpriority="high" + loading="eager"
    // so the LCP image starts coming down before the rest of the JS runs.
    opts = opts || {};
    const card = document.createElement('div');
    card.className = 'card card--clickable';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    // Tagged so the program-catalog filter (in /account/program-catalog-filter.js)
    // can hide / show cards based on the signed-in user's program whitelist.
    if (p.product_id) card.setAttribute('data-product-id', p.product_id);
    if (p.in_stock === false) card.classList.add('card--oos');

    // Track the selected color INDEX per card.
    //   1) If a Color filter is active, prefer a colorway whose family matches
    //      one of the selected filters — so picking "Red" makes every card
    //      actually show its red colorway, not whatever happened to be first.
    //   2) Otherwise, default to the first in-stock color.
    //   3) Otherwise, index 0.
    const filterIdx     = pickColorByFilter(p, state.filters.colorFamilies);
    const firstInStockIdx = (p.colors || []).findIndex(c => Array.isArray(c.sizes_in_stock) && c.sizes_in_stock.length > 0);
    card._selectedColorIdx = filterIdx >= 0
      ? filterIdx
      : (firstInStockIdx >= 0 ? firstInStockIdx : 0);

    let badge = '';
    if (p.in_stock === false)                                            badge = `<div class="badge badge--oos" data-i18n="cat.card.oos">Out of stock</div>`;
    else if (typeof p.color_count === 'number' && p.color_count > 0 && p.color_count <= 2)
                                                                         badge = `<div class="badge badge--low" data-i18n="cat.card.low">Low stock</div>`;
    else if (p.bestseller)                                               badge = `<div class="badge badge--bestseller" data-i18n="cat.card.bestseller">★ Bestseller</div>`;
    else if (p.is_canadian_made)                                         badge = `<div class="badge badge--canadian" data-i18n="cat.card.canadian">🇨🇦 Canadian</div>`;
    else if (p.has_csa_cert)                                             badge = `<div class="badge badge--csa" data-i18n="cat.card.csa">CSA Hi-Vis</div>`;

    // Catalog cards display up to 24 swatches in a 2-row wrap (16px × 2 rows
    // fits inside max-height:44px). Anything past 24 surfaces as "+N" so giant
    // colorways like Gildan 18500 (75 colors) still get accurate signal —
    // before this we capped at 8 and a 75-color blank showed "8 + 67".
    // Card view shows a tidy row of 8 swatches with a "+N more" indicator
    // past that — turning a 75-color Gildan 5000 card into a wall of
    // chips drowns out the product photo and price. The detail modal
    // (click the card) shows EVERY color in a proper grid with names,
    // which is the right UX for browsing colorways anyway.
    const SWATCH_LIMIT = 8;
    const renderSwatches = () => {
      return (p.colors || []).slice(0, SWATCH_LIMIT).map((c, i) => {
        // Multi-tone colorways ("BLACK/GRAPHITE", "Black/Red", most
        // Blanks.ca complex shades, all hi-vis stripe patterns) have no
        // parseable single hex — but they always have a swatch_image_url
        // or mockup_front_url we can drop in as a background image.
        // Falling back to that keeps the chip looking like the actual
        // colorway instead of a generic grey #ccc placeholder.
        const hex     = c.hex_code;
        const swatch  = c.swatch_image_url || c.mockup_front_url;
        const useImg  = !hex && swatch;
        const light   = hex ? isLight(hex) : false;
        const bg      = useImg ? `url(${imgUrl(swatch, 64)}) center/cover #f3f1ea` : (hex || '#ccc');
        const hasStock = Array.isArray(c.sizes_in_stock) && c.sizes_in_stock.length > 0;
        const oosCls = hasStock ? '' : 'swatch--oos';
        const selected = i === card._selectedColorIdx ? 'swatch--selected' : '';
        const cleanName = (c.color_name || '').replace(/_\d+$/, '');
        return `<button type="button" class="swatch ${light ? 'is-light' : ''} ${oosCls} ${selected}" style="background:${bg}" title="${cleanName}${hasStock ? '' : ' (out of stock)'}" data-idx="${i}" aria-label="${cleanName}"></button>`;
      }).join('');
    };
    const extra = p.colors.length > SWATCH_LIMIT ? `<span class="more">+${p.colors.length - SWATCH_LIMIT}</span>` : '';

    const repaintCard = () => {
      const c = (p.colors || [])[card._selectedColorIdx] || {};
      const photoUrl = imgUrl(c.mockup_front_url || p.hero_image_url, 480);
      const img = card.querySelector('.photo img');
      if (img) img.src = photoUrl;
      const colorLabel = card.querySelector('.selected-color-name');
      if (colorLabel) colorLabel.textContent = (c.color_name || '').replace(/_\d+$/, '');
      // Update swatch selection state
      card.querySelectorAll('.swatch').forEach((s, i) => {
        s.classList.toggle('swatch--selected', i === card._selectedColorIdx);
      });
    };

    const heroColor = (p.colors || [])[card._selectedColorIdx] || {};
    const photoUrl = imgUrl(heroColor.mockup_front_url || p.hero_image_url, 480);

    card.innerHTML = `
      ${badge}
      <div class="photo"><img src="${esc(photoUrl)}" alt="${esc((p.brand || '') + ' ' + (p.style_number || ''))}" loading="${opts.eager ? 'eager' : 'lazy'}" decoding="async"${opts.eager ? ' fetchpriority="high"' : ''}/></div>
      <div class="body">
        <div class="brand-row">${esc((p.brand || '').toUpperCase())} · ${esc(p.style_number || '')}</div>
        <div class="name">${esc(p.name)}</div>
        <div class="swatches">${renderSwatches()}${extra}</div>
        <div class="selected-color-name" style="font-size:.72rem;color:var(--soft);min-height:1em;margin-bottom:6px">${esc((heroColor.color_name || '').replace(/_\d+$/, ''))}</div>
        <div class="price">${typeof p.price_from === 'number' && p.price_from > 0 ? `<span data-i18n="cat.card.from">From</span> <strong>$${p.price_from.toFixed(2)}</strong><span data-i18n="cat.card.perunit">/unit</span> · <span class="price-meta" data-i18n="cat.card.oneside">1-side print</span>` : `<strong data-i18n="cat.card.quote-on-request">Quote on request</strong>`}${p.weight_oz ? ' · <span class="price-meta">' + p.weight_oz + ' oz</span>' : ''}</div>
        <div class="card-cta">
          <span class="card-cta__main" data-i18n="cat.card.view-details-cta">View details &amp; add</span>
          <span class="card-cta__sub"><span class="card-cta__qty">${state.qty}</span> <span data-i18n="cat.card.units-at-tier">units · adjust qty later</span></span>
        </div>
      </div>
    `;

    // Swatch clicks pick a color, don't trigger the whole-card add.
    card.querySelectorAll('.swatch').forEach(s => {
      s.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const idx = parseInt(s.dataset.idx, 10);
        if (Number.isFinite(idx)) {
          card._selectedColorIdx = idx;
          repaintCard();
        }
      });
    });

    // "View details ↗" opens the full-product modal — and crucially stops
    // propagation so clicking it doesn't also fire the whole-card add.
    const detailsBtn = card.querySelector('.card-details-link');
    if (detailsBtn) {
      detailsBtn.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        openProductDetail(p);
      });
    }

    // Whole-card click → open the detail modal (where the customer can
    // browse front/back/side mockups, zoom them, switch colors, and add
    // to quote). Used to add-to-quote on click, but that hid the rest of
    // the product's images behind a second click — now everyone goes
    // through the detail view as the canonical product surface.
    const openDetail = (ev) => {
      ev.preventDefault();
      openProductDetail(p, card._selectedColorIdx);
    };
    card.addEventListener('click', openDetail);
    card.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') openDetail(ev);
    });

    return card;
  }

  // HTML-escape helper for values interpolated into innerHTML templates.
  // Catalog data comes from the S&S supplier feed via /api/catalog; escaping
  // is defense-in-depth against a malicious product name/brand/colour string
  // (added 2026-06-05 security audit).
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function byoCard() {
    const a = document.createElement('a');
    a.className = 'card card-byo';
    a.href = '/quote.html?source=byo';
    a.innerHTML = `
      <div class="add">+</div>
      <strong data-i18n="cat.byo.title">Bring your own blank</strong>
      <span data-i18n="cat.byo.sub">Got a SKU or tech pack? Send it over — we'll source and quote it.</span>
    `;
    return a;
  }

  function isLight(hex) {
    if (!hex) return false;
    const h = hex.replace('#','');
    const r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
    return (r*299 + g*587 + b*114) / 1000 > 200;
  }

  // ---------------------------------------------------------------------------
  // Client-side color-family bucketing — mirrors the sync-time helper in
  // scripts/sync-algolia.mjs. Used to find a colorway whose hex maps to the
  // currently-active Color filter so we can pre-select the matching swatch
  // (and use its mockup as the card hero) instead of just showing whatever
  // color happened to come first in the colors[] array.
  // ---------------------------------------------------------------------------
  function hexToColorFamily(hex) {
    if (typeof hex !== 'string') return null;
    const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
    if (!m) return null;
    const num = parseInt(m[1], 16);
    const r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
    const rn = r/255, gn = g/255, bn = b/255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const L = (max + min) / 2;
    const D = max - min;
    const S = D === 0 ? 0 : D / (1 - Math.abs(2 * L - 1));
    let H = 0;
    if (D !== 0) {
      if      (max === rn) H = 60 * (((gn - bn) / D) % 6);
      else if (max === gn) H = 60 * ((bn - rn) / D + 2);
      else                 H = 60 * ((rn - gn) / D + 4);
      if (H < 0) H += 360;
    }
    if (L >= 0.92) return 'white';
    if (L <= 0.08) return 'black';
    if (S <  0.12) return 'grey';
    if (H < 15)   return 'red';
    if (H < 45)   return L < 0.4 ? 'brown' : 'orange';
    if (H < 70)   return 'yellow';
    if (H < 170)  return 'green';
    if (H < 200)  return 'teal';
    if (H < 255)  return 'blue';
    if (H < 290)  return 'purple';
    if (H < 335)  return 'pink';
    return 'red';
  }
  function colorFamilyOf(c) {
    if (!c) return null;
    const fam = hexToColorFamily(c.hex_code);
    if (fam) return fam;
    const n = String(c.color_name || '').toLowerCase();
    if (/(black|onyx|jet|coal)/.test(n))           return 'black';
    if (/(white|ivory|cream|natural|bone)/.test(n)) return 'white';
    if (/(red|crimson|cherry|burgundy|maroon|wine)/.test(n)) return 'red';
    if (/(orange|rust|tangerine|copper)/.test(n))  return 'orange';
    if (/(yellow|gold|mustard|lemon)/.test(n))     return 'yellow';
    if (/(green|olive|forest|mint|kelly|sage|hunter)/.test(n)) return 'green';
    if (/(teal|turquoise|aqua|cyan)/.test(n))      return 'teal';
    if (/(blue|navy|royal|cobalt|denim|indigo|sapphire)/.test(n)) return 'blue';
    if (/(purple|violet|lavender|plum|orchid|lilac)/.test(n)) return 'purple';
    if (/(pink|fuchsia|magenta|rose|salmon|coral)/.test(n)) return 'pink';
    if (/(brown|tan|khaki|chocolate|mocha|sand|camel|beige)/.test(n)) return 'brown';
    if (/(grey|gray|charcoal|silver|graphite|heather|smoke|steel)/.test(n)) return 'grey';
    return null;
  }
  // Given a product and a set of selected color-family filters, find the
  // first in-stock colorway whose family matches. Returns -1 if none.
  function pickColorByFilter(p, filters) {
    if (!filters || !filters.length) return -1;
    const colors = p.colors || [];
    const want = new Set(filters);
    // Prefer in-stock matches; fall back to any match if none have stock.
    let firstAnyMatch = -1;
    for (let i = 0; i < colors.length; i++) {
      const fam = colorFamilyOf(colors[i]);
      if (!fam || !want.has(fam)) continue;
      const inStock = Array.isArray(colors[i].sizes_in_stock) && colors[i].sizes_in_stock.length > 0;
      if (inStock) return i;
      if (firstAnyMatch < 0) firstAnyMatch = i;
    }
    return firstAnyMatch;
  }

  // =========================================================================
  // Sort
  // =========================================================================
  function sortProducts(list, mode) {
    const arr = list.slice();
    switch (mode) {
      case 'price_asc':  return arr.sort((a, b) => (a.price_from ?? 9e9) - (b.price_from ?? 9e9));
      case 'price_desc': return arr.sort((a, b) => (b.price_from ?? -1)   - (a.price_from ?? -1));
      case 'name_asc':   return arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      case 'brand_asc':  return arr.sort((a, b) => (a.brand || '').localeCompare(b.brand || '') || (a.style_number || '').localeCompare(b.style_number || ''));
      case 'bestseller':
      default:
        // Heuristic: in-stock first, then by color_count desc (more options =
        // popular SKU), then alphabetical.
        return arr.sort((a, b) => {
          const sa = a.in_stock === false ? 1 : 0;
          const sb = b.in_stock === false ? 1 : 0;
          if (sa !== sb) return sa - sb;
          const ca = a.color_count || 0, cb = b.color_count || 0;
          if (ca !== cb) return cb - ca;
          return (a.brand || '').localeCompare(b.brand || '');
        });
    }
  }
  function setSort(mode) { state.sort = mode; render(); }

  // =========================================================================
  // Filter panel — populated from the products already loaded so we don't need
  // a separate facets API. Brand list, garment-type list, and Canadian/CSA
  // toggles all live here. Apply re-runs render() (or refetches if needed).
  // =========================================================================
  function renderFilterPanel() {
    const body = document.getElementById('filterBody');
    if (!body) return;

    // Build brand list from the currently-loaded products. Suppliers store
    // the same brand under inconsistent strings: "NIKE", "Nike®", and
    // "Nike" all appear as separate rows in raw data. We collapse them by
    // a normalized key (lowercase, strip ®/™/©) and keep the cleanest
    // display label. The API's ilike search is case-insensitive so a
    // single "Nike" filter still catches every casing variant in the DB.
    function normBrand(s) {
      return (s || '').replace(/[®™©]/g, '').toLowerCase().trim();
    }
    function brandLabelScore(s) {
      let sc = 0;
      if (/[®™©]/.test(s))            sc -= 3;   // trademark marks: ugly
      if (s === s.toUpperCase() && s.length > 3) sc -= 2; // ALL CAPS: shouty
      if (/^[A-Z][a-z]/.test(s))      sc += 2;   // Title Case: clean
      return sc;
    }
    const brandMap = new Map();
    state.products.forEach(p => {
      if (!p.brand) return;
      const k = normBrand(p.brand);
      if (!k) return;
      const cur = brandMap.get(k);
      if (!cur) {
        brandMap.set(k, { label: p.brand, count: 1 });
      } else {
        cur.count++;
        if (brandLabelScore(p.brand) > brandLabelScore(cur.label)) cur.label = p.brand;
      }
    });

    const typeCounts = {};
    state.products.forEach(p => {
      const cat = p.category || p.garment_type;
      if (!cat) return;
      typeCounts[cat] = (typeCounts[cat] || 0) + 1;
    });

    // Sort types by count desc, then alphabetically — most populous shows
    // first. Sort brands by count desc too (already does — but capped at
    // 200 so the search-box filter below has room to shine).
    const orderedTypes = GARMENT_TYPES
      .filter(([gt]) => typeCounts[gt])
      .sort((a, b) => (typeCounts[b[0]] || 0) - (typeCounts[a[0]] || 0));
    const orderedBrands = Array.from(brandMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 200)
      .map(b => [b.label, b.count]);

    body.innerHTML = `
      <div style="padding:18px 22px">
        <div class="filter-group" style="margin-bottom:24px">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--soft);margin-bottom:12px">Garment type</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${orderedTypes.map(([gt, label]) => {
              const active = state.filters.type === gt;
              return `
              <button type="button" data-type="${gt}"
                onclick="toggleType('${gt}')"
                style="font-size:.84rem;padding:8px 14px;border-radius:50px;border:1px solid ${active ? 'var(--ink)' : 'var(--line)'};background:${active ? 'var(--ink)' : '#fff'};color:${active ? '#fff' : 'var(--ink)'};cursor:pointer;font-family:inherit;font-weight:${active ? 600 : 500};display:inline-flex;align-items:center;gap:8px;transition:all .15s">
                <span>${label}</span>
                <span style="font-size:.74rem;color:${active ? 'rgba(255,255,255,.65)' : 'var(--soft)'};font-weight:500">${typeCounts[gt]}</span>
              </button>`;
            }).join('')}
          </div>
        </div>

        <div class="filter-group" style="margin-bottom:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--soft)">Brand</div>
            <span style="font-size:.74rem;color:var(--soft)">${orderedBrands.length} total</span>
          </div>
          <input type="text" id="brandSearch" placeholder="Search brands…" oninput="filterBrandList(this.value)"
            style="width:100%;padding:9px 12px;border:1px solid var(--line);border-radius:8px;font-size:.86rem;font-family:inherit;margin-bottom:10px;background:#fafaf7"/>
          <div id="brandList" style="display:flex;flex-direction:column;max-height:300px;overflow-y:auto;border-top:1px solid var(--line)">
            ${orderedBrands.map(([b, n]) => `
              <label data-brand-row="${esc(b.toLowerCase())}" style="display:flex;align-items:center;gap:10px;font-size:.88rem;cursor:pointer;padding:8px 2px;border-bottom:1px solid #f0eee7">
                <input type="checkbox" ${state.filters.brand.includes(b) ? 'checked' : ''}
                  onchange="toggleBrand('${b.replace(/'/g, "\\'")}', this.checked)" style="accent-color:var(--ink);width:15px;height:15px"/>
                <span style="flex:1">${esc(b)}</span>
                <span style="color:var(--soft);font-size:.78rem">${n}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="filter-group" style="margin-bottom:8px">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--soft);margin-bottom:12px">Special</div>
          <label style="display:flex;align-items:center;gap:10px;font-size:.9rem;cursor:pointer;padding:8px 0;border-bottom:1px solid #f0eee7">
            <input type="checkbox" ${state.filters.inStockOnly ? 'checked' : ''} onchange="state.filters.inStockOnly = this.checked; resetAndFetch()" style="accent-color:var(--ink);width:15px;height:15px"/>
            <span>In stock only</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:.9rem;cursor:pointer;padding:8px 0;border-bottom:1px solid #f0eee7">
            <input type="checkbox" ${state.filters.canadian ? 'checked' : ''} onchange="state.filters.canadian = this.checked; commitFilters()" style="accent-color:var(--ink);width:15px;height:15px"/>
            <span>🇨🇦 Canadian-made blanks</span>
          </label>
          <label style="display:flex;align-items:center;gap:10px;font-size:.9rem;cursor:pointer;padding:8px 0">
            <input type="checkbox" ${state.filters.csa ? 'checked' : ''} onchange="state.filters.csa = this.checked; commitFilters()" style="accent-color:var(--ink);width:15px;height:15px"/>
            <span>CSA / Hi-vis certified</span>
          </label>
        </div>

        ${renderColorFamilyGroup()}
        ${renderGenderGroup()}
        ${renderFabricGroup()}
        ${renderSizesGroup()}
        ${renderWeightGroup()}
        ${renderPriceGroup()}
      </div>
    `;
  }

  // =========================================================================
  // Filter panel — derived facet sections.
  //
  // Each renderer pulls counts from state._algoliaFacets when it's available
  // (set on every Algolia response in fetchPage), so chip rows show "(214)"
  // next to each option for the currently-active filter set. When facets
  // haven't been fetched yet, the counts are dropped quietly rather than
  // showing 0s.
  // =========================================================================
  // Visual swatch hex per color family — same buckets the sync emits.
  const COLOR_FAMILY_SWATCHES = {
    red:    '#d63a3a', orange: '#e8862a', yellow: '#efc52b',
    green:  '#2f9e44', teal:   '#0c9d96', blue:   '#1f6fd6',
    purple: '#7e5ad6', pink:   '#e060a3', brown:  '#735239',
    black:  '#111111', white:  '#fafafa', grey:   '#9a9a9a',
  };
  const COLOR_FAMILY_ORDER = ['red','orange','yellow','green','teal','blue','purple','pink','brown','black','white','grey'];

  function facetCounts(field) {
    const f = (state._algoliaFacets || {})[field] || {};
    return f;  // { value: count }
  }

  function chipRow(field, options, isActiveFn, toggleFn) {
    const counts = facetCounts(field);
    return options.map(opt => {
      const [val, label, hex] = Array.isArray(opt) ? opt : [opt, opt, null];
      const active = isActiveFn(val);
      const c = counts[val];
      const swatch = hex
        ? `<span style="width:14px;height:14px;border-radius:50%;border:1px solid rgba(0,0,0,.12);background:${hex};display:inline-block"></span>`
        : '';
      const cap = (label || val).toString();
      const labelHtml = cap.charAt(0).toUpperCase() + cap.slice(1);
      return `<button type="button"
        onclick="${toggleFn}('${val.replace(/'/g,"\\'")}')"
        style="font-size:.84rem;padding:7px 12px;border-radius:50px;border:1px solid ${active ? 'var(--ink)' : 'var(--line)'};background:${active ? 'var(--ink)' : '#fff'};color:${active ? '#fff' : 'var(--ink)'};cursor:pointer;font-family:inherit;font-weight:${active ? 600 : 500};display:inline-flex;align-items:center;gap:6px;transition:all .15s">
          ${swatch}<span>${labelHtml}</span>${typeof c === 'number' ? `<span style="font-size:.72rem;color:${active ? 'rgba(255,255,255,.65)' : 'var(--soft)'};font-weight:500">${c}</span>` : ''}
        </button>`;
    }).join('');
  }

  function filterSection(title, body) {
    return `<div class="filter-group" style="margin-bottom:24px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--soft);margin-bottom:12px">${title}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${body}</div>
    </div>`;
  }

  function renderColorFamilyGroup() {
    const opts = COLOR_FAMILY_ORDER.map(c => [c, c, COLOR_FAMILY_SWATCHES[c]]);
    return filterSection('Color',
      chipRow('color_families', opts, v => state.filters.colorFamilies.includes(v), 'toggleColor')
    );
  }
  function renderGenderGroup() {
    const opts = [['mens','Men'], ['womens','Women'], ['unisex','Unisex'], ['youth','Youth']];
    return filterSection('Gender',
      chipRow('gender', opts, v => state.filters.genders.includes(v), 'toggleGender')
    );
  }
  function renderFabricGroup() {
    const opts = [
      ['cotton','100% cotton'], ['cotton-blend','Cotton blend'],
      ['tri-blend','Tri-blend'], ['polyester','Polyester'],
      ['performance','Performance / wicking'], ['fleece','Fleece'], ['canvas','Canvas'],
    ];
    return filterSection('Fabric',
      chipRow('fabric_family', opts, v => state.filters.fabricFamilies.includes(v), 'toggleFabric')
    );
  }
  function renderWeightGroup() {
    const opts = [
      ['light','Light (≤4.5 oz)'], ['mid','Mid-weight'],
      ['heavy','Heavyweight'], ['outerwear','Outerwear'],
    ];
    return filterSection('Weight',
      chipRow('weight_class', opts, v => state.filters.weightClasses.includes(v), 'toggleWeight')
    );
  }
  function renderSizesGroup() {
    // Pull every size that appears in any loaded product, sorted by the
    // canonical SIZE_ORDER (mirrors the one used in the sync helper).
    const SIZE_ORDER = ['NB','3M','6M','12M','18M','24M','2T','3T','4T','5T',
      'YXS','YS','YM','YL','YXL','XS','S','M','L','XL','2XL','3XL','4XL','5XL','6XL','7XL',
      '28','29','30','31','32','33','34','35','36','38','40','42','44','46','48','50','52','OS'];
    const counts = facetCounts('sizes_available');
    const all = Object.keys(counts);
    if (!all.length) return '';
    all.sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a), bi = SIZE_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return filterSection('Sizes available',
      chipRow('sizes_available', all, v => state.filters.sizes.includes(v), 'toggleSize')
    );
  }
  function renderPriceGroup() {
    const min = state.filters.priceMin ?? '';
    const max = state.filters.priceMax ?? '';
    return `<div class="filter-group" style="margin-bottom:24px">
      <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--soft);margin-bottom:12px">Price per unit (CAD)</div>
      <div style="display:flex;gap:10px;align-items:center">
        <input type="number" min="0" step="1" placeholder="Min" value="${min}"
          oninput="state.filters.priceMin = this.value ? Number(this.value) : null; commitFiltersDebounced()"
          style="width:90px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:.86rem;font-family:inherit;background:#fafaf7"/>
        <span style="color:var(--soft);font-size:.86rem">to</span>
        <input type="number" min="0" step="1" placeholder="Max" value="${max}"
          oninput="state.filters.priceMax = this.value ? Number(this.value) : null; commitFiltersDebounced()"
          style="width:90px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:.86rem;font-family:inherit;background:#fafaf7"/>
        <span style="color:var(--soft);font-size:.78rem">at qty 50</span>
      </div>
    </div>`;
  }

  // Multi-select toggle helpers — flip the chosen value in/out of the
  // matching state.filters array. resetAndFetch reloads with the new set.
  function multiToggle(arrName, val) {
    const cur = state.filters[arrName] || [];
    state.filters[arrName] = cur.includes(val) ? cur.filter(x => x !== val) : cur.concat([val]);
  }
  window.toggleColor   = function (v) { multiToggle('colorFamilies',  v); renderFilterPanel(); commitFilters(); };
  window.toggleGender  = function (v) { multiToggle('genders',        v); renderFilterPanel(); commitFilters(); };
  window.toggleFabric  = function (v) { multiToggle('fabricFamilies', v); renderFilterPanel(); commitFilters(); };
  window.toggleWeight  = function (v) { multiToggle('weightClasses',  v); renderFilterPanel(); commitFilters(); };
  window.toggleSize    = function (v) { multiToggle('sizes',          v); renderFilterPanel(); commitFilters(); };

  // Brand search inside the filter panel — purely client-side; toggles
  // visibility of the label rows by substring match on lowercased brand name.
  window.filterBrandList = function (q) {
    const needle = (q || '').toLowerCase().trim();
    document.querySelectorAll('[data-brand-row]').forEach(el => {
      const hit = !needle || el.getAttribute('data-brand-row').includes(needle);
      el.style.display = hit ? '' : 'none';
    });
  }

  function toggleType(gt)             { state.filters.type = (state.filters.type === gt) ? null : gt; }
  function toggleBrand(brand, on) {
    state.filters.brand = on
      ? Array.from(new Set([...state.filters.brand, brand]))
      : state.filters.brand.filter(b => b !== brand);
  }

  // =========================================================================
  // Chips (top of page)
  // =========================================================================
  function renderChips() {
    const row = document.getElementById('chipRow');
    row.innerHTML = '';
    // Type chips sit in a STABLE order. Active state transforms the chip in
    // place rather than jumping it to the front — way less disorienting.
    // No "Hi-Vis" type chip — the "Hi-Vis / CSA" qualifier chip below
    // (which filters on the broader is_hivis_or_csa Algolia facet)
    // already covers everything the strict garment_type=hivis bucket
    // would catch, plus the products whose hi-vis flag wasn't set at
    // import time but whose name contains hi-vis/csa/ansi.
    const types = [
      ['tshirt','T-Shirts'], ['hoodie','Hoodies'], ['crewneck','Crewnecks'],
      ['polo','Polos'], ['longsleeve','Long Sleeves'], ['hat','Hats / Caps'],
      ['bag','Tote Bags']
    ];
    types.forEach(([t, label]) => {
      const isActive = state.filters.type === t;
      row.appendChild(makeChip(label, isActive ? 'active' : 'passive', () => {
        state.filters.type = isActive ? null : t;
        resetAndFetch();
      }));
    });

    // Qualifier toggles — Canadian / Hi-Vis
    row.appendChild(makeChip('🇨🇦 Canadian', state.filters.canadian ? 'active' : 'passive', () => {
      state.filters.canadian = !state.filters.canadian; resetAndFetch();
    }));
    row.appendChild(makeChip('Hi-Vis / CSA', state.filters.csa ? 'active' : 'passive', () => {
      state.filters.csa = !state.filters.csa; resetAndFetch();
    }));

    // Brand chips when a brand filter is selected from the panel.
    state.filters.brand.forEach(b => {
      row.appendChild(makeChip(b, 'active', () => {
        state.filters.brand = state.filters.brand.filter(x => x !== b);
        resetAndFetch();
      }));
    });

    // Stock toggle — last position, distinct label depending on state so
    // it reads as a state rather than a filter.
    //
    // Both branches must call resetAndFetch(), not render(). render() only
    // re-renders the products already in state.products; the in-stock
    // filter is applied SERVER-SIDE in the Algolia query (catalog-algolia.js
    // line 92), so flipping the toggle has to re-fetch to surface the
    // previously-filtered-out items. Earlier this called render() and
    // toggling off the chip silently did nothing — bug surfaced when a
    // user searched "scrub" (1 in-stock, 22 OOS) and couldn't expand.
    if (state.filters.inStockOnly) {
      row.appendChild(makeChip('In stock only', 'active', () => {
        state.filters.inStockOnly = false; resetAndFetch();
      }));
    } else {
      row.appendChild(makeChip('Show out of stock', 'passive', () => {
        state.filters.inStockOnly = true; resetAndFetch();
      }));
    }

    // "Clear filters" link on the right — only when something's active.
    const anyActive =
      state.filters.type ||
      state.filters.canadian ||
      state.filters.csa ||
      state.filters.brand.length > 0 ||
      state.filters.q;
    if (anyActive) {
      row.appendChild(makeChip('Clear filters', 'clear', () => clearAllFilters()));
    }
  }

  function makeChip(label, klass, onClick) {
    const c = document.createElement('span');
    c.className = `chip ${klass}`;
    c.textContent = label;
    c.onclick = onClick;
    return c;
  }

  function resetAndFetch() {
    state.products = []; state.page = 0; state.done = false;
    if (window.SPCatalog && window.SPCatalog.clearCache) window.SPCatalog.clearCache();
    fetchPage();
  }

  // =========================================================================
  // Filter panel + search
  // =========================================================================
  function openFilterPanel()  {
    renderFilterPanel();   // build the panel UI from current state + loaded products
    document.getElementById('filterPanel').classList.add('open');
    document.getElementById('filterOverlay').classList.add('open');
  }
  function closeFilterPanel() { document.getElementById('filterPanel').classList.remove('open'); document.getElementById('filterOverlay').classList.remove('open'); }
  function clearAllFilters()  {
    state.filters = {
      type: null, brand: [], canadian: false, csa: false, q: '', inStockOnly: true,
      colorFamilies: [], genders: [], fabricFamilies: [], weightClasses: [], sizes: [],
      priceMin: null, priceMax: null,
    };
    document.getElementById('searchInput').value='';
    closeFilterPanel();
    resetAndFetch();
  }
  function updateFilterPill() {
    const activeCount =
      (state.filters.type ? 1 : 0) +
      state.filters.brand.length +
      (state.filters.canadian ? 1 : 0) +
      (state.filters.csa ? 1 : 0) +
      state.filters.colorFamilies.length +
      state.filters.genders.length +
      state.filters.fabricFamilies.length +
      state.filters.weightClasses.length +
      state.filters.sizes.length +
      ((state.filters.priceMin != null || state.filters.priceMax != null) ? 1 : 0);
    const pill = document.getElementById('filterCount');
    if (pill) {
      pill.textContent = activeCount;
      pill.style.display = activeCount ? 'inline-block' : 'none';
    }
  }
  // Filters now apply LIVE — there's no Apply button. Every panel control
  // commits immediately so results refresh as the customer refines. Exposed
  // on window because inline on* handlers run in global scope (they can't see
  // top-level const/let bindings).
  function commitFilters() { updateFilterPill(); resetAndFetch(); }
  window.commitFilters = commitFilters;
  window.commitFiltersDebounced = debounce(commitFilters, 250);
  // Back-compat shim — anything still calling applyFilters() commits + closes.
  function applyFilters() { updateFilterPill(); closeFilterPanel(); resetAndFetch(); }

  document.getElementById('searchInput').addEventListener('input', debounce(function(e) {
    state.filters.q = e.target.value.trim();
    resetAndFetch();
  }, 250));

  // Pre-fill the search input from `?q=...` so the customer can see exactly
  // what's being searched (and edit it inline) when they arrive via the
  // nav's "See all results" CTA / Enter key.
  (function hydrateSearchFromUrl() {
    if (!state.filters.q) return;
    var input = document.getElementById('searchInput');
    if (input) input.value = state.filters.q;
  })();

  function debounce(fn, ms) { let t; return function(...a){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,a), ms); }; }

  // Infinite scroll
  window.addEventListener('scroll', function() {
    if (state.loading || state.done) return;
    if (window.scrollY + window.innerHeight > document.body.offsetHeight - 600) fetchPage();
  });

  // =========================================================================
  // Mock data — used until S&S sync populates the catalog. Curated to look
  // right next to real data when it lands.
  // =========================================================================
  function mockProducts() {
    return [
      { product_id:'demo-bc3001', brand:'Bella+Canvas', style_number:'3001', name:'Unisex Jersey Short Sleeve Tee', weight_oz:4.2, price_from:9.95, bestseller:true,
        hero_image_url:'/images/product-tshirt-black.jpg',
        colors:[
          {color_id:'c-black',  color_name:'Black',    hex_code:'#111111', mockup_front_url:'/images/product-tshirt-black.jpg'},
          {color_id:'c-navy',   color_name:'Navy',     hex_code:'#1B365D'},
          {color_id:'c-white',  color_name:'White',    hex_code:'#ffffff', mockup_front_url:'/images/product-tshirt-white.jpg'},
          {color_id:'c-red',    color_name:'Red',      hex_code:'#8B2D27'},
          {color_id:'c-olive',  color_name:'Olive',    hex_code:'#5b6e3f'},
          {color_id:'c-tan',    color_name:'Tan',      hex_code:'#c2b66f'}
        ]},
      { product_id:'demo-as5026', brand:'AS Colour', style_number:'5026', name:'Staple Tee — Premium Cotton', weight_oz:6.5, price_from:13.95, is_canadian_made:false,
        hero_image_url:'/images/product-tshirt-studio.jpg',
        colors:[
          {color_id:'c-as-black', color_name:'Black', hex_code:'#111111'},
          {color_id:'c-as-white', color_name:'White', hex_code:'#ffffff'},
          {color_id:'c-as-grey',  color_name:'Grey',  hex_code:'#666666'},
          {color_id:'c-as-camel', color_name:'Camel', hex_code:'#d8a36b'}
        ]},
      { product_id:'demo-g500', brand:'Gildan', style_number:'G500', name:'Heavy Cotton Adult T-Shirt', weight_oz:5.3, price_from:6.95,
        hero_image_url:'/images/product-tshirt-modavie.jpg',
        colors:[
          {color_id:'c-g-black', color_name:'Black',      hex_code:'#111111'},
          {color_id:'c-g-white', color_name:'White',      hex_code:'#ffffff'},
          {color_id:'c-g-navy',  color_name:'Navy',       hex_code:'#1B365D'},
          {color_id:'c-g-red',   color_name:'Red',        hex_code:'#8B2D27'},
          {color_id:'c-g-green', color_name:'Forest',     hex_code:'#2c4d2f'},
          {color_id:'c-g-grey',  color_name:'Sport Grey', hex_code:'#a8a8a8'}
        ]},
      { product_id:'demo-cc1717', brand:'Comfort Colors', style_number:'1717', name:'Garment-Dyed Heavyweight Tee', weight_oz:6.1, price_from:14.95,
        hero_image_url:'/images/product-tshirt-heart.jpg',
        colors:[
          {color_id:'c-cc-ivory', color_name:'Ivory',     hex_code:'#d4c69c'},
          {color_id:'c-cc-sage',  color_name:'Sage',      hex_code:'#a8c099'},
          {color_id:'c-cc-camel', color_name:'Camel',     hex_code:'#d8a36b'},
          {color_id:'c-cc-mauve', color_name:'Mauve',     hex_code:'#9b8eaf'}
        ]},
      { product_id:'demo-bc3719', brand:'Bella+Canvas', style_number:'3719', name:'Unisex Sponge Fleece Pullover Hoodie', weight_oz:8.0, price_from:29.95,
        hero_image_url:'/images/product-hoodie-concordia.jpg',
        colors:[
          {color_id:'c-bch-black',   color_name:'Black',          hex_code:'#111111'},
          {color_id:'c-bch-heather', color_name:'Heather Forest', hex_code:'#3a4a3a'},
          {color_id:'c-bch-navy',    color_name:'Navy',           hex_code:'#1B365D'},
          {color_id:'c-bch-cream',   color_name:'Cream',          hex_code:'#f4eddb'}
        ]},
      { product_id:'demo-fl-csa', brand:'Forcefield', style_number:'FF-403', name:'Class 2 Hi-Vis Safety Vest (CSA Z96)', price_from:14.95, has_csa_cert:true,
        hero_image_url:'/images/product-tshirt-white.jpg',
        colors:[
          {color_id:'c-hv-yellow', color_name:'Lime Yellow', hex_code:'#dfff00'},
          {color_id:'c-hv-orange', color_name:'Hi-Vis Orange', hex_code:'#ff6a00'}
        ]}
    ];
  }

  // =========================================================================
  // Init
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    // Initialise the qty slider from state.qty (may have been seeded from ?qty=…)
    setQty(state.qty);
    // Show the floating cart bar if items were added in a previous tab visit.
    renderCartBar();
    fetchPage();
    // Deep-link: ?product=<id> opens that product's detail modal directly, so a
    // click from the Designed-in-Montreal / Canadian collection lands on the
    // actual product card inside the catalog — not just the filtered list.
    (function openProductFromUrl() {
      try {
        var pid = new URLSearchParams(location.search).get('product');
        if (!pid) return;
        fetch('https://singhsprint-crm.vercel.app/api/catalog?product_id=' + encodeURIComponent(pid) + '&qty=' + state.qty + '&limit=1')
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) { var p = d && d.products && d.products[0]; if (p) openProductDetail(p); })
          .catch(function () {});
      } catch (e) {}
    })();
  });
