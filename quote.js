// Extracted from quote.html (was the main inline <script> block). Loaded with
// defer; shared by the EN page and its /fr/ mirror so it is parsed from cache.
// ===== STATE =====
    var state = {
      product: '',
      garment: 'tshirt',
      color: '#111111',
      colorName: 'Black',
      placement: 'front',
      service: '',
      view: 'front',
      designSrc: null,
      canadianBlanks: false
    };

    // ===== ALL-CANADIAN BLANKS TOGGLE =====
    function toggleCanadianBlanks(label) {
      var cb = document.getElementById('canadianBlanksCheckbox');
      cb.checked = !cb.checked;
      state.canadianBlanks = cb.checked;
      if (cb.checked) {
        label.classList.add('checked');
      } else {
        label.classList.remove('checked');
      }
      if (typeof calculatePrice === 'function') calculatePrice();
    }

    var colorNames = {
      '#111111': 'Black',
      '#FFFFFF': 'White',
      '#1C3A5F': 'Navy',
      '#8B2500': 'Maroon',
      '#4A4A4A': 'Charcoal',
      '#556B2F': 'Forest Green',
      '#C2B280': 'Sand',
      '#D4A5A5': 'Dusty Rose',
      '#6B8E9B': 'Slate Blue',
      '#F5E6CA': 'Cream'
    };

    // ===== PRODUCT =====
    // Blank brand options by garment type (4 picks + Rue Saint-Patrick)
    var stpat = {v:'Rue Saint-Patrick', t:'Rue Saint-Patrick - Canadian-made, premium quality'};
    var blankOptions = {
      tshirt: [
        {v:'Gildan Softstyle', t:'Gildan Softstyle - Soft, lightweight, great value'},
        {v:'Bella+Canvas 3001', t:'Bella+Canvas 3001 - Premium retail feel, fitted'},
        {v:'American Apparel 1301', t:'American Apparel 1301 - Heavyweight cotton, made in USA'},
        {v:'Comfort Colors 1717', t:'Comfort Colors 1717 - Garment-dyed, vintage look'},
        stpat
      ],
      hoodie: [
        {v:'Gildan 18500', t:'Gildan 18500 - Budget-friendly heavyweight'},
        {v:'Champion S700', t:'Champion S700 - Streetwear quality, thick fleece'},
        {v:'Independent Trading SS4500', t:'Independent Trading SS4500 - Premium midweight'},
        {v:'American Apparel RF498', t:'American Apparel RF498 - Flex fleece hoodie'},
        {v:'Bella+Canvas 3719', t:'Bella+Canvas 3719 - Soft, retail feel'}
      ],
      crewneck: [
        {v:'Gildan 18000', t:'Gildan 18000 - Budget-friendly, classic fit'},
        {v:'Champion S600', t:'Champion S600 - Heavyweight fleece'},
        {v:'Comfort Colors 1566', t:'Comfort Colors 1566 - Garment-dyed, relaxed'},
        {v:'American Apparel RF496', t:'American Apparel RF496 - Flex fleece crewneck'},
        {v:'Independent Trading SS3000', t:'Independent Trading SS3000 - Midweight crew'}
      ],
      polo: [
        {v:'Gildan 8800', t:'Gildan 8800 - DryBlend jersey polo'},
        {v:'Port Authority K500', t:'Port Authority K500 - Silk Touch, professional'},
        {v:'Nike NKDC1963', t:'Nike Dri-FIT - Performance, moisture-wicking'},
        {v:'Adidas A230', t:'Adidas Performance - Sport, breathable'},
        stpat
      ],
      hat: [
        {v:'Yupoong 6089', t:'Yupoong 6089 - Classic snapback'},
        {v:'Richardson 112', t:'Richardson 112 - Trucker, mesh back'},
        {v:'Flexfit 6277', t:'Flexfit 6277 - Fitted, structured'},
        {v:'Otto Cap 83-1101', t:'Otto Cap - 5-panel, dad hat style'}
      ],
      joggers: [
        {v:'Gildan 18200', t:'Gildan 18200 - Heavy blend sweatpants'},
        {v:'Champion RW10', t:'Champion RW10 - Reverse weave joggers'},
        {v:'Independent Trading IND20PNT', t:'Independent Trading - Midweight fleece'},
        {v:'American Apparel 5398', t:'American Apparel 5398 - California fleece jogger'},
        {v:'Bella+Canvas 3727', t:'Bella+Canvas 3727 - Sponge fleece jogger'}
      ],
      tote: [
        {v:'Q-Tees Q800', t:'Q-Tees Q800 - Canvas tote, 12oz'},
        {v:'Liberty Bags 8502', t:'Liberty Bags 8502 - Branson cotton canvas'},
        {v:'BAGedge BE003', t:'BAGedge BE003 - 8oz canvas tote'},
        {v:'Gemline 1507', t:'Gemline 1507 - Economy cotton tote'}
      ],
      longsleeve: [
        {v:'Gildan 2400', t:'Gildan 2400 - Ultra Cotton long sleeve'},
        {v:'Bella+Canvas 3501', t:'Bella+Canvas 3501 - Jersey long sleeve'},
        {v:'American Apparel 2007', t:'American Apparel 2007 - Fine jersey long sleeve'},
        {v:'Comfort Colors 6014', t:'Comfort Colors 6014 - Garment-dyed, heavyweight'},
        {v:'Next Level 3601', t:'Next Level 3601 - Soft, fitted'}
      ]
    };

    function updateBlankOptions() {
      var select = document.getElementById('blankBrand');
      var garment = state.garment || '';
      var options = blankOptions[garment] || blankOptions['tshirt'] || [];
      select.innerHTML = '<option value="">Any / Let us recommend</option>';
      options.forEach(function(opt) {
        var o = document.createElement('option');
        o.value = opt.v;
        o.textContent = opt.t;
        select.appendChild(o);
      });
    }

    function selectProduct(el) {
      document.querySelectorAll('.product-option').forEach(function(o) { o.classList.remove('selected'); });
      el.classList.add('selected');
      state.product = el.dataset.value;
      state.garment = el.dataset.garment;
      document.getElementById('productInput').value = state.product;
      document.getElementById('sumProduct').textContent = state.product;
      updateGarmentShape();
      updateBlankOptions();
      renderBulkPricingTable();
      // Garment changed → re-resolve the per-size surcharge matrix.
      try { if (typeof spRefreshSizeSurcharges === 'function') spRefreshSizeSurcharges(); } catch(e) {}
      // Rebuild the global placement section so the picker shows
      // placements that actually exist on this garment (no Sleeves on
      // a hat, no Center Chest on a tote, etc.).
      renderGlobalPlacementGroups(state.garment);
    }

    // ===== COLOR =====
    function selectColor(el) {
      document.querySelectorAll('.color-swatch').forEach(function(s) { s.classList.remove('selected'); });
      el.classList.add('selected');
      state.color = el.dataset.color;
      state.colorName = colorNames[state.color] || state.color;
      document.getElementById('colorInput').value = state.colorName;
      document.getElementById('colorName').textContent = state.colorName;
      document.getElementById('sumColor').textContent = state.colorName;
      // SVG placeholder mode: recolour the silhouette. Stroke/detail flip to
      // white on dark fills so the line work stays readable.
      updateGarmentColor();
    }

    // ===== PLACEMENT (multi-select) =====
    function togglePlacement(el) {
      // Must have at least one selected
      el.classList.toggle('selected');
      var selected = document.querySelectorAll('.placement-opt.selected');
      if (selected.length === 0) { el.classList.add('selected'); }
      // Build comma-separated list
      var placements = [];
      selected = document.querySelectorAll('.placement-opt.selected');
      selected.forEach(function(o) { placements.push(o.dataset.placement); });
      state.placement = placements[0]; // primary for mockup
      state.placements = placements;
      document.getElementById('placementInput').value = placements.join(', ');
      var names = [];
      selected.forEach(function(o) { names.push(o.querySelector('.pl-name').textContent); });
      document.getElementById('sumPlacement').textContent = names.join(', ');
      updateDesignPosition();
    }

    // ===== GARMENT SOURCE =====
    function selectGarmentSource(el) {
      el.parentElement.querySelectorAll('.svc-btn').forEach(function(o) { o.classList.remove('selected'); });
      el.classList.add('selected');
      document.getElementById('garmentSourceInput').value = el.dataset.value;
      var brandSection   = document.getElementById('blankBrandSection');
      var byoPanel       = document.getElementById('byoPricePanel');
      var isBYO          = el.dataset.value === 'BYOG';
      if (brandSection) brandSection.style.display = isBYO ? 'none' : 'block';
      if (byoPanel)     byoPanel.style.display     = isBYO ? 'block' : 'none';
      if (isBYO) refreshByoPrice();
    }

    // -----------------------------------------------------------------
    // BYO (Bring Your Own Garment) decoration-only price preview.
    // Hits /api/pricing/decoration-only which returns just the print/embr
    // cost — no blank, no FX, no shipping — so customers see what we'd
    // charge to decorate garments they ship to us.
    // -----------------------------------------------------------------
    function refreshByoPrice() {
      var panel = document.getElementById('byoPricePanel');
      if (!panel || panel.style.display === 'none') return;
      var qty   = parseInt(document.getElementById('byoQty')?.value || '50', 10) || 50;
      var sides = parseInt(document.getElementById('printCountInput')?.value || '1', 10) || 1;
      var method = (state.service || 'DTF').toLowerCase();
      // Map service labels → API methods
      if (!['embroidery','dtf','dtg','screen'].includes(method)) method = 'dtf';

      // Collect the customer's actually-selected placement PRESETS
      // (e.g. "full-front", "back-full") so the endpoint can apply
      // per-size multipliers — a full back costs more than a left chest.
      //
      // The form doesn't expose them as <input name="placements[]">
      // checkboxes; instead each location holds a preset id in the
      // `presetByLocation` JS map and a comma-separated mirror in the
      // hidden #placementPresetInput. We prefer the JS map (always
      // current) but fall back to the hidden input so this still works
      // in any reduced-JS edge case.
      var placements = [];
      try {
        if (typeof presetByLocation === 'object' && presetByLocation) {
          placements = Object.values(presetByLocation).filter(Boolean);
        }
        if (placements.length === 0) {
          var presetVal = (document.getElementById('placementPresetInput') || {}).value || '';
          placements = presetVal.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
        }
      } catch (e) { placements = []; }

      var url = 'https://singhsprint-crm.vercel.app/api/pricing/decoration-only' +
                '?qty=' + qty + '&method=' + method;
      if (placements.length > 0) {
        url += '&placements=' + encodeURIComponent(placements.join(','));
      } else {
        url += '&sides=' + sides;
      }

      document.getElementById('byoPriceUnit').textContent  = '…';
      document.getElementById('byoPriceTotal').textContent = '…';
      fetch(url).then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
        if (!d || typeof d.unit_price !== 'number') {
          document.getElementById('byoPriceUnit').textContent  = '—';
          document.getElementById('byoPriceTotal').textContent = '—';
          return;
        }
        var unit  = d.unit_price;
        var total = (unit * qty);

        // Update the inline BYO panel (Step 1 left-column placement).
        document.getElementById('byoPriceUnit').textContent  = '$' + unit.toFixed(2);
        document.getElementById('byoPriceTotal').textContent = '$' + total.toFixed(2);
        document.getElementById('byoPriceMethod').textContent = method.charAt(0).toUpperCase() + method.slice(1);
        // Sides label: prefer real placement count when present so the
        // header reads "2 locations" instead of the legacy "2 sides".
        var sidesEl = document.getElementById('byoPriceSides');
        if (sidesEl) {
          if (placements.length > 0) {
            sidesEl.textContent = placements.length + ' location' + (placements.length === 1 ? '' : 's');
          } else {
            sidesEl.textContent = sides + ' side' + (sides > 1 ? 's' : '');
          }
        }

        // Mirror into the right-panel #livePriceStrip so the BYO flow
        // surfaces in the same prominent spot the catalog flow uses —
        // customer sees one canonical "live estimate" regardless of
        // whether they're picking from our catalog or shipping us blanks.
        // We hide the unit suffix swap because BYO is /garment, not /unit.
        var strip = document.getElementById('livePriceStrip');
        if (strip) {
          strip.style.display = 'block';
          var stripUnit   = document.getElementById('livePriceUnit');
          var stripSuffix = document.getElementById('livePriceUnitSuffix');
          var stripQty    = document.getElementById('livePriceQty');
          var stripTotW   = document.getElementById('livePriceTotalWrap');
          var stripTotal  = document.getElementById('livePriceTotal');
          if (stripUnit)   stripUnit.textContent   = '$' + unit.toFixed(2);
          if (stripSuffix) stripSuffix.textContent = '/garment';
          var locLabel = placements.length > 0
            ? (placements.length + ' location' + (placements.length === 1 ? '' : 's'))
            : (sides + ' side' + (sides > 1 ? 's' : ''));
          if (stripQty) stripQty.textContent =
            qty + ' garment' + (qty === 1 ? '' : 's') +
            ' · ' + method.toUpperCase() +
            ' · ' + locLabel;
          if (stripTotW)  stripTotW.style.display = 'block';
          if (stripTotal) stripTotal.textContent = '$' + total.toFixed(2);
        }
      });
    }

    // ===== SERVICE =====
    function selectService(el) {
      // Works for both the legacy .svc-btn row and the new .method-card grid.
      // Scope to siblings inside the same parent so it doesn't accidentally
      // deselect the Garment Source buttons (which also use .svc-btn).
      el.parentElement.querySelectorAll('.svc-btn, .method-card').forEach(function(o) { o.classList.remove('selected'); });
      el.classList.add('selected');
      state.service = el.dataset.value;
      document.getElementById('serviceInput').value = state.service;
      document.getElementById('sumMethod').textContent = state.service;
      renderBulkPricingTable();
      // Refresh BYO decoration-only price (the method drives the per-piece cost)
      refreshByoPrice();
      // Decoration method changed → matrix's per-method overrides shift.
      try { if (typeof spRefreshSizeSurcharges === 'function') spRefreshSizeSurcharges(); } catch(e) {}
      // Method-specific placement constraints + size hints:
      //   • Embroidery hoops can't go past ~12", so Oversized and Full
      //     Back disappear; chest presets pick up a "(5×5″ hoop)" hint
      //     and Full Front picks up a "(larger jumbo hoop)" hint.
      // Driven by the .is-embroidery body class — CSS does the rest.
      var isEmb = String(state.service || '').toLowerCase() === 'embroidery';
      document.body.classList.toggle('is-embroidery', isEmb);
      // If the customer had Oversized or Full Back selected and just
      // flipped to Embroidery, silently deselect those — otherwise the
      // engine would still see them in the cart's placements array
      // (defaulting to 1× multiplier) and the customer would expect a
      // print we can't actually produce.
      if (isEmb) {
        // 1) Sweep the per-cart-item placements: if a cart row had
        //    Oversized or Full Back picked under DTG/DTF, strip it.
        //    Items left with zero placements default to Center Chest so
        //    every row keeps at least one valid location.
        if (typeof SinghsCart !== 'undefined') {
          var citems = SinghsCart.read().items || [];
          var changed = false;
          citems.forEach(function(it, idx) {
            var orig = (it.placements || []).slice();
            var filtered = orig.filter(function(p) { return !EMB_DISALLOWED[p]; });
            if (filtered.length === 0) filtered.push('center-chest');
            var same = filtered.length === orig.length &&
                       filtered.every(function(x, i){ return x === orig[i]; });
            if (!same) {
              SinghsCart.updateSilent(idx, { placements: filtered });
              changed = true;
            }
          });
          if (changed && typeof renderCartList === 'function') renderCartList();
        }
        // 2) Same sweep in the GLOBAL placement picker (used when the
        //    customer is in single-product / non-cart mode). Deselect
        //    the now-hidden cards so they don't quietly stay in state.
        document.querySelectorAll('.preset-card[data-preset="oversized"].selected, .preset-card[data-preset="back-full"].selected')
          .forEach(function(c){
            // togglePlacementPreset expects the card to currently be
            // selected; flip it once to deselect cleanly.
            if (typeof togglePlacementPreset === 'function') {
              togglePlacementPreset(c);
            }
          });
      }
      // DTG → DTF means same engine price; DTG ↔ Embroidery flips the
      // engine's decoration_method axis. Wipe the per-item price cache so
      // every line item refetches under the new method and the live
      // estimate strip + per-row subtotals reflect the change immediately.
      _priceCache = {};
      if (typeof renderCartList === 'function') renderCartList();
      // Also refresh the right-panel live-price strip if it was already
      // populated (single-product / pre-cart flow).
      if (typeof fetchLiveUnitPrice === 'function') {
        fetchLiveUnitPrice(function(px) {
          if (typeof renderPriceDisplay === 'function' && typeof px === 'number') {
            renderPriceDisplay(state.qty || 50, px, true);
          }
        });
      }
    }

    // ===== BULK PRICING TABLE RENDERER =====
    // Surfaces the tier prices on Step 1 so cold paid-ad visitors can confirm
    // the per-unit price ("$13.95 each at 50") BEFORE filling out the form.
    function renderBulkPricingTable() {
      var host = document.getElementById('bulkPricingTableHost');
      var nameEl = document.getElementById('bulkPricingProductName');
      if (!host) return;

      // When a catalog product is selected, fetch the LIVE bulk matrix for
      // THAT specific product from the engine — same source of truth as the
      // catalog-pick "From $X" card and the right-panel live-price strip.
      // This used to read a hardcoded b2bPricing table that showed the
      // generic Gildan-floor price, which contradicted the live engine for
      // any product whose wholesale was above the floor (Gildan 18500 hoodie
      // showed $24.95 in this table while the live card showed $34.95).
      if (catalogPick && catalogPick.product_id) {
        if (nameEl) nameEl.textContent = catalogPick.brand + ' ' + catalogPick.style_number;
        host.innerHTML = '<p style="font-size:.85rem;color:#999;margin:0">Loading tier prices…</p>';
        fetch(PRICING_API_FOR_QUOTE + '?product_id=' + encodeURIComponent(catalogPick.product_id) + '&matrix=1')
          .then(function(r){ return r.ok ? r.json() : null; })
          .then(function(d){
            if (!d || !Array.isArray(d.bulk_matrix) || !d.bulk_matrix.length) {
              host.innerHTML = '<p style="font-size:.85rem;color:#999;margin:0">No bulk pricing available — submit a quote and we will price it for you.</p>';
              return;
            }
            renderBulkMatrixHtml(host, d.bulk_matrix);
          })
          .catch(function(){
            host.innerHTML = '<p style="font-size:.85rem;color:#999;margin:0">Couldn\'t load tier prices. Pricing on the right is still accurate.</p>';
          });
        return;
      }

      // Fallback: no catalog product picked → use the legacy hardcoded
      // b2bPricing table by garment_type. Same behaviour as before for
      // non-catalog visitors (e.g. someone who clicked a legacy "T-Shirt"
      // tile).
      var garment = state.garment;
      var service = (state.service || 'DTG').toLowerCase();
      if (!garment || !b2bPricing[garment]) {
        host.innerHTML = '<p style="font-size:.85rem;color:#999;margin:0">Pick a product above to see the tier pricing.</p>';
        if (nameEl) nameEl.textContent = 'your product';
        return;
      }
      var pricingInfo = b2bPricing[garment][service] || b2bPricing[garment]['dtg'] || b2bPricing[garment]['embroidery'];
      if (!pricingInfo) {
        host.innerHTML = '<p style="font-size:.85rem;color:#999;margin:0">No bulk pricing available for this combination yet — submit a quote and we will price it for you.</p>';
        return;
      }
      if (nameEl) nameEl.textContent = pricingInfo.name || state.product;

      var collapseToSingle = pricingInfo.maxLocations === 1;
      var rows = pricingInfo.tiers.slice().reverse().map(function(t) {
        var qtyLabel = t.max === Infinity ? (t.min + '+') : (t.min + '–' + t.max);
        if (collapseToSingle) return '<tr><td>' + qtyLabel + '</td><td>$' + t.single.toFixed(2) + '</td></tr>';
        return '<tr>'
          + '<td>' + qtyLabel + '</td>'
          + '<td>$' + (t.single != null ? t.single.toFixed(2) : '—') + '</td>'
          + '<td>$' + (t.multi != null ? t.multi.toFixed(2) : '—') + '</td>'
          + '<td>$' + (t.fullprint != null ? t.fullprint.toFixed(2) : '—') + '</td>'
          + '<td>$' + (t.wrap != null ? t.wrap.toFixed(2) : '—') + '</td>'
          + '</tr>';
      }).join('');
      var headers = collapseToSingle
        ? '<tr><th style="text-align:left">Quantity</th><th style="text-align:left">Per unit</th></tr>'
        : '<tr><th style="text-align:left">Quantity</th><th style="text-align:left">1 side</th><th style="text-align:left">2 sides</th><th style="text-align:left">3 sides</th><th style="text-align:left">4 sides</th></tr>';
      host.innerHTML =
        '<table style="width:100%;border-collapse:collapse;font-size:.85rem">'
        + '<thead style="background:#fff;font-size:.78rem;text-transform:uppercase;letter-spacing:.5px;color:#666">' + headers + '</thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table>'
        + bulkTableStyle();
    }

    // Render a /api/pricing?matrix=1 response (array of { qty_min, qty_max,
    // sides_1, sides_2, sides_3, sides_4 }) as the same table layout the
    // legacy code produced.
    function renderBulkMatrixHtml(host, matrix) {
      // Reverse so 200+ shows at the top, descending to 5-9 at the bottom.
      // The matrix from the engine comes in qty-tiers order (largest first).
      // Detect collapse-to-single by checking if sides_2 is present anywhere.
      var sidesAvailable = [];
      [1,2,3,4].forEach(function(s){
        if (matrix.some(function(r){ return r['sides_'+s] != null; })) sidesAvailable.push(s);
      });
      var rows = matrix.map(function(t) {
        var qtyLabel = t.qty_max == null ? (t.qty_min + '+') : (t.qty_min + '–' + t.qty_max);
        var cells = sidesAvailable.map(function(s){
          var v = t['sides_'+s];
          return '<td>' + (v != null ? '$' + Number(v).toFixed(2) : '—') + '</td>';
        }).join('');
        return '<tr><td>' + qtyLabel + '</td>' + cells + '</tr>';
      }).join('');
      var headerCells = sidesAvailable.map(function(s){
        return '<th style="text-align:left">' + s + ' side' + (s>1?'s':'') + '</th>';
      }).join('');
      host.innerHTML =
        '<table style="width:100%;border-collapse:collapse;font-size:.85rem">'
        + '<thead style="background:#fff;font-size:.78rem;text-transform:uppercase;letter-spacing:.5px;color:#666">'
        + '<tr><th style="text-align:left">Quantity</th>' + headerCells + '</tr>'
        + '</thead>'
        + '<tbody>' + rows + '</tbody>'
        + '</table>'
        + bulkTableStyle();
    }

    function bulkTableStyle() {
      return '<style>'
        + '#bulkPricingTableHost{position:relative;max-width:100%;width:100%;box-sizing:border-box}'
        + '#bulkPricingTableHost table{width:100%;table-layout:fixed;border-collapse:collapse}'
        + '#bulkPricingTableHost td,#bulkPricingTableHost th{padding:7px 10px;border-bottom:1px solid #eee}'
        + '#bulkPricingTableHost tr:last-child td{border-bottom:none}'
        + '#bulkPricingTableHost tbody tr:hover{background:#fff}'
        // PHONES: shrink padding + font so 5 cols (qty + 4 sides) fit ~360px wide.
        + '@media (max-width:480px){'
        +   '#bulkPricingTableHost{overflow:hidden}'
        +   '#bulkPricingTableHost table{font-size:.72rem !important}'
        +   '#bulkPricingTableHost th,#bulkPricingTableHost td{padding:6px 4px !important;text-align:center !important}'
        +   '#bulkPricingTableHost th:first-child,#bulkPricingTableHost td:first-child{text-align:left !important;font-weight:600}'
        +   '#bulkPricingTableHost thead{font-size:.62rem !important;letter-spacing:.2px !important}'
        + '}'
        // VERY NARROW (≤340px) — drop the heading text-transform to save space
        + '@media (max-width:340px){'
        +   '#bulkPricingTableHost th,#bulkPricingTableHost td{padding:5px 2px !important;font-size:.68rem !important}'
        + '}'
        + '</style>';
    }

    // ===== VIEW TOGGLE =====
    function switchView(view, btn) {
      document.querySelectorAll('.view-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      state.view = view;

      // Store design position for this view
      if (canvas && designObject) {
        var viewKey = 'designState_' + view;
        if (state.designViewStates === undefined) state.designViewStates = {};

        // Save current position
        if (state.designViewStates[state.view === 'front' ? 'back' : 'front']) {
          // Restore previous view position
          var saved = state.designViewStates[view];
          if (saved) {
            designObject.left = saved.left;
            designObject.top = saved.top;
            designObject.scaleX = saved.scaleX;
            designObject.scaleY = saved.scaleY;
            designObject.angle = saved.angle;
          }
        } else {
          // Save position for current view
          var current = state.view === 'front' ? 'front' : 'back';
          state.designViewStates[current] = {
            left: designObject.left,
            top: designObject.top,
            scaleX: designObject.scaleX,
            scaleY: designObject.scaleY,
            angle: designObject.angle
          };
        }
      }

      updateDesignPosition();
      canvas.renderAll();
    }

    // ===== GARMENT SVG PLACEHOLDER =====
    // Show one line-art SVG group per garment. Each group is in the DOM and
    // hidden by default; we flip the right one on. The photo+tint layer is
    // dormant — when the SnS catalog API is wired we'll flip the photo layer
    // on and the SVG off, with the SVG staying as the "Bring Your Own"
    // fallback for garments we don't have a supplier SKU for.
    function updateGarmentShape() {
      var allGarments = ['tshirt','hoodie','crewneck','hat','tote','joggers','longsleeve','polo'];
      allGarments.forEach(function(g) {
        var el = document.getElementById('garment-' + g);
        if (el) el.style.display = 'none';
      });

      var garment = state.garment || 'tshirt';
      if (garment === 'other') garment = 'tshirt';
      if (garment === 'hivis') garment = 'tshirt';   // closest silhouette
      var target = document.getElementById('garment-' + garment);
      if (target) target.style.display = 'block';

      updateGarmentColor();
      updatePlacementRestrictions();
      if (canvas) drawPrintAreaBoundary();
    }

    function updatePlacementRestrictions() {
      var restricted = (state.garment === 'tote' || state.garment === 'hat' || state.garment === 'joggers');
      var needsUpdate = false;

      document.querySelectorAll('.loc-check').forEach(function(el) {
        var loc = el.getAttribute('data-loc');
        if (restricted && (loc === 'left-sleeve' || loc === 'right-sleeve')) {
          el.style.opacity = '0.3';
          el.style.pointerEvents = 'none';
          // Uncheck if it was checked
          if (el.classList.contains('checked')) {
            el.classList.remove('checked');
            el.querySelector('input').checked = false;
            needsUpdate = true;
          }
        } else {
          el.style.opacity = '1';
          el.style.pointerEvents = 'auto';
        }
      });

      if (needsUpdate) updateLocationSelection();
    }

    function updateGarmentColor() {
      var c = state.color;
      var isLight = isLightColor(c);
      // Outline + detail strokes adapt to fill brightness so line work stays visible
      // on every shade — pure dark on light fills, white-ish lines on dark fills
      // (like a technical drawing in white pen on a chalkboard).
      var stroke = isLight ? '#1a1a1a' : '#ffffff';
      var detail = isLight ? '#444444' : '#cccccc';
      // Push stroke colors as CSS vars on each garment group; new line-art paths read these.
      ['tshirt','hoodie','crewneck','hat','tote','joggers','longsleeve','polo'].forEach(function(name) {
        var el = document.getElementById('garment-' + name);
        if (el) {
          el.style.setProperty('--garment-fill', c);
          el.style.setProperty('--garment-stroke', stroke);
          el.style.setProperty('--garment-detail', detail);
        }
      });

      // All fill IDs that need color updates (backward compat for any path still using ID)
      var fillIds = [
        'garmentFill', 'garmentFillHoodie', 'hoodFill',
        'garmentFillCrewneck', 'garmentFillHat',
        'garmentFillTote', 'garmentFillJoggersWaist',
        'garmentFillJoggersL', 'garmentFillJoggersR',
        'garmentFillLong', 'garmentFillPolo',
        'garmentFillPoloCollar', 'garmentFillPoloCollarL', 'garmentFillPoloCollarR'
      ];
      fillIds.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.setAttribute('fill', c);
      });
      // Brim slightly darker
      var brim = document.getElementById('brimFill');
      if (brim) brim.setAttribute('fill', darkenColor(c, 30));
      // Tote handles slightly darker
      var handleL = document.getElementById('toteHandleL');
      var handleR = document.getElementById('toteHandleR');
      if (handleL) handleL.setAttribute('stroke', darkenColor(c, 20));
      if (handleR) handleR.setAttribute('stroke', darkenColor(c, 20));

      // Update line/detail colors so the new technical-illustration garments
      // stay legible across every fill (black lines on white shirts, light
      // lines on black shirts, etc.).
      var lineColor = getLineColor(c);
      var lineIds = ['garmentLine','garmentLineHoodie','hoodLine','garmentLineCrewneck',
        'garmentLineLong','garmentLinePolo','garmentLinePoloCollarL','garmentLinePoloCollarR',
        'garmentLineHat','garmentLineTote','garmentLineJoggersWaist',
        'garmentLineJoggersL','garmentLineJoggersR'];
      lineIds.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.setAttribute('stroke', lineColor);
      });
      document.querySelectorAll('.trim').forEach(function(el) {
        el.setAttribute('stroke', lineColor);
      });
      document.querySelectorAll('.trim-fill').forEach(function(el) {
        el.setAttribute('fill', lineColor);
      });

      // Garment is rendered as SVG in the DOM; canvas is overlay-only for design,
      // so no canvas re-render is needed when garment color changes.
    }

    function isLightColor(hex) {
      hex = hex.replace('#', '');
      var r = parseInt(hex.substr(0,2),16);
      var g = parseInt(hex.substr(2,2),16);
      var b = parseInt(hex.substr(4,2),16);
      // Perceived luminance
      return (r * 299 + g * 587 + b * 114) / 1000 > 140;
    }

    function darkenColor(hex, amount) {
      hex = hex.replace('#', '');
      var r = Math.max(0, parseInt(hex.substr(0,2),16) - amount);
      var g = Math.max(0, parseInt(hex.substr(2,2),16) - amount);
      var b = Math.max(0, parseInt(hex.substr(4,2),16) - amount);
      return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
    }

    function lightenColor(hex, amount) {
      hex = hex.replace('#', '');
      var r = Math.min(255, parseInt(hex.substr(0,2),16) + amount);
      var g = Math.min(255, parseInt(hex.substr(2,2),16) + amount);
      var b = Math.min(255, parseInt(hex.substr(4,2),16) + amount);
      return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
    }

    function lightenColor(hex, amount) {
      hex = hex.replace('#', '');
      var r = Math.min(255, parseInt(hex.substr(0,2),16) + amount);
      var g = Math.min(255, parseInt(hex.substr(2,2),16) + amount);
      var b = Math.min(255, parseInt(hex.substr(4,2),16) + amount);
      return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
    }

    // Pick a line/detail color that stays visible against the chosen garment fill.
    // Light fills get near-black; dark fills get a lighter version of the fill so
    // the construction details (collar, cuffs, hem) read without overpowering.
    function getLineColor(fill) {
      return isLightColor(fill) ? '#1a1a1a' : '#ffffff';
    }

    // ===== CANVAS EDITOR =====
    // Approach: Garment SVG renders natively in HTML (always visible).
    // Fabric.js canvas is transparent overlay for design placement only.
    var canvas = null;
    var designObject = null;
    var printAreaBox = null;
    var currentLocation = 'front';
    var printCount = 1;

    var printAreaSizes = {
      'right-chest': {w: 0.18, h: 0.16},
      'left-chest':  {w: 0.18, h: 0.16},
      small:         {w: 0.22, h: 0.20},
      medium:        {w: 0.30, h: 0.28},
      large:         {w: 0.35, h: 0.38},
      xl:            {w: 0.45, h: 0.48}
    };
    var currentPrintArea = 'medium'; // default matches center-chest preset
    var currentPresetId = 'center-chest'; // tracks the active placement preset, drives position

    // Fallback per-location positions used when no preset is active (e.g. when
    // the user has only clicked a location tab, not a preset card).
    var locationPositions = {
      'front':        {cx: 0.50, cy: 0.42},
      'back':         {cx: 0.50, cy: 0.42},
      'left-sleeve':  {cx: 0.22, cy: 0.32},
      'right-sleeve': {cx: 0.78, cy: 0.32}
    };

    function getPrintAreaRect() {
      if (!canvas) return null;
      var cw = canvas.width;
      var ch = canvas.height;

      // Prefer the active preset's position over the location fallback so
      // "Left Chest" actually lands on the left chest, "Top Back" near the
      // collar, etc. — instead of every preset on a side defaulting to centre.
      var preset = placementPresets[currentPresetId];
      var loc;
      if (preset && typeof preset.cx === 'number' && typeof preset.cy === 'number'
          && preset.loc === currentLocation) {
        loc = { cx: preset.cx, cy: preset.cy };
      } else {
        loc = locationPositions[currentLocation] || locationPositions['front'];
      }

      var sizeKey = currentPrintArea;
      if (loc.maxSize) {
        var sizeOrder = ['small','medium','large','xl'];
        var maxIdx = sizeOrder.indexOf(loc.maxSize);
        var curIdx = sizeOrder.indexOf(sizeKey);
        if (curIdx > maxIdx) sizeKey = loc.maxSize;
      }
      var size = printAreaSizes[sizeKey];
      var w = cw * size.w;
      var h = ch * size.h;
      return {cx: cw * loc.cx, cy: ch * loc.cy, w: w, h: h, left: cw * loc.cx - w/2, top: ch * loc.cy - h/2};
    }

    var nameMap = {'front':'Front','back':'Back','left-sleeve':'Left Sleeve','right-sleeve':'Right Sleeve'};

    // ===== LOCATION CHECKBOXES (in form) — drive selection =====
    // ===== PLACEMENT PRESETS =====
    // Map each preset card to a canvas location + print-area size key, so customers
    // pick a named placement instead of dragging on the mockup.
    // cx/cy = canvas fractions where the print-area box centres. Tuned for the
    // SVG silhouette (which fills ~14%–86% of the canvas horizontally). When
    // we move to real product photos these will need a small retune.
    // Reusable silhouette paths. The print-area rect is drawn separately
    // per preset so we get crisp positioning. viewBox is 42x50 across all
    // silhouettes for consistency in the picker grid.
    var _SHIRT_FRONT_PATH = 'M9 5 L4 7 L1 14 L4 17 L8 12 L8 45 L34 45 L34 12 L38 17 L41 14 L38 7 L33 5 C32 8 28 10 21 10 C14 10 10 8 9 5 Z';
    var _SHIRT_BACK_PATH  = 'M9 5 L4 7 L1 14 L4 17 L8 12 L8 45 L34 45 L34 12 L38 17 L41 14 L38 7 L33 5 L9 5 Z';
    var _HOODIE_PATH      = 'M9 7 L4 9 L1 16 L4 19 L8 14 L8 45 L34 45 L34 14 L38 19 L41 16 L38 9 L33 7 C32 10 28 12 21 12 C14 12 10 10 9 7 Z M14 7 Q14 0 21 0 Q28 0 28 7 Z';
    var _CAP_PATH         = 'M5 28 Q5 12 21 12 Q37 12 37 28 L41 28 Q41 32 38 32 L4 32 Q1 32 1 28 Z';
    var _BAG_PATH         = 'M8 16 L34 16 L34 46 L8 46 Z M14 16 Q14 8 17 8 L19 8 Q22 8 22 16 M20 16 Q20 8 23 8 L25 8 Q28 8 28 16';
    var _PANTS_PATH       = 'M11 5 L31 5 L31 11 L28 47 L23 47 L21 24 L21 24 L19 47 L14 47 L11 11 Z';
    var _APRON_PATH       = 'M14 5 L28 5 L30 11 L33 14 L33 45 L9 45 L9 14 L12 11 Z';

    // Helper — assemble the inline SVG for a preset card from its
    // silhouette family + a print-area rectangle. Keeping the rect
    // hardcoded per preset is intentional: tuned positions read better
    // than computing-from-cx/cy because the silhouette paths aren't
    // perfectly rectangular.
    function _presetSvg(silhouette, rect) {
      if (!silhouette || !rect) return '';
      var paths = {
        'shirt-front': _SHIRT_FRONT_PATH,
        'shirt-back':  _SHIRT_BACK_PATH,
        'hoodie':      _HOODIE_PATH,
        'cap':         _CAP_PATH,
        'bag':         _BAG_PATH,
        'pants':       _PANTS_PATH,
        'apron':       _APRON_PATH
      };
      var p = paths[silhouette];
      if (!p) return '';
      return '<svg class="preset-shirt" viewBox="0 0 42 50" fill="none" stroke="#bbb" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
             '<path d="' + p + '"/>' +
             '<rect x="' + rect.x + '" y="' + rect.y + '" width="' + rect.w + '" height="' + rect.h + '" fill="#1a1a1a" stroke="#1a1a1a" stroke-dasharray="1.5,1.5" opacity=".75"/>' +
             '</svg>';
    }

    var placementPresets = {
      // Shirt-like presets (used by tshirt, hoodie, polo, longsleeve, etc.)
      'left-chest':   { loc: 'front',        size: 'left-chest',  cx: 0.38, cy: 0.32, label: 'Left Chest',        desc: '~3-4" — logo / pocket', sil:'shirt-front', rect:{x:11,y:14,w:6, h:5}  },
      'center-chest': { loc: 'front',        size: 'medium',      cx: 0.50, cy: 0.40, label: 'Center Chest',      desc: '~7" mid-chest',         sil:'shirt-front', rect:{x:14,y:17,w:14,h:10} },
      'full-front':   { loc: 'front',        size: 'large',       cx: 0.50, cy: 0.50, label: 'Full Front',        desc: '~11" chest panel',      sil:'shirt-front', rect:{x:11,y:14,w:20,h:18} },
      'oversized':    { loc: 'front',        size: 'xl',          cx: 0.50, cy: 0.58, label: 'Oversized Front',   desc: '~14" chest to waist',   sil:'shirt-front', rect:{x:9, y:12,w:24,h:28} },
      'back-top':     { loc: 'back',         size: 'small',       cx: 0.50, cy: 0.22, label: 'Top Back',          desc: 'Under collar, ~5"',     sil:'shirt-back',  rect:{x:15,y:10,w:12,h:5}  },
      'back-across':  { loc: 'back',         size: 'large',       cx: 0.50, cy: 0.42, label: 'Across Back',       desc: '~12" upper back',       sil:'shirt-back',  rect:{x:11,y:15,w:20,h:16} },
      'back-full':    { loc: 'back',         size: 'xl',          cx: 0.50, cy: 0.55, label: 'Full Back',         desc: '~14" full panel',       sil:'shirt-back',  rect:{x:9, y:12,w:24,h:28} },
      'left-sleeve':  { loc: 'left-sleeve',  size: 'left-chest',  cx: 0.22, cy: 0.32, label: 'Left Sleeve',       desc: 'Bicep, small hit',      sil:'shirt-front', rect:{x:3, y:13,w:4, h:5}  },
      'right-sleeve': { loc: 'right-sleeve', size: 'right-chest', cx: 0.78, cy: 0.32, label: 'Right Sleeve',      desc: 'Bicep, small hit',      sil:'shirt-front', rect:{x:35,y:13,w:4, h:5}  },
      // Hoodie-specific
      'hood':         { loc: 'front',        size: 'small',       cx: 0.50, cy: 0.12, label: 'Hood',              desc: 'On the hood itself',    sil:'hoodie',      rect:{x:17,y:1, w:8, h:4}  },
      // Cap / hat-specific
      'cap-front':       { loc: 'front', size: 'medium',      cx: 0.50, cy: 0.45, label: 'Cap Front',        desc: 'Front panel, ~3"',     sil:'cap', rect:{x:16,y:18,w:10,h:7} },
      'cap-left-side':   { loc: 'front', size: 'left-chest',  cx: 0.20, cy: 0.45, label: 'Left Side Panel',  desc: 'Side hit, ~2"',        sil:'cap', rect:{x:6, y:22,w:6, h:5} },
      'cap-right-side':  { loc: 'front', size: 'right-chest', cx: 0.80, cy: 0.45, label: 'Right Side Panel', desc: 'Side hit, ~2"',        sil:'cap', rect:{x:30,y:22,w:6, h:5} },
      'cap-back':        { loc: 'back',  size: 'small',       cx: 0.50, cy: 0.45, label: 'Back Panel',       desc: 'Behind closure',       sil:'cap', rect:{x:18,y:25,w:6, h:4} },
      'cap-brim':        { loc: 'front', size: 'small',       cx: 0.50, cy: 0.85, label: 'Brim',             desc: 'Underside / top edge', sil:'cap', rect:{x:16,y:29,w:10,h:3} },
      // Bag / tote-specific
      'bag-front':       { loc: 'front', size: 'medium',      cx: 0.50, cy: 0.45, label: 'Front of Bag',  desc: 'Main panel print',     sil:'bag', rect:{x:13,y:22,w:16,h:14} },
      'bag-back':        { loc: 'back',  size: 'medium',      cx: 0.50, cy: 0.45, label: 'Back of Bag',   desc: 'Reverse panel',        sil:'bag', rect:{x:13,y:22,w:16,h:14} },
      'bag-pocket':      { loc: 'front', size: 'small',       cx: 0.50, cy: 0.65, label: 'Front Pocket',  desc: 'Small logo, ~3"',      sil:'bag', rect:{x:17,y:35,w:8, h:6}  },
      // Pants / shorts / joggers
      'leg-left-hip':    { loc: 'front', size: 'small',       cx: 0.35, cy: 0.20, label: 'Left Hip',      desc: 'Small logo at hip',    sil:'pants', rect:{x:13,y:9, w:6, h:4} },
      'leg-right-hip':   { loc: 'front', size: 'small',       cx: 0.65, cy: 0.20, label: 'Right Hip',     desc: 'Small logo at hip',    sil:'pants', rect:{x:23,y:9, w:6, h:4} },
      'leg-back-pocket': { loc: 'back',  size: 'small',       cx: 0.40, cy: 0.30, label: 'Back Pocket',   desc: 'Back-pocket logo',     sil:'pants', rect:{x:14,y:14,w:6, h:4} },
      'leg-side':        { loc: 'front', size: 'medium',      cx: 0.35, cy: 0.55, label: 'Leg Side',      desc: 'Vertical stripe',      sil:'pants', rect:{x:13,y:18,w:5, h:18} },
      // Apron
      'apron-chest':     { loc: 'front', size: 'medium',      cx: 0.50, cy: 0.20, label: 'Chest',         desc: 'Upper bib area',       sil:'apron', rect:{x:14,y:12,w:14,h:8}  },
      'apron-pocket':    { loc: 'front', size: 'small',       cx: 0.50, cy: 0.55, label: 'Pocket',        desc: 'On the front pocket',  sil:'apron', rect:{x:16,y:28,w:10,h:6}  },
      'apron-full':      { loc: 'front', size: 'large',       cx: 0.50, cy: 0.50, label: 'Full Front',    desc: 'Large front panel',    sil:'apron', rect:{x:12,y:16,w:18,h:22} }
    };

    // --------------------------------------------------------------
    // Per-garment placement groups — drives the cart-row picker so a
    // customer ordering caps doesn't see "Sleeves" and a customer
    // ordering totes doesn't see "Back Top". Falls back to the shirt
    // groups for any garment_type we haven't explicitly mapped.
    // --------------------------------------------------------------
    var PLACEMENT_GROUPS_BY_GARMENT = {
      // ---- Shirt-like (the default) ----
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
        // No oversized — polos are usually corporate
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
        // Reflective hi-vis — front + back only, no sleeve printing (interferes with safety strips)
        { label: 'Front',   ids: ['left-chest', 'center-chest'] },
        { label: 'Back',    ids: ['back-across', 'back-full'] }
      ],

      // ---- Hoodies / Sweatshirts / Outerwear ----
      hoodie: [
        // No "Oversized Front" because the front pouch + zipper break that print
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
        { label: 'Front',   ids: ['left-chest'] },  // chest only — cardigan opens down the middle
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
        // No sleeves
        { label: 'Front', ids: ['left-chest', 'center-chest', 'full-front'] },
        { label: 'Back',  ids: ['back-top', 'back-across', 'back-full'] }
      ],
      coverall: [
        { label: 'Front',   ids: ['left-chest', 'center-chest', 'full-front'] },
        { label: 'Back',    ids: ['back-top', 'back-across', 'back-full'] },
        { label: 'Sleeves', ids: ['left-sleeve', 'right-sleeve'] },
        { label: 'Leg',     ids: ['leg-left-hip', 'leg-right-hip'] }
      ],

      // ---- Hats / caps — totally different placement geography ----
      hat: [
        { label: 'Cap', ids: ['cap-front', 'cap-left-side', 'cap-right-side', 'cap-back', 'cap-brim'] }
      ],

      // ---- Bags / totes ----
      tote: [
        { label: 'Bag', ids: ['bag-front', 'bag-back', 'bag-pocket'] }
      ],

      // ---- Bottoms ----
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

      // ---- Medical / hospitality ----
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

      // ---- Aprons ----
      apron: [
        { label: 'Apron', ids: ['apron-chest', 'apron-full', 'apron-pocket'] }
      ]
    };

    function placementGroupsFor(garmentType) {
      return PLACEMENT_GROUPS_BY_GARMENT[garmentType] || PLACEMENT_GROUPS_BY_GARMENT.tshirt;
    }
    // First placement we recommend by default when a customer adds an
    // item to the cart from the catalog. Keeps each garment's "out-of-
    // box" placement plausible (logo on cap front, logo on tee chest).
    function defaultPlacementFor(garmentType) {
      var groups = placementGroupsFor(garmentType);
      if (groups && groups.length && groups[0].ids && groups[0].ids.length) {
        return groups[0].ids[0];
      }
      return 'center-chest';
    }

    // ===================================================================
    // GLOBAL PLACEMENT SECTION — dynamic renderer
    // -------------------------------------------------------------------
    // Rebuilds the `.placement-group` blocks inside #placementGroupsHost
    // based on the currently-selected garment type. Wired into both
    // selectProduct() (when the user picks from the legacy product grid)
    // and DOMContentLoaded (initial paint).
    //
    // When the garment changes, any previously-selected presets that
    // don't exist on the new garment are cleared, and the first preset
    // of the new garment is auto-selected so the form is never in a
    // "no placement" state.
    // ===================================================================
    function _buildPresetCardHtml(presetId, isSelected) {
      var p = placementPresets[presetId];
      if (!p) return '';
      var svg = _presetSvg(p.sil, p.rect);
      var label = p.label || presetId;
      var desc  = p.desc || '';
      return '<div class="preset-card' + (isSelected ? ' selected' : '') +
             '" data-preset="' + presetId + '" onclick="togglePlacementPreset(this)">' +
             '  <span class="preset-check">&#10003;</span>' +
             '  ' + svg +
             '  <span class="preset-label">' + escapeAttr(label) + '</span>' +
             (desc ? '  <span class="preset-desc">' + escapeAttr(desc) + '</span>' : '') +
             '</div>';
    }

    function renderGlobalPlacementGroups(garmentType) {
      var host = document.getElementById('placementGroupsHost');
      if (!host) return;
      var groups = placementGroupsFor(garmentType);

      // Build the new set of valid preset IDs for this garment so we can
      // prune any stale selections from previous garments. Without this
      // pruning, a user who picked Center Chest on tshirt then switched
      // to Hat would have a "phantom" center-chest still active.
      var validIds = {};
      groups.forEach(function(g) { (g.ids || []).forEach(function(id) { validIds[id] = true; }); });

      // Remove invalid locations from presetByLocation, but keep at least
      // one selection so togglePlacementPreset's "never zero" guard
      // doesn't fight the user later.
      var remainingLocs = [];
      Object.keys(presetByLocation).forEach(function(loc) {
        var pid = presetByLocation[loc];
        if (validIds[pid]) remainingLocs.push(loc);
        else delete presetByLocation[loc];
      });
      if (remainingLocs.length === 0) {
        // Auto-pick the first preset of the first group as the new default
        var firstId = groups[0] && groups[0].ids && groups[0].ids[0];
        if (firstId) {
          presetByLocation[placementPresets[firstId].loc] = firstId;
        }
      }

      // Render the groups + their cards.
      var html = '';
      groups.forEach(function(g) {
        html += '<div class="placement-group">';
        html += '  <div class="placement-group-label">' + escapeAttr(g.label) + '</div>';
        html += '  <div class="placement-preset-grid">';
        (g.ids || []).forEach(function(id) {
          var isSel = (presetByLocation[placementPresets[id] && placementPresets[id].loc] === id);
          html += _buildPresetCardHtml(id, isSel);
        });
        html += '  </div>';
        html += '</div>';
      });
      host.innerHTML = html;

      // Sync hidden form fields + summary copy + uploads to the new state.
      var activePresets = Object.values(presetByLocation);
      var presetInput = document.getElementById('placementPresetInput');
      if (presetInput) presetInput.value = activePresets.join(', ');
      var summaryEl = document.getElementById('placementSummary');
      if (summaryEl) {
        var labels = activePresets.map(function(id) {
          return (placementPresets[id] && placementPresets[id].label) || id;
        });
        summaryEl.textContent = labels.length
          ? labels.join(', ') + (labels.length > 1 ? ' — ' + labels.length + ' prints, billed per location.' : ' selected.')
          : 'Pick at least one placement.';
      }
      if (typeof updateLocationSelection === 'function') updateLocationSelection();
      if (typeof renderPlacementUploads === 'function')  renderPlacementUploads();
      if (typeof fetchAndRenderTopTierEstimate === 'function') fetchAndRenderTopTierEstimate();
    }

    // Run once on DOM ready so the initial paint reflects whatever
    // garment was selected (defaults to tshirt). Wait for SinghsCart
    // + state.garment to be initialised.
    document.addEventListener('DOMContentLoaded', function() {
      try { renderGlobalPlacementGroups((typeof state !== 'undefined' && state.garment) || 'tshirt'); } catch(e) {}

      // Pull the live size-surcharge matrix once the page is interactive.
      // Subsequent context changes (product / service / placement)
      // re-fire this via the change handlers further down. Wrapped in
      // try/catch so a network blip on first paint can never break the
      // legacy hardcoded fallback path.
      try { if (typeof spRefreshSizeSurcharges === 'function') spRefreshSizeSurcharges(); } catch(e) {}

      // Promo handoff from the homepage popup. Two layers:
      //   1. URL ?promo=…           — fresh arrival from the popup CTA
      //   2. sessionStorage         — survives catalog round-trips that
      //                               drop the URL param (e.g. visitor
      //                               clicks "Browse catalog" then picks
      //                               an item which redirects them back
      //                               to /quote?product=…&color=…)
      // Same banner is harmless if the visitor never came through the
      // popup — it stays hidden.
      try {
        var urlPromo = new URLSearchParams(window.location.search).get('promo');
        var stashedPromo = null;
        try { stashedPromo = sessionStorage.getItem('sp_promo_slug'); } catch(_) {}
        var promoSlug = urlPromo || stashedPromo;
        if (promoSlug) {
          // Cache for the rest of the session so navigation can't strip it.
          try { sessionStorage.setItem('sp_promo_slug', promoSlug); } catch(_) {}
          var banner = document.getElementById('promoApplied');
          if (banner) banner.style.display = 'flex';
          // Stamp the lead so the sales rep sees which offer drove this quote.
          var form = document.getElementById('quoteForm');
          if (form && !form.querySelector('input[name="promo_slug"]')) {
            var inp = document.createElement('input');
            inp.type = 'hidden'; inp.name = 'promo_slug'; inp.value = promoSlug;
            form.appendChild(inp);
          }
          // Track conversion of the popup → quote handoff (only fires
          // once per session per slug to keep analytics clean).
          if (typeof window.spTrack === 'function' && !sessionStorage.getItem('sp_promo_tracked_' + promoSlug)) {
            window.spTrack('promo_handoff', { promo_slug: promoSlug, via: urlPromo ? 'url' : 'session' });
            try { sessionStorage.setItem('sp_promo_tracked_' + promoSlug, '1'); } catch(_) {}
          }
        }
      } catch (e) { /* never block the quote builder for a banner */ }

      // Prefill name + email from the popup capture so the customer
      // doesn't have to retype what they just gave us.
      try {
        var leadName  = sessionStorage.getItem('sp_lead_name');
        var leadEmail = sessionStorage.getItem('sp_lead_email');
        var nameInp   = document.querySelector('input[name="name"]');
        var emailInp  = document.querySelector('input[name="email"]');
        if (leadName  && nameInp  && !nameInp.value)  nameInp.value  = leadName;
        if (leadEmail && emailInp && !emailInp.value) emailInp.value = leadEmail;
      } catch (_) {}
    });
    var presetSizeByLocation = { front: 'medium', back: 'large', 'left-sleeve': 'left-chest', 'right-sleeve': 'right-chest' };
    var presetByLocation = { front: 'center-chest' }; // default state

    // Programmatic version of toggleLocCheck — no event required.
    function setLocationChecked(loc, checked) {
      var el = document.querySelector('.loc-check[data-loc="' + loc + '"]');
      if (!el) return false;
      var wasChecked = el.classList.contains('checked');
      var allChecked = document.querySelectorAll('.loc-check.checked');
      if (!checked && wasChecked && allChecked.length <= 1) return false; // never zero out
      if (checked && !wasChecked) {
        el.classList.add('checked');
        el.querySelector('input').checked = true;
      } else if (!checked && wasChecked) {
        el.classList.remove('checked');
        el.querySelector('input').checked = false;
      }
      return true;
    }

    function togglePlacementPreset(card) {
      var presetId = card.getAttribute('data-preset');
      var preset = placementPresets[presetId];
      if (!preset) return;
      var loc = preset.loc;

      var alreadySelected = card.classList.contains('selected');
      var locActive = (presetByLocation[loc] === presetId);

      if (locActive) {
        // Clicking the active preset for this location: deselect this location entirely
        // (only if at least one other location is selected — never zero out).
        var otherLocations = Object.keys(presetByLocation).filter(function(k) { return k !== loc; });
        if (otherLocations.length === 0) return; // last one — don't allow
        delete presetByLocation[loc];
        card.classList.remove('selected');
        setLocationChecked(loc, false);
      } else {
        // Pick this preset for its location (replaces any other preset in same location).
        presetByLocation[loc] = presetId;
        // Visually deselect siblings in the same group
        Object.keys(placementPresets).forEach(function(id) {
          if (placementPresets[id].loc === loc) {
            var c = document.querySelector('.preset-card[data-preset="' + id + '"]');
            if (c) c.classList.toggle('selected', id === presetId);
          }
        });
        setLocationChecked(loc, true);
      }

      // Set print area for the just-clicked location (drives canvas)
      presetSizeByLocation[loc] = preset.size;
      currentPrintArea = preset.size;
      currentPresetId   = presetId;    // → getPrintAreaRect() uses preset.cx/cy

      // Switch canvas view to this location & re-render
      var tab = document.querySelector('.loc-tab[data-loc="' + loc + '"]');
      if (tab && typeof switchLocationView === 'function') switchLocationView(tab);

      // Push the preset id + size into hidden inputs for the CRM payload
      var activePresets = Object.values(presetByLocation);
      var presetInput = document.getElementById('placementPresetInput');
      if (presetInput) presetInput.value = activePresets.join(', ');

      // Drive the existing UI updates (loc-check changed → re-sync everything)
      if (typeof updateLocationSelection === 'function') updateLocationSelection();

      // Refresh the placement summary copy
      var summaryEl = document.getElementById('placementSummary');
      if (summaryEl) {
        var labels = activePresets.map(function(id) { return placementPresets[id].label; });
        summaryEl.textContent = labels.length
          ? labels.join(', ') + (labels.length > 1 ? ' — ' + labels.length + ' prints, billed per location.' : ' selected.')
          : 'Pick at least one placement.';
      }

      // Rebuild per-placement upload list so customer can attach a separate
      // design to each spot (or the same one — they choose).
      renderPlacementUploads();

      // Refresh live-price strip with the new sides count.
      fetchAndRenderTopTierEstimate();

      // If BYO is active, refresh the decoration-only price (sides change
      // affects it materially).
      refreshByoPrice();
    }

    // -----------------------------------------------------------------
    // Per-placement upload list. One row per currently-selected placement,
    // each with its own hidden file input named design_<presetId>. The form
    // submission picks up every file input by name so the CRM receives the
    // right artwork tagged to the right placement.
    // Saves attached files in a local map so re-renders (e.g. when a new
    // placement is selected) don't drop already-uploaded files.
    // -----------------------------------------------------------------
    var placementFiles = {};   // presetId → File

    function renderPlacementUploads() {
      var host = document.getElementById('placementUploadList');
      if (!host) return;
      var activePresets = Object.values(presetByLocation);

      if (activePresets.length === 0) {
        host.innerHTML = '<div class="placement-upload-list__hint">Pick at least one placement above to upload artwork.</div>';
        return;
      }

      host.innerHTML = activePresets.map(function(presetId) {
        var p = placementPresets[presetId];
        if (!p) return '';
        var f = placementFiles[presetId];
        var has = !!f;
        var fileLabel = has ? (f.name + ' (' + Math.round(f.size / 1024) + ' KB)') : 'PNG, JPG, PDF, AI, PSD, SVG — up to 10MB';
        return '' +
          '<label class="placement-upload ' + (has ? 'has-file' : '') + '" for="design_' + presetId + '">' +
          '  <div class="placement-upload__icon">' + (has ? '✓' : '⇧') + '</div>' +
          '  <div class="placement-upload__copy">' +
          '    <strong>' + (has ? 'Design for ' : 'Upload design for ') + p.label + '</strong>' +
          '    <span>' + escapeAttr(fileLabel) + '</span>' +
          '  </div>' +
          (has ? '<button type="button" class="placement-upload__remove" onclick="event.preventDefault(); event.stopPropagation(); clearPlacementFile(\'' + presetId + '\')">Remove</button>' : '') +
          '  <input type="file" id="design_' + presetId + '" name="design_' + presetId + '"' +
          '    accept=".png,.jpg,.jpeg,.pdf,.ai,.psd,.svg" style="display:none"' +
          '    onchange="attachPlacementFile(\'' + presetId + '\', this.files && this.files[0])"/>' +
          '</label>';
      }).join('');
    }

    function attachPlacementFile(presetId, file) {
      if (!file) return;
      placementFiles[presetId] = file;
      renderPlacementUploads();
    }

    function clearPlacementFile(presetId) {
      delete placementFiles[presetId];
      var input = document.getElementById('design_' + presetId);
      if (input) input.value = '';
      renderPlacementUploads();
    }

    function toggleLocCheck(el) {
      // Prevent default label click from double-firing
      event.preventDefault();

      var loc = el.getAttribute('data-loc');
      var isChecked = el.classList.contains('checked');
      var allChecked = document.querySelectorAll('.loc-check.checked');

      // Don't allow unchecking the last one
      if (isChecked && allChecked.length <= 1) return;

      if (isChecked) {
        el.classList.remove('checked');
        el.querySelector('input').checked = false;
      } else {
        el.classList.add('checked');
        el.querySelector('input').checked = true;
      }

      updateLocationSelection();
    }

    function updateLocationSelection() {
      var checked = document.querySelectorAll('.loc-check.checked');
      printCount = checked.length;

      // Build names + locs arrays
      var names = [];
      var locs = [];
      checked.forEach(function(el) {
        var loc = el.getAttribute('data-loc');
        locs.push(loc);
        names.push(nameMap[loc] || loc);
      });

      // Update hidden inputs
      document.getElementById('placementInput').value = locs.join(', ');
      document.getElementById('printCountInput').value = printCount;

      // Update badge
      var badge = document.getElementById('locCountBadge');
      if (badge) badge.textContent = printCount + ' location' + (printCount > 1 ? 's' : '');

      // Update summary text
      var summaryEl = document.getElementById('placementSummary');
      if (summaryEl) summaryEl.textContent = names.join(', ');

      // Update mockup summary
      document.getElementById('sumPlacement').textContent = names.join(', ');

      // Update view tabs — show only selected locations
      document.querySelectorAll('.loc-tab').forEach(function(tab) {
        var tabLoc = tab.getAttribute('data-loc');
        if (locs.indexOf(tabLoc) >= 0) {
          tab.classList.add('visible');
        } else {
          tab.classList.remove('visible', 'active');
        }
      });

      // If current view is no longer selected, switch to first selected
      if (locs.indexOf(currentLocation) < 0) {
        var firstTab = document.querySelector('.loc-tab.visible');
        if (firstTab) switchLocationView(firstTab);
      }

      calculatePrice();
      // Placement set changed → the matrix's per-placement overrides
      // may add or remove surcharge on some sizes, so refresh.
      try { if (typeof spRefreshSizeSurcharges === 'function') spRefreshSizeSurcharges(); } catch(e) {}
    }

    // ===== VIEW TABS (on mockup) — switch which location is being edited =====
    function switchLocationView(tab) {
      var loc = tab.getAttribute('data-loc');
      currentLocation = loc;

      // Highlight active tab
      document.querySelectorAll('.loc-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');

      // Whichever preset is active for this location drives the box position
      // and size now — so flipping to Back actually moves things to the back.
      var presetForLoc = presetByLocation[loc];
      if (presetForLoc) {
        currentPresetId = presetForLoc;
        currentPrintArea = placementPresets[presetForLoc].size;
      }

      // Redraw print area at this location
      drawPrintAreaBoundary();
      if (designObject) {
        fitDesignToPrintArea(designObject);
        canvas.renderAll();
      }
    }

    function initFabricCanvas() {
      if (typeof fabric === 'undefined') {
        setTimeout(initFabricCanvas, 200);
        return;
      }

      var wrapper = document.getElementById('canvasWrapper');
      if (!wrapper) return;
      var canvasEl = document.getElementById('fabricCanvas');
      if (!canvasEl) return;

      var width = wrapper.offsetWidth || 400;
      var height = wrapper.offsetHeight || Math.round(width * 1.33);

      canvas = new fabric.Canvas('fabricCanvas', {
        width: width,
        height: height,
        backgroundColor: 'transparent',
        selection: false,
        preserveObjectStacking: true
      });

      drawPrintAreaBoundary();

      // Constrain design movement
      canvas.on('object:moving', function(e) { constrainToPrintArea(e.target); });
      canvas.on('object:scaling', function(e) { constrainScaleToPrintArea(e.target); });
      canvas.on('object:modified', function(e) { constrainToPrintArea(e.target); });
    }

    function constrainToPrintArea(obj) {
      if (!obj || obj === printAreaBox) return;
      var pa = getPrintAreaRect();
      if (!pa) return;
      // Keep center within the print area bounds
      var halfW = pa.w * 0.5;
      var halfH = pa.h * 0.5;
      if (obj.left < pa.cx - halfW) obj.left = pa.cx - halfW;
      if (obj.left > pa.cx + halfW) obj.left = pa.cx + halfW;
      if (obj.top < pa.cy - halfH) obj.top = pa.cy - halfH;
      if (obj.top > pa.cy + halfH) obj.top = pa.cy + halfH;
      obj.setCoords();
    }

    function constrainScaleToPrintArea(obj) {
      if (!obj || obj === printAreaBox) return;
      var pa = getPrintAreaRect();
      if (!pa) return;
      if (obj.width * obj.scaleX > pa.w) obj.scaleX = pa.w / obj.width;
      if (obj.height * obj.scaleY > pa.h) obj.scaleY = pa.h / obj.height;
      obj.setCoords();
    }

    function drawPrintAreaBoundary() {
      if (!canvas) return;
      if (printAreaBox) canvas.remove(printAreaBox);

      var pa = getPrintAreaRect();
      if (!pa) return;

      printAreaBox = new fabric.Rect({
        left: pa.cx,
        top: pa.cy,
        width: pa.w,
        height: pa.h,
        originX: 'center',
        originY: 'center',
        fill: 'rgba(255,255,255,0.05)',
        stroke: 'rgba(0,0,0,0.15)',
        strokeDashArray: [6, 4],
        strokeWidth: 1.5,
        selectable: false,
        evented: false,
        rx: 4, ry: 4
      });

      canvas.add(printAreaBox);
      canvas.sendToBack(printAreaBox);

      // Reapply clip on existing design
      if (designObject) applyClipToDesign(designObject);
      canvas.renderAll();
    }

    function applyClipToDesign(obj) {
      var pa = getPrintAreaRect();
      if (!pa || !obj) return;
      obj.clipPath = new fabric.Rect({
        left: pa.left,
        top: pa.top,
        width: pa.w,
        height: pa.h,
        absolutePositioned: true
      });
    }

    function setPrintAreaSize(size) {
      if (!printAreaSizes[size]) return;
      currentPrintArea = size;
      document.querySelectorAll('.print-area-btn').forEach(function(b) { b.classList.remove('active'); });
      var btn = document.querySelector('.print-area-btn[data-size="' + size + '"]');
      if (btn) btn.classList.add('active');
      drawPrintAreaBoundary();
      if (designObject) {
        fitDesignToPrintArea(designObject);
        canvas.renderAll();
      }
    }

    function fitDesignToPrintArea(obj) {
      var pa = getPrintAreaRect();
      if (!pa || !obj) return;
      var scaleW = (pa.w * 0.85) / obj.width;
      var scaleH = (pa.h * 0.85) / obj.height;
      var fitScale = Math.min(scaleW, scaleH, 2);
      obj.scale(Math.max(0.02, fitScale));
      obj.left = pa.cx;
      obj.top = pa.cy;
      obj.originX = 'center';
      obj.originY = 'center';
      obj.setCoords();
      applyClipToDesign(obj);
    }

    function updateDesignPosition() {
      if (!designObject || !canvas) return;
      if (state.view === 'back' && state.placement !== 'back') {
        designObject.opacity = 0.15;
      } else if (state.view === 'front' && state.placement === 'back') {
        designObject.opacity = 0.15;
      } else {
        designObject.opacity = 1;
      }
      canvas.renderAll();
    }

    // ===== FILE UPLOAD (legacy canvas-mockup feeder) =====
    // The per-placement upload list in Step 1 has replaced this path
    // since Phase A landed. The #designFile / #dropZone elements were
    // removed from the HTML on 2026-05-24; the listeners below are
    // kept (null-guarded) for any future re-introduction of a canvas
    // preview, and so this script block doesn't throw on null.
    (function () {
      var designFileEl = document.getElementById('designFile');
      if (designFileEl) {
        designFileEl.addEventListener('change', function(e) {
          handleFile(e.target.files[0]);
        });
      }
      var dropZone = document.getElementById('dropZone');
      if (dropZone) {
        dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.style.borderColor = '#1a1a1a'; });
        dropZone.addEventListener('dragleave', function() { dropZone.style.borderColor = '#ddd'; });
        dropZone.addEventListener('drop', function(e) {
          e.preventDefault();
          dropZone.style.borderColor = '#ddd';
          if (e.dataTransfer.files.length) {
            if (designFileEl) designFileEl.files = e.dataTransfer.files;
            handleFile(e.dataTransfer.files[0]);
          }
        });
      }
    })();

    function handleFile(file) {
      if (!file) return;
      var fileNameEl = document.getElementById('fileName');
      if (fileNameEl) fileNameEl.textContent = file.name;
      // Reflect the upload in the in-section placement upload card too
      var pu      = document.getElementById('placementUpload');
      var puTitle = document.getElementById('placementUploadTitle');
      var puHint  = document.getElementById('placementUploadHint');
      if (pu)      pu.classList.add('has-file');
      if (puTitle) puTitle.textContent = 'Design ready: ' + file.name;
      if (puHint)  puHint.textContent  = 'Tap to replace with a different file';
      if (file.type.startsWith('image/')) {
        var reader = new FileReader();
        reader.onload = function(e) {
          addDesignToCanvas(e.target.result);
          state.designSrc = e.target.result;
          document.getElementById('downloadMockup').style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        alert((typeof SP_LANG !== 'undefined' && SP_LANG.t('quote.alert.upload.imageonly')) || 'Please upload an image file (PNG, JPG, SVG)');
      }
    }

    function addDesignToCanvas(imgSrc) {
      if (!canvas) {
        setTimeout(function() { addDesignToCanvas(imgSrc); }, 300);
        return;
      }

      fabric.Image.fromURL(imgSrc, function(img) {
        if (!img || !img.width) {
          alert((typeof SP_LANG !== 'undefined' && SP_LANG.t('quote.alert.upload.failed')) || 'Could not load your image. Try a different file.');
          return;
        }

        if (designObject) canvas.remove(designObject);

        // Scale to fit within print area
        fitDesignToPrintArea(img);

        img.set({
          // Lock movement / scaling / rotation — customers pick a preset placement,
          // they don't manually position the design.
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true,
          hoverCursor: 'default'
        });

        canvas.add(img);
        designObject = img;
        canvas.renderAll();

        document.getElementById('downloadMockup').style.display = 'block';
        toggleDesignToolbar(true);
      }, { crossOrigin: 'anonymous' });
    }

    // Show/hide the whole side-panel toolbar (Center / Flip / Remove + Print
     // size) based on whether a design is on the canvas. Upload no longer
     // lives here — it's now inside the placement section in Step 1.
    function toggleDesignToolbar(visible) {
      var bar = document.getElementById('canvasToolbar');
      if (bar) bar.style.display = visible ? '' : 'none';
    }

    document.getElementById('centerBtn').addEventListener('click', function() {
      if (!designObject || !canvas) return;
      var pa = getPrintAreaRect();
      designObject.left = pa ? pa.cx : canvas.width / 2;
      designObject.top = pa ? pa.cy : canvas.height / 2;
      designObject.setCoords();
      canvas.renderAll();
    });

    document.getElementById('deleteBtn').addEventListener('click', function() {
      if (!designObject || !canvas) return;
      canvas.remove(designObject);
      designObject = null;
      state.designSrc = null;
      var dlBtn = document.getElementById('downloadMockup'); if (dlBtn) dlBtn.style.display = 'none';
      var fnEl  = document.getElementById('fileName');       if (fnEl)  fnEl.textContent = '';
      var dfEl  = document.getElementById('designFile');     if (dfEl)  dfEl.value = '';
      // Reset placement-upload card back to its empty-state copy
      var pu      = document.getElementById('placementUpload');
      var puTitle = document.getElementById('placementUploadTitle');
      var puHint  = document.getElementById('placementUploadHint');
      if (pu)      pu.classList.remove('has-file');
      if (puTitle) puTitle.textContent = 'Upload your design for these placements';
      if (puHint)  puHint.textContent  = 'PNG, JPG, PDF, AI, PSD, SVG — up to 10MB';
      toggleDesignToolbar(false);
      canvas.renderAll();
    });

    document.getElementById('flipBtn').addEventListener('click', function() {
      if (!designObject || !canvas) return;
      designObject.flipX = !designObject.flipX;
      canvas.renderAll();
    });

    // ===== DOWNLOAD MOCKUP =====
    function downloadMockup() {
      if (!canvas) return;

      var wrapper = document.getElementById('canvasWrapper');
      var wW = wrapper.offsetWidth;
      var wH = wrapper.offsetHeight;

      // Create export canvas that composites garment SVG + design
      var exportCanvas = document.createElement('canvas');
      var scale = 2; // 2x resolution
      exportCanvas.width = wW * scale;
      exportCanvas.height = wH * scale;
      var ctx = exportCanvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.fillStyle = '#f0efec';
      ctx.fillRect(0, 0, wW, wH);

      // Render garment SVG to canvas
      var svgEl = document.getElementById('garmentSvg');
      var svgData = new XMLSerializer().serializeToString(svgEl);
      var svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
      var svgUrl = URL.createObjectURL(svgBlob);

      var garmentImg = new Image();
      garmentImg.onload = function() {
        // Draw garment centered like CSS does (75% width, centered)
        var gW = wW * 0.75;
        var gH = gW * (400/300);
        var gX = (wW - gW) / 2;
        var gY = (wH - gH) / 2;
        ctx.drawImage(garmentImg, gX, gY, gW, gH);
        URL.revokeObjectURL(svgUrl);

        // Draw the Fabric canvas (design) on top — without print area and selection handles
        if (printAreaBox) printAreaBox.visible = false;
        canvas.discardActiveObject();
        if (designObject && designObject.clipPath) {
          var savedClip = designObject.clipPath;
          designObject.clipPath = null;
          canvas.renderAll();
          ctx.drawImage(canvas.toCanvasElement(), 0, 0, wW, wH);
          designObject.clipPath = savedClip;
        } else {
          canvas.renderAll();
          ctx.drawImage(canvas.toCanvasElement(), 0, 0, wW, wH);
        }
        if (printAreaBox) printAreaBox.visible = true;
        canvas.renderAll();

        // Watermark
        ctx.font = '13px Inter, sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.textAlign = 'center';
        ctx.fillText('singhsprint.com', wW/2, wH - 16);

        var link = document.createElement('a');
        link.download = 'singhsprint-mockup.png';
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
      };
      garmentImg.src = svgUrl;
    }

    // ===== SIZE TOTAL =====
    function updateSizeTotal() {
      var inputs = document.querySelectorAll('.size-grid input');
      var total = 0;
      inputs.forEach(function(inp) { total += parseInt(inp.value) || 0; });
      document.getElementById('sizeTotal').textContent = total;
      document.getElementById('sumQty').textContent = total;
      document.getElementById('totalQtyInput').value = total;

      // Recompute the right owner for the live-price strip:
      //   cart mode  → updateCartTotal() (sums cart items + XXL surcharge)
      //   single     → calculatePrice() (legacy single-product path)
      // Without this branching, the legacy path clobbers the strip in cart
      // mode the moment any size input changes — because calculatePrice
      // calls updateLivePriceStrip() which hides the strip when there's
      // no catalogPick. The "Recalculate price when quantities change"
      // intent stays — we just route through the right path.
      var cartHasItems = (typeof SinghsCart !== 'undefined' && SinghsCart.count() > 0);
      if (cartHasItems) {
        updateCartTotal();
      } else {
        calculatePrice();
      }
      // Size grid changed → shipping weight + order subtotal both shift,
      // so refresh the rate cards + the "Add $X more for FREE shipping"
      // delta. Debounced inside the helper so rapid keystrokes coalesce.
      if (typeof spRecalcShippingIfStale === 'function') spRecalcShippingIfStale();
    }

    // ===== STEP NAVIGATION =====
    function goToStep(step) {
      var current = document.querySelector('.form-section.active');
      var currentNum = parseInt(current.dataset.step);
      var cartHasItems = (typeof SinghsCart !== 'undefined' && SinghsCart.count() > 0);

      // 2026-05-24 — Cart mode collapses to 2 visible steps: Step 1
      // (Product & Design) and Step 3 (Your Details). Step 2's global
      // sizes + method question is redundant once each cart row carries
      // its own per-item sizes + method. Auto-route around Step 2:
      //   • Continue from Step 1 (which targets step 2) → skip to step 3
      //   • Back from Step 3 (which targets step 2)     → skip to step 1
      // Legacy single-product flow keeps all 3 steps.
      if (cartHasItems && step === 2) {
        step = (currentNum === 1) ? 3 : 1;
      }

      if (step > currentNum) {
        if (currentNum === 1) {
          // Cart mode: valid if there's at least one item in the cart.
          // Legacy single-product mode: require state.product + service.
          if (!cartHasItems && !state.product) { alert((typeof SP_LANG !== 'undefined' && SP_LANG.t('quote.alert.product')) || 'Please select a product from the catalog.'); return; }
          // Method requirement only applies in legacy mode — cart items
          // carry per-row decoration_type (defaulting to empty/'not-sure'
          // is fine; the rep recommends the right one at quote-reply).
          if (!cartHasItems && !state.service) { alert((typeof SP_LANG !== 'undefined' && SP_LANG.t('quote.alert.method')) || 'Please select a printing method.'); return; }
        }
      }

      // Funnel event — the most important measurement we have. Tracking
      // step advancement lets us see exactly where customers drop off.
      if (window.spTrack && step !== currentNum) {
        window.spTrack('quote_step_advance', {
          from_step: currentNum,
          to_step: step,
          direction: step > currentNum ? 'forward' : 'back',
          service: state.service || null,
          has_cart: (typeof SinghsCart !== 'undefined' && SinghsCart.count() > 0)
        });
      }

      document.querySelectorAll('.form-section').forEach(function(s) { s.classList.remove('active'); });
      document.querySelector('.form-section[data-step="'+step+'"]').classList.add('active');

      document.querySelectorAll('.step-pill').forEach(function(p) {
        var s = parseInt(p.dataset.step);
        p.classList.remove('active','done');
        if (s === step) p.classList.add('active');
        else if (s < step) p.classList.add('done');
      });
      // Light up the corresponding label
      document.querySelectorAll('[data-step-label]').forEach(function(el) {
        var s = parseInt(el.getAttribute('data-step-label'));
        el.style.color = (s === step) ? '#1a1a1a' : (s < step ? '#1a1a1a' : '#888');
      });

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ===== SUPABASE CRM INTEGRATION =====
    var SUPABASE_URL = 'https://ptrqsjexrbyupexhcjdr.supabase.co';
    var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cnFzamV4cmJ5dXBleGhjamRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODg5NzgsImV4cCI6MjA5MTc2NDk3OH0.aqYJAXmmCEjtHU97UDTLZZlWwoS9ERldFzxTvunZEgA';

    function pushLeadToCRM(data) {
      fetch(SUPABASE_URL + '/rest/v1/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(data)
      }).catch(function() { /* silent fail — email still sent */ });
    }

    // ===== UTM CAPTURE — read URL params, persist in sessionStorage, inject as hidden form fields =====
    (function captureUTMs() {
      var keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid'];
      var params = new URLSearchParams(window.location.search);
      var form = document.getElementById('quoteForm');
      keys.forEach(function(key) {
        var val = params.get(key);
        if (val) {
          try { sessionStorage.setItem('sp_' + key, val); } catch(e){}
        } else {
          try { val = sessionStorage.getItem('sp_' + key); } catch(e){}
        }
        if (val && form && !form.querySelector('input[name="' + key + '"]')) {
          var input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = val;
          form.appendChild(input);
        }
      });
    })();

    // ===== ACCOUNT INTEGRATION =====
    // Auth-aware enhancements layered on top of the anonymous quote flow.
    // Two paths:
    //   1. SIGNED IN — pre-fill name/email/phone/company from the user's
    //      customer record, show a "signed in as X" pill, hide the signup
    //      opt-in. The lead still posts via the anon-key POST below; the
    //      customer record is what links it to the user once the CRM
    //      converts the lead to an order.
    //   2. ANONYMOUS — show a "create an account" checkbox under the
    //      contact fields. If checked at submit, fire an OTP email after
    //      the lead is saved so the user can claim the quote later via
    //      the handle_new_user trigger that auto-links the customer by
    //      email match.
    (function quoteAccountAware() {
      function loadSupabase(cb) {
        if (window.supabase && window.supabase.createClient) return cb();
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        s.onload = cb;
        s.onerror = function(){ /* fail silently — anonymous flow still works */ };
        document.head.appendChild(s);
      }

      loadSupabase(function() {
        var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sp.session.v1' }
        });
        window.SP_QUOTE_AUTH = client;

        client.auth.getSession().then(function(res) {
          var session = res && res.data && res.data.session;
          window.SP_QUOTE_SESSION = session || null;
          if (session) showSignedInUI(session.user, session.access_token);
          else         showAnonymousUI();
        });
      });

      function showSignedInUI(user, accessToken) {
        var pill = document.getElementById('sp-quote-account-pill');
        if (pill) {
          pill.style.display = 'flex';
          var emailEl = document.getElementById('sp-quote-account-email');
          if (emailEl) emailEl.textContent = user.email || user.phone || '(account)';
        }
        var signup = document.getElementById('sp-quote-signup-block');
        if (signup) signup.style.display = 'none';

        var signoutLink = document.getElementById('sp-quote-account-signout');
        if (signoutLink) {
          signoutLink.onclick = function(e) {
            e.preventDefault();
            if (!confirm('Sign out of this account?')) return;
            window.SP_QUOTE_AUTH.auth.signOut().then(function() { location.reload(); });
          };
        }
        prefillFromCustomer(user, accessToken);
      }

      function showAnonymousUI() {
        var signup = document.getElementById('sp-quote-signup-block');
        if (signup) signup.style.display = '';
      }

      function setInputIfEmpty(id, val) {
        var el = document.getElementById(id);
        if (el && !el.value && val) el.value = val;
      }

      function prefillFromCustomer(user, accessToken) {
        // First-pass prefill from the auth user itself — covers brand-new
        // accounts that don't have a customer row yet.
        if (user.email) setInputIfEmpty('email', user.email);
        if (user.phone) setInputIfEmpty('phone', user.phone);

        // Then enrich from the customers table if a record exists for them.
        // Uses the user's JWT so RLS (if ever enabled) recognises them.
        fetch(SUPABASE_URL + '/rest/v1/customers?user_id=eq.' + encodeURIComponent(user.id)
              + '&select=contact_name,email,phone,company_name&limit=1', {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + (accessToken || SUPABASE_KEY)
          }
        })
        .then(function(r) { return r.ok ? r.json() : []; })
        .then(function(rows) {
          if (!rows || !rows[0]) return;
          var c = rows[0];
          if (c.contact_name) setInputIfEmpty('name',    c.contact_name);
          if (c.email)        setInputIfEmpty('email',   c.email);
          if (c.phone)        setInputIfEmpty('phone',   c.phone);
          if (c.company_name) setInputIfEmpty('company', c.company_name);
        })
        .catch(function() { /* prefill is best-effort */ });
      }

      // Account opt-in: after the regular submit handler runs and the lead
      // is posted, if the checkbox is checked we trigger a passwordless OTP
      // sign-in. The handle_new_user trigger will link any matching customer
      // by email when this user first signs in.
      var form = document.getElementById('quoteForm');
      if (form) {
        form.addEventListener('submit', function() {
          setTimeout(function() {
            var optin = document.getElementById('sp-quote-signup-optin');
            if (!optin || !optin.checked) return;
            var emailEl = document.getElementById('email');
            var email = emailEl && emailEl.value && emailEl.value.trim();
            if (!email || !window.SP_QUOTE_AUTH) return;

            window.SP_QUOTE_AUTH.auth.signInWithOtp({
              email: email,
              options: {
                shouldCreateUser: true,
                emailRedirectTo: 'https://www.singhsprint.com/account/'
              }
            }).then(function() {
              // Surface a confirmation inside the success card so the user
              // knows to check their inbox.
              var success = document.getElementById('formSuccess');
              if (!success) return;
              var note = document.createElement('p');
              note.style.cssText = 'margin-top:14px;padding:12px 14px;background:#e8ff3c;border:1px solid #1a1a1a;border-radius:10px;font-size:.92rem;text-align:left';
              note.innerHTML = '<strong>Check your email</strong> — we just sent a sign-in link to <strong>'
                + email.replace(/[<>&"]/g, function(c){return {"<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;"}[c];})
                + '</strong>. Click it to access your account and track this quote.';
              success.appendChild(note);
            }).catch(function() { /* OTP failure shouldn't break the quote flow */ });
          }, 100);
        });
      }
    })();

    // ===== FORM SUBMIT =====
    document.getElementById('quoteForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var form = this;

      // Use the actual calculated price (not a guess) — fall back to qty*25 if pricing isn't ready
      var totalQty = parseInt(document.getElementById('totalQtyInput').value) || 0;
      var product = document.getElementById('productInput').value || '';
      var service = document.getElementById('serviceInput').value || '';
      var perUnit = (typeof getPricePerUnit === 'function') ? getPricePerUnit() : null;
      var estValue = (perUnit && totalQty) ? Math.round(perUnit * totalQty) : (totalQty * 25);

      // Collect UTM-source breadcrumbs into the CRM notes
      var utmSummary = '';
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid'].forEach(function(k) {
        var inp = form.querySelector('input[name="' + k + '"]');
        if (inp && inp.value) utmSummary += ' [' + k + '=' + inp.value + ']';
      });

      pushLeadToCRM({
        contact_name: document.getElementById('name').value,
        company_name: document.getElementById('company').value || '',
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value || '',
        source: 'website',
        status: 'new',
        estimated_value: estValue,
        notes: 'Quote request: ' + product + ' / ' + service + ' / Qty: ' + totalQty + ' / ' + (document.getElementById('details').value || '') + utmSummary
      });

      // Funnel-tracker submit event — richer than the auto-fired
      // `form_submit` from components.js because we attach the
      // estimated value, qty and product. This is internal funnel
      // analytics and stays on submit-attempt so we can measure the
      // attempt→success ratio.
      if (window.spTrack) window.spTrack('quote_submit', {
        product: product || null,
        service: service || null,
        total_qty: totalQty,
        estimated_value: estValue,
        currency: 'CAD',
        has_company: !!document.getElementById('company').value
      });

      // Stash the conversion payload so showSuccess() can fire the
      // Meta Pixel + Google Ads conversion AFTER the CRM ingest path
      // confirms a real submission. This replaces the previous
      // approach (firing on every submit-attempt) which was double-
      // counting failed/spam/test submissions and giving Meta a
      // garbage signal to optimize against. See slice 78 (May 2026).
      window.__sp_pendingConversion = {
        product: product,
        service: service,
        estValue: estValue,
        totalQty: totalQty
      };

      // Web3Forms submission used to live here. As of slice 77 (May 2026)
      // the Web3Forms POST is owned exclusively by the per-side upload
      // handler further down — it calls form.submit() (native multipart
      // POST to the form's action) only as a fallback when /api/inbound
      // returns non-2xx, errors out, or stalls past the bailout window.
      //
      // We kept this legacy listener for: pushLeadToCRM (Supabase leads
      // table) and spTrack (internal funnel). Those genuinely should
      // fire on every submit attempt. Meta Pixel Lead + Google Ads
      // conversion moved to showSuccess() (slice 78) so they only fire
      // after the CRM confirms a real submission.
      //
      // showSuccess() is no longer called here — the per-side handler
      // calls it on the CRM 2xx path; the Web3Forms fallback in
      // finishAndSubmit() navigates away to Web3Forms's response page
      // (this is the only flow where Web3Forms's "marked as spam"
      // screen could still appear, exactly when we want a fallback
      // signal that the primary path failed).
    });

    function showSuccess() {
      document.getElementById('quoteForm').style.display = 'none';
      document.querySelector('.steps-bar').style.display = 'none';
      document.getElementById('formSuccess').style.display = 'block';

      // Fire conversion pixels ONLY on confirmed success (CRM 2xx).
      // Moved here from the submit-attempt listener (slice 78, May 2026)
      // so failed/spam/test submissions don't pollute the ad-platform
      // optimization signal. Payload was stashed by the submit handler.
      var trk = window.__sp_pendingConversion || {};
      // Clear immediately to defend against accidental re-render double-fires
      window.__sp_pendingConversion = null;

      // Meta Lead — the event the Leads-objective ad sets optimize toward.
      // Fired on BOTH the browser Pixel and the server-side CAPI with a single
      // shared event_id, so Meta de-dupes to exactly ONE Lead (no double-count)
      // while recovering the ~10-20% of browser events lost to ad-blockers/iOS
      // and lifting Event Match Quality via hashed email/phone/name. The CAPI
      // POST is gated on the same consent flag the Pixel respects (sp_consent),
      // so PII never leaves the browser without consent. Mirrors the drops
      // funnel, which already had server-side CAPI; the quote funnel did not.
      try {
        if (typeof fbq === 'function') {
          var leadCustom = {
            content_name: trk.product || 'Quote Request',
            content_category: trk.service || 'Print',
            value: trk.estValue || 0,
            currency: 'CAD',
            num_items: trk.totalQty || 0
          };
          var leadEventId = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : ('lead-' + Date.now() + '-' + Math.random().toString(16).slice(2));

          // 1) Browser Pixel — with eventID so it dedupes against the server event.
          fbq('track', 'Lead', leadCustom, { eventID: leadEventId });

          // 2) Server CAPI — same event_id + hashed identity. Consent-gated.
          try {
            if (localStorage.getItem('sp_consent') === 'granted') {
              var spCookie = function (n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]+)'); return m ? decodeURIComponent(m[1]) : undefined; };
              var leadName = ((document.getElementById('name') || {}).value || '').trim();
              var leadParts = leadName ? leadName.split(/\s+/) : [];
              var leadUserData = {
                em:  ((document.getElementById('email') || {}).value || '').trim() || undefined,
                ph:  ((document.getElementById('phone') || {}).value || '').trim() || undefined,
                fn:  leadParts[0] || undefined,
                ln:  leadParts.length > 1 ? leadParts.slice(1).join(' ') : undefined,
                fbp: spCookie('_fbp'),
                fbc: spCookie('_fbc')
              };
              var leadCapiBody = JSON.stringify({
                event_name:       'Lead',
                event_id:         leadEventId,
                event_time:       Math.floor(Date.now() / 1000),
                event_source_url: location.href,
                action_source:    'website',
                user_data:        leadUserData,
                custom_data:      { value: trk.estValue || 0, currency: 'CAD', num_items: trk.totalQty || 0 }
              });
              if (navigator.sendBeacon) {
                navigator.sendBeacon('/api/meta-capi', new Blob([leadCapiBody], { type: 'application/json' }));
              } else {
                fetch('/api/meta-capi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: leadCapiBody, keepalive: true }).catch(function () {});
              }
            }
          } catch (capiErr) { /* CAPI must never break the success state */ }
        }
      } catch(err) { /* tracking should never break the success state */ }

      // Google Ads conversion + GA4 quote_submit — mirrors the fbq Lead
      // payload so ROAS reports line up between Meta and Google.
      // SP_GTAG.trackConversion handles AW-/label wiring (gtag-config.js)
      // and is a no-op until verification clears.
      try {
        if (window.SP_GTAG && typeof window.SP_GTAG.trackConversion === 'function') {
          window.SP_GTAG.trackConversion('quote_submit', {
            value: trk.estValue || 0,
            currency: 'CAD',
            transaction_id: 'quote-' + Date.now(), // dedupe key for Ads
            product: trk.product || null,
            service: trk.service || null,
            num_items: trk.totalQty || 0
          });
        }
      } catch(err) { /* tracking should never break the success state */ }
    }

    // ===== PRICING CALCULATOR =====
    var pricingMode = 'b2c'; // b2c or b2b

    // B2B pricing — from the actual pricing sheet (Gildan-quality blanks, includes printing)
    // Columns: single (1-color front), multi (multi-color front), fullprint (front+back), wrap (full wrap)
    var b2bPricing = {
      tshirt: {
        dtg: {name: 'T-Shirt', tiers: [
          {min: 5, max: 9, single: 18.95, multi: 22.95, fullprint: 26.95, wrap: 29.95},
          {min: 10, max: 24, single: 16.95, multi: 20.95, fullprint: 23.95, wrap: 26.95},
          {min: 25, max: 49, single: 14.95, multi: 17.95, fullprint: 21.95, wrap: 23.95},
          {min: 50, max: 99, single: 13.95, multi: 16.95, fullprint: 19.95, wrap: 21.95},
          {min: 100, max: 249, single: 11.95, multi: 14.95, fullprint: 17.95, wrap: 18.95},
          {min: 250, max: Infinity, single: 9.95, multi: 12.95, fullprint: 14.95, wrap: 15.95}
        ]},
        dtf: {name: 'T-Shirt', tiers: [
          {min: 5, max: 9, single: 18.95, multi: 22.95, fullprint: 26.95, wrap: 29.95},
          {min: 10, max: 24, single: 16.95, multi: 20.95, fullprint: 23.95, wrap: 26.95},
          {min: 25, max: 49, single: 14.95, multi: 17.95, fullprint: 21.95, wrap: 23.95},
          {min: 50, max: 99, single: 13.95, multi: 16.95, fullprint: 19.95, wrap: 21.95},
          {min: 100, max: 249, single: 11.95, multi: 14.95, fullprint: 17.95, wrap: 18.95},
          {min: 250, max: Infinity, single: 9.95, multi: 12.95, fullprint: 14.95, wrap: 15.95}
        ]}
      },
      hoodie: {
        dtg: {name: 'Hoodie', tiers: [
          {min: 5, max: 9, single: 37.95, multi: 41.95, fullprint: 45.95, wrap: 49.95},
          {min: 10, max: 24, single: 33.95, multi: 37.95, fullprint: 40.95, wrap: 44.95},
          {min: 25, max: 49, single: 29.95, multi: 33.95, fullprint: 36.95, wrap: 39.95},
          {min: 50, max: 99, single: 27.95, multi: 30.95, fullprint: 33.95, wrap: 36.95},
          {min: 100, max: 199, single: 26.95, multi: 28.95, fullprint: 31.95, wrap: 34.95},
          {min: 200, max: Infinity, single: 24.95, multi: 26.95, fullprint: 29.95, wrap: 31.95}
        ]},
        dtf: {name: 'Hoodie', tiers: [
          {min: 5, max: 9, single: 37.95, multi: 41.95, fullprint: 45.95, wrap: 49.95},
          {min: 10, max: 24, single: 33.95, multi: 37.95, fullprint: 40.95, wrap: 44.95},
          {min: 25, max: 49, single: 29.95, multi: 33.95, fullprint: 36.95, wrap: 39.95},
          {min: 50, max: 99, single: 27.95, multi: 30.95, fullprint: 33.95, wrap: 36.95},
          {min: 100, max: 199, single: 26.95, multi: 28.95, fullprint: 31.95, wrap: 34.95},
          {min: 200, max: Infinity, single: 24.95, multi: 26.95, fullprint: 29.95, wrap: 31.95}
        ]}
      },
      hat: {
        embroidery: {name: 'Cap/Hat', maxLocations: 1, tiers: [
          {min: 5, max: 9, single: 32.95, multi: 32.95, fullprint: 32.95, wrap: 32.95},
          {min: 10, max: 24, single: 29.95, multi: 29.95, fullprint: 29.95, wrap: 29.95},
          {min: 25, max: 49, single: 24.95, multi: 24.95, fullprint: 24.95, wrap: 24.95},
          {min: 50, max: 99, single: 21.95, multi: 21.95, fullprint: 21.95, wrap: 21.95},
          {min: 100, max: 199, single: 19.95, multi: 19.95, fullprint: 19.95, wrap: 19.95},
          {min: 200, max: Infinity, single: 15.95, multi: 15.95, fullprint: 15.95, wrap: 15.95}
        ]},
        dtg: {name: 'Cap/Hat', maxLocations: 1, tiers: [
          {min: 5, max: 9, single: 32.95, multi: 32.95, fullprint: 32.95, wrap: 32.95},
          {min: 10, max: 24, single: 29.95, multi: 29.95, fullprint: 29.95, wrap: 29.95},
          {min: 25, max: 49, single: 24.95, multi: 24.95, fullprint: 24.95, wrap: 24.95},
          {min: 50, max: 99, single: 21.95, multi: 21.95, fullprint: 21.95, wrap: 21.95},
          {min: 100, max: 199, single: 19.95, multi: 19.95, fullprint: 19.95, wrap: 19.95},
          {min: 200, max: Infinity, single: 15.95, multi: 15.95, fullprint: 15.95, wrap: 15.95}
        ]}
      },
      longsleeve: {
        dtg: {name: 'Long Sleeve', tiers: [
          {min: 5, max: 9, single: 24.95, multi: 28.95, fullprint: 32.95, wrap: 36.95},
          {min: 10, max: 24, single: 21.95, multi: 25.95, fullprint: 29.95, wrap: 32.95},
          {min: 25, max: 49, single: 19.95, multi: 22.95, fullprint: 25.95, wrap: 29.95},
          {min: 50, max: 99, single: 18.95, multi: 21.95, fullprint: 24.95, wrap: 27.95},
          {min: 100, max: 199, single: 15.95, multi: 18.95, fullprint: 20.95, wrap: 23.95},
          {min: 200, max: Infinity, single: 13.95, multi: 15.95, fullprint: 17.95, wrap: 19.95}
        ]},
        dtf: {name: 'Long Sleeve', tiers: [
          {min: 5, max: 9, single: 24.95, multi: 28.95, fullprint: 32.95, wrap: 36.95},
          {min: 10, max: 24, single: 21.95, multi: 25.95, fullprint: 29.95, wrap: 32.95},
          {min: 25, max: 49, single: 19.95, multi: 22.95, fullprint: 25.95, wrap: 29.95},
          {min: 50, max: 99, single: 18.95, multi: 21.95, fullprint: 24.95, wrap: 27.95},
          {min: 100, max: 199, single: 15.95, multi: 18.95, fullprint: 20.95, wrap: 23.95},
          {min: 200, max: Infinity, single: 13.95, multi: 15.95, fullprint: 17.95, wrap: 19.95}
        ]}
      },
      hivis: {
        dtg: {name: 'Hi-Vis Vest', tiers: [
          {min: 5, max: 9, single: 25.95, multi: 29.95, fullprint: 33.95, wrap: 37.95},
          {min: 10, max: 24, single: 22.95, multi: 26.95, fullprint: 30.95, wrap: 33.95},
          {min: 25, max: 49, single: 20.95, multi: 23.95, fullprint: 26.95, wrap: 30.95},
          {min: 50, max: 99, single: 19.95, multi: 22.95, fullprint: 25.95, wrap: 28.95},
          {min: 100, max: 199, single: 16.95, multi: 19.95, fullprint: 21.95, wrap: 24.95},
          {min: 200, max: Infinity, single: 14.95, multi: 16.95, fullprint: 18.95, wrap: 20.95}
        ]},
        dtf: {name: 'Hi-Vis Vest', tiers: [
          {min: 5, max: 9, single: 25.95, multi: 29.95, fullprint: 33.95, wrap: 37.95},
          {min: 10, max: 24, single: 22.95, multi: 26.95, fullprint: 30.95, wrap: 33.95},
          {min: 25, max: 49, single: 20.95, multi: 23.95, fullprint: 26.95, wrap: 30.95},
          {min: 50, max: 99, single: 19.95, multi: 22.95, fullprint: 25.95, wrap: 28.95},
          {min: 100, max: 199, single: 16.95, multi: 19.95, fullprint: 21.95, wrap: 24.95},
          {min: 200, max: Infinity, single: 14.95, multi: 16.95, fullprint: 18.95, wrap: 20.95}
        ]}
      },
      crewneck: {
        dtg: {name: 'Crewneck', tiers: [
          {min: 5, max: 9, single: 33.95, multi: 35.95, fullprint: 37.95, wrap: 39.95},
          {min: 10, max: 24, single: 29.95, multi: 31.95, fullprint: 33.95, wrap: 35.95},
          {min: 25, max: 49, single: 27.95, multi: 29.95, fullprint: 31.95, wrap: 33.95},
          {min: 50, max: 99, single: 25.95, multi: 27.95, fullprint: 29.95, wrap: 31.95},
          {min: 100, max: 199, single: 24.95, multi: 26.95, fullprint: 28.95, wrap: 30.95},
          {min: 200, max: Infinity, single: 21.95, multi: 23.95, fullprint: 25.95, wrap: 27.95}
        ]},
        dtf: {name: 'Crewneck', tiers: [
          {min: 5, max: 9, single: 33.95, multi: 35.95, fullprint: 37.95, wrap: 39.95},
          {min: 10, max: 24, single: 29.95, multi: 31.95, fullprint: 33.95, wrap: 35.95},
          {min: 25, max: 49, single: 27.95, multi: 29.95, fullprint: 31.95, wrap: 33.95},
          {min: 50, max: 99, single: 25.95, multi: 27.95, fullprint: 29.95, wrap: 31.95},
          {min: 100, max: 199, single: 24.95, multi: 26.95, fullprint: 28.95, wrap: 30.95},
          {min: 200, max: Infinity, single: 21.95, multi: 23.95, fullprint: 25.95, wrap: 27.95}
        ]}
      },
      polo: {
        dtg: {name: 'Polo', tiers: [
          {min: 5, max: 9, single: 24.95, multi: 26.95, fullprint: 28.95, wrap: 30.95},
          {min: 10, max: 24, single: 22.95, multi: 24.95, fullprint: 26.95, wrap: 28.95},
          {min: 25, max: 49, single: 19.95, multi: 21.95, fullprint: 23.95, wrap: 25.95},
          {min: 50, max: 99, single: 18.95, multi: 20.95, fullprint: 22.95, wrap: 24.95},
          {min: 100, max: 199, single: 16.95, multi: 18.95, fullprint: 20.95, wrap: 22.95},
          {min: 200, max: Infinity, single: 14.95, multi: 16.95, fullprint: 18.95, wrap: 20.95}
        ]},
        dtf: {name: 'Polo', tiers: [
          {min: 5, max: 9, single: 24.95, multi: 26.95, fullprint: 28.95, wrap: 30.95},
          {min: 10, max: 24, single: 22.95, multi: 24.95, fullprint: 26.95, wrap: 28.95},
          {min: 25, max: 49, single: 19.95, multi: 21.95, fullprint: 23.95, wrap: 25.95},
          {min: 50, max: 99, single: 18.95, multi: 20.95, fullprint: 22.95, wrap: 24.95},
          {min: 100, max: 199, single: 16.95, multi: 18.95, fullprint: 20.95, wrap: 22.95},
          {min: 200, max: Infinity, single: 14.95, multi: 16.95, fullprint: 18.95, wrap: 20.95}
        ]}
      },
      joggers: {
        dtg: {name: 'Joggers', tiers: [
          {min: 5, max: 9, single: 33.95, multi: 35.95, fullprint: 37.95, wrap: 39.95},
          {min: 10, max: 24, single: 29.95, multi: 31.95, fullprint: 33.95, wrap: 35.95},
          {min: 25, max: 49, single: 27.95, multi: 29.95, fullprint: 31.95, wrap: 33.95},
          {min: 50, max: 99, single: 25.95, multi: 27.95, fullprint: 29.95, wrap: 31.95},
          {min: 100, max: 199, single: 24.95, multi: 26.95, fullprint: 28.95, wrap: 30.95},
          {min: 200, max: Infinity, single: 22.95, multi: 24.95, fullprint: 26.95, wrap: 28.95}
        ]},
        dtf: {name: 'Joggers', tiers: [
          {min: 5, max: 9, single: 33.95, multi: 35.95, fullprint: 37.95, wrap: 39.95},
          {min: 10, max: 24, single: 29.95, multi: 31.95, fullprint: 33.95, wrap: 35.95},
          {min: 25, max: 49, single: 27.95, multi: 29.95, fullprint: 31.95, wrap: 33.95},
          {min: 50, max: 99, single: 25.95, multi: 27.95, fullprint: 29.95, wrap: 31.95},
          {min: 100, max: 199, single: 24.95, multi: 26.95, fullprint: 28.95, wrap: 30.95},
          {min: 200, max: Infinity, single: 22.95, multi: 24.95, fullprint: 26.95, wrap: 28.95}
        ]}
      },
      tote: {
        dtg: {name: 'Tote Bag', maxLocations: 2, tiers: [
          {min: 5, max: 9, single: 16.95, multi: 18.95},
          {min: 10, max: 24, single: 14.95, multi: 16.95},
          {min: 25, max: 49, single: 12.95, multi: 14.95},
          {min: 50, max: 99, single: 11.95, multi: 13.95},
          {min: 100, max: 199, single: 9.95, multi: 11.95},
          {min: 200, max: Infinity, single: 7.95, multi: 9.95}
        ]},
        dtf: {name: 'Tote Bag', maxLocations: 2, tiers: [
          {min: 5, max: 9, single: 16.95, multi: 18.95},
          {min: 10, max: 24, single: 14.95, multi: 16.95},
          {min: 25, max: 49, single: 12.95, multi: 14.95},
          {min: 50, max: 99, single: 11.95, multi: 13.95},
          {min: 100, max: 199, single: 9.95, multi: 11.95},
          {min: 200, max: Infinity, single: 7.95, multi: 9.95}
        ]}
      }
    };

    // B2C retail pricing — flat rate for small orders under 10 (no volume tiers)
    // Market research: Canadian local shops charge $18.99-$24.95/tee for single orders
    // Priced competitively above B2B 5-9 tier, below big-box retail
    var b2cPricing = {
      tshirt: { dtg: {single: 22.95, multi: 24.95, fullprint: 27.95, wrap: 29.95}, dtf: {single: 22.95, multi: 24.95, fullprint: 27.95, wrap: 29.95} },
      hoodie: { dtg: {single: 44.95, multi: 47.95, fullprint: 49.95, wrap: 52.95}, dtf: {single: 44.95, multi: 47.95, fullprint: 49.95, wrap: 52.95} },
      hat: { embroidery: {single: 27.95, multi: 29.95, fullprint: 32.95, wrap: 34.95}, dtg: {single: 27.95, multi: 29.95, fullprint: 32.95, wrap: 34.95} },
      crewneck: { dtg: {single: 39.95, multi: 42.95, fullprint: 44.95, wrap: 47.95}, dtf: {single: 39.95, multi: 42.95, fullprint: 44.95, wrap: 47.95} },
      polo: { dtg: {single: 29.95, multi: 32.95, fullprint: 34.95, wrap: 37.95}, dtf: {single: 29.95, multi: 32.95, fullprint: 34.95, wrap: 37.95} },
      longsleeve: { dtg: {single: 29.95, multi: 32.95, fullprint: 34.95, wrap: 37.95}, dtf: {single: 29.95, multi: 32.95, fullprint: 34.95, wrap: 37.95} },
      joggers: { dtg: {single: 39.95, multi: 42.95, fullprint: 44.95, wrap: 47.95}, dtf: {single: 39.95, multi: 42.95, fullprint: 44.95, wrap: 47.95} },
      tote: { dtg: {single: 19.95, multi: 22.95}, dtf: {single: 19.95, multi: 22.95} }
    };

    function getPlacementType() {
      // Based on number of print locations selected
      // Totes/hats max at 2 sides (multi)
      var maxLocs = (state.garment === 'tote' || state.garment === 'hat') ? 2 : 4;
      var count = Math.min(printCount, maxLocs);
      if (count >= 4) return 'wrap';
      if (count >= 3) return 'fullprint';
      if (count >= 2) return 'multi';
      return 'single';
    }

    function getPricePerUnit() {
      var product = state.garment;
      var service = state.service;
      var qty = parseInt(document.getElementById('sizeTotal').textContent) || 0;

      if (!product || !service || qty === 0) return null;

      var placementType = getPlacementType();

      var basePrice;
      if (pricingMode === 'b2c') {
        // B2C: flat retail price, no volume tiers
        var b2c = b2cPricing[product];
        if (!b2c) return null;
        var svcData = b2c[service.toLowerCase()];
        if (!svcData) svcData = b2c['dtg'] || b2c['embroidery']; // fallback
        if (!svcData) return null;
        basePrice = svcData[placementType] || svcData['single'];
      } else {
        // B2B: volume-tiered pricing from pricing sheet
        var b2b = b2bPricing[product];
        if (!b2b) return null;
        var pricingInfo = b2b[service.toLowerCase()];
        if (!pricingInfo) pricingInfo = b2b['dtg'] || b2b['embroidery']; // fallback
        if (!pricingInfo) return null;
        var tiers = pricingInfo.tiers;
        var tier = tiers.find(function(t) { return qty >= t.min && qty <= t.max; });
        if (!tier) tier = tiers[0]; // fallback to smallest tier
        basePrice = tier[placementType] || tier['single'];
      }

      // All-Canadian made blanks upgrade: +$2/unit (T-shirts only — extend later if other products go All-Canadian)
      if (basePrice && state.canadianBlanks && (product === 'tshirt' || product === 'longsleeve')) {
        basePrice = basePrice + 2;
      }

      return basePrice;
    }

    // Renders the price section + payment section using a unit price and
    // qty. Shared by the live-API and legacy-table code paths in
    // calculatePrice(). The "isLive" badge is added when the number came
    // from the engine (so the customer knows it's a real quote-quality
    // estimate, not a generic placeholder).
    function renderPriceDisplay(qty, perUnit, isLive) {
      // Update the live-price strip that's always visible across steps.
      updateLivePriceStrip(qty, perUnit, isLive);

      if (!qty || !perUnit) {
        document.getElementById('priceSection').style.display = 'none';
        document.getElementById('paymentSection').style.display = 'none';
        return;
      }
      // Layer in the XXL+ surcharge (each 2XL/3XL/4XL/5XL unit adds $3) — see
      // computeSizeSurcharge() + the matching SIZE_SURCHARGE_CAD constant.
      var sur = computeSizeSurcharge();
      var total = (perUnit * qty) + sur.surchargeTotal;
      document.getElementById('priceSection').style.display = 'block';
      document.getElementById('paymentSection').style.display = 'block';
      var liveTag = isLive
        ? '<span style="font-size:.7rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:50px;background:#e8ff3c;color:#1a1a1a;margin-left:6px;vertical-align:middle">live</span>'
        : '';
      var surRow = sur.surchargeTotal > 0
        ? '<div class="price-row"><span>2XL+ surcharge (' + sur.count + ' pc × $3):</span><span>$' + sur.surchargeTotal.toFixed(2) + '</span></div>'
        : '';
      var breakdown = document.getElementById('priceBreakdown');
      breakdown.innerHTML =
        '<div class="price-row"><span>Per unit ' + liveTag + ':</span><span>$' + perUnit.toFixed(2) + '</span></div>' +
        '<div class="price-row"><span>Quantity:</span><span>' + qty + ' units</span></div>' +
        surRow;
      document.getElementById('priceTotal').textContent = '$' + total.toFixed(2);
    }

    // Top-of-form live price strip — visible whenever a catalog product is
    // picked. Updates with sides on Step 1 and qty on Step 2.
    function updateLivePriceStrip(qty, perUnit, isLive) {
      var strip = document.getElementById('livePriceStrip');
      if (!strip) return;
      if (!catalogPick) {
        // Defensive: in cart mode the strip is owned by updateCartTotal,
        // so don't hide it just because there's no single catalogPick.
        var cartHasItems = (typeof SinghsCart !== 'undefined' && SinghsCart.count() > 0);
        if (cartHasItems) { updateCartTotal(); return; }
        strip.style.display = 'none';
        return;
      }
      strip.style.display = 'block';
      // Make sure the "/unit" suffix is visible — cart mode hides it.
      // Also reset the label to "/unit" in case we just came from BYO
      // mode (which sets it to "/garment").
      var suf = document.getElementById('livePriceUnitSuffix');
      if (suf) { suf.style.display = ''; suf.textContent = '/unit'; }
      var sides = parseInt(document.getElementById('printCountInput').value) || 1;
      document.getElementById('livePriceUnit').textContent = (perUnit && perUnit > 0) ? ('$' + perUnit.toFixed(2)) : '$—';
      var qtyLabel = qty && qty > 0
        ? (qty + ' units · ' + sides + ' side' + (sides>1?'s':'') + (isLive ? '' : ' · est.'))
        : ('pick qty in Step 2 · ' + sides + ' side' + (sides>1?'s':''));
      document.getElementById('livePriceQty').textContent = qtyLabel;
      var totalWrap = document.getElementById('livePriceTotalWrap');
      if (qty && perUnit) {
        totalWrap.style.display = 'block';
        var sur = computeSizeSurcharge();
        document.getElementById('livePriceTotal').textContent = '$' + ((qty * perUnit) + sur.surchargeTotal).toFixed(2);
      } else {
        totalWrap.style.display = 'none';
      }
    }

    // When sides change on Step 1 (before any qty is entered), still fetch
    // a live per-unit at the top tier so the strip shows something useful.
    function fetchAndRenderTopTierEstimate() {
      if (!catalogPick || !catalogPick.product_id) { updateLivePriceStrip(0, 0, false); return; }
      var sides = parseInt(document.getElementById('printCountInput').value) || 1;
      fetch(PRICING_API_FOR_QUOTE +
        '?product_id=' + encodeURIComponent(catalogPick.product_id) +
        '&qty=200&sides=' + sides
      ).then(function(r){ return r.ok ? r.json() : null; })
       .then(function(d){
         if (d && typeof d.unit_price === 'number') updateLivePriceStrip(0, d.unit_price, true);
       }).catch(function(){});
    }

    function calculatePrice() {
      var qty = parseInt(document.getElementById('sizeTotal').textContent) || 0;
      if (qty === 0) {
        document.getElementById('priceSection').style.display = 'none';
        document.getElementById('paymentSection').style.display = 'none';
        return;
      }

      // If a catalog product is selected, get the live engine price (matches
      // what catalog.html shows + what the CRM uses for quotes). Falls back
      // to the legacy hardcoded table while waiting on the fetch, or if the
      // visitor is using a non-catalog garment (BYOG / generic picker).
      if (catalogPick && catalogPick.product_id) {
        fetchLiveUnitPrice(function(livePrice) {
          if (typeof livePrice === 'number' && livePrice > 0) {
            renderPriceDisplay(qty, livePrice, true);
          } else {
            // live fetch failed → fall back to legacy table
            var perUnit = getPricePerUnit();
            if (perUnit) renderPriceDisplay(qty, perUnit, false);
            else {
              document.getElementById('priceSection').style.display = 'none';
              document.getElementById('paymentSection').style.display = 'none';
            }
          }
        });
        return;
      }

      var perUnit = getPricePerUnit();
      if (!perUnit) {
        document.getElementById('priceSection').style.display = 'none';
        document.getElementById('paymentSection').style.display = 'none';
        return;
      }

      // Auto-switch toggle based on quantity
      if (qty > 0 && qty < 5 && pricingMode === 'b2b') {
        pricingMode = 'b2c';
        updatePricingTabs();
      } else if (qty > 10 && pricingMode === 'b2c') {
        pricingMode = 'b2b';
        updatePricingTabs();
      }

      // Recalculate with correct mode
      perUnit = getPricePerUnit();
      if (!perUnit) {
        document.getElementById('priceSection').style.display = 'none';
        document.getElementById('paymentSection').style.display = 'none';
        return;
      }
      renderPriceDisplay(qty, perUnit, false);

      // Show volume discount note for bulk
      var discountNote = document.getElementById('priceDiscountNote');
      if (pricingMode === 'b2b' && qty >= 50) {
        discountNote.style.display = 'inline-block';
      } else {
        discountNote.style.display = 'none';
      }

      // Show bulk minimum note
      var b2bNote = document.getElementById('pricingB2bNote');
      if (pricingMode === 'b2b' && qty < 5) {
        b2bNote.style.display = 'block';
      } else {
        b2bNote.style.display = 'none';
      }

      // Pricing note
      var pricingNoteEl = document.getElementById('pricingNote');
      pricingNoteEl.textContent = 'Estimated price \u2022 Final quote may vary';
    }

    function updatePricingTabs() {
      document.querySelectorAll('.price-tab').forEach(function(b) {
        b.classList.remove('active');
        if (b.getAttribute('data-pricing') === pricingMode) b.classList.add('active');
      });
    }

    function togglePricing(button) {
      document.querySelectorAll('.price-tab').forEach(function(b) { b.classList.remove('active'); });
      button.classList.add('active');
      pricingMode = button.getAttribute('data-pricing');
      calculatePrice();
    }

    // Check URL param to start in bulk mode (from businesses page)
    (function() {
      var params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'bulk') {
        pricingMode = 'b2b';
      }
    })();

    // ===== DIRECT ORDER / SELF-SERVE CHECKOUT =====
    // The CRM's public checkout endpoint. It re-prices the cart server-side
    // (never trusts the client total), writes an inbound_request flagged
    // flow='shop_order' status='pending_payment', creates a Stripe Checkout
    // session, and returns { payment_url }. The Stripe webhook promotes the
    // request to a real `orders` row once payment clears. The "Request a
    // quote instead" path (the form below) is unchanged — it still POSTs to
    // /api/inbound. This is the pay-now path only.
    var SHOP_CHECKOUT_API = 'https://singhsprint-crm.vercel.app/api/shop/checkout';

    // Collect every design file the customer attached, from the same two
    // sources the quote-submit path uses (placementFiles = single-product /
    // global; cartItemFiles = per-cart-item, keyed "<itemIdx>_<presetId>").
    // Returns [{ placement, cart_item_index, file }].
    function spCollectPendingFiles() {
      var pending = [];
      try {
        if (typeof placementFiles === 'object' && placementFiles) {
          Object.keys(placementFiles).forEach(function(presetId) {
            var f = placementFiles[presetId];
            if (f instanceof File) pending.push({ placement: presetId, cart_item_index: null, file: f });
          });
        }
        if (typeof cartItemFiles === 'object' && cartItemFiles) {
          Object.keys(cartItemFiles).forEach(function(key) {
            var f = cartItemFiles[key];
            if (!(f instanceof File)) return;
            var split = key.indexOf('_');
            var idxNum = split > -1 ? parseInt(key.slice(0, split), 10) : NaN;
            var placement = split > -1 ? key.slice(split + 1) : null;
            pending.push({ placement: placement, cart_item_index: Number.isFinite(idxNum) ? idxNum : null, file: f });
          });
        }
      } catch (e) { /* never let file collection break checkout */ }
      return pending;
    }

    // Build the items[] payload for /api/shop/checkout from the current page
    // state — works in both multi-item cart mode and single-product mode.
    // Field names match the CRM's ShopCartItemInput; the server re-prices
    // from product_id/variant_id + color_id + qty + placements, so we only
    // need to pass identifiers, not money.
    function spBuildCheckoutItems() {
      // Multi-item cart flow (catalog "add to cart").
      if (typeof SinghsCart !== 'undefined' && SinghsCart.count() > 0) {
        return SinghsCart.read().items.map(function(it) {
          return {
            product_id:        it.product_id || null,
            variant_id:        it.variant_id || null,
            color_id:          it.color_id || null,
            qty:               parseInt(it.qty, 10) || 0,
            sizes:             (it.sizes && typeof it.sizes === 'object') ? it.sizes : {},
            placements:        Array.isArray(it.placements) ? it.placements : [],
            decoration_method: (it.decoration_type || '').toLowerCase() || 'dtf',
            brand:             it.brand || null,
            style_number:      it.style_number || null,
            name:              it.name || null,
            color_name:        (it.color_name || '').replace(/_\d+$/, '') || null,
            garment_type:      it.garment_type || null,
            // Customer-approved mockups + artwork from the live customizer
            // (spOpenCustomizer stores these on the cart item). Empty until
            // they preview — the order still works without them.
            mockups:           Array.isArray(it.mockups) ? it.mockups : [],
            design_url:        it.design_url || null,
            design_path:       it.design_path || null
          };
        });
      }
      // Single-product flow (?product=… deep link).
      if (!catalogPick || !catalogPick.product_id) return [];
      var sizes = {};
      ['xs','s','m','l','xl','2xl','3xl','4xl','5xl'].forEach(function(s) {
        var inp = document.querySelector('input[name="size_' + s + '"]');
        var v = inp ? (parseInt(inp.value, 10) || 0) : 0;
        if (v > 0) sizes[s.toUpperCase()] = v;
      });
      var qty = Object.keys(sizes).reduce(function(a, k) { return a + sizes[k]; }, 0)
              || (parseInt(document.getElementById('sizeTotal').textContent, 10) || 0);
      var placements = [];
      try { placements = Object.values(presetByLocation || {}).filter(Boolean); } catch (e) {}
      var colorIdInp = document.getElementById('catalogColorId');
      return [{
        product_id:        catalogPick.product_id,
        color_id:          (colorIdInp && colorIdInp.value) || null,
        qty:               qty,
        sizes:             sizes,
        placements:        placements,
        decoration_method: (state.service || '').toLowerCase() || 'dtf',
        brand:             catalogPick.brand || null,
        style_number:      catalogPick.style_number || null,
        name:              catalogPick.name || state.product || null,
        color_name:        state.colorName || null,
        garment_type:      catalogPick.garment_type || state.garment || null,
        // Customer-approved mockups + artwork from the live customizer.
        mockups:           Array.isArray(window.__spSingleMockups) ? window.__spSingleMockups : [],
        design_url:        (window.__spSingleDesign && window.__spSingleDesign.signed_url) || null,
        design_path:       (window.__spSingleDesign && window.__spSingleDesign.path) || null
      }];
    }

    function handlePayment() {
      var nameEl    = document.getElementById('name');
      var emailEl   = document.getElementById('email');
      var phoneEl   = document.getElementById('phone');
      var companyEl = document.getElementById('company');
      var name  = (nameEl  && nameEl.value  || '').trim();
      var email = (emailEl && emailEl.value || '').trim();

      // Email + name are required to own the order + send the receipt. If
      // they're missing, route the customer to the contact step and focus
      // the field rather than failing silently at the API.
      function focusContact(el) {
        try { if (typeof goToStep === 'function') goToStep(3); } catch (e) {}
        if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }
      if (!name) { alert('Please add your name so we can put it on the order.'); focusContact(nameEl); return; }
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        alert('Please enter a valid email — that’s where your receipt and order updates go.');
        focusContact(emailEl); return;
      }

      var items = spBuildCheckoutItems();
      if (!items.length || !items.some(function(i) { return i.qty > 0; })) {
        alert('Add at least one item with a quantity before ordering.');
        return;
      }

      // Aggregate size breakdown across items (powers the CRM inbox UI).
      var sizeBreakdown = {};
      items.forEach(function(it) {
        Object.keys(it.sizes || {}).forEach(function(k) {
          sizeBreakdown[k] = (sizeBreakdown[k] || 0) + (it.sizes[k] || 0);
        });
      });

      // Attribution breadcrumbs.
      var utm = {};
      try {
        var sp = new URLSearchParams(location.search);
        ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','promo'].forEach(function(k) {
          var v = sp.get(k); if (v) utm[k] = v;
        });
      } catch (e) {}

      // Disable both possible triggers (panel button + bottom order button)
      // to prevent a double-submit; the overlay carries the progress message.
      var payBtns = [document.getElementById('payButton'), document.getElementById('orderPayBtn')].filter(Boolean);
      var legacyPayBtn = document.getElementById('payButton');
      payBtns.forEach(function(b) { b.disabled = true; b.style.opacity = '0.65'; b.style.cursor = 'progress'; });
      if (legacyPayBtn) {
        if (!legacyPayBtn.dataset._label) legacyPayBtn.dataset._label = legacyPayBtn.textContent;
        legacyPayBtn.textContent = 'Starting secure checkout…';
      }
      if (typeof spShowUploadOverlay === 'function') spShowUploadOverlay('Preparing your order…');

      function restoreBtn() {
        if (typeof spHideUploadOverlay === 'function') spHideUploadOverlay();
        payBtns.forEach(function(b) { b.disabled = false; b.style.opacity = ''; b.style.cursor = ''; });
        if (legacyPayBtn && legacyPayBtn.dataset._label) legacyPayBtn.textContent = legacyPayBtn.dataset._label;
      }

      // Upload any attached artwork first (best-effort — a failed/oversize
      // upload must NOT block payment; production can chase the file later
      // via the request row). Then attach a design_url per item and POST.
      var pending = (typeof spCollectPendingFiles === 'function') ? spCollectPendingFiles() : [];
      var uploadAll = pending.length
        ? Promise.all(pending.map(function(p) {
            return uploadDesignFile(p.file)
              .then(function(r) {
                return {
                  placement:       p.placement,
                  cart_item_index: p.cart_item_index,
                  path:            (r && (r.path || r.key)) || null,
                  signed_url:      (r && (r.signed_url || r.url || r.signedUrl)) || null
                };
              })
              .catch(function() { return null; });
          })).then(function(arr) { return arr.filter(Boolean); })
        : Promise.resolve([]);

      uploadAll.then(function(uploaded) {
        items.forEach(function(it, idx) {
          var match = null;
          for (var i = 0; i < uploaded.length; i++) {
            if (uploaded[i].cart_item_index === idx) { match = uploaded[i]; break; }
          }
          if (!match) {
            for (var j = 0; j < uploaded.length; j++) {
              if (uploaded[j].cart_item_index == null) { match = uploaded[j]; break; }
            }
          }
          // Only fill design from this upload pass if the customizer didn't
          // already attach one; never overwrite a customizer-approved design.
          if (match) {
            if (!it.design_url)  it.design_url  = match.signed_url || null;
            if (!it.design_path) it.design_path = match.path || null;
          }
          // Preserve customer-approved mockups from the live customizer; only
          // default to empty when none were baked (server makes them later).
          if (!Array.isArray(it.mockups)) it.mockups = [];
        });

        return fetch(SHOP_CHECKOUT_API, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_email: email,
            contact_name:   name || null,
            phone:          (phoneEl   && phoneEl.value)   || null,
            company:        (companyEl && companyEl.value) || null,
            items:          items,
            size_breakdown: sizeBreakdown,
            deposit_choice: 'full',
            source_url:     location.href,
            meta:           utm
          })
        }).then(function(r) {
          return r.json().then(function(j) { return { ok: r.ok, body: j }; })
                          .catch(function() { return { ok: r.ok, body: {} }; });
        });
      }).then(function(res) {
        if (res.ok && res.body && res.body.payment_url) {
          if (window.spTrack) {
            try { window.spTrack('shop_checkout_start', { total: res.body.total, kind: res.body.kind, currency: 'CAD' }); } catch (e) {}
          }
          // GA4-standard begin_checkout so the default ecommerce funnel
          // report picks it up (in addition to the custom event above).
          try {
            if (window.SP_GTAG && typeof window.SP_GTAG.event === 'function') {
              window.SP_GTAG.event('begin_checkout', {
                value: (typeof res.body.total === 'number') ? res.body.total : undefined,
                currency: 'CAD'
              });
            }
          } catch (e) { /* tracking must never block the redirect */ }
          // Meta Pixel InitiateCheckout — fires once the Stripe session is
          // confirmed created and we're about to redirect to secure payment.
          // Mirrors the drops page (api/shop/page.js) so both checkout funnels
          // report the same start step. Purchase fires server-side from the
          // Stripe webhook (CAPI, deterministic event_id), so we deliberately
          // do NOT fire a client Purchase here — same discipline as drops.
          try {
            if (typeof fbq === 'function') {
              fbq('track', 'InitiateCheckout', {
                value: (res.body && typeof res.body.total === 'number') ? res.body.total : undefined,
                currency: 'CAD',
                content_type: 'product',
                num_items: items.reduce(function(a, it) { return a + (parseInt(it.qty, 10) || 0); }, 0) || undefined
              });
            }
          } catch (e) { /* tracking must never block the redirect to payment */ }
          window.location.href = res.body.payment_url;
        } else {
          throw new Error((res.body && res.body.error) || 'Checkout is temporarily unavailable.');
        }
      }).catch(function(err) {
        restoreBtn();
        alert('We couldn’t start secure checkout: ' + ((err && err.message) || err) +
              '\n\nYou can still submit the form below to request a quote and we’ll send a payment link.');
      });
    }

    // =========================================================================
    // LIVE MOCKUP CUSTOMIZER — drag + scale artwork on the chosen garment and
    // bake a photoreal preview via the public /api/shop/compose endpoint. The
    // same normalized {x,y,w} box the operator editor uses; the server runs the
    // identical sharp composite, so the preview matches the finished mockup.
    // Optional: a customer can order without it; if they bake one it rides
    // along on the order line (items[].mockups[]).
    // =========================================================================
    var SHOP_COMPOSE_API = 'https://singhsprint-crm.vercel.app/api/shop/compose';
    // Side-view sleeve render — pre-bake placeholder + fallback. The photoreal,
    // colour-matched sleeve is produced server-side by /api/shop/compose
    // (sleeve-ai); this gives the sleeve tab a side-view surface before baking.
    var SP_SLEEVE_RENDER   = '/images/sleeve-left.png?v=2';
    var SP_SLEEVE_RENDER_R = '/images/sleeve-right.png?v=2';

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

    // Cart item arrived with baked mockups (e.g. customized in the catalog
    // modal)? Drives the green "mockup ready" thumbnail + button at render time.
    function spCartHasMockup(it) { return !!(it && Array.isArray(it.mockups) && it.mockups.length); }
    // Prefer the front-side mockup as the row thumbnail; fall back to first
    // baked mockup, then the bare hero render.
    function spCartThumbSrc(it) {
      if (spCartHasMockup(it)) {
        var front = it.mockups.filter(function(m){ return spSideFor(m.placement) === 'front'; })[0] || it.mockups[0];
        if (front && front.url) return front.url;
      }
      return it.hero_url || '';
    }

    // Seed a sensible default {x,y,w} from the placement preset's centre + size.
    function spDefaultBox(presetId) {
      // Sleeve placements preview on the standard tee render — seed the box
      // over the correct sleeve (left vs right) instead of using the chest-
      // tuned preset centre.
      if (/sleeve/i.test(presetId)) {
        var isRight = /right/i.test(presetId);
        // Centre the art on the sleeve print zone of the photo render
        // (left photo: sleeve at x~0.58; right render is the mirror at x~0.42).
        return { x: isRight ? 0.32 : 0.48, y: 0.35, w: 0.20 };
      }
      var pre = placementPresets[presetId] || {};
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
    function spOpenCustomizer(opts) {
      spInjectCustomizerCSS();
      var placements = (opts.placements || []).filter(Boolean);
      if (!placements.length) placements = ['center-chest'];

      // Resolve the design File per placement. Each placement only previews the
      // art that was actually uploaded for it — placements without their own art
      // stay blank (no fallback), so e.g. a front-only design never bleeds onto
      // the back tab.
      var firstFile = null;
      var fileByP = {};
      // Already-uploaded art (server path/signed_url, no File in memory) per
      // placement — e.g. an item customized in the catalog modal that's now
      // being re-edited. Lets the editor preview + re-compose without a File.
      var existByP = {};
      var anyArt = false;
      placements.forEach(function(p) {
        var f = opts.fileFor ? opts.fileFor(p) : null;
        if (f instanceof File) { fileByP[p] = f; if (!firstFile) firstFile = f; }
        var ex = opts.existingDesignFor ? opts.existingDesignFor(p) : null;
        if (ex && (ex.path || ex.signed_url)) existByP[p] = ex;
        if (fileByP[p] || existByP[p]) anyArt = true;
      });
      if (!anyArt) {
        alert('Add your artwork first (the upload field), then tap “Customize & preview”.');
        return;
      }
      // A placement has art if it has an in-memory File OR a persisted design.
      function hasArt(p) { return (fileByP[p] instanceof File) || !!existByP[p]; }

      var boxes = {};
      placements.forEach(function(p) {
        boxes[p] = (opts.initial && opts.initial.boxes && opts.initial.boxes[p]) || spDefaultBox(p);
      });
      var removeBg = !!(opts.initial && opts.initial.removeBg);
      var active = 0;
      var objURLs = {};
      function artURL(p) {
        var f = fileByP[p];
        if (f) {
          if (!objURLs[f.name + f.size]) objURLs[f.name + f.size] = URL.createObjectURL(f);
          return objURLs[f.name + f.size];
        }
        // No File — preview the already-uploaded art via its signed URL.
        if (existByP[p] && existByP[p].signed_url) return existByP[p].signed_url;
        return '';
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
          b.textContent = (placementPresets[p] && placementPresets[p].label) || p;
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
          var lbl = (placementPresets[p] && placementPresets[p].label) || p;
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

      // Resolve the server path/url for a placement: upload its File if there
      // is one, else use the already-uploaded (persisted) design as-is.
      function designForPlacement(p) {
        if (fileByP[p] instanceof File) return spUploadDesignOnce(fileByP[p]);
        if (existByP[p]) return Promise.resolve({ path: existByP[p].path || null, signed_url: existByP[p].signed_url || null });
        return Promise.resolve(null);
      }
      // The primary design returned to onDone — the first placement's File
      // upload when present, else its persisted design (no re-upload needed).
      function primaryDesign() {
        if (firstFile) return spUploadDesignOnce(firstFile);
        var p0 = placements.filter(hasArt)[0];
        return p0 ? designForPlacement(p0) : Promise.resolve(null);
      }

      // Bake every placement that has art, via /api/shop/compose.
      function bakeAll() {
        if (!opts.colorId) { alert('Pick a garment colour first.'); return Promise.resolve([]); }
        setBusy(true, 'Rendering your mockup…');
        var design = null;
        var results = [];
        // Resolve the primary design once, then compose each placement
        // sequentially (gentle on the rate-limited endpoint). Each placement
        // re-composes from the art it actually has — an uploaded File or the
        // already-uploaded persisted design — so editing never needs a re-upload.
        return primaryDesign().then(function(info) {
          design = info;
          if (!info || (!info.path && !info.signed_url)) throw new Error('artwork unavailable');
          var chain = Promise.resolve();
          placements.forEach(function(p) {
            if (!hasArt(p)) return; // skip placements with no art
            chain = chain.then(function() {
              return designForPlacement(p).then(function(di) {
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
          primaryDesign().then(function(design) {
            if (typeof opts.onDone === 'function') {
              opts.onDone({ mockups: mocks, boxes: boxes, removeBg: removeBg, design: design });
            }
            close();
          });
        }).catch(function(e) { setBusy(false, 'Could not save: ' + ((e && e.message) || e)); });
      };

      paint();
    }

    // ---- Universal entry point + inline preview --------------------------
    // The prominent "Customize & preview" button routes to the right flow:
    // a multi-item cart customizes per row (open the first; the rest have
    // their own buttons), otherwise the single-product flow.
    function spLaunchCustomizer() {
      var hasCart = (typeof SinghsCart !== 'undefined' && SinghsCart.count && SinghsCart.count() > 0);
      if (hasCart) {
        var items = SinghsCart.read().items;
        if (items.length > 1) {
          // Point them at the per-item buttons so it's clear each item is
          // customized separately, then open the first as a head start.
          var host = document.getElementById('cartList') || document.querySelector('.cart-item');
          if (host && host.scrollIntoView) host.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        spLaunchCartCustomizer(0);
      } else {
        spLaunchSingleCustomizer();
      }
    }

    // Render baked mockups inline on the page (in the right panel) so the
    // customer sees their design on the garment without re-opening the modal.
    function spShowInlineMockups(mockups, onEdit) {
      var host = document.getElementById('spInlinePreview');
      if (!host) return;
      if (!mockups || !mockups.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
      function lbl(p) { return (placementPresets[p] && placementPresets[p].label) || p; }
      var imgs = mockups.map(function(m) {
        return '<figure style="margin:0;flex:1;min-width:120px;max-width:200px">' +
          '<img src="' + m.url + '" alt="' + lbl(m.placement) + ' mockup" style="width:100%;border-radius:10px;border:1px solid #eee;background:#fff;display:block"/>' +
          '<figcaption style="font-size:.7rem;color:#888;text-align:center;margin-top:5px;font-weight:600">' + lbl(m.placement) + '</figcaption>' +
        '</figure>';
      }).join('');
      host.innerHTML =
        '<div style="background:#fff;border:1px solid #e8e8e8;border-radius:16px;padding:16px 16px 14px;box-shadow:0 2px 12px rgba(0,0,0,.05)">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px">' +
            '<div style="display:flex;align-items:center;gap:7px;font-weight:700;font-size:.85rem;color:#1a1a1a"><span style="width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.18)"></span>Your mockup</div>' +
            '<button type="button" id="spInlineEdit" style="background:transparent;border:1px solid #d8d8d8;border-radius:50px;padding:6px 13px;font-size:.76rem;font-weight:700;cursor:pointer;color:#1a1a1a">Edit</button>' +
          '</div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">' + imgs + '</div>' +
        '</div>';
      host.style.display = 'block';
      var eb = document.getElementById('spInlineEdit');
      if (eb) eb.onclick = (typeof onEdit === 'function') ? onEdit : function() {};
    }

    // ---- Single-product wiring -------------------------------------------
    function spSingleColor() {
      var cidEl = document.getElementById('catalogColorId');
      var cid = cidEl && cidEl.value;
      var colors = (catalogPick && catalogPick.colors) || [];
      var c = null;
      for (var i = 0; i < colors.length; i++) { if (colors[i].color_id === cid) { c = colors[i]; break; } }
      if (!c && colors.length) c = colors[0];
      return { cid: cid || (c && c.color_id) || null, color: c || {} };
    }
    function spMarkCustomized(mockups) {
      var btn = document.getElementById('spCustomizeBtn');
      if (!btn) return;
      var n = (mockups && mockups.length) || 0;
      btn.querySelector('span').textContent = n ? ('✓ Mockup ready — tap to edit' + (n > 1 ? ' (' + n + ' views)' : '')) : 'Customize & preview on the garment';
      if (n) { btn.style.background = '#143a14'; btn.style.color = '#9dff9d'; }
    }
    function spLaunchSingleCustomizer() {
      if (!catalogPick || !catalogPick.product_id) { alert('Pick a product first.'); return; }
      var sc = spSingleColor();
      if (!sc.cid) { alert('Pick a garment colour first.'); return; }
      var c = sc.color;
      var placements = [];
      try { placements = Object.values(presetByLocation || {}).filter(Boolean); } catch (e) {}
      if (!placements.length) placements = ['center-chest'];
      spOpenCustomizer({
        colorId: sc.cid,
        garment: { front: c.mockup_front_url, back: c.mockup_back_url, side: c.mockup_side_url },
        placements: placements,
        fileFor: function(p) { return (typeof placementFiles === 'object' && placementFiles[p] instanceof File) ? placementFiles[p] : null; },
        initial: { boxes: window.__spSingleBoxes || null, removeBg: !!window.__spSingleRemoveBg },
        sessionId: (typeof SINGHS_CART_ID !== 'undefined') ? SINGHS_CART_ID : null,
        onDone: function(res) {
          window.__spSingleMockups   = res.mockups || [];
          window.__spSingleBoxes     = res.boxes;
          window.__spSingleRemoveBg  = res.removeBg;
          window.__spSingleDesign    = res.design || null;
          spMarkCustomized(res.mockups);
          spShowInlineMockups(res.mockups, spLaunchSingleCustomizer);
        }
      });
    }

    // ---- Cart-mode wiring -------------------------------------------------
    function spLaunchCartCustomizer(idx) {
      var items = SinghsCart.read().items;
      var it = items[idx];
      if (!it) return;
      if (!it.color_id) { alert('This item needs a colour selected first.'); return; }
      var placements = (Array.isArray(it.placements) && it.placements.length) ? it.placements : ['center-chest'];
      fetch(CATALOG_API_FOR_QUOTE + '?product_id=' + encodeURIComponent(it.product_id))
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(d) {
          var c = {};
          var colors = (d && d.products && d.products[0] && d.products[0].colors) || [];
          for (var i = 0; i < colors.length; i++) { if (colors[i].color_id === it.color_id) { c = colors[i]; break; } }
          spOpenCustomizer({
            colorId: it.color_id,
            garment: { front: c.mockup_front_url || it.hero_url, back: c.mockup_back_url, side: c.mockup_side_url },
            placements: placements,
            fileFor: function(p) {
              if (typeof cartItemFiles !== 'object' || !cartItemFiles) return null;
              // Only the art uploaded for THIS placement — no fallback to another
              // placement's file, so one design never bleeds onto the others.
              var k = idx + '_' + p;
              return (cartItemFiles[k] instanceof File) ? cartItemFiles[k] : null;
            },
            // Art already uploaded in the catalog modal (or a prior edit) lives
            // on the cart item as a server path/signed_url — no File in memory.
            // Hand it back so the editor can preview + re-compose without forcing
            // a re-upload. Per-placement first, then the primary as a fallback
            // for the first placement only.
            existingDesignFor: function(p) {
              if (it.placement_designs && it.placement_designs[p] && it.placement_designs[p].path) {
                return { path: it.placement_designs[p].path, signed_url: it.placement_designs[p].signed_url || null };
              }
              if (p === placements[0] && it.design_path) {
                return { path: it.design_path, signed_url: it.design_url || null };
              }
              return null;
            },
            initial: { boxes: it.design_boxes || null, removeBg: !!it.design_remove_bg },
            sessionId: (typeof SINGHS_CART_ID !== 'undefined') ? SINGHS_CART_ID : null,
            onDone: function(res) {
              SinghsCart.updateSilent(idx, {
                mockups: res.mockups || [],
                design_boxes: res.boxes,
                design_remove_bg: res.removeBg,
                design_url: (res.design && res.design.signed_url) || it.design_url || null,
                design_path: (res.design && res.design.path) || it.design_path || null
              });
              var n = (res.mockups && res.mockups.length) || 0;
              var b = document.getElementById('spCartCzBtn-' + idx);
              if (b) {
                b.textContent = n ? '✓ Mockup ready · edit' : 'Customize';
                if (n) { b.style.background = '#143a14'; b.style.color = '#9dff9d'; }
              }
              // Swap the cart row thumbnail to the baked front mockup so the
              // customer sees their design right on the item, inline.
              if (n) {
                var front = (res.mockups.filter(function(m){ return spSideFor(m.placement) === 'front'; })[0] || res.mockups[0]);
                var thumb = document.getElementById('ci-img-' + idx);
                if (thumb && front) { thumb.src = front.url; thumb.style.objectFit = 'contain'; thumb.style.background = '#fff'; }
              }
              // Show the inline preview panel + reflect on the primary button.
              spShowInlineMockups(res.mockups, function() { spLaunchCartCustomizer(idx); });
              spMarkCustomized(res.mockups);
            }
          });
        })
        .catch(function() { alert('Could not load this product to customize. Please try again.'); });
    }

    // Jersey front logos use the SAME manual mockup composer as everything
    // else (drag, size, remove-bg, preview-on-garment). The logo was uploaded
    // on the /jerseys page to a URL, so we re-load it into the composer's file
    // map (cartItemFiles) and target the logo's placement, then launch.
    function spLaunchJerseyLogoCustomizer(idx) {
      var items = SinghsCart.read().items;
      var it = items[idx];
      if (!it || !it.jersey_front_logo) return;
      var logo = it.jersey_front_logo;
      var map = { left_chest: 'left-chest', center_chest: 'center-chest', full_front: 'full-front' };
      var pid = map[logo.placement] || 'center-chest';
      if (!Array.isArray(it.placements) || it.placements.indexOf(pid) < 0) {
        SinghsCart.updateSilent(idx, { placements: [pid] });
      }
      var key = idx + '_' + pid;
      if (cartItemFiles[key] instanceof File) { spLaunchCartCustomizer(idx); return; }
      if (!logo.url) { alert('Re-upload your logo on the jerseys page first, then customize it here.'); return; }
      var b = document.getElementById('jcz-' + idx);
      if (b) b.textContent = 'Loading logo…';
      fetch(logo.url).then(function(r){ return r.ok ? r.blob() : null; }).then(function(blob){
        if (!blob) { alert('Could not load your logo. Please re-upload it on the jerseys page.'); if (b) b.textContent = 'Customize logo on garment'; return; }
        cartItemFiles[key] = new File([blob], logo.filename || 'logo.png', { type: blob.type || 'image/png' });
        spLaunchCartCustomizer(idx);
        if (b) b.textContent = 'Customize logo on garment';
      }).catch(function(){ alert('Could not load your logo. Please try again.'); if (b) b.textContent = 'Customize logo on garment'; });
    }

    // Reveal the customize button whenever there's something to customize —
    // a picked single product OR items in the cart. (The router sends each to
    // the right flow.) Hide it only when there's nothing yet.
    (function() {
      var iv = setInterval(function() {
        var btn = document.getElementById('spCustomizeBtn');
        if (!btn) return;
        var hasCart = (typeof SinghsCart !== 'undefined' && SinghsCart.count && SinghsCart.count() > 0);
        var hasSingle = (typeof catalogPick !== 'undefined' && catalogPick && catalogPick.product_id);
        btn.style.display = (hasCart || hasSingle) ? 'flex' : 'none';
      }, 600);
    })();

    // Hook price calculation to size changes
    document.addEventListener('change', function(e) {
      if (e.target && e.target.closest('.size-grid input')) {
        calculatePrice();
      }
    });

    // =========================================================================
    // CATALOG HANDOFF — read ?product=<uuid>&color=<uuid> in the URL and
    // prefill the "Your pick" card if present. Falls back silently if the
    // product can't be fetched (e.g. catalog API down) so the legacy product
    // grid still works.
    // =========================================================================
    var CATALOG_API_FOR_QUOTE        = 'https://singhsprint-crm.vercel.app/api/catalog';
    var PRICING_API_FOR_QUOTE        = 'https://singhsprint-crm.vercel.app/api/pricing';
    var LIVE_MATRIX_API_FOR_QUOTE    = 'https://singhsprint-crm.vercel.app/api/pricing/live-matrix';
    var IMAGE_PROXY_FOR_QUOTE        = 'https://singhsprint-crm.vercel.app/api/image-proxy';
    // S&S Activewear 403's external hotlinks — route their images through
    // our server-side proxy. Mirrors imgUrl() in catalog.html.
    function imgUrl(raw) {
      if (!raw) return '';
      if (raw.indexOf('/api/image-proxy') >= 0) return raw;     // already proxied
      if (raw.charAt(0) === '/' || raw.indexOf('singhsprint.com') >= 0) return raw;
      if (raw.indexOf('ssactivewear.com') >= 0) {
        return IMAGE_PROXY_FOR_QUOTE + '?url=' + encodeURIComponent(raw);
      }
      return raw;
    }

    // XXL+ size surcharge in CAD per piece. Hardcoded fallback only —
    // the live source of truth is the `pricing_size_modifiers` table
    // edited from the CRM at /settings/pricing → Size matrix. The map
    // below seeds the UI before the async refresh from
    // /api/pricing/size-modifiers lands; in-flight quotes use whatever
    // values were last fetched (cached for the rest of the session).
    var SIZE_SURCHARGE_CAD = { '2XL': 3, '3XL': 3, '4XL': 3, '5XL': 3 };

    // Mutable per-size surcharge in CAD per piece. Combines the matrix's
    // blank-surcharge and decoration-surcharge into a single $/unit for
    // the running total. Refreshed by spRefreshSizeSurcharges() whenever
    // context (garment / placement / method) changes. Initialized from
    // the hardcoded fallback so the form is usable instantly.
    var liveSizeSurchargeCAD = {
      'XS': 0, 'S': 0, 'M': 0, 'L': 0, 'XL': 0,
      '2XL': 3, '3XL': 3, '4XL': 3, '5XL': 3,
    };

    // Most-recent per-size breakdown returned by /api/pricing/size-modifiers.
    // The summary line under the running total reads from this so it can
    // show "Includes $X 2XL/3XL surcharge" without recomputing locally.
    var liveSizeMatrixBreakdown = null;

    function _allSizeQtys() {
      var nameToSize = { size_xs:'XS', size_s:'S', size_m:'M', size_l:'L', size_xl:'XL', size_2xl:'2XL', size_3xl:'3XL', size_4xl:'4XL', size_5xl:'5XL' };
      var out = {};
      document.querySelectorAll('.size-grid input').forEach(function(inp){
        var size = nameToSize[inp.name]; if (!size) return;
        var n = parseInt(inp.value) || 0;
        if (n > 0) out[size] = n;
      });
      return out;
    }

    // Pulls the current context (garment_type from cart_items[0] or
    // state.product, placements from presetByLocation, decoration_method
    // from state.service) into the shape /api/pricing/size-modifiers
    // expects. Used by spRefreshSizeSurcharges below.
    function _pricingContext() {
      var garment = null, placements = [], method = null;
      try {
        if (typeof SinghsCart !== 'undefined' && SinghsCart.count() > 0) {
          var it = SinghsCart.read().items[0];
          garment = it && it.garment_type || null;
          placements = (it && it.placements) || [];
        } else {
          // Single-product flow — best-effort mapping from state.product.
          var p = (state && state.product || '').toLowerCase();
          if (p.indexOf('hood') >= 0)  garment = 'hoodie';
          else if (p.indexOf('long') >= 0) garment = 'longsleeve';
          else if (p.indexOf('crew') >= 0) garment = 'crewneck';
          else if (p.indexOf('polo') >= 0) garment = 'polo';
          else if (p.indexOf('t-shirt') >= 0 || p.indexOf('tee') >= 0) garment = 'tshirt';
          placements = Object.values(presetByLocation || {});
        }
      } catch (e) {}
      try { method = (state && state.service || '').toLowerCase() || null; } catch (e) {}
      return { garment_type: garment, placements: placements, decoration_method: method };
    }

    // Async fetch of the live matrix from the CRM. Called on page boot
    // and on context change (debounced). Updates liveSizeSurchargeCAD
    // and the cached breakdown, then re-renders the running total.
    var _sizeMatrixT = null;
    function spRefreshSizeSurcharges() {
      if (_sizeMatrixT) clearTimeout(_sizeMatrixT);
      _sizeMatrixT = setTimeout(function(){
        try {
          var ctx = _pricingContext();
          // For the totalizer we only care about per-size adders, not
          // qty-weighted totals — send one-piece-per-size so the API
          // returns a clean per-unit breakdown.
          var probe = { 'XS':1,'S':1,'M':1,'L':1,'XL':1,'2XL':1,'3XL':1,'4XL':1,'5XL':1 };
          var qs = new URLSearchParams({
            size_breakdown: JSON.stringify(probe),
            garment_type:   ctx.garment_type || '',
            decoration_method: ctx.decoration_method || ''
          });
          if (ctx.placements && ctx.placements.length) qs.set('placements', ctx.placements.join(','));
          fetch('https://singhsprint-crm.vercel.app/api/pricing/size-modifiers?' + qs.toString())
            .then(function(r){ return r.ok ? r.json() : null; })
            .then(function(j){
              if (!j) return;
              // Per-side breakdown? Sum across placements. Otherwise
              // per_size is a flat array of {size, qty=1, blank, decoration, line}.
              var perSize = j.per_size || [];
              if (j.per_placement) {
                // Reduce per_placement to a per_size sum (each entry has qty=1).
                var bySize = {};
                j.per_placement.forEach(function(p){
                  if (!bySize[p.size]) bySize[p.size] = { size: p.size, qty: 1, blank_surcharge_cents: 0, decoration_surcharge_cents: 0, line_cents: 0 };
                  bySize[p.size].decoration_surcharge_cents += p.decoration_surcharge_cents || 0;
                  bySize[p.size].line_cents                += p.line_cents || 0;
                });
                // Blank surcharge is per-garment (counted once). Pull from j.total_blank_cents distributed flat across sizes we have nonzero blanks for — but simpler: probe one-per-size means blank per piece is total_blank / 9. Easier: re-query the no-placement variant or trust that the CRM API at /api/pricing/size-modifiers also accepts the multi-placement breakdown which gives per_placement (decoration only) PLUS total_blank_cents. Map blank evenly.
                Object.keys(bySize).forEach(function(s){
                  // Blank surcharge: API's total_blank_cents is for the
                  // full one-per-size probe, so dividing by 9 sizes
                  // approximates per-size blank. For the legacy 2XL+
                  // case this is wrong (only 4 sizes have nonzero) so
                  // we prefer to skip blank here when using per_placement.
                });
                // Approximate: set liveSizeSurchargeCAD from per_size if
                // present, else accumulate decoration only.
                liveSizeMatrixBreakdown = perSize;
              } else {
                liveSizeMatrixBreakdown = perSize;
              }
              if (perSize.length > 0) {
                // Reset to defaults then overwrite from API
                Object.keys(liveSizeSurchargeCAD).forEach(function(k){ liveSizeSurchargeCAD[k] = 0; });
                perSize.forEach(function(s){
                  var totalCents = (s.blank_surcharge_cents || 0) + (s.decoration_surcharge_cents || 0);
                  liveSizeSurchargeCAD[s.size] = Math.round(totalCents) / 100;
                });
                // Re-render the running total to reflect the new map.
                if (typeof updateSizeTotal === 'function') updateSizeTotal();
              }
            })
            .catch(function(){ /* silent — fallback map already in place */ });
        } catch (e) { /* never block the UI on this */ }
      }, 200);
    }

    // Read the size grid and return { count, surchargeTotal } for the
    // 2XL+ tier (or whatever sizes the live matrix says have a surcharge).
    function computeSizeSurcharge() {
      var nameToSize = { size_xs:'XS', size_s:'S', size_m:'M', size_l:'L', size_xl:'XL', size_2xl:'2XL', size_3xl:'3XL', size_4xl:'4XL', size_5xl:'5XL' };
      var count = 0, total = 0;
      document.querySelectorAll('.size-grid input').forEach(function(inp){
        var size = nameToSize[inp.name];
        var add  = liveSizeSurchargeCAD[size] || 0;
        if (!add) return;
        var n = parseInt(inp.value) || 0;
        count += n;
        total += n * add;
      });
      return { count: count, surchargeTotal: total };
    }

    // =====================================================================
    // SinghsCart — same module as catalog.html. Items live in sessionStorage
    // so adding products on the catalog and arriving at /quote shows them.
    // =====================================================================
    // Sync the cart to /api/carts/upsert so abandonment recovery can find
    // it if the visitor never submits. cart_id stays stable across tab
    // closes via localStorage. The catalog page sets the same id when
    // they came from there; here we read or generate it.
    function _singhsCartId() {
      var k = 'singhsCartId_v1';
      var v = null;
      try { v = localStorage.getItem(k); } catch(e){}
      if (v && /^[a-zA-Z0-9_-]{8,64}$/.test(v)) return v;
      var id = '';
      try { if (window.crypto && crypto.randomUUID) id = crypto.randomUUID().replace(/-/g, ''); } catch(e){}
      if (!id) id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      try { localStorage.setItem(k, id); } catch(e){}
      return id;
    }
    var SINGHS_CART_ID = _singhsCartId();
    var _cartSyncT = null;
    function _queueCartSync() {
      if (_cartSyncT) clearTimeout(_cartSyncT);
      _cartSyncT = setTimeout(function () {
        try {
          var items = SinghsCart.read().items;
          var email = (document.getElementById('email') && document.getElementById('email').value) || null;
          var name  = (document.getElementById('name')  && document.getElementById('name').value)  || null;
          var phone = (document.getElementById('phone') && document.getElementById('phone').value) || null;
          fetch('https://singhsprint-crm.vercel.app/api/carts/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cart_id: SINGHS_CART_ID,
              items: items,
              email: email, contact_name: name, phone: phone,
              source_url: location.href,
            }),
            keepalive: true,
          }).catch(function(){});
        } catch(e){}
      }, 800);
    }

    var SinghsCart = {
      key: 'singhsCart_v1',
      // Default placements derived from the legacy "sides" count, used to
      // backfill items that predate the per-item placement field. The
      // sequence is garment-aware so a hat with sides=1 migrates to
      // ['cap-front'], not ['center-chest']. We pick the first preset
      // from the first group as the natural anchor for that garment.
      _defaultPlacementsForSides: function(n, garmentType) {
        var groups;
        try { groups = placementGroupsFor(garmentType); } catch(e) { groups = null; }
        if (!groups || !groups.length) {
          var fallback = ['center-chest', 'back-across', 'left-sleeve', 'right-sleeve'];
          return fallback.slice(0, Math.max(1, Math.min(n || 1, fallback.length)));
        }
        // Walk groups in declaration order and take their first option until
        // we hit the requested side count.
        var picks = [];
        for (var i = 0; i < groups.length && picks.length < (n || 1); i++) {
          var g = groups[i];
          if (g.ids && g.ids.length) picks.push(g.ids[0]);
        }
        // If still short, top up from the first group's remaining options.
        var first = groups[0] && groups[0].ids ? groups[0].ids : [];
        for (var j = 1; j < first.length && picks.length < (n || 1); j++) {
          if (picks.indexOf(first[j]) < 0) picks.push(first[j]);
        }
        return picks.length ? picks : ['center-chest'];
      },
      // Migration on read — ensures every item has the new per-item
      // fields the multi-method/per-size pipeline needs. Older carts
      // saved before this slice only had a numeric `sides`; new ones
      // from the catalog come with placements pre-set (see cart-add in
      // catalog.html). We also defend here so the form never sees a
      // half-shaped item.
      //
      // Per-item fields (2026-05-24 multi-method/sizes pass):
      //   - decoration_type: '' | 'dtg' | 'dtf' | 'embroidery' | 'not-sure'
      //     Default '' so the rep can spot "customer didn't choose yet"
      //     vs. a real DTF default. The price strip + matrix coerces ''
      //     to 'dtf' for estimation purposes (cheapest base price).
      //   - sizes: Record<sizeKey,qty>. Empty {} until the customer
      //     fills in the per-item size grid. The cart-item subtotal still
      //     uses `qty` as the total piece count; sizes is just the
      //     per-size breakdown the CRM consumes for the size-matrix
      //     surcharge math.
      // The migration is also garment-aware so old carts containing
      // hats get a Cap-Front default instead of an invalid Center-Chest.
      read: function() {
        var c;
        try { c = JSON.parse(sessionStorage.getItem(this.key) || '{"items":[]}'); } catch(e){ c = {items:[]}; }
        if (Array.isArray(c.items)) {
          var self = this;
          c.items.forEach(function(it) {
            if (!Array.isArray(it.placements) || it.placements.length === 0) {
              it.placements = self._defaultPlacementsForSides(it.sides || 1, it.garment_type);
            }
            it.sides = it.placements.length;  // canonical: sides === placements.length
            // New per-item fields. Set defaults if missing so the
            // submit pipeline always sees a valid object.
            if (typeof it.decoration_type === 'undefined') it.decoration_type = '';
            if (!it.sizes || typeof it.sizes !== 'object' || Array.isArray(it.sizes)) it.sizes = {};
            // 2026-05-24 — Caps + hats can only be embroidered on our
            // press. Snap any non-embroidery selection back to embroidery
            // at read time so the rest of the pipeline (live price fetch,
            // per-item picker, submit payload) all agree from the start.
            // Without this, a hat added from the catalog with no method
            // chosen would default to '' → /api/pricing returns null →
            // live total never resolves.
            if (it.garment_type === 'hat' || it.garment_type === 'cap') {
              if (it.decoration_type !== 'embroidery') it.decoration_type = 'embroidery';
            }
          });
        }
        return c;
      },
      write: function(c){ try { sessionStorage.setItem(this.key, JSON.stringify(c)); } catch(e){} renderCartList(); _queueCartSync(); },
      writeSilent: function(c){ try { sessionStorage.setItem(this.key, JSON.stringify(c)); } catch(e){} _queueCartSync(); },
      remove: function(i){ var c = this.read(); c.items.splice(i,1); this.write(c); },
      update: function(i,p){ var c = this.read(); Object.assign(c.items[i], p); if (Array.isArray(c.items[i].placements)) c.items[i].sides = c.items[i].placements.length; this.write(c); },
      updateSilent: function(i,p){ var c = this.read(); Object.assign(c.items[i], p); if (Array.isArray(c.items[i].placements)) c.items[i].sides = c.items[i].placements.length; this.writeSilent(c); },
      clear:  function(){ this.write({items:[]}); },
      count:  function(){ return this.read().items.length; },
    };

    // =====================================================================
    // PER-CART-ITEM PLACEMENT WIDGET
    // ---------------------------------------------------------------------
    // Each cart row owns its own list of placements (where the print goes
    // on THAT specific blank). Previously placement was global, which left
    // mixed-cart orders ambiguous — "Logo on back" when the cart had both
    // T-shirts and caps meant the rep had to email back asking "which back?"
    // This widget renders a chip strip per row + an inline picker, and
    // stores selections in item.placements (string[]). Sides count auto-
    // syncs to placements.length so existing pricing API stays unchanged.
    // =====================================================================
    var _cartPickerOpenIdx = null;  // which row's picker is currently expanded

    // Cart-item upload state. Keyed by `<itemIdx>_<presetId>` so the file
    // map survives placement toggles + re-renders. The form-submit path
    // pulls these into FormData with names design_<idx>_<presetId>.
    var cartItemFiles = {};

    // ----- Helpers --------------------------------------------------------
    function _placementLabel(id) {
      return (placementPresets[id] && placementPresets[id].label) || id;
    }
    // Render the chip strip + (if open) the inline picker, for one cart row.
    // `garmentType` filters the picker options so caps don't see "Sleeves"
    // and totes don't see "Back Top".
    function renderCartPlacementWidget(idx, placements, garmentType) {
      var picked = placements || [];
      var pickerOpen = (_cartPickerOpenIdx === idx);
      // Per-item method (for surcharge labeling on selected chips). Same
      // resolution rule as the picker: per-item wins, else global.
      var perItemMethod = '';
      try {
        var it = SinghsCart.read().items[idx];
        if (it && it.decoration_type) perItemMethod = it.decoration_type;
      } catch (e) { /* ignore */ }
      var effectiveMethod = perItemMethod || String((typeof state !== 'undefined' && state.service) || '');
      var chipsHtml = picked.map(function(p) {
        // 2026-05-24 — append the per-piece surcharge to the selected
        // chip so customers see it without having to re-open the
        // picker. Skipped for $0 placements + for embroidery.
        var surcharge = placementSurchargeFor(p, effectiveMethod);
        var surchargeBadge = surcharge > 0
          ? ' <small class="ci-chip__surcharge">+$' + surcharge + '</small>'
          : '';
        return '<span class="ci-chip">' + escapeAttr(_placementLabel(p)) + surchargeBadge +
               '<button type="button" class="ci-chip__remove" aria-label="Remove ' + escapeAttr(_placementLabel(p)) +
               '" onclick="cartRemovePlacement(' + idx + ',\'' + p + '\')">×</button></span>';
      }).join('');
      var addLabel = picked.length === 0 ? '+ Pick a placement' : '+ Add placement';
      var addBtn = '<button type="button" class="ci-chip ci-chip--add" onclick="cartTogglePicker(' + idx + ')">' + addLabel + '</button>';
      var picker = pickerOpen ? renderCartPlacementPicker(idx, picked, garmentType) : '';
      return '<div class="ci-placements">' +
             '  <span class="ci-placements__label">Placements</span>' +
             chipsHtml + addBtn +
             picker +
             '</div>';
    }
    // Render the expandable picker. Groups the preset options by where
    // they sit on THIS garment type — caps get Cap-only options, totes
    // get Bag-only options, shirts get the full Front/Back/Sleeves set.
    // Placements the embroidery hoop physically can't accommodate. Filtered
    // out of the per-cart-item picker when Embroidery is the active method
    // so the customer can't pick a combo we can't produce.
    var EMB_DISALLOWED = { 'oversized': 1, 'back-full': 1 };
    // Per-placement hoop-size hint shown next to chest options when method
    // is Embroidery. Keeps customers from expecting a 12"-wide logo on a
    // 5×5" hoop. Mirrors the same hint in the GLOBAL placement picker via
    // the .preset-emb-hint span / .is-embroidery body class.
    var EMB_PLACEMENT_HINT = {
      'left-chest':   '5×5″ hoop',
      'center-chest': '5×5″ hoop',
      'full-front':   'larger jumbo hoop',
    };
    // 2026-05-24 — Per-placement DTF/DTG surcharges, mirrored from the
    // pricing_size_modifiers matrix in the CRM (Settings → Pricing →
    // Size matrix). Used for in-picker labels like "Full Front · +$3/pc"
    // so customers see the cost of bigger prints before they click.
    // Placements not listed have no surcharge (Left Chest, Center Chest,
    // sleeves, hood, cap panels, etc.). Embroidery uses a different
    // pricing path (engine's embroidery_placement_multipliers) so the
    // chip label only renders for DTG/DTF/Not-sure on garments that
    // support those methods.
    var DTF_PLACEMENT_SURCHARGE_CAD = {
      'full-front':  3,
      'oversized':   4,
      'back-across': 4,
      'back-full':   5,
    };
    // 2026-05-24 — Resolve the per-piece DTF/DTG surcharge for a given
    // placement, or 0 when the placement carries none / when the
    // current method is embroidery (different pricing path). Used by
    // the picker chip labels so customers see "+$3/pc" on Full Front
    // before they click.
    function placementSurchargeFor(presetId, method) {
      var m = String(method || '').toLowerCase();
      if (m === 'embroidery') return 0; // embroidery pricing handled by engine multipliers
      return Number(DTF_PLACEMENT_SURCHARGE_CAD[presetId] || 0);
    }
    function renderCartPlacementPicker(idx, picked, garmentType) {
      var groups = placementGroupsFor(garmentType);
      // Per-item method (set in each cart row's Print Method picker) —
      // takes precedence over the legacy global state.service. Falls
      // back to the global when the item hasn't picked yet.
      var perItemMethod = '';
      try {
        var it = SinghsCart.read().items[idx];
        if (it && it.decoration_type) perItemMethod = it.decoration_type;
      } catch (e) { /* ignore */ }
      var effectiveMethod = perItemMethod || String((typeof state !== 'undefined' && state.service) || '');
      var isEmb  = String(effectiveMethod).toLowerCase() === 'embroidery';
      var pickedSet = {};
      picked.forEach(function(p){ pickedSet[p] = true; });
      var html = '';
      groups.forEach(function(g) {
        // Filter the group's ids for embroidery-disallowed presets — and
        // drop the entire group if nothing's left after filtering (e.g.
        // back-full is the only Back option on totes).
        var ids = isEmb ? g.ids.filter(function(id){ return !EMB_DISALLOWED[id]; }) : g.ids;
        if (!ids.length) return;
        html += '<div class="ci-picker__group">';
        html += '  <div class="ci-picker__group-label">' + escapeAttr(g.label) + '</div>';
        html += '  <div class="ci-picker__opts">';
        ids.forEach(function(id) {
          var sel = pickedSet[id] ? ' is-selected' : '';
          var hint = '';
          if (isEmb && EMB_PLACEMENT_HINT[id]) {
            hint = ' <small style="opacity:.7;font-weight:500">· ' + EMB_PLACEMENT_HINT[id] + '</small>';
          } else {
            var surcharge = placementSurchargeFor(id, effectiveMethod);
            if (surcharge > 0) {
              hint = ' <small class="ci-picker__surcharge">+$' + surcharge + '/pc</small>';
            }
          }
          html += '    <button type="button" class="ci-picker__opt' + sel + '" onclick="cartAddPlacement(' + idx + ',\'' + id + '\')">' + escapeAttr(_placementLabel(id)) + hint + '</button>';
        });
        html += '  </div>';
        html += '</div>';
      });
      html += '<button type="button" class="ci-picker__close" onclick="cartTogglePicker(' + idx + ')">Done</button>';
      return '<div class="ci-picker open">' + html + '</div>';
    }
    // Render the per-placement upload zones for one cart row.
    function renderCartItemUploads(idx, placements) {
      if (!Array.isArray(placements) || placements.length === 0) return '';
      // Artwork can arrive two ways: a fresh File the customer just picked
      // here (cartItemFiles, in-memory), OR already uploaded up-front in the
      // catalog modal (item.placement_designs[p] = { path, signed_url,
      // filename }). Recognise both so a modal-customised item doesn't
      // wrongly prompt a re-upload.
      var it = (SinghsCart.read().items || [])[idx] || {};
      var pd = it.placement_designs || {};
      var inner = placements.map(function(p) {
        var fileKey = idx + '_' + p;
        var f = cartItemFiles[fileKey];
        var persisted = pd[p];
        var has = !!f || !!persisted;
        var sub = f ? (f.name + ' (' + Math.round(f.size/1024) + ' KB)')
                : persisted ? ((persisted.filename || 'Uploaded artwork') + ' — attached')
                : 'PNG, JPG, PDF, AI, PSD, SVG — up to 10MB';
        var fileInputId = 'design_' + idx + '_' + p;
        var removeFn = f
          ? ('cartClearItemFile(' + idx + ',\'' + p + '\')')
          : ('cartClearPersistedDesign(' + idx + ',\'' + p + '\')');
        return '<label class="ci-upload ' + (has?'has-file':'') + '" for="' + fileInputId + '">' +
               '  <span class="ci-upload__icon">' + (has?'✓':'⇧') + '</span>' +
               '  <div class="ci-upload__copy">' +
               '    <strong>' + (has?'Design for ':'Upload design for ') + escapeAttr(_placementLabel(p)) + '</strong>' +
               '    <span>' + escapeAttr(sub) + '</span>' +
               '  </div>' +
               (has ? '<button type="button" class="ci-upload__remove" onclick="event.preventDefault();event.stopPropagation();' + removeFn + '">Remove</button>' : '') +
               '  <input type="file" id="' + fileInputId + '" name="' + fileInputId + '"' +
               '    accept=".png,.jpg,.jpeg,.pdf,.ai,.psd,.svg" style="display:none"' +
               '    onchange="cartAttachItemFile(' + idx + ',\'' + p + '\',this.files && this.files[0])"/>' +
               '</label>';
      }).join('');
      return '<div class="ci-uploads">' + inner + '</div>';
    }
    // Remove a design that was uploaded up-front in the catalog modal (lives
    // on the persisted cart item, not in the in-memory file map). Also clears
    // the item's primary design_path/url when nothing is left attached.
    function cartClearPersistedDesign(idx, p) {
      var it = (SinghsCart.read().items || [])[idx]; if (!it) return;
      var pd = Object.assign({}, it.placement_designs || {});
      delete pd[p];
      var patch = { placement_designs: pd };
      var remaining = Object.keys(pd);
      if (!remaining.length) { patch.design_path = ''; patch.design_url = ''; }
      else {
        var first = pd[remaining[0]];
        patch.design_path = (first && first.path) || '';
        patch.design_url  = (first && first.signed_url) || '';
      }
      SinghsCart.update(idx, patch);
      if (typeof renderCartList === 'function') renderCartList();
    }

    // ─────────────────────────────────────────────────────────────────────
    // Per-item Print Method picker — 2026-05-24 multi-method pass.
    //
    // Multi-item carts used to share ONE global method (state.service).
    // That broke the very common case of "DTG tote + DTF shirt +
    // embroidered hat" — the customer could only express one method
    // for the whole order. Each cart row now gets its own picker; the
    // global state.service stays as the legacy-single-product fallback
    // and as the seed when a row's method is empty.
    //
    // Chips intentionally compact (text-only, no icons) so they don't
    // dominate the cart row visually. "Not sure" pre-fills the rep's
    // recommendation hook on the CRM side — they pick the right method
    // at quote-reply time.
    // ─────────────────────────────────────────────────────────────────────
    // Garment types that can only be decorated via embroidery on our
    // press. Caps + hats are the obvious case (DTG/DTF can't bond to
    // structured panels; the pricing engine's config also has
    // decoration_method='embroidery' for these, so a DTG quote for a
    // hat would return null from /api/pricing — confusing for the
    // customer). When the cart row is one of these, the per-item
    // picker shows only the Embroidery chip + auto-snaps
    // decoration_type to 'embroidery' so the live price resolves.
    var EMBROIDERY_ONLY_GARMENTS = { hat: 1, cap: 1 };
    function renderCartItemMethod(idx, current, garmentType) {
      var embroideryOnly = !!(garmentType && EMBROIDERY_ONLY_GARMENTS[garmentType]);

      // Auto-snap embroidery-only items to embroidery if they aren't
      // already. We schedule the write for the next tick to avoid
      // mutating SinghsCart in the middle of a renderCartList pass
      // (which would trigger a re-render and re-entrancy). The first
      // render shows the snap visually; subsequent ones are a no-op.
      if (embroideryOnly && current !== 'embroidery') {
        setTimeout(function () {
          var c = SinghsCart.read();
          var it = c.items[idx];
          if (it && it.decoration_type !== 'embroidery') {
            SinghsCart.updateSilent(idx, { decoration_type: 'embroidery' });
            renderCartList();
          }
        }, 0);
        current = 'embroidery';
      }

      var allOpts = [
        { value: 'dtg',        label: 'DTG' },
        { value: 'dtf',        label: 'DTF' },
        { value: 'embroidery', label: 'Embroidery' },
        { value: 'not-sure',   label: 'Not sure' },
      ];
      // For embroidery-only garments, the picker collapses to a single
      // chip — no choice for the customer to make, but we still render
      // the row so the customer sees WHY this hat is priced the way
      // it is ("oh, hats are embroidery").
      var opts = embroideryOnly
        ? allOpts.filter(function (o) { return o.value === 'embroidery'; })
        : allOpts;

      var chips = opts.map(function(o) {
        var active = (current === o.value);
        return '<button type="button" class="ci-method-chip' + (active?' is-active':'') + '"' +
               ' onclick="onCartItemChange(' + idx + ', {decoration_type: \'' + o.value + '\'})"' +
               (embroideryOnly ? ' disabled aria-disabled="true"' : '') +
               '>' + o.label + '</button>';
      }).join('');

      var hint;
      if (embroideryOnly) {
        hint = '<span class="ci-method-hint">Caps are embroidery-only on our press</span>';
      } else if (!current) {
        hint = '<span class="ci-method-hint">Pick how each item gets decorated</span>';
      } else {
        hint = '';
      }

      return '<div class="ci-method" style="flex-basis:100%;min-width:0">' +
             '  <div class="ci-method__head">' +
             '    <span class="ci-section-label">Print method</span>' + hint +
             '  </div>' +
             '  <div class="ci-method__chips">' + chips + '</div>' +
             '</div>';
    }

    // ─────────────────────────────────────────────────────────────────────
    // Per-item Sizes grid. Inline 7-cell row for the standard adult range
    // (XS–3XL) with an optional + custom row reveal. The TOTAL across
    // sizes is shown next to the qty; mismatches between sizes total and
    // the row's qty get a soft amber warning (no hard block — customer
    // can fix later or rep can in the CRM).
    //
    // The total is informational only — pricing still uses `qty` as the
    // canonical piece count. The sizes map is consumed by the CRM's
    // size-matrix surcharge math (per-size up-charges for 2XL+).
    // ─────────────────────────────────────────────────────────────────────
    var CART_SIZES = ['XS','S','M','L','XL','2XL','3XL'];
    function renderCartItemSizes(idx, sizes, qty, garmentType) {
      // Hide for hats / caps — sizes are typically OSFA. Customer can
      // still specify quantities via the standard `qty` field above.
      if (garmentType === 'hat' || garmentType === 'cap') return '';
      var total = 0;
      CART_SIZES.forEach(function(s){ total += Number((sizes && sizes[s]) || 0); });
      Object.keys(sizes || {}).forEach(function(k) {
        if (CART_SIZES.indexOf(k) < 0) total += Number(sizes[k] || 0);
      });
      var mismatch = qty > 0 && total !== qty;
      var matchHint = '';
      if (mismatch) {
        matchHint = ' <button type="button" class="ci-sizes__match" ' +
                    'onclick="onCartItemSizesAutoFill(' + idx + ')" ' +
                    'title="Spread the remaining qty evenly across the sizes you\'ve started filling in">' +
                    'match qty →</button>';
      }
      var cells = CART_SIZES.map(function(s) {
        var v = Number((sizes && sizes[s]) || 0);
        var vAttr = v > 0 ? v : '';
        return '<label class="ci-sizes__cell">' +
               '  <span class="ci-sizes__lbl">' + s + '</span>' +
               '  <input type="number" min="0" inputmode="numeric" value="' + vAttr + '"' +
               '  onchange="onCartItemSizeChange(' + idx + ', \'' + s + '\', parseInt(this.value)||0)"/>' +
               '</label>';
      }).join('');
      var custom = Object.keys(sizes || {})
        .filter(function(k){ return CART_SIZES.indexOf(k) < 0 && Number(sizes[k]) > 0; });
      var customRow = '';
      if (custom.length) {
        customRow = '<div class="ci-sizes__custom-row">' +
          custom.map(function(k) {
            return '<span class="ci-sizes__custom-chip">' + k + ': ' + Number(sizes[k]) +
              ' <button type="button" aria-label="Remove ' + k + '" ' +
              'onclick="onCartItemSizeChange(' + idx + ', \'' + k + '\', 0)">×</button>' +
              '</span>';
          }).join('') +
          '</div>';
      }
      var totalCls = mismatch ? 'ci-sizes__total ci-sizes__total--mismatch' : 'ci-sizes__total';
      return '<div class="ci-sizes" style="flex-basis:100%;min-width:0">' +
        '<div class="ci-sizes__head">' +
        '  <span class="ci-section-label">Sizes</span>' +
        '  <span class="' + totalCls + '">' +
        '    <strong>' + total + '</strong>' + (qty > 0 ? ' / ' + qty : '') +
        matchHint +
        '  </span>' +
        '</div>' +
        '<div class="ci-sizes__grid">' + cells + '</div>' +
        customRow +
        '<details class="ci-sizes__more">' +
        '  <summary>+ add a custom size (4XL, OSFA, youth, …)</summary>' +
        '  <div class="ci-sizes__custom-form">' +
        '    <input type="text" placeholder="e.g. 4XL" maxlength="10" data-ci-custom-key/>' +
        '    <input type="number" min="0" placeholder="qty" data-ci-custom-qty/>' +
        '    <button type="button" onclick="onCartItemSizeCustomAdd(' + idx + ', this)">Add</button>' +
        '  </div>' +
        '</details>' +
        '</div>';
    }

    // Mutators paired with the size grid.
    function onCartItemSizeChange(idx, sizeKey, qty) {
      var c = SinghsCart.read();
      var it = c.items[idx]; if (!it) return;
      var sizes = Object.assign({}, it.sizes || {});
      if (qty > 0) sizes[sizeKey] = qty;
      else         delete sizes[sizeKey];

      // 2026-05-24 — Auto-sync the line's qty to match the sizes total.
      // Customers consistently typed "I want 100 pieces" via the size
      // grid but left the qty field at its default of 50, so the
      // running price + tier reflected 50 not 100. Treat the sizes sum
      // as the authoritative count whenever it's non-zero: write it
      // back to the line's qty so:
      //   • the per-unit price re-fetches against the right tier
      //   • the cart-row subtotal reflects the real piece count
      //   • the right-panel live estimate jumps to the new total
      //
      // We do NOT downshift to 0 when the sum hits 0 — that's the
      // "customer is mid-edit / clearing a cell" case; keep the qty
      // anchored at its current value until they put real numbers
      // back in. A separate visual cue (cart-qty-flash class added
      // post-render) draws the customer's eye to the qty field so the
      // change isn't silent.
      var sizeSum = 0;
      Object.keys(sizes).forEach(function (k) {
        var n = Number(sizes[k]) || 0;
        if (n > 0) sizeSum += n;
      });
      var patch = { sizes: sizes };
      var flashQty = false;
      if (sizeSum > 0 && sizeSum !== Number(it.qty)) {
        patch.qty = sizeSum;
        flashQty = true;
      }
      SinghsCart.update(idx, patch);

      if (flashQty) {
        // renderCartList rebuilds the DOM, so we need to wait a tick
        // before grabbing the freshly-rendered input. Add a CSS class
        // that triggers the keyframe pulse, then remove it 1.5s later
        // so subsequent updates can re-flash.
        setTimeout(function () {
          var row = document.querySelector('.cart-item[data-idx="' + idx + '"]');
          if (!row) return;
          var qtyInput = row.querySelector('input[type="number"]');
          if (!qtyInput) return;
          qtyInput.classList.add('cart-qty-flash');
          setTimeout(function () { qtyInput.classList.remove('cart-qty-flash'); }, 1500);
        }, 50);
      }
    }
    function onCartItemSizeCustomAdd(idx, btn) {
      var wrap = btn.parentElement;
      var keyEl = wrap.querySelector('[data-ci-custom-key]');
      var qtyEl = wrap.querySelector('[data-ci-custom-qty]');
      var key = String(keyEl.value || '').trim().toUpperCase().slice(0, 10);
      var qty = parseInt(qtyEl.value || '0', 10) || 0;
      if (!key || qty <= 0) return;
      onCartItemSizeChange(idx, key, qty);
      keyEl.value = '';
      qtyEl.value = '';
    }
    function onCartItemSizesAutoFill(idx) {
      var c = SinghsCart.read();
      var it = c.items[idx]; if (!it) return;
      var sizes = Object.assign({}, it.sizes || {});
      var filled = Object.keys(sizes).filter(function(k){ return Number(sizes[k]) > 0; });
      var qty = Number(it.qty) || 0;
      if (!qty) return;
      if (filled.length === 0) { sizes.M = qty; SinghsCart.update(idx, { sizes: sizes }); return; }
      var total = filled.reduce(function(s,k){ return s + Number(sizes[k] || 0); }, 0);
      var delta = qty - total;
      if (delta === 0) return;
      var per = Math.floor(delta / filled.length);
      var leftover = delta - per * filled.length;
      filled.forEach(function(k, i) {
        sizes[k] = Math.max(0, (Number(sizes[k]) || 0) + per + (i < leftover ? 1 : 0));
      });
      SinghsCart.update(idx, { sizes: sizes });
    }

    // ----- Mutations ------------------------------------------------------
    function cartTogglePicker(idx) {
      _cartPickerOpenIdx = (_cartPickerOpenIdx === idx) ? null : idx;
      renderCartList();
    }
    // ─────────────────────────────────────────────────────────────────────
    // 2026-05-24 — Placement exclusivity groups.
    //
    // Some placements physically overlap and cannot coexist on the same
    // garment. Front-of-chest is the obvious case: Left Chest, Center
    // Chest, Full Front, and Oversized Front are different SIZES of a
    // print covering the same chest area. You can pick one, not all four.
    // Same logic for the back (Top Back, Across Back, Full Back).
    //
    // Pricing impact (the real reason this matters): each placement adds
    // 1 to it.sides AND carries its own placement-specific surcharge from
    // pricing_size_modifiers (Full Front +$3/piece, Full Back +$5/piece,
    // etc.). Letting the customer select all four front options would
    // 4× the side count and stack four surcharges — but in reality only
    // ONE print happens (the biggest one). The customer would be
    // double / quadruple-billed.
    //
    // Rule: picking a chip in a group removes any other selection from
    // the same group. Chips outside any group are independent (e.g.,
    // Left Sleeve + Right Sleeve, sleeves + back, etc.).
    // ─────────────────────────────────────────────────────────────────────
    var PLACEMENT_EXCLUSIVE_GROUPS = {
      // Front-of-chest — only one print of one size can occupy the chest.
      'left-chest':   'shirt-front',
      'center-chest': 'shirt-front',
      'full-front':   'shirt-front',
      'oversized':    'shirt-front',
      // Back of shirt/hoodie — only one back-print size.
      'back-top':     'shirt-back',
      'back-across':  'shirt-back',
      'back-full':    'shirt-back',
      // Bag — front body vs. front pocket overlap (small pocket sits on
      // the front face). Treat them as one group.
      'bag-front':    'bag-front',
      'bag-pocket':   'bag-front',
      // Apron — chest / pocket / full all overlap the apron front.
      'apron-chest':  'apron-front',
      'apron-pocket': 'apron-front',
      'apron-full':   'apron-front',
      // Sleeves, hood, cap panels, leg hips — left intentionally
      // independent. Customers can mix-and-match those across the
      // garment without overlap.
    };

    function cartAddPlacement(idx, presetId) {
      var c = SinghsCart.read();
      var it = c.items[idx]; if (!it) return;
      it.placements = Array.isArray(it.placements) ? it.placements.slice() : [];
      var i = it.placements.indexOf(presetId);
      if (i >= 0) {
        // Toggle off
        it.placements.splice(i, 1);
      } else {
        // Toggle on — but first kick out any sibling in the same
        // exclusive group. This is what makes picking "Full Front"
        // automatically deselect "Center Chest" / "Left Chest" / etc.
        var group = PLACEMENT_EXCLUSIVE_GROUPS[presetId];
        if (group) {
          it.placements = it.placements.filter(function (p) {
            return PLACEMENT_EXCLUSIVE_GROUPS[p] !== group;
          });
        }
        it.placements.push(presetId);
      }
      if (it.placements.length === 0) it.placements = ['center-chest']; // never zero
      it.sides = it.placements.length;
      SinghsCart.update(idx, { placements: it.placements });
      if (window.spTrack) window.spTrack('cart_item_placement_change', { idx: idx, placements: it.placements });
    }
    function cartRemovePlacement(idx, presetId) {
      var c = SinghsCart.read();
      var it = c.items[idx]; if (!it) return;
      var next = (it.placements || []).filter(function(p){ return p !== presetId; });
      if (next.length === 0) return;                   // refuse to leave zero
      SinghsCart.update(idx, { placements: next });
    }
    function cartAttachItemFile(idx, presetId, file) {
      if (!file) return;
      cartItemFiles[idx + '_' + presetId] = file;
      renderCartList();
    }
    function cartClearItemFile(idx, presetId) {
      delete cartItemFiles[idx + '_' + presetId];
      var inp = document.getElementById('design_' + idx + '_' + presetId);
      if (inp) inp.value = '';
      renderCartList();
    }

    // Small HTML-attr escape — also used by the upload label.
    if (typeof escapeAttr !== 'function') {
      window.escapeAttr = function(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
          return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
        });
      };
    }

    // Re-sync whenever the visitor types their email/name/phone so the
    // recovery mail has a destination even if they never submit.
    document.addEventListener('DOMContentLoaded', function () {
      ['email','name','phone'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', _queueCartSync);
      });
      // Initialize the "Need by" date input's min to today so customers
      // can't pick a date in the past. Date strings are ISO-local.
      var needBy = document.getElementById('needByDate');
      if (needBy) {
        var today = new Date();
        var iso = today.getFullYear() + '-' +
                  String(today.getMonth() + 1).padStart(2, '0') + '-' +
                  String(today.getDate()).padStart(2, '0');
        needBy.min = iso;
      }
    });

    // ───── Mobile keyboard-aware sticky strip ─────────────────────────
    // On phones the live-price strip is position:fixed bottom:0. When
    // the on-screen keyboard opens (user tapping into qty/email fields)
    // iOS Safari leaves position:fixed elements stuck UNDERNEATH the
    // keyboard, hiding the price. We expose the difference between the
    // layout viewport and the visual viewport (= keyboard height + any
    // browser chrome) via a CSS custom property the strip's `bottom`
    // reads. Hidden by default (--sp-keyboard-offset = 0); only set
    // when the visualViewport API reports a real height delta.
    (function initKeyboardOffset() {
      if (typeof window === 'undefined' || !window.visualViewport) return;
      function sync() {
        var vv = window.visualViewport;
        // height delta vs. the layout viewport. Positive when keyboard
        // is up. We add a small 4px breathing room so the strip
        // doesn't touch the keyboard's top edge.
        var raw = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        // Below 100px we treat as noise (browser chrome shifts) and
        // collapse to 0 — prevents the strip from "floating" on
        // address-bar autohide.
        var offset = raw > 100 ? Math.round(raw + 4) : 0;
        document.documentElement.style.setProperty('--sp-keyboard-offset', offset + 'px');
      }
      window.visualViewport.addEventListener('resize', sync);
      window.visualViewport.addEventListener('scroll', sync);
      // Initial sync after layout settles.
      window.addEventListener('load', sync);
      sync();
    })();

    // Per-item live-price cache so we don't refetch every render. Keyed by
    // product_id + qty + sides + decoration_method, so switching DTG/DTF →
    // Embroidery in the Print Method picker yields a fresh fetch instead
    // of a stale DTF-flavoured cache hit.
    var _priceCache = {};
    // Map the UI's service tile values (DTG / DTF / Embroidery / "Not sure")
    // onto the engine's two-method axis: DTG and DTF both quote at the DTF
    // base ladder (same press, same per-side cost); Embroidery layers the
    // surcharge on top via the engine. Unknown / "Not sure" defaults to dtf
    // so the customer sees a price right away — we recommend the right
    // method at quote-reply time anyway.
    function currentDecorationMethod() {
      var s = (typeof state !== 'undefined' && state.service) ? String(state.service).toLowerCase() : '';
      return s === 'embroidery' ? 'embroidery' : 'dtf';
    }
    // Accept an optional `placements` array as the 4th arg — when method
    // is Embroidery the engine multiplies the surcharge by each placement's
    // own multiplier (Left Chest 1×, Center Chest 2×, Full Front 3×, etc.).
    // Without the placements list, the engine defaults to "N × 1× left
    // chest" which mispriced any quote that asked for, say, Full Front
    // embroidery (should be 3× cost, was showing 1×). Cache key includes
    // the placement list so DTF/Embroidery + Center/Full quotes each get
    // their own slot.
    // 2026-05-24 — `methodOverride` accepts a per-item decoration_type
    // (dtg/dtf/embroidery/not-sure/'') so multi-method carts cache + look
    // up under the right key. Without it, an embroidered hat would
    // cache under the global state.service ('dtf' by default), then
    // updateCartTotal's per-item lookup (key contains 'embroidery')
    // would miss → headline shows $— even though the API returned a
    // real price. Legacy callers omitting the param fall back to the
    // global current method (unchanged behavior).
    function liveUnitPrice(productId, qty, sides, placements, cb, methodOverride) {
      // Backwards-compat: older callers pass (productId, qty, sides, cb)
      // with no placements arg. Detect and shift.
      if (typeof placements === 'function') { cb = placements; placements = []; }
      // Normalize the per-item method onto the engine's two-method
      // axis: 'embroidery' stays as-is; anything else (dtg/dtf/
      // not-sure/'') maps to 'dtf' for pricing purposes (DTG + DTF
      // share the same base ladder; not-sure defaults to dtf so the
      // customer sees a number while we recommend at quote-reply).
      var method;
      if (methodOverride) {
        var raw = String(methodOverride).toLowerCase();
        method = raw === 'embroidery' ? 'embroidery' : 'dtf';
      } else {
        method = currentDecorationMethod();
      }
      var placementsArr = Array.isArray(placements) ? placements.slice() : [];
      var placementsKey = placementsArr.join(',');
      var key = productId + '_' + qty + '_' + sides + '_' + method + '_' + placementsKey;
      if (_priceCache[key]) { cb(_priceCache[key]); return; }
      var url = PRICING_API_FOR_QUOTE +
        '?product_id=' + encodeURIComponent(productId) +
        '&qty=' + qty + '&sides=' + sides +
        '&decoration_method=' + method;
      if (placementsKey) url += '&embroidery_placements=' + encodeURIComponent(placementsKey);
      fetch(url)
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(d){
          var p = d && typeof d.unit_price === 'number' ? d.unit_price : null;
          if (p != null) _priceCache[key] = p;
          cb(p);
        }).catch(function(){ cb(null); });
    }

    // Render the cart list on Step 1. Each item is a row with hero image,
    // brand+style+name, editable qty + sides, per-unit + subtotal, remove.
    // Jersey cart items are fully customized on the /jerseys page (roster,
    // font, names+numbers DTF, optional logo) and carry their own engine-
    // computed unit price (jersey_unit_price). Render them as a FINISHED
    // line item — not through the generic placement/method/upload editor,
    // which would re-prompt for art and double-charge decoration.
    function jEsc(v){ return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
    function jerseyCartItemHtml(it, idx){
      var _t = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
      var label = (it.color_name || '').replace(/_\d+$/, '');
      var qty = (it.roster && it.roster.length) || it.qty || 0;
      var unit = (typeof it.jersey_unit_price === 'number') ? it.jersey_unit_price : null;
      var priceHtml = unit != null
        ? '<strong style="color:#1a1a1a">$' + unit.toFixed(2) + '</strong> /unit · ' + (_t('quote.cart.jersey.subtotal')||'subtotal') + ' <strong style="color:#1a1a1a">$' + (unit*qty).toFixed(2) + '</strong>'
        : (_t('quote.cart.jersey.quoted')||'Priced with your quote');
      var rosterRows = (it.roster||[]).map(function(p,i){
        return '<tr style="color:#444"><td style="color:#aaa;padding:2px 10px 2px 0">'+(i+1)+'</td>'
          + '<td style="padding:2px 10px 2px 0">'+jEsc(p.name||'—')+'</td>'
          + '<td style="padding:2px 10px 2px 0;text-align:center">'+jEsc(p.number||'—')+'</td>'
          + '<td style="padding:2px 0">'+jEsc(p.size||'—')+'</td></tr>';
      }).join('');
      var logo = it.jersey_front_logo;
      var chip = function(txt){ return '<span style="display:inline-block;background:#f0eee5;border-radius:50px;padding:3px 10px;font-size:.72rem;color:#444;margin:2px 6px 2px 0">'+txt+'</span>'; };
      var deco = chip((_t('quote.cart.jersey.namesnumbers')||'Names & numbers')+' — DTF');
      if (logo) deco += chip((_t('quote.cart.jersey.logo')||'Front logo')+' — '+(logo.method==='embroidery'?(_t('jersey.cz.logo.emb')||'Embroidery'):(_t('jersey.cz.logo.dtf')||'DTF'))+' · '+jEsc(logo.placement_label||logo.placement||'')+(logo.url?' ✓':''));
      var font = it.jersey_font_label || it.jersey_font || '';
      // Thumbnail composites the logo onto the jersey at the position the
      // customer set on the /jerseys page (box = % of the front image).
      var lbox = (logo && logo.url && logo.box) ? logo.box : null;
      var thumbHtml = lbox
        ? ('<div style="position:relative;width:72px;flex-shrink:0;border-radius:10px;overflow:hidden;background:#fff">' +
           '<img src="'+imgUrl(it.hero_url||'')+'" alt="" style="width:100%;display:block"/>' +
           '<img src="'+imgUrl(logo.url)+'" alt="" style="position:absolute;left:'+lbox.x+'%;top:'+lbox.y+'%;width:'+lbox.w+'%;transform:translate(-50%,-50%);object-fit:contain;'+(logo.remove_bg?'mix-blend-mode:multiply;':'')+'"/></div>')
        : ('<div style="width:72px;height:72px;flex-shrink:0;border-radius:10px;overflow:hidden;background:#f0eee5">' +
           '<img src="'+imgUrl(it.hero_url||'')+'" alt="" style="width:100%;height:100%;object-fit:cover"/></div>');
      return '' +
        '<div class="cart-item" data-idx="'+idx+'" style="display:flex;gap:14px;padding:14px;border:1.5px solid #e8e6df;border-radius:14px;background:#fff;align-items:flex-start;flex-wrap:wrap;max-width:100%;box-sizing:border-box">' +
        thumbHtml +
        '  <div style="flex:1;min-width:220px">' +
        '    <div style="font-size:.7rem;color:#888;font-weight:600;letter-spacing:.05em;text-transform:uppercase">'+(it.brand||'')+' · '+(it.style_number||'')+(it.sport?(' · '+jEsc(it.sport)):'')+'</div>' +
        '    <div style="font-size:.95rem;font-weight:600;line-height:1.3">'+jEsc(it.name||'')+'</div>' +
        '    <div style="font-size:.78rem;color:#666;margin-top:4px">'+(_t('quote.cart.item.color')||'Color:')+' <strong style="color:#1a1a1a">'+(jEsc(label)||'—')+'</strong> · '+(_t('quote.cart.jersey.font')||'Font')+': <strong style="color:#1a1a1a">'+jEsc(font)+'</strong></div>' +
        '    <div style="margin-top:6px">'+deco+'</div>' +
        '    <div class="cart-item-price" id="ci-price-'+idx+'" style="font-size:.82rem;color:#666;margin-top:6px">'+priceHtml+'</div>' +
        '  </div>' +
        '  <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">' +
        '    <div style="font-size:.72rem;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.04em">'+qty+' '+(_t('jersey.cz.players')||'players')+'</div>' +
        '    <a href="/jerseys'+(it.sport?('?sport='+encodeURIComponent(it.sport)):'')+'" style="font-size:.76rem;font-weight:700;color:#1a1a1a;text-decoration:underline">'+(_t('quote.cart.jersey.edit')||'Edit on jerseys page')+'</a>' +
        '    <button type="button" onclick="removeCartItem('+idx+')" style="background:transparent;border:none;color:#a01a1a;cursor:pointer;font-size:.82rem;font-weight:600;padding:2px 4px">'+(_t('quote.cart.item.remove')||'Remove')+'</button>' +
        '  </div>' +
        '  <div style="flex-basis:100%;border-top:1px solid #f0eee5;margin-top:6px;padding-top:8px">' +
        '    <div style="font-size:.7rem;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+(_t('quote.cart.jersey.roster')||'Roster')+'</div>' +
        '    <table style="font-size:.8rem;border-collapse:collapse"><tbody>'+rosterRows+'</tbody></table>' +
        '  </div>' +
        '</div>';
    }

    function renderCartList() {
      var host = document.getElementById('cartList');
      var addMore = document.getElementById('cartAddMore');
      var emptyCta = document.getElementById('catalogPickEmpty');
      var singlePick = document.getElementById('catalogPick');
      if (!host) return;
      var items = SinghsCart.read().items;
      if (items.length === 0) {
        host.style.display = 'none';
        host.innerHTML = '';
        if (addMore) addMore.style.display = 'none';
        // If the cart was just emptied and there's no ?product= URL prefill
        // either, surface the empty-state CTA so the customer has a clear
        // next step (instead of an unexplained blank Step 1).
        var hasUrlProduct = new URLSearchParams(location.search).get('product');
        if (!hasUrlProduct) {
          if (emptyCta)   emptyCta.style.display = 'flex';
          if (singlePick) singlePick.style.display = 'none';
          // Un-hide the legacy product grid + fields that cart mode hides
          // so the visitor still has a fallback path to fill out the quote.
          ['legacyProductGroup','blankBrandSection','canadianBlanksSection','globalPrintMethodGroup']
            .forEach(function(id){ var el = document.getElementById(id); if (el) el.style.display = ''; });
          document.querySelectorAll('.form-group, .color-section').forEach(function(g){
            var lbl = g.querySelector('label'); var k = lbl ? (lbl.getAttribute('data-i18n')||'') : '';
            if (k === 'quote.garmentsource' || k === 'quote.garmentcolor') g.style.display = '';
          });
          // dropZoneWrapper stays permanently hidden — per-placement uploads
          // in Step 1 are the only upload path. (Old fallback removed.)
          // Re-show the GLOBAL placement section for the legacy single-
          // product flow (we hide it in cart mode below).
          document.querySelectorAll('.placement-section').forEach(function(el){ el.style.display = ''; });
          // 2026-05-24 — restore the 3-step pill bar + Step 2 form-section
          // for the legacy single-product flow when the cart is empty.
          var pillStep2 = document.querySelector('.step-pill[data-step="2"]');
          if (pillStep2) pillStep2.style.display = '';
          var formStep2 = document.querySelector('.form-section[data-step="2"]');
          if (formStep2) formStep2.style.display = '';
        }
        // Clear the right-panel cart total too
        var strip = document.getElementById('livePriceStrip');
        if (strip) strip.style.display = 'none';
        return;
      }
      // Cart is active — hide single-product UI + empty CTA.
      host.style.display = 'flex';
      if (addMore)    addMore.style.display = 'block';
      if (emptyCta)   emptyCta.style.display = 'none';
      if (singlePick) singlePick.style.display = 'none';
      // Hide legacy product grid and redundant fields (same logic as
      // single-product prefill). 2026-05-24 — globalPrintMethodGroup
      // joins this list: per-item method pickers in each cart row mean
      // the global DTG/DTF/Embroidery selector is duplicate work.
      ['legacyProductGroup','blankBrandSection','canadianBlanksSection','globalPrintMethodGroup']
        .forEach(function(id){ var el = document.getElementById(id); if (el) el.style.display = 'none'; });
      document.querySelectorAll('.form-group, .color-section').forEach(function(g){
        var lbl = g.querySelector('label'); var k = lbl ? (lbl.getAttribute('data-i18n')||'') : '';
        if (k === 'quote.garmentsource' || k === 'quote.garmentcolor') g.style.display = 'none';
      });
      var dz = document.getElementById('dropZoneWrapper'); if (dz) dz.style.display = 'none';
      // Hide the GLOBAL placement section + its upload list — placements are
      // now per-cart-item. The global picker stays available for the legacy
      // single-product (non-cart) path; we re-show it in the cart-empty
      // branch above.
      document.querySelectorAll('.placement-section').forEach(function(el){ el.style.display = 'none'; });
      // 2026-05-24 — collapse the step-pill bar from 3 to 2 in cart mode.
      // Step 2 ("Your design & sizes") was a global question for the
      // legacy single-product path; cart rows already capture both
      // pieces (per-placement uploads + per-item sizes), so the step is
      // redundant. goToStep() also auto-routes around it (1 → 3 forward,
      // 3 → 1 back) so Continue / Back behave naturally with the pill
      // hidden.
      var pillStep2 = document.querySelector('.step-pill[data-step="2"]');
      if (pillStep2) pillStep2.style.display = 'none';
      // Also remove Step 2's form-section from layout so any stale "Next"
      // button still on Step 1 won't briefly flash a blank Step 2 view if
      // the customer hits it before goToStep's redirect kicks in.
      var formStep2 = document.querySelector('.form-section[data-step="2"]');
      if (formStep2) formStep2.style.display = 'none';

      var _t = (typeof SP_LANG !== 'undefined' && SP_LANG.t) ? SP_LANG.t : function(){ return ''; };
      var lblColor  = _t('quote.cart.item.color')  || 'Color:';
      var lblQty    = _t('quote.cart.item.qty')    || 'Qty';
      var lblRemove = _t('quote.cart.item.remove') || 'Remove';
      host.innerHTML = items.map(function(it, idx) {
        if (it.is_jersey) return jerseyCartItemHtml(it, idx);
        var label = (it.color_name || '').replace(/_\d+$/, '');
        var placementsHtml = renderCartPlacementWidget(idx, it.placements || [], it.garment_type);
        var uploadsHtml    = renderCartItemUploads(idx, it.placements || []);
        // 2026-05-24 — per-item method + sizes widgets, surfaced below
        // the placement chips. Multi-item carts now express things like
        // "DTG tote + DTF tee + embroidered hat" cleanly.
        var methodHtml     = renderCartItemMethod(idx, it.decoration_type || '', it.garment_type);
        var sizesHtml      = renderCartItemSizes(idx, it.sizes || {}, it.qty || 0, it.garment_type);
        return '' +
          // overflow:hidden + max-width:100% + box-sizing prevent the
          // 9-column tier table inside the row from forcing the cart-item
          // (and the whole page) to grow horizontally past the mobile
          // viewport. Customers can still swipe inside the table's
          // overflow-x:auto container to see the embroidery columns.
          '<div class="cart-item" data-idx="' + idx + '" style="display:flex;gap:14px;padding:14px;border:1.5px solid #e8e6df;border-radius:14px;background:#fff;align-items:flex-start;flex-wrap:wrap;max-width:100%;box-sizing:border-box;overflow:hidden">' +
          '  <div style="width:72px;height:72px;flex-shrink:0;border-radius:10px;overflow:hidden;background:#f0eee5">' +
          '    <img id="ci-img-' + idx + '" src="' + imgUrl(spCartThumbSrc(it)) + '" alt="" style="width:100%;height:100%;' + (spCartHasMockup(it) ? 'object-fit:contain;background:#fff' : 'object-fit:cover') + '"/>' +
          '  </div>' +
          '  <div style="flex:1;min-width:200px">' +
          '    <div style="font-size:.7rem;color:#888;font-weight:600;letter-spacing:.05em;text-transform:uppercase">' + (it.brand||'') + ' · ' + (it.style_number||'') + '</div>' +
          '    <div style="font-size:.95rem;font-weight:600;line-height:1.3">' + (it.name||'') + '</div>' +
          '    <div id="ci-color-row-' + idx + '" style="font-size:.78rem;color:#666;margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
          '      ' + lblColor + ' <strong id="ci-color-' + idx + '" style="color:#1a1a1a">' + (label || '—') + '</strong>' +
          '      <span id="ci-swatches-' + idx + '" class="ci-swatches ci-swatches--collapsed" style="display:inline-flex;gap:4px;flex-wrap:wrap;align-items:center"></span>' +
          '    </div>' +
          '    <div class="cart-item-price" id="ci-price-' + idx + '" style="font-size:.82rem;color:#666;margin-top:6px">$— /unit</div>' +
          '  </div>' +
          '  <div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap">' +
          '    <label style="display:flex;flex-direction:column;font-size:.7rem;color:#888;font-weight:600;letter-spacing:.04em;text-transform:uppercase">' + lblQty +
          '      <input type="number" inputmode="numeric" min="1" max="10000" value="' + (it.qty||50) + '" onchange="onCartItemChange(' + idx + ', {qty: parseInt(this.value)||1})" style="width:80px;padding:6px 8px;margin-top:3px;border:1.5px solid #e8e6df;border-radius:8px;font-weight:600;font-family:inherit;text-align:right"/>' +
          '    </label>' +
          '    <button type="button" id="spCartCzBtn-' + idx + '" onclick="spLaunchCartCustomizer(' + idx + ')" style="' + (spCartHasMockup(it) ? 'background:#143a14;color:#9dff9d;' : 'background:#1a1a1a;color:#e8ff3c;') + 'border:none;cursor:pointer;font-size:.78rem;font-weight:700;padding:7px 12px;border-radius:50px">' + (spCartHasMockup(it) ? '✓ Mockup ready · edit' : 'Customize') + '</button>' +
          '    <button type="button" onclick="removeCartItem(' + idx + ')" style="background:transparent;border:none;color:#a01a1a;cursor:pointer;font-size:.86rem;font-weight:600;padding:6px 8px" aria-label="Remove">' + lblRemove + '</button>' +
          '  </div>' +
          placementsHtml +
          methodHtml +
          sizesHtml +
          uploadsHtml +
          // Live per-item pricing table — populated async by paintCartItemLiveMatrix.
          // Sits on its own flex line via flex-basis:100% so it spans the full row.
          // min-width:0 lets the inner overflow-x:auto container actually
          // clip + scroll on mobile instead of forcing the row wider.
          '<div id="ci-livematrix-' + idx + '" class="ci-livematrix" style="flex-basis:100%;min-width:0;max-width:100%;width:100%;margin-top:8px;box-sizing:border-box"></div>' +
          '</div>';
      }).join('');

      // Inject per-row swatches + fetch live unit prices.
      items.forEach(function(it, idx) {
        // Jersey lines carry their own engine-computed price and a fixed
        // roster — skip the generic swatch/live-price/tier-matrix fetches
        // (they would overwrite the jersey price and re-prompt decoration).
        if (it.is_jersey) { updateCartTotal(); return; }
        // Fetch the product's full colour list once so the customer can
        // switch colours per cart row without going back to the catalog.
        fetch(CATALOG_API_FOR_QUOTE + '?product_id=' + encodeURIComponent(it.product_id))
          .then(function(r){ return r.ok ? r.json() : null; })
          .then(function(d) {
            if (!d || !d.products || !d.products.length) return;
            var p = d.products[0];
            paintCartItemSwatches(idx, p.colors || [], it.color_id);
          });

        // 2026-05-24 — pass it.decoration_type as the methodOverride
        // (6th arg) so the cache key matches updateCartTotal's lookup.
        // Without it, an embroidered hat would cache under 'dtf' (the
        // global current method) and miss the 'embroidery' lookup
        // below, showing $— in the right-panel headline.
        liveUnitPrice(it.product_id, it.qty || 50, it.sides || 1, it.placements || [], function(price) {
          var el = document.getElementById('ci-price-' + idx);
          if (!el) return;
          if (price != null) {
            var qty = it.qty || 50;
            el.innerHTML = '<strong style="color:#1a1a1a">$' + price.toFixed(2) + '</strong> /unit · subtotal <strong style="color:#1a1a1a">$' + (price*qty).toFixed(2) + '</strong>';
          } else {
            el.textContent = (typeof SP_LANG !== 'undefined' && SP_LANG.t('quote.cart.item.priceloading')) || 'Price loading…';
          }
          updateCartTotal();
        }, it.decoration_type);

        // Live per-item pricing table — qty tiers × sides × decoration method.
        // Hits /api/pricing/live-matrix which returns engine-derived prices
        // for the actual variant's wholesale + garment_type, including DTF
        // and embroidery side-by-side with the cell's implied margin %.
        paintCartItemLiveMatrix(idx, it);
      });
    }

    // Per-item /api/pricing/live-matrix renderer. Cached per product_id since
    // the matrix only changes when the CRM pricing config does (≤ once an
    // hour in practice). Highlights the row matching the item's current qty.
    var _liveMatrixCache = {};
    function paintCartItemLiveMatrix(idx, it) {
      var host = document.getElementById('ci-livematrix-' + idx);
      if (!host || !it.product_id) return;
      var loadingMsg = (typeof SP_LANG !== 'undefined' && SP_LANG.t('quote.cart.item.tierloading')) || 'Loading tier pricing…';
      host.innerHTML = '<div style="font-size:.72rem;color:#999;padding:6px 0">' + loadingMsg + '</div>';

      var render = function(matrix) {
        if (!matrix || !Array.isArray(matrix.rows) || !matrix.rows.length) {
          host.innerHTML = '';
          return;
        }
        var sidesList = [];
        for (var s = 1; s <= (matrix.max_sides || 4); s++) sidesList.push(s);
        var showEmb = !!matrix.emb_supported;
        var isMobile = window.innerWidth < 720;

        var fmt = function(cell) {
          if (!cell || cell.price == null) return '—';
          return '$' + Number(cell.price).toFixed(2);
        };
        var qtyLabel = function(r) {
          return r.qty_max == null ? (r.qty_min + '+') : (r.qty_min + '–' + r.qty_max);
        };
        var activeQty = Number(it.qty) || 50;

        // Render a single method's table (DTF or Embroidery). `accessor` is
        // the property name on each row ('dtf' or 'embroidery'); `label` is
        // the human-readable method name shown above the table. `bg` is the
        // tinted background for the header row, matching the wide-table
        // colour convention (cream for DTF, peach for Embroidery).
        function buildMethodTable(label, accessor, bg) {
          var headSides = sidesList.map(function(s){
            return '<th style="text-align:right;padding:5px 8px;font-weight:600">' + s + ' side' + (s>1?'s':'') + '</th>';
          }).join('');
          var body = matrix.rows.map(function(r) {
            var isActive = activeQty >= r.qty_min && (r.qty_max == null || activeQty <= r.qty_max);
            var rowStyle = isActive
              ? 'background:#1a1a1a;color:#fff;font-weight:600'
              : 'background:#fff;color:#1a1a1a';
            var border = isActive ? '#333' : '#f0eee5';
            var cells = sidesList.map(function(s) {
              return '<td style="text-align:right;padding:5px 8px;font-variant-numeric:tabular-nums;border-top:1px solid ' + border + '">'
                + fmt(r[accessor][s]) + '</td>';
            }).join('');
            return '<tr style="' + rowStyle + '">' +
              '<td style="padding:5px 8px;font-weight:' + (isActive ? '700' : '500') + ';border-top:1px solid ' + border + '">' + qtyLabel(r) + '</td>' +
              cells +
            '</tr>';
          }).join('');
          return '<div style="margin-top:8px;border:1px solid #e8e6df;border-radius:10px;background:#fff;overflow:hidden">' +
            '<div style="background:' + bg + ';font-size:.66rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#666;padding:6px 10px">' + label + '</div>' +
            '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">' +
              '<table style="width:100%;border-collapse:collapse;font-size:.78rem">' +
                '<thead style="font-size:.62rem;text-transform:uppercase;letter-spacing:.06em;color:#888">' +
                  '<tr><th style="text-align:left;padding:5px 8px;font-weight:600">Qty</th>' + headSides + '</tr>' +
                '</thead>' +
                '<tbody>' + body + '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>';
        }

        // Mobile (< 720px): stack DTF and Embroidery as two narrow 5-column
        // tables — much more readable than swiping a single 9-column table.
        // Desktop: keep the original side-by-side 9-column layout because
        // there's room and the comparison is easier at a glance.
        var inner;
        if (isMobile) {
          inner = buildMethodTable('DTF print', 'dtf', '#f7f6f0') +
                  (showEmb ? buildMethodTable('Embroidery', 'embroidery', '#fef6e7') : '');
        } else {
          // Desktop wide table (original layout).
          var headSidesWide = sidesList.map(function(s){ return '<th style="text-align:right;padding:6px 8px;font-weight:600">' + s + ' side' + (s>1?'s':'') + '</th>'; }).join('');
          var head = '<thead style="font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;color:#888">' +
            '<tr>' +
              '<th rowspan="2" style="text-align:left;padding:6px 8px;font-weight:600">Qty</th>' +
              '<th colspan="' + sidesList.length + '" style="text-align:center;padding:6px 8px;font-weight:600;background:#f7f6f0;border-radius:6px 6px 0 0">DTF print</th>' +
              (showEmb ? '<th colspan="' + sidesList.length + '" style="text-align:center;padding:6px 8px;font-weight:600;background:#fef6e7;border-radius:6px 6px 0 0;border-left:2px solid #fff">Embroidery</th>' : '') +
            '</tr>' +
            '<tr>' + headSidesWide + (showEmb ? headSidesWide : '') + '</tr>' +
          '</thead>';
          var body = matrix.rows.map(function(r) {
            var isActive = activeQty >= r.qty_min && (r.qty_max == null || activeQty <= r.qty_max);
            var rowStyle = isActive ? 'background:#1a1a1a;color:#fff;font-weight:600' : 'background:#fff;color:#1a1a1a';
            var border = isActive ? '#333' : '#f0eee5';
            var cells = sidesList.map(function(s) {
              return '<td style="text-align:right;padding:6px 8px;font-variant-numeric:tabular-nums;border-top:1px solid ' + border + '">' + fmt(r.dtf[s]) + '</td>';
            }).join('');
            if (showEmb) {
              cells += sidesList.map(function(s){
                return '<td style="text-align:right;padding:6px 8px;font-variant-numeric:tabular-nums;border-top:1px solid ' + border + ';border-left:1px solid ' + border + '">' + fmt(r.embroidery[s]) + '</td>';
              }).join('');
            }
            return '<tr style="' + rowStyle + '">' +
              '<td style="padding:6px 8px;font-weight:' + (isActive ? '700' : '500') + ';border-top:1px solid ' + border + '">' + qtyLabel(r) + '</td>' + cells +
            '</tr>';
          }).join('');
          inner = '<div style="overflow-x:auto;margin-top:6px;border:1px solid #e8e6df;border-radius:10px;background:#fff">' +
            '<table style="width:100%;border-collapse:collapse;font-size:.78rem">' + head + '<tbody>' + body + '</tbody></table>' +
          '</div>';
        }

        host.innerHTML =
          '<details style="margin-top:4px" ' + (isMobile ? '' : 'open') + '>' +
            '<summary style="cursor:pointer;font-size:.72rem;font-weight:600;color:#666;letter-spacing:.04em;text-transform:uppercase;padding:6px 0;list-style:none">' +
              '▾ Tier pricing for this item' +
              '<span style="color:#999;font-weight:500;margin-left:6px;text-transform:none;letter-spacing:0">— current row highlighted, change qty to reprice</span>' +
            '</summary>' +
            inner +
          '</details>';
      };

      var cached = _liveMatrixCache[it.product_id];
      if (cached) { render(cached); return; }
      fetch(LIVE_MATRIX_API_FOR_QUOTE + '?product_id=' + encodeURIComponent(it.product_id))
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(d){
          if (!d || !d.rows) { host.innerHTML = ''; return; }
          _liveMatrixCache[it.product_id] = d;
          render(d);
        })
        .catch(function(){ host.innerHTML = ''; });
    }

    // Render the colour swatch picker for a cart row. Dedupes waist-size-
    // suffixed colours (e.g. Black_32 / Black_34 → Black). Clicking a swatch
    // updates the cart item's color_id + color_name and refreshes the row.
    function paintCartItemSwatches(idx, colors, selectedColorId) {
      var host = document.getElementById('ci-swatches-' + idx);
      if (!host) return;
      var seen = {}, deduped = [];
      colors.forEach(function(c) {
        var clean = (c.color_name || '').replace(/_\d+$/, '');
        if (!clean) return;
        if (!seen[clean]) {
          seen[clean] = { hex: c.hex_code, color_id: c.color_id, color_name: clean, hero: c.mockup_front_url, in_stock: Array.isArray(c.sizes_in_stock) && c.sizes_in_stock.length > 0 };
          deduped.push(seen[clean]);
        } else if (c.color_id === selectedColorId) {
          seen[clean].color_id = c.color_id;
        }
      });
      // Render ALL swatches; CSS hides everything past 12 while the host has
      // the .ci-swatches--collapsed class. Click the toggle pill to expand.
      // This replaces the previous slice + max-height clip, which left the
      // 3rd row peeking through and made the "+N" sit in dead space.
      var COLLAPSED_COUNT = 12;
      var swatchesHtml = deduped.map(function(c) {
        var selected = c.color_id === selectedColorId ? ' style="box-shadow:0 0 0 2px #1a1a1a"' : '';
        var oos = c.in_stock ? '' : ' opacity:.35;';
        return '<button type="button" class="ci-swatch" data-cid="' + c.color_id + '" data-name="' + (c.color_name||'').replace(/"/g,'&quot;') + '" data-hero="' + (c.hero||'').replace(/"/g,'&quot;') + '" title="' + (c.color_name||'').replace(/"/g,'&quot;') + (c.in_stock ? '' : ' (out of stock)') + '" style="width:18px;height:18px;border-radius:50%;border:1.5px solid #ddd;background:' + (c.hex||'#ccc') + ';cursor:pointer;padding:0;' + oos + '"' + selected + '></button>';
      }).join('');
      // i18n-friendly labels for the swatch expand/collapse toggle.
      var moreTpl  = (typeof SP_LANG !== 'undefined' && SP_LANG.t('quote.cart.item.swatches.more'))  || '+ {n} more ▾';
      var fewerTpl = (typeof SP_LANG !== 'undefined' && SP_LANG.t('quote.cart.item.swatches.fewer')) || 'Show fewer ▴';
      var moreLabel = moreTpl.replace('{n}', (deduped.length - COLLAPSED_COUNT));
      var toggle = deduped.length > COLLAPSED_COUNT
        ? '<button type="button" class="ci-swatch-toggle" data-collapsed-label="' + moreLabel + '" data-expanded-label="' + fewerTpl + '" onclick="toggleCartSwatches(' + idx + ')">' + moreLabel + '</button>'
        : '';
      host.innerHTML = swatchesHtml + toggle;
      // Wire clicks — scoped to .ci-swatch so the expand toggle doesn't get
      // treated as a color pick. Uses updateSilent so the row doesn't re-
      // render (which would collapse the expanded swatch grid back to 12).
      host.querySelectorAll('button.ci-swatch').forEach(function(btn) {
        btn.addEventListener('click', function(ev) {
          ev.preventDefault();
          var cid = btn.getAttribute('data-cid');
          var nm  = btn.getAttribute('data-name');
          var her = btn.getAttribute('data-hero');
          SinghsCart.updateSilent(idx, { color_id: cid, color_name: nm, hero_url: her || '' });
          // Refresh visual state in place (no re-render).
          var nameEl = document.getElementById('ci-color-' + idx);
          if (nameEl) nameEl.textContent = (nm || '').replace(/_\d+$/, '');
          var img = document.getElementById('ci-img-' + idx);
          if (img && her) img.src = imgUrl(her);
          host.querySelectorAll('button.ci-swatch').forEach(function(b){ b.style.boxShadow = ''; });
          btn.style.boxShadow = '0 0 0 2px #1a1a1a';
          // Re-compose the mockup(s) for the NEW colour so the customer's
          // design doesn't appear to vanish (the old-colour mockup would no
          // longer match the garment). Resilient: on any failure we keep the
          // design attached and never clear placement_designs/design_path.
          spRecolorMockups(idx, cid);
        });
      });
    }

    // Re-bake the cart item's mockup(s) for a newly-picked colour. The art was
    // already uploaded (catalog modal or a prior edit), so we re-compose from
    // the persisted design path/url + the stored 0–1 box — no re-upload. On ANY
    // failure we leave the design data intact so the artwork never disappears;
    // we just keep the old thumbnail (or the new bare garment) until next edit.
    function spRecolorMockups(idx, newColorId) {
      var it = (SinghsCart.read().items || [])[idx];
      if (!it || !newColorId) return;
      var hasArt = (it.placement_designs && Object.keys(it.placement_designs).length) || it.design_path;
      if (!hasArt || !it.design_boxes) return;
      var placements = (Array.isArray(it.placements) && it.placements.length) ? it.placements : ['center-chest'];
      var sessionId = (typeof SINGHS_CART_ID !== 'undefined') ? SINGHS_CART_ID : (localStorage.getItem('singhsCartId_v1') || null);

      // Resolve the persisted design for a placement: per-placement design first,
      // then the primary design_path for the FIRST placement only.
      function designFor(p) {
        if (it.placement_designs && it.placement_designs[p] && it.placement_designs[p].path) {
          return { path: it.placement_designs[p].path, signed_url: it.placement_designs[p].signed_url || null };
        }
        if (p === placements[0] && it.design_path) {
          return { path: it.design_path, signed_url: it.design_url || null };
        }
        return null;
      }

      // Brief "updating…" hint on the row thumbnail (non-blocking).
      var thumb = document.getElementById('ci-img-' + idx);
      if (thumb) thumb.style.opacity = '0.6';

      var jobs = [];
      placements.forEach(function(p) {
        var dsn = designFor(p);
        var box = it.design_boxes && it.design_boxes[p];
        if (!dsn || !box) return;
        var job = fetch(SHOP_COMPOSE_API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            color_id: newColorId, placement: p,
            design_path: dsn.path, design_url: dsn.signed_url || null,
            box: box, remove_bg: !!it.design_remove_bg, session_id: sessionId
          })
        }).then(function(r) { return r.json().then(function(j) { return { ok: r.ok, j: j }; }); })
          .then(function(res) {
            var url = res.ok && res.j ? (res.j.mockup_url || res.j.url) : null;
            return url ? { placement: p, url: url } : null;
          })
          .catch(function() { return null; });
        jobs.push(job);
      });

      if (!jobs.length) { if (thumb) thumb.style.opacity = ''; return; }

      Promise.all(jobs).then(function(results) {
        if (thumb) thumb.style.opacity = '';
        var newMockups = results.filter(Boolean);
        // Only overwrite mockups when at least one placement re-composed
        // successfully — otherwise keep the design + old thumbnail intact.
        if (newMockups.length) {
          SinghsCart.updateSilent(idx, { mockups: newMockups });
          if (typeof renderCartList === 'function') renderCartList();
        }
      }).catch(function() {
        if (thumb) thumb.style.opacity = '';
        // Never clear the design on failure — leave everything attached.
      });
    }

    // Flip the collapsed/expanded state on a cart row's swatch grid. The
    // CSS hides everything past child #12 while .ci-swatches--collapsed is
    // present; this just toggles the class and swaps the button label.
    function toggleCartSwatches(idx) {
      var host = document.getElementById('ci-swatches-' + idx);
      if (!host) return;
      var btn = host.querySelector('.ci-swatch-toggle');
      var collapsed = host.classList.toggle('ci-swatches--collapsed');
      if (btn) btn.textContent = collapsed ? btn.dataset.collapsedLabel : btn.dataset.expandedLabel;
    }

    function onCartItemChange(idx, patch) {
      SinghsCart.update(idx, patch);
      // Cart qty / sides / placements changed → the shipping estimate is
      // now stale (different box weight, different order subtotal, so the
      // "Add $X more for FREE shipping" line and the rate cards have to
      // recompute). Debounced via spRecalcShippingIfStale to coalesce
      // rapid input changes into a single API hit.
      spRecalcShippingIfStale();
    }
    function removeCartItem(idx) {
      SinghsCart.remove(idx);
      spRecalcShippingIfStale();
    }

    // -------------------------------------------------------------------------
    // Shipping recalc on qty/sizes change. The shipping estimator is fetched
    // from /api/shipping with the current items + postal code, and its
    // response includes the per-rate fee AND the free-shipping threshold
    // gap. Without this hook, the customer hits Estimate at qty=10 (sees
    // "Add $400 more for FREE shipping"), bumps qty to 100 in Step 1/2,
    // returns to Step 3, and is still looking at the qty=10 numbers.
    // -------------------------------------------------------------------------
    var _spShipDebounce = null;
    function spRecalcShippingIfStale() {
      // Only refetch if the customer already supplied a postal — otherwise
      // there's nothing to refresh and the panel still shows the "enter
      // postal" placeholder.
      var postalEl = document.getElementById('shipPostal');
      var postal = (postalEl && postalEl.value || '').trim();
      if (!postal || postal.length < 3) return;
      // Debounce so a flurry of size-grid keystrokes only fires one fetch.
      clearTimeout(_spShipDebounce);
      _spShipDebounce = setTimeout(function() {
        if (typeof spRequestShippingEstimate === 'function') {
          spRequestShippingEstimate();
        }
      }, 350);
    }

    // Update the right-panel live-price strip.
    //
    // Display rule (decided after watching customers see "$697.50 TOTAL"
    // before they'd filled in any sizes and feel committed to it):
    //
    //   Before any sizes entered → show PER-UNIT estimate only
    //     "Estimate: $13.95 /unit at this qty tier · enter sizes for total"
    //
    //   After sizes entered → show TOTAL using the size-grid quantity
    //   (overrides the cart item's qty because the size grid is the
    //   authoritative count once filled). Single-item carts re-fetch the
    //   unit price at the real qty so the price tier is accurate.
    function updateCartTotal() {
      var items = SinghsCart.read().items;
      if (items.length === 0) return;
      var strip = document.getElementById('livePriceStrip');
      if (!strip) return;
      strip.style.display = 'block';

      // Per-item unit prices live in _priceCache keyed by
      // product_id + qty + sides + decoration_method + placements.
      // 2026-05-24 — per-item method is now in it.decoration_type;
      // fall back to the legacy global state.service for items that
      // predate the per-item picker.
      var cartUnitSum = 0, cartUnits = 0, cartLineTotal = 0, knownAll = true;
      items.forEach(function (it) {
        var qty = Number(it.qty) || ((it.roster && it.roster.length) || 0);
        cartUnits += qty;
        // Jersey lines price themselves (blank + DTF name/number + optional
        // logo, via the decoration engine) at add-to-cart time. Use that
        // stored unit price directly instead of the sides-based cache.
        if (it.is_jersey) {
          var ju = it.jersey_unit_price;
          if (typeof ju === 'number') { cartUnitSum += ju; cartLineTotal += ju * qty; }
          else knownAll = false;
          return;
        }
        var sides = it.sides || 1;
        var pk    = (it.placements || []).join(',');
        var rawM  = (it.decoration_type || '').toLowerCase();
        var method = rawM === 'embroidery' ? 'embroidery' : (rawM ? 'dtf' : currentDecorationMethod());
        var p     = _priceCache[it.product_id + '_' + qty + '_' + sides + '_' + method + '_' + pk];
        if (typeof p === 'number') {
          cartUnitSum  += p;
          cartLineTotal += p * qty;
        } else {
          knownAll = false;
        }
      });
      var avgUnitPrice = (items.length > 0 && cartUnitSum > 0) ? (cartUnitSum / items.length) : null;

      // 2026-05-24 — Cart mode is now the only source of truth for
      // quantities (Step 2's global size grid is hidden in cart mode).
      // Use the cart's own piece count as the authoritative total. If
      // any item has a per-item sizes map filled in, prefer the sum of
      // those — otherwise fall back to `it.qty`. Both numbers should
      // converge once the customer reconciles sizes with qty.
      var cartSizeTotal = 0;
      items.forEach(function (it) {
        var sizes = (it.sizes && typeof it.sizes === 'object') ? it.sizes : {};
        Object.keys(sizes).forEach(function (k) {
          var n = Number(sizes[k]);
          if (Number.isFinite(n) && n > 0) cartSizeTotal += n;
        });
      });
      var sur = (typeof computeSizeSurcharge === 'function') ? computeSizeSurcharge() : { surchargeTotal: 0, count: 0 };

      var suf = document.getElementById('livePriceUnitSuffix');
      var totalWrap = document.getElementById('livePriceTotalWrap');

      // Effective quantity for the visible total: prefer the size-grid
      // sum if the customer has started filling it in, otherwise use the
      // per-item qty totals (which default to 50 on catalog add).
      var effectiveUnits = cartSizeTotal > 0 ? cartSizeTotal : cartUnits;

      if (knownAll && cartLineTotal > 0) {
        // Standard cart-mode path — every line has a known unit price.
        // For a single-item cart the per-unit price is the most
        // informative headline (customer's anchor is "$X each").
        // Multi-item carts default to "N items" since unit prices
        // typically differ across rows.
        if (items.length === 1 && avgUnitPrice != null) {
          document.getElementById('livePriceUnit').textContent =
            '$' + avgUnitPrice.toFixed(2);
          if (suf) { suf.style.display = ''; suf.textContent = '/unit'; }
        } else {
          document.getElementById('livePriceUnit').textContent =
            items.length + ' items';
          if (suf) suf.style.display = 'none';
        }
        // Below the headline, show pieces count + any size-grid drift.
        // If the customer's size-grid total diverges from their per-line
        // qty (e.g. they've filled in 32 sizes for a 50-piece line),
        // surface that so it doesn't silently mismatch what the rep
        // sees on the CRM.
        document.getElementById('livePriceQty').textContent =
          cartUnits + (cartUnits === 1 ? ' piece' : ' pieces') +
          (cartSizeTotal > 0 && cartSizeTotal !== cartUnits
            ? ' · sizes filled: ' + cartSizeTotal
            : '');
        totalWrap.style.display = 'block';
        document.getElementById('livePriceTotal').textContent =
          '$' + (cartLineTotal + sur.surchargeTotal).toFixed(2);
      } else if (avgUnitPrice != null) {
        // Some prices are still resolving (async fetches in flight).
        // Show the running estimate but flag it so the customer knows
        // it's still settling.
        document.getElementById('livePriceUnit').textContent =
          '$' + avgUnitPrice.toFixed(2);
        if (suf) {
          suf.style.display = '';
          suf.textContent = '/unit est.';
        }
        document.getElementById('livePriceQty').textContent =
          effectiveUnits + ' pieces · pricing in progress…';
        totalWrap.style.display = 'block';
        document.getElementById('livePriceTotal').textContent =
          '$' + (avgUnitPrice * effectiveUnits + sur.surchargeTotal).toFixed(2);
      } else {
        // Prices haven't loaded yet — keep the strip visible with a
        // friendly loading state. No total shown because we have no
        // unit price to multiply yet.
        document.getElementById('livePriceUnit').textContent = '$—';
        document.getElementById('livePriceQty').textContent =
          effectiveUnits + (effectiveUnits === 1 ? ' piece' : ' pieces') + ' · loading…';
        totalWrap.style.display = 'none';
      }
    }

    // Holds the prefilled product so other handlers (color picker, live price
    // calc) can read from it. Null = no catalog selection yet.
    var catalogPick = null;

    // Strip waist-size encoding from S&S color names: "Black_32" → "Black",
    // "Brown Duck_40" → "Brown Duck". The S&S sync stores per-waist-size
    // colors as separate rows for waist-sized garments (bib overalls, work
    // pants etc.) which inflates the colour list. Dedupe by display name so
    // the customer sees clean swatches.
    function cleanColorName(raw) {
      return String(raw || '').replace(/_\d+$/, '').replace(/\s+_\d+$/, '').trim();
    }

    // Replace the hardcoded color swatch grid with the real colors from the
    // selected product. Greys out colors that have no in-stock sizes so
    // customers don't pick something we can't ship.
    function paintProductColors(product, selectedColorId) {
      var grid = document.querySelector('.color-grid');
      if (!grid || !product || !Array.isArray(product.colors)) return;

      // De-duplicate by cleaned color name — keep first occurrence with the
      // most stock signal, prefer the one matching selectedColorId.
      var seen = {};
      var deduped = [];
      product.colors.forEach(function(c) {
        var clean = cleanColorName(c.color_name);
        if (!clean) return;
        if (!seen[clean]) {
          seen[clean] = { hex: c.hex_code, color_id: c.color_id, color_name: clean, sizes_in_stock: c.sizes_in_stock || [] };
          deduped.push(seen[clean]);
        } else {
          // Merge: accumulate sizes_in_stock, prefer color_id if matches selection
          var entry = seen[clean];
          entry.sizes_in_stock = entry.sizes_in_stock.concat(c.sizes_in_stock || []);
          if (c.color_id === selectedColorId) entry.color_id = c.color_id;
        }
      });

      var html = deduped.map(function(c) {
        var hex      = c.hex || '#cccccc';
        var hasStock = c.sizes_in_stock && c.sizes_in_stock.length > 0;
        var selected = c.color_id === selectedColorId ? ' selected' : '';
        var oosCls   = hasStock ? '' : ' oos';
        var light    = isLightHex(hex) ? ' light' : '';
        return '<div class="color-swatch' + selected + oosCls + light +
               '" data-color="' + hex + '" data-color-id="' + c.color_id +
               '" data-color-name="' + escapeAttr(c.color_name) + '"' +
               ' style="background:' + hex + '"' +
               ' onclick="selectProductColor(this)" title="' + escapeAttr(c.color_name) +
               (hasStock ? '' : ' (out of stock)') + '"></div>';
      }).join('');
      grid.innerHTML = html;
      // Trigger an initial selection sync so colorName + hidden input match
      var first = grid.querySelector('.color-swatch.selected') || grid.querySelector('.color-swatch:not(.oos)') || grid.querySelector('.color-swatch');
      if (first) selectProductColor(first);
    }

    function selectProductColor(el) {
      document.querySelectorAll('.color-swatch').forEach(function(s) { s.classList.remove('selected'); });
      el.classList.add('selected');
      var name = el.getAttribute('data-color-name') || '';
      var hex  = el.getAttribute('data-color') || '';
      var id   = el.getAttribute('data-color-id') || '';
      var nameEl = document.getElementById('colorName');
      if (nameEl)  nameEl.textContent = name;
      var input  = document.getElementById('colorInput');
      if (input)   input.value = name;
      var cidIn  = document.getElementById('catalogColorId');
      if (cidIn)   cidIn.value = id;
      var sumCol = document.getElementById('sumColor');
      if (sumCol)  sumCol.textContent = name;
      state.color = hex; state.colorName = name;
      if (typeof updateGarmentShape === 'function') updateGarmentShape();
    }
    function isLightHex(hex) {
      var h = (hex || '').replace('#',''); if (h.length !== 6) return false;
      var r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
      return (r*299 + g*587 + b*114) / 1000 > 200;
    }
    function escapeAttr(s) { return String(s).replace(/[<>"'&]/g, function(c){ return ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'})[c]; }); }

    // Surface a "Recommended for this garment" badge on the print-method card
    // that matches the category's default decoration_method. Keeps the badge
    // in sync with what the pricing engine actually uses to price the line.
    function recommendDecorationMethod(garmentType) {
      var embroideryFirst = new Set([
        'hat','coverall','chore_coat','vest','softshell','pullover_jacket',
        'cardigan','sweater','chef_coat','workshirt','lab_coat','hivis','polo',
      ]);
      var method = embroideryFirst.has(String(garmentType)) ? 'Embroidery' : 'DTF';
      document.querySelectorAll('.method-card').forEach(function(c) {
        var v = c.getAttribute('data-value');
        // Remove any existing recommendation badge so re-prefilling doesn't stack
        var prev = c.querySelector('.recommend-badge');
        if (prev) prev.remove();
        if (v === method) {
          var badge = document.createElement('span');
          badge.className = 'recommend-badge';
          badge.textContent = '★ Recommended for this product';
          badge.style.cssText = 'display:inline-block;font-size:.66rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:50px;background:#e8ff3c;color:#1a1a1a;margin-top:8px';
          c.appendChild(badge);
        }
      });
    }

    // -----------------------------------------------------------------
    // Live price fetch. Whenever qty / sides change while a catalog product
    // is selected, hit /api/pricing for the real engine number instead of
    // the legacy hardcoded b2bPricing table.
    // -----------------------------------------------------------------
    var _livePriceAbort = null;
    function fetchLiveUnitPrice(cb) {
      if (!catalogPick || !catalogPick.product_id) { cb(null); return; }
      var qty = parseInt(document.getElementById('sizeTotal').textContent) || 0;
      if (qty < 1) { cb(null); return; }
      var sides = parseInt(document.getElementById('printCountInput').value) || 1;

      if (_livePriceAbort) _livePriceAbort.abort();
      _livePriceAbort = new AbortController();

      var url = PRICING_API_FOR_QUOTE +
        '?product_id=' + encodeURIComponent(catalogPick.product_id) +
        '&qty='   + qty +
        '&sides=' + sides +
        '&decoration_method=' + currentDecorationMethod();
      fetch(url, { signal: _livePriceAbort.signal })
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(d) { cb(d && typeof d.unit_price === 'number' ? d.unit_price : null); })
        .catch(function() { cb(null); });
    }

    function prefillFromCatalog() {
      var params = new URLSearchParams(location.search);
      var productId = params.get('product');
      var colorId   = params.get('color');
      // ?qty=N from the catalog slider — pre-fills a size-S quantity so the
      // live-price strip matches what the customer saw on the catalog card.
      var qtyHint   = parseInt(params.get('qty') || '', 10);
      if (!productId) {
        // No catalog selection — surface the CTA so the customer is nudged
        // back to /catalog.html before they fill out the rest of the form.
        var empty = document.getElementById('catalogPickEmpty');
        if (empty) empty.style.display = 'flex';
        return Promise.resolve(false);
      }
      var empty = document.getElementById('catalogPickEmpty');
      if (empty) empty.style.display = 'none';

      return fetch(CATALOG_API_FOR_QUOTE + '?product_id=' + encodeURIComponent(productId))
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
          if (!data || !data.products || !data.products.length) return false;
          var p = data.products[0];
          var c = (p.colors || []).find(function(x) { return x.color_id === colorId; }) || p.colors[0];

          // Paint the "Your pick" card
          document.getElementById('catalogPickImg').src        = imgUrl((c && c.mockup_front_url) || p.hero_image_url);
          document.getElementById('catalogPickBrand').textContent = (p.brand || '').toUpperCase() + (p.style_number ? ' · ' + p.style_number : '');
          document.getElementById('catalogPickName').textContent  = p.name || '';
          var metaParts = [];
          if (c && c.color_name) metaParts.push(cleanColorName(c.color_name));
          if (p.weight_oz)       metaParts.push(p.weight_oz + ' oz');
          // Use the deduped colour count, not the raw color_count which may
          // double-count waist-size variants of the same colour.
          if (Array.isArray(p.colors)) {
            var uniqueColours = new Set(p.colors.map(function(x){ return cleanColorName(x.color_name); }));
            uniqueColours.delete('');
            if (uniqueColours.size) metaParts.push(uniqueColours.size + ' colour' + (uniqueColours.size > 1 ? 's' : '') + ' available');
          }
          document.getElementById('catalogPickMeta').textContent = metaParts.join(' · ');
          if (typeof p.price_from === 'number') {
            document.getElementById('catalogPickPrice').innerHTML =
              'From <strong>$' + p.price_from.toFixed(2) + '/unit</strong> at top-tier qty';
          }

          // Hidden inputs that ride along on quote submit
          document.getElementById('catalogProductId').value     = p.product_id;
          document.getElementById('catalogColorId').value       = (c && c.color_id) || '';
          document.getElementById('catalogVariantBrand').value  = p.brand || '';
          document.getElementById('catalogVariantStyle').value  = p.style_number || '';
          document.getElementById('catalogVariantColor').value  = (c && c.color_name) || '';

          // Show the pick card, hide ALL the redundant fields. With a catalog
          // product locked in, Garment Source / Blank Brand / All-Canadian /
          // generic Color picker / legacy Product grid are all implied and
          // just create noise. We drive them programmatically from the pick.
          document.getElementById('catalogPick').style.display = 'flex';
          ['legacyProductGroup','blankBrandSection','canadianBlanksSection']
            .forEach(function(id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
          // Garment Source + Garment Color both live in form-group siblings —
          // walk the catalog-pick parent to find and hide them by label text.
          document.querySelectorAll('.form-group, .color-section').forEach(function(g) {
            var lbl = g.querySelector('label');
            var k = lbl ? (lbl.getAttribute('data-i18n')||'') : '';
            if (k === 'quote.garmentsource' || k === 'quote.garmentcolor') g.style.display = 'none';
          });

          // Wire state so the rest of the form knows which garment we're on
          state.garment    = p.garment_type || 'tshirt';
          state.product    = p.name || (p.brand + ' ' + p.style_number);
          state.color      = (c && c.hex_code) || state.color;
          state.colorName  = (c && c.color_name) || state.colorName;

          // Stash the pick globally so live price + color picker can read it.
          catalogPick = p;
          // Repaint the colour swatches with this product's actual colours
          // (replaces the static 10-colour grid).
          paintProductColors(p, c && c.color_id);

          // Refresh dependent UI
          updateGarmentShape();
          var sumProd = document.getElementById('sumProduct'); if (sumProd) sumProd.textContent = state.product;
          var sumCol  = document.getElementById('sumColor');   if (sumCol)  sumCol.textContent  = state.colorName;
          calculatePrice();
          renderBulkPricingTable();
          // If the catalog slider passed a qty, drop it into the size-M box
          // so the live-price strip shows the price they saw on the card.
          // The customer can adjust per-size on Step 2; this is just the
          // sensible default.
          if (qtyHint && qtyHint >= 1 && qtyHint <= 10000) {
            var mInput = document.querySelector('input[name="size_m"]');
            if (mInput) { mInput.value = qtyHint; if (typeof updateSizeTotal === 'function') updateSizeTotal(); }
          }
          // Fetch + paint the top-tier estimate so the live-price strip is
          // populated immediately even before the customer enters a qty.
          fetchAndRenderTopTierEstimate();
          // Surface a "Recommended for this garment" hint on the right
          // Print Method card. The recommendation comes from the same cost-
          // up model the pricing engine uses (embroidery for outerwear /
          // polos / hats / workwear; DTF for the rest).
          recommendDecorationMethod(p.garment_type);
          // Also hide the bottom-of-page legacy file-upload zone now that the
          // placement upload at the top covers it (was duplicated).
          var dz = document.getElementById('dropZoneWrapper');
          if (dz) dz.style.display = 'none';
          return true;
        })
        .catch(function() { return false; });
    }

    // Init
    window.addEventListener('load', function() {
      // Lazy-load fabric.js now that the page has painted — it was previously
      // a render-blocking <head> script (~300KB). initFabricCanvas() below
      // polls every 200ms until `fabric` is defined, and addDesignToCanvas()
      // polls for `canvas`, so the late arrival is transparent to all flows.
      (function loadFabric(){
        if (window.fabric) return;
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js';
        s.async = true;
        document.head.appendChild(s);
      })();
      updateGarmentShape();           // show the right SVG silhouette + colour it
      updatePlacementRestrictions();
      updatePricingTabs();
      initFabricCanvas();
      calculatePrice();
      renderBulkPricingTable();
      renderPlacementUploads();       // build the per-placement upload list (1 entry per selected placement)
      // If items were added via the catalog cart, render the multi-item
      // list. Otherwise fall back to the single-product ?product= flow.
      if (SinghsCart.count() > 0) {
        renderCartList();
      } else {
        prefillFromCatalog();         // single-product mode — paint the card from URL
      }
    });

    // On submit: (1) stash hidden inputs for the Web3Forms email + (2)
    // fire-and-forget POST to the CRM's /api/inbound so the rep sees
    // the request in /dashboard/inbox/requests with structured cart items
    // they can convert to a draft order in one click. We do BOTH so the
    // email backup keeps working even if the CRM is down at submit time.
    var INBOUND_API        = 'https://singhsprint-crm.vercel.app/api/inbound';
    var INBOUND_UPLOAD_API = 'https://singhsprint-crm.vercel.app/api/inbound/upload';

    // Hard cap matches /api/inbound/upload — keep them in sync. We
    // surface a friendly error on oversize *before* hitting the network.
    var UPLOAD_MAX_BYTES = 15 * 1024 * 1024; // 15 MB

    // Tamarah's bug (May 2026): she uploaded a logo, the form
    // submitted, but the inbound_requests row landed with
    // design_url=null / design_bytes=0. Root cause was three-fold:
    //   (a) uploadDesignFile() swallowed errors silently and the
    //       form submit handler was fire-and-forget — so a slow or
    //       failing upload got cancelled the moment Web3Forms's
    //       native POST navigated away.
    //   (b) Customer got no UI feedback that an upload was in flight,
    //       and no error if it failed.
    //   (c) On size / network errors we returned null and the row
    //       got 'mockup_status=skipped' with no hint to the rep that
    //       a file was attempted.
    //
    // Fix: this function now throws on real failures (so the submit
    // handler can show an error); the submit handler preventDefaults
    // the form, awaits the upload, then programmatically submits.
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

    // Tiny overlay shown while the design upload + structured POST run.
    // Built lazily so we don't add DOM weight on pages where the customer
    // never submits.
    function spShowUploadOverlay(label) {
      var existing = document.getElementById('spUploadOverlay');
      if (existing) {
        var l = existing.querySelector('.sp-upload-overlay__label');
        if (l && label) l.textContent = label;
        existing.style.display = 'flex';
        return existing;
      }
      var el = document.createElement('div');
      el.id = 'spUploadOverlay';
      el.style.cssText = [
        'position:fixed','inset:0','background:rgba(26,26,26,0.78)',
        'z-index:9999','display:flex','align-items:center','justify-content:center',
        'font-family:inherit'
      ].join(';');
      el.innerHTML =
        '<div style="background:#1a1a1a;border:1px solid #333;border-radius:16px;padding:28px 32px;text-align:center;max-width:380px;width:90%;">' +
          '<div style="width:48px;height:48px;border:3px solid #333;border-top-color:#e8ff3c;border-radius:50%;margin:0 auto 16px;animation:spSpin 0.9s linear infinite"></div>' +
          '<div class="sp-upload-overlay__label" style="color:#fff;font-weight:600;font-size:0.95rem;line-height:1.4">' + (label || 'Uploading your design…') + '</div>' +
          '<div style="color:#888;font-size:0.78rem;margin-top:8px">This usually takes a few seconds.</div>' +
        '</div>' +
        '<style>@keyframes spSpin{to{transform:rotate(360deg)}}</style>';
      document.body.appendChild(el);
      return el;
    }
    function spHideUploadOverlay() {
      var el = document.getElementById('spUploadOverlay');
      if (el) el.style.display = 'none';
    }
    function spShowUploadError(message) {
      var existing = document.getElementById('spUploadOverlay');
      if (!existing) existing = spShowUploadOverlay('');
      existing.innerHTML =
        '<div style="background:#1a1a1a;border:1px solid #4a1f1f;border-radius:16px;padding:28px 32px;max-width:420px;width:90%;text-align:center">' +
          '<div style="font-size:32px;margin-bottom:8px">⚠️</div>' +
          '<div style="color:#fff;font-weight:700;font-size:1rem;margin-bottom:8px">Upload didn’t go through</div>' +
          '<div style="color:#ddd;font-size:0.86rem;line-height:1.5;margin-bottom:18px">' + message + '</div>' +
          '<div style="display:flex;gap:8px;justify-content:center">' +
            '<button type="button" id="spUploadRetry" style="background:#e8ff3c;color:#1a1a1a;border:none;border-radius:50px;padding:10px 18px;font-weight:700;cursor:pointer">Try again</button>' +
            '<button type="button" id="spUploadSkip"  style="background:transparent;color:#bbb;border:1px solid #444;border-radius:50px;padding:10px 18px;font-weight:600;cursor:pointer">Send without design</button>' +
          '</div>' +
        '</div>';
    }

    document.addEventListener('DOMContentLoaded', function() {
      var form = document.getElementById('quoteForm');
      if (!form) return;

      // Flag: once we've finished the async upload + structured POST,
      // we set this and call form.submit() to let Web3Forms's native
      // multipart POST take over. The handler bails on the second pass.
      form.dataset.spUploadCleared = '0';

      form.addEventListener('submit', function(e) {
        if (form.dataset.spUploadCleared === '1') {
          // Second pass — let the native submit through to Web3Forms.
          return;
        }

        var items = SinghsCart.read().items;

        // 1) Hidden fields for the Web3Forms email backup
        if (items.length > 0 && !form.querySelector('input[name="cart_items_json"]')) {
          var hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = 'cart_items_json';
          hidden.value = JSON.stringify(items);
          form.appendChild(hidden);
          var summary = items.map(function(it, i) {
            var placementLabels = Array.isArray(it.placements) && it.placements.length
              ? it.placements.map(function(p){ return (placementPresets[p] && placementPresets[p].label) || p; }).join(', ')
              : ((it.sides||1) + ' side' + ((it.sides||1)>1?'s':''));
            return (i+1) + '. ' + (it.brand||'') + ' ' + (it.style_number||'') + ' — ' +
                   (it.name||'') + ' (' + (it.color_name||'').replace(/_\d+$/,'') + ') × ' +
                   (it.qty||'?') + ' units, placements: ' + placementLabels;
          }).join('\n');
          var summaryHidden = document.createElement('input');
          summaryHidden.type = 'hidden';
          summaryHidden.name = 'cart_summary';
          summaryHidden.value = summary;
          form.appendChild(summaryHidden);
        }

        // 1b) Collect EVERY design file the customer attached, keyed by
        // the placement preset it's tagged to. Per-placement and
        // per-cart-item file inputs are re-rendered (innerHTML = …)
        // every time placements or cart items change — including
        // immediately after `onchange` fires via attachPlacementFile()
        // / cartAttachItemFile(). That wipes `.files` on the DOM
        // <input>, so by submit time the form's file inputs are
        // empty even though the customer DID attach artwork. The real
        // File objects live in:
        //
        //   placementFiles[presetId]              — single-product flow
        //   cartItemFiles[idx + '_' + presetId]   — catalog cart flow
        // (Legacy #designFile path removed 2026-05-24; the fallback at
        //  the bottom of this block still scans all visible file inputs
        //  defensively in case some future widget gets re-introduced.)
        //
        // We upload one file per placement (Phase A of per-side mockups),
        // so each placement lands in its own inbound_request_mockups row
        // on the CRM. The 30-min cron then generates them independently;
        // a Gemini hiccup on the back print no longer kills the front.
        // 2026-05-24 — cart_item_index added so per-item uploads from
        // the catalog cart flow ("Bella Aqua: Left Chest design A",
        // "Bella Black: Left Chest design B") are preserved through
        // upload + inbound and the CRM's mockup orchestrator can
        // generate a separate mockup per item.
        //
        // Index semantics:
        //   - cartItemFiles keys carry "<itemIdx>_<presetId>" — pull
        //     itemIdx out and stamp it on the entry.
        //   - placementFiles (single-product / non-cart flow) doesn't
        //     have an item index; leave it null so the CRM fans out
        //     to all cart items carrying that placement (or anchors
        //     to item 0 when there are none).
        var pendingFiles = [];   // [{ placement, cart_item_index, file }]
        try {
          if (typeof placementFiles === 'object' && placementFiles) {
            Object.keys(placementFiles).forEach(function(presetId){
              var f = placementFiles[presetId];
              if (f instanceof File) pendingFiles.push({
                placement: presetId,
                cart_item_index: null,   // global/single-product upload
                file: f
              });
            });
          }
          if (typeof cartItemFiles === 'object' && cartItemFiles) {
            Object.keys(cartItemFiles).forEach(function(key){
              var f = cartItemFiles[key];
              if (!(f instanceof File)) return;
              // key format: "<itemIdx>_<presetId>". presetIds never
              // contain underscores (see placementPresets); split on
              // the first '_' to recover both halves.
              var split = key.indexOf('_');
              var idxStr = split > -1 ? key.slice(0, split) : '';
              var idxNum = parseInt(idxStr, 10);
              var placement = split > -1 ? key.slice(split + 1) : null;
              pendingFiles.push({
                placement: placement,
                cart_item_index: Number.isFinite(idxNum) ? idxNum : null,
                file: f
              });
            });
          }
          // Legacy single-input fallback. Tag it as the first selected
          // placement (or null) so the CRM still attributes it sensibly.
          if (pendingFiles.length === 0) {
            var fileInputs = form.querySelectorAll('input[type="file"]');
            for (var i = 0; i < fileInputs.length; i++) {
              if (fileInputs[i].files && fileInputs[i].files[0]) {
                pendingFiles.push({
                  placement: (Object.values(presetByLocation || {})[0]) || null,
                  cart_item_index: null,
                  file: fileInputs[i].files[0],
                });
                break;
              }
            }
          }
        } catch (e) { /* file collection should never break submit */ }

        // Block the native submit; we'll re-submit after upload + POST.
        e.preventDefault();
        var fileCount = pendingFiles.length;
        spShowUploadOverlay(
          fileCount === 0 ? 'Sending your request…' :
          fileCount === 1 ? 'Uploading your design…' :
          ('Uploading ' + fileCount + ' designs…')
        );

        function finishAndSubmit() {
          form.dataset.spUploadCleared = '1';
          spHideUploadOverlay();
          // form.submit() doesn't trigger 'submit' handlers, so our
          // bail-out flag is belt-and-suspenders.
          form.submit();
        }

        // Safety timeout: if upload + POST takes longer than the
        // bailout window, give up on the bonus path and submit anyway
        // — the Web3Forms email backup carries the attachment so the
        // rep still gets the design. We grow the budget with the file
        // count because each upload is a separate round trip; 8s base
        // + 4s per extra file is comfortable on a 3G phone and still
        // well under the typical "user gets impatient" threshold.
        var bailoutMs = 8000 + Math.max(0, fileCount - 1) * 4000;
        var bailoutTimer = setTimeout(function(){
          if (form.dataset.spUploadCleared === '1') return;
          console.warn('[quote submit] upload took >' + bailoutMs + 'ms — falling back to email backup');
          finishAndSubmit();
        }, bailoutMs);

        function doStructuredPostThenSubmit(uploaded) {
        try {
          var fd = new FormData(form);
          var sizeBreakdown = {};
          ['size_xs','size_s','size_m','size_l','size_xl','size_2xl','size_3xl','size_4xl','size_5xl'].forEach(function(k){
            var label = k.replace('size_','').toUpperCase();
            sizeBreakdown[label] = parseInt(fd.get(k) || '0', 10) || 0;
          });
          var sur = (typeof computeSizeSurcharge === 'function') ? computeSizeSurcharge() : { surchargeTotal: 0 };
          var totalQty = parseInt((fd.get('total_quantity') || '0'), 10) || 0;
          var liveTotalEl = document.getElementById('livePriceTotal');
          var estimatedTotal = 0;
          if (liveTotalEl) {
            var m = (liveTotalEl.textContent || '').match(/[0-9]+\.?[0-9]*/);
            if (m) estimatedTotal = parseFloat(m[0]) || 0;
          }
          var isBYO = (fd.get('garment_source') || '') === 'BYOG';
          // Promo slug — set when the visitor arrived from the homepage
          // offer popup (/quote?promo=…). Pull from URL first, fall back to
          // the hidden input the page already stamps on DOMContentLoaded.
          var promoSlug = null;
          try {
            promoSlug = new URLSearchParams(window.location.search).get('promo')
                     || (fd.get('promo_slug') || null);
          } catch (e) {}

          var payload = {
            kind:            isBYO ? 'byo' : 'quote',
            contact_name:    fd.get('name') || null,
            email:           fd.get('email') || null,
            phone:           fd.get('phone') || null,
            company:         fd.get('company') || fd.get('organization') || null,
            service:         (fd.get('service') || '').toLowerCase() || null,
            garment_source:  isBYO ? 'byo' : 'we_supply',
            timeline:        fd.get('timeline') || null,
            total_qty:       totalQty,
            num_sides:       parseInt(fd.get('print_sides') || '1', 10) || 1,
            estimated_total: estimatedTotal,
            notes:           fd.get('details') || null,
            cart_items:      items,
            size_breakdown:  sizeBreakdown,
            // Customer-uploaded designs — one entry per placement the
            // customer attached artwork to. The CRM inserts one
            // inbound_request_mockups row per entry, and the 30-min
            // sweep generates each side independently so a failure
            // on one print can't kill the others.
            //
            // The legacy single-design fields stay populated from the
            // FIRST upload (if any) so older CRM read paths that
            // haven't migrated yet keep showing something.
            designs:         Array.isArray(uploaded) ? uploaded.map(function(u){
                               return {
                                 placement:       u.placement || null,
                                 // 2026-05-24 — tells the CRM which cart
                                 // item this upload belongs to so the
                                 // mockup orchestrator generates a
                                 // separate mockup per item. null means
                                 // "global" — CRM fans out to every
                                 // cart item carrying this placement.
                                 cart_item_index: (typeof u.cart_item_index === 'number') ? u.cart_item_index : null,
                                 path:            u.path,
                                 signed_url:      u.signed_url || null,
                                 mime:            u.mime  || null,
                                 bytes:           u.bytes || null,
                               };
                             }) : [],
            design_path:     (Array.isArray(uploaded) && uploaded[0] && uploaded[0].path)       || null,
            design_url:      (Array.isArray(uploaded) && uploaded[0] && uploaded[0].signed_url) || null,
            design_mime:     (Array.isArray(uploaded) && uploaded[0] && uploaded[0].mime)       || null,
            design_bytes:    (Array.isArray(uploaded) && uploaded[0] && uploaded[0].bytes)      || null,
            meta: {
              purpose:        fd.get('purpose') || null,
              blank_brand:    fd.get('blank_brand') || null,
              canadian_addon: !!fd.get('canadian_blanks'),
              xxl_surcharge_total: sur.surchargeTotal || 0,
              // Selected placement preset IDs. Pulled from presetByLocation
              // (the active map) and the cart items as a fallback. We used
              // to query `input[name="placements[]"]:checked` but the form
              // doesn't have placement checkboxes — placements live in the
              // .loc-check divs + the per-preset card grid — so that
              // selector always returned an empty array and meta.placements
              // was always [].
              placements: (function(){
                try {
                  if (typeof SinghsCart !== 'undefined' && SinghsCart.count() > 0) {
                    var items = SinghsCart.read().items;
                    var all = [];
                    items.forEach(function(it){
                      if (Array.isArray(it.placements)) all = all.concat(it.placements);
                    });
                    // De-dupe while preserving order
                    return all.filter(function(v, i){ return all.indexOf(v) === i; });
                  }
                  return Object.values(presetByLocation || {});
                } catch (e) { return []; }
              })(),
              // Promo handoff from the homepage offer popup — surfaces on
              // the CRM inbox as a "$20 off (first order)" pill so the rep
              // remembers to apply the discount on the formal quote.
              promo_slug:     promoSlug || null,
              // 2026-05-24 — customer-supplied urgency. needed_by is a
              // YYYY-MM-DD string (or null when blank); is_rush is true
              // when the rush checkbox was ticked. CRM inbox shows a red
              // badge for is_rush, and convert-to-order pre-fills the
              // quote builder's `deadline` from needed_by so the rep
              // doesn't re-type.
              needed_by:      fd.get('need_by_date') || null,
              is_rush:        !!fd.get('is_rush')
            },
            source_url: location.href
          };
          // Now that the design file(s) are already in our bucket (or
          // none if the customer skipped artwork), POST the structured
          // payload. We await it so the row is fully written before
          // we either show the inline success state OR (on failure)
          // fall through to Web3Forms as a backup.
          //
          // Submission policy (May 2026):
          //   - CRM POST 2xx  →  show the inline #formSuccess panel.
          //                      Web3Forms is NOT called — it's just
          //                      redundant work and its spam classifier
          //                      sometimes rejects the dup payload,
          //                      which used to flash a confusing
          //                      "submission failed" page to the
          //                      customer even when their request had
          //                      already landed in our CRM.
          //   - CRM POST !ok / network err → call form.submit() so
          //                      Web3Forms backstops the request via
          //                      its native multipart POST. The rep
          //                      still gets the rep-alert email; we
          //                      lose the structured cart on that
          //                      single submission and have to re-enter
          //                      it manually in /inbox/requests.
          //   - Bailout timer fired → same as failure path: Web3Forms
          //                      catches it. The CRM may also still be
          //                      writing the row in the background
          //                      (keepalive: true), so duplicate-detect
          //                      on the inbox handles the rare double.
          fetch(INBOUND_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true
          }).then(function(r){
            clearTimeout(bailoutTimer);
            if (r && r.ok) {
              // Inline success — short-circuits Web3Forms entirely.
              form.dataset.spUploadCleared = '1';
              spHideUploadOverlay();
              try { showSuccess(); } catch (e) { /* showSuccess is defined below; fall back if not yet */ }
            } else {
              console.warn('[inbound POST] non-2xx from CRM (status ' + (r && r.status) + ') — falling back to Web3Forms');
              finishAndSubmit();
            }
          }).catch(function(err){
            console.warn('[inbound POST] failed — falling back to Web3Forms:', err);
            clearTimeout(bailoutTimer);
            finishAndSubmit();
          });
        } catch (e) {
          // Never block the form submit on our own analytics path.
          console.warn('[inbound dual-post] skipped:', e);
          clearTimeout(bailoutTimer);
          finishAndSubmit();
        }
        }  // end doStructuredPostThenSubmit

        // Kick off uploads in parallel — one POST per pending file.
        // Each resolves to { path, signed_url, mime, bytes, placement }.
        // We use Promise.all so a single slow upload doesn't block the
        // others; if any single upload fails hard we surface the error
        // (as before) but the customer can choose "Send without
        // designs" to push the request through without artwork.
        function uploadAll(pending) {
          if (!pending || pending.length === 0) return Promise.resolve([]);
          return Promise.all(pending.map(function(p){
            return uploadDesignFile(p.file).then(function(u){
              if (!u) return null;
              // Stamp the placement AND cart_item_index onto the upload
              // result so the structured POST can build designs[] with
              // both tags. cart_item_index lets the CRM's mockup
              // orchestrator generate a separate mockup per item.
              u.placement = p.placement || null;
              u.cart_item_index = (typeof p.cart_item_index === 'number') ? p.cart_item_index : null;
              return u;
            });
          })).then(function(arr){
            // Filter null entries (uploadDesignFile resolves null for
            // a falsy input — shouldn't happen here but defend anyway).
            return arr.filter(function(x){ return x && x.path; });
          });
        }

        uploadAll(pendingFiles).then(function(uploaded){
          doStructuredPostThenSubmit(uploaded);
        }).catch(function(err){
          // Upload failed loud — show the customer what happened and
          // let them retry or skip. We DON'T call finishAndSubmit here
          // because the customer should see the error before navigating.
          clearTimeout(bailoutTimer);
          console.warn('[design upload] failed:', err);
          spShowUploadError((err && err.message) || 'Something went wrong uploading your design.');
          var retry = document.getElementById('spUploadRetry');
          var skip  = document.getElementById('spUploadSkip');
          if (retry) retry.addEventListener('click', function(){
            spHideUploadOverlay();
            // Re-trigger submit; flag is still 0 so this re-enters.
            form.requestSubmit ? form.requestSubmit() : form.submit();
          });
          if (skip)  skip.addEventListener('click', function(){
            // User chose to send without the designs. Swap the error
            // UI back to a spinner, then re-run the structured POST
            // path with an empty array so the rep at least gets the
            // request (they can ask the customer to email the designs
            // later).
            var overlay = document.getElementById('spUploadOverlay');
            if (overlay) overlay.remove();
            spShowUploadOverlay('Sending your request…');
            doStructuredPostThenSubmit([]);
          });
        });
      });
    });

    // Handle window resize
    var resizeTimer = null;
    window.addEventListener('resize', function() {
      if (!canvas) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        var wrapper = document.getElementById('canvasWrapper');
        if (!wrapper) return;
        var width = wrapper.offsetWidth || 400;
        var height = wrapper.offsetHeight || Math.round(width * 1.33);
        canvas.setWidth(width);
        canvas.setHeight(height);
        drawPrintAreaBoundary();
        if (designObject) fitDesignToPrintArea(designObject);
        canvas.renderAll();
      }, 150);
    });

    // ===== Shipping estimator =====
    // Calls /api/shipping/estimate on the CRM with cart + postal code.
    // CRM route owns the Chit Chats API token; nothing sensitive ever
    // reaches the browser. Falls back gracefully if the API errors —
    // we never block the quote form on a failed estimate.
    var SHIPPING_API = 'https://singhsprint-crm.vercel.app/api/shipping/estimate';

    function spGatherShippingItems() {
      try {
        var items = (SinghsCart.read().items || []).map(function(it) {
          return {
            product_id:   it.product_id || null,
            qty:          parseInt(it.qty, 10) || 1,
            garment_type: it.garment_type || null,
            // When products.weight_oz lands (post-S&S-sync fix) the CRM
            // route will use it via the catalog lookup; until then it
            // falls back to per-garment-type heuristics. Either way the
            // estimator works.
            weight_g:     it.weight_g != null
                            ? Number(it.weight_g)
                            : (it.weight_oz ? Math.round(Number(it.weight_oz) * 28.35) : undefined)
          };
        }).filter(function(i){ return i.qty > 0; });
        return items;
      } catch (e) { return []; }
    }

    function spReadDeclaredValue() {
      // The running order total drives both the declared customs value and the
      // "Add $X more for FREE shipping" gap. It surfaces in different elements
      // depending on the flow: the sidebar strip (livePriceTotal — populated in
      // BOTH the single-product and cart flows), the step-2 breakdown
      // (priceTotal — single-product only; stays $0.00 in cart mode), or the
      // bring-your-own box (byoPriceTotal). Read them all and take the highest
      // non-zero so cart orders no longer fall back to the $100 default.
      // Conservative $100 fallback before any total is computed.
      function read(id) {
        var el = document.getElementById(id);
        if (!el) return 0;
        var n = parseFloat((el.textContent || '').replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) && n > 0 ? n : 0;
      }
      try {
        var v = Math.max(read('livePriceTotal'), read('priceTotal'), read('byoPriceTotal'));
        return v > 0 ? Math.min(v, 100000) : 100;
      } catch (e) { return 100; }
    }

    // ---------------------------------------------------------------------
    // Fulfillment state & "Shipping:" breakdown line
    //
    // The customer picks pickup vs delivery. The breakdown line under the
    // running price total reflects the selection. For delivery, we show
    // either an "enter postal code" prompt, the free-shipping confirmation
    // (Greater Montreal · $500+), or the selected paid rate (tracked vs
    // untracked, customer pickable).
    // ---------------------------------------------------------------------
    var spFulfillment = 'delivery';           // 'pickup' | 'delivery'
    var spShippingChoice = null;              // { fee_cad, label, postage_type } | null
    var spShippingFree = false;               // true when Greater Montreal + $500+

    function spIsFR() {
      try { return (document.documentElement.lang || '').toLowerCase().indexOf('fr') === 0; }
      catch (e) { return false; }
    }
    function spLabel(en, fr) { return spIsFR() ? fr : en; }

    function spUpdateShippingLine() {
      var val = document.getElementById('shippingLineValue');
      if (!val) return;
      var row = document.getElementById('shippingLineRow');
      if (row) row.style.display = 'flex';
      if (spFulfillment === 'pickup') {
        val.innerHTML = '<strong style="color:#1a1a1a;font-size:.92rem">' +
          spLabel('FREE', 'GRATUIT') + '</strong> &mdash; ' +
          spLabel('In-store pickup', 'Cueillette en magasin');
        val.style.color = '#1a1a1a';
        return;
      }
      // Delivery mode
      if (spShippingFree) {
        val.innerHTML = '<strong style="color:#1a1a1a;font-size:.92rem">' +
          spLabel('FREE', 'GRATUIT') + '</strong> &mdash; ' +
          spLabel('Greater Montreal order $500+', 'Région Montréal · 500 $ et plus');
        val.style.color = '#1a1a1a';
        return;
      }
      if (spShippingChoice && spShippingChoice.fee_cad != null) {
        var fee = Number(spShippingChoice.fee_cad).toFixed(2);
        val.innerHTML = '<strong style="color:#1a1a1a;font-size:.95rem">$' + fee +
          '</strong> <span style="color:#888;font-size:.72rem;display:block;margin-top:2px">' +
          (spShippingChoice.label || '') + '</span>';
        val.style.color = '#1a1a1a';
        return;
      }
      // Delivery mode, no estimate yet
      val.textContent = spLabel(
        'Enter postal code below to get shipping estimate',
        'Entrez votre code postal ci-dessous pour une estimation'
      );
      val.style.color = '#888';
    }

    function spSetFulfillment(mode) {
      spFulfillment = (mode === 'pickup') ? 'pickup' : 'delivery';
      var pBtn = document.getElementById('fulfillPickupBtn');
      var dBtn = document.getElementById('fulfillDeliveryBtn');
      var pBody = document.getElementById('fulfillPickupBody');
      var dBody = document.getElementById('fulfillDeliveryBody');
      if (pBtn) {
        pBtn.style.background = spFulfillment === 'pickup' ? '#1a1a1a' : 'transparent';
        pBtn.style.color = spFulfillment === 'pickup' ? '#fff' : '#666';
        pBtn.classList.toggle('active', spFulfillment === 'pickup');
      }
      if (dBtn) {
        dBtn.style.background = spFulfillment === 'delivery' ? '#1a1a1a' : 'transparent';
        dBtn.style.color = spFulfillment === 'delivery' ? '#fff' : '#666';
        dBtn.classList.toggle('active', spFulfillment === 'delivery');
      }
      if (pBody) pBody.style.display = spFulfillment === 'pickup' ? 'block' : 'none';
      if (dBody) dBody.style.display = spFulfillment === 'delivery' ? 'block' : 'none';
      spUpdateShippingLine();
    }

    function spRenderShippingResult(d) {
      var el = document.getElementById('shipResult');
      if (!el) return;

      // Free shipping branch (Greater Montreal + $500+)
      if (d && d.free_shipping && d.free_shipping.eligible) {
        spShippingFree = true;
        spShippingChoice = { fee_cad: 0, label: spLabel('FREE — Greater Montreal', 'GRATUIT — Région Montréal'), postage_type: 'free_local' };
        el.style.display = 'block';
        el.innerHTML =
          '<div style="padding:12px;background:#1a1a1a;color:#fff;border-radius:10px">' +
            '<div style="font-weight:700;font-size:1rem">' + spLabel('FREE shipping unlocked', 'Livraison GRATUITE') + '</div>' +
            '<div style="font-size:.78rem;opacity:.85;margin-top:4px">' +
              spLabel('Greater Montreal area · order $500+', 'Région du Grand Montréal · commande de 500 $ et plus') +
            '</div>' +
          '</div>';
        spUpdateShippingLine();
        return;
      }

      // No rates at all
      if (!d || !d.all_rates || d.all_rates.length === 0) {
        spShippingFree = false;
        spShippingChoice = null;
        el.style.display = 'block';
        el.innerHTML =
          '<div style="padding:10px;background:#fff5f5;border:1px solid #f0d9d9;border-radius:8px;color:#888;font-size:.82rem">' +
            spLabel("No rate available for that postal code. Contact us at 438-544-3800.",
                    "Aucun tarif disponible pour ce code postal. Appelez-nous au 438-544-3800.") +
          '</div>';
        spUpdateShippingLine();
        return;
      }

      // Paid rates branch — render tracked vs untracked selectable cards
      spShippingFree = false;
      var rates = (d.all_rates || []).slice();
      // sort cheap first, then identify tracked vs untracked by postage_type
      rates.sort(function(a, b) { return (a.fee_cad || 0) - (b.fee_cad || 0); });
      var untracked = null, tracked = null;
      rates.forEach(function(r) {
        var isTracked = /track/i.test(r.postage_type || '') || /track/i.test(r.label || '');
        if (isTracked && !tracked) tracked = r;
        else if (!isTracked && !untracked) untracked = r;
      });
      // fallback when API only returns one rate
      if (!untracked) untracked = rates[0];
      if (!tracked && rates.length > 1) tracked = rates[rates.length - 1];

      // Counter-intuitive case: for heavy / multi-parcel shipments, Chit
      // Chats' tracked service (Canada Post Tracked Packet under the hood)
      // sometimes prices below Select. When "With tracking" is cheaper —
      // i.e. tracked is a strict upgrade in both cost AND service — drop
      // the untracked option entirely. Otherwise customers see two cards
      // where the pricier one looks worse on every axis, which is confusing.
      if (tracked && untracked && tracked !== untracked &&
          Number(tracked.fee_cad) < Number(untracked.fee_cad)) {
        untracked = null;
      }

      var pkg = d.package_type_label || 'Package';
      var wKg = (Number(d.weight_g) / 1000).toFixed(2);
      var nearFree = d && d.free_shipping && d.free_shipping.in_greater_montreal &&
                     typeof d.free_shipping.current_value_cad === 'number' &&
                     d.free_shipping.current_value_cad < d.free_shipping.min_value_cad;

      var html = '';
      // When only one option remains (e.g. tracked-is-cheaper case),
      // it becomes the default-checked card.
      var soleOption = !untracked || !tracked;
      if (untracked) html += spRateCardHtml('untracked', untracked, true);
      if (tracked && tracked !== untracked) html += spRateCardHtml('tracked', tracked, soleOption);
      html += '<div style="color:#888;font-size:.7rem;margin-top:8px">' + pkg + ' &middot; ~' + wKg + ' kg</div>';
      if (nearFree) {
        var diff = (d.free_shipping.min_value_cad - d.free_shipping.current_value_cad).toFixed(2);
        html += '<div style="margin-top:8px;padding:8px 10px;background:#fff8e8;border:1px solid #f0e3b8;border-radius:8px;color:#7a5b15;font-size:.74rem">' +
          spLabel('Add $' + diff + ' more for FREE shipping (Greater Montreal).',
                  'Ajoutez ' + diff + ' $ pour la livraison GRATUITE (Région Montréal).') +
          '</div>';
      }
      el.style.display = 'block';
      el.innerHTML = html;

      // Wire radio change events
      var radios = el.querySelectorAll('input[name="ship-choice"]');
      Array.prototype.forEach.call(radios, function(r) {
        r.addEventListener('change', function() {
          if (!r.checked) return;
          spShippingChoice = {
            fee_cad: Number(r.dataset.fee),
            label: r.dataset.label,
            postage_type: r.dataset.ptype
          };
          // re-style the cards
          Array.prototype.forEach.call(el.querySelectorAll('.ship-rate-card'), function(c) {
            var rad = c.querySelector('input[name="ship-choice"]');
            c.style.borderColor = (rad && rad.checked) ? '#1a1a1a' : '#e0e0e0';
            c.style.background = (rad && rad.checked) ? '#f7f7f2' : '#fff';
          });
          spUpdateShippingLine();
        });
      });

      // Default selection: prefer untracked (cheapest in the normal case);
      // when we omitted untracked because tracked is cheaper, tracked
      // becomes the default.
      if (untracked) {
        spShippingChoice = {
          fee_cad: untracked.fee_cad,
          label: spLabel('Without tracking · ', 'Sans suivi · ') + (untracked.label || 'Chit Chats Select'),
          postage_type: untracked.postage_type
        };
      } else if (tracked) {
        spShippingChoice = {
          fee_cad: tracked.fee_cad,
          label: spLabel('With tracking · ', 'Avec suivi · ') + (tracked.label || 'Chit Chats Canada Tracked'),
          postage_type: tracked.postage_type
        };
      }
      spUpdateShippingLine();
    }

    function spRateCardHtml(kind, r, checked) {
      var fee = Number(r.fee_cad || 0).toFixed(2);
      var titleEn = (kind === 'tracked') ? 'With tracking' : 'Without tracking';
      var titleFr = (kind === 'tracked') ? 'Avec suivi' : 'Sans suivi';
      var title = spLabel(titleEn, titleFr);
      var carrier = (r.label || 'Chit Chats').replace(/[<>]/g, '');
      var dataLabel = title + ' · ' + carrier;
      var borderColor = checked ? '#1a1a1a' : '#e0e0e0';
      var bgColor = checked ? '#f7f7f2' : '#fff';
      return '<label class="ship-rate-card" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:' + bgColor + ';border:1.5px solid ' + borderColor + ';border-radius:9px;cursor:pointer;margin-bottom:6px;transition:all .12s">' +
        '<input type="radio" name="ship-choice" data-fee="' + r.fee_cad + '" data-label="' + dataLabel + '" data-ptype="' + (r.postage_type || '') + '" ' + (checked ? 'checked' : '') + ' style="margin:0;accent-color:#1a1a1a">' +
        '<span style="flex:1;font-size:.82rem;color:#1a1a1a"><strong>' + title + '</strong><br><span style="color:#888;font-size:.72rem">' + carrier + '</span></span>' +
        '<span style="font-size:1rem;font-weight:700;color:#1a1a1a">$' + fee + '</span>' +
        '</label>';
    }

    function spRenderShippingError(msg) {
      var ok = document.getElementById('shipResult');
      if (ok) ok.style.display = 'none';
      var el = document.getElementById('shipError');
      if (!el) return;
      el.style.display = 'block';
      el.textContent = msg;
    }

    function spClearShippingPanels() {
      var ok = document.getElementById('shipResult');
      var err = document.getElementById('shipError');
      if (ok) ok.style.display = 'none';
      if (err) err.style.display = 'none';
      // Reset shipping selection so the breakdown line falls back to the
      // "enter postal code" prompt if the customer hasn't picked yet.
      spShippingChoice = null;
      spShippingFree   = false;
      spUpdateShippingLine();
    }

    function spRequestShippingEstimate() {
      spClearShippingPanels();
      var postal = (document.getElementById('shipPostal') || {}).value || '';
      postal = postal.trim().toUpperCase();
      var country = (document.getElementById('shipCountry') || {}).value || 'CA';
      if (!postal || postal.length < 3) {
        spRenderShippingError('Enter your postal/zip code first.');
        return;
      }
      var items = spGatherShippingItems();
      if (!items.length) {
        spRenderShippingError('Add items to your quote first.');
        return;
      }
      var declared = spReadDeclaredValue();
      var btn = document.getElementById('shipEstimateBtn');
      if (btn) { btn.disabled = true; btn.dataset._orig = btn.textContent; btn.textContent = '…'; }
      fetch(SHIPPING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items, postal_code: postal, country_code: country, declared_value_cad: declared })
      })
      .then(function(r) { return r.json().then(function(j) { return { ok: r.ok, status: r.status, body: j }; }, function(){ return { ok: r.ok, status: r.status, body: null }; }); })
      .then(function(res) {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset._orig || 'Estimate'; }
        if (!res.ok) {
          spRenderShippingError("Couldn't fetch a rate right now (HTTP " + res.status + "). Try again or contact us.");
          return;
        }
        spRenderShippingResult(res.body);
        if (typeof window.spTrack === 'function') {
          window.spTrack('shipping_estimate', {
            postal_prefix: postal.slice(0, 3),
            country: country,
            weight_g: res.body && res.body.weight_g,
            cheapest_cad: res.body && res.body.cheapest && res.body.cheapest.fee_cad
          });
        }
      })
      .catch(function(){
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset._orig || 'Estimate'; }
        spRenderShippingError('Network error. Please try again.');
      });
    }

    document.addEventListener('DOMContentLoaded', function() {
      var btn = document.getElementById('shipEstimateBtn');
      var postal = document.getElementById('shipPostal');
      if (btn) btn.addEventListener('click', spRequestShippingEstimate);
      if (postal) postal.addEventListener('keydown', function(e){
        if (e.key === 'Enter') { e.preventDefault(); spRequestShippingEstimate(); }
      });
      // Pickup / Delivery toggle
      var pBtn = document.getElementById('fulfillPickupBtn');
      var dBtn = document.getElementById('fulfillDeliveryBtn');
      if (pBtn) pBtn.addEventListener('click', function() { spSetFulfillment('pickup'); });
      if (dBtn) dBtn.addEventListener('click', function() { spSetFulfillment('delivery'); });
      // Default to delivery — shows the postal-code prompt under the price total
      spSetFulfillment('delivery');

      // ===========================================================
      // Mobile: relocate the shipping estimator INLINE into Step 3.
      // ===========================================================
      // On desktop the estimator lives in the sidebar (right column) and
      // floats next to the form. On phones the sidebar is hidden via CSS
      // (.mockup-panel{display:none}), so we surgically move the card
      // into the form flow — right after the "Delivery preference"
      // dropdown — so the user sees their shipping options exactly when
      // they're picking their fulfilment method. Visibility tracks the
      // dropdown: hidden for "Local pickup", visible otherwise.
      var MOBILE_BREAKPOINT = 900;
      var card = document.getElementById('shippingEstimateCard');
      var deliverySel = document.getElementById('delivery');
      var originalParent = card ? card.parentNode : null;
      var originalNext   = card ? card.nextSibling : null;
      var mobileHost = null;

      function isMobile() { return window.innerWidth <= MOBILE_BREAKPOINT; }

      function relocateForViewport() {
        if (!card || !deliverySel) return;
        if (isMobile()) {
          // Build / find the inline host (a wrapper right after the
          // delivery <select>'s form-group so the card slots cleanly
          // into the form's vertical rhythm).
          if (!mobileHost) {
            var deliveryGroup = deliverySel.closest('.form-group');
            mobileHost = document.createElement('div');
            mobileHost.id = 'shippingEstimateMobileHost';
            mobileHost.style.marginTop = '4px';
            if (deliveryGroup && deliveryGroup.parentNode) {
              deliveryGroup.parentNode.insertBefore(mobileHost, deliveryGroup.nextSibling);
            }
          }
          if (card.parentNode !== mobileHost) mobileHost.appendChild(card);
          syncFromDeliverySelect();
        } else {
          // Back to its original sidebar slot for desktop.
          if (originalParent && card.parentNode !== originalParent) {
            originalParent.insertBefore(card, originalNext);
          }
          card.classList.remove('is-hidden-mobile');
        }
      }

      function syncFromDeliverySelect() {
        if (!card || !deliverySel || !isMobile()) return;
        var v = (deliverySel.value || '').toLowerCase();
        // Hide on "Select..." (empty value) and on local pickup, since
        // pickup is free and shows no postal form.
        var hide = !v || /pickup/.test(v);
        card.classList.toggle('is-hidden-mobile', hide);
        // If the user picked delivery/shipping, ensure the delivery pill
        // is the active mode inside the card too.
        if (!hide) spSetFulfillment('delivery');
      }

      if (deliverySel) deliverySel.addEventListener('change', syncFromDeliverySelect);
      relocateForViewport();
      // Re-evaluate on rotate / resize so a tablet user who flips
      // orientation gets the right layout.
      var resizeTimer;
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(relocateForViewport, 150);
      });
    });
