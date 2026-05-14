// =====================================================================
// AI translation overlay — used by /catalog (and any other page with
// supplier-fed dynamic content where hand-translation isn't tractable).
//
// Strategy: when SP_LANG flips to 'fr', call MyMemory's free translation
// API to render product names, descriptions, and colour names in French.
// Results are cached in localStorage so the same string is only fetched
// once per browser. EN ↔ FR mappings stay client-side; the original EN
// text remains in the DOM as data-orig-en for fast restoration.
//
// MyMemory free tier: 5,000 anon chars/day, no API key required, CORS-
// enabled. More than enough for browsing a catalog of ~1,100 SKUs.
// =====================================================================

window.AITranslate = (function () {
  var CACHE_KEY  = 'ai-trans-cache-v1';
  var STATE_KEY  = 'ai-trans-active';
  var inflight   = {};           // de-dupe concurrent fetches per string
  var cache      = readCache();

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function writeCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
    catch (e) {}
  }

  // Translate a single string. Returns a Promise<string>.
  function translateOne(text, target) {
    target = target || 'fr';
    var trimmed = (text || '').trim();
    if (!trimmed) return Promise.resolve(text);

    var key = target + ':' + trimmed;
    if (cache[key]) return Promise.resolve(cache[key]);
    if (inflight[key]) return inflight[key];

    var url = 'https://api.mymemory.translated.net/get'
            + '?q=' + encodeURIComponent(trimmed)
            + '&langpair=en|' + encodeURIComponent(target)
            + '&de=hello@singhsprint.com';   // attribution per MyMemory ToS

    var p = fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var out = (d && d.responseData && d.responseData.translatedText) || trimmed;
        // MyMemory sometimes echoes the input verbatim on failure or returns
        // an error wrapped in a string; only cache real translations.
        if (out && out !== trimmed && !/MYMEMORY WARNING/i.test(out)) {
          cache[key] = out;
          writeCache();
        }
        return out;
      })
      .catch(function () { return trimmed; })
      .finally(function () { delete inflight[key]; });

    inflight[key] = p;
    return p;
  }

  // Batch-translate the text nodes of a single element. Mutates the DOM:
  // each translated element keeps its original EN copy at data-orig-en
  // for instant restoration on lang flip.
  function translateNode(el, target) {
    if (!el) return Promise.resolve();
    if (el.dataset.aiTransLocked === '1') return Promise.resolve();
    var orig = el.dataset.origEn != null ? el.dataset.origEn : el.textContent;
    if (el.dataset.origEn == null) el.dataset.origEn = orig;
    return translateOne(orig, target).then(function (txt) {
      el.textContent = txt;
    });
  }

  // Walk a container and translate every element matching `selectors`.
  // selectors: array of CSS selectors (e.g. ['.name', '.swatch'])
  // Concurrency limited so we don't burst the API.
  function translateContainer(container, selectors, target, concurrency) {
    if (!container) return Promise.resolve();
    target = target || 'fr';
    concurrency = concurrency || 6;
    var els = [];
    selectors.forEach(function (sel) {
      container.querySelectorAll(sel).forEach(function (el) { els.push(el); });
    });

    return new Promise(function (resolve) {
      var i = 0, running = 0, done = 0;
      function pump() {
        while (running < concurrency && i < els.length) {
          var el = els[i++];
          running++;
          translateNode(el, target).then(function () {
            running--; done++;
            if (done === els.length) resolve();
            else pump();
          });
        }
        if (els.length === 0) resolve();
      }
      pump();
    });
  }

  // Restore the EN originals (data-orig-en) in the given container — fast,
  // no network. Use this when toggling back to EN.
  function restoreContainer(container) {
    if (!container) return;
    container.querySelectorAll('[data-orig-en]').forEach(function (el) {
      el.textContent = el.dataset.origEn;
    });
  }

  function isActive() { return localStorage.getItem(STATE_KEY) === '1'; }
  function setActive(v) {
    if (v) localStorage.setItem(STATE_KEY, '1');
    else localStorage.removeItem(STATE_KEY);
  }

  return {
    translateOne:       translateOne,
    translateNode:      translateNode,
    translateContainer: translateContainer,
    restoreContainer:   restoreContainer,
    isActive:           isActive,
    setActive:          setActive,
  };
})();
