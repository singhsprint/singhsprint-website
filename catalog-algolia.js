/**
 * catalog-algolia.js
 *
 * Bridge module that lets /catalog.html fetch hits from Algolia instead of
 * downloading the full 6,400-product payload through /api/catalog. Page
 * holds ~30 product objects in memory at any moment, with infinite scroll
 * pulling the next page when the user nears the bottom.
 *
 * Wiring: catalog.html sets window.SP_ALGOLIA_CONFIG before this file
 * loads. If unset, catalog.html falls back to its legacy /api/catalog
 * fetch path. Useful as a kill switch.
 *
 *   <script>
 *     window.SP_ALGOLIA_CONFIG = {
 *       appId:      'YOUR_APP_ID',
 *       searchKey:  'YOUR_SEARCH_ONLY_KEY',
 *       indexName:  'singhsprint_catalog',
 *     };
 *   </script>
 *   <script src="/catalog-algolia.js"></script>
 *
 * Exposes window.SPCatalog with a single async method:
 *   search({ type, brands, canadian, csa, q, page, hitsPerPage }) →
 *     { products, total, totalPages, facets }
 *
 * The `products` array matches the legacy /api/catalog response shape so
 * catalog.html's renderer can stay unchanged.
 */
(function () {
  'use strict';
  if (!window.SP_ALGOLIA_CONFIG) {
    // Allow opt-out — catalog.html keeps its legacy /api/catalog path when
    // the config is absent. Useful while the Algolia index is being warmed
    // up for the first time.
    return;
  }

  var cfg = window.SP_ALGOLIA_CONFIG;
  if (!cfg.appId || !cfg.searchKey || !cfg.indexName) {
    console.warn('SP_ALGOLIA_CONFIG missing appId / searchKey / indexName — falling back');
    return;
  }

  // Tiny in-memory cache so paginating back-and-forth (after a chip click,
  // for example) doesn't refetch identical queries within a single visit.
  var cache = new Map();

  function hitToProduct(h, qty) {
    // If a qty is in play (catalog slider != 50), prefer prices_by_qty[qty]
    // over the default price_from. Each record carries per-tier prices
    // (5/10/25/50/100/200/500) computed at sync time, so slider drags
    // resolve client-side without another roundtrip.
    var p = (typeof h.price_from === 'number' && h.price_from > 0) ? h.price_from : null;
    if (qty && h.prices_by_qty) {
      var t = h.prices_by_qty[qty] || h.prices_by_qty[String(qty)];
      if (typeof t === 'number' && t > 0) p = t;
    }
    return {
      product_id:       h.objectID,
      brand:            h.brand,
      style_number:     h.style_number,
      name:             h.name,
      description:      h.description || null,
      garment_type:     h.garment_type,
      gender:           h.gender || null,
      weight_oz:        h.weight_oz,
      fabric:           h.fabric,
      hero_image_url:   h.hero_image_url,
      supplier_code:    h.supplier_code,
      is_canadian_made: !!h.is_canadian_made,
      has_csa_cert:     !!h.has_csa_cert,
      in_stock:         !!h.in_stock,
      color_count:      h.color_count,
      price_from:       p,
      prices_by_qty:    h.prices_by_qty || null,
      colors:           Array.isArray(h.colors) ? h.colors : [],
      // Derived facet fields — surfaced so the UI can show active-filter
      // chip labels ("Cotton", "Heather Aqua → grey", "L in stock"...) on
      // each product card if it wants to.
      color_families:   Array.isArray(h.color_families)  ? h.color_families  : [],
      fabric_family:    h.fabric_family || null,
      weight_class:     h.weight_class  || null,
      sizes_available:  Array.isArray(h.sizes_available) ? h.sizes_available : [],
    };
  }

  function buildFacetFilters(opts) {
    var f = [];
    if (opts.type)       f.push('garment_type:' + opts.type);
    if (opts.canadian)   f.push('is_canadian_made:true');
    if (opts.csa)        f.push('is_hivis_or_csa:true');
    if (opts.inStockOnly) f.push('in_stock:true');
    // Brand filter: array-of-arrays = OR within brands, AND with other filters.
    if (opts.brands && opts.brands.length) {
      f.push(opts.brands.map(function (b) { return 'brand_norm:' + b; }));
    }
    // New facet filters (2026-05-19). Each grouping is an OR (any-of) within
    // its category, AND across categories. Empty arrays are skipped so the
    // caller can pass them unconditionally.
    if (opts.colorFamilies && opts.colorFamilies.length) {
      f.push(opts.colorFamilies.map(function (c) { return 'color_families:' + c; }));
    }
    if (opts.genders && opts.genders.length) {
      f.push(opts.genders.map(function (g) { return 'gender:' + g; }));
    }
    if (opts.fabricFamilies && opts.fabricFamilies.length) {
      f.push(opts.fabricFamilies.map(function (x) { return 'fabric_family:' + x; }));
    }
    if (opts.weightClasses && opts.weightClasses.length) {
      f.push(opts.weightClasses.map(function (w) { return 'weight_class:' + w; }));
    }
    if (opts.sizes && opts.sizes.length) {
      f.push(opts.sizes.map(function (s) { return 'sizes_available:' + s; }));
    }
    return f;
  }

  // Translate priceMin/priceMax into Algolia's `numericFilters` syntax.
  // Algolia returns no hits when min > max, so caller is responsible for
  // sanity-checking the bounds before passing them through.
  function buildNumericFilters(opts) {
    var n = [];
    if (typeof opts.priceMin === 'number' && opts.priceMin > 0) {
      n.push('price_from >= ' + opts.priceMin);
    }
    if (typeof opts.priceMax === 'number' && opts.priceMax > 0) {
      n.push('price_from <= ' + opts.priceMax);
    }
    return n;
  }

  /**
   * Issue an Algolia REST query and translate the hits into the shape
   * catalog.html's productCard() expects. Algolia's normal POST body is
   * { params: <url-encoded query string> }; the SDK does this for us, but
   * we keep the deps tiny by hand-rolling the same shape.
   */
  async function search(opts) {
    opts = opts || {};
    // qty doesn't change Algolia's hit set, only the price field we read,
    // so the cache key intentionally excludes it. Different qty values
    // reuse the same cached Algolia response and pick the right price
    // off prices_by_qty client-side.
    var cacheOpts = Object.assign({}, opts); delete cacheOpts.qty;
    var key = JSON.stringify(cacheOpts);
    var cached = cache.has(key) ? cache.get(key) : null;
    if (cached) {
      // Re-project the cached hits with the current qty's price.
      return Object.assign({}, cached, {
        products: cached._rawHits.map(function (h) { return hitToProduct(h, opts.qty); }),
      });
    }

    var facetFilters   = buildFacetFilters(opts);
    var numericFilters = buildNumericFilters(opts);
    var qs = new URLSearchParams();
    qs.set('query',         opts.q || '');
    qs.set('page',          String(opts.page || 0));
    qs.set('hitsPerPage',   String(opts.hitsPerPage || 30));
    // Return facets for the filter panel so chip counts reflect the current
    // filter set. Includes the new derived facets so the side panel can
    // show "(420)" next to each Color / Gender / Fabric / Sizes / Weight
    // option without a second request.
    qs.set('facets', JSON.stringify([
      'brand_norm', 'garment_type', 'gender',
      'color_families', 'fabric_family', 'weight_class', 'sizes_available',
    ]));
    if (facetFilters.length)   qs.set('facetFilters',   JSON.stringify(facetFilters));
    if (numericFilters.length) qs.set('numericFilters', JSON.stringify(numericFilters));

    var url = 'https://' + cfg.appId + '-dsn.algolia.net/1/indexes/' +
              encodeURIComponent(cfg.indexName) + '/query';
    var res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': cfg.appId,
        'X-Algolia-API-Key':         cfg.searchKey,
        'Content-Type':              'application/x-www-form-urlencoded',
      },
      body: JSON.stringify({ params: qs.toString() }),
    });
    if (!res.ok) throw new Error('Algolia ' + res.status);
    var r = await res.json();

    var rawHits = r.hits || [];
    var out = {
      products:   rawHits.map(function (h) { return hitToProduct(h, opts.qty); }),
      total:      r.nbHits,
      totalPages: r.nbPages,
      page:       r.page,
      facets:     r.facets || {},
      processingTimeMS: r.processingTimeMS,
      _rawHits:   rawHits,   // kept on the cached entry for qty re-projection
    };
    cache.set(key, out);
    return out;
  }

  window.SPCatalog = {
    config: cfg,
    search: search,
    clearCache: function () { cache.clear(); },
  };
})();
