"""Share-card template: one HTML page per 1200x630 card, rendered by render.js.

Rebuild (needs Python, Node and Playwright), from this folder:
    python3 spec.py && python3 card.py spec.json out && node render.js out
    cp out/site-*.jpg out/guide-*.jpg ../../images/share/     # os-*.jpg go to the OS: public/share
    node ../share-cards.mjs --write && node ../share-cards.mjs     # point the pages at them, then check
"""
import html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, 'photos') + '/'
E = html.escape
ZOOM = {}
NB = lambda h: re.sub(r'(\b[Tt]-shirts?\b)', r'<span style="white-space:nowrap">\1</span>', h)

CSS = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:ital,wght@0,500;0,600;1,500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased;display:flex;background:#f5f5f2;color:#141414}
/* The photo frame is 4:5, the shape of a catalogue shot, so nothing is cropped. */
.photo{position:relative;height:630px;flex:0 0 504px;overflow:hidden;background:#eceae4}
.photo img{width:100%;height:100%;object-fit:cover;object-position:var(--pos,50% 50%);display:block}
/* The home card: four tiles, like a shop's front page. */
.photo.trio{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:3px;background:#f5f5f2}
.photo.trio .cell{overflow:hidden;background:#eceae4}
.panel{flex:1;display:flex;flex-direction:column;padding:60px 72px 52px 72px;min-width:0}
.top{display:flex;justify-content:space-between;align-items:center}
.logo{height:38px;width:auto}
.cap{font-size:14px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:#77736b}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center;gap:22px;padding-bottom:6px}
/* Brand yellow: the label above the headline and the action bottom right. */
.kick{align-self:flex-start;background:#e8ff3c;color:#141414;font-size:14px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;padding:9px 14px 8px 16px;border-radius:2px}
h1{font-family:'Playfair Display',serif;font-weight:500;font-size:var(--hs,64px);line-height:1.06;letter-spacing:-.015em;text-wrap:balance}
.sub{font-size:24px;line-height:1.45;font-weight:400;color:#5d5a54;max-width:500px;text-wrap:pretty}
.foot{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #cfcbc2;padding-top:16px}
.foot .cap:first-child{color:#141414}
.foot .go{display:flex;align-items:center;gap:10px;background:#e8ff3c;color:#141414;font-weight:600;padding:11px 18px 10px 20px;border-radius:999px}
.go::after{content:"";width:22px;height:1.5px;background:currentColor}
body.dark{background:#121212;color:#f4f2ed}
body.dark .sub{color:#a9a69f}
body.dark .cap{color:#8f8c85}body.dark .foot .cap:first-child{color:#f4f2ed}body.dark .foot .go{color:#141414}
body.dark .foot{border-color:#3a3936}
"""


def card_html(c):
    c = dict(c, headline=NB(c['headline']))
    dark = c.get('dark')
    logo = f"file://{HERE}/{'logo-white' if dark else 'logo-ink'}.png"
    if c.get('layout') == 'trio':
        cells = ''.join(f'<div class="cell"><img src="file://{IMG}{p}" style="object-position:{pos}"></div>' for p, pos in c['photos'])
        photo = f'<div class="photo trio">{cells}</div>'
    else:
        z = ZOOM.get(c['photo'])
        photo = f"""<div class="photo" style="--pos:{c.get('pos', '50% 50%')}"><img src="file://{IMG}{c['photo']}"{f' style="transform:scale({z})"' if z else ''}></div>"""
    sub = f'<p class="sub">{c["sub"]}</p>' if c.get('sub') else ''
    hs = f' style="--hs:{c["hs"]}"' if c.get('hs') else ''
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{CSS}</style></head>
<body class="{'dark' if dark else ''}">
{photo}
<div class="panel"><div class="top"><img class="logo" src="{logo}"><span class="cap">{E(c.get('place', 'Montréal'))}</span></div>
<div class="mid"><span class="kick">{E(c['kicker'])}</span><h1{hs}>{c['headline']}</h1>{sub}</div>
<div class="foot"><span class="cap">{c.get('domain', 'singhsprint.com')}</span><span class="cap go">{E(c['cta'])}</span></div></div>
</body></html>"""


if __name__ == '__main__':
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    out = sys.argv[2]
    os.makedirs(out + '/html', exist_ok=True)
    for c in spec:
        open(f"{out}/html/{c['id']}.html", 'w', encoding='utf-8').write(card_html(c))
    print(len(spec))
