/* =========================================================================
 * How a customer reads an order line: the print first, the blank second.
 *
 *   headline  "DTG print · Oversized Front, Across Back"
 *   onWhat    "Red ATC™ Everyday Collection® ATC1000 ATC™ EVERYDAY COTTON TEE"
 *   sizes     "S×5 · M×7 · L×6 · XL×4"
 *
 * Mirror of the CRM's src/lib/orders/line-presentation.ts (same labels, same
 * rule), for the pages that render order items in the browser from the
 * site's own API: /account/quote. The supplier's product name is never
 * reworded, only moved down. A line with no decoration recorded keeps the
 * garment as its headline. Owner, 2026-10-27.
 * ========================================================================= */
(function () {
  var PLACEMENT_LABELS = {
    'left-chest': 'Left Chest', 'center-chest': 'Center Chest', 'full-front': 'Full Front',
    'oversized': 'Oversized Front', 'back-top': 'Top Back', 'back-across': 'Across Back',
    'back-full': 'Full Back', 'left-sleeve': 'Left Sleeve', 'right-sleeve': 'Right Sleeve',
    'hood': 'Hood', 'neck-tag': 'Inside Neck Label', 'side-seam': 'Side Seam',
    'cap-front': 'Cap Front', 'cap-left-side': 'Left Side Panel', 'cap-right-side': 'Right Side Panel',
    'cap-back': 'Cap Back Panel', 'cap-brim': 'Cap Brim', 'bag-front': 'Bag Front', 'bag-back': 'Bag Back',
    'bag-pocket': 'Bag Pocket', 'leg-left-hip': 'Left Hip', 'leg-right-hip': 'Right Hip',
    'leg-back-pocket': 'Back Pocket', 'leg-side': 'Leg Side', 'apron-chest': 'Apron Chest',
    'apron-pocket': 'Apron Pocket', 'apron-full': 'Apron Front'
  };
  var SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
  function str(v) { return v == null ? '' : String(v).trim(); }
  function placementLabel(p) {
    if (!p) return '';
    return PLACEMENT_LABELS[p] || String(p).replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function methodLabel(method) {
    var m = str(method).toLowerCase();
    if (!m) return '';
    if (m === 'embroidery' || m === 'emb') return 'Embroidery';
    if (m === 'dtg' || m === 'dtf') return m.toUpperCase() + ' print';
    if (m === 'screen' || m === 'screenprint' || m === 'screen_print') return 'Screen print';
    if (m === 'vinyl' || m === 'htv') return 'Vinyl';
    return m.charAt(0).toUpperCase() + m.slice(1) + ' print';
  }
  function sizesLine(sizes) {
    if (!sizes || typeof sizes !== 'object') return '';
    return Object.keys(sizes)
      .map(function (k) { return [k, Number(sizes[k]) || 0]; })
      .filter(function (e) { return e[1] > 0; })
      .sort(function (a, b) {
        var ai = SIZE_ORDER.indexOf(a[0].toUpperCase()), bi = SIZE_ORDER.indexOf(b[0].toUpperCase());
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      })
      .map(function (e) { return e[0] + '×' + e[1]; })
      .join(' · ');
  }
  function describeLine(it) {
    it = it || {};
    var method = methodLabel(it.decoration_type);
    var raw = Array.isArray(it.print_locations) && it.print_locations.length ? it.print_locations
            : (Array.isArray(it.placements) ? it.placements : []);
    var places = raw.filter(Boolean).map(placementLabel).join(', ');
    var garment = str(it.garment_type) || [str(it.brand), str(it.style_number), str(it.name)].filter(Boolean).join(' ');
    var colour = str(it.color) || str(it.color_name);
    var work = [method, places].filter(Boolean).join(' · ');
    var headline = work || garment || 'Custom item';
    var onWhat = work ? [colour, garment].filter(Boolean).join(' ') : '';
    return { headline: headline, onWhat: onWhat, sizes: sizesLine(it.sizes), qty: Number(it.quantity != null ? it.quantity : it.qty) || 0, method: method, places: places, garment: garment, colour: colour };
  }
  window.SP_LINE = { describeLine: describeLine, methodLabel: methodLabel, placementLabel: placementLabel, sizesLine: sizesLine };
})();
