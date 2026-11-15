/* =========================================================================
 * /get-a-price — the short ad form (2026-11-15)
 * -------------------------------------------------------------------------
 * Why: Meta ads sent about 1,100 people to /quote from Nov 1 to 15 and one
 * real quote request came in. /quote is the full builder; someone who just
 * tapped an Instagram ad on a phone needs four taps and a button. This page
 * is that, and /quote stays as it is for everyone else.
 *
 * One general form, the same words for every ad. A link may carry ?product=
 * (hoodie, hat, tee, crewneck, polo) to start with that tile picked; that and
 * ?preset= / ?method= are saved on the request so the OS knows the ad link.
 *
 * Wiring is the same as quote.js and quick-quote.js, so the OS and the ad
 * platforms see one kind of lead:
 *   - logo → /api/inbound/upload-url (signed PUT) → /sign, relay as fallback.
 *     Starts the moment a file is picked. Submit waits for it up to
 *     45s + 20s per extra file (site commit 9361d78b: a phone on LTE needs
 *     20-40s for a few MB), then sends the request either way. The page never
 *     navigates: the thank-you is a swap, and leaving mid-upload asks first.
 *   - fields: what, how many, a name, a mobile number (required), an email
 *     (optional), a logo (optional). A second button goes to /quote, the
 *     full builder.
 *   - request → POST /api/inbound, kind 'quote', meta.source 'ad-landing'
 *     with the preset, products, quantity band and every utm_*, fbclid, gclid.
 *   - on 2xx, unless the OS says spam:true: SP_LEAD.afterInbound → one Meta
 *     Lead (Pixel + server copy, same event id) and the Google conversion.
 *   - honeypot input sp_hp_7f3 (a name browsers do not autofill), sent as
 *     `website`, which is what the OS reads.
 *
 * config / validPhone / validEmail / buildPayload are pure and exported on
 * window.SP_GET_A_PRICE for scripts/check-get-a-price.mjs.
 * ========================================================================= */
(function () {
  'use strict';

  var CRM = 'https://singhsprint-crm.vercel.app';
  var INBOUND_API = CRM + '/api/inbound';
  var UPLOAD_URL_API = CRM + '/api/inbound/upload-url';
  var UPLOAD_RELAY_API = CRM + '/api/inbound/upload';
  var UPLOAD_MAX_BYTES = 15 * 1024 * 1024; // matches /api/inbound/upload
  var UPLOAD_MAX_FILES = 3;
  var UPLOAD_WAIT_BASE_MS = 45000;         // commit 9361d78b
  var UPLOAD_WAIT_PER_EXTRA_MS = 20000;
  var NOTE_HEAD = 'Short ad form - no sizes or colours yet';

  var BANDS = [
    { label: '5-9', min: 5, max: 9 }, { label: '10-24', min: 10, max: 24 }, { label: '25-49', min: 25, max: 49 },
    { label: '50-99', min: 50, max: 99 }, { label: '100+', min: 100, max: null }
  ];

  // ---- pure: what this link asks for ---------------------------------------
  // ONE general form for every ad (owner, 2026-11-15: "don't need to brand it
  // like this, this is too specific, it should still be a general form we can
  // attach to any ads"). The heading, the words and the six tiles are the same
  // whatever the link says. A link may still carry ?product= to start with a
  // tile already picked, and that (with ?preset= / ?method=) is saved on the
  // request as meta.preset, so the OS can tell which ad link it came from.
  var CHIPS = ['Tees', 'Hoodies', 'Hats', 'Crewnecks', 'Polos', 'Something else'];
  var PICK = { hoodie: 'Hoodies', hoodies: 'Hoodies', hat: 'Hats', hats: 'Hats', cap: 'Hats', tee: 'Tees', tees: 'Tees', tshirt: 'Tees', crewneck: 'Crewnecks', crewnecks: 'Crewnecks', polo: 'Polos', polos: 'Polos' };
  function config(search) {
    var p;
    try { p = new URLSearchParams(search || ''); } catch (e) { p = new URLSearchParams(''); }
    var clean = function (k) { return String(p.get(k) || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24); };
    var product = clean('product'), preset = clean('preset'), method = clean('method');
    var key = [product, preset || method].filter(Boolean).join('-') || 'default';
    return {
      key: key, product: product || null, preset: preset || null,
      method: (method === 'embroidery' || product === 'hat') ? 'embroidery' : null,
      h1: 'Get a price in an hour',
      sub: "Tell us what you need. We'll send a price and a free mockup.",
      chips: CHIPS, selected: PICK[product] ? [PICK[product]] : [], button: 'Get my price'
    };
  }

  // ---- pure: a phone number (required) and an email (optional) ----------
  // Owner, 2026-11-15: two fields, not one "phone or email". The reply is a
  // text with the price, so the number is the one thing the form must have.
  function validPhone(v) {
    var digits = String(v || '').replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  }
  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
  }

  // ---- pure: every utm_*, fbclid and gclid on the link --------------------
  function attributionFrom(search, store) {
    var out = {};
    var p;
    try { p = new URLSearchParams(search || ''); } catch (e) { p = null; }
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'fbclid', 'gclid'];
    if (p) p.forEach(function (_v, k) { if (/^utm_[a-z0-9_]{1,40}$/i.test(k) && keys.indexOf(k) < 0) keys.push(k); });
    keys.forEach(function (k) {
      var v = p && p.get(k);
      try {
        if (v && store) store.setItem('sp_' + k, v);       // same keys quote.js reads
        else if (!v && store) v = store.getItem('sp_' + k);
      } catch (e) { /* storage blocked */ }
      if (v) out[k] = String(v).slice(0, 300);
    });
    return out;
  }

  // The OS's service value. Embroidery when the link says so or everything
  // picked is headwear; otherwise left for the rep (print or stitch is their call).
  function serviceFor(cfg, products) {
    if (cfg.method === 'embroidery') return 'embroidery';
    var head = products.length > 0 && products.every(function (x) { return x === 'Hats' || x === 'Beanies'; });
    return head ? 'embroidery' : null;
  }

  // ---- pure: the request the OS receives ----------------------------------
  // s: { cfg, products[], band|null, name, contact{email|phone}, uploads[], logoPicked, logoFailed, attribution, href, path, honeypot }
  function buildPayload(s) {
    var band = s.band || null;
    var products = s.products || [];
    var ups = (s.uploads || []).filter(function (u) { return u && u.path; });
    var notes = [
      NOTE_HEAD,
      'Wants: ' + (products.length ? products.join(', ') : 'not picked'),
      'Quantity: ' + (band ? band.label : 'not picked'),
      s.logoPicked ? (ups.length ? 'Logo attached (' + ups.length + ')' + (s.logoFailed ? ', ' + s.logoFailed + ' did not upload - ask them to send it' : '')
                                 : 'Logo did not upload - ask them to send it') : 'No logo attached'
    ].join('\n');
    return {
      kind: 'quote',
      contact_name: s.name,
      email: (s.contact && s.contact.email) || null,
      phone: (s.contact && s.contact.phone) || null,
      service: serviceFor(s.cfg, products),
      garment_source: 'we_supply',
      total_qty: band ? band.min : 0,
      num_sides: 1,
      estimated_total: 0,
      notes: notes,
      cart_items: [],
      size_breakdown: {},
      designs: ups.map(function (u) { return { placement: null, cart_item_index: null, path: u.path, signed_url: u.signed_url || null, mime: u.mime || null, bytes: u.bytes || null }; }),
      design_path: ups.length ? ups[0].path : null,
      design_url: ups.length ? (ups[0].signed_url || null) : null,
      meta: {
        source: 'ad-landing',
        ad_landing: true,
        preset: s.cfg.key,
        products: products,
        quantity_band: band ? band.label : null,
        quantity_min: band ? band.min : null,
        quantity_max: band ? band.max : null,
        method: s.cfg.method || null,
        landing_page: s.path || '/get-a-price',
        lang: 'en',
        attribution: s.attribution || {}
      },
      source_url: s.href || null,
      website: s.honeypot || null
    };
  }

  // The free-tee line on the thank-you: 15 or more, same design.
  function freeTeeLine(band) {
    if (!band) return '';
    if (band.min >= 15) return 'Your order qualifies for a free tee (15+, same design). We add it to your quote.';
    if (band.max && band.max >= 15) return 'Order 15 or more and you get a free tee (same design). We add it to your quote.';
    return '';
  }

  window.SP_GET_A_PRICE = {
    config: config, validPhone: validPhone, validEmail: validEmail, attributionFrom: attributionFrom, buildPayload: buildPayload,
    freeTeeLine: freeTeeLine, BANDS: BANDS, NOTE_HEAD: NOTE_HEAD,
    uploadWaitMs: function (n) { return UPLOAD_WAIT_BASE_MS + Math.max(0, n - 1) * UPLOAD_WAIT_PER_EXTRA_MS; }
  };

  // Line icons for the product tiles, in the style of /quote's product types
  // (stroke follows the text colour, so a picked tile inverts).
  var SVG = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var ICONS = {
    'Tees': SVG + '<path d="M15 8 L10 10 L4 18 L10 22 L14 15 L14 40 L34 40 L34 15 L38 22 L44 18 L38 10 L33 8"/><path d="M15 8 C17 12 21 14 24 14 C27 14 31 12 33 8"/></svg>',
    'Hoodies': SVG + '<path d="M15 10 L10 12 L4 20 L10 24 L13 17 L13 40 L35 40 L35 17 L38 24 L44 20 L38 12 L33 10"/><path d="M15 10 C16 5 20 3 24 3 C28 3 32 5 33 10"/><path d="M20 10 L20 15 Q20 18 24 18 Q28 18 28 15 L28 10" stroke-width="1.5"/><path d="M19 30 L29 30 L31 36 L17 36 Z" stroke-width="1.5"/></svg>',
    'Crewnecks': SVG + '<path d="M15 8 L10 10 L4 18 L10 22 L14 15 L14 40 L34 40 L34 15 L38 22 L44 18 L38 10 L33 8"/><path d="M15 8 C17 12 21 14 24 14 C27 14 31 12 33 8"/><path d="M14 36 L34 36" stroke-width="1.5"/><path d="M19 9.5 C20.5 12 27.5 12 29 9.5" stroke-width="1.5"/></svg>',
    'Polos': SVG + '<path d="M15 10 L10 12 L4 20 L10 24 L14 17 L14 40 L34 40 L34 17 L38 24 L44 20 L38 12 L33 10"/><path d="M15 10 L19 6 L24 10 L29 6 L33 10"/><path d="M24 10 L24 20" stroke-width="1.5"/></svg>',
    'Hats': SVG + '<path d="M8 30 C8 18 15 10 24 10 C33 10 40 18 40 30"/><path d="M4 30 C10 27 38 27 40 30 Q44 31 46 34 Q30 31 4 34 Z"/></svg>',
    'Beanies': SVG + '<path d="M10 32 C10 18 16 10 24 10 C32 10 38 18 38 32"/><rect x="8" y="32" width="32" height="8" rx="3"/><circle cx="24" cy="7" r="3"/><path d="M16 32 L16 40 M24 32 L24 40 M32 32 L32 40" stroke-width="1.5"/></svg>',
    'Quarter-zips': SVG + '<path d="M15 10 L10 12 L4 20 L10 24 L14 17 L14 40 L34 40 L34 17 L38 24 L44 20 L38 12 L33 10"/><path d="M15 10 L19 5 L24 9 L29 5 L33 10"/><path d="M24 9 L24 22" stroke-width="1.5"/><path d="M22.5 22 L25.5 22" stroke-width="1.5"/></svg>',
    'Something else': SVG + '<circle cx="24" cy="24" r="14" stroke-dasharray="4 4"/><path d="M24 18 L24 30 M18 24 L30 24"/></svg>'
  };

  // ---- upload: same signed-URL flow as quote.js, relay as fallback --------
  function uploadOne(file) {
    return fetch(UPLOAD_URL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name || 'logo', mime: file.type || 'application/octet-stream', bytes: file.size })
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.upload_url) throw new Error('no-signed-url');
        return fetch(d.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' },
          body: file
        }).then(function (put) {
          if (!put.ok) throw new Error('put ' + put.status);
          return fetch(UPLOAD_URL_API + '/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: d.path })
          })
            .then(function (sr) { return sr.ok ? sr.json() : null; })
            .then(function (sj) {
              return { path: d.path, signed_url: (sj && sj.signed_url) || '', mime: d.mime || file.type || null, bytes: file.size };
            });
        });
      })
      .catch(function () {
        var fd = new FormData();
        fd.append('file', file);
        fd.append('kind', 'design');
        return fetch(UPLOAD_RELAY_API, { method: 'POST', body: fd })
          .then(function (r) { if (!r.ok) throw new Error('relay ' + r.status); return r.json(); });
      });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- page ---------------------------------------------------------------
  function mount() {
    var form = document.getElementById('gpForm');
    if (!form) return;
    var cfg = config(location.search);
    var attribution = attributionFrom(location.search, (function () { try { return window.sessionStorage; } catch (e) { return null; } })());

    document.getElementById('gpH1').textContent = cfg.h1;
    document.getElementById('gpSub').textContent = cfg.sub;
    var btn = document.getElementById('gpBtn');
    btn.textContent = cfg.button;

    var prodBox = document.getElementById('gpProducts');
    prodBox.innerHTML = cfg.chips.map(function (c) {
      var on = cfg.selected.indexOf(c) > -1;
      return '<button type="button" class="gp-chip gp-tile" data-v="' + esc(c) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        (ICONS[c] || ICONS['Something else']) + '<span>' + esc(c) + '</span></button>';
    }).join('');

    prodBox.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.gp-chip') : null;
      if (!b) return;
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      started();
    });

    var qtyBox = document.getElementById('gpQty');
    qtyBox.innerHTML = BANDS.map(function (b) {
      return '<button type="button" class="gp-chip" role="radio" data-v="' + esc(b.label) + '" aria-checked="false">' + esc(b.label) + '</button>';
    }).join('');
    qtyBox.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.gp-chip') : null;
      if (!b) return;
      var was = b.getAttribute('aria-checked') === 'true';
      Array.prototype.forEach.call(qtyBox.querySelectorAll('.gp-chip'), function (x) { x.setAttribute('aria-checked', 'false'); });
      if (!was) b.setAttribute('aria-checked', 'true');
      started();
    });

    var hasStarted = false;
    function started() {
      if (hasStarted) return;
      hasStarted = true;
      try { if (window.spTrack) window.spTrack('get_a_price_start', { preset: cfg.key }); } catch (e) {}
    }
    form.addEventListener('focusin', started);

    var phoneEl = document.getElementById('gpPhone');
    var emailEl = document.getElementById('gpEmail');

    function setErr(key, msg) {
      var f = form.querySelector('[data-f="' + key + '"]');
      if (!f) return;
      f.classList.toggle('bad', !!msg);
      var e = f.querySelector('.gp-err');
      if (e) e.textContent = msg || '';
    }

    // Uploads start when the files are picked, so most are done by the time
    // the button is tapped.
    var fileInput = document.getElementById('gpLogo');
    var fileName = document.getElementById('gpLogoName');
    var uploads = [];   // [{ file, promise, result|null, done, failed }]
    var busy = false;   // submit in flight
    fileInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fileInput.files || [], 0, UPLOAD_MAX_FILES);
      var tooBig = files.filter(function (f) { return f.size > UPLOAD_MAX_BYTES; });
      setErr('logo', tooBig.length ? 'That file is over 15 MB. Send it by text or email after.' : '');
      files = files.filter(function (f) { return f.size <= UPLOAD_MAX_BYTES; });
      uploads = files.map(function (f) {
        var u = { file: f, result: null, done: false, failed: false };
        u.promise = uploadOne(f).then(function (r) { u.result = r; u.done = true; return r; })
          .catch(function () { u.failed = true; u.done = true; return null; });
        return u;
      });
      fileName.textContent = files.length ? (files.length === 1 ? files[0].name : files.length + ' files') : 'Optional. PNG, JPG or PDF';
      started();
    });

    // Never lose an upload to a stray back-swipe or tab close.
    window.addEventListener('beforeunload', function (e) {
      var uploading = uploads.some(function (u) { return !u.done; });
      if (uploading || busy) { e.preventDefault(); e.returnValue = ''; }
    });

    function waitForUploads() {
      if (!uploads.length) return Promise.resolve();
      var budget = window.SP_GET_A_PRICE.uploadWaitMs(uploads.length);
      return Promise.race([
        Promise.all(uploads.map(function (u) { return u.promise; })),
        new Promise(function (res) { setTimeout(res, budget); })
      ]);
    }

    var msg = document.getElementById('gpMsg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      msg.hidden = true;

      var name = document.getElementById('gpName').value.trim();
      var phone = phoneEl.value.trim();
      var email = emailEl.value.trim();
      var phoneOk = validPhone(phone);
      var emailOk = !email || validEmail(email);   // optional, but not half-typed
      setErr('name', name ? '' : 'Add your name.');
      setErr('phone', phoneOk ? '' : 'Add a mobile number so we can text your price.');
      setErr('email', emailOk ? '' : 'That email looks incomplete.');
      var contact = { phone: phone, email: email || null };
      if (!name || !phoneOk || !emailOk) {
        var bad = form.querySelector('.gp-row.bad input');
        if (bad) bad.focus();
        return;
      }

      var products = Array.prototype.map.call(prodBox.querySelectorAll('.gp-chip[aria-pressed="true"]'), function (b) { return b.getAttribute('data-v'); });
      var bandEl = qtyBox.querySelector('.gp-chip[aria-checked="true"]');
      var band = bandEl ? BANDS.filter(function (b) { return b.label === bandEl.getAttribute('data-v'); })[0] : null;

      busy = true;
      btn.disabled = true;
      btn.textContent = uploads.some(function (u) { return !u.done; }) ? 'Sending your logo…' : 'Sending…';

      var payload;
      waitForUploads()
        .then(function () {
          var ok = uploads.filter(function (u) { return u.result && u.result.path; }).map(function (u) { return u.result; });
          payload = buildPayload({
            cfg: cfg, products: products, band: band, name: name, contact: contact,
            uploads: ok, logoPicked: uploads.length > 0, logoFailed: uploads.length - ok.length,
            attribution: attribution, href: location.href, path: location.pathname,
            honeypot: (form.querySelector('input[name="sp_hp_7f3"]') || {}).value || null
          });
          return fetch(INBOUND_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true });
        })
        .then(function (r) {
          if (!r || !r.ok) throw new Error('inbound ' + (r && r.status));
          return r.json().catch(function () { return {}; });
        })
        .then(function (j) {
          // spam:true = the OS's spam layers flagged it. The visitor sees the
          // normal thank-you; SP_LEAD keeps it out of ad optimisation.
          try {
            if (window.SP_LEAD) {
              window.SP_LEAD.afterInbound(j, {
                contentName: products.length ? products.join(', ') : 'Ad form',
                contentCategory: 'Ad landing',
                numItems: band ? band.min : undefined,
                form: 'get_a_price',
                user: { email: contact.email || undefined, phone: contact.phone, name: name }
              });
            }
          } catch (err) { /* tracking never breaks the thank-you */ }
          try { if (window.spTrack && !(j && j.spam === true)) window.spTrack('get_a_price_submit', { preset: cfg.key, products: products.join(','), band: band ? band.label : '' }); } catch (err) {}
          busy = false;
          uploads = uploads.filter(function (u) { return !u.done; }); // a slow upload still guards the tab
          thanks({ products: products, band: band, name: name, contact: contact, logos: (payload.designs || []).length });
        })
        .catch(function (err) {
          try { console.warn('[get-a-price] submit failed:', err); } catch (e2) {}
          busy = false;
          btn.disabled = false;
          btn.textContent = cfg.button;
          msg.innerHTML = 'That didn’t send. Try again, or text us at <a href="sms:4385443800">438-544-3800</a>.';
          msg.hidden = false;
        });
    });

    function thanks(s) {
      var tee = freeTeeLine(s.band);
      var rows = [
        ['Items', s.products.length ? s.products.join(', ') : 'Not picked yet'],
        ['Quantity', s.band ? s.band.label : 'Not picked yet'],
        ['Name', s.name],
        ['Phone', s.contact.phone]
      ].concat(s.contact.email ? [['Email', s.contact.email]] : []).concat([
        ['Logo', s.logos ? (s.logos === 1 ? 'Attached' : s.logos + ' files attached') : 'None yet. You can send it after.']
      ]);
      var main = document.getElementById('gp');
      main.innerHTML =
        '<div class="gp-ok">' +
        '<h1 tabindex="-1" id="gpDone">Got it. We’re on it.</h1>' +
        '<p>We’ll text you a price and a mockup, usually within the hour (9am-6pm).</p>' +
        '<div class="gp-sent"><h2>What you sent</h2><dl>' +
          rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') +
        '</dl></div>' +
        (tee ? '<p class="gp-tee">' + esc(tee) + '</p>' : '') +
        '<p class="gp-sooner">Need it sooner?</p>' +
        '<div class="gp-cta"><a href="tel:4385443800" data-sp-track="get_a_price_call">Call 438-544-3800</a><a href="sms:4385443800" data-sp-track="get_a_price_text">Text us</a></div>' +
        '</div>';
      try { window.scrollTo(0, 0); document.getElementById('gpDone').focus(); } catch (e) {}
    }
  }

  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
