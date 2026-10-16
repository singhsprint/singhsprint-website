/* =========================================================================
 * Quick quote block for the service landing pages (2026-10-07)
 * -------------------------------------------------------------------------
 * Why: Google Ads sent 190 of 203 clicks (Sep 6 - Oct 5) to /quote, a
 * 42-field order builder, and 2 of them filled it out. Calls carried the
 * account. This gives an ad visitor a 4-field ask and a big call button on
 * the page that matches their search, and keeps /quote as step two.
 *
 * Usage, one line per page (after components.js):
 *   <script src="/quick-quote.js" defer data-service="embroidery"></script>
 * data-service: embroidery | tshirts | dtg  (picks the garment list + copy)
 *
 * Mounts into #quick-quote if the page has one, otherwise right after the
 * first section.hero. French copy on /fr/ paths (or <html lang="fr">).
 *
 * Wiring, deliberately the same as quote.js so the CRM and the ad
 * platforms see one kind of lead:
 *   - logo  → /api/inbound/upload-url (signed PUT) → /sign, relay fallback
 *   - lead  → POST /api/inbound, kind 'quote', meta.quick_quote = true
 *   - on 2xx and queued !== false only: Google Ads 'quote_submit'
 *     conversion (SP_GTAG), Meta Lead (Pixel + CAPI, one event_id),
 *     spTrack('quick_quote_submit')
 *   - honeypot field "website" — the CRM flags any non-empty value
 * ========================================================================= */
(function () {
  'use strict';

  var CRM = 'https://singhsprint-crm.vercel.app';
  var INBOUND_API = CRM + '/api/inbound';
  var UPLOAD_URL_API = CRM + '/api/inbound/upload-url';
  var UPLOAD_RELAY_API = CRM + '/api/inbound/upload';
  var UPLOAD_MAX_BYTES = 15 * 1024 * 1024; // matches /api/inbound/upload
  var PHONE_TEL = 'tel:4385443800';
  var PHONE_LABEL = '438-544-3800';

  var script = document.currentScript;
  var serviceKey = (script && script.getAttribute('data-service')) || 'tshirts';

  var isFr = /^\/fr(\/|$)/.test(location.pathname) ||
             (document.documentElement.lang || '').toLowerCase().indexOf('fr') === 0;

  // ---- copy ---------------------------------------------------------------
  var T = isFr ? {
    eyebrow: 'Soumission rapide',
    h2: 'Un prix en 1 heure ouvrable',
    lead: 'Dites-nous quoi et combien. On vous revient avec un prix et une maquette gratuite.',
    b1: 'Maquette approuvée avant la production',
    b2: 'Atelier à Sainte-Anne-de-Bellevue, cueillette sur place',
    b3: 'Réponse par texto ou courriel, en personne',
    call: 'Appeler ' + PHONE_LABEL,
    callSub: 'Le plus rapide, 9 h à 18 h',
    name: 'Votre nom',
    contact: 'Téléphone ou courriel',
    contactPh: '514 555-0123 ou vous@entreprise.com',
    what: 'Quoi',
    qty: 'Combien',
    logo: 'Votre logo (optionnel)',
    logoHint: 'PNG, JPG, PDF ou AI, 15 Mo max',
    logoPick: 'Choisir un fichier',
    submit: 'Obtenir mon prix',
    sending: 'Envoi…',
    full: 'Besoin des tailles, couleurs et d’un prix en direct? Utilisez le configurateur complet',
    errName: 'Ajoutez votre nom.',
    errContact: 'Ajoutez un numéro de téléphone ou un courriel valide.',
    errQty: 'Combien de pièces?',
    errFile: 'Ce fichier dépasse 15 Mo. Envoyez-le à sales@singhsprint.com.',
    errSend: 'Ça n’a pas passé. Appelez-nous au ' + PHONE_LABEL + ' ou écrivez à sales@singhsprint.com.',
    okH: 'Reçu, merci!',
    okP: 'On vous revient avec un prix d’ici 1 heure ouvrable. Pressé? Appelez-nous.',
    quoteHref: '/fr/quote'
  } : {
    eyebrow: 'Quick quote',
    h2: 'Get a price within 1 business hour',
    lead: 'Tell us what and how many. We’ll send a price and a free mockup.',
    b1: 'Mockup you approve before we start',
    b2: 'Made in Sainte-Anne-de-Bellevue, local pickup',
    b3: 'A real person replies by text or email',
    call: 'Call ' + PHONE_LABEL,
    callSub: 'Fastest way, 9am to 6pm',
    name: 'Your name',
    contact: 'Phone or email',
    contactPh: '514-555-0123 or you@company.com',
    what: 'What',
    qty: 'How many',
    logo: 'Your logo (optional)',
    logoHint: 'PNG, JPG, PDF or AI, up to 15 MB',
    logoPick: 'Choose a file',
    submit: 'Get my price',
    sending: 'Sending…',
    full: 'Need sizes, colours and a live price? Use the full quote builder',
    errName: 'Add your name.',
    errContact: 'Add a phone number or email we can reach you at.',
    errQty: 'How many pieces?',
    errFile: 'That file is over 15 MB. Email it to sales@singhsprint.com instead.',
    errSend: 'That didn’t go through. Call us at ' + PHONE_LABEL + ' or email sales@singhsprint.com.',
    okH: 'Got it, thanks!',
    okP: 'We’ll get back to you with a price within 1 business hour. In a rush? Give us a call.',
    quoteHref: '/quote'
  };

  // service → CRM service value + garment list. Values stay English so the
  // CRM inbox reads the same whichever page the lead came from.
  var SERVICES = {
    embroidery: {
      crm: 'embroidery',
      items: [
        ['Hats / caps', 'Casquettes'], ['Polos', 'Polos'], ['Hoodies', 'Kangourous (hoodies)'],
        ['Quarter-zips', 'Chandails quart-zip'], ['Jackets', 'Manteaux / vestes'],
        ['Beanies / toques', 'Tuques'], ['Other', 'Autre']
      ]
    },
    tshirts: {
      crm: 'dtg',
      items: [
        ['T-shirts', 'T-shirts'], ['Hoodies', 'Kangourous (hoodies)'], ['Crewnecks', 'Cols ronds'],
        ['Long sleeves', 'Manches longues'], ['Tank tops', 'Camisoles'], ['Other', 'Autre']
      ]
    },
    dtg: {
      crm: 'dtg',
      items: [
        ['T-shirts', 'T-shirts'], ['Hoodies', 'Kangourous (hoodies)'], ['Crewnecks', 'Cols ronds'],
        ['Long sleeves', 'Manches longues'], ['Tote bags', 'Sacs fourre-tout'], ['Other', 'Autre']
      ]
    }
  };
  var svc = SERVICES[serviceKey] || SERVICES.tshirts;

  // ---- styles (scoped under .spqq) ---------------------------------------
  var CSS = [
    '.spqq{position:relative;z-index:3;padding:0 0 56px;background:linear-gradient(#1a1a1a 0,#1a1a1a 72px,#fff 72px)}',
    '.spqq-card{max-width:1152px;margin:0 auto;background:#fff;border-radius:20px;box-shadow:0 18px 50px rgba(0,0,0,.14);display:grid;grid-template-columns:1fr 1.25fr;overflow:hidden;border:1px solid #eee}',
    '.spqq-side{background:#f8f7f4;padding:36px 34px;display:flex;flex-direction:column;gap:18px}',
    '.spqq-eyebrow{font-size:.75rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#888}',
    '.spqq h2{font-family:"Playfair Display",Georgia,serif;font-weight:800;font-size:clamp(1.6rem,2.6vw,2.1rem);line-height:1.15;margin:0;color:#1a1a1a}',
    '.spqq-lead{color:#555;font-size:.98rem;line-height:1.6;margin:0}',
    '.spqq-list{list-style:none;margin:0;padding:0;display:grid;gap:9px;font-size:.92rem;color:#333}',
    '.spqq-list li{display:flex;gap:10px;align-items:flex-start}',
    '.spqq-list li::before{content:"";flex:0 0 7px;height:7px;margin-top:8px;border-radius:50%;background:#1a9e75}',
    '.spqq-call{margin-top:auto;display:flex;align-items:center;gap:14px;background:#1a1a1a;color:#fff;border-radius:14px;padding:16px 18px;text-decoration:none;transition:transform .2s,box-shadow .2s}',
    '.spqq-call:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.18)}',
    '.spqq-call svg{flex:0 0 auto;width:40px;height:40px;padding:10px;border-radius:50%;background:#e8ff3c;color:#1a1a1a}',
    '.spqq-call b{display:block;font-size:1.05rem;font-weight:700}',
    '.spqq-call small{display:block;color:#aaa;font-size:.8rem}',
    '.spqq-form{padding:36px 34px;display:grid;grid-template-columns:1fr 1fr;gap:14px 16px;align-content:start}',
    '.spqq-f{display:flex;flex-direction:column;gap:6px;min-width:0}',
    '.spqq-f.wide{grid-column:1/-1}',
    '.spqq-f label{font-size:.82rem;font-weight:600;color:#333}',
    '.spqq-f input,.spqq-f select{font:inherit;font-size:1rem;color:#1a1a1a;background:#fff;border:1.5px solid #ddd;border-radius:10px;padding:12px 14px;width:100%;min-height:48px;transition:border-color .15s,box-shadow .15s}',
    '.spqq-f input:focus,.spqq-f select:focus{outline:none;border-color:#1a1a1a;box-shadow:0 0 0 3px rgba(232,255,60,.6)}',
    '.spqq-f.bad input,.spqq-f.bad select{border-color:#c0392b}',
    '.spqq-err{font-size:.78rem;color:#c0392b;min-height:0}',
    '.spqq-file{display:flex;align-items:center;gap:12px;border:1.5px dashed #ccc;border-radius:10px;padding:10px 12px;min-height:48px;cursor:pointer;background:#fff}',
    '.spqq-file:hover{border-color:#1a1a1a}',
    '.spqq-file input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}',
    '.spqq-file .pick{flex:0 0 auto;font-size:.85rem;font-weight:600;padding:7px 12px;border-radius:8px;background:#f1f1ee;color:#1a1a1a}',
    '.spqq-file .nm{font-size:.85rem;color:#777;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.spqq-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}',
    '.spqq-submit{grid-column:1/-1;font:inherit;font-size:1.02rem;font-weight:700;background:#e8ff3c;color:#1a1a1a;border:none;border-radius:50px;padding:16px 28px;min-height:54px;cursor:pointer;transition:background .2s,transform .2s,box-shadow .2s}',
    '.spqq-submit:hover{background:#ddf535;transform:translateY(-2px);box-shadow:0 8px 25px rgba(232,255,60,.35)}',
    '.spqq-submit[disabled]{opacity:.6;cursor:wait;transform:none;box-shadow:none}',
    '.spqq-msg{grid-column:1/-1;font-size:.88rem;color:#c0392b}',
    '.spqq-full{grid-column:1/-1;font-size:.86rem;color:#666;text-align:center}',
    '.spqq-full a{color:#1a1a1a;font-weight:600;text-decoration:underline;text-underline-offset:3px}',
    '.spqq-ok{grid-column:1/-1;padding:28px 4px;text-align:left}',
    '.spqq-ok h3{font-family:"Playfair Display",Georgia,serif;font-size:1.7rem;margin:0 0 8px;color:#1a1a1a}',
    '.spqq-ok p{color:#555;margin:0 0 18px}',
    '.spqq-ok a{display:inline-flex;font-weight:700;background:#1a1a1a;color:#fff;border-radius:50px;padding:13px 24px;text-decoration:none}',
    '@media (max-width:860px){',
    '  .spqq{padding:0 0 40px;background:linear-gradient(#1a1a1a 0,#1a1a1a 40px,#fff 40px)}',
    '  .spqq-card{grid-template-columns:1fr;margin:0 16px;border-radius:16px}',
    '  .spqq-side{padding:24px 20px;gap:12px}',
    '  .spqq-list{display:none}',
    '  .spqq-call{margin-top:4px}',
    '  .spqq-form{grid-template-columns:1fr 1fr;padding:22px 20px;gap:12px}',
    '  .spqq-f.half-m{grid-column:auto}',
    '  .spqq-f:not(.half-m){grid-column:1/-1}',
    '}'
  ].join('\n');

  var PHONE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render() {
    var options = svc.items.map(function (it) {
      return '<option value="' + esc(it[0]) + '">' + esc(isFr ? it[1] : it[0]) + '</option>';
    }).join('');

    return '' +
      '<div class="spqq-card">' +
        '<div class="spqq-side">' +
          '<span class="spqq-eyebrow">' + esc(T.eyebrow) + '</span>' +
          '<h2 id="spqq-h">' + esc(T.h2) + '</h2>' +
          '<p class="spqq-lead">' + esc(T.lead) + '</p>' +
          '<ul class="spqq-list"><li>' + esc(T.b1) + '</li><li>' + esc(T.b2) + '</li><li>' + esc(T.b3) + '</li></ul>' +
          '<a class="spqq-call" href="' + PHONE_TEL + '" aria-label="' + esc(T.call) + '">' + PHONE_SVG +
            '<span><b>' + esc(T.call) + '</b><small>' + esc(T.callSub) + '</small></span></a>' +
        '</div>' +
        '<form class="spqq-form" novalidate aria-labelledby="spqq-h">' +
          '<div class="spqq-f" data-f="name"><label for="spqq-name">' + esc(T.name) + '</label>' +
            '<input id="spqq-name" name="name" autocomplete="name" required><span class="spqq-err" aria-live="polite"></span></div>' +
          '<div class="spqq-f" data-f="contact"><label for="spqq-contact">' + esc(T.contact) + '</label>' +
            '<input id="spqq-contact" name="contact" autocomplete="tel" inputmode="email" placeholder="' + esc(T.contactPh) + '" required><span class="spqq-err" aria-live="polite"></span></div>' +
          '<div class="spqq-f half-m" data-f="item"><label for="spqq-item">' + esc(T.what) + '</label>' +
            '<select id="spqq-item" name="item">' + options + '</select></div>' +
          '<div class="spqq-f half-m" data-f="qty"><label for="spqq-qty">' + esc(T.qty) + '</label>' +
            '<input id="spqq-qty" name="qty" type="number" inputmode="numeric" min="1" max="100000" placeholder="25" required><span class="spqq-err" aria-live="polite"></span></div>' +
          '<div class="spqq-f wide" data-f="logo"><label for="spqq-logo">' + esc(T.logo) + '</label>' +
            '<label class="spqq-file"><input id="spqq-logo" name="logo" type="file" accept="image/*,.pdf,.ai,.eps,.psd,.svg">' +
              '<span class="pick">' + esc(T.logoPick) + '</span><span class="nm">' + esc(T.logoHint) + '</span></label>' +
            '<span class="spqq-err" aria-live="polite"></span></div>' +
          '<div class="spqq-hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>' +
          '<button class="spqq-submit" type="submit">' + esc(T.submit) + '</button>' +
          '<div class="spqq-msg" role="alert" hidden></div>' +
          '<p class="spqq-full"><a href="' + T.quoteHref + '">' + esc(T.full) + ' &rarr;</a></p>' +
        '</form>' +
      '</div>';
  }

  // ---- helpers ------------------------------------------------------------
  function fieldEl(form, key) { return form.querySelector('[data-f="' + key + '"]'); }
  function setErr(form, key, msg) {
    var f = fieldEl(form, key);
    if (!f) return;
    f.classList.toggle('bad', !!msg);
    var e = f.querySelector('.spqq-err');
    if (e) e.textContent = msg || '';
  }

  function parseContact(v) {
    v = (v || '').trim();
    if (v.indexOf('@') > -1) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? { email: v } : null;
    }
    var digits = v.replace(/\D/g, '');
    return (digits.length >= 10 && digits.length <= 15) ? { phone: v } : null;
  }

  function attribution() {
    var out = {};
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { params = null; }
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'].forEach(function (k) {
      var v = params && params.get(k);
      try {
        if (v) sessionStorage.setItem('sp_' + k, v); // same key quote.js reads
        else v = sessionStorage.getItem('sp_' + k);
      } catch (e) { /* storage blocked */ }
      if (v) out[k] = String(v).slice(0, 200);
    });
    return out;
  }

  // Same signed-URL flow as quote.js uploadDesignFile(), relay as fallback.
  function uploadLogo(file) {
    if (!file) return Promise.resolve(null);
    if (file.size > UPLOAD_MAX_BYTES) return Promise.reject(new Error('too-big'));
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
      .catch(function (err) {
        if (err && err.message === 'too-big') throw err;
        var fd = new FormData();
        fd.append('file', file);
        fd.append('kind', 'design');
        return fetch(UPLOAD_RELAY_API, { method: 'POST', body: fd })
          .then(function (r) { if (!r.ok) throw new Error('relay ' + r.status); return r.json(); });
      });
  }

  function fireConversions(contact, name, item, qty) {
    // Google Ads + GA4 — same conversion action as the full builder.
    try {
      if (window.SP_GTAG && typeof window.SP_GTAG.trackConversion === 'function') {
        window.SP_GTAG.trackConversion('quote_submit', {
          currency: 'CAD',
          transaction_id: 'qq-' + Date.now(),
          product: item,
          service: svc.crm,
          num_items: qty,
          form: 'quick_quote'
        });
      }
    } catch (e) { /* tracking never breaks the success state */ }

    // Meta Lead — Pixel + CAPI share one event_id so Meta counts one.
    try {
      var eventId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : ('lead-' + Date.now() + '-' + Math.random().toString(16).slice(2));
      var custom = { content_name: item, content_category: svc.crm, currency: 'CAD', num_items: qty };
      if (typeof window.fbq === 'function') window.fbq('track', 'Lead', custom, { eventID: eventId });

      var consented = false;
      try { consented = localStorage.getItem('sp_consent') === 'granted'; } catch (e) {}
      if (consented) {
        var ck = function (n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]+)'); return m ? decodeURIComponent(m[1]) : undefined; };
        var parts = (name || '').trim().split(/\s+/);
        fetch(CRM + '/api/ads/capi/Lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            event_id: eventId,
            event_source_url: location.href,
            email: contact.email,
            phone: contact.phone,
            first_name: parts[0] || undefined,
            last_name: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
            fbp: ck('_fbp'),
            fbc: ck('_fbc'),
            currency: 'CAD'
          })
        }).catch(function () {});
      } else if (window.SP_META && typeof window.SP_META.send === 'function') {
        window.SP_META.send('Lead', eventId, custom); // no PII without consent
      }
    } catch (e) { /* tracking never breaks the success state */ }

    try { if (window.spTrack) window.spTrack('quick_quote_submit', { service: svc.crm, item: item, total_qty: qty }); } catch (e) {}
  }

  function showSuccess(form) {
    form.innerHTML = '<div class="spqq-ok" role="status"><h3>' + esc(T.okH) + '</h3><p>' + esc(T.okP) + '</p>' +
      '<a href="' + PHONE_TEL + '">' + esc(T.call) + '</a></div>';
  }

  // ---- behaviour ----------------------------------------------------------
  function wire(root) {
    var form = root.querySelector('form');
    var fileInput = form.querySelector('#spqq-logo');
    var fileName = form.querySelector('.spqq-file .nm');
    var btn = form.querySelector('.spqq-submit');
    var msg = form.querySelector('.spqq-msg');
    var started = false;

    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      setErr(form, 'logo', f && f.size > UPLOAD_MAX_BYTES ? T.errFile : '');
      fileName.textContent = f ? f.name : T.logoHint;
    });

    // Contact field: switch the mobile keyboard once we can tell which it is.
    var contactEl = form.querySelector('#spqq-contact');
    contactEl.addEventListener('input', function () {
      var v = contactEl.value;
      contactEl.setAttribute('inputmode', /[a-z@]/i.test(v) ? 'email' : (/^\+?[\d\s().-]+$/.test(v) ? 'tel' : 'email'));
    });

    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      try { if (window.spTrack) window.spTrack('quick_quote_start', { service: svc.crm }); } catch (e) {}
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.hidden = true;

      var name = form.querySelector('#spqq-name').value.trim();
      var contact = parseContact(contactEl.value);
      var qty = parseInt(form.querySelector('#spqq-qty').value, 10) || 0;
      var item = form.querySelector('#spqq-item').value;
      var file = fileInput.files && fileInput.files[0];

      setErr(form, 'name', name ? '' : T.errName);
      setErr(form, 'contact', contact ? '' : T.errContact);
      setErr(form, 'qty', qty > 0 ? '' : T.errQty);
      var tooBig = file && file.size > UPLOAD_MAX_BYTES;
      setErr(form, 'logo', tooBig ? T.errFile : '');
      if (!name || !contact || qty <= 0 || tooBig) {
        var firstBad = form.querySelector('.spqq-f.bad input, .spqq-f.bad select');
        if (firstBad) firstBad.focus();
        return;
      }

      btn.disabled = true;
      btn.textContent = T.sending;

      uploadLogo(file)
        .catch(function () { return null; }) // a failed logo never loses the lead
        .then(function (up) {
          var notes = 'Quick quote from ' + location.pathname + ': ' + qty + ' x ' + item +
            (file && !up ? ' (logo upload failed — ask them to email it)' : '') +
            (file ? '' : ' (no logo attached)');
          var payload = {
            kind: 'quote',
            contact_name: name,
            email: contact.email || null,
            phone: contact.phone || null,
            service: svc.crm,
            garment_source: 'we_supply',
            total_qty: qty,
            num_sides: 1,
            estimated_total: 0,
            notes: notes,
            cart_items: [],
            size_breakdown: {},
            designs: up && up.path ? [{ placement: null, cart_item_index: null, path: up.path, signed_url: up.signed_url || null, mime: up.mime || null, bytes: up.bytes || null }] : [],
            design_path: (up && up.path) || null,
            design_url: (up && up.signed_url) || null,
            meta: {
              quick_quote: true,
              quick_quote_item: item,
              landing_page: location.pathname,
              lang: isFr ? 'fr' : 'en',
              attribution: attribution()
            },
            source_url: location.href,
            website: (form.querySelector('input[name="website"]') || {}).value || null
          };
          return fetch(INBOUND_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true
          });
        })
        .then(function (r) {
          if (!r || !r.ok) throw new Error('inbound ' + (r && r.status));
          return r.json().catch(function () { return {}; });
        })
        .then(function (j) {
          // queued:false = the CRM's spam layers flagged it. Show the normal
          // success (never tip off a bot) but keep it out of ad optimisation.
          if (!(j && j.queued === false)) fireConversions(contact, name, item, qty);
          showSuccess(form);
        })
        .catch(function (err) {
          console.warn('[quick-quote] submit failed:', err);
          btn.disabled = false;
          btn.textContent = T.submit;
          msg.textContent = T.errSend;
          msg.hidden = false;
        });
    });
  }

  function mount() {
    if (document.querySelector('.spqq')) return; // once per page
    var style = document.createElement('style');
    style.id = 'spqq-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    var root = document.getElementById('quick-quote');
    if (!root) {
      root = document.createElement('section');
      root.id = 'quick-quote';
      var hero = document.querySelector('section.hero');
      if (hero && hero.parentNode) hero.parentNode.insertBefore(root, hero.nextSibling);
      else document.body.appendChild(root);
    }
    root.classList.add('spqq');
    root.innerHTML = render();
    wire(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
