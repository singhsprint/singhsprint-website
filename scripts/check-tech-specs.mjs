// check-tech-specs.mjs — the catalog's Tech specs panel shows the supplier's
// facts and none of the supplier's web page.
//
//   node scripts/check-tech-specs.mjs
//
// 2026-11-20: SanMar's Gildan 18500 description carries a cross-sell button
// and its <style> block; the panel listed ".atc-btn {", "padding: 10px 20px;"
// and "}" as tech specs. The fixture below is that description's shape.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
// Same convention as check-upload-session.mjs: needs jsdom, or JSDOM_DIR=...
const require = createRequire(process.env.JSDOM_DIR ? join(process.env.JSDOM_DIR, 'x.js') : import.meta.url);
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch { console.error('jsdom not installed: npm i -D jsdom (or JSDOM_DIR=...)'); process.exit(2); }

const src = readFileSync(new URL('../catalog.js', import.meta.url), 'utf8');
const grab = (name) => {
  const i = src.indexOf(`  function ${name}(`);
  if (i < 0) throw new Error(`${name} not found in catalog.js`);
  const end = src.indexOf('\n  }\n', i);
  return src.slice(i, end + 4);
};
const dom = new JSDOM('<!doctype html><body></body>');
const make = new Function('document', `${grab('_stripSpecCode')}\n${grab('_isSpecNoise')}\n${grab('parseSpecBullets')}\n${grab('_adhocSpecLines')}\nreturn { _stripSpecCode, _isSpecNoise, parseSpecBullets, _adhocSpecLines };`);
const { _isSpecNoise, parseSpecBullets, _adhocSpecLines } = make(dom.window.document);

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('FAIL  ' + name, extra ?? ''); } };

const REAL = ['13.3-oz, 50/50 cotton/polyester fleece', 'Double lined hood with drawstring', 'Tear away label for private branding', 'Tubular body', 'Classic fit', '*60/40 polyester/cotton', '^ANSI/ISEA 107 high visibility standard compliant'];
const CSS = `.atc-btn {
display: inline-block;
padding: 10px 20px;
border: 1px solid #0787C5;
color: #0787C5;
background-color: #fff;
text-decoration: none;
transition: all 0.3s ease;
}
.atc-btn:hover {
background-color: #0787C5;
color: #fff;
}`;
// As a newline-separated description with the stylesheet inline (what the page showed).
const PLAIN = REAL.join('\n') + '\n<a class="atc-btn" href="https://x">Find Your ATCTM Comparable Style</a>\n<style>\n' + CSS + '\n</style>';
// The same with the tags already stripped upstream: only the text is left.
const STRIPPED = REAL.join('\n') + '\nFind Your ATCTM Comparable Style\n' + CSS;
// And as a list.
const LIST = '<ul>' + REAL.map((r) => `<li>${r}</li>`).join('') + '<li><a class="atc-btn">Find Your ATC™ Comparable Style</a><style>' + CSS + '</style></li></ul>';

console.log('1. the Gildan 18500 description');
for (const [name, lines] of [['newline text with a <style> block', _adhocSpecLines(PLAIN)], ['text with the tags already stripped', _adhocSpecLines(STRIPPED)], ['a <ul> with the button inside it', parseSpecBullets(LIST)]]) {
  ok(`${name}: the seven real specs, in order, and nothing else`, JSON.stringify(lines) === JSON.stringify(REAL), JSON.stringify(lines));
}
ok('1d an unclosed <style> takes everything after it with it', JSON.stringify(_adhocSpecLines('Tubular body\nClassic fit\n<style>\n.a {\ncolor: red;\n}')) === JSON.stringify(['Tubular body', 'Classic fit']));
ok('1e a <script> goes the same way', JSON.stringify(parseSpecBullets('<ul><li>Classic fit</li></ul><script>var a = "<li>not a spec</li>";</script>')) === JSON.stringify(['Classic fit']));

console.log('2. real specs are never mistaken for code');
const KEEP = ['5.3 oz./yd² (US), 8.0 oz/L (CA), 100% cotton', 'Fabric: 80% cotton, 20% polyester', 'Sizes: S-5XL', 'Weight: 13.3 oz;', 'Care: machine wash cold; tumble dry low', 'Colour: heathers are 60/40', 'Decoration: DTG, DTF, embroidery', 'Made in Canada', '1x1 rib cuffs {reinforced}', 'Pouch pocket', 'Find your size in the chart', 'CSA Z96-15 Class 2 Level 2', '#1 seller in fleece'];
for (const k of KEEP) ok(`kept: ${k}`, !_isSpecNoise(k));
const DROP = ['.atc-btn {', '}', '{', 'display: inline-block;', 'padding: 10px 20px;', 'border: 1px solid #0787C5;', 'background-color: #fff;', 'transition: all 0.3s ease;', '.atc-btn:hover {', 'a:hover { color: red }', '#cta {', '@media (max-width: 600px) {', '-webkit-transition: all 0.3s;', 'Find Your ATCTM Comparable Style', 'Find your ATC™ comparable style here', '', '   '];
for (const d of DROP) ok(`dropped: ${JSON.stringify(d)}`, _isSpecNoise(d));

console.log('3. the other shapes still work');
ok('3a an S&S list is lifted as before', JSON.stringify(parseSpecBullets('<ul><li>5.3 oz/yd²</li><li>Classic fit &amp; feel</li><li> </li></ul>')) === JSON.stringify(['5.3 oz/yd²', 'Classic fit & feel']));
ok('3b a sentence paragraph still splits on sentences', _adhocSpecLines('Heavy fleece. Double-needle stitching. Pouch pocket.').length === 3);
ok('3c one plain sentence stays one paragraph', JSON.stringify(_adhocSpecLines('100% ring-spun cotton tee')) === JSON.stringify(['100% ring-spun cotton tee']));
ok('3d nothing in, nothing out', _adhocSpecLines('').length === 0 && parseSpecBullets(null).length === 0 && _adhocSpecLines('<style>.a{color:red}</style>').length === 0);

console.log('4. wiring');
ok('4a both readers strip code first', /tmp\.innerHTML = _stripSpecCode\(descHtml\)/.test(src) && /text = _stripSpecCode\(text\);/.test(src));
ok('4b the panel still escapes what it prints', /\$\{s\.replace\(\/<\/g, '&lt;'\)\}/.test(src));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
