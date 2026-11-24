/**
 * search-words.js — turns what a shopper types into what the catalogue calls it.
 *
 * WHY THIS EXISTS (measured 2026-11-23 against the live index):
 *   "hoodie"  did not return the Gildan 18500 at all — its name is "Hooded
 *             Sweatshirt", and the search only read brand / style / name /
 *             description.
 *   "tee"     led with Q-Tees tote bags (the BRAND matched) and missed the
 *             Gildan 5000.
 *   "hoodies" returned 8 products, "hoodie" 195.
 *   "chandail", "casquette" returned nothing. This is a Quebec shop.
 *   "black hoodie" returned 3: colour was never searchable.
 *
 * Every product already carries a clean category (category_effective) and a
 * list of colour families. So instead of hoping a supplier's product name
 * contains the shopper's word, we read the category and colour words OUT of
 * the query and apply them as filters. What is left is searched as text.
 *
 *   "gildan hoodie"       -> text "gildan",  category hoodie
 *   "black hoodie"        -> text "",        category hoodie, colour black
 *   "chandail à capuche"  -> text "",        category hoodie
 *   "18500"               -> text "18500"    (untouched)
 *
 * Used by the header search (components.js) and the catalogue page
 * (catalog-algolia.js). Both MUST go through here: two search boxes that
 * read the same words differently is the bug this file replaced.
 *
 * Pure: no DOM, no network. scripts/check-search-words.mjs runs it in node.
 */
(function (root) {
  'use strict';

  // category_effective value(s) -> the words people use for it, EN + FR.
  // Phrases are matched before single words, longest first, so
  // "hooded sweatshirt" is a hoodie and never a crewneck.
  // Do NOT add a bare "short" (it is in "short sleeve") or "bas".
  var CATEGORY_WORDS = [
    [['hoodie'], ['hoodie', 'hoodies', 'hoody', 'hoodys', 'hooded sweatshirt', 'hooded sweatshirts',
      'hooded sweater', 'hooded', 'chandail a capuche', 'chandail a capuchon', 'chandails a capuche',
      'pull a capuche', 'coton ouate', 'cotons ouates', 'kangourou', 'kangourous', 'capuchon']],
    [['crewneck'], ['crewneck', 'crewnecks', 'crew neck', 'crew necks', 'sweatshirt', 'sweatshirts',
      'col rond', 'crew']],
    [['crewneck', 'sweater'], ['sweater', 'sweaters']],
    [['longsleeve'], ['long sleeve', 'long sleeves', 'longsleeve', 'longsleeves', 'long sleeve shirt',
      'long sleeve tee', 'long sleeve t shirt', 'manches longues', 'manche longue',
      'chandail manches longues', 'chandail a manches longues']],
    [['tshirt'], ['tshirt', 'tshirts', 't shirt', 't shirts', 'tee', 'tees', 'tee shirt', 'tee shirts',
      'chandail', 'chandails', 'gilet', 'shirt', 'shirts']],
    [['polo'], ['polo', 'polos', 'polo shirt', 'polo shirts', 'golf shirt', 'golf shirts']],
    [['quarter_zip'], ['quarter zip', 'quarter zips', '1/4 zip', 'quarterzip', 'quart de zip']],
    [['tank'], ['tank', 'tanks', 'tank top', 'tank tops', 'camisole', 'camisoles', 'debardeur', 'debardeurs']],
    [['woven_shirt'], ['dress shirt', 'dress shirts', 'button up', 'button down', 'chemise', 'chemises']],
    [['jersey'], ['jersey', 'jerseys', 'maillot', 'maillots']],
    [['jacket'], ['jacket', 'jackets', 'coat', 'coats', 'manteau', 'manteaux', 'veste', 'vestes']],
    [['vest'], ['vest', 'vests']],
    [['hat'], ['hat', 'hats', 'cap', 'caps', 'casquette', 'casquettes', 'chapeau', 'chapeaux']],
    [['beanie'], ['beanie', 'beanies', 'toque', 'toques', 'tuque', 'tuques', 'bonnet']],
    [['bag', 'tote'], ['bag', 'bags', 'sac', 'sacs']],
    [['sweatpants', 'joggers'], ['sweatpants', 'sweat pants', 'sweatpant', 'jogger', 'joggers', 'jogging',
      'pantalon ouate', 'pantalons ouates', 'track pants']],
    [['pants'], ['pants', 'pantalon', 'pantalons']],
    [['shorts'], ['shorts']],
    [['leggings'], ['leggings', 'legging']],
    [['apron'], ['apron', 'aprons', 'tablier', 'tabliers']],
    [['socks'], ['sock', 'socks', 'chaussette', 'chaussettes']],
    [['bodysuit'], ['onesie', 'onesies', 'bodysuit', 'bodysuits', 'cache couche', 'romper']],
    [['gloves'], ['glove', 'gloves', 'gant', 'gants', 'mitaine', 'mitaines', 'mitts']],
    [['scarf'], ['scarf', 'scarves', 'foulard', 'foulards']],
    [['blanket'], ['blanket', 'blankets', 'couverture', 'couvertures']],
    [['towel'], ['towel', 'towels', 'serviette', 'serviettes']],
    [['cardigan'], ['cardigan', 'cardigans']],
    [['visor'], ['visor', 'visors', 'visiere', 'visieres']],
    [['headband'], ['headband', 'headbands', 'bandeau', 'bandeaux']],
    [['bib'], ['bib', 'bibs', 'bavoir', 'bavoirs']],
    [['scrubs'], ['scrubs', 'scrub']],
    [['coverall'], ['coverall', 'coveralls', 'combinaison']],
  ];

  // color_families value -> words. "navy" is the most-asked colour in the
  // shop and lives in the blue family.
  var COLOR_WORDS = {
    black:  ['black', 'noir', 'noire', 'noirs'],
    white:  ['white', 'blanc', 'blanche', 'blancs'],
    grey:   ['grey', 'gray', 'gris', 'grise', 'charcoal', 'charbon'],
    red:    ['red', 'rouge', 'maroon', 'burgundy', 'bourgogne'],
    blue:   ['blue', 'bleu', 'bleue', 'navy', 'marine', 'royal'],
    green:  ['green', 'vert', 'verte', 'forest'],
    yellow: ['yellow', 'jaune', 'gold'],
    orange: ['orange'],
    purple: ['purple', 'violet', 'mauve'],
    pink:   ['pink', 'rose'],
    brown:  ['brown', 'brun', 'brune', 'marron', 'tan', 'beige', 'khaki', 'kaki'],
    teal:   ['teal', 'turquoise', 'aqua'],
  };

  // Brand names that contain a colour or category word. A query carrying one
  // of these is left completely alone.
  var BRAND_GUARDS = ['red kap', 'blue generation', 'q tees', 'qtees', 'royal apparel'];

  // gender facet value(s) -> words. Men's styles and unisex styles are both
  // what someone asking for "mens" wants.
  var GENDER_WORDS = [
    [['youth'], ['kids', 'kid', 'youth', 'child', 'children', 'childrens', 'enfant', 'enfants', 'junior', 'juniors']],
    [['womens'], ['womens', 'women', 'woman', 'ladies', 'lady', 'femme', 'femmes']],
    [['mens', 'unisex'], ['mens', 'men', 'homme', 'hommes']],
  ];

  // Said with a category, these add nothing ("short sleeve tee" is a tee).
  var NOISE_PHRASES = ['short sleeves', 'short sleeve', 'manches courtes', 'manche courte'];

  // Words that carry no meaning once the category is known.
  var NOISE = { 'a': 1, 'the': 1, 'for': 1, 'with': 1, 'in': 1, 'de': 1, 'des': 1, 'le': 1, 'la': 1,
    'les': 1, 'un': 1, 'une': 1, 'pour': 1, 'en': 1, 'et': 1, 'and': 1, 'custom': 1, 'personnalise': 1,
    'personnalises': 1, 'blank': 1, 'blanks': 1 };

  function normalise(q) {
    return String(q == null ? '' : q)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   // é -> e
      .replace(/[‘’']/g, '')                    // men's -> mens
      .replace(/t-shirt/g, 't shirt')
      .replace(/[-_,.;:!()"+]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // phrase -> { types, len }, built once.
  var PHRASES = [];
  var SINGLE = {};
  CATEGORY_WORDS.forEach(function (row) {
    row[1].forEach(function (w) {
      var words = w.split(' ');
      PHRASES.push({ words: words, types: row[0] });
      if (words.length === 1 && !SINGLE[w]) SINGLE[w] = row[0];
    });
  });
  PHRASES.sort(function (a, b) { return b.words.length - a.words.length; });
  var GENDER_OF = {};
  GENDER_WORDS.forEach(function (row) { row[1].forEach(function (w) { GENDER_OF[w] = row[0]; }); });
  var COLOR_OF = {};
  Object.keys(COLOR_WORDS).forEach(function (fam) {
    COLOR_WORDS[fam].forEach(function (w) { COLOR_OF[w] = fam; });
  });

  // One edit apart (insert, delete, substitute or swap two neighbours).
  function oneEditApart(a, b) {
    if (a === b) return false;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0;
    while (i < la && i < lb && a.charAt(i) === b.charAt(i)) i++;
    if (la === lb) {
      if (a.slice(i + 1) === b.slice(i + 1)) return true;                       // substitute
      return a.charAt(i) === b.charAt(i + 1) && a.charAt(i + 1) === b.charAt(i) // swap
        && a.slice(i + 2) === b.slice(i + 2);
    }
    return la < lb ? a.slice(i) === b.slice(i + 1) : a.slice(i + 1) === b.slice(i);
  }

  // Only long, unmistakable words are corrected, and never a word that
  // contains a digit: "18500" must never drift into a category.
  var TYPO_TARGETS = Object.keys(SINGLE).filter(function (w) { return w.length >= 6; });
  function typoCategory(tok) {
    if (tok.length < 5 || /\d/.test(tok)) return null;
    for (var i = 0; i < TYPO_TARGETS.length; i++) {
      if (oneEditApart(tok, TYPO_TARGETS[i])) return SINGLE[TYPO_TARGETS[i]];
    }
    return null;
  }

  /**
   * interpret("black gildan hoodies")
   *   -> { text: 'gildan', types: ['hoodie'], colors: ['black'], genders: [], understood: true }
   * understood:false means the query is returned as typed.
   */
  function interpret(raw) {
    var typed = String(raw == null ? '' : raw).trim();
    var plain = { text: typed, types: [], colors: [], genders: [], understood: false };
    var norm = normalise(typed);
    if (!norm) return plain;
    for (var g = 0; g < BRAND_GUARDS.length; g++) {
      if ((' ' + norm + ' ').indexOf(' ' + BRAND_GUARDS[g] + ' ') >= 0) return plain;
    }

    var toks = norm.split(' ');
    var used = toks.map(function () { return false; });
    var types = null;

    // 1. Category: longest phrase first. The first one found names the
    //    category; any other category word is dropped from the text
    //    ("polo shirt" is a polo, not a polo with "shirt" in its name).
    PHRASES.forEach(function (ph) {
      var n = ph.words.length;
      for (var i = 0; i + n <= toks.length; i++) {
        var hit = true;
        for (var k = 0; k < n; k++) {
          if (used[i + k] || toks[i + k] !== ph.words[k]) { hit = false; break; }
        }
        if (!hit) continue;
        for (var m = 0; m < n; m++) used[i + m] = true;
        if (!types) types = ph.types;
      }
    });
    // 2. A near-miss on a long category word ("hoddie", "jaket").
    if (!types) {
      for (var t = 0; t < toks.length; t++) {
        if (used[t]) continue;
        var guess = typoCategory(toks[t]);
        if (guess) { types = guess; used[t] = true; break; }
      }
    }

    // 3. Colour. Only read as a colour when the query also names a category,
    //    or when the colour is the whole query. "royal" or "gold" inside a
    //    product name must keep working as text.
    //    A style number counts too: "64000 black" is that shirt, in black.
    var colors = [];
    var onlyColors = toks.every(function (w) { return COLOR_OF[w] || NOISE[w]; });
    var hasStyleNumber = toks.some(function (w) { return /\d{3,}/.test(w); });
    if (types || onlyColors || hasStyleNumber) {
      toks.forEach(function (w, i) {
        if (used[i] || !COLOR_OF[w]) return;
        used[i] = true;
        if (colors.indexOf(COLOR_OF[w]) < 0) colors.push(COLOR_OF[w]);
      });
    }

    if (!types && !colors.length) return plain;

    // 4. Gender, only alongside a category ("kids tee", "hoodie femme").
    var genders = [];
    if (types) {
      toks.forEach(function (w, i) {
        if (used[i] || !GENDER_OF[w] || genders.length) return;
        used[i] = true;
        genders = GENDER_OF[w].slice();
      });
      NOISE_PHRASES.forEach(function (ph) {
        var words = ph.split(' ');
        for (var i = 0; i + words.length <= toks.length; i++) {
          var hit = words.every(function (w, k) { return !used[i + k] && toks[i + k] === w; });
          if (hit) words.forEach(function (w, k) { used[i + k] = true; });
        }
      });
    }

    var rest = toks.filter(function (w, i) { return !used[i] && !NOISE[w]; });
    return { text: rest.join(' '), types: types ? types.slice() : [], colors: colors,
             genders: genders, understood: true };
  }

  /** Algolia facetFilters for an interpretation (AND of OR-groups). */
  function facetFiltersFor(it) {
    var f = [];
    if (it && it.types && it.types.length) {
      f.push(it.types.map(function (c) { return 'category_effective:' + c; }));
    }
    (it && it.colors || []).forEach(function (c) { f.push('color_families:' + c); });
    if (it && it.genders && it.genders.length) {
      f.push(it.genders.map(function (g) { return 'gender:' + g; }));
    }
    return f;
  }

  var api = { interpret: interpret, facetFiltersFor: facetFiltersFor, normalise: normalise };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SPSearchWords = api;
})(typeof window !== 'undefined' ? window : null);
