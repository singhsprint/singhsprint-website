"""Every share card: id, photo, and EN/FR words. Photos are catalogue shots of
blanks we sell (photos/, listed with their products in photos/SOURCES.json). Writes spec.json (for card.py)
and cards.json (the words, for apply.py and the checker)."""
import html, json, re

T = lambda en, fr: {'en': en, 'fr': fr}

# id: (photo, focus, kicker, headline, sub)
SITE = {
    'why-us': ('tee-next-level-3600.jpg', '50% 20%', T('Why Singhs Print', 'Pourquoi Singhs Print'),
               T('Why people switch to us', 'Pourquoi on nous choisit'),
               T('Live pricing, a 5-piece minimum and a mockup you approve first.', 'Prix en direct, minimum de 5 pièces et une maquette à approuver d’abord.')),
    'about': ('crew-bella-canvas-3945.jpg', '50% 20%', T('About us', 'À propos'),
              T('A family print shop in Montréal', 'Une imprimerie familiale à Montréal'),
              T('DTG, DTF and embroidery on the West Island.', 'DTG, DTF et broderie dans l’Ouest-de-l’Île.')),
    'tshirts': ('tee-comfort-colors-1717.jpg', '50% 20%', T('Custom T-shirts', 'T-shirts personnalisés'),
                T('Custom T-shirts, from 5 pieces', 'T-shirts personnalisés, dès 5 pièces'),
                T('DTG and DTF printing, with a mockup before we print.', 'Impression DTG et DTF, avec une maquette avant d’imprimer.')),
    'hoodies': ('hoodie-independent-ss4500.jpg', '50% 20%', T('Custom hoodies', 'Hoodies personnalisés'),
                T('Printed & embroidered hoodies', 'Hoodies imprimés et brodés'),
                T('From 5 pieces, with a mockup before we print.', 'Dès 5 pièces, avec une maquette avant d’imprimer.')),
    'caps': ('cap-comfort-colors-ccsc0.jpg', '50% 20%', T('Caps & toques', 'Casquettes et tuques'),
             T('Embroidered caps & toques', 'Casquettes et tuques brodées'),
             T('Your logo stitched on, from 5 pieces.', 'Votre logo brodé, dès 5 pièces.')),
    'embroidery': ('polo-core365-ce112.jpg', '50% 20%', T('Embroidery', 'Broderie'),
                   T('Logo embroidery', 'Broderie de logo'),
                   T('Polos, caps, hoodies and uniforms, stitched in our studio.', 'Polos, casquettes, hoodies et uniformes, brodés à l’atelier.')),
    'dtg': ('tee-mo-6500m.jpg', '50% 20%', T('DTG printing', 'Impression DTG'),
            T('Direct-to-garment printing', 'Impression directe sur vêtement'),
            T('Photo-quality, soft-feel prints. Five shirts or a thousand.', 'Qualité photo, toucher doux. Cinq t-shirts ou mille.')),
    'dtf': ('tee-champion-t425.jpg', '50% 20%', T('DTF transfers', 'Transferts DTF'),
            T('DTF transfers on any fabric', 'Transferts DTF sur tout tissu'),
            T('Vivid, durable prints from 5 pieces.', 'Des couleurs vives et durables, dès 5 pièces.')),
    'catalog': ('crew-gildan-sf000.jpg', '50% 20%', T('Catalogue', 'Catalogue'),
                T('4,600 blanks, live pricing', '4 600 vêtements, prix en direct'),
                T('Every colour and size, priced at your quantity.', 'Toutes les couleurs et tailles, au prix de votre quantité.')),
    'quote': ('tee-gildan-64000.jpg', '50% 20%', T('Get a quote', 'Demander un prix'),
              T('Get a quote in minutes', 'Un prix en quelques minutes'),
              T('Pick a garment, upload your design, see the price.', 'Choisissez un vêtement, envoyez votre design, voyez le prix.')),
    'portfolio': ('longsleeve-comfort-colors-6014.jpg', '50% 20%', T('Portfolio', 'Portfolio'),
                  T('Recent work', 'Nos réalisations'),
                  T('Custom apparel for Montréal brands, businesses and creators.', 'Vêtements personnalisés pour des marques, entreprises et créateurs de Montréal.')),
    'inkwear': ('tee-comfort-colors-6030.jpg', '50% 20%', T('Our own line', 'Notre collection'),
                T('Inkwear', 'Inkwear'),
                T('Limited-run drops, printed in Montréal.', 'Des éditions limitées, imprimées à Montréal.')),
    'businesses': ('polo-gildan-64800.jpg', '50% 20%', T('For businesses', 'Entreprises'),
                   T('Apparel programs for your team', 'Des programmes vestimentaires pour votre équipe'),
                   T('Uniforms, staff merch and event apparel for 50+ people.', 'Uniformes, articles promotionnels et tenues d’événement pour 50 personnes et plus.')),
    'rfp': ('polo-adidas-a514.jpg', '50% 20%', T('Procurement', 'Approvisionnement'),
            T('Request procurement pricing', 'Demande de prix pour approvisionnement'),
            T('Volume pricing tiers and account management for organisations.', 'Paliers de prix au volume et gestion de compte pour les organisations.')),
    'jerseys': ('jersey-high-five-322992.jpg', '50% 20%', T('Team jerseys', 'Chandails d’équipe'),
                T('Custom team jerseys', 'Chandails d’équipe personnalisés'),
                T('Names, numbers and crests for your team.', 'Noms, numéros et écussons pour votre équipe.')),
    'gifts': ('crew-next-level-9003.jpg', '50% 20%', T('Client gift boxes', 'Boîtes-cadeaux clients'),
              T('Gift boxes clients actually wear', 'Des cadeaux que vos clients porteront vraiment'),
              T('Your logo on 2–3 pieces. Each client picks their size; we ship to every door.', 'Votre logo sur 2 ou 3 pièces. Chaque client choisit sa taille, on livre à chacun.')),
    'gifts-build': ('crew-american-apparel-rf494.jpg', '50% 20%', T('Client gift boxes', 'Boîtes-cadeaux clients'),
                    T('Build your gift box', 'Composez votre boîte-cadeau'),
                    T('Pick 2–3 pieces and add your logo. From 10 boxes.', 'Choisissez 2 ou 3 pièces et ajoutez votre logo. Dès 10 boîtes.')),
    'gifts-order': ('crew-comfort-colors-1566.jpg', '50% 20%', T('Client gift boxes', 'Boîtes-cadeaux clients'),
                    T('Your gift boxes', 'Vos boîtes-cadeaux'),
                    T('See who has picked a size and where every box is.', 'Voyez qui a choisi sa taille et où en est chaque boîte.')),
    'guides': ('longsleeve-gildan-5400.jpg', '50% 20%', T('Guides', 'Guides'),
               T('Custom apparel guides', 'Guides du vêtement personnalisé'),
               T('Durability, sizing, timelines and cost, explained plainly.', 'Durabilité, tailles, délais et coûts, expliqués simplement.')),
    'charity': ('tee-comfort-colors-1717.jpg', '50% 20%', T('Charity & events', 'Organismes et événements'),
                T('Charity run & event apparel', 'Vêtements pour courses et événements'),
                T('Race shirts, volunteer tees and sponsor logos.', 'T-shirts de course, de bénévoles et logos de commanditaires.')),
    'construction': ('hivis-tough-duck-sv07.jpg', '50% 20%', T('Construction', 'Construction'),
                     T('Construction workwear', 'Vêtements de travail pour la construction'),
                     T('Hi-vis, hoodies and durable workwear for your crew.', 'Haute visibilité, hoodies et vêtements robustes pour votre équipe.')),
    'corporate': ('puffer-core365-ce700.jpg', '50% 20%', T('Corporate & tech', 'Entreprises et techno'),
                  T('Corporate & tech swag', 'Articles promotionnels d’entreprise'),
                  T('Onboarding kits, conference apparel and team merch.', 'Trousses d’accueil, tenues de congrès et articles d’équipe.')),
    'restaurant': ('apron-biz-ba54.jpg', '50% 20%', T('Restaurants', 'Restauration'),
                   T('Restaurant & hospitality uniforms', 'Uniformes pour la restauration'),
                   T('Aprons, polos and staff tees, with fast reorders.', 'Tabliers, polos et t-shirts d’équipe, avec recommandes rapides.')),
    'schools': ('hoodie-comfort-colors-1567.jpg', '50% 20%', T('Schools & teams', 'Écoles et équipes'),
                T('School & sports team apparel', 'Vêtements pour écoles et équipes sportives'),
                T('Spirit wear, jerseys and embroidered crests.', 'Vêtements d’école, chandails et écussons brodés.')),
    'youth': ('toque-atc-y100.jpg', '50% 20%', T('Youth initiative', 'Initiative jeunesse'),
              T('Free shirts for kids doing good', 'T-shirts gratuits pour jeunes engagés'),
              T('Under 16 and raising money for charity? Up to 10 shirts on us.', 'Moins de 16 ans et une collecte pour un organisme? Jusqu’à 10 t-shirts offerts.')),
    'drops': ('tote-ideal-id300.jpg', '50% 20%', T('Drops', 'Éditions limitées'),
              T('Limited drops', 'Éditions limitées'),
              T('Designed, printed and shipped from Montréal.', 'Conçues, imprimées et expédiées de Montréal.')),
    'drop-policies': ('tote-q-tees-qtb.jpg', '50% 20%', T('Drops', 'Éditions limitées'),
                      T('Drop policies', 'Politiques des éditions limitées'),
                      T('Shipping, returns and sizing for drops.', 'Livraison, retours et tailles des éditions limitées.')),
    'order': ('longsleeve-gildan-64400.jpg', '50% 20%', T('Your order', 'Votre commande'),
              T('Track your order', 'Suivez votre commande'),
              T('See where your order is, from mockup to delivery.', 'Voyez où en est votre commande, de la maquette à la livraison.')),
    'bulk': ('crew-comfort-colors-1566.jpg', '50% 20%', T('Bulk orders', 'Commandes en gros'),
             T('Bulk apparel printing', 'Impression de vêtements en gros'),
             T('Volume pricing for events, teams, staff and merch runs.', 'Prix au volume pour événements, équipes, personnel et marchandise.')),
    'screen': ('tee-champion-t425.jpg', '50% 20%', T('Screen printing', 'Sérigraphie'),
               T('Screen printing in Montréal', 'Sérigraphie à Montréal'),
               T('For solid-colour runs of 50 or more.', 'Pour les séries de 50 pièces et plus, en couleurs unies.')),
    'get-a-price': ('hoodie-comfort-colors-1567.jpg', '50% 20%', T('Get a price', 'Demander un prix'),
                    T('We’ll reach you within the hour', 'On vous répond dans l’heure'),
                    T('Tell us what you need. We’ll send a price and a free mockup.', 'Dites-nous ce qu’il vous faut. On vous envoie un prix et une maquette gratuite.')),
}

GUIDES = {
    'charity-run-timeline': ('tee-mo-6500m.jpg', T('Charity run T-shirt timeline', 'Échéancier des t-shirts de course caritative')),
    'construction-crew-cost': ('hivis-tough-duck-sv07.jpg', T('Outfitting a crew of 50', 'Habiller une équipe de 50')),
    'brand-colour-matching': ('tee-comfort-colors-1717.jpg', T('Will my brand colour match?', 'Ma couleur de marque va-t-elle correspondre?')),
    'branded-winter-outerwear': ('jacket-core365-88205.jpg', T('Branded winter outerwear', 'Vêtements d’hiver à votre image')),
    'bulk-order-size-run': ('tee-gildan-64000.jpg', T('How many of each size?', 'Combien de chaque taille?')),
    'cafe-restaurant-merch': ('apron-biz-ba54.jpg', T('Café & restaurant merch that sells', 'De la marchandise de café qui se vend')),
    'custom-embroidered-caps-ordering-guide': ('cap-comfort-colors-ccrc0.jpg', T('Ordering embroidered caps', 'Commander des casquettes brodées')),
    'custom-hoodies-bulk-order-guide': ('hoodie-independent-ss4500.jpg', T('Custom hoodies in bulk', 'Hoodies personnalisés en grande quantité')),
    'decoration-method-durability': ('tee-next-level-3600.jpg', T('Which print lasts longest?', 'Quelle impression dure le plus longtemps?')),
    'embroidery-stitch-count-logo-cost': ('cap-valucap-vc300a.jpg', T('Embroidery stitch count, explained', 'Le nombre de points de broderie, expliqué')),
    'fabric-cotton-polyester-blends': ('crew-gildan-sf000.jpg', T('Cotton, polyester or a blend?', 'Coton, polyester ou mélange?')),
    'logo-file-requirements': ('longsleeve-comfort-colors-6014.jpg', T('What logo file to send your printer', 'Quel fichier de logo envoyer à votre imprimeur')),
    'logo-placement-print-sizes': ('polo-core365-ce112.jpg', T('Where should the logo go?', 'Où placer le logo?')),
    'minimum-order-price-breaks': ('tee-comfort-colors-6030.jpg', T('Why 12 shirts cost almost as much as 50', 'Pourquoi 12 t-shirts coûtent presque autant que 50')),
    'procurement-checklist': ('polo-gildan-64800.jpg', T('How to spec a uniform program', 'Planifier un programme d’uniformes')),
    'team-jersey-ordering': ('jersey-high-five-322992.jpg', T('Ordering custom team jerseys', 'Commander des chandails d’équipe')),
    'wash-care-printed-embroidered-apparel': ('longsleeve-gildan-5400.jpg', T('How to wash printed apparel', 'Comment laver vos vêtements imprimés')),
}

# Links the OS sends customers (pay.singhsprint.com). Dark panel: "this is yours", not an ad.
OS = {
    'quote': ('crew-bella-canvas-3945.jpg', '50% 20%', T('Your quote', 'Votre soumission'),
              T('Your quote is ready', 'Votre soumission est prête'),
              T('Review the items, mockups and price, then approve online.', 'Consultez les articles, les maquettes et le prix, puis approuvez en ligne.')),
    'mockup': ('tee-gildan-64000.jpg', '50% 20%', T('Your mockup', 'Votre maquette'),
               T('Your mockup is ready', 'Votre maquette est prête'),
               T('Have a look, then approve it or ask for changes.', 'Jetez un œil, puis approuvez-la ou demandez des changements.')),
    'invoice': ('longsleeve-gildan-64400.jpg', '50% 20%', T('Your invoice', 'Votre facture'),
                T('Your invoice', 'Votre facture'),
                T('View it and pay securely online.', 'Consultez-la et payez en ligne en toute sécurité.')),
    'gift': ('crew-next-level-9003.jpg', '50% 20%', T('A gift for you', 'Un cadeau pour vous'),
             T('You have a gift on the way', 'Un cadeau s’en vient pour vous'),
             T('Pick your size so it fits. Takes 30 seconds.', 'Choisissez votre taille pour qu’il vous aille. Ça prend 30 secondes.')),
}


def build():
    cards = []
    for lang in ('en', 'fr'):
        suf = '' if lang == 'en' else '-fr'
        cards.append({'id': 'site-home' + suf, 'layout': 'trio',
                      'photos': [['tee-gildan-64000.jpg', '50% 20%'], ['hoodie-comfort-colors-1567.jpg', '50% 20%'], ['crew-gildan-sf000.jpg', '50% 20%'], ['polo-gildan-64800.jpg', '50% 20%']],
                      'kicker': T('Custom apparel', 'Vêtements personnalisés')[lang],
                      'headline': T('T-shirts, hoodies &amp; embroidery', 'T-shirts, hoodies et broderie')[lang],
                      'sub': T('Printed and embroidered in Montréal, from 5 pieces.', 'Imprimés et brodés à Montréal, dès 5 pièces.')[lang]})
        for k, (ph, pos, ki, h, s) in SITE.items():
            cards.append({'id': f'site-{k}{suf}', 'photo': ph, 'pos': pos, 'kicker': ki[lang], 'headline': h[lang], 'sub': s[lang]})
        for k, (ph, h) in GUIDES.items():
            cards.append({'id': f'guide-{k}{suf}', 'photo': ph, 'pos': '50% 20%', 'kicker': 'Guide', 'headline': h[lang],
                          'sub': T('From the Singhs Print guides.', 'Tiré des guides Singhs Print.')[lang]})
        for k, (ph, pos, ki, h, s) in OS.items():
            cards.append({'id': f'os-{k}{suf}', 'dark': True, 'photo': ph, 'pos': pos, 'kicker': ki[lang], 'headline': h[lang], 'sub': s[lang],
                          'domain': 'pay.singhsprint.com', 'foot': 'Singhs Print'})
    CTA = {'site': T('Get a price', 'Demander un prix'), 'guide': T('Read the guide', 'Lire le guide'), 'os': T('Open', 'Ouvrir')}
    for c in cards:  # long headlines step down so they never run past four lines
        n = len(html.unescape(re.sub(r'<br>', ' ', c['headline'])))
        c['hs'] = '72px' if n <= 20 else '64px' if n <= 30 else '56px' if n <= 40 else '50px'
        c['cta'] = CTA[c['id'].split('-')[0]]['fr' if c['id'].endswith('-fr') else 'en']
    return cards


if __name__ == '__main__':
    cards = build()
    json.dump(cards, open('spec.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    plain = lambda t: html.unescape(re.sub(r'<br>', ' ', t or '')).strip()
    json.dump({c['id']: {'headline': plain(c['headline']), 'sub': plain(c.get('sub', '')), 'kicker': c['kicker']} for c in cards},
              open('cards.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(cards))
