/**
 * html-segments.mjs
 * ---------------------------------------------------------------
 * Finds every piece of human-readable copy in an HTML page as a
 * "segment" with exact source offsets, so the French mirror can swap
 * English copy for French without parsing the page into a DOM and
 * re-serialising it (which would reformat 4,000 lines of hand-written
 * markup and make every diff unreadable).
 *
 * A segment is one of:
 *   text   a run of text + INLINE elements (a, strong, em, span, br ...)
 *          bounded by block elements. "We print <strong>5</strong> pieces."
 *          is ONE segment, so a translator can reorder words around the
 *          markup -- translating "We print", "5" and "pieces." separately
 *          is how machine-mirrored sites end up with English word order.
 *   attr   alt / title / placeholder / aria-label / <meta content> copy.
 *   json   a string inside <script type="application/ld+json"> under a
 *          copy key (name, description, text, headline ...).
 *
 * Keys are the segment with whitespace collapsed, so re-indenting a page
 * never invalidates a translation, but changing a word does -- on purpose:
 * the coverage checker then reports the sentence as untranslated instead
 * of the French page silently keeping last month's wording.
 *
 * No dependencies; the site's package.json is for the serverless API.
 */

const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const RAW  = new Set(['script','style','textarea','noscript','template']);
const INLINE = new Set(['a','abbr','b','bdi','bdo','br','cite','code','data','del','dfn','em','i','ins',
  'kbd','mark','q','s','samp','small','span','strong','sub','sup','time','u','var','wbr','img']);
// Never descend: no copy for a reader inside these.
const OPAQUE = new Set(['svg','math','canvas','video','audio','picture','iframe','object']);

export const ATTR_COPY = ['alt', 'title', 'placeholder', 'aria-label', 'data-tooltip'];
export const META_COPY = new Set(['description', 'og:title', 'og:description', 'og:image:alt',
  'twitter:title', 'twitter:description', 'twitter:image:alt']);
export const JSON_COPY = new Set(['name', 'description', 'text', 'headline', 'alternativeHeadline',
  'caption', 'abstract', 'disambiguatingDescription', 'slogan', 'articleSection', 'about',
  'serviceType', 'category', 'audienceType', 'eligibleRegion']);

export const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

// Letters in any script, so "5-10" or "$24.95" alone is not copy.
const HAS_WORDS = /\p{L}{2,}/u;

/** Tokenise to a flat list with offsets. Tolerant: never throws on bad HTML. */
function tokenize(html) {
  const toks = [];
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { toks.push({ t: 'text', s: i, e: n }); break; }
    if (lt > i) toks.push({ t: 'text', s: i, e: lt });
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      const e = end === -1 ? n : end + 3;
      toks.push({ t: 'comment', s: lt, e }); i = e; continue;
    }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') {
      const e = html.indexOf('>', lt) + 1 || n;
      toks.push({ t: 'decl', s: lt, e }); i = e; continue;
    }
    const m = /^<\/?([a-zA-Z][a-zA-Z0-9:-]*)/.exec(html.slice(lt, lt + 64));
    if (!m) { toks.push({ t: 'text', s: lt, e: lt + 1 }); i = lt + 1; continue; }
    // find end of tag honouring quoted attribute values
    let j = lt + m[0].length, q = null;
    while (j < n) {
      const c = html[j];
      if (q) { if (c === q) q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === '>') break;
      j++;
    }
    const e = Math.min(j + 1, n);
    const name = m[1].toLowerCase();
    const closing = html[lt + 1] === '/';
    toks.push({ t: closing ? 'end' : 'start', name, s: lt, e, selfClose: !closing && html[e - 2] === '/' });
    i = e;
    if (!closing && RAW.has(name)) {
      const re = new RegExp('</' + name + '\\s*>', 'ig'); re.lastIndex = i;
      const mm = re.exec(html);
      const cs = mm ? mm.index : n;
      if (cs > i) toks.push({ t: 'raw', name, s: i, e: cs });
      i = cs;
    }
  }
  return toks;
}

/** Build a light tree: {name, s, e(start-tag end), cs(close start), ce, children[]} */
function buildTree(html) {
  const toks = tokenize(html);
  const root = { name: '#root', s: 0, e: 0, cs: html.length, ce: html.length, children: [], attrsSrc: '' };
  const stack = [root];
  for (const tk of toks) {
    const top = stack[stack.length - 1];
    if (tk.t === 'start') {
      const node = { name: tk.name, s: tk.s, e: tk.e, cs: tk.e, ce: tk.e, children: [], parent: top };
      top.children.push(node);
      if (!VOID.has(tk.name) && !tk.selfClose) stack.push(node);
    } else if (tk.t === 'end') {
      // pop to the matching open element; ignore stray end tags
      let k = stack.length - 1;
      while (k > 0 && stack[k].name !== tk.name) k--;
      if (k === 0) continue;
      while (stack.length - 1 > k) { const x = stack.pop(); x.cs = tk.s; x.ce = tk.s; }
      const x = stack.pop(); x.cs = tk.s; x.ce = tk.e;
    } else if (tk.t === 'text' || tk.t === 'raw') {
      top.children.push({ name: '#' + tk.t, s: tk.s, e: tk.e, cs: tk.e, ce: tk.e, children: [] });
    } else {
      top.children.push({ name: '#' + tk.t, s: tk.s, e: tk.e, cs: tk.e, ce: tk.e, children: [] });
    }
  }
  while (stack.length > 1) { const x = stack.pop(); x.cs = html.length; x.ce = html.length; }
  return root;
}

const isInlineNode = (c) => c.name === '#text' || c.name === '#comment' || INLINE.has(c.name);

function textOf(html, s, e) {
  return html.slice(s, e).replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
}

/** All copy segments, in document order. */
export function segments(html) {
  const out = [];
  const root = buildTree(html);

  (function walk(node) {
    if (OPAQUE.has(node.name) || RAW.has(node.name)) return;
    const kids = node.children;
    let run = [];
    const flush = () => {
      if (!run.length) return;
      // trim leading/trailing whitespace inside the run
      let s = run[0].s, e = run[run.length - 1].ce;
      const raw = html.slice(s, e);
      const lead = raw.length - raw.replace(/^\s+/, '').length;
      const trail = raw.length - raw.replace(/\s+$/, '').length;
      s += lead; e -= trail;
      run = [];
      if (e <= s) return;
      if (!HAS_WORDS.test(textOf(html, s, e))) return;
      out.push({ kind: 'text', s, e, src: html.slice(s, e), key: norm(html.slice(s, e)) });
    };
    for (const c of kids) {
      if (isInlineNode(c) && !inlineHasBlock(c)) run.push(c);
      else { flush(); if (!c.name.startsWith('#')) walk(c); }
    }
    flush();
  })(root);

  // attributes (incl. <meta content>) -- scan start tags
  const tagRe = /<([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)>/g;
  let m;
  while ((m = tagRe.exec(html))) {
    const name = m[1].toLowerCase();
    const attrs = m[2];
    const base = m.index + 1 + m[1].length;
    if (name === 'meta') {
      const prop = /(?:name|property)\s*=\s*"([^"]+)"/i.exec(attrs);
      if (!prop || !META_COPY.has(prop[1].toLowerCase())) continue;
      const c = /\bcontent\s*=\s*"([^"]*)"/i.exec(attrs);
      if (c && HAS_WORDS.test(c[1])) {
        const s = base + c.index + c[0].indexOf('"') + 1;
        out.push({ kind: 'attr', attr: 'content', s, e: s + c[1].length, src: c[1], key: norm(c[1]) });
      }
      continue;
    }
    for (const a of ATTR_COPY) {
      const re = new RegExp('(?:^|\\s)' + a + '\\s*=\\s*"([^"]*)"', 'i');
      const am = re.exec(attrs);
      if (am && HAS_WORDS.test(am[1])) {
        const s = base + am.index + am[0].indexOf('"') + 1;
        out.push({ kind: 'attr', attr: a, s, e: s + am[1].length, src: am[1], key: norm(am[1]) });
      }
    }
  }

  // JSON-LD strings
  const ldRe = /<script\b[^>]*type\s*=\s*"application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  while ((m = ldRe.exec(html))) {
    const s = m.index + m[0].indexOf('>') + 1;
    const body = m[1];
    let data;
    try { data = JSON.parse(body); } catch { continue; }
    const strings = [];
    (function w(v, k) {
      if (Array.isArray(v)) v.forEach((x) => w(x, k));
      else if (v && typeof v === 'object') for (const [kk, vv] of Object.entries(v)) w(vv, kk);
      else if (typeof v === 'string' && JSON_COPY.has(k) && HAS_WORDS.test(v)) strings.push(v);
    })(data);
    out.push({ kind: 'json', s, e: s + body.length, src: body, strings });
  }
  return out.sort((a, b) => a.s - b.s);
}

function inlineHasBlock(node) {
  for (const c of node.children) {
    if (c.name.startsWith('#')) continue;
    if (!INLINE.has(c.name) || inlineHasBlock(c)) return true;
  }
  return false;
}

/** Every key a page needs translated (text, attr and JSON-LD strings). */
export function keysOf(html) {
  const keys = [];
  for (const sg of segments(html)) {
    if (sg.kind === 'json') keys.push(...sg.strings.map(norm));
    else keys.push(sg.key);
  }
  return keys;
}

/**
 * Replace every segment whose key is in `tm` (Map or object en->fr).
 * Returns { html, missing: [keys with no translation] }.
 */
export function applyTranslations(html, tm) {
  const get = (k) => (tm instanceof Map ? tm.get(k) : (Object.prototype.hasOwnProperty.call(tm, k) ? tm[k] : undefined));
  const segs = segments(html);
  const missing = [];
  let outHtml = html;
  for (let i = segs.length - 1; i >= 0; i--) {
    const sg = segs[i];
    if (sg.kind === 'json') {
      let data; try { data = JSON.parse(sg.src); } catch { continue; }
      const w = (v, k) => {
        if (Array.isArray(v)) return v.map((x) => w(x, k));
        if (v && typeof v === 'object') { const o = {}; for (const [kk, vv] of Object.entries(v)) o[kk] = w(vv, kk); return o; }
        if (typeof v === 'string' && JSON_COPY.has(k) && HAS_WORDS.test(v)) {
          const fr = get(norm(v));
          if (fr === undefined) { missing.push(norm(v)); return v; }
          return fr;
        }
        return v;
      };
      const pretty = /\n/.test(sg.src.trim());
      const lead = (sg.src.match(/^\s*/) || [''])[0], trail = (sg.src.match(/\s*$/) || [''])[0];
      const body = JSON.stringify(w(data), null, pretty ? 2 : 0).replace(/<\//g, '<\\/');
      outHtml = outHtml.slice(0, sg.s) + lead + body + trail + outHtml.slice(sg.e);
      continue;
    }
    const fr = get(sg.key);
    if (fr === undefined) { missing.push(sg.key); continue; }
    const val = sg.kind === 'attr' ? fr.replace(/"/g, '&quot;') : fr;
    outHtml = outHtml.slice(0, sg.s) + val + outHtml.slice(sg.e);
  }
  return { html: outHtml, missing: missing.reverse() };
}
