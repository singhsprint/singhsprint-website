#!/usr/bin/env python3
"""Generates the gift-box pages (EN + /fr/) from one template so the two
languages never drift. Run from the site root:  python3 scripts/build_gifts.py
Writes gifts.html, gifts/build.html, gifts/order.html and the fr/ mirrors."""
import json, os

ORIGIN = 'https://www.singhsprint.com'

C = {
 'en': dict(
  base='', other='/fr', title='Client Gift Boxes | Singhs Print — Branded Corporate Gifts, Montreal',
  desc="Branded client gift boxes your clients actually wear. Pick 2-3 pieces, add your logo, paste your client list - each client picks their own size and we ship to every door. From 10 boxes.",
  eyebrow='Client gift boxes · Montreal',
  h1='Gifts your clients <span class="gx-hl">actually wear.</span>',
  lead="A kraft box with 2-3 pieces of good gear, your logo kept small and tasteful, and a card in your words. You send us the list - each client picks their own size, and we ship to every door.",
  cta1='Build your box', cta2='Have us build it',
  facts=['From 10 boxes', 'Each client picks their size', 'Shipped to each door', 'EN / FR cards'],
  lid='YOUR LOGO', card_h='Thanks for a great year.', card_p="Hope this keeps you warm on the next site visit.", card_s='- Maya, Rivière Realty', seal='THANK<br>YOU',
  who=[('Realtors','closing gifts'),('Mortgage & insurance','referral partners'),('Contractors','past clients'),('Dealerships','new owners'),('Teams','onboarding & holidays')],
  how_e='How it works', how_h='Four steps. <span class="gx-hl">No size spreadsheet.</span>',
  how_p="The hard part of gifting apparel is sizes. We took it off your plate.",
  steps=[('Pick the pieces','Start from a tier or a budget. Tees, crewnecks, quarter-zips, caps - the same catalog as our shop.'),
         ('Add your logo','Upload it once. We keep it small and tonal by default, because that’s what gets worn.'),
         ('Paste your client list','Name and email is enough. Each client gets a private link to pick a size and confirm an address.'),
         ('We pack and ship','Mockups first - nothing is made until you approve. Then each box ships with its own tracking.')],
  size_e='The size problem, solved', size_h='Your clients pick their own size.',
  size_p="Every client gets a short, private link - in English or French. They pick a size for each piece and confirm where to ship it. You watch it fill in from your order page.",
  size_list=['Reminders on day 2 and day 5, so you don’t have to chase anyone',
             'No answer after 14 days? We ship your default size',
             'English or French, whichever they read',
             'Addresses stay with us, used only to ship the box'],
  ph_from='A gift from Rivière Realty', ph_h='Hi Daniel - pick your sizes', ph_cap='Richardson 112 cap', ph_crew='Crewneck, small logo', ph_addr='Ship to: 214 rue Sainte-Anne, Sainte-Anne-de-Bellevue', ph_go='Confirm my sizes',
  tiers_e='Three ways to start', tiers_h='Pick a tier, then make it yours.',
  tiers_p="Prices are per client, box, card, tissue and shipping to each door included. Swap any piece in the builder - the price updates as you go.",
  tiers=[('starter','Starter','80',['A good tee, small logo','Embroidered cap','Kraft box, tissue, card'], 'product-tshirt-white.jpg','product-hat-artwood.jpg',''),
         ('signature','Signature','165',['Quarter-zip or crewneck','Embroidered cap','Tee','Kraft box, tissue, card'], 'product-crewneck-mcgill.jpg','product-hat-artwood.jpg','Most picked'),
         ('premium','Premium','195',['Heavyweight fleece or soft-shell','Embroidered cap','Tee','Printed box available'], 'product-hoodie-concordia.jpg','product-polo.jpg','')],
  from_='around', per='/ client', start_tier='Start with',
  subtle_e='Why small logos', subtle_h='A gift, not a uniform.',
  subtle_p="Clients keep gear they’d buy for themselves. A tonal logo on the chest or sleeve gets worn on weekends for years. A big one ends up in a drawer. We default to subtle, and you can always go bolder for your own team.",
  subtle_tag='Small embroidered mark on a natural crewneck',
  subtle_list=['Tonal or one-colour, 3 to 3.5 in wide','Embroidery on caps and quarter-zips, always','We clean up your logo file for free'],
  doors_e='Two ways to order', doors_h='Do it yourself, or hand it to us.',
  d1_meta='About 10 minutes · pay online', d1_h='Build it yourself', d1_p="Pick the pieces, place your logo, paste your list, pay. Live pricing the whole way.",
  d1_list=['See the price per client as you go','50% deposit on orders over $1,200','Mockups within 1 business day'], d1_cta='Start building',
  d2_meta='2-minute form · no payment', d2_h='Have us build it', d2_p="Tell us the budget, who it’s for and send your logo. We pick the pieces and send mockups.",
  d2_list=['Pieces picked for your clients and budget','Mockups of the gear and the box','One click to approve'], d2_cta='Tell us about the box',
  inbox_e="What’s in every box", inbox_h='Unboxing, handled.',
  inbox=[('Kraft mailer','With your logo sticker on the lid. Printed box available.'),('Tissue + seal','Wrapped in tissue, closed with a logo seal.'),('The gear','2-3 pieces, folded and sized per client.'),('A printed card','Your message, EN, FR or both. Handwritten upgrade.'),('Plain outer box','So it shows up looking like a gift, not a delivery.')],
  faq_e='Questions', faq_h='Good to know',
  faq=[('What’s the minimum?','10 boxes, in steps of 5, up to 100 per order. Over 25 boxes the setup fee is waived and volume pricing kicks in.'),
       ('How long does it take?','Mockups within 1 business day. Production starts once you approve and the sizes are in. Tell us the date you need them by and we’ll confirm it works before you pay.'),
       ('Do I need everyone’s size and address?','No. Just a name and an email per client. They pick their own size and confirm their address from a private link.'),
       ('What if someone doesn’t answer?','We remind them on day 2 and day 5. After 14 days we ship your default size to the address you gave us.'),
       ('Can I see it before you make it?','Yes. You get photo-real mockups of every piece and the box lid. Nothing is printed until you approve.'),
       ('Can you deliver all the boxes to my office instead?','Yes. Pick "Deliver to me" and we bring the boxes in bulk, which lowers the price.')],
  fin_h='Ready when your list is.', fin_p="Start the box now - your draft saves as you go. Or hand it to us and get mockups tomorrow.",
  b_title='Build your gift box | Singhs Print', b_eyebrow='Client gift boxes', b_h1='Build your gift box', b_p="Pick the pieces, add your logo, paste your client list. Or hand it to us and we’ll build it.",
  b_crumb='Gift boxes',
  f1_h='Build it myself', f1_p='Live pricing · about 10 minutes', f2_h='Have us build it', f2_p='2-minute form · mockups in 1 business day',
  o_title='Your gift boxes | Singhs Print', o_h1='Your gift boxes',
  loading='Loading…', noscript='This page needs JavaScript. Email sales@singhsprint.com and we’ll set it up for you.',
 ),
 'fr': dict(
  base='/fr', other='', title='Boîtes-cadeaux clients | Singhs Print — Cadeaux d’affaires personnalisés, Montréal',
  desc="Des boîtes-cadeaux à votre image que vos clients portent vraiment. 2-3 morceaux, votre logo, votre liste de clients - chacun choisit sa taille et on livre à chaque porte. Dès 10 boîtes.",
  eyebrow='Boîtes-cadeaux clients · Montréal',
  h1='Des cadeaux que vos clients <span class="gx-hl">portent vraiment.</span>',
  lead="Une boîte kraft avec 2-3 beaux morceaux, votre logo discret et de bon goût, et une carte avec vos mots. Vous nous donnez la liste - chaque client choisit sa taille, et on livre à chaque porte.",
  cta1='Composer ma boîte', cta2='On s’en occupe',
  facts=['Dès 10 boîtes', 'Chaque client choisit sa taille', 'Livré à chaque porte', 'Cartes FR / EN'],
  lid='VOTRE LOGO', card_h='Merci pour cette belle année.', card_p="De quoi rester au chaud lors de la prochaine visite.", card_s='- Maya, Immobilier Rivière', seal='MERCI',
  who=[('Courtiers immobiliers','cadeaux de clôture'),('Hypothèque et assurance','partenaires de référence'),('Entrepreneurs','anciens clients'),('Concessionnaires','nouveaux propriétaires'),('Équipes','accueil et Fêtes')],
  how_e='Comment ça marche', how_h='Quatre étapes. <span class="gx-hl">Aucun tableau de tailles.</span>',
  how_p="Le plus dur avec les vêtements en cadeau, ce sont les tailles. On s’en charge.",
  steps=[('Choisissez les morceaux','Partez d’un forfait ou d’un budget. T-shirts, cols ronds, quart-de-zip, casquettes - le même catalogue que la boutique.'),
         ('Ajoutez votre logo','Téléversez-le une fois. Par défaut on le garde petit et ton sur ton, parce que c’est ce qui se porte.'),
         ('Collez votre liste','Nom et courriel suffisent. Chaque client reçoit un lien privé pour choisir sa taille et confirmer son adresse.'),
         ('On emballe et on expédie','Les maquettes d’abord - rien n’est fabriqué avant votre approbation. Puis chaque boîte part avec son suivi.')],
  size_e='Le problème des tailles, réglé', size_h='Vos clients choisissent leur taille.',
  size_p="Chaque client reçoit un lien court et privé, en français ou en anglais. Il choisit une taille par morceau et confirme son adresse. Vous suivez le tout de votre page de commande.",
  size_list=['Rappels aux jours 2 et 5 - vous n’avez personne à relancer',
             'Pas de réponse après 14 jours? On envoie votre taille par défaut',
             'En français ou en anglais, selon le client',
             'Les adresses restent chez nous, seulement pour l’envoi'],
  ph_from='Un cadeau d’Immobilier Rivière', ph_h='Bonjour Daniel - vos tailles', ph_cap='Casquette Richardson 112', ph_crew='Col rond, petit logo', ph_addr='Livrer à : 214 rue Sainte-Anne, Sainte-Anne-de-Bellevue', ph_go='Confirmer mes tailles',
  tiers_e='Trois façons de commencer', tiers_h='Choisissez un forfait, puis personnalisez.',
  tiers_p="Prix par client, boîte, carte, papier de soie et livraison à chaque porte compris. Changez n’importe quel morceau dans l’outil - le prix suit.",
  tiers=[('starter','Essentiel','80',['Un bon t-shirt, petit logo','Casquette brodée','Boîte kraft, papier de soie, carte'], 'product-tshirt-white.jpg','product-hat-artwood.jpg',''),
         ('signature','Signature','165',['Quart-de-zip ou col rond','Casquette brodée','T-shirt','Boîte kraft, papier de soie, carte'], 'product-crewneck-mcgill.jpg','product-hat-artwood.jpg','Le plus choisi'),
         ('premium','Premium','195',['Molleton épais ou coquille souple','Casquette brodée','T-shirt','Boîte imprimée offerte'], 'product-hoodie-concordia.jpg','product-polo.jpg','')],
  from_='environ', per='/ client', start_tier='Commencer avec',
  subtle_e='Pourquoi un petit logo', subtle_h='Un cadeau, pas un uniforme.',
  subtle_p="On garde les vêtements qu’on aurait achetés soi-même. Un logo ton sur ton sur la poitrine ou la manche se porte la fin de semaine pendant des années. Un gros logo finit dans un tiroir. Par défaut on reste discret - vous pouvez toujours oser plus pour votre équipe.",
  subtle_tag='Petite broderie sur un col rond naturel',
  subtle_list=['Ton sur ton ou une couleur, 3 à 3,5 po de large','Toujours brodé sur casquettes et quart-de-zip','On nettoie votre fichier logo gratuitement'],
  doors_e='Deux façons de commander', doors_h='Faites-le vous-même, ou confiez-le-nous.',
  d1_meta='Environ 10 minutes · paiement en ligne', d1_h='Je compose ma boîte', d1_p="Choisissez les morceaux, placez votre logo, collez votre liste, payez. Prix en direct tout du long.",
  d1_list=['Le prix par client, en direct','Dépôt de 50 % sur les commandes de plus de 1 200 $','Maquettes en 1 jour ouvrable'], d1_cta='Commencer',
  d2_meta='Formulaire de 2 minutes · aucun paiement', d2_h='On s’en occupe', d2_p="Dites-nous le budget, pour qui c’est et envoyez votre logo. On choisit les morceaux et on vous envoie les maquettes.",
  d2_list=['Morceaux choisis selon vos clients et votre budget','Maquettes des vêtements et de la boîte','Un clic pour approuver'], d2_cta='Parlez-nous de la boîte',
  inbox_e='Dans chaque boîte', inbox_h='Le déballage, on s’en charge.',
  inbox=[('Boîte kraft','Avec votre autocollant logo sur le couvercle. Boîte imprimée offerte.'),('Papier de soie + sceau','Emballé dans du papier de soie, fermé d’un sceau logo.'),('Les vêtements','2-3 morceaux, pliés, à la taille de chaque client.'),('Une carte imprimée','Votre message, FR, EN ou les deux. Option manuscrite.'),('Boîte d’expédition neutre','Pour arriver comme un cadeau, pas comme un colis.')],
  faq_e='Questions', faq_h='Bon à savoir',
  faq=[('Quel est le minimum?','10 boîtes, par tranches de 5, jusqu’à 100 par commande. À partir de 25 boîtes, les frais de mise en route sont annulés et le prix de volume s’applique.'),
       ('Combien de temps ça prend?','Maquettes en 1 jour ouvrable. La production commence une fois les maquettes approuvées et les tailles reçues. Donnez-nous votre date limite, on vous confirme que ça marche avant le paiement.'),
       ('Me faut-il la taille et l’adresse de tout le monde?','Non. Un nom et un courriel par client. Chacun choisit sa taille et confirme son adresse à partir d’un lien privé.'),
       ('Et si quelqu’un ne répond pas?','On le relance aux jours 2 et 5. Après 14 jours, on envoie votre taille par défaut à l’adresse fournie.'),
       ('Puis-je voir avant la production?','Oui. Vous recevez des maquettes photo de chaque morceau et du couvercle. Rien n’est imprimé avant votre approbation.'),
       ('Pouvez-vous tout livrer à mon bureau?','Oui. Choisissez « Livrer chez moi » et on apporte les boîtes en lot, ce qui baisse le prix.')],
  fin_h='Prêt quand votre liste l’est.', fin_p="Commencez la boîte maintenant - le brouillon s’enregistre. Ou confiez-la-nous et recevez les maquettes demain.",
  b_title='Composez votre boîte-cadeau | Singhs Print', b_eyebrow='Boîtes-cadeaux clients', b_h1='Composez votre boîte-cadeau', b_p="Choisissez les morceaux, ajoutez votre logo, collez votre liste. Ou confiez-la-nous et on la compose.",
  b_crumb='Boîtes-cadeaux',
  f1_h='Je la compose', f1_p='Prix en direct · environ 10 minutes', f2_h='On s’en occupe', f2_p='Formulaire de 2 minutes · maquettes en 1 jour ouvrable',
  o_title='Vos boîtes-cadeaux | Singhs Print', o_h1='Vos boîtes-cadeaux',
  loading='Chargement…', noscript='Cette page a besoin de JavaScript. Écrivez à sales@singhsprint.com et on s’en occupe.',
 ),
}

ICONS = [
 '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 8l9-4 9 4v9l-9 4-9-4z"/><path d="M3 8l9 4 9-4M12 12v9"/></svg>',
 '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>',
 '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4 8 8 5l1 2c.7 1 1.8 1.5 3 1.5s2.3-.5 3-1.5l1-2 4 3-3 4v9H7v-9L4 8z"/></svg>',
 '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M7 10h10M7 13h7"/></svg>',
 '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="1"/><path d="M3 11h18M10 7V4h4v3"/></svg>',
]

def head(L, title, desc, path, robots=None):
    c = C[L]
    en = ORIGIN + path; fr = ORIGIN + '/fr' + path
    return f'''<!DOCTYPE html>
<html lang="{L}">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/images/favicon-180.png">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <meta name="description" content="{desc}">
{'  <meta name="robots" content="'+robots+'">' if robots else ''}
  <link rel="canonical" href="{en if L=='en' else fr}">
  <link rel="alternate" hreflang="en" href="{en}">
  <link rel="alternate" hreflang="fr" href="{fr}">
  <link rel="alternate" hreflang="x-default" href="{en}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="{ORIGIN}/images/hero-duo.jpg">
  <meta property="og:url" content="{en if L=='en' else fr}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://singhsprint-crm.vercel.app" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap">
  <link rel="stylesheet" href="/gifts.css">
'''

def foot(page):
    return f'''  <div id="footer-placeholder"></div>

  <script src="/components.js" defer></script>
  <script src="/consent.js" defer></script>
  <script src="/lang.js" defer></script>
{'  <script src="/offer-popup.js" defer></script>'+chr(10) if page=='landing' else ''}  <script src="/ai-translate.js" defer></script>
  <script src="/gifts.js" data-page="{page}" defer></script>
</body>
</html>
'''

def landing(L):
    c = C[L]; B = c['base']
    faq_ld = {"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in c['faq']]}
    svc_ld = {"@context":"https://schema.org","@type":"Service","name":"Client gift boxes" if L=='en' else "Boîtes-cadeaux clients","serviceType":"Corporate gifting","provider":{"@type":"LocalBusiness","name":"Singhs Print","url":ORIGIN,"telephone":"+1-438-544-3800","address":{"@type":"PostalAddress","addressLocality":"Sainte-Anne-de-Bellevue","addressRegion":"QC","addressCountry":"CA"}},"areaServed":"CA","offers":{"@type":"AggregateOffer","priceCurrency":"CAD","lowPrice":"80"}}
    h = head(L, c['title'], c['desc'], '/gifts')
    h += f'  <script type="application/ld+json">{json.dumps(faq_ld, ensure_ascii=False)}</script>\n  <script type="application/ld+json">{json.dumps(svc_ld, ensure_ascii=False)}</script>\n</head>\n<body>\n  <div id="nav-placeholder"></div>\n\n'
    facts = ''.join(f'<span>{f}</span>' for f in c['facts'])
    who = '<span class="dot"></span>'.join(f'<span><b>{a}</b> · {b}</span>' for a,b in c['who'])
    steps = ''.join(f'<div class="gx-step"><h3>{a}</h3><p>{b}</p></div>' for a,b in c['steps'])
    sizes = ''.join(f'<li>{x}</li>' for x in c['size_list'])
    tiers = ''
    for k,n,p,lst,i1,i2,badge in c['tiers']:
        tiers += f'''<a class="gx-tier{' feat' if badge else ''}" href="{B}/gifts/build?tier={k}">
        <div class="pics">{f'<span class="badge">{badge}</span>' if badge else ''}<img src="/images/{i1}" alt="" loading="lazy"><img src="/images/{i2}" alt="" loading="lazy"></div>
        <div class="body"><h3>{n}</h3><div class="price">{c['from_']} <b>${p}</b> {c['per']}</div>
        <ul>{''.join(f'<li>{x}</li>' for x in lst)}</ul>
        <span class="gx-btn sm{'' if badge else ' ghost'}">{c['start_tier']} {n} →</span></div></a>
      '''
    subtle = ''.join(f'<li>{x}</li>' for x in c['subtle_list'])
    inbox = ''.join(f'<div>{ICONS[i]}<b>{a}</b>{b}</div>' for i,(a,b) in enumerate(c['inbox']))
    faq = ''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q,a in c['faq'])
    body = f'''  <section class="gx-hero">
    <div class="gx-wrap">
      <div>
        <div class="gx-eyebrow">{c['eyebrow']}</div>
        <h1>{c['h1']}</h1>
        <p class="lead">{c['lead']}</p>
        <div class="gx-cta-row">
          <a class="gx-btn" href="{B}/gifts/build">{c['cta1']} →</a>
          <a class="gx-btn ghost" href="{B}/gifts/build?path=concierge">{c['cta2']}</a>
        </div>
        <div class="gx-facts">{facts}</div>
      </div>
      <div class="gx-box" aria-hidden="true">
        <div class="gx-lid"><span>{c['lid']}</span></div>
        <div class="gx-tray"><div class="gx-tissue">
          <div class="gx-piece a"><img src="/images/product-crewneck-mcgill.jpg" alt=""></div>
          <div class="gx-piece b"><img src="/images/product-hat-artwood.jpg" alt=""></div>
          <div class="gx-piece c"><img src="/images/product-polo.jpg" alt=""></div>
          <div class="gx-seal">{c['seal']}</div>
          <div class="gx-card"><b>{c['card_h']}</b>{c['card_p']}<i>{c['card_s']}</i></div>
        </div></div>
      </div>
    </div>
  </section>

  <div class="gx-who"><div class="gx-wrap">{who}</div></div>

  <section class="gx-sec" id="how">
    <div class="gx-wrap">
      <div class="gx-eyebrow">{c['how_e']}</div>
      <h2 class="gx-h2">{c['how_h']}</h2>
      <p class="gx-lead">{c['how_p']}</p>
      <div class="gx-steps">{steps}</div>
    </div>
  </section>

  <section class="gx-sec alt">
    <div class="gx-wrap gx-split">
      <div>
        <div class="gx-eyebrow">{c['size_e']}</div>
        <h2 class="gx-h2">{c['size_h']}</h2>
        <p class="gx-lead">{c['size_p']}</p>
        <ul class="gx-list">{sizes}</ul>
      </div>
      <div class="gx-phone" aria-hidden="true"><div class="gx-screen">
        <div class="from">{c['ph_from']}</div>
        <h4>{c['ph_h']}</h4>
        <div class="item"><img src="/images/product-crewneck-mcgill.jpg" alt=""><div><b>{c['ph_crew']}</b><div class="gx-sizes"><i>S</i><i>M</i><i class="on">L</i><i>XL</i><i>2XL</i></div></div></div>
        <div class="item"><img src="/images/product-hat-artwood.jpg" alt=""><div><b>{c['ph_cap']}</b><div class="gx-sizes"><i class="on">OSFA</i></div></div></div>
        <div class="item"><img src="/images/product-tshirt-white.jpg" alt=""><div><b>Tee</b><div class="gx-sizes"><i>S</i><i class="on">M</i><i>L</i><i>XL</i></div></div></div>
        <div class="addr">{c['ph_addr']}</div>
        <span class="go">{c['ph_go']} →</span>
      </div></div>
    </div>
  </section>

  <section class="gx-sec">
    <div class="gx-wrap">
      <div class="gx-eyebrow">{c['tiers_e']}</div>
      <h2 class="gx-h2">{c['tiers_h']}</h2>
      <p class="gx-lead">{c['tiers_p']}</p>
      <div class="gx-tiers">
      {tiers}</div>
    </div>
  </section>

  <section class="gx-sec alt">
    <div class="gx-wrap gx-split rev">
      <div>
        <div class="gx-eyebrow">{c['subtle_e']}</div>
        <h2 class="gx-h2">{c['subtle_h']}</h2>
        <p class="gx-lead">{c['subtle_p']}</p>
        <ul class="gx-list">{subtle}</ul>
      </div>
      <div class="gx-photo"><img src="/images/hero-duo.jpg" alt="" loading="lazy"><span class="tag">{c['subtle_tag']}</span></div>
    </div>
  </section>

  <section class="gx-sec">
    <div class="gx-wrap">
      <div class="gx-eyebrow">{c['doors_e']}</div>
      <h2 class="gx-h2">{c['doors_h']}</h2>
      <div class="gx-doors">
        <div class="gx-door dark"><div class="meta">{c['d1_meta']}</div><h3>{c['d1_h']}</h3><p>{c['d1_p']}</p><ul>{''.join(f'<li>{x}</li>' for x in c['d1_list'])}</ul><a class="gx-btn hi" href="{B}/gifts/build">{c['d1_cta']} →</a></div>
        <div class="gx-door light"><div class="meta">{c['d2_meta']}</div><h3>{c['d2_h']}</h3><p>{c['d2_p']}</p><ul>{''.join(f'<li>{x}</li>' for x in c['d2_list'])}</ul><a class="gx-btn" href="{B}/gifts/build?path=concierge">{c['d2_cta']} →</a></div>
      </div>
    </div>
  </section>

  <section class="gx-sec alt">
    <div class="gx-wrap">
      <div class="gx-eyebrow">{c['inbox_e']}</div>
      <h2 class="gx-h2">{c['inbox_h']}</h2>
      <div class="gx-inbox">{inbox}</div>
    </div>
  </section>

  <section class="gx-sec">
    <div class="gx-wrap">
      <div style="text-align:center"><div class="gx-eyebrow">{c['faq_e']}</div><h2 class="gx-h2">{c['faq_h']}</h2></div>
      <div class="gx-faq">{faq}</div>
    </div>
  </section>

  <section class="gx-sec" style="padding-top:0">
    <div class="gx-wrap"><div class="gx-final">
      <h2>{c['fin_h']}</h2><p>{c['fin_p']}</p>
      <div class="gx-cta-row"><a class="gx-btn hi" href="{B}/gifts/build">{c['cta1']} →</a><a class="gx-btn ghost" href="{B}/gifts/build?path=concierge">{c['cta2']}</a></div>
    </div></div>
  </section>

'''
    return h + body + foot('landing')

def app(L, page):
    c = C[L]; B = c['base']
    if page == 'build':
        h = head(L, c['b_title'], c['desc'], '/gifts/build', 'noindex, follow') + '</head>\n<body>\n  <div id="nav-placeholder"></div>\n\n'
        body = f'''  <div class="gx-wrap">
    <header class="gb-head">
      <div class="gb-crumb"><a href="{B}/gifts">{c['b_crumb']}</a> / {c['b_h1']}</div>
      <h1>{c['b_h1']}</h1>
      <p>{c['b_p']}</p>
      <div class="gb-fork" id="gbFork">
        <button type="button" data-path="self"><b>{c['f1_h']}</b><span>{c['f1_p']}</span></button>
        <button type="button" data-path="concierge"><b>{c['f2_h']}</b><span>{c['f2_p']}</span></button>
      </div>
    </header>
    <main class="gb-app" id="gbApp"><p class="gb-note">{c['loading']}</p></main>
    <noscript><p class="gb-err">{c['noscript']}</p></noscript>
  </div>

'''
    else:
        h = head(L, c['o_title'], c['desc'], '/gifts/order', 'noindex, nofollow') + '</head>\n<body>\n  <div id="nav-placeholder"></div>\n\n'
        body = f'''  <div class="gx-wrap">
    <main class="gb-app" id="goApp"><p class="gb-note" style="padding:40px 0">{c['loading']}</p></main>
    <noscript><p class="gb-err">{c['noscript']}</p></noscript>
  </div>

'''
    return h + body + foot(page)

def w(path, s):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    open(path, 'w').write(s); print('wrote', path, len(s))

for L in ('en', 'fr'):
    p = '' if L == 'en' else 'fr/'
    w(f'{p}gifts.html', landing(L))
    w(f'{p}gifts/build.html', app(L, 'build'))
    w(f'{p}gifts/order.html', app(L, 'order'))
