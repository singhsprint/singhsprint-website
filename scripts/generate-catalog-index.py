#!/usr/bin/env python3
"""
generate-catalog-index.py

Regenerates /catalog/all/index.html and /fr/catalog/all/index.html — a flat
alphabetical index of every product page on the site, grouped by brand.

Why this exists: catalog.html loads products via /api/catalog at runtime so
Googlebot's initial HTML scan sees zero product links. Without static
discovery paths the 1,000+ product pages stay un-crawled. This script walks
/p/*/index.html, extracts the <title>, and writes the whole list as plain
HTML anchors. SEO scaffold only; the live catalog UI is unaffected.

Run after any catalog sync that adds/removes product pages:
    python3 scripts/generate-catalog-index.py

Idempotent. Reads from the file system, writes to the two index files.
"""

import os, re, html, sys

# Resolve site root from script location (singhsprint-site/scripts/this.py)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(SCRIPT_DIR)


def extract_products(p_dir):
    """Return list of (slug, brand, style, name, full_title) sorted by brand+style."""
    out = []
    for d in sorted(os.listdir(p_dir)):
        idx = os.path.join(p_dir, d, 'index.html')
        if not os.path.isfile(idx):
            continue
        s = open(idx).read()
        m = re.search(r'<title>([^<]+)</title>', s)
        if not m:
            continue
        title = m.group(1).strip()
        for suffix in [
            ' — Custom Printing in Montreal · Singhs Print',
            ' — Impression personnalisée à Montréal · Singhs Print',
            ' &middot; Singhs Print',
            ' · Singhs Print',
        ]:
            if title.endswith(suffix):
                title = title[:-len(suffix)].strip()
        title_decoded = html.unescape(title)
        m2 = re.match(
            r'^([A-Z][A-Za-z0-9&. \'\-+]+?)\s+([A-Z0-9][A-Z0-9\-]+)\s+(.*)$',
            title_decoded,
        )
        if m2:
            brand = m2.group(1).strip()
            style = m2.group(2).strip()
            name = m2.group(3).strip()
        else:
            brand, style, name = '', '', title_decoded
        out.append((d, brand, style, name, title_decoded))
    out.sort(key=lambda r: (r[1].lower(), r[2].lower(), r[3].lower()))
    return out


def render_page(products, lang):
    h1 = ("Complete product catalog — every blank we print on" if lang == 'en'
          else "Catalogue complet — tous les vêtements que nous décorons")
    sub = (
        "All 1,000+ blanks we carry, organized alphabetically by brand. Click any "
        "product to see live pricing, color options, and request a quote. Every item "
        "ships with $20 off your first order of $100+."
        if lang == 'en' else
        "Plus de 1 000 modèles que nous décorons, classés par marque. Cliquez sur un "
        "produit pour voir les prix, les couleurs et demander une soumission. 20 $ de "
        "rabais sur votre première commande de 100 $ et plus."
    )
    canonical = (
        "https://www.singhsprint.com/catalog/all" if lang == 'en'
        else "https://www.singhsprint.com/fr/catalog/all"
    )
    title = (
        "Complete Product Catalog — 1,000+ Custom Apparel Blanks · Singh's Print"
        if lang == 'en' else
        "Catalogue complet — Plus de 1 000 vêtements personnalisables · Singh's Print"
    )
    meta = (
        "Browse our complete catalog of 1,000+ apparel blanks for custom printing and "
        "embroidery. T-shirts, hoodies, polos, caps, totes from Gildan, Bella+Canvas, "
        "Champion, Comfort Colors and more. $20 off your first order of $100+."
        if lang == 'en' else
        "Parcourez notre catalogue de plus de 1 000 vêtements à personnaliser. T-shirts, "
        "hoodies, polos, casquettes, sacs fourre-tout — Gildan, Bella+Canvas, Champion, "
        "Comfort Colors et plus. 20 $ de rabais sur votre première commande de 100 $ et plus."
    )
    home_link = "/" if lang == 'en' else "/fr/"
    catalog_link = "/catalog" if lang == 'en' else "/fr/catalog"
    quote_link = ("/quote?promo=first-order-20-off-100" if lang == 'en'
                  else "/fr/quote?promo=first-order-20-off-100")
    nav_quote = "Get a Free Quote" if lang == 'en' else "Soumission gratuite"
    p_prefix = "/p/" if lang == 'en' else "/fr/p/"

    # Group by brand
    listing = []
    last_brand = None
    for slug, brand, style, name, full_title in products:
        if brand != last_brand:
            if last_brand is not None:
                listing.append('</ul></section>')
            anchor = re.sub(r'[^a-z0-9]+', '-', (brand or 'other').lower()).strip('-')
            listing.append(
                f'<section class="brand-group"><h2 id="brand-{anchor}">{html.escape(brand or "Other")}</h2><ul>'
            )
            last_brand = brand
        href = f"{p_prefix}{slug}/"
        listing.append(f'<li><a href="{href}">{html.escape(full_title)}</a></li>')
    if last_brand is not None:
        listing.append('</ul></section>')

    return f'''<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <meta name="description" content="{html.escape(meta)}">
  <link rel="canonical" href="{canonical}">
  <link rel="alternate" hreflang="en" href="https://www.singhsprint.com/catalog/all">
  <link rel="alternate" hreflang="fr" href="https://www.singhsprint.com/fr/catalog/all">
  <link rel="alternate" hreflang="x-default" href="https://www.singhsprint.com/catalog/all">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{html.escape(meta)}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:image" content="https://www.singhsprint.com/images/hero-duo.jpg">
  <meta name="theme-color" content="#1a1a1a">
  <style>
    body{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif;margin:0;color:#1a1a1a;background:#f7f5ee;line-height:1.55}}
    .wrap{{max-width:980px;margin:0 auto;padding:32px 24px 80px}}
    header.hero{{padding:24px 0 32px;border-bottom:1px solid #e5e2d8}}
    header.hero a.back{{font-size:.85rem;color:#777;text-decoration:none}}
    h1{{font-family:"Playfair Display",Georgia,serif;font-size:clamp(1.8rem,3.5vw,2.6rem);line-height:1.15;margin:8px 0 6px;font-weight:900}}
    .subhead{{color:#666;font-size:.96rem;max-width:680px;margin:0 0 14px}}
    .cta{{display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:50px;font-weight:600;font-size:.88rem;margin-top:8px}}
    section.brand-group{{margin:28px 0 12px;padding-top:18px;border-top:1px solid #e8e6df}}
    section.brand-group:first-of-type{{border-top:none}}
    section.brand-group h2{{font-size:1.05rem;font-weight:700;margin:0 0 8px;color:#1a1a1a;letter-spacing:.01em}}
    ul{{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:4px 18px}}
    li{{margin:0;padding:0;font-size:.88rem;line-height:1.45}}
    li a{{color:#1a1a1a;text-decoration:none;display:block;padding:4px 0}}
    li a:hover{{color:#1a4a8a;text-decoration:underline}}
    .stats{{font-size:.82rem;color:#888;margin:12px 0 0}}
    @media(max-width:600px){{.wrap{{padding:18px 14px 60px}}h1{{font-size:1.55rem}}.subhead{{font-size:.9rem}}ul{{grid-template-columns:1fr}}}}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <a class="back" href="{home_link}">← Singh's Print</a>
      <h1>{h1}</h1>
      <p class="subhead">{sub}</p>
      <a class="cta" href="{quote_link}">{nav_quote} →</a>
      <p class="stats">{len(products):,} products · sorted alphabetically by brand · <a href="{catalog_link}">browse with live filters and pricing →</a></p>
    </header>

    <main>
      {''.join(listing)}
    </main>
  </div>
</body>
</html>
'''


def main():
    en = extract_products(os.path.join(SITE, 'p'))
    fr = extract_products(os.path.join(SITE, 'fr', 'p'))
    en_out = os.path.join(SITE, 'catalog', 'all', 'index.html')
    fr_out = os.path.join(SITE, 'fr', 'catalog', 'all', 'index.html')
    os.makedirs(os.path.dirname(en_out), exist_ok=True)
    os.makedirs(os.path.dirname(fr_out), exist_ok=True)
    open(en_out, 'w').write(render_page(en, 'en'))
    open(fr_out, 'w').write(render_page(fr, 'fr'))
    print(f'  ✓ {en_out.replace(SITE, "")} → {len(en):,} products')
    print(f'  ✓ {fr_out.replace(SITE, "")} → {len(fr):,} products')


if __name__ == '__main__':
    main()
