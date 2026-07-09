#!/usr/bin/env node
/**
 * generate-fr-mirror.mjs
 * ---------------------------------------------------------------
 * Builds a static French mirror of the site at /fr/. Reads lang.js
 * for translations, walks every HTML file in singhsprint-site, and
 * outputs a pre-translated counterpart at /fr/<same-path>.
 *
 * Why static instead of client-side JS swap: Googlebot indexes the
 * INITIAL HTML payload as one document per URL. With JS-only swap,
 * the FR content is invisible to indexing — both /quote and the
 * (theoretical) /fr/quote return identical HTML so Google only
 * ever sees one language per URL. Static mirroring fixes that.
 *
 * Run locally before deploy:
 *   node scripts/generate-fr-mirror.mjs
 *
 * What it does per file:
 *   1. Replace inner text/HTML of every `data-i18n="key"` element
 *      with the FR value from lang.js.
 *   2. Update <html lang="en"> → lang="fr"
 *   3. Update <title>, <meta description>, OG/Twitter meta to FR
 *      equivalents where keys exist (best-effort).
 *   4. Add hreflang alternates pointing back at the EN page.
 *   5. Update canonical URL to the /fr/ version.
 *   6. Rewrite same-origin links to /fr/ counterparts so the user
 *      doesn't get bounced back to EN by every nav click.
 *
 * What it does NOT do:
 *   - Translate dynamic content from APIs (catalog product names,
 *     colours, S&S descriptions). Those are still EN unless the
 *     CRM API gets FR fields one day.
 *   - Touch the components.js / lang.js / scripts/ files. The
 *     mirror references the originals so the same nav/footer/i18n
 *     runtime works on both sides.
 *
 * Safe to re-run. Wipes /fr/ at the start so deletions in EN are
 * reflected.
 */

import fs   from 'node:fs/promises';
import path from 'node:path';

const ROOT   = path.resolve(new URL('.', import.meta.url).pathname, '..');
const FR_DIR = path.join(ROOT, 'fr');
const SITE   = 'https://www.singhsprint.com';

// -- Load translations from lang.js ----------------------------------------
// lang.js is "var translations = { ... };" — extract that object literal,
// strip the surrounding scaffolding, and eval it inside a Function so we
// don't need to parse JS by hand.
async function loadTranslations() {
  const src = await fs.readFile(path.join(ROOT, 'lang.js'), 'utf8');
  const m = src.match(/translations\s*=\s*(\{[\s\S]*?\n  \})\s*;/);
  if (!m) throw new Error('Could not extract translations object from lang.js');
  // Use Function so eval'd code stays out of the module scope.
  const fn = new Function('return ' + m[1]);
  return fn();
}

// Legal pages are translated by hand into full French (compliance/Bill 96),
// not via data-i18n, so the generator must NOT overwrite their /fr versions.
// Their hand-written counterparts live at /fr/<name> and are maintained
// directly. (Added 2026-06-05.)
const SKIP_FILES = new Set([
  'privacy.html', 'cookies.html', 'terms.html', 'accessibility.html',
]);

// -- HTML files to mirror --------------------------------------------------
async function findHtmlFiles(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // Skip generated dirs + node_modules / .git equivalents.
      // /p/ (product pages) is also skipped — the page template is
      // hardcoded English and we don't want to ship 1,100 FR URLs that
      // serve English content (language mismatch penalty). When the
      // template gets data-i18n keys, remove 'p' from this list.
      if (['fr', 'scripts', 'node_modules', '.git', 'images', 'downloads', 'p'].includes(e.name)) continue;
      await findHtmlFiles(full, out);
    } else if (e.isFile() && e.name.endsWith('.html') && !SKIP_FILES.has(e.name)) {
      out.push(full);
    }
  }
  return out;
}

// -- Translate one HTML file -----------------------------------------------
//
// We use a regex pass for data-i18n="key">...</close. It handles 99% of
// the markup the site uses. For elements whose inner content contains
// nested tags we still rewrite — a small heuristic keeps it stable.
function translateHtml(html, T) {
  // 1. Replace data-i18n="key" inner content. The regex captures:
  //    [1] tag name, [2] attrs before data-i18n, [3] the key, [4] attrs after,
  //    [5] the inner content up to the matching close tag, [6] the close tag.
  // We use a *non-greedy* inner-content match scoped to the same tag name
  // and stop at the next </tagname>. Works for the vast majority of cases.
  html = html.replace(
    /<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)\bdata-i18n="([^"]+)"([^>]*?)>([\s\S]*?)<\/\1>/g,
    (whole, tag, attrsBefore, key, attrsAfter, inner) => {
      const entry = T[key];
      if (!entry || !entry.fr) return whole;
      // Avoid clobbering elements whose inner content is mostly markup
      // (e.g. a wrapper with several child <span>s — translating those is
      // the runtime SP_LANG's job, not the static pass).
      if (/<[a-zA-Z][^>]*data-i18n="/.test(inner)) return whole;
      return `<${tag}${attrsBefore} data-i18n="${key}"${attrsAfter}>${entry.fr}</${tag}>`;
    }
  );

  // 2. Translate <title>, <meta name="description"...>, and OG/Twitter copy
  //    when the FR-equivalent values are derivable. We map a few well-known
  //    keys → meta selectors so the head of each page is fully French.
  // (Most pages have their head copy hardcoded — we patch a few common cases
  //  with substring search instead of trying to parse the head.)
  const PAGE_TITLE_MAP = {
    // Map: substring-in-current-title → fr replacement title
    'About Singhs Print':           'À propos · Imprimerie Singhs Print',
    'Singhs Print — Custom Apparel': 'Singhs Print · Impression de vêtements personnalisés',
    'Singhs Print - Custom Apparel': 'Singhs Print · Impression de vêtements personnalisés',
    'Custom Apparel Catalog':       'Catalogue de vêtements personnalisés',
    'Apparel Catalog':              'Catalogue de vêtements',
    'Get a Custom Apparel Quote':   'Demander une soumission',
    'Quote · Singhs Print':         'Soumission · Singhs Print',
    'Custom Apparel for Businesses': 'Vêtements personnalisés pour entreprises',
    'Inkwear':                      'Inkwear',
    'Portfolio':                    'Portfolio',
    'Track your order':             'Suivez votre commande',
    'Why Singhs Print':             'Pourquoi Singhs Print'
  };
  for (const [needle, replacement] of Object.entries(PAGE_TITLE_MAP)) {
    html = html.replace(
      new RegExp(`<title>([^<]*${needle.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}[^<]*)</title>`, 'i'),
      `<title>${replacement} · FR</title>`
    );
  }

  // 3. Switch <html lang="en"> to lang="fr"
  html = html.replace(/<html\s+lang="en"/i, '<html lang="fr"');

  // 4. Update OG locale tags
  html = html.replace(
    /(<meta\s+property="og:locale"\s+content=)"en_CA"/i,
    '$1"fr_CA"'
  );
  // Add fr_CA alternate if there's no FR locale set
  if (!/og:locale:alternate/i.test(html)) {
    html = html.replace(
      /(<meta\s+property="og:locale"\s+content="fr_CA"\s*\/?>)/i,
      '$1\n  <meta property="og:locale:alternate" content="en_CA">'
    );
  }

  return html;
}

// Pre-translated meta descriptions per page so the SERP snippet is French
// for FR results. Keys are relative paths from site root.
const META_DESC_FR = {
  'index.html': 'Imprimerie de vêtements personnalisés à l\'Ouest-de-l\'Île de Montréal. DTG, DTF, sérigraphie et broderie pour marques, entreprises et créateurs. Délai standard de 3 à 5 jours, options urgentes, NEQ 1181573313.',
  'about.html': 'Studio de vêtements personnalisés familial à Sainte-Anne-de-Bellevue, Québec. DTG, DTF, broderie et sérigraphie pour les clubs McGill, les entreprises de l\'Ouest-de-l\'Île et les comptes corporatifs Net-30. 1 100+ vêtements vierges, soumission en 1 heure, NEQ 1181573313.',
  'catalog.html': 'Parcourez 1 100+ vêtements vierges chez S&S Activewear, SanMar et Rue Saint-Patrick. Filtrez par marque, coupe, tissu ou certification. Prix unitaire en direct selon la quantité.',
  'quote.html': 'Demandez une soumission personnalisée pour t-shirts, hoodies, polos, casquettes et plus. Réponse humaine en moins d\'une heure pendant les heures d\'ouverture.',
  'businesses.html': 'Programmes de vêtements corporatifs pour les entreprises de Montréal. Net-30, entente-cadre, appels d\'offres acceptés. Soumission ferme en un jour ouvrable.',
  'businesses/rfp.html': 'Formulaire d\'appel d\'offres pour Imprimerie Singhs Print. Soumission détaillée, échéancier de maquette et paperasse Net-30 en moins d\'un jour ouvrable.',
  'inkwear.html': 'Programme partenaire Inkwear · vêtements co-brandés pour les créateurs et les marques de mode établies au Québec.',
  'portfolio.html': 'Découvrez les commandes récentes décorées par Imprimerie Singhs Print pour des clubs McGill, des entreprises de l\'Ouest-de-l\'Île et des comptes corporatifs.',
  'order.html': 'Suivez votre commande Imprimerie Singhs Print — statut en temps réel, échantillon et livraison.',
  'why-us.html': 'La plupart des imprimeries vous font payer pour découvrir si elles sont bonnes. Prix en direct, aucun minimum, une maquette que vous approuvez avant l\'impression et une garantie contre les erreurs d\'impression — voici la différence Singhs Print.'
};

// Pre-translated OG/Twitter titles + descriptions for the highest-traffic
// pages so shared FR links preview in French. Falls back to EN elsewhere.
const META_OG_FR = {
  'index.html': {
    title: 'Singhs Print — Impression de vêtements personnalisés à Montréal',
    desc:  'DTG, DTF, sérigraphie et broderie pour marques, entreprises et créateurs. Studio de l\'Ouest-de-l\'Île. Petits minimums, délai de 3 à 5 jours avec options urgentes. 20 $ de rabais sur votre première commande de 100 $+.'
  },
  'quote.html': {
    title: 'Soumission gratuite — Singhs Print',
    desc:  'Créez votre soumission en quelques minutes. Choisissez un vêtement, la quantité, la méthode et téléversez votre design — réponse humaine en moins d\'une heure pendant les heures d\'ouverture.'
  },
  'catalog.html': {
    title: 'Catalogue — Singhs Print',
    desc:  'Parcourez 1 100+ vêtements vierges chez S&S Activewear, SanMar et Rue Saint-Patrick. Prix unitaire en direct selon la quantité.'
  }
};

function patchOgMeta(html, relPath) {
  const fr = META_OG_FR[relPath.replace(/\\/g, '/')];
  if (!fr) return html;
  const esc = s => s.replace(/"/g, '&quot;');
  return html
    .replace(/(<meta\s+property="og:title"\s+content=)"[^"]*"/i,        `$1"${esc(fr.title)}"`)
    .replace(/(<meta\s+name="twitter:title"\s+content=)"[^"]*"/i,       `$1"${esc(fr.title)}"`)
    .replace(/(<meta\s+property="og:description"\s+content=)"[^"]*"/i,  `$1"${esc(fr.desc)}"`)
    .replace(/(<meta\s+name="twitter:description"\s+content=)"[^"]*"/i, `$1"${esc(fr.desc)}"`);
}

function patchMetaDescription(html, relPath) {
  const fr = META_DESC_FR[relPath.replace(/\\/g, '/')];
  if (!fr) return html;
  return html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${fr.replace(/"/g, '&quot;')}">`
  );
}

// Rewrite the OG/Twitter `og:url`/`twitter:url`/og:title/og:description so the
// social preview matches the French page when shared in French contexts.
function patchOgUrl(html, frUrl) {
  return html
    .replace(/(<meta\s+property="og:url"\s+content=)"[^"]*"/i, `$1"${frUrl}"`)
    .replace(/(<meta\s+name="twitter:url"\s+content=)"[^"]*"/i, `$1"${frUrl}"`);
}

// Convert a file path like 'businesses/rfp.html' or 'index.html' to the
// user-facing clean URL Vercel exposes — '/businesses/rfp' or '/'.
function cleanPath(relPath) {
  let p = '/' + relPath.replace(/^\/+/, '').replace(/\\/g, '/');
  if (p.endsWith('/index.html')) p = p.slice(0, -'index.html'.length);
  else if (p.endsWith('.html'))  p = p.slice(0, -'.html'.length);
  // Normalise root
  if (p === '') p = '/';
  return p;
}

// -- Rewrite <link rel="canonical"> + add hreflang + rewrite internal links -
function rewriteUrls(html, relPath) {
  const cleanRel = cleanPath(relPath);
  const enUrl = SITE + (cleanRel === '/' ? '/' : cleanRel);
  const frUrl = SITE + '/fr' + (cleanRel === '/' ? '/' : cleanRel);

  // Canonical → /fr/ version
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${frUrl}">`
  );
  if (!/<link\s+rel="canonical"/i.test(html)) {
    html = html.replace(
      /<head>/i,
      `<head>\n  <link rel="canonical" href="${frUrl}">`
    );
  }

  // hreflang alternates — replace existing block if present, otherwise inject
  const hreflangs =
    `\n  <link rel="alternate" hreflang="en" href="${enUrl}">` +
    `\n  <link rel="alternate" hreflang="fr" href="${frUrl}">` +
    `\n  <link rel="alternate" hreflang="x-default" href="${enUrl}">`;
  html = html.replace(
    /\s*<link\s+rel="alternate"\s+hreflang="[^"]+"[^>]*\/?>/gi,
    ''
  );
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    m => m + hreflangs
  );

  // Rewrite same-origin links so nav inside /fr/ stays inside /fr/.
  // Matches href="/<path>" and href="<path>.html" (no scheme, no leading /fr/).
  // Skips: external links, anchors, mailto/tel, asset paths (images, scripts, css).
  // The extension test keeps shared static assets (page CSS/JS like
  // /quote.css, /catalog.js) pointing at the root copy — there is no /fr/
  // duplicate of those, the whole point is one cached copy for both languages.
  const SKIP = /^(https?:|mailto:|tel:|#|\/api|\/images|\/downloads|\/components\.js|\/lang\.js|\/ai-translate\.js|\/favicon|\/robots|\/sitemap)|\.(css|js|mjs|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|pdf|xml|txt|zip)(\?|$)/i;
  html = html.replace(/\bhref="([^"#]+)"/g, (match, href) => {
    if (SKIP.test(href)) return match;
    // Internal pages — rewrite to /fr/...
    if (href.startsWith('/')) {
      if (href.startsWith('/fr/') || href === '/fr') return match;
      return `href="/fr${href}"`;
    }
    // Relative same-page links (no scheme) — leave alone; they're navigated
    // from the FR file's own directory so they resolve correctly.
    return match;
  });

  return html;
}

async function main() {
  const T = await loadTranslations();
  const keyCount = Object.keys(T).length;
  console.log(`loaded ${keyCount} translation keys from lang.js`);

  // Fresh /fr/ each run so deletions in EN propagate.
  // Some hosts (and the dev sandbox) won't let us delete the dir we own;
  // fall back to an in-place overwrite if rm fails. Files removed from
  // EN will need to be cleaned manually in that case.
  try {
    await fs.rm(FR_DIR, { recursive: true, force: true });
  } catch (e) {
    if (e && e.code !== 'EPERM' && e.code !== 'ENOENT') throw e;
    console.warn('note: could not remove /fr/, overwriting in place');
  }
  await fs.mkdir(FR_DIR, { recursive: true });

  const files = await findHtmlFiles(ROOT);
  console.log(`found ${files.length} HTML files to mirror`);

  let count = 0;
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const outPath = path.join(FR_DIR, rel);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    let html = await fs.readFile(file, 'utf8');
    html = translateHtml(html, T);
    const cleanRel = (() => { let p = '/' + rel.replace(/\\/g, '/'); if (p.endsWith('/index.html')) p = p.slice(0, -'index.html'.length); else if (p.endsWith('.html')) p = p.slice(0, -'.html'.length); return p === '' ? '/' : p; })();
    const frUrl = SITE + '/fr' + (cleanRel === '/' ? '/' : cleanRel);
    html = rewriteUrls(html, rel);
    html = patchMetaDescription(html, rel);
    html = patchOgMeta(html, rel);
    html = patchOgUrl(html, frUrl);
    await fs.writeFile(outPath, html, 'utf8');
    console.log(`  /fr/${rel}`);
    count++;
  }

  // ------------------------------------------------------------------
  // EN-side: inject hreflang alternates back into the original files so
  // both languages cross-reference each other. Without this Google won't
  // know /index.html has a French sibling at /fr/.
  // ------------------------------------------------------------------
  let enPatched = 0;
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const cleanRel = (() => { let p = '/' + rel.replace(/\\/g, '/'); if (p.endsWith('/index.html')) p = p.slice(0, -'index.html'.length); else if (p.endsWith('.html')) p = p.slice(0, -'.html'.length); return p === '' ? '/' : p; })();
    const enUrl = SITE + (cleanRel === '/' ? '/' : cleanRel);
    const frUrl = SITE + '/fr' + (cleanRel === '/' ? '/' : cleanRel);
    let html = await fs.readFile(file, 'utf8');
    // Remove any existing hreflang block, then re-inject right after canonical.
    html = html.replace(/\s*<link\s+rel="alternate"\s+hreflang="[^"]+"[^>]*\/?>/gi, '');
    const hreflangs =
      `\n  <link rel="alternate" hreflang="en" href="${enUrl}">` +
      `\n  <link rel="alternate" hreflang="fr" href="${frUrl}">` +
      `\n  <link rel="alternate" hreflang="x-default" href="${enUrl}">`;
    if (/<link\s+rel="canonical"/i.test(html)) {
      html = html.replace(/(<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>)/i, m => m + hreflangs);
    } else {
      html = html.replace(/<head>/i, `<head>\n  <link rel="canonical" href="${enUrl}">${hreflangs}`);
    }
    await fs.writeFile(file, html, 'utf8');
    enPatched++;
  }

  console.log(`\nmirrored ${count} files → ${FR_DIR}`);
  console.log(`patched hreflang on ${enPatched} EN files`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
