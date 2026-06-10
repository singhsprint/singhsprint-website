/* =========================================================================
 * mockup-customizer.js — shared garment mockup composer
 *
 * Self-contained IIFE that exposes window.SPMockup.open(opts). It builds its
 * own modal DOM and injects its own CSS, uploads artwork to the inbound
 * endpoint, and bakes per-placement previews via /api/shop/compose.
 *
 * Extracted verbatim from quote.html's inline customizer so multiple pages
 * (quote.html keeps its own inline copy; catalog.html uses this module) can
 * share one implementation without coupling to page globals.
 *
 * opts: {
 *   colorId,
 *   garment:{front,back,side},
 *   placements:[presetId],
 *   fileFor:fn(presetId)->File|null,
 *   initial:{boxes,removeBg},
 *   sessionId,
 *   onDone:fn(result),
 *   placementPresets,            // lookup table { presetId:{label,size,cx,cy} }
 *   composeApi?, uploadApi?,     // endpoint overrides
 *   sleeveRender?, sleeveRenderRight?
 * }
 * result: { mockups:[{placement,url}], boxes:{}, removeBg, design:{path,signed_url} }
 * ========================================================================= */
(function () {
  'use strict';

  // ---- Module-level defaults (mirror quote.html's constants) -------------
  var DEFAULT_SHOP_COMPOSE_API   = 'https://singhsprint-crm.vercel.app/api/shop/compose';
  var DEFAULT_INBOUND_UPLOAD_API = 'https://singhsprint-crm.vercel.app/api/inbound/upload';
  var DEFAULT_UPLOAD_MAX_BYTES   = 15 * 1024 * 1024; // 15 MB
  var DEFAULT_SP_SLEEVE_RENDER   = '/images/sleeve-left.png?v=2';
  var DEFAULT_SP_SLEEVE_RENDER_R = '/images/sleeve-right.png?v=2';
  var IMAGE_PROXY = 'https://singhsprint-crm.vercel.app/api/image-proxy';

  // Active endpoint constants — set per open() call from opts, falling back to
  // the module defaults. uploadDesignFile/spUploadDesignOnce/spOpenCustomizer
  // all read these (kept as module vars so the verbatim function bodies need
  // no rewiring beyond parameterizing the presets table).
  var SHOP_COMPOSE_API   = DEFAULT_SHOP_COMPOSE_API;
  var INBOUND_UPLOAD_API = DEFAULT_INBOUND_UPLOAD_API;
  var UPLOAD_MAX_BYTES   = DEFAULT_UPLOAD_MAX_BYTES;
  var SP_SLEEVE_RENDER   = DEFAULT_SP_SLEEVE_RENDER;
  var SP_SLEEVE_RENDER_R = DEFAULT_SP_SLEEVE_RENDER_R;

  // S&S Activewear 403's external hotlinks — route their images through our
  // server-side proxy. Mirrors imgUrl() in catalog.html / quote.html.
  function imgUrl(raw) {
    if (!raw) return '';
    if (raw.indexOf('/api/image-proxy') >= 0) return raw;     // already proxied
    if (raw.charAt(0) === '/' || raw.indexOf('singhsprint.com') >= 0) return raw;
    if (raw.indexOf('ssactivewear.com') >= 0) {
      return IMAGE_PROXY + '?url=' + encodeURIComponent(raw);
    }
    return raw;
  }

  // ---- Upload (verbatim from quote.html ~6974-6996) ----------------------
  function uploadDesignFile(file) {
    if (!file) return Promise.resolve(null);
    if (file.size && file.size > UPLOAD_MAX_BYTES) {
      var mb = (file.size / 1024 / 1024).toFixed(1);
      return Promise.reject(new Error(
        'Your design file is ' + mb + ' MB — our upload limit is 15 MB. ' +
        'Please compress or email it to sales@singhsprint.com.'
      ));
    }
    var fd = new FormData();
    fd.append('file', file);
    fd.append('kind', 'design');
    return fetch(INBOUND_UPLOAD_API, { method: 'POST', body: fd })
      .then(function(res){
        if (!res.ok) {
          return res.text().then(function(t){
            console.warn('[design upload] HTTP ' + res.status + ':', t);
            throw new Error('Upload failed (' + res.status + '). Try again or email your design to sales@singhsprint.com.');
          });
        }
        return res.json();
      });
  }

  // Upload each File at most once (compose needs a server-fetchable URL/path,
  // not a blob: URL). Cached by File identity.
  var __spUploadCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
  function spUploadDesignOnce(file) {
    if (!file) return Promise.resolve(null);
    if (__spUploadCache && __spUploadCache.has(file)) return Promise.resolve(__spUploadCache.get(file));
    return uploadDesignFile(file).then(function(r) {
      var info = { path: (r && (r.path || r.key)) || null, signed_url: (r && (r.signed_url || r.url || r.signedUrl)) || null };
      if (__spUploadCache) __spUploadCache.set(file, info);
      return info;
    });
  }

  // Which garment side a placement renders on — mirrors viewFor() server-side.
  function spSideFor(p) { p = (p || '').toLowerCase(); if (/back/.test(p)) return 'back'; if (/sleeve/.test(p)) return 'side'; return 'front'; }

  // Seed a sensible default {x,y,w} from the placement preset's centre + size.
  function spDefaultBox(presetId, PRESETS) {
    PRESETS = PRESETS || {};
    // Sleeve placements preview on the standard tee render — seed the box
    // over the correct sleeve (left vs right) instead of using the chest-
    // tuned preset centre.
    if (/sleeve/i.test(presetId)) {
      var isRight = /right/i.test(presetId);
      // Centre the art on the sleeve print zone of the photo render
      // (left photo: sleeve at x~0.58; right render is the mirror at x~0.42).
      return { x: isRight ? 0.32 : 0.48, y: 0.35, w: 0.20 };
    }
    var pre = PRESETS[presetId] || {};
    var sizeW = { 'left-chest': 0.18, 'right-chest': 0.18, 'small': 0.16, 'medium': 0.34, 'large': 0.5, 'xl': 0.62 };
    var w = sizeW[pre.size] || 0.3;
    var cx = (typeof pre.cx === 'number') ? pre.cx : 0.5;
    var cy = (typeof pre.cy === 'number') ? pre.cy : 0.4;
    return { x: Math.max(0, Math.min(1 - w, cx - w / 2)), y: Math.max(0, Math.min(1 - w, cy - w / 2)), w: w };
  }

  function spInjectCustomizerCSS() {
    if (document.getElementById('spCustomizerCSS')) return;
    var st = document.createElement('style');
    st.id = 'spCustomizerCSS';
    st.textContent =
      '.sp-cz-overlay{position:fixed;inset:0;background:rgba(15,15,15,.82);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}' +
      '.sp-cz{background:#1a1a1a;border:1px solid #333;border-radius:18px;width:100%;max-width:560px;max-height:94vh;overflow:auto;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.5)}' +
      '.sp-cz-h{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #2a2a2a}' +
      '.sp-cz-h h3{font-family:inherit;font-size:1rem;font-weight:700;margin:0}' +
      '.sp-cz-x{background:transparent;border:none;color:#aaa;font-size:1.4rem;line-height:1;cursor:pointer;padding:4px 8px}' +
      '.sp-cz-tabs{display:flex;gap:6px;flex-wrap:wrap;padding:14px 20px 0}' +
      '.sp-cz-tab{background:#262626;border:1px solid #333;color:#ccc;border-radius:50px;padding:6px 12px;font-size:.78rem;font-weight:600;cursor:pointer}' +
      '.sp-cz-tab.active{background:#e8ff3c;color:#1a1a1a;border-color:#e8ff3c}' +
      '.sp-cz-tab:disabled{opacity:.4;cursor:not-allowed}' +
      '.sp-cz-stage{position:relative;margin:14px 20px;background:#fff;border-radius:12px;overflow:hidden;aspect-ratio:1/1;width:calc(100% - 40px);touch-action:none;user-select:none}' +
      '.sp-cz-garment{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}' +
      '.sp-cz-art{position:absolute;cursor:move;touch-action:none;user-select:none;-webkit-user-drag:none}' +
      '.sp-cz-ctl{padding:4px 20px 0}' +
      '.sp-cz-row{display:flex;align-items:center;gap:10px;margin:10px 0;font-size:.85rem;color:#ddd}' +
      '.sp-cz-row input[type=range]{flex:1;accent-color:#e8ff3c}' +
      '.sp-cz-foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:14px 20px 20px;border-top:1px solid #2a2a2a;margin-top:8px}' +
      '.sp-cz-btn{border:none;border-radius:50px;padding:11px 18px;font-weight:700;font-size:.86rem;cursor:pointer;font-family:inherit}' +
      '.sp-cz-btn--primary{background:#e8ff3c;color:#1a1a1a}' +
      '.sp-cz-btn--ghost{background:transparent;color:#ccc;border:1px solid #444}' +
      '.sp-cz-btn:disabled{opacity:.5;cursor:not-allowed}' +
      '.sp-cz-status{font-size:.78rem;color:#9a9a9a;flex:1;min-width:120px}' +
      '.sp-cz-spin{width:16px;height:16px;border:2px solid #555;border-top-color:#e8ff3c;border-radius:50%;display:inline-block;vertical-align:middle;margin-right:6px;animation:spCzSpin .8s linear infinite}' +
      '@keyframes spCzSpin{to{transform:rotate(360deg)}}' +
      // Sticky footer so the action buttons are always reachable under the
      // tall square stage. Header sticky too so the title/close stay put.
      '.sp-cz-h{position:sticky;top:0;background:#1a1a1a;z-index:2}' +
      '.sp-cz-foot{position:sticky;bottom:0;background:#1a1a1a;z-index:2}' +
      // Desktop: cap the square stage by viewport height so the size slider
      // and action buttons stay on-screen without scrolling.
      '@media (min-width:561px){.sp-cz-stage{width:min(calc(100% - 40px),50vh);height:auto;margin-left:auto;margin-right:auto}}' +
      // Mobile: full-bleed sheet, square stage capped to keep controls in
      // view, and stacked full-width buttons (primary on top).
      '@media (max-width:560px){' +
        '.sp-cz-overlay{padding:0;align-items:stretch}' +
        '.sp-cz{max-width:none;max-height:100vh;height:100vh;border-radius:0;display:flex;flex-direction:column}' +
        '.sp-cz-stage{aspect-ratio:auto;height:min(56vh,60vw);flex:0 0 auto}' +
        '.sp-cz-foot{flex-wrap:wrap}' +
        '.sp-cz-status{flex:1 0 100%;order:1;margin-bottom:4px}' +
        '.sp-cz-btn{flex:1;order:2;padding:13px 16px;font-size:.92rem}' +
        '.sp-cz-btn--primary{order:1;flex:1 0 100%}' +
      '}';
    document.head.appendChild(st);
  }

  // opts: { colorId, garment:{front,back,side}, placements:[presetId], fileFor:fn(presetId)->File|null,
  //         initial:{boxes,removeBg}, sessionId, onDone:fn(result) }
  // result: { mockups:[{placement,url}], boxes:{}, removeBg, design:{path,signed_url} }
  function open(opts) {
    opts = opts || {};
    // Per-call endpoint overrides — set the module vars the verbatim function
    // bodies read, falling back to module defaults.
    SHOP_COMPOSE_API   = opts.composeApi || DEFAULT_SHOP_COMPOSE_API;
    INBOUND_UPLOAD_API = opts.uploadApi || DEFAULT_INBOUND_UPLOAD_API;
    UPLOAD_MAX_BYTES   = opts.uploadMaxBytes || DEFAULT_UPLOAD_MAX_BYTES;
    SP_SLEEVE_RENDER   = opts.sleeveRender || DEFAULT_SP_SLEEVE_RENDER;
    SP_SLEEVE_RENDER_R = opts.sleeveRenderRight || DEFAULT_SP_SLEEVE_RENDER_R;
    var PRESETS = opts.placementPresets || {};

    spInjectCustomizerCSS();
    var placements = (opts.placements || []).filter(Boolean);
    if (!placements.length) placements = ['center-chest'];

    // Resolve the design File per placement. Each placement only previews the
    // art that was actually uploaded for it — placements without their own art
    // stay blank (no fallback), so e.g. a front-only design never bleeds onto
    // the back tab.
    var firstFile = null;
    var fileByP = {};
    placements.forEach(function(p) {
      var f = opts.fileFor ? opts.fileFor(p) : null;
      if (f instanceof File) { fileByP[p] = f; if (!firstFile) firstFile = f; }
    });
    if (!firstFile) {
      alert('Add your artwork first (the upload field), then tap “Customize & preview”.');
      return;
    }
    function hasArt(p) { return fileByP[p] instanceof File; }

    var boxes = {};
    placements.forEach(function(p) {
      boxes[p] = (opts.initial && opts.initial.boxes && opts.initial.boxes[p]) || spDefaultBox(p, PRESETS);
    });
    var removeBg = !!(opts.initial && opts.initial.removeBg);
    var active = 0;
    var objURLs = {};
    function artURL(p) {
      var f = fileByP[p];
      if (!f) return '';
      if (!objURLs[f.name + f.size]) objURLs[f.name + f.size] = URL.createObjectURL(f);
      return objURLs[f.name + f.size];
    }
    function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

    var overlay = document.createElement('div');
    overlay.className = 'sp-cz-overlay';
    overlay.innerHTML =
      '<div class="sp-cz" role="dialog" aria-modal="true">' +
        '<div class="sp-cz-h"><h3>Customize your mockup</h3><button type="button" class="sp-cz-x" aria-label="Close">×</button></div>' +
        '<div class="sp-cz-tabs"></div>' +
        '<div class="sp-cz-stage"><img class="sp-cz-garment" alt="garment"/><img class="sp-cz-art" alt="your design" draggable="false"/></div>' +
        '<div class="sp-cz-ctl">' +
          '<div class="sp-cz-row"><span>Size</span><input type="range" min="0.08" max="0.9" step="0.01"></div>' +
          '<label class="sp-cz-row" style="cursor:pointer"><input type="checkbox" class="sp-cz-bg"> Remove white background around my logo</label>' +
        '</div>' +
        '<div class="sp-cz-foot">' +
          '<span class="sp-cz-status">Drag your art, set the size, then preview.</span>' +
          '<button type="button" class="sp-cz-btn sp-cz-btn--ghost sp-cz-preview">Preview on garment</button>' +
          '<button type="button" class="sp-cz-btn sp-cz-btn--primary sp-cz-done">Use this mockup</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    // Scroll-lock that preserves position. Just toggling body overflow leaves
    // mobile Safari scrolled/shifted ("page off the screen") after close, so
    // pin the body at the current scroll offset and restore it on close.
    var _lockY = window.scrollY || window.pageYOffset || 0;
    var _prevBody = { position: document.body.style.position, top: document.body.style.top, left: document.body.style.left, right: document.body.style.right, width: document.body.style.width, overflow: document.body.style.overflow };
    document.body.style.position = 'fixed';
    document.body.style.top = (-_lockY) + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    var tabsEl  = overlay.querySelector('.sp-cz-tabs');
    var garImg  = overlay.querySelector('.sp-cz-garment');
    var artImg  = overlay.querySelector('.sp-cz-art');
    var stage   = overlay.querySelector('.sp-cz-stage');
    var slider  = overlay.querySelector('input[type=range]');
    var bgChk   = overlay.querySelector('.sp-cz-bg');
    var statusEl= overlay.querySelector('.sp-cz-status');
    var previewBtn = overlay.querySelector('.sp-cz-preview');
    var doneBtn = overlay.querySelector('.sp-cz-done');
    bgChk.checked = removeBg;

    var bakedMockups = []; // [{placement,url}]

    function curP() { return placements[Math.min(active, placements.length - 1)]; }
    function renderTabs() {
      tabsEl.innerHTML = '';
      placements.forEach(function(p, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sp-cz-tab' + (i === active ? ' active' : '');
        b.textContent = (PRESETS[p] && PRESETS[p].label) || p;
        b.onclick = function() { active = i; paint(); };
        tabsEl.appendChild(b);
      });
    }
    function garmentFor(p) {
      var g = opts.garment || {};
      var side = spSideFor(p);
      // No catalog side photos exist — sleeve placements use the standard
      // sleeve render so the preview matches what the server composites.
      if (side === 'side' && !g.side) return /right/i.test(p) ? SP_SLEEVE_RENDER_R : SP_SLEEVE_RENDER;
      return g[side] || g.front || g.back || g.side || '';
    }
    function paint() {
      var p = curP();
      renderTabs();
      var gp = garmentFor(p);
      garImg.src = gp ? (typeof imgUrl === 'function' ? imgUrl(gp) : gp) : '';
      garImg.style.display = gp ? '' : 'none';
      if (hasArt(p)) {
        artImg.src = artURL(p);
        artImg.style.display = '';
        slider.disabled = false;
        slider.value = boxes[p].w;
        positionArt();
        statusEl.textContent = 'Drag your art, set the size, then preview.';
      } else {
        // No design uploaded for this placement — show the blank garment only.
        artImg.src = '';
        artImg.style.display = 'none';
        slider.disabled = true;
        var lbl = (PRESETS[p] && PRESETS[p].label) || p;
        statusEl.textContent = 'No design uploaded for ' + lbl + ' yet — upload one to customize it.';
      }
    }
    function positionArt() {
      var b = boxes[curP()];
      artImg.style.left   = (b.x * 100) + '%';
      artImg.style.top    = (b.y * 100) + '%';
      artImg.style.width  = (b.w * 100) + '%';
      artImg.style.height = 'auto';
    }

    // Drag.
    var grab = null;
    function frac(e) {
      var r = stage.getBoundingClientRect();
      return { px: (e.clientX - r.left) / r.width, py: (e.clientY - r.top) / r.height };
    }
    artImg.addEventListener('pointerdown', function(e) {
      var b = boxes[curP()]; var f = frac(e);
      grab = { dx: f.px - b.x, dy: f.py - b.y };
      try { artImg.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    artImg.addEventListener('pointermove', function(e) {
      if (!grab) return;
      var b = boxes[curP()]; var f = frac(e);
      b.x = clamp(f.px - grab.dx, 0, 1 - b.w);
      b.y = clamp(f.py - grab.dy, 0, 1 - 0.02);
      positionArt();
    });
    function endDrag() { grab = null; }
    artImg.addEventListener('pointerup', endDrag);
    artImg.addEventListener('pointercancel', endDrag);

    slider.addEventListener('input', function() {
      var b = boxes[curP()]; var n = Number(slider.value);
      b.w = n; b.x = clamp(b.x, 0, 1 - n); positionArt();
    });
    bgChk.addEventListener('change', function() { removeBg = bgChk.checked; });

    function setBusy(busy, msg) {
      previewBtn.disabled = busy; doneBtn.disabled = busy;
      statusEl.innerHTML = (busy ? '<span class="sp-cz-spin"></span>' : '') + (msg || '');
    }
    function close() {
      Object.keys(objURLs).forEach(function(k) { try { URL.revokeObjectURL(objURLs[k]); } catch (_) {} });
      // Restore the exact pre-open body styles, then jump back to where the
      // page was scrolled so the layout never ends up shifted off-screen.
      document.body.style.position = _prevBody.position;
      document.body.style.top = _prevBody.top;
      document.body.style.left = _prevBody.left;
      document.body.style.right = _prevBody.right;
      document.body.style.width = _prevBody.width;
      document.body.style.overflow = _prevBody.overflow;
      window.scrollTo(0, _lockY);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    overlay.querySelector('.sp-cz-x').onclick = close;
    overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });

    // Bake every placement that has art, via /api/shop/compose.
    function bakeAll() {
      if (!opts.colorId) { alert('Pick a garment colour first.'); return Promise.resolve([]); }
      setBusy(true, 'Rendering your mockup…');
      var design = null;
      var results = [];
      // Upload art once, then compose each placement sequentially (gentle on
      // the rate-limited endpoint).
      return spUploadDesignOnce(firstFile).then(function(info) {
        design = info;
        if (!info || (!info.path && !info.signed_url)) throw new Error('artwork upload failed');
        var chain = Promise.resolve();
        placements.forEach(function(p) {
          if (!hasArt(p)) return; // skip placements with no uploaded art
          chain = chain.then(function() {
            return spUploadDesignOnce(fileByP[p]).then(function(di) {
              var b = boxes[p];
              return fetch(SHOP_COMPOSE_API, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  color_id: opts.colorId, placement: p,
                  design_path: (di && di.path) || null,
                  design_url:  (di && di.signed_url) || null,
                  box: b, remove_bg: removeBg, session_id: opts.sessionId || null
                })
              }).then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
                .then(function(res) {
                  if (res.ok && res.j && res.j.mockup_url) results.push({ placement: p, url: res.j.mockup_url });
                  else throw new Error((res.j && res.j.error) || 'preview failed');
                });
            });
          });
        });
        return chain.then(function() { return { mockups: results, design: design }; });
      });
    }

    previewBtn.onclick = function() {
      bakeAll().then(function(out) {
        bakedMockups = out.mockups;
        // Show the active placement's baked image in the stage as confirmation.
        // Only swap in a mockup that belongs to the current placement, so a
        // blank tab (no art) keeps showing the plain garment.
        var m = bakedMockups.filter(function(x) { return x.placement === curP(); })[0];
        if (m) { garImg.src = m.url; artImg.style.display = 'none'; }
        setBusy(false, 'Looks good? Tap “Use this mockup”.');
      }).catch(function(e) {
        setBusy(false, 'Preview failed: ' + ((e && e.message) || e));
      });
    };

    doneBtn.onclick = function() {
      // If they never previewed, bake now so the order still carries a mockup.
      var go = bakedMockups.length ? Promise.resolve({ mockups: bakedMockups, design: null }) : bakeAll();
      setBusy(true, 'Saving…');
      go.then(function(out) {
        var mocks = out.mockups || bakedMockups;
        spUploadDesignOnce(firstFile).then(function(design) {
          if (typeof opts.onDone === 'function') {
            opts.onDone({ mockups: mocks, boxes: boxes, removeBg: removeBg, design: design });
          }
          close();
        });
      }).catch(function(e) { setBusy(false, 'Could not save: ' + ((e && e.message) || e)); });
    };

    paint();
  }

  // ---- Public API --------------------------------------------------------
  window.SPMockup = { open: open };
})();
