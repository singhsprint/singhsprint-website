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
      // Custom quantities typed into the "Custom" box (e.g. 3, 37, 73) aren't
      // one of the precomputed tiers (5/10/25/50/100/200/500), so the exact
      // lookup misses and the card used to fall back to the default qty-50
      // price_from — the per-unit price never moved for those quantities.
      // Resolve to the correct band instead: volume pricing holds until the
      // next break, so use the largest tier <= qty; for qty below the smallest
      // tier, use the smallest tier (you can't price below the minimum break).
      if (!(typeof t === 'number' && t > 0)) {
        var tiers = Object.keys(h.prices_by_qty)
          .map(Number)
          .filter(function (k) { return Number.isFinite(k) && h.prices_by_qty[k] > 0; })
          .sort(function (a, b) { return a - b; });
        var chosen = null;
        for (var ti = 0; ti < tiers.length; ti++) {
          if (tiers[ti] <= qty) chosen = tiers[ti];
        }
        if (chosen == null && tiers.length) chosen = tiers[0];
        if (chosen != null) {
          var ct = h.prices_by_qty[chosen];
          if (typeof ct === 'number' && ct > 0) t = ct;
        }
      }
      if (typeof t === 'number' && t > 0) p = t;
    }
    return {
      product_id:       h.objectID,
      brand:            h.brand,
      style_number:     h.style_number,
      name:             h.name,
      description:      h.description || null,
      garment_type:     h.garment_type,
      // Corrected retail category (drives the sidebar count + active-chip
      // label). Falls back to garment_type for any record synced before the
      // re-tag. catalog.html reads p.category.
      category:         h.category_effective || h.garment_type || null,
      category_effective: h.category_effective || h.garment_type || null,
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

  // Nav "parent" landings that mean several categories at once. The top-nav
  // buttons (Bottoms / Accessories / Workwear) point at these aliases via
  // ?type=<alias>; each expands to an OR-group of category_effective leaves
  // (Workwear also folds in the hi-vis/CSA safety flag) so the parent shows
  // the whole family instead of a single sub-category. The granular sub-menu
  // links still pass a real category_effective value and hit the branch below.
  // 2026-07-22.
  var CATEGORY_GROUPS = {
    bottoms:     ['category_effective:joggers', 'category_effective:sweatpants',
                  'category_effective:shorts', 'category_effective:pants',
                  'category_effective:leggings'],
    accessories: ['category_effective:hat', 'category_effective:beanie',
                  'category_effective:visor', 'category_effective:bag',
                  'category_effective:gloves', 'category_effective:scarf',
                  'category_effective:headband'],
    workwear:    ['category_effective:coverall', 'category_effective:scrubs',
                  'category_effective:apron', 'category_effective:chore_coat',
                  'category_effective:workshirt', 'is_hivis_or_csa:true'],
  };

  function buildFacetFilters(opts) {
    var f = [];
    // Default browse (no category chip AND no search): hide non-printable
    // accessories — socks, gloves, towels, koozies — so the grid opens on
    // real decoratable sellers instead of cheap many-coloured oddities that
    // used to top the "Bestseller" sort. 2026-07-19. Any explicit category
    // or search lifts the filter so those items stay findable.
    var hasQuery = !!(opts.q && String(opts.q).trim());
    if (!opts.type && !hasQuery) f.push('printable:true');
    // Category chips filter on the corrected taxonomy (category_effective),
    // not the legacy garment_type — see the 2026-06-10 catalog re-tag.
    // A group alias (bottoms/accessories/workwear) expands to an OR-array;
    // a plain value is a single-category equality.
    if (opts.type) {
      if (CATEGORY_GROUPS[opts.type]) f.push(CATEGORY_GROUPS[opts.type].slice());
      else                            f.push('category_effective:' + opts.type);
    }
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

  // ===========================================================================
  // Disjunctive-facet fan-out.
  //
  // Algolia returns facet counts *filtered by the active facetFilters*. That
  // makes counts inside a multi-select category collapse to 0 the moment the
  // user picks any value in that category (because the other values can no
  // longer co-occur). The Amazon-style behaviour customers expect is:
  //
  //   • Selecting "100% cotton" still shows accurate counts on Cotton-blend,
  //     Polyester, Performance, etc.
  //   • But picking "Red" + "Blue" inside Color is an OR within the category
  //     and an AND with everything else.
  //
  // The standard fix is to fire one query per multi-select category with
  // *that category's* filters removed, then merge those facet counts back
  // into the main response. Algolia exposes `/1/indexes/*/queries` so we
  // can batch all 6 queries (main + 5 disjunctive) in a single HTTP roundtrip.
  // ===========================================================================
  var DISJUNCTIVE_FACETS = [
    'color_families',
    'gender',
    'fabric_family',
    'weight_class',
    'sizes_available',
  ];
  var ALL_FACETS = ['brand_norm', 'category_effective'].concat(DISJUNCTIVE_FACETS);

  // Build a per-category filter set: the same facetFilters minus the entries
  // belonging to `category`. Used to compute "what would the counts be if
  // this category's selections were cleared?"
  function filtersWithout(facetFilters, category) {
    return facetFilters
      .map(function (entry) {
        if (Array.isArray(entry)) {
          // OR-group — drop any leaves that belong to this category, keep
          // the rest. If the whole group belonged to category, drop the group.
          var kept = entry.filter(function (s) { return s.indexOf(category + ':') !== 0; });
          return kept.length ? kept : null;
        }
        // Single string — drop if it belongs to this category.
        return entry.indexOf(category + ':') === 0 ? null : entry;
      })
      .filter(Boolean);
  }

  function buildParams(opts, facetFilters, numericFilters, facets, page, hitsPerPage) {
    var qs = new URLSearchParams();
    qs.set('query',       opts.q || '');
    qs.set('page',        String(page || 0));
    qs.set('hitsPerPage', String(hitsPerPage || 30));
    qs.set('facets',      JSON.stringify(facets));
    if (facetFilters.length)   qs.set('facetFilters',   JSON.stringify(facetFilters));
    if (numericFilters.length) qs.set('numericFilters', JSON.stringify(numericFilters));
    return qs.toString();
  }

  /**
   * Issue an Algolia REST query and translate the hits into the shape
   * catalog.html's productCard() expects. Sends a multi-query so chip
   * counts in multi-select categories (Color / Gender / Fabric / Sizes /
   * Weight) stay accurate even after the user has picked a value in that
   * category.
   */
  async function search(opts) {
    opts = opts || {};
    // qty doesn't change Algolia's hit set, only the price field we read,
    // so the cache key intentionally excludes it.
    var cacheOpts = Object.assign({}, opts); delete cacheOpts.qty;
    var key = JSON.stringify(cacheOpts);
    var cached = cache.has(key) ? cache.get(key) : null;
    if (cached) {
      return Object.assign({}, cached, {
        products: cached._rawHits.map(function (h) { return hitToProduct(h, opts.qty); }),
      });
    }

    var facetFilters   = buildFacetFilters(opts);
    var numericFilters = buildNumericFilters(opts);

    // 1. Main query — full filters, returns the actual hits + facet counts
    //    for facets that ARE NOT disjunctive (brand_norm, garment_type).
    var mainParams = buildParams(opts, facetFilters, numericFilters, ALL_FACETS, opts.page, opts.hitsPerPage);
    var requests = [{ indexName: cfg.indexName, params: mainParams }];

    // 2. One sidecar query per disjunctive category — same filters with
    //    that category's filters dropped, only that category's facet
    //    requested, zero hits to keep the response tiny.
    DISJUNCTIVE_FACETS.forEach(function (cat) {
      var subset = filtersWithout(facetFilters, cat);
      var p = buildParams(opts, subset, numericFilters, [cat], 0, 0);
      requests.push({ indexName: cfg.indexName, params: p });
    });

    var url = 'https://' + cfg.appId + '-dsn.algolia.net/1/indexes/*/queries';
    var res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': cfg.appId,
        'X-Algolia-API-Key':         cfg.searchKey,
        'Content-Type':              'application/x-www-form-urlencoded',
      },
      body: JSON.stringify({ requests: requests }),
    });
    if (!res.ok) throw new Error('Algolia ' + res.status);
    var body = await res.json();
    var results = body.results || [];
    var main = results[0] || {};

    // Merge facet counts: main has every facet, but the multi-select ones
    // are filtered. Overwrite each disjunctive category's counts with its
    // sidecar query's response, which reflects "counts if this category's
    // selection were cleared".
    var mergedFacets = Object.assign({}, main.facets || {});
    DISJUNCTIVE_FACETS.forEach(function (cat, i) {
      var sideRes = results[i + 1];
      if (sideRes && sideRes.facets && sideRes.facets[cat]) {
        mergedFacets[cat] = sideRes.facets[cat];
      }
    });

    var rawHits = main.hits || [];
    var out = {
      products:   rawHits.map(function (h) { return hitToProduct(h, opts.qty); }),
      total:      main.nbHits,
      totalPages: main.nbPages,
      page:       main.page,
      facets:     mergedFacets,
      processingTimeMS: main.processingTimeMS,
      _rawHits:   rawHits,
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
