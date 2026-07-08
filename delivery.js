/* =============================================================================
 * delivery.js — pickup vs delivery for Singh's Print.
 *
 * Self-contained, no dependencies. Two jobs, auto-detected by page:
 *
 *   1. QUOTE PAGE (/quote): injects a Pickup / Delivery choice + address form
 *      into the contact step, and transparently attaches fulfillment_method +
 *      shipping_address (and a live shipping estimate) to the existing
 *      /api/shop/checkout POST via a scoped window.fetch wrapper. The quote
 *      page's own checkout code is untouched. COLLECT-BUT-DON'T-BLOCK: a
 *      missing field or a failed estimate never blocks the payment.
 *
 *   2. ACCOUNT ORDERS (/account/orders.html): exposes
 *      window.SPDelivery.openConvertModal({ orderNumber, email }) — an address
 *      modal that flips a pickup order to delivery and pays shipping only via
 *      the CRM's /api/shop/orders/convert-to-delivery (redirects to Stripe).
 *
 * CRM base is read from window.SINGHS_CRM_BASE if present, else defaults to the
 * production CRM (same origin the quote page already posts checkout to).
 * ========================================================================== */
(function (global) {
  'use strict';

  var CRM_BASE = (global.SINGHS_CRM_BASE || 'https://singhsprint-crm.vercel.app').replace(/\/+$/, '');
  var CHECKOUT_RE = /\/api\/shop\/checkout(\?|$)/;
  var _fetch = global.fetch ? global.fetch.bind(global) : null;

  // ---- helpers ------------------------------------------------------------
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function money(cad) {
    return '$' + Number(cad || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Map a garment label to a keyword the estimator weight table understands.
  function garmentKeyword(label) {
    var s = String(label || '').toLowerCase();
    if (/\bt[-\s]?shirt\b|\btee\b/.test(s)) return 'tshirt';
    if (/long\s?sleeve/.test(s)) return 'longsleeve';
    var k = ['hoodie', 'crewneck', 'polo', 'joggers', 'jacket', 'tote', 'hat', 'cap', 'hivis'];
    for (var i = 0; i < k.length; i++) if (s.indexOf(k[i]) > -1) return k[i];
    return undefined;
  }

  // Shipping estimate — same CRM endpoint the quote calculator uses.
  function estimateShipping(items, addr) {
    if (!_fetch || !addr || !addr.postal_code || !addr.country) return Promise.resolve(0);
    var payloadItems = (items || []).map(function (it) {
      return {
        qty: Math.max(1, parseInt(it.qty || it.quantity || 1, 10) || 1),
        garment_type: garmentKeyword(it.garment_type || it.name || it.label),
      };
    });
    if (!payloadItems.length) return Promise.resolve(0);
    return _fetch(CRM_BASE + '/api/shipping/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payloadItems, postal_code: addr.postal_code, country_code: addr.country }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) { return (j && j.cheapest && typeof j.cheapest.fee_cad === 'number') ? j.cheapest.fee_cad : 0; })
      .catch(function () { return 0; });
  }

  // =========================================================================
  // 1. QUOTE PAGE
  // =========================================================================
  var ADDR_FIELDS = [
    ['sp-ship-name', 'Full name', 'text', 'name'],
    ['sp-ship-address1', 'Street address', 'text', 'address1'],
    ['sp-ship-address2', 'Apt / unit (optional)', 'text', 'address2'],
    ['sp-ship-city', 'City', 'text', 'city'],
    ['sp-ship-province', 'Province', 'text', 'province'],
    ['sp-ship-postal', 'Postal code', 'text', 'postal_code'],
    ['sp-ship-notes', 'Delivery notes (optional)', 'text', 'notes'],
  ];

  function readAddress() {
    var a = {};
    ADDR_FIELDS.forEach(function (f) {
      var node = document.getElementById(f[0]);
      a[f[3]] = node ? node.value.trim() : '';
    });
    var c = document.getElementById('sp-ship-country');
    a.country = c ? c.value : 'CA';
    // phone reuses the contact-step phone if present
    var ph = document.getElementById('phone');
    a.phone = ph ? ph.value.trim() : '';
    return a;
  }

  function chosenMethod() {
    var d = document.getElementById('sp-fm-delivery');
    return d && d.checked ? 'delivery' : 'pickup';
  }

  function injectQuoteUI() {
    if (document.getElementById('sp-fulfillment')) return true;
    var emailEl = document.getElementById('email');
    var payBtn = document.getElementById('payButton') || document.getElementById('orderPayBtn');
    if (!emailEl || !payBtn) return false;
    var anchor = (document.getElementById('phone') && document.getElementById('phone').closest('.form-group'))
      || emailEl.closest('.form-group');
    if (!anchor || !anchor.parentNode) return false;

    var wrap = el('div', { class: 'form-group', id: 'sp-fulfillment' });
    wrap.style.gridColumn = '1 / -1';

    var addrRows = ADDR_FIELDS.map(function (f) {
      return '<label style="display:block;margin:.4rem 0 .15rem;font-size:.85rem;opacity:.85">' + f[1] + '</label>'
        + '<input id="' + f[0] + '" type="' + f[2] + '" style="width:100%;padding:.55rem .7rem;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(255,255,255,.04);color:inherit">';
    }).join('');

    wrap.innerHTML =
      '<label style="display:block;margin-bottom:.35rem">How would you like to get your order?</label>'
      + '<div style="display:flex;gap:1.25rem;align-items:center;margin-bottom:.25rem">'
      + '  <label style="display:flex;gap:.4rem;align-items:center;cursor:pointer"><input type="radio" name="sp_fm" id="sp-fm-pickup" value="pickup" checked> Pickup (Sainte-Anne-de-Bellevue)</label>'
      + '  <label style="display:flex;gap:.4rem;align-items:center;cursor:pointer"><input type="radio" name="sp_fm" id="sp-fm-delivery" value="delivery"> Delivery</label>'
      + '</div>'
      + '<div id="sp-address" hidden style="margin-top:.5rem;padding:.75rem;border:1px dashed rgba(255,255,255,.18);border-radius:10px">'
      + '  <label style="display:block;margin:.15rem 0 .15rem;font-size:.85rem;opacity:.85">Country</label>'
      + '  <select id="sp-ship-country" style="width:100%;padding:.55rem .7rem;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(255,255,255,.04);color:inherit"><option value="CA">Canada</option><option value="US">United States</option></select>'
      + addrRows
      + '  <div id="sp-ship-fee" style="margin-top:.6rem;font-size:.9rem;opacity:.9"></div>'
      + '</div>';

    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);

    function sync() {
      var box = document.getElementById('sp-address');
      box.hidden = chosenMethod() !== 'delivery';
      if (!box.hidden) refreshFee();
    }
    document.getElementById('sp-fm-pickup').addEventListener('change', sync);
    document.getElementById('sp-fm-delivery').addEventListener('change', sync);

    var feeTimer = null;
    function refreshFee() {
      var out = document.getElementById('sp-ship-fee');
      var addr = readAddress();
      if (!addr.postal_code || !addr.country) { out.textContent = ''; return; }
      out.textContent = 'Estimating delivery…';
      var items = (typeof global.spBuildCheckoutItems === 'function') ? global.spBuildCheckoutItems() : [];
      estimateShipping(items, addr).then(function (fee) {
        out.textContent = fee > 0 ? ('Estimated delivery: ' + money(fee) + ' (added at checkout)')
          : 'Delivery: free in Greater Montreal on $500+ orders (final rate confirmed at checkout).';
      });
    }
    var postal = document.getElementById('sp-ship-postal');
    if (postal) postal.addEventListener('blur', function () { clearTimeout(feeTimer); feeTimer = setTimeout(refreshFee, 50); });
    return true;
  }

  // Scoped fetch wrapper — only touches the checkout POST when Delivery is on.
  function installCheckoutHook() {
    if (!global.fetch || global.__spDeliveryHook) return;
    global.__spDeliveryHook = true;
    var orig = global.fetch;
    global.fetch = function (input, init) {
      try {
        var url = (typeof input === 'string') ? input : (input && input.url) || '';
        var method = (init && init.method) || (input && input.method) || 'GET';
        if (String(method).toUpperCase() === 'POST' && CHECKOUT_RE.test(url) && chosenMethod() === 'delivery' && init && typeof init.body === 'string') {
          var body;
          try { body = JSON.parse(init.body); } catch (e) { return orig.apply(this, arguments); }
          var addr = readAddress();
          body.fulfillment_method = 'delivery';
          body.shipping_address = addr;
          var self = this, args = arguments;
          return estimateShipping(body.items, addr).then(function (fee) {
            if (fee > 0) body.shipping = fee;
            var newInit = Object.assign({}, init, { body: JSON.stringify(body) });
            return orig.call(self, input, newInit);
          });
        }
      } catch (e) { /* never break checkout */ }
      return orig.apply(this, arguments);
    };
  }

  function initQuote() {
    if (!document.getElementById('email')) return;
    installCheckoutHook();
    var tries = 0;
    (function tryInject() {
      if (injectQuoteUI()) return;
      if (tries++ < 40) setTimeout(tryInject, 250); // wait for quote.js to build the contact step
    })();
  }

  // =========================================================================
  // 2. ACCOUNT ORDERS — convert-to-delivery modal
  // =========================================================================
  function openConvertModal(opts) {
    opts = opts || {};
    var orderNumber = opts.orderNumber, email = opts.email;
    if (!orderNumber || !email) { alert('Missing order or account email.'); return; }

    var back = el('div', { id: 'sp-conv-modal' });
    back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:99999;padding:1rem';
    var addrRows = ADDR_FIELDS.map(function (f) {
      return '<label style="display:block;margin:.5rem 0 .15rem;font-size:.85rem;color:#333">' + f[1] + '</label>'
        + '<input data-k="' + f[3] + '" type="' + f[2] + '" style="width:100%;padding:.55rem .7rem;border:1px solid #d0d0d0;border-radius:8px">';
    }).join('');
    var card = el('div');
    card.style.cssText = 'background:#fff;color:#111;max-width:460px;width:100%;border-radius:14px;padding:1.25rem 1.35rem;max-height:90vh;overflow:auto';
    card.innerHTML =
      '<h3 style="margin:0 0 .25rem">Add delivery to ' + String(orderNumber) + '</h3>'
      + '<p style="margin:0 0 .5rem;font-size:.9rem;color:#555">Enter your shipping address. You’ll pay only the delivery charge — priced from your address.</p>'
      + '<label style="display:block;margin:.5rem 0 .15rem;font-size:.85rem;color:#333">Country</label>'
      + '<select data-k="country" style="width:100%;padding:.55rem .7rem;border:1px solid #d0d0d0;border-radius:8px"><option value="CA">Canada</option><option value="US">United States</option></select>'
      + addrRows
      + '<div data-msg style="margin:.6rem 0 0;font-size:.9rem;color:#b00"></div>'
      + '<div style="display:flex;gap:.6rem;justify-content:flex-end;margin-top:1rem">'
      + '  <button data-cancel style="padding:.55rem .9rem;border:1px solid #d0d0d0;border-radius:9px;background:#fff;cursor:pointer">Cancel</button>'
      + '  <button data-go style="padding:.55rem 1.1rem;border:0;border-radius:9px;background:#111;color:#fff;cursor:pointer">Continue to payment</button>'
      + '</div>';
    back.appendChild(card);
    document.body.appendChild(back);

    function close() { if (back.parentNode) back.parentNode.removeChild(back); }
    card.querySelector('[data-cancel]').addEventListener('click', close);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });

    card.querySelector('[data-go]').addEventListener('click', function () {
      var go = card.querySelector('[data-go]');
      var msg = card.querySelector('[data-msg]');
      var addr = {};
      card.querySelectorAll('[data-k]').forEach(function (n) { addr[n.getAttribute('data-k')] = (n.value || '').trim(); });
      if (!addr.address1 || !addr.city || !addr.postal_code) { msg.textContent = 'Please fill street, city, and postal code.'; return; }
      go.disabled = true; go.textContent = 'Pricing delivery…'; msg.textContent = '';
      _fetch(CRM_BASE + '/api/shop/orders/convert-to-delivery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: orderNumber, email: email, shipping_address: addr }),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error((res.j && res.j.error) || 'Could not add delivery.');
          if (res.j.requires_payment && res.j.payment_url) { global.location.href = res.j.payment_url; return; }
          msg.style.color = '#0a0';
          msg.textContent = res.j.reason === 'free_local_delivery'
            ? 'Delivery added — free local delivery, nothing to pay.'
            : 'Delivery is already set on this order.';
          go.textContent = 'Done'; setTimeout(close, 1800);
        })
        .catch(function (e) { msg.style.color = '#b00'; msg.textContent = e.message; go.disabled = false; go.textContent = 'Continue to payment'; });
    });
  }

  // ---- boot ---------------------------------------------------------------
  function boot() {
    initQuote();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.SPDelivery = { openConvertModal: openConvertModal, estimateShipping: estimateShipping };
})(typeof window !== 'undefined' ? window : this);
