// ==============================
// Singhs Print - Bilingual System
// ==============================
// Usage: Add data-i18n="key" to any element. Text will swap on toggle.
// For inputs: data-i18n-placeholder="key" swaps placeholder text.
// The toggle button is injected by components.js.

var SP_LANG = (function() {
  // Two flavors of pages exist:
  //   1) Pages with a /fr mirror (have <link rel="alternate" hreflang="fr">
  //      pointing to a different URL). On these, trust the doc's lang
  //      attribute, because the user is already on the right mirror.
  //   2) Pages WITHOUT a mirror (like /account/*). These are bilingual
  //      via data-i18n attributes only, so trust localStorage so the
  //      user's preference from the previous page carries over.
  var docLang = (document.documentElement.lang || '').toLowerCase().slice(0, 2);
  var storedLang = localStorage.getItem('sp-lang');
  var hasMirror = (function() {
    var alts = document.querySelectorAll('link[rel="alternate"][hreflang]');
    for (var i = 0; i < alts.length; i++) {
      var hl = (alts[i].getAttribute('hreflang') || '').toLowerCase();
      if (hl !== 'x-default' && alts[i].getAttribute('href') &&
          alts[i].getAttribute('href') !== location.href) {
        return true;
      }
    }
    return false;
  })();
  var currentLang;
  if (hasMirror) {
    currentLang = (docLang === 'fr' || docLang === 'en') ? docLang : (storedLang || 'en');
  } else {
    currentLang = (storedLang === 'fr' || storedLang === 'en')
      ? storedLang
      : ((docLang === 'fr' || docLang === 'en') ? docLang : 'en');
  }

  var translations = {
    // ===== NAV / PROMO =====
    'promo': {
      en: '$20 OFF your first order of $100+. No code needed.',
      fr: '20 $ DE RABAIS sur votre première commande de 100 $ et plus. Aucun code requis.'
    },
    'promo.link': { en: 'Get your quote', fr: 'Obtenir votre soumission' },
    'nav.products': { en: 'Products', fr: 'Produits' },
    'nav.services': { en: 'Services', fr: 'Services' },
    'nav.howitworks': { en: 'How It Works', fr: 'Comment ça marche' },
    'nav.portfolio': { en: 'Portfolio', fr: 'Portfolio' },
    'nav.drops': { en: 'Drops', fr: 'Drops' },
    'nav.inkwear': { en: 'Inkwear', fr: 'Inkwear' },
    'nav.youth': { en: 'Youth Initiative', fr: 'Initiative Jeunesse' },
    'nav.businesses': { en: 'For Businesses', fr: 'Pour entreprises' },
    'nav.about': { en: 'About', fr: 'À propos' },
    'nav.login': { en: 'Login', fr: 'Connexion' },
    'nav.quote': { en: 'Get a Quote', fr: 'Soumission' },

    // ===== FOOTER =====
    'footer.brand': {
      en: "Custom apparel printing in Montreal's West Island. DTG, DTF & Embroidery for brands, creators, and businesses. Open 7 days, 9AM\u20139PM.",
      fr: "Impression de vêtements personnalisés dans l'Ouest-de-l'Île de Montréal. DTG, DTF et broderie pour marques, créateurs et entreprises. Ouvert 7 jours, 9h à 21h."
    },
    'footer.pages': { en: 'Pages', fr: 'Pages' },
    'footer.home': { en: 'Home', fr: 'Accueil' },
    'footer.getquote': { en: 'Get a Quote', fr: 'Soumission' },
    'footer.portfolio': { en: 'Portfolio', fr: 'Portfolio' },
    'footer.inkwear': { en: 'Inkwear', fr: 'Inkwear' },
    'footer.businesses': { en: 'For Businesses', fr: 'Pour entreprises' },
    'footer.about': { en: 'About', fr: 'À propos' },
    'footer.youth': { en: 'Youth Initiative', fr: 'Initiative Jeunesse' },
    'footer.services': { en: 'Services', fr: 'Services' },
    'footer.dtg': { en: 'DTG Printing', fr: 'Impression DTG' },
    'footer.dtf': { en: 'DTF Transfers', fr: 'Transferts DTF' },
    'footer.embroidery': { en: 'Embroidery', fr: 'Broderie' },
    'footer.designstudio': { en: 'Design Studio', fr: 'Studio de design' },
    'footer.contact': { en: 'Contact', fr: 'Contact' },
    'footer.location': { en: 'West Island, Montreal', fr: 'Ouest-de-l\'Île, Montréal' },
    'footer.rights': { en: '2026 Singhs Print. All rights reserved.', fr: '2026 Singhs Print. Tous droits réservés.' },
    'footer.tagline': { en: 'Custom Apparel Printing | Montreal, QC', fr: 'Impression de vêtements personnalisés | Montréal, QC' },
    'footer.privacy': { en: 'Privacy', fr: 'Confidentialité' },
    'footer.cookies': { en: 'Cookies', fr: 'Témoins' },
    'footer.terms': { en: 'Terms', fr: 'Conditions' },
    'footer.accessibility': { en: 'Accessibility', fr: 'Accessibilité' },
    'footer.cookieprefs': { en: 'Cookie preferences', fr: 'Préférences de témoins' },

    // ===== INDEX / HOME =====
    'home.badge': { en: 'Open 7 days | West Island, Montreal', fr: 'Ouvert 7 jours | Ouest-de-l\'Île, Montréal' },
    'home.hero.h1a': { en: "West Island's", fr: "L'Ouest-de-l'Île," },
    'home.hero.h1b': { en: 'custom apparel printing studio.', fr: 'votre studio d\'impression personnalisée.' },
    'home.hero.sub': {
      en: "DTG, DTF & Embroidery done in-house in Montreal's West Island. Low minimums, 3&ndash;5 day turnaround with rush options, and a real sample before every run. $20 off your first order of $100+.",
      fr: "DTG, DTF et broderie réalisés sur place dans l'Ouest-de-l'Île de Montréal. Faibles minimums, délai standard de 3 à 5 jours (options urgentes), et un véritable échantillon avant chaque production. 20 $ de rabais sur votre première commande de 100 $ et plus."
    },
    'home.hero.cta1': { en: 'Get a Free Quote', fr: 'Soumission gratuite' },
    'home.hero.cta2': { en: 'See Our Work', fr: 'Voir nos réalisations' },
    'home.hero.guarantee': { en: 'Quality Guarantee: Love it or we reprint it.', fr: 'Garantie qualité : Satisfait ou on réimprime.' },
    // Inline hero social-proof line (replaces old hero-stats block)
    'home.heroproof.orders': { en: 'orders',         fr: 'commandes' },
    'home.heroproof.rating': { en: '(21 reviews)',   fr: '(21 avis)' },
    'home.heroproof.local':  { en: 'West Island, Montreal', fr: 'Ouest-de-l\'Île, Montréal' },
    'home.stats.orders': { en: 'Orders Completed', fr: 'Commandes complétées' },
    'home.stats.turnaround': { en: 'Day Avg Turnaround', fr: 'Jours délai moyen' },
    'home.stats.rating': { en: 'Google Rating', fr: 'Note Google' },
    'home.trust': {
      en: 'Trusted by brands & businesses across the West Island & Montreal',
      fr: 'La confiance des marques et entreprises de l\'Ouest-de-l\'Île et Montréal'
    },
    'home.products.label': { en: 'Products', fr: 'Produits' },
    'home.products.h2': { en: 'What we print on', fr: 'Sur quoi on imprime' },
    'home.products.sub': {
      en: 'Premium blanks, printed or embroidered exactly how you want them.',
      fr: 'Des vêtements de qualité, imprimés ou brodés exactement comme vous le souhaitez.'
    },
    'home.services.label': { en: 'Services', fr: 'Services' },
    'home.services.h2': { en: 'Three methods, one studio', fr: 'Trois méthodes, un studio' },
    'home.services.sub': {
      en: 'Every method in-house means we pick the right one for your project.',
      fr: 'Toutes les méthodes sur place, on choisit la meilleure pour votre projet.'
    },
    'home.hiw.label': { en: 'How It Works', fr: 'Comment ça marche' },
    'home.hiw.h2': { en: 'From idea to finished product', fr: 'De l\'idée au produit fini' },
    'home.hiw.step1.h': { en: 'Tell us what you need', fr: 'Dites-nous ce qu\'il vous faut' },
    'home.hiw.step1.p': {
      en: 'Fill out a quick form or send us a message. Include your design, garment preferences, and quantity.',
      fr: 'Remplissez un formulaire rapide ou envoyez-nous un message. Incluez votre design, vos préférences et la quantité.'
    },
    'home.hiw.step2.h': { en: 'We prep & sample', fr: 'On prépare et échantillonne' },
    'home.hiw.step2.p': {
      en: 'Our design studio preps your artwork for print. You approve a physical sample before we produce the full order.',
      fr: 'Notre studio prépare votre visuel pour l\'impression. Vous approuvez un échantillon physique avant la production.'
    },
    'home.hiw.step3.h': { en: 'Pick up or get it delivered', fr: 'Ramassage ou livraison' },
    'home.hiw.step3.p': {
      en: 'Most orders ready in 2-4 business days. Local pickup in the West Island or delivery across Montreal.',
      fr: 'La plupart des commandes prêtes en 2 à 4 jours ouvrables. Ramassage local dans l\'Ouest-de-l\'Île ou livraison à Montréal.'
    },
    'home.cta.h2': { en: 'Ready to get started?', fr: 'Prêt à commencer ?' },
    'home.cta.p': {
      en: 'Get a quote in hours, not days. $20 off your first order of $100+.',
      fr: 'Obtenez une soumission en heures, pas en jours. 20 $ de rabais sur votre première commande de 100 $ et plus.'
    },
    'home.cta.btn': { en: 'Get a Free Quote', fr: 'Soumission gratuite' },
    'home.cta.call': { en: 'Call 438-544-3800', fr: 'Appelez le 438-544-3800' },
    'home.stats.orderqty': { en: 'Order any qty', fr: 'Toute quantité' },
    // Proof bar
    'home.proof.orders':     { en: 'Orders Completed', fr: 'Commandes complétées' },
    'home.proof.clients':    { en: 'Happy Clients', fr: 'Clients satisfaits' },
    'home.proof.rating-num': { en: '5.0/5 (27 reviews)', fr: '5,0/5 (21 avis)' },
    'home.proof.rating':     { en: 'Google Reviews', fr: 'Avis Google' },
    'home.proof.production': { en: 'In-House Production', fr: 'Production sur place' },
    // Why us
    'home.why.h2':            { en: 'Built for brands that care about quality', fr: 'Conçu pour les marques qui se soucient de la qualité' },
    'home.why.guarantee.h':   { en: 'Satisfaction guarantee', fr: 'Garantie de satisfaction' },
    'home.why.guarantee.p':   { en: "If there's a print issue or defect, we reprint or replace it. Period.", fr: "S'il y a un problème d'impression ou un défaut, on réimprime ou on remplace. Point final." },
    'home.why.sample.h':      { en: 'Sample before production', fr: 'Échantillon avant production' },
    'home.why.sample.p':      { en: 'Every order gets a physical sample. You never pay for a full run unseen.', fr: 'Chaque commande inclut un échantillon physique. Vous ne payez jamais une commande complète sans l\'avoir vue.' },
    'home.why.turnaround.h':  { en: '2-4 day turnaround', fr: 'Délai de 2 à 4 jours' },
    'home.why.turnaround.p':  { en: 'Most orders done in days. Rush options with same-day Montreal pickup.', fr: 'La plupart des commandes en quelques jours. Options urgentes avec ramassage le jour même à Montréal.' },
    'home.why.design.h':      { en: 'Free design help', fr: 'Aide au design gratuite' },
    'home.why.design.p':      { en: 'Cleanups, mockups, and full designs at no extra charge.', fr: 'Retouches, maquettes et designs complets sans frais supplémentaires.' },
    'home.why.bulk.h':        { en: 'Bulk & recurring pricing', fr: 'Prix de volume et récurrents' },
    'home.why.bulk.p':        { en: 'Discounts for volume + business packages for ongoing orders.', fr: 'Rabais sur volume + forfaits entreprises pour commandes récurrentes.' },
    'home.why.inhouse.h':     { en: '100% in-house', fr: '100% sur place' },
    'home.why.inhouse.p':     { en: 'DTG, DTF, and embroidery under one roof. No outsourcing.', fr: 'DTG, DTF et broderie sous un même toit. Aucune sous-traitance.' },
    // FAQ
    'home.faq.label': { en: 'FAQ', fr: 'FAQ' },
    'home.faq.h2':    { en: 'Common questions', fr: 'Questions fréquentes' },
    'home.faq.q1': { en: 'What printing services do you offer?', fr: 'Quels services d\'impression offrez-vous ?' },
    'home.faq.a1': { en: 'We specialize in DTG (Direct-to-Garment), DTF (Direct-to-Film), and embroidery. Custom t-shirts, hoodies, crewnecks, uniforms, hats, and more, all printed in-house in Montreal.', fr: 'On se spécialise en DTG (impression directe sur vêtement), DTF (transfert sur film) et broderie. T-shirts, hoodies, crewnecks, uniformes, casquettes et plus — tout imprimé sur place à Montréal.' },
    'home.faq.q2': { en: 'Is there a minimum order?', fr: 'Y a-t-il une commande minimum ?' },
    'home.faq.a2': { en: 'No minimums. We print 1 item or 1,000+. Ideal for small brands, creators, schools, gyms, cafes, and businesses of any size.', fr: 'Aucun minimum. On imprime 1 article ou 1 000+. Idéal pour les petites marques, créateurs, écoles, gyms, cafés et entreprises de toute taille.' },
    'home.faq.q3': { en: 'How fast can you complete an order?', fr: 'En combien de temps pouvez-vous compléter une commande ?' },
    'home.faq.a3': { en: "Standard 3-5 day turnaround from approved artwork. Rush options available for Montreal and West Island pickups. You'll get an exact timeline at the quote stage.", fr: "Délai standard de 3 à 5 jours après approbation du visuel. Options urgentes disponibles pour ramassage à Montréal et dans l'Ouest-de-l'Île. On vous donne un échéancier précis à l'étape de la soumission." },
    'home.faq.q4': { en: 'Can you supply the blank apparel?', fr: 'Pouvez-vous fournir les vêtements vierges ?' },
    'home.faq.a4': { en: "Yes! We source from S&amp;S Activewear, SanMar, and Rue Saint-Patrick, which means access to Gildan, Bella+Canvas, Comfort Colors, Champion, Next Level, Independent, American Apparel, Hanes, and dozens more. Or bring your own garments and we'll print on anything.", fr: 'Oui ! On s\'approvisionne chez S&amp;S Activewear, SanMar et Rue Saint-Patrick — accès à Gildan, Bella+Canvas, Comfort Colors, Champion, Next Level, Independent, American Apparel, Hanes et des dizaines d\'autres. Ou apportez vos propres vêtements et on imprime sur n\'importe quoi.' },
    'home.faq.q5': { en: 'What file types do you accept?', fr: 'Quels formats de fichier acceptez-vous ?' },
    'home.faq.a5': { en: "PNG, JPG, PDF, AI, PSD, SVG. Transparent PNG or vector recommended. Don't have print-ready art? We offer free design help.", fr: 'PNG, JPG, PDF, AI, PSD, SVG. PNG transparent ou vectoriel recommandé. Pas de visuel prêt pour l\'impression ? Notre studio de design vous aide gratuitement.' },
    'home.faq.q6': { en: 'Can I see a sample first?', fr: 'Puis-je voir un échantillon d\'abord ?' },
    'home.faq.a6': { en: 'Absolutely. We produce a real physical sample so you can verify colors, placement, and quality before the full run. This is standard with every order.', fr: 'Absolument. On produit un véritable échantillon physique pour que vous puissiez vérifier couleurs, placement et qualité avant la commande complète. C\'est inclus avec chaque commande.' },
    'home.faq.q7': { en: 'Do you offer a satisfaction guarantee?', fr: 'Offrez-vous une garantie de satisfaction ?' },
    'home.faq.a7': { en: 'Yes. If there is a print quality issue or garment defect, we will reprint or replace the item at no cost to you.', fr: 'Oui. S\'il y a un problème de qualité d\'impression ou un défaut de vêtement, on réimprime ou on remplace l\'article sans frais.' },
    'home.faq.q8': { en: 'Do you offer a first-order discount?', fr: 'Offrez-vous un rabais sur la première commande ?' },
    'home.faq.a8': { en: 'Yes — your first order of $100 or more is $20 off, applied automatically when you request your quote. No code needed.', fr: 'Oui — votre première commande de 100 $ ou plus bénéficie de 20 $ de rabais, appliqué automatiquement lors de la soumission. Aucun code requis.' },
    'home.faq.q9': { en: 'What areas do you serve?', fr: 'Quels secteurs desservez-vous ?' },
    'home.faq.a9': { en: "We decorate in Sainte-Anne-de-Bellevue and deliver across Montreal's West Island (Pointe-Claire, Dorval, Kirkland, Beaconsfield, Pierrefonds, Baie-d'Urfé, L'Île-Bizard), greater Montreal, Laval, and the South Shore. Canada-wide shipping available for larger orders.", fr: "On décore à Sainte-Anne-de-Bellevue et livre dans tout l'Ouest-de-l'Île de Montréal (Pointe-Claire, Dorval, Kirkland, Beaconsfield, Pierrefonds, Baie-d'Urfé, L'Île-Bizard), le grand Montréal, Laval et la Rive-Sud. Expédition partout au Canada pour les commandes plus importantes." },
    'home.faq.seeall': { en: 'See all questions →', fr: 'Voir toutes les questions →' },
    // Lead capture popup
    'home.popup.h3':     { en: 'Get $20 off your first order of $100+', fr: 'Obtenez 20 $ de rabais sur votre première commande de 100 $ et plus' },
    'home.popup.p':      { en: 'Your $20 off is applied automatically when you start your quote. No code, no email signup, no waiting.', fr: "Votre rabais de 20 $ s'applique automatiquement dès que vous démarrez votre soumission. Aucun code, aucune inscription, aucune attente." },
    'home.popup.cta':    { en: 'Start my quote →', fr: 'Démarrer ma soumission →' },
    'home.popup.skip':   { en: 'Maybe later', fr: 'Plus tard' },
    // Unused after slice "popup → quote builder", kept so older cached pages
    // don't blank out the placeholder text if they reference these keys.
    'home.popup.name':   { en: 'Your name', fr: 'Votre nom' },
    'home.popup.email':  { en: 'Your email', fr: 'Votre courriel' },
    'home.popup.submit': { en: 'Start my quote →', fr: 'Démarrer ma soumission →' },
    // Sticky mobile CTA
    'home.sticky.label': { en: '$20 off first order ($100+)', fr: '20 $ de rabais (1ʳᵉ commande, 100 $+)' },
    'home.sticky.cta':   { en: 'Get Quote →', fr: 'Soumission →' },
    // Sitewide sticky CTA (injected by components.js on every page except /quote and /order)
    'sticky.label': { en: 'Ready when you are', fr: 'On est prêts' },
    'sticky.sub':   { en: 'No minimums · 2–4 day turnaround', fr: 'Aucun minimum · délai 2 à 4 jours' },
    'sticky.cta':   { en: 'Get a Quote →', fr: 'Soumission →' },
    // Mid-page CTA injected by components.js on long-form pages
    'midcta.eyebrow': { en: 'Quick check',                                       fr: 'Petite question' },
    'midcta.title':   { en: 'Got a project like this in mind?',                  fr: 'Vous avez un projet similaire en tête ?' },
    'midcta.copy':    { en: "Send us the details and we'll come back with a quote, sample timeline, and price within the hour.", fr: 'Envoyez-nous les détails — soumission, échéancier d\'échantillon et prix dans l\'heure.' },
    'midcta.btn':     { en: 'Get a free quote →',                                fr: 'Soumission gratuite →' },
    'midcta.alt':     { en: 'or call 438-544-3800',                              fr: 'ou appelez le 438-544-3800' },
    // Product category cards
    'home.badge.popular':    { en: 'Popular',     fr: 'Populaire' },
    'home.badge.bestseller': { en: 'Best Seller', fr: 'Best-seller' },
    'home.price.startingat': { en: 'Starting at', fr: 'À partir de' },
    'home.price.perunit':    { en: '/unit',       fr: ' / unité' },
    'home.cat.tshirts':      { en: 'Custom T-Shirts',        fr: 'T-shirts personnalisés' },
    'home.cat.hoodies':      { en: 'Custom Hoodies',         fr: 'Hoodies personnalisés' },
    'home.cat.crewnecks':    { en: 'Custom Crewnecks',       fr: 'Crewnecks personnalisés' },
    'home.cat.hats':         { en: 'Hats & Caps',            fr: 'Casquettes et chapeaux' },
    'home.cat.totes':        { en: 'Tote Bags',              fr: 'Sacs tote' },
    'home.cat.longsleeve':   { en: 'Long Sleeves',           fr: 'Manches longues' },
    'home.cat.polos':        { en: 'Polos',                  fr: 'Polos' },
    'home.cat.joggers':      { en: 'Joggers & Sweatpants',   fr: 'Joggers et pantalons molletonnés' },
    'home.products.bulknote':      { en: 'Bulk pricing available. The more you order, the less you pay per unit.', fr: 'Prix de volume disponibles. Plus vous commandez, moins vous payez à l\'unité.' },
    'home.products.browsecatalog': { en: 'Browse the full catalog — 18,000+ blanks across S&amp;S, SanMar & more →', fr: 'Parcourez le catalogue complet — 18 000+ vêtements vierges chez S&amp;S, SanMar et plus →' },
    // Brand strip
    'home.brands.label': { en: 'We print on premium blanks from top suppliers', fr: 'On imprime sur des vêtements de qualité des meilleurs fournisseurs' },
    'home.brands.note':  { en: 'Sourced from S&amp;S Activewear, SanMar & Rue Saint-Patrick. Bring your own garments too.', fr: 'Approvisionné chez S&amp;S Activewear, SanMar et Rue Saint-Patrick. Apportez vos propres vêtements aussi.' },
    // Services
    'home.svc.dtg.h': { en: 'DTG Printing',   fr: 'Impression DTG' },
    'home.svc.dtg.p': { en: 'Photo-quality, full-color prints directly on garments. Perfect for detailed artwork, gradients, and unlimited colors on cotton and blends.', fr: 'Impressions photo, pleine couleur, directement sur les vêtements. Parfait pour les visuels détaillés, les dégradés et les couleurs illimitées sur coton et mélanges.' },
    'home.svc.dtf.h': { en: 'DTF Transfers',  fr: 'Transferts DTF' },
    'home.svc.dtf.p': { en: 'Vibrant prints on any fabric: polyester, nylon, cotton, and more. Durable, stretchy, and works on dark or light garments.', fr: 'Impressions vives sur tout tissu : polyester, nylon, coton et plus. Durable, extensible, et fonctionne sur vêtements foncés ou clairs.' },
    'home.svc.emb.h': { en: 'Embroidery',     fr: 'Broderie' },
    'home.svc.emb.p': { en: 'Premium stitched logos and text for a professional, tactile finish. Ideal for corporate wear, uniforms, hats, and brand merch.', fr: 'Logos et textes brodés de qualité pour un fini professionnel et tactile. Idéal pour les vêtements corporatifs, uniformes, casquettes et marchandise de marque.' },
    // Service tags
    'home.svc.tag.tshirts':      { en: 'T-shirts',      fr: 'T-shirts' },
    'home.svc.tag.hoodies':      { en: 'Hoodies',       fr: 'Hoodies' },
    'home.svc.tag.crewnecks':    { en: 'Crewnecks',     fr: 'Crewnecks' },
    'home.svc.tag.smallbatches': { en: 'Small batches', fr: 'Petites séries' },
    'home.svc.tag.allfabrics':   { en: 'All fabrics',   fr: 'Tous tissus' },
    'home.svc.tag.sportswear':   { en: 'Sportswear',    fr: 'Vêtements de sport' },
    'home.svc.tag.bags':         { en: 'Bags',          fr: 'Sacs' },
    'home.svc.tag.bulkorders':   { en: 'Bulk orders',   fr: 'Grosses commandes' },
    'home.svc.tag.uniforms':     { en: 'Uniforms',      fr: 'Uniformes' },
    'home.svc.tag.hats':         { en: 'Hats',          fr: 'Casquettes' },
    'home.svc.tag.polos':        { en: 'Polos',         fr: 'Polos' },
    'home.svc.tag.corporate':    { en: 'Corporate',     fr: 'Corporatif' },
    // Recent work
    'home.recent.label':   { en: 'Recent Work',         fr: 'Travaux récents' },
    'home.recent.h':       { en: 'Fresh off the press', fr: 'Tout juste sortis de presse' },
    'home.recent.viewall': { en: 'View all →',          fr: 'Voir tout →' },
    // Reviews
    'home.reviews.label':        { en: 'What Our Clients Say',          fr: 'Ce que disent nos clients' },
    'home.reviews.h':            { en: 'Real reviews from real customers', fr: 'De vrais avis de vrais clients' },
    'home.reviews.avg':          { en: '5.0/5 (27 reviews) average',    fr: '5,0/5 (21 avis) en moyenne' },
    'home.reviews.readall':      { en: 'Read all reviews →',            fr: 'Lire tous les avis →' },
    'home.reviews.author.label': { en: 'Google Review',                  fr: 'Avis Google' },

    // ===== ABOUT =====
    'about.hero.h1': { en: 'Montreal\'s custom apparel studio,<br>built in Sainte-Anne-de-Bellevue.', fr: 'L\'imprimerie de vêtements personnalisés de Montréal,<br>née à Sainte-Anne-de-Bellevue.' },
    'about.hero.p': {
      en: 'Imprimerie Singhs Print is a family-run apparel decorator on the West Island of Montreal. DTG, DTF, embroidery and screen printing for student organizations, local businesses, and Net-30 corporate accounts, with 1,100+ blank styles, a 1-hour quote turnaround during business hours, and a real human reply every time.',
      fr: 'Imprimerie Singhs Print est un décorateur de vêtements familial dans l\'Ouest-de-l\'Île de Montréal. DTG, DTF, broderie et sérigraphie pour les organisations étudiantes, les entreprises locales et les comptes corporatifs Net-30, avec plus de 1 100 styles de vêtements vierges, une soumission en 1 heure pendant les heures d\'ouverture et une vraie réponse humaine à chaque fois.'
    },
    'about.image.studio':  { en: 'The studio · Sainte-Anne-de-Bellevue', fr: 'Le studio · Sainte-Anne-de-Bellevue' },
    'about.image.methods': { en: 'DTG · DTF · Embroidery',                fr: 'DTG · DTF · Broderie' },
    'about.image.work':    { en: 'Recent client work',                    fr: 'Travaux clients récents' },
    'about.hero.chip.local':     { en: 'West Island, Montreal',       fr: 'Ouest-de-l\'Île, Montréal' },
    'about.hero.chip.bilingual': { en: 'EN · FR',                     fr: 'EN · FR' },
    'about.hero.chip.neq':       { en: 'NEQ 1181573313',              fr: 'NEQ 1181573313' },
    'about.hero.chip.net30':     { en: 'Net-30 for repeat accounts',  fr: 'Net-30 pour comptes récurrents' },

    'about.who.label': { en: 'Who we are', fr: 'Qui sommes-nous' },
    'about.who.h2': { en: 'A West Island studio that takes your order personally', fr: 'Un studio de l\'Ouest-de-l\'Île qui prend votre commande personnellement' },
    'about.who.p1': {
      en: 'Singhs Print was started by a small family team in Sainte-Anne-de-Bellevue because we were tired of seeing custom apparel done sloppily: slow turnarounds, inconsistent quality, and shops that treated small orders like a nuisance.',
      fr: 'Singhs Print a été lancée par une petite équipe familiale à Sainte-Anne-de-Bellevue parce qu\'on en avait assez de voir l\'impression personnalisée mal faite : délais lents, qualité incohérente et ateliers qui traitaient les petites commandes comme un dérangement.'
    },
    'about.who.p2': {
      en: 'Every order, whether it\'s 5 t-shirts for a birthday or 500 hoodies for a brand launch, runs through the same sample-and-approve process. Everything is decorated in-house in our Montreal studio so we control quality from artwork prep through final QC. We\'re Quebec-registered (Imprimerie Singhs Print · NEQ 1181573313), and GST and QST compliant. Important if you\'re a procurement-led organization or just like knowing the people printing your gear aren\'t trading out of a parking lot.',
      fr: 'Chaque commande, que ce soit 5 t-shirts pour un anniversaire ou 500 hoodies pour un lancement de marque, passe par le même processus d\'échantillon et d\'approbation. Tout est décoré sur place dans notre studio de Montréal pour qu\'on contrôle la qualité de la préparation du fichier au CQ final. Nous sommes immatriculés au Québec (Imprimerie Singhs Print · NEQ 1181573313), conformes à la TPS et à la TVQ. Important si vous êtes une organisation pilotée par les achats ou si vous aimez simplement savoir que les gens qui impriment vos vêtements ne travaillent pas depuis un stationnement.'
    },

    'about.stats.orders':  { en: 'Orders decorated',                fr: 'Commandes décorées' },
    'about.stats.rating':  { en: 'Google rating · 21 reviews',      fr: 'Note Google · 21 avis' },
    'about.stats.blanks':  { en: 'Blank styles in catalog',         fr: 'Styles vierges au catalogue' },
    'about.stats.quote':   { en: 'Typical quote turnaround',        fr: 'Délai typique de soumission' },

    'about.what.label': { en: 'What we do', fr: 'Ce qu\'on fait' },
    'about.what.h2': { en: 'DTG, DTF, embroidery & screen, all under one roof', fr: 'DTG, DTF, broderie et sérigraphie, tout sous un même toit' },
    'about.what.p1': {
      en: 'Having every method in-house means we recommend the right one for your project instead of forcing everything through one machine. Cotton tees? DTG. Polyester athleisure and dark blends? DTF. Logo embroidery on caps, polos, and jackets? Stitched in-house. High-volume single-color screen runs? Same building.',
      fr: 'Avoir toutes les méthodes sur place nous permet de recommander la bonne pour votre projet plutôt que de tout forcer à travers une seule machine. T-shirts en coton ? DTG. Athleisure en polyester et mélanges foncés ? DTF. Broderie de logos sur casquettes, polos et vestes ? Cousue sur place. Tirages sérigraphiques mono-couleur en gros volume ? Même bâtiment.'
    },
    'about.what.p2': {
      en: 'We carry 1,100+ blank styles from S&S Activewear, SanMar, AlphaBroder and Rue Saint-Patrick. Every major mill from Gildan and Bella+Canvas to Comfort Colors, Champion, Next Level, Independent and American Apparel. Bring your own garments if you\'d prefer, and we\'ll decorate yours at the same per-piece rate.',
      fr: 'Nous offrons plus de 1 100 styles vierges chez S&S Activewear, SanMar, AlphaBroder et Rue Saint-Patrick. Toutes les grandes marques, de Gildan et Bella+Canvas à Comfort Colors, Champion, Next Level, Independent et American Apparel. Apportez vos propres vêtements si vous préférez, et nous décorerons les vôtres au même tarif par pièce.'
    },

    'about.clients.label': { en: 'Who we work with', fr: 'Avec qui on travaille' },
    'about.clients.h2': { en: 'From McGill clubs to construction crews to Saturday markets', fr: 'Des clubs McGill aux équipes de construction en passant par les marchés du samedi' },
    'about.clients.p1': {
      en: 'Our work goes out to McGill student organizations (sororities, fraternities, sport clubs), Concordia associations, West Island restaurants and gyms, construction and landscaping outfits, Quebec institutions like the Morgan Arboretum, and content creators launching merch drops. Sigma Chi, McGill Pizza, Old Soul, Montreal Pinball, CUSEC, Artwood Construction, Durante Landscapers, CANAUST and dozens more.',
      fr: 'Notre travail part vers des organisations étudiantes de McGill (sororités, fraternités, clubs sportifs), des associations de Concordia, des restaurants et gyms de l\'Ouest-de-l\'Île, des entreprises de construction et d\'aménagement paysager, des institutions québécoises comme l\'Arboretum Morgan, et des créateurs de contenu qui lancent des drops merch. Sigma Chi, McGill Pizza, Old Soul, Montreal Pinball, CUSEC, Artwood Construction, Durante Landscapers, CANAUST et des dizaines d\'autres.'
    },
    'about.clients.p2': {
      en: 'Minimums are 5 units for DTG/DTF and 12 for embroidery, lower than most decorators in the city. No judgment for first-timers, no extra friction for repeat clients. Standing accounts move onto Net-30 terms after a couple of clean orders, and procurement-led organizations can sign an MSA and submit RFPs through our intake form.',
      fr: 'Les minimums sont de 5 unités pour DTG/DTF et de 12 pour la broderie, plus bas que la plupart des décorateurs de la ville. Pas de jugement pour les nouveaux clients, pas de friction supplémentaire pour les habitués. Les comptes récurrents passent aux modalités Net-30 après quelques commandes propres, et les organisations pilotées par les achats peuvent signer une entente-cadre et soumettre des appels d\'offres via notre formulaire d\'admission.'
    },

    'about.values.h2': { en: 'How we work', fr: 'Comment on travaille' },
    'about.values.sub': {
      en: 'Six things we promise on every order. The same way for a sorority tee run as for a 1,000-piece corporate rollout.',
      fr: 'Six engagements sur chaque commande. Autant pour un lot de t-shirts de sororité que pour un déploiement corporatif de 1 000 pièces.'
    },
    'about.values.transparent.h': { en: 'Transparent pricing', fr: 'Prix transparents' },
    'about.values.transparent.p': {
      en: 'A firm written quote upfront with no hidden fees. Bulk tiers kick in at 5+ units, Net-30 terms for approved repeat accounts.',
      fr: 'Une soumission écrite ferme dès le départ, sans frais cachés. Les paliers volume commencent à 5+ unités, Net-30 pour les comptes récurrents approuvés.'
    },
    'about.values.sample.h': { en: 'Sample-first approach', fr: 'Approche échantillon d\'abord' },
    'about.values.sample.p': {
      en: 'Every order gets a real physical sample before full production. You verify colors, placement and quality before we print a single extra piece.',
      fr: 'Chaque commande reçoit un véritable échantillon physique avant la production complète. Vous vérifiez les couleurs, le placement et la qualité avant qu\'on imprime une seule pièce supplémentaire.'
    },
    'about.values.turnaround.h': { en: 'Real turnaround times', fr: 'De vrais délais de livraison' },
    'about.values.turnaround.p': {
      en: 'Standard turnaround is 3–5 business days from approved artwork. Rush (2–3 days) is available with a small surcharge. We don\'t quote timelines we can\'t hit.',
      fr: 'Le délai standard est de 3 à 5 jours ouvrables à partir de l\'approbation du visuel. L\'option urgente (2 à 3 jours) est disponible moyennant un léger supplément. On ne promet pas de délais qu\'on ne peut pas tenir.'
    },
    'about.values.qc.h': { en: 'Quality control', fr: 'Contrôle de qualité' },
    'about.values.qc.p': {
      en: '100% in-house decoration, so we catch issues before they ship. No outsourcing, no middlemen, no surprise vendor reshuffles mid-project.',
      fr: 'Décoration 100% à l\'interne, ce qui nous permet de repérer les problèmes avant qu\'ils ne partent. Pas de sous-traitance, pas d\'intermédiaires, pas de fournisseur surprise en cours de projet.'
    },
    'about.values.design.h': { en: 'Free design help', fr: 'Aide au design gratuite' },
    'about.values.design.p': {
      en: 'Don\'t have print-ready artwork? Our in-studio designers handle cleanups, mockups and brand prep at no extra charge.',
      fr: 'Votre visuel n\'est pas prêt pour l\'impression ? Nos designers en studio s\'occupent des retouches, maquettes et préparation de marque sans frais supplémentaires.'
    },
    'about.values.delivery.h': { en: 'Local pickup + Canada-wide ship', fr: 'Ramassage local + expédition pancanadienne' },
    'about.values.delivery.p': {
      en: 'Free pickup at our Sainte-Anne-de-Bellevue studio, courier delivery across the West Island and Montreal, Canpar and Purolator Canada-wide.',
      fr: 'Ramassage gratuit à notre studio de Sainte-Anne-de-Bellevue, livraison par messagerie dans l\'Ouest-de-l\'Île et à Montréal, Canpar et Purolator partout au Canada.'
    },

    'about.creds.h2': { en: 'Boring details that matter', fr: 'Détails ennuyants qui comptent' },
    'about.creds.sub': {
      en: 'The legitimacy paperwork that procurement asks about before they cut a PO.',
      fr: 'La paperasse de légitimité que les services d\'achats demandent avant d\'émettre un bon de commande.'
    },
    'about.creds.legal.h':     { en: 'Imprimerie Singhs Print',                fr: 'Imprimerie Singhs Print' },
    'about.creds.legal.p':     {
      en: '95558110 QUEBEC INC · Quebec-registered NEQ 1181573313 · 81A Sainte Anne St, Sainte-Anne-de-Bellevue, QC H9X 1L9',
      fr: '95558110 QUÉBEC INC · Immatriculée au Québec NEQ 1181573313 · 81A rue Sainte-Anne, Sainte-Anne-de-Bellevue, QC H9X 1L9'
    },
    'about.creds.tax.h':       { en: 'GST & QST registered',                  fr: 'Inscrite à la TPS et à la TVQ' },
    'about.creds.tax.p':       {
      en: 'GST 71581 7169 RT0001 · QST 1233348101 TQ0001. Properly remitted, invoices are PO-ready.',
      fr: 'TPS 71581 7169 RT0001 · TVQ 1233348101 TQ0001. Correctement remises, factures prêtes pour les bons de commande.'
    },
    'about.creds.terms.h':     { en: 'Net-30 for approved accounts',          fr: 'Net-30 pour comptes approuvés' },
    'about.creds.terms.p':     {
      en: '50% deposit to start production, balance Net-30 after the first couple of clean orders. Standing programs negotiate from there.',
      fr: 'Acompte de 50 % pour démarrer la production, solde Net-30 après quelques commandes propres. Les programmes récurrents se négocient à partir de là.'
    },
    'about.creds.msa.h':       { en: 'MSA & RFP intake',                      fr: 'Entente-cadre et appels d\'offres' },
    'about.creds.msa.p':       {
      en: 'Procurement-led organizations can sign a Master Service Agreement and submit per-line RFPs through our intake form. We turn them around inside one business day.',
      fr: 'Les organisations pilotées par les achats peuvent signer une entente-cadre de service et soumettre des appels d\'offres ligne par ligne via notre formulaire d\'admission. On les retourne en un jour ouvrable.'
    },
    'about.creds.bilingual.h': { en: 'Bilingual EN / FR',                     fr: 'Bilingue EN / FR' },
    'about.creds.bilingual.p': {
      en: 'Quotes, invoices, samples and emails available in both official languages. Bill 96-aligned for Quebec-based clients.',
      fr: 'Soumissions, factures, échantillons et courriels disponibles dans les deux langues officielles. Conforme à la Loi 96 pour les clients québécois.'
    },

    'about.map.h2': { en: 'Visit our studio', fr: 'Visitez notre studio' },
    'about.map.p': {
      en: '81A Sainte Anne St, Sainte-Anne-de-Bellevue · Montreal\'s West Island. Open 7 days, 9AM to 9PM. Call 438-544-3800 before you come by. Production runs all day and we like to set aside time for visitors.',
      fr: '81A rue Sainte-Anne, Sainte-Anne-de-Bellevue · Ouest-de-l\'Île de Montréal. Ouvert 7 jours, de 9h à 21h. Appelez au 438-544-3800 avant de passer. La production tourne toute la journée et on aime garder du temps pour les visiteurs.'
    },
    'about.cta.h2': { en: 'Ready to get started?', fr: 'Prêt à commencer ?' },
    'about.cta.p': {
      en: 'Send us your spec and we\'ll come back with a firm quote, sample timeline and Net-30 paperwork, usually within the hour during business hours.',
      fr: 'Envoyez-nous votre devis et on revient avec une soumission ferme, un échéancier d\'échantillon et la paperasse Net-30, généralement en moins d\'une heure pendant les heures d\'ouverture.'
    },
    'about.cta.btn': { en: 'Get a Free Quote', fr: 'Soumission gratuite' },

    // ===== PORTFOLIO =====
    'portfolio.h1': { en: 'Our work', fr: 'Nos réalisations' },
    'portfolio.sub': {
      en: 'Recent prints, merch drops, uniforms, and creative projects, all done in-house at our Montreal studio.',
      fr: 'Impressions recentes, lancements de merch, uniformes et projets creatifs, le tout réalisé dans notre studio de Montréal.'
    },
    'portfolio.filter.all': { en: 'All', fr: 'Tout' },
    'portfolio.filter.dtg': { en: 'DTG', fr: 'DTG' },
    'portfolio.filter.dtf': { en: 'DTF', fr: 'DTF' },
    'portfolio.filter.embroidery': { en: 'Embroidery', fr: 'Broderie' },
    'portfolio.cta.h2': { en: 'Like what you see?', fr: 'Vous aimez ce que vous voyez ?' },
    'portfolio.cta.p': {
      en: 'Let\'s make something great for your brand, team, or next event.',
      fr: 'Créons quelque chose de génial pour votre marque, équipe ou prochain événement.'
    },
    'portfolio.cta.btn': { en: 'Get a Free Quote', fr: 'Soumission gratuite' },

    // ===== INKWEAR =====
    'inkwear.label': { en: 'By Singhs Print', fr: 'Par Singhs Print' },
    'inkwear.tagline': { en: 'Turning tattoo art into wearable designs.', fr: 'Transformer l\'art du tatouage en designs portables.' },
    'inkwear.sub': {
      en: 'A merch partnership for tattoo studios. Your clients already invest in personal art. That connection doesn\'t have to end at the chair.',
      fr: 'Un partenariat merch pour les studios de tatouage. Vos clients investissent déjà dans l\'art personnel. Ce lien ne doit pas se terminer au fauteuil.'
    },
    'inkwear.hero.cta1': { en: 'See How It Works', fr: 'Voir comment ça marche' },
    'inkwear.hero.cta2': { en: 'Partner With Us', fr: 'Devenez partenaire' },
    'inkwear.what.label': { en: 'What We Do', fr: 'Ce qu\'on fait' },
    'inkwear.what.h2': { en: 'We help tattoo studios monetize their artwork', fr: 'On aide les studios de tatouage a monetiser leur art' },
    'inkwear.what.sub': {
      en: 'No equipment. No production headaches. We handle design prep, printing, and fulfillment from our West Island studio.',
      fr: 'Aucun équipement. Aucun mal de tété de production. On gere la préparation, l\'impression et la livraison depuis notre studio de l\'Ouest-de-l\'Île.'
    },
    'inkwear.stream1.tag': { en: 'Revenue Stream 1', fr: 'Source de revenus 1' },
    'inkwear.stream1.h': { en: 'Post-Tattoo Upsell', fr: 'Vente après-tatouage' },
    'inkwear.stream1.p': {
      en: 'Offer clients apparel featuring their tattoo design, printed or embroidered immediately after their session. It captures the excitement of the moment and gives them a personalized extension of their new art.',
      fr: 'Offrez a vos clients des vêtements avec leur design de tatouage, imprimés ou brodés juste après leur session. Cela capture l\'excitation du moment et prolonge leur nouvel art.'
    },
    'inkwear.stream2.tag': { en: 'Revenue Stream 2', fr: 'Source de revenus 2' },
    'inkwear.stream2.h': { en: 'In-Shop Merch Shelf', fr: 'Étagère merch en boutique' },
    'inkwear.stream2.p': {
      en: 'Sell artist-designed apparel directly in your studio. Showcase your artists\' flash sheets and custom designs on premium garments for walk-ins and loyal clients. Build a brand beyond the chair.',
      fr: 'Vendez des vêtements designes par vos artistes directement en studio. Présentez vos flash sheets et designs personnalisés sur des vêtements haut de gamme. Construisez une marque au-dela du fauteuil.'
    },
    'inkwear.statement': {
      en: 'Tattoo clients already spend hundreds on designs they connect with emotionally. Now they can wear them too.',
      fr: 'Les clients de tatouage dépensent déjà des centaines de dollars pour des designs auxquels ils s\'attachent. Maintenant, ils peuvent aussi les porter.'
    },
    'inkwear.why.label': { en: 'Why It Works', fr: 'Pourquoi ça marche' },
    'inkwear.why.h2': { en: 'Everyone wins', fr: 'Tout le monde y gagne' },
    'inkwear.why.studios': { en: 'Tattoo Studios', fr: 'Studios de tatouage' },
    'inkwear.why.artists': { en: 'Artists', fr: 'Artistes' },
    'inkwear.why.sp': { en: 'Singhs Print', fr: 'Singhs Print' },
    'inkwear.hiw.label': { en: 'How It Works', fr: 'Comment ça marche' },
    'inkwear.hiw.h2': { en: 'Simple for you, seamless for your clients', fr: 'Simple pour vous, transparent pour vos clients' },
    'inkwear.hiw.step1.h': { en: 'Send us the artwork', fr: 'Envoyez-nous le visuel' },
    'inkwear.hiw.step1.p': {
      en: 'Share the tattoo design, flash sheet, or sketch. We prep it for print at no extra charge.',
      fr: 'Partagez le design de tatouage, la feuille flash ou le croquis. On le prépare pour l\'impression sans frais supplémentaires.'
    },
    'inkwear.hiw.step2.h': { en: 'We print a sample', fr: 'On imprimé un échantillon' },
    'inkwear.hiw.step2.p': {
      en: 'You approve the sample before anything goes into production. Pick your blanks, colors, and placements.',
      fr: 'Vous approuvez l\'échantillon avant la production. Choisissez vos vêtements, couleurs et emplacements.'
    },
    'inkwear.hiw.step3.h': { en: 'Sell in your studio', fr: 'Vendez dans votre studio' },
    'inkwear.hiw.step3.p': {
      en: 'Stock your merch shelf or offer it as a post-session add-on. We handle reorders and scaling when you\'re ready.',
      fr: 'Garnissez votre étagère merch ou offrez-le en ajout après la session. On gere les recommandés et la croissance quand vous êtes prêts.'
    },
    'inkwear.cta.tagline': { en: 'Let\'s start small. One design. One product.', fr: 'Commencons petit. Un design. Un produit.' },
    'inkwear.cta.h2': { en: 'If it works, we scale.', fr: 'Si ça marché, on grandit.' },
    'inkwear.cta.sub': {
      en: 'Get in touch to set up your first sample run. No commitment, no minimums.',
      fr: 'Contactez-nous pour votre premier échantillon. Aucun engagement, aucun minimum.'
    },
    'inkwear.cta.email': { en: 'Email sales@singhsprint.com', fr: 'Écrire à sales@singhsprint.com' },
    'inkwear.cta.or': { en: '— or —', fr: '— ou —' },
    'inkwear.form.studio':  { en: 'Studio name (e.g. Maison Tattoo)', fr: 'Nom du studio (ex. Maison Tattoo)' },
    'inkwear.form.name':    { en: 'Your name', fr: 'Votre nom' },
    'inkwear.form.email':   { en: 'Email', fr: 'Courriel' },
    'inkwear.form.what':    { en: 'What you\'d like to sell (flash sheets, signature designs, post-tattoo upsell tees, ...)', fr: 'Ce que vous voulez vendre (planches flash, designs signatures, t-shirts post-tatouage, ...)' },
    'inkwear.form.submit':  { en: 'Start the conversation →', fr: 'Démarrer la conversation →' },
    'inkwear.form.missing': { en: 'Please fill every field.', fr: 'Veuillez remplir tous les champs.' },
    'inkwear.form.sending': { en: 'Sending…', fr: 'Envoi en cours…' },
    'inkwear.form.thanks':  { en: '✓ Thanks — we\'ll reach out within one business day.', fr: '✓ Merci — on vous répond en un jour ouvrable.' },
    'inkwear.form.error':   { en: 'Couldn\'t send — please email sales@singhsprint.com directly.', fr: 'Envoi impossible — écrivez à sales@singhsprint.com.' },

    // ===== BUSINESSES =====
    'biz.label': { en: 'For Businesses', fr: 'Pour entreprises' },
    'biz.hero.h1': { en: 'Custom apparel at<br>volume pricing', fr: 'Vêtements personnalisés<br>a prix de volume' },
    'biz.hero.sub': {
      en: 'Staff uniforms, corporate swag, event merch, team gear. Transparent bulk pricing, dedicated account support, and everything printed in-house at our West Island studio.',
      fr: 'Uniformes d\'équipe, swag corporatif, merch événementiel, vêtements d\'équipe. Prix de volume transparents, support dédié et tout imprimé sur place dans notre studio de l\'Ouest-de-l\'Île.'
    },
    'biz.hero.cta1': { en: 'See Volume Pricing', fr: 'Voir les prix de volume' },
    'biz.hero.cta2': { en: 'Get a Custom Quote', fr: 'Obtenir une soumission' },
    'biz.who.label': { en: 'Who We Serve', fr: 'Qui on sert' },
    'biz.who.h2': { en: 'Built for businesses of every size', fr: 'Concu pour les entreprises de toute taille' },
    'biz.who.sub': {
      en: 'From a 10-person cafe team to a 500-unit corporate order, we treat every account with the same care and quality.',
      fr: 'D\'une équipe de 10 personnes dans un café a une commande corporative de 500 unites, on traite chaque compte avec le même soin et la même qualité.'
    },
    'biz.seg1.h': { en: 'Gyms, Cafes & Restaurants', fr: 'Gyms, cafés et restaurants' },
    'biz.seg1.p': {
      en: 'Branded staff uniforms and merchandise that represent your brand every day.',
      fr: 'Uniformes d\'équipe et produits de marque qui representent votre entreprise chaque jour.'
    },
    'biz.seg2.h': { en: 'Schools, Universities & Clubs', fr: 'Écoles, universites et clubs' },
    'biz.seg2.p': {
      en: 'Team gear, event merch, and student org apparel with fast turnaround.',
      fr: 'Vêtements d\'équipe, merch événementiel et vêtements d\'association etudiante avec un délai rapide.'
    },
    'biz.seg3.h': { en: 'Corporate & Startups', fr: 'Corporatif et startups' },
    'biz.seg3.p': {
      en: 'Company swag, onboarding kits, conference giveaways, and branded everything.',
      fr: 'Swag d\'entreprise, kits d\'accueil, cadeaux de conference et tout ce qui est de marque.'
    },
    'biz.why.label': { en: 'Why Businesses Choose Us', fr: 'Pourquoi les entreprises nous choisissent' },
    'biz.why.h2': { en: 'More than just a print shop', fr: 'Plus qu\'une simple imprimerie' },
    'biz.why.pricing.h': { en: 'Transparent Volume Pricing', fr: 'Prix de volume transparents' },
    'biz.why.pricing.p': {
      en: 'No surprises. See your exact per-unit cost upfront based on quantity and print sides.',
      fr: 'Pas de surprises. Voyez votre coût exact par unite selon la quantité et les côtés d\'impression.'
    },
    'biz.why.sample.h': { en: 'Sample Before Production', fr: 'Échantillon avant production' },
    'biz.why.sample.p': {
      en: 'Every order gets a physical sample for approval before we print the full run.',
      fr: 'Chaque commande reçoit un échantillon physique pour approbation avant la production complète.'
    },
    'biz.why.turnaround.h': { en: '2-4 Day Turnaround', fr: 'Délai de 2 à 4 jours' },
    'biz.why.turnaround.p': {
      en: 'Most orders ready in 2-4 business days. Rush options available when deadlines are tight.',
      fr: 'La plupart des commandes prêtes en 2 à 4 jours ouvrables. Options urgentes disponibles.'
    },
    'biz.why.design.h': { en: 'Free Design Help', fr: 'Aide au design gratuite' },
    'biz.why.design.p': {
      en: 'Our in-house design studio preps your artwork for production at no extra charge.',
      fr: 'Notre studio de design prépare votre visuel pour la production sans frais supplémentaires.'
    },
    'biz.why.delivery.h': { en: 'Free Delivery (25+ Units)', fr: 'Livraison gratuite (25+ unites)' },
    'biz.why.delivery.p': {
      en: 'Free delivery across Montreal on orders of 25+ units. Canada-wide shipping available.',
      fr: 'Livraison gratuite à Montréal pour les commandes de 25+ unites. Expedition partout au Canada.'
    },
    'biz.why.reorder.h': { en: 'Easy Reorders', fr: 'Recommandés faciles' },
    'biz.why.reorder.p': {
      en: 'We keep your artwork and specs on file. Reordering is as simple as sending a message.',
      fr: 'On conserve vos visuels et spécifications. Recommander est aussi simple que d\'envoyer un message.'
    },
    'biz.statement.h2': { en: 'The bigger the order, the better the price. No hidden fees, ever.', fr: 'Plus la commande est grande, meilleur est le prix. Aucuns frais cachés.' },
    'biz.statement.p': { en: 'All prices include printing. What you see is what you pay.', fr: 'Tous les prix incluent l\'impression. Ce que vous voyez est ce que vous payez.' },
    'biz.pricing.label': { en: 'Volume Pricing', fr: 'Prix de volume' },
    'biz.pricing.h2': { en: 'Print prices per unit', fr: 'Prix d\'impression par unite' },
    'biz.pricing.note': {
      en: 'Prices shown are based on Gildan-quality blanks and include printing. Premium blanks (Bella+Canvas, Comfort Colors, American Apparel, etc.) may vary, and final cost depends on the size of the print. Select a product to see the full breakdown by quantity and print sides.',
      fr: 'Les prix affiches sont bases sur des vêtements de qualité Gildan et incluent l\'impression. Les marques premium (Bella+Canvas, Comfort Colors, American Apparel, etc.) peuvent varier, et le coût final dépend de la taille de l\'impression. Sélectionnez un produit pour voir la ventilation par quantite et cotes d\'impression.'
    },
    'biz.pricing.canadian': { en: '+$2 each for Montreal-designed blanks (Rue Saint-Patrick)', fr: '+2$ chacun pour les vêtements conçus à Montréal (Rue Saint-Patrick)' },
    'biz.pricing.qty': { en: 'Quantity', fr: 'Quantité' },
    'biz.hiw.label': { en: 'How It Works', fr: 'Comment ça marche' },
    'biz.hiw.h2': { en: 'From first contact to delivery', fr: 'Du premier contact à la livraison' },
    'biz.hiw.step1.h': { en: 'Tell us what you need', fr: 'Dites-nous ce qu\'il vous faut' },
    'biz.hiw.step1.p': {
      en: 'Fill out a quick quote form or email us. Include your garment type, quantity, and any artwork you have.',
      fr: 'Remplissez un formulaire de soumission ou ecrivez-nous. Incluez le type de vêtement, la quantité et votre visuel.'
    },
    'biz.hiw.step2.h': { en: 'Get your quote', fr: 'Recevez votre soumission' },
    'biz.hiw.step2.p': {
      en: 'We respond within hours with a clear price breakdown. No back-and-forth, no hidden fees.',
      fr: 'On répond en quelques heures avec une ventilation claire des prix. Pas de va-et-vient, pas de frais cachés.'
    },
    'biz.hiw.step3.h': { en: 'Approve a sample', fr: 'Approuvez un échantillon' },
    'biz.hiw.step3.p': {
      en: 'We print a physical sample for your approval. You check colors, placement, and quality before full production.',
      fr: 'On imprimé un échantillon physique pour votre approbation. Vous vérifiez les couleurs, le placement et la qualité avant la production.'
    },
    'biz.hiw.step4.h': { en: 'We deliver', fr: 'On livre' },
    'biz.hiw.step4.p': {
      en: 'Full order ready in 2-4 business days. Free delivery across Montreal for 25+ units.',
      fr: 'Commande complète prété en 2 à 4 jours ouvrables. Livraison gratuite à Montréal pour 25+ unites.'
    },
    'biz.cta.h2': { en: 'Ready to outfit your team?', fr: 'Prêt à habiller votre équipe ?' },
    'biz.cta.sub': {
      en: 'Get a volume quote in hours, not days. No minimums, no commitments.',
      fr: 'Obtenez une soumission de volume en heures, pas en jours. Aucun minimum, aucun engagement.'
    },
    'biz.cta.btn': { en: 'Get a Business Quote', fr: 'Soumission entreprise' },

    // ===== QUOTE FORM =====
    'quote.h1': { en: 'Build your custom order', fr: 'Créez votre commande personnalisée' },
    'quote.sub': {
      en: 'Design your mockup, pick your options, and request a quote in minutes. No account needed.',
      fr: 'Créez votre maquette, choisissez vos options et demandez une soumission en quelques minutes. Aucun compte requis.'
    },
    'quote.step1.h': { en: 'Choose your product', fr: 'Choisissez votre produit' },
    'quote.step1.desc': { en: 'Select a garment type to start building your order.', fr: 'Sélectionnez un type de vêtement pour commencer votre commande.' },
    'quote.step2.h': { en: 'Upload your design & sizes', fr: 'Visuel et tailles' },
    'quote.step2.desc': { en: 'Drop your artwork to preview it on the mockup, then tell us how many of each size you need.', fr: 'Déposez votre visuel pour le prévisualiser sur la maquette, puis indiquez les quantités par taille.' },
    'quote.step3.h': { en: 'How do we reach you?', fr: 'Comment vous joindre ?' },
    'quote.step3.desc': { en: 'We\'ll send your quote by email, usually the same day.', fr: 'Nous vous enverrons votre soumission par courriel, souvent la même journée.' },
    'quote.step4.h': { en: 'Get your quote', fr: 'Obtenez votre soumission' },
    'quote.step4.desc': { en: 'Review and submit. We\'ll get back to you within hours.', fr: 'Révisez et soumettez. On vous répond en quelques heures.' },
    'quote.next': { en: 'Next', fr: 'Suivant' },
    'quote.back': { en: 'Back', fr: 'Retour' },
    'quote.submit': { en: 'Submit Quote Request', fr: 'Soumettre la demande' },
    'quote.order.button': { en: 'Order & Pay Now — secure checkout', fr: 'Commander et payer — paiement sécurisé' },
    'quote.order.note': { en: 'Pay securely by card or Affirm. Prefer to talk pricing first? Request a quote below.', fr: 'Payez en toute sécurité par carte ou Affirm. Vous préférez discuter du prix d\'abord? Demandez une soumission ci-dessous.' },
    'quote.order.quoteinstead': { en: 'Request a quote instead', fr: 'Demander une soumission' },
    'quote.garmentcolor': { en: 'Garment Color', fr: 'Couleur du vêtement' },
    'quote.placement': { en: 'Print Placement', fr: 'Emplacement de l\'impression' },
    'quote.placement.front': { en: 'Front', fr: 'Avant' },
    'quote.placement.back': { en: 'Back', fr: 'Arrière' },
    'quote.placement.rightchest': { en: 'Right Chest', fr: 'Poitrine droite' },
    'quote.placement.sleeve': { en: 'Sleeve', fr: 'Manche' },
    'quote.method': { en: 'Print Method', fr: 'Méthode d\'impression' },
    'quote.method.dtg': { en: 'DTG (Direct to Garment)', fr: 'DTG (directement sur vêtement)' },
    'quote.method.dtf': { en: 'DTF (Direct to Film)', fr: 'DTF (direct sur film)' },
    'quote.method.embroidery': { en: 'Embroidery', fr: 'Broderie' },
    'quote.method.notsure': { en: 'Not sure (we\'ll recommend)', fr: 'Pas certain (on vous conseille)' },
    'quote.garmentsource': { en: 'Garment Source', fr: 'Source du vêtement' },
    'quote.garmentsource.wesupply': { en: 'We Supply', fr: 'On fournit' },
    'quote.garmentsource.bringyourown': { en: 'Bring Your Own', fr: 'Apportez le vôtre' },
    'quote.blankbrand': { en: 'Blank Brand', fr: 'Marque du vêtement' },
    'quote.blankbrand.any': { en: 'Any / Let us recommend', fr: 'Au choix / On recommande' },
    'quote.quantity': { en: 'Quantity', fr: 'Quantité' },
    'quote.sizes': { en: 'Sizes Needed', fr: 'Tailles requises' },
    'quote.timeline': { en: 'Timeline', fr: 'Délai' },
    'quote.timeline.standard': { en: 'Standard (2-4 business days)', fr: 'Standard (2-4 jours ouvrables)' },
    'quote.timeline.rush': { en: 'Rush (1-2 business days)', fr: 'Urgent (1-2 jours ouvrables)' },
    'quote.timeline.flexible': { en: 'Flexible / No rush', fr: 'Flexible / Pas presse' },
    'quote.upload': { en: 'Upload Your Design', fr: 'Téléversez votre design' },
    'quote.notes': { en: 'Additional Notes', fr: 'Notes supplémentaires' },
    'quote.name': { en: 'Full Name', fr: 'Nom complet' },
    'quote.email': { en: 'Email', fr: 'Courriel' },
    'quote.phone': { en: 'Phone', fr: 'Téléphone' },
    'quote.summary': { en: 'Order Summary', fr: 'Résumé de la commande' },
    'quote.summary.product': { en: 'Product', fr: 'Produit' },
    'quote.summary.color': { en: 'Color', fr: 'Couleur' },
    'quote.summary.placement': { en: 'Placement', fr: 'Emplacement' },
    'quote.summary.method': { en: 'Method', fr: 'Méthode' },
    'quote.summary.qty': { en: 'Qty', fr: 'Qté' },
    'quote.designhere': { en: 'Your design appears here', fr: 'Votre design apparaît ici' },

    // Method info cards
    'quote.method.dtg.title': { en: 'DTG', fr: 'DTG' },
    'quote.method.dtg.desc': { en: 'Direct-to-garment printing for vibrant, detailed full-color designs', fr: 'Impression directe sur vêtement pour des designs colores et détaillés' },
    'quote.method.dtg.best': { en: 'Best for:', fr: 'Ideal pour :' },
    'quote.method.dtg.use': { en: 'Photo prints, gradients, complex artwork', fr: 'Photos, degrades, illustrations complexes' },
    'quote.method.dtf.title': { en: 'DTF', fr: 'DTF' },
    'quote.method.dtf.desc': { en: 'Heat transfer film for durability on any fabric type', fr: 'Transfert thermique pour durabilite sur tout type de tissu' },
    'quote.method.dtf.best': { en: 'Best for:', fr: 'Ideal pour :' },
    'quote.method.dtf.use': { en: 'Dark fabrics, athletic wear, blended materials', fr: 'Tissus fonces, vêtements sport, materiaux melanges' },
    'quote.method.emb.title': { en: 'Embroidery', fr: 'Broderie' },
    'quote.method.emb.desc': { en: 'Stitched logos and text for a premium, professional look', fr: 'Logos et textes brodés pour un look professionnel haut de gamme' },
    'quote.method.emb.best': { en: 'Best for:', fr: 'Ideal pour :' },
    'quote.method.emb.use': { en: 'Logos, corporate branding, structured garments', fr: 'Logos, image de marque, vêtements structures' },

    // Pricing section
    'quote.pricing': { en: 'Pricing', fr: 'Tarification' },
    'quote.pricing.small': { en: 'Small Order', fr: 'Petite commande' },
    'quote.pricing.bulk': { en: 'Bulk', fr: 'En gros' },
    'quote.pricing.total': { en: 'Total estimate:', fr: 'Estimation totale :' },
    // Shipping line under the running total. JS swaps the value to
    // "FREE — In-store pickup", "FREE — Greater Montreal $500+", or
    // the selected paid rate once a postal code estimate completes.
    'quote.pricing.shipping': { en: 'Shipping:', fr: 'Livraison :' },
    'quote.pricing.shipping.prompt': { en: 'Enter postal code below to get shipping estimate', fr: 'Entrez votre code postal ci-dessous pour une estimation' },
    'quote.pricing.discount': { en: 'Volume discount!', fr: 'Rabais de volume !' },
    'quote.pricing.note': { en: 'Estimated price \u2022 Final quote may vary', fr: 'Prix estime \u2022 La soumission finale peut varier' },
    'quote.pricing.b2bnote': { en: 'Bulk pricing starts at 5+ units', fr: 'Les prix en gros commencent à 5+ unites' },

    // Payment section
    'quote.payment.button': { en: 'Pay & Order Now', fr: 'Payer et commander' },
    'quote.payment.note': { en: 'Payment processing coming soon \u2014 we\'ll send you an invoice by email.', fr: 'Paiement en ligne bientôt disponible \u2014 nous vous enverrons une facture par courriel.' },

    // Mockup download
    'quote.mockup.download': { en: '\ud83d\udcf7 Download Mockup', fr: '\ud83d\udcf7 Télécharger la maquette' },

    // Canvas editor - Print area
    'quote.printarea': { en: 'Print area:', fr: 'Zone d\'impression :' },
    'quote.printarea.small': { en: 'Small (10×10cm)', fr: 'Petite (10×10cm)' },
    'quote.printarea.medium': { en: 'Medium (20×15cm)', fr: 'Moyenne (20×15cm)' },
    'quote.printarea.large': { en: 'Large (20×30cm)', fr: 'Grande (20×30cm)' },
    'quote.printarea.xl': { en: 'XL (30×40cm)', fr: 'XL (30×40cm)' },

    // Canvas editor - Toolbar
    'quote.toolbar.upload': { en: 'Upload Design', fr: 'Télécharger le design' },
    'quote.toolbar.center': { en: 'Center', fr: 'Centrer' },
    'quote.toolbar.delete': { en: 'Delete Design', fr: 'Supprimer le design' },
    'quote.toolbar.flip': { en: 'Flip Horizontal', fr: 'Retourner horizontalement' },

    // Canvas editor - Info
    'quote.canvas': { en: 'Design canvas', fr: 'Canevas de design' },
    'quote.canvas.info': { en: 'Click to select • Drag to move • Corner handles to resize & rotate', fr: 'Cliquez pour sélectionner • Glissez pour deplacer • Coins pour redimensionner et tourner' },

    // ===== NAV ADDITIONS =====
    'nav.catalog': { en: 'Catalog', fr: 'Catalogue' },
    // Category dropdowns on the two-row site header (components.js loadNav).
    'nav.tshirts':  { en: 'T-Shirts',             fr: 'T-shirts' },
    'nav.hoodies':  { en: 'Hoodies',              fr: 'Hoodies' },
    'nav.polos':    { en: 'Polos',               fr: 'Polos' },
    'nav.jackets':  { en: 'Jackets',             fr: 'Vestes' },
    'nav.bottoms':  { en: 'Bottoms',             fr: 'Bas' },
    'nav.workwear': { en: 'Workwear',             fr: 'Vêtements de travail' },
    'nav.accessories': { en: 'Accessories',       fr: 'Accessoires' },
    'nav.bags':     { en: 'Bags',                 fr: 'Sacs' },
    'nav.hats':     { en: 'Hats',                 fr: 'Chapeaux' },
    'nav.jerseys':  { en: 'Jerseys',              fr: 'Maillots' },
    'nav.jerseys.hockey':     { en: 'Hockey',     fr: 'Hockey' },
    'nav.jerseys.soccer':     { en: 'Soccer',     fr: 'Soccer' },
    'nav.jerseys.basketball': { en: 'Basketball', fr: 'Basketball' },
    'nav.jerseys.baseball':   { en: 'Baseball',   fr: 'Baseball' },
    'nav.jerseys.football':   { en: 'Football',   fr: 'Football' },
    'nav.jerseys.volleyball': { en: 'Volleyball', fr: 'Volleyball' },
    // Compact label on the mobile collapsed bar — "Quote" instead of "Get a Quote".
    'nav.quote.short':       { en: 'Quote',                  fr: 'Devis' },
    // Header search field placeholder.
    'nav.search.placeholder':{ en: 'Search 1,100+ blanks',   fr: 'Chercher parmi 1 100+ vêtements' },

    // ===== SHARED FR-ONLY NOTICE (industries + guides) =====
    'page.fr-notice': {
      en: 'The detailed content of this article is available in English. A full French version is coming soon — contact us at 438-544-3800 for any questions.',
      fr: 'Le contenu détaillé de cet article est disponible en anglais. Une version française intégrale arrive bientôt — contactez-nous au 438-544-3800 pour toute question.'
    },

    // ===== CATALOG =====
    'cat.hero.h1': { en: 'Our blanks catalog', fr: 'Notre catalogue de vêtements' },
    'cat.hero.p': {
      en: 'Browse <strong id="catCount">4,500+</strong> blanks from S&amp;S Activewear, SanMar Canada &amp; Blanks.ca — Bella+Canvas, Gildan, Port Authority, ATC, OGIO, Comfort Colors, Champion, Carhartt-style, and more. Filter by brand, fit, fabric, or certification. Pick a SKU and get a printed-garment quote in under a minute.',
      fr: 'Parcourez <strong id="catCount">4 500+</strong> vêtements de S&amp;S Activewear, SanMar Canada et Blanks.ca — Bella+Canvas, Gildan, Port Authority, ATC, OGIO, Comfort Colors, Champion, style Carhartt et plus. Filtrez par marque, coupe, tissu ou certification. Choisissez un modèle et obtenez une soumission imprimée en moins d\'une minute.'
    },
    'cat.hero.meta1': { en: '<strong>Stock + prices</strong> refresh daily', fr: '<strong>Stock et prix</strong> mis à jour chaque jour' },
    'cat.hero.meta2': { en: '<strong>3–5 day</strong> typical turnaround', fr: 'Délai habituel de <strong>3 à 5 jours</strong>' },
    'cat.hero.meta3': { en: 'Montreal-designed blanks available', fr: 'Vêtements conçus à Montréal disponibles' },

    // ===== SPORTS JERSEYS HUB (jerseys.html) =====
    'jersey.title':   { en: 'Custom Team Jerseys', fr: 'Maillots d\'équipe personnalisés' },
    'jersey.hero.h1': { en: 'Custom team jerseys, built name by name', fr: 'Maillots d\'équipe, personnalisés joueur par joueur' },
    'jersey.hero.p': {
      en: 'Pick a jersey blank for your sport, then build your roster — every player gets their <strong>name, number, and a team font</strong>. We print or stitch the whole team and send one quote.',
      fr: 'Choisissez un maillot pour votre sport, puis montez votre alignement — chaque joueur obtient son <strong>nom, son numéro et une police d\'équipe</strong>. On imprime ou brode toute l\'équipe et on envoie une seule soumission.'
    },
    'jersey.hero.cta':    { en: 'Choose your sport', fr: 'Choisissez votre sport' },
    'jersey.pick.title':  { en: 'Pick your sport', fr: 'Choisissez votre sport' },
    'jersey.all':         { en: 'All jerseys', fr: 'Tous les maillots' },
    'jersey.count':       { en: 'jerseys', fr: 'maillots' },
    'jersey.empty':       { en: 'No jerseys found for this sport yet — call us at 438-544-3800 and we will source them.', fr: 'Aucun maillot trouvé pour ce sport — appelez-nous au 438-544-3800 et on s\'en occupe.' },
    'jersey.loading':     { en: 'Loading jerseys…', fr: 'Chargement des maillots…' },
    'jersey.card.cta':    { en: 'Customize this jersey', fr: 'Personnaliser ce maillot' },
    'jersey.from':        { en: 'From', fr: 'À partir de' },
    'jersey.perunit':     { en: '/unit', fr: '/unité' },
    // Customizer
    'jersey.cz.title':    { en: 'Build your team', fr: 'Montez votre équipe' },
    'jersey.cz.color':    { en: 'Jersey color', fr: 'Couleur du maillot' },
    'jersey.cz.font':     { en: 'Team font', fr: 'Police d\'équipe' },
    'jersey.cz.decoration': { en: 'Decoration', fr: 'Décoration' },
    'jersey.cz.deco.print':  { en: 'Printed', fr: 'Imprimé' },
    'jersey.cz.deco.twill':  { en: 'Sewn twill', fr: 'Twill cousu' },
    'jersey.cz.deco.heat':   { en: 'Heat-press vinyl', fr: 'Vinyle thermocollé' },
    'jersey.cz.roster':   { en: 'Roster', fr: 'Alignement' },
    'jersey.cz.name':     { en: 'Player name', fr: 'Nom du joueur' },
    'jersey.cz.number':   { en: 'No.', fr: 'N°' },
    'jersey.cz.size':     { en: 'Size', fr: 'Taille' },
    'jersey.cz.addrow':   { en: '+ Add player', fr: '+ Ajouter un joueur' },
    'jersey.cz.paste':    { en: 'Paste a list', fr: 'Coller une liste' },
    'jersey.cz.paste.hint': { en: 'One player per line: Name, Number, Size', fr: 'Un joueur par ligne : Nom, Numéro, Taille' },
    'jersey.cz.preview':  { en: 'Live preview', fr: 'Aperçu en direct' },
    'jersey.cz.players':  { en: 'players', fr: 'joueurs' },
    'jersey.cz.add':      { en: 'Add team to quote', fr: 'Ajouter l\'équipe à la soumission' },
    'jersey.cz.added':    { en: 'Team added to your quote', fr: 'Équipe ajoutée à votre soumission' },
    'jersey.cz.viewquote':{ en: 'Review quote', fr: 'Voir la soumission' },
    'jersey.cz.close':    { en: 'Close', fr: 'Fermer' },
    'jersey.cz.remove':   { en: 'Remove', fr: 'Retirer' },
    'jersey.cz.empty':    { en: 'Add at least one player to continue.', fr: 'Ajoutez au moins un joueur pour continuer.' },
    'jersey.cz.fontnote': { en: 'Preview fonts approximate our press styles. Final lettering uses our licensed jersey fonts.', fr: 'Les polices d\'aperçu approximent nos styles. Le lettrage final utilise nos polices de maillot sous licence.' },
    // Decoration model: names/numbers always DTF; optional front logo DTF or embroidery.
    'jersey.cz.namesnumbers': { en: 'Names & numbers', fr: 'Noms et numéros' },
    'jersey.cz.dtfstd':       { en: 'DTF print',       fr: 'Impression DTF' },
    'jersey.cz.frontlogo':    { en: 'Front logo (optional)', fr: 'Logo avant (optionnel)' },
    'jersey.cz.logoplace':    { en: 'Logo placement',  fr: 'Emplacement du logo' },
    'jersey.cz.uploadlogo':   { en: 'Upload logo',     fr: 'Téléverser le logo' },
    'jersey.cz.logo.none':    { en: 'No logo',         fr: 'Aucun logo' },
    'jersey.cz.logo.dtf':     { en: 'DTF print',       fr: 'Impression DTF' },
    'jersey.cz.logo.emb':     { en: 'Embroidery',      fr: 'Broderie' },
    'jersey.cz.place.left':   { en: 'Left chest',      fr: 'Poitrine gauche' },
    'jersey.cz.place.center': { en: 'Center chest',    fr: 'Centre poitrine' },
    'jersey.cz.place.full':   { en: 'Full front',      fr: 'Plein devant' },
    'jersey.cz.adding':       { en: 'Pricing…',        fr: 'Calcul du prix…' },
    'jersey.cz.uploading':    { en: 'Uploading…',      fr: 'Téléversement…' },
    'jersey.cz.uploadfail':   { en: 'upload failed, we will collect it with your quote', fr: 'échec du téléversement, nous le récupérerons avec votre soumission' },
    'jersey.cz.nologo':       { en: 'No file chosen yet', fr: 'Aucun fichier choisi' },
    'jersey.cz.front':        { en: 'Front',            fr: 'Devant' },
    'jersey.cz.back':         { en: 'Back',             fr: 'Dos' },
    'jersey.cz.logosize':     { en: 'Logo size',        fr: 'Taille du logo' },
    'jersey.cz.removebg':     { en: 'Remove white background', fr: 'Retirer le fond blanc' },
    'jersey.cz.draghint':     { en: 'Drag the logo on the jersey to position it.', fr: 'Glissez le logo sur le maillot pour le positionner.' },
    // Jersey line item on the quote page.
    'quote.cart.jersey.subtotal':     { en: 'subtotal',     fr: 'sous-total' },
    'quote.cart.jersey.quoted':       { en: 'Priced with your quote', fr: 'Chiffré avec votre soumission' },
    'quote.cart.jersey.namesnumbers': { en: 'Names & numbers', fr: 'Noms et numéros' },
    'quote.cart.jersey.logo':         { en: 'Front logo',   fr: 'Logo avant' },
    'quote.cart.jersey.font':         { en: 'Font',         fr: 'Police' },
    'quote.cart.jersey.edit':         { en: 'Edit on jerseys page', fr: 'Modifier sur la page maillots' },
    'quote.cart.jersey.roster':       { en: 'Roster',       fr: 'Alignement' },
    'quote.cart.jersey.customizelogo':{ en: 'Customize logo on garment', fr: 'Positionner le logo sur le vêtement' },
    'quote.cart.jersey.mockupready':  { en: '✓ Mockup ready · edit', fr: '✓ Maquette prête · modifier' },
    'cat.search.placeholder': { en: 'Search by brand, style number, fabric…', fr: 'Rechercher par marque, numéro de style, tissu…' },
    'cat.btn.filters': { en: 'Filters', fr: 'Filtres' },
    'cat.qty.label': { en: 'Pricing for', fr: 'Prix pour' },
    'cat.qty.units': { en: 'units', fr: 'unités' },
    'cat.qty.oneside': { en: '· 1 print side', fr: '· 1 côté imprimé' },
    'cat.qty.custom': { en: 'Custom', fr: 'Personnalisé' },
    'cat.results.products': { en: 'products', fr: 'produits' },
    'cat.sort.label': { en: 'Sort:', fr: 'Trier :' },
    'cat.sort.bestseller': { en: 'Bestseller', fr: 'Populaires' },
    'cat.sort.price_asc': { en: 'Price ↑ (low → high)', fr: 'Prix ↑ (bas → haut)' },
    'cat.sort.price_desc': { en: 'Price ↓ (high → low)', fr: 'Prix ↓ (haut → bas)' },
    'cat.sort.name_asc': { en: 'Name A → Z', fr: 'Nom A → Z' },
    'cat.sort.brand_asc': { en: 'Brand A → Z', fr: 'Marque A → Z' },
    'cat.empty.h3': { en: 'No matches', fr: 'Aucun résultat' },
    'cat.empty.p': { en: 'Try removing a filter or check our "Bring your own blank" option.', fr: 'Essayez de retirer un filtre ou utilisez l\'option « Apportez le vôtre ».' },
    'cat.loading': { en: 'Loading more…', fr: 'Chargement…' },
    'cat.cart.units': { en: 'units in your quote', fr: 'unités dans votre soumission' },
    'cat.cart.cta': { en: 'Continue to quote →', fr: 'Continuer vers la soumission →' },
    'cat.toast.added': { en: '✓ Added to quote', fr: '✓ Ajouté à la soumission' },
    'cat.byo.title': { en: 'Bring your own blank', fr: 'Apportez votre propre vêtement' },
    'cat.byo.sub': { en: 'Got a SKU or tech pack? Send it over — we\'ll source and quote it.', fr: 'Vous avez un SKU ou un dossier technique ? Envoyez-le-nous — on le source et on vous fait une soumission.' },
    'cat.filter.refine': { en: 'Refine results', fr: 'Affiner les résultats' },
    'cat.browseall':     { en: 'Browse all 1,000+ products alphabetically →', fr: 'Parcourir les 1 000+ produits par ordre alphabétique →' },
    'cat.filter.clear': { en: 'Clear all', fr: 'Tout effacer' },
    'cat.filter.apply': { en: 'Apply', fr: 'Appliquer' },
    'cat.detail.specs': { en: 'Tech specs', fr: 'Spécifications techniques' },
    'cat.detail.allcolors': { en: 'All colors', fr: 'Toutes les couleurs' },
    'cat.detail.qty': { en: 'Qty', fr: 'Qté' },
    'cat.card.view-details': { en: 'View details ↗', fr: 'Voir les détails ↗' },
    'cat.card.add-to-quote': { en: '+ Add to quote', fr: '+ Ajouter à la soumission' },
    'cat.card.units-at-tier': { en: 'units · adjust qty later', fr: 'unités · qté ajustable ensuite' },
    'cat.card.oneside': { en: '1-side print', fr: 'Impression 1 côté' },
    'cat.card.from': { en: 'From', fr: 'À partir de' },
    'cat.card.perunit': { en: '/unit', fr: '/unité' },
    'cat.card.quote-on-request': { en: 'Quote on request', fr: 'Sur demande' },
    'cat.card.oos': { en: 'Out of stock', fr: 'En rupture' },
    'cat.card.low': { en: 'Low stock', fr: 'Stock faible' },
    'cat.card.bestseller': { en: '★ Bestseller', fr: '★ Populaire' },
    'cat.card.canadian': { en: '🍁 Designed in Montreal', fr: '🍁 Conçu à Montréal' },
    'cat.card.csa': { en: 'CSA Hi-Vis', fr: 'CSA hi-vis' },
    'cat.detail.color': { en: 'Color:', fr: 'Couleur :' },
    'cat.detail.sizes': { en: 'Sizes in stock:', fr: 'Tailles disponibles :' },
    'cat.detail.contactus': { en: 'contact us', fr: 'contactez-nous' },
    'cat.detail.showall': { en: 'Show all', fr: 'Tout afficher' },
    'cat.detail.showfewer': { en: 'Show fewer specs ▴', fr: 'Afficher moins ▴' },
    'cat.detail.specs-suffix': { en: 'specs ▾', fr: 'specs ▾' },

    // ===== QUOTE ADDITIONS =====
    'quote.step.label1': { en: '1 · Product &amp; design', fr: '1 · Produit et design' },
    'quote.step.label2': { en: '2 · Sizes &amp; quantity', fr: '2 · Tailles et quantité' },
    'quote.step.label3': { en: '3 · Your details', fr: '3 · Vos coordonnées' },
    'quote.cart.addmore': { en: '+ Add another item from catalog', fr: '+ Ajouter un autre article du catalogue' },
    'quote.cart.change': { en: 'Change product', fr: 'Changer de produit' },
    'quote.cart.empty.title': { en: 'Pick your blank from the catalog', fr: 'Choisissez votre vêtement dans le catalogue' },
    'quote.cart.empty.sub': {
      en: '1,100+ Bella+Canvas, Gildan, Berne, Adidas, Montreal-designed &amp; more. We\'ll pre-fill this quote, show live pricing as you change qty / sides, and skip the back-and-forth.',
      fr: '1 100+ Bella+Canvas, Gildan, Berne, Adidas, conçus à Montréal et plus. On préremplira la soumission, on affiche le prix en direct et on évite les allers-retours.'
    },
    'quote.cart.empty.cta': { en: 'Browse catalog →', fr: 'Parcourir le catalogue →' },
    'quote.cart.item.color': { en: 'Color:', fr: 'Couleur :' },
    'quote.cart.item.qty': { en: 'Qty', fr: 'Qté' },
    'quote.cart.item.sides': { en: 'Sides', fr: 'Côtés' },
    'quote.cart.item.remove': { en: 'Remove', fr: 'Retirer' },
    'quote.cart.item.priceloading': { en: 'Price loading…', fr: 'Chargement du prix…' },
    'quote.cart.item.swatches.more': { en: '+ {n} more ▾', fr: '+ {n} autres ▾' },
    'quote.cart.item.swatches.fewer': { en: 'Show fewer ▴', fr: 'Voir moins ▴' },
    'quote.product.type': { en: 'Product type', fr: 'Type de produit' },
    'quote.placement.title': { en: 'Where do you want the design?', fr: 'Où voulez-vous le design ?' },
    'quote.placement.badge.one': { en: '1 location', fr: '1 emplacement' },
    'quote.placement.group.front': { en: 'Front', fr: 'Avant' },
    'quote.placement.group.back': { en: 'Back', fr: 'Arrière' },
    'quote.placement.group.sleeves': { en: 'Sleeves', fr: 'Manches' },
    'quote.placement.leftchest.l': { en: 'Left Chest', fr: 'Poitrine gauche' },
    'quote.placement.leftchest.d': { en: '~3-4" — logo / pocket', fr: '~3 à 4 po — logo / poche' },
    'quote.placement.centerchest.l': { en: 'Center Chest', fr: 'Poitrine centrale' },
    'quote.placement.centerchest.d': { en: '~7" mid-chest', fr: '~7 po milieu de poitrine' },
    'quote.placement.fullfront.l': { en: 'Full Front', fr: 'Avant complet' },
    'quote.placement.fullfront.d': { en: '~11" chest panel', fr: '~11 po sur la poitrine' },
    'quote.placement.oversized.l': { en: 'Oversized', fr: 'Surdimensionné' },
    'quote.placement.oversized.d': { en: '~14" chest to waist', fr: '~14 po de la poitrine à la taille' },
    'quote.placement.backtop.l': { en: 'Top Back', fr: 'Haut du dos' },
    'quote.placement.backtop.d': { en: 'Under collar, ~5"', fr: 'Sous le col, ~5 po' },
    'quote.placement.backacross.l': { en: 'Across Back', fr: 'Travers du dos' },
    'quote.placement.backacross.d': { en: '~12" upper back', fr: '~12 po haut du dos' },
    'quote.placement.backfull.l': { en: 'Full Back', fr: 'Dos complet' },
    'quote.placement.backfull.d': { en: '~14" full panel', fr: '~14 po panneau complet' },
    'quote.placement.leftsleeve.l': { en: 'Left Sleeve', fr: 'Manche gauche' },
    'quote.placement.leftsleeve.d': { en: 'Bicep, small hit', fr: 'Biceps, petit motif' },
    'quote.placement.rightsleeve.l': { en: 'Right Sleeve', fr: 'Manche droite' },
    'quote.placement.rightsleeve.d': { en: 'Bicep, small hit', fr: 'Biceps, petit motif' },
    'quote.placement.summary': { en: 'Center Chest selected. Each placement is one print, billed per location.', fr: 'Poitrine centrale sélectionnée. Chaque emplacement est une impression, facturée par emplacement.' },
    'quote.method.dtg.short': { en: 'DTG', fr: 'DTG' },
    'quote.method.dtg.descshort': { en: 'Direct-to-garment digital printing for full-colour, photo-quality detail.', fr: 'Impression numérique directe sur vêtement, pleine couleur et qualité photo.' },
    'quote.method.dtg.bestshort': { en: 'Best for: photos, gradients, complex artwork', fr: 'Idéal pour : photos, dégradés, illustrations complexes' },
    'quote.method.dtf.short': { en: 'DTF', fr: 'DTF' },
    'quote.method.dtf.descshort': { en: 'Heat-transfer film that bonds to any fabric, dark or light, stretchy or rigid.', fr: 'Film de transfert thermique qui adhère à tout tissu, foncé ou clair, extensible ou rigide.' },
    'quote.method.dtf.bestshort': { en: 'Best for: dark fabrics, athletic wear, blends', fr: 'Idéal pour : tissus foncés, vêtements sport, mélanges' },
    'quote.method.emb.short': { en: 'Embroidery', fr: 'Broderie' },
    'quote.method.emb.descshort': { en: 'Stitched logos and text for a premium, tactile, professional finish.', fr: 'Logos et textes brodés pour un fini haut de gamme, tactile et professionnel.' },
    'quote.method.emb.bestshort': { en: 'Best for: caps, polos, corporate uniforms', fr: 'Idéal pour : casquettes, polos, uniformes corporatifs' },
    'quote.method.notsure.short': { en: 'Not sure yet', fr: 'Pas certain' },
    'quote.method.notsure.descshort': { en: 'We\'ll recommend the best method when we follow up with your quote.', fr: 'On vous recommandera la meilleure méthode avec votre soumission.' },
    'quote.method.recommended': { en: '★ Recommended for this product', fr: '★ Recommandé pour ce produit' },
    'quote.method.we_supply.l': { en: 'We Supply', fr: 'On fournit' },
    'quote.method.we_supply.s': { en: 'We source the blank', fr: 'On source le vêtement' },
    'quote.method.byo.l': { en: 'Bring Your Own', fr: 'Apportez le vôtre' },
    'quote.method.byo.s': { en: 'You provide garments', fr: 'Vous fournissez les vêtements' },
    'quote.size.surcharge': { en: '2XL &amp; up add a <strong>$3/pc</strong> surcharge — standard industry rate.', fr: '2XL et plus : supplément de <strong>3 $/pièce</strong> — tarif standard de l\'industrie.' },
    'quote.size.total': { en: 'Total units:', fr: 'Total d\'unités :' },
    'quote.byo.tag': { en: 'Decoration only · Bring-your-own', fr: 'Décoration seulement · Apportez le vôtre' },
    'quote.byo.per': { en: '/garment', fr: '/vêtement' },
    'quote.byo.sides1': { en: '1 side', fr: '1 côté' },
    'quote.byo.qty': { en: 'Qty', fr: 'Qté' },
    'quote.byo.total': { en: 'Total decoration', fr: 'Total décoration' },
    'quote.byo.note': {
      en: 'You ship us the garments, we print/embroider. Final number depends on artwork complexity, deadline, and decoration method. Pick a print method below to refresh.',
      fr: 'Vous nous envoyez les vêtements, on imprime ou brode. Le prix final dépend de la complexité du visuel, du délai et de la méthode. Choisissez une méthode plus bas pour rafraîchir.'
    },
    'quote.liveprice.tag': { en: 'Live estimate', fr: 'Estimation en direct' },
    'quote.liveprice.unitsuffix': { en: '/unit', fr: '/unité' },
    'quote.liveprice.pickqty': { en: 'pick qty in Step 2', fr: 'choisissez la quantité à l\'étape 2' },
    'quote.liveprice.total': { en: 'Total', fr: 'Total' },
    'quote.liveprice.note': {
      en: 'Final quote may vary based on artwork complexity, decoration method, and delivery deadline.',
      fr: 'La soumission finale peut varier selon la complexité du visuel, la méthode et le délai.'
    },
    'quote.canadian.label': { en: 'Montreal-designed blanks', fr: 'Vêtements conçus à Montréal' },
    'quote.canadian.surcharge': { en: '+$2/unit', fr: '+2 $/unité' },
    'quote.canadian.sub': { en: 'Canadian brand, designed in Montreal (Rue Saint-Patrick). Optional upgrade from the standard blanks.', fr: 'Marque canadienne, conçue à Montréal (Rue Saint-Patrick). Mise à niveau facultative par rapport aux vêtements standards.' },
    'quote.bulk.label': { en: 'See bulk pricing for', fr: 'Voir les prix en gros pour' },
    'quote.bulk.product': { en: 'your product', fr: 'votre produit' },
    'quote.bulk.expand': { en: 'tap to expand ⌄', fr: 'cliquez pour développer ⌄' },
    'quote.bulk.note': {
      en: 'Prices are per unit and include standard blank + printing. Bulk pricing kicks in at 5+ units; smaller orders use retail pricing.',
      fr: 'Les prix sont par unité et incluent vêtement standard + impression. Le prix en gros s\'applique à partir de 5 unités; les commandes plus petites utilisent le prix de détail.'
    },
    'quote.bulk.canadianadd': { en: 'Montreal-designed blanks add $2/unit on T-shirts and Long Sleeves.', fr: 'Les vêtements conçus à Montréal ajoutent 2 $/unité sur les T-shirts et manches longues.' },
    'quote.purpose.label': { en: 'What\'s this for?', fr: 'Pour quoi est-ce ?' },
    'quote.purpose.opt0': { en: 'Select...', fr: 'Sélectionnez...' },
    'quote.purpose.opt1': { en: 'Business / brand merch', fr: 'Merch entreprise / marque' },
    'quote.purpose.opt2': { en: 'Team uniforms', fr: 'Uniformes d\'équipe' },
    'quote.purpose.opt3': { en: 'Event or conference', fr: 'Événement ou conférence' },
    'quote.purpose.opt4': { en: 'Content creator / influencer', fr: 'Créateur de contenu / influenceur' },
    'quote.purpose.opt5': { en: 'Personal / gift', fr: 'Personnel / cadeau' },
    'quote.purpose.opt6': { en: 'Resale / store', fr: 'Revente / boutique' },
    'quote.purpose.opt7': { en: 'Other', fr: 'Autre' },
    'quote.notes.placeholder': { en: 'Colors, placement notes, deadline, or anything that helps us quote accurately.', fr: 'Couleurs, notes d\'emplacement, délai ou tout autre détail qui aide à la soumission.' },
    'quote.contact.namelabel': { en: 'Full name *', fr: 'Nom complet *' },
    'quote.contact.name.ph': { en: 'Your name', fr: 'Votre nom' },
    'quote.contact.companylabel': { en: 'Company / brand', fr: 'Entreprise / marque' },
    'quote.contact.company.ph': { en: 'Optional', fr: 'Facultatif' },
    'quote.contact.emaillabel': { en: 'Email *', fr: 'Courriel *' },
    'quote.contact.email.ph': { en: 'you@example.com', fr: 'vous@exemple.com' },
    'quote.contact.phonelabel': { en: 'Phone', fr: 'Téléphone' },
    'quote.contact.phone.ph': { en: '514-xxx-xxxx', fr: '514-xxx-xxxx' },
    'quote.contact.delivery': { en: 'Delivery preference', fr: 'Préférence de livraison' },
    'quote.contact.delivery.opt1': { en: 'Local pickup (West Island)', fr: 'Ramassage local (Ouest-de-l\'Île)' },
    'quote.contact.delivery.opt2': { en: 'Montreal delivery', fr: 'Livraison à Montréal' },
    'quote.contact.delivery.opt3': { en: 'Shipping (Canada-wide)', fr: 'Expédition (partout au Canada)' },
    'quote.contact.hear': { en: 'How did you hear about us?', fr: 'Comment avez-vous entendu parler de nous ?' },
    'quote.contact.hear.opt1': { en: 'Google search', fr: 'Recherche Google' },
    'quote.contact.hear.opt2': { en: 'Instagram', fr: 'Instagram' },
    'quote.contact.hear.opt3': { en: 'Facebook', fr: 'Facebook' },
    'quote.contact.hear.opt4': { en: 'Friend / referral', fr: 'Ami / référence' },
    'quote.contact.hear.opt5': { en: 'Repeat customer', fr: 'Client habitué' },
    'quote.contact.hear.opt6': { en: 'Other', fr: 'Autre' },
    'quote.success.h2': { en: 'Quote request sent!', fr: 'Demande de soumission envoyée !' },
    'quote.success.p': { en: 'We\'ll send your quote by email within an hour during business hours (9am-9pm). Check your inbox — and spam, just in case.', fr: 'Nous enverrons votre soumission par courriel en moins d\'une heure pendant les heures d\'ouverture (9 h à 21 h). Vérifiez votre boîte de réception — et le pourriel, au cas où.' },
    'quote.success.btn': { en: 'Back to Home', fr: 'Retour à l\'accueil' },
    'quote.reassure.tag': { en: 'Included with your quote', fr: 'Inclus avec votre soumission' },
    'quote.reassure.title': { en: 'A photoreal mockup, made for you', fr: 'Une maquette photoréaliste, créée pour vous' },
    'quote.reassure.copy': { en: 'Fill in your details below. Within an hour our team renders a printed-quality preview on the exact garment + colour you picked — no fake-looking SVG, no guesswork — and emails it to you with the price.', fr: 'Remplissez vos détails plus bas. En moins d\'une heure, notre équipe rend un aperçu de qualité impression sur le vêtement et la couleur exacts que vous avez choisis — pas de SVG factice, aucune supposition — et vous l\'envoie avec le prix par courriel.' },
    'quote.reassure.step1': { en: 'You submit your design &amp; details', fr: 'Vous soumettez votre design et vos détails' },
    'quote.reassure.step2': { en: 'We render the mockup &amp; price the order', fr: 'On rend la maquette et on fixe le prix' },
    'quote.reassure.step3': { en: 'You approve — we print &amp; ship', fr: 'Vous approuvez — on imprime et expédie' },
    'quote.reassure.foot': { en: 'Usually back within the hour, 9am–9pm.', fr: 'Habituellement en moins d\'une heure, 9 h à 21 h.' },
    'quote.sidebar.shipping.h':    { en: 'Shipping', fr: 'Expédition' },
    'quote.sidebar.shipping.sub':  { en: 'Enter your postal/zip code for a live shipping quote.', fr: 'Entrez votre code postal pour une estimation en direct.' },
    'quote.sidebar.shipping.btn':  { en: 'Estimate', fr: 'Estimer' },
    'quote.sidebar.shipping.note': { en: 'Indicative rate via Chit Chats. Orders $500+ in Greater Montreal ship free. Final shipping confirmed on your formal quote.', fr: 'Tarif indicatif via Chit Chats. Commandes 500 $+ dans la région du Grand Montréal : livraison gratuite. Tarif final confirmé sur votre soumission.' },
    // Pickup / delivery pill toggle + pickup-mode body copy.
    'quote.sidebar.fulfill.pickup':   { en: 'In-store pickup', fr: 'Cueillette en magasin' },
    'quote.sidebar.fulfill.delivery': { en: 'Delivery',        fr: 'Livraison' },
    'quote.sidebar.pickup.free': { en: 'FREE \u2014 In-store pickup', fr: 'GRATUIT \u2014 Cueillette en magasin' },
    'quote.sidebar.pickup.note': { en: 'We\u2019ll text or email you when your order is ready for pickup.', fr: 'Nous vous écrirons ou vous appellerons quand votre commande sera prête.' },
    'quote.sidebar.next.h': { en: 'What happens next?', fr: 'Et la suite ?' },
    'quote.sidebar.next.p1': { en: 'We review your request and send a detailed quote — usually within an hour during business hours (9am–9pm).', fr: 'On examine votre demande et on envoie une soumission détaillée — habituellement en moins d\'une heure pendant les heures d\'ouverture (9 h à 21 h).' },
    'quote.sidebar.next.p2': { en: 'Once approved, we print a real sample before your full order.', fr: 'Une fois approuvée, on imprime un échantillon physique avant la commande complète.' },
    'quote.sidebar.talk.h': { en: 'Prefer to talk?', fr: 'Préférez-vous parler ?' },
    'quote.sidebar.talk.hours': { en: 'Open 7 days, 9AM – 9PM', fr: 'Ouvert 7 jours, 9 h à 21 h' },
    'quote.sidebar.promo.h': { en: '$20 off your first order of $100+', fr: '20 $ de rabais sur votre première commande de 100 $ et plus' },
    'quote.sidebar.promo.p': { en: 'Automatically applied to all new customers. No code needed.', fr: 'Appliqué automatiquement à tous les nouveaux clients. Aucun code requis.' },
    'quote.alert.product': { en: 'Please select a product from the catalog.', fr: 'Veuillez sélectionner un produit du catalogue.' },
    'quote.alert.method': { en: 'Please select a printing method.', fr: 'Veuillez sélectionner une méthode d\'impression.' },
    'quote.alert.upload.imageonly':   { en: 'Please upload an image file (PNG, JPG, SVG)', fr: 'Veuillez téléverser un fichier image (PNG, JPG, SVG).' },
    'quote.alert.upload.failed':      { en: 'Could not load your image. Try a different file.', fr: 'Impossible de charger votre image. Essayez un autre fichier.' },
    'quote.alert.submit.failed':      { en: 'Something went wrong. Please call us at 438-544-3800 or email sales@singhsprint.com.', fr: 'Une erreur est survenue. Appelez-nous au 438-544-3800 ou écrivez à sales@singhsprint.com.' },
    'quote.alert.submit.connection':  { en: 'Connection error. Please call us at 438-544-3800 or email sales@singhsprint.com.', fr: 'Erreur de connexion. Appelez-nous au 438-544-3800 ou écrivez à sales@singhsprint.com.' },
    'quote.summary.live': { en: 'Live Preview', fr: 'Aperçu en direct' },
    'quote.summary.product.label': { en: 'Product', fr: 'Produit' },
    'quote.summary.totalunits': { en: 'Total units', fr: 'Total d\'unités' },
    'quote.summary.pickstep1': { en: 'Pick in step 1', fr: 'Choisir à l\'étape 1' },
    'quote.summary.setstep2': { en: 'Set in step 2', fr: 'À l\'étape 2' },
    'quote.view.front': { en: 'Front', fr: 'Avant' },
    'quote.view.back': { en: 'Back', fr: 'Arrière' },
    'quote.foot.approx': { en: 'Approximate preview. Final placement confirmed during production.', fr: 'Aperçu approximatif. Emplacement final confirmé lors de la production.' },

    // ===== RFP =====
    'rfp.label': { en: 'For Procurement &amp; Operations Teams', fr: 'Pour les équipes d\'approvisionnement et d\'opérations' },
    'rfp.h1': { en: 'Request procurement pricing', fr: 'Demander des prix d\'approvisionnement' },
    'rfp.sub': { en: 'Tell us about the program. We\'ll come back with a quote, sample timeline, and term sheet — usually within an hour during business hours.', fr: 'Parlez-nous du programme. On revient avec une soumission, un échéancier d\'échantillon et une fiche de modalités — habituellement en moins d\'une heure pendant les heures d\'ouverture.' },
    'rfp.sect.company': { en: 'Company', fr: 'Entreprise' },
    'rfp.sect.order': { en: 'The order', fr: 'La commande' },
    'rfp.sect.terms': { en: 'Terms &amp; compliance', fr: 'Modalités et conformité' },
    'rfp.label.company': { en: 'Company / organization', fr: 'Entreprise / organisation' },
    'rfp.ph.company': { en: 'Acme Construction Ltd.', fr: 'Construction Acme Ltée' },
    'rfp.label.industry': { en: 'Industry', fr: 'Industrie' },
    'rfp.opt.industry0': { en: 'Select your sector', fr: 'Sélectionnez votre secteur' },
    'rfp.opt.industry1': { en: 'Construction &amp; Trades', fr: 'Construction et métiers' },
    'rfp.opt.industry2': { en: 'Restaurant &amp; Hospitality', fr: 'Restauration et hôtellerie' },
    'rfp.opt.industry3': { en: 'Corporate / Tech / Office', fr: 'Corporatif / techno / bureau' },
    'rfp.opt.industry4': { en: 'Charity / Non-profit / Event', fr: 'Charité / OBNL / événement' },
    'rfp.opt.industry5': { en: 'School / University / Sports League', fr: 'École / université / ligue sportive' },
    'rfp.opt.industry6': { en: 'Healthcare / Clinic', fr: 'Santé / clinique' },
    'rfp.opt.industry7': { en: 'Retail / E-commerce brand', fr: 'Détail / marque e-commerce' },
    'rfp.opt.industry8': { en: 'Government / Public sector', fr: 'Gouvernement / secteur public' },
    'rfp.opt.industry9': { en: 'Other', fr: 'Autre' },
    'rfp.label.name': { en: 'Your name', fr: 'Votre nom' },
    'rfp.label.role': { en: 'Your role', fr: 'Votre rôle' },
    'rfp.opt.role0': { en: 'Select your role', fr: 'Sélectionnez votre rôle' },
    'rfp.opt.role1': { en: 'HR / People Operations', fr: 'RH / opérations RH' },
    'rfp.opt.role2': { en: 'Procurement / Purchasing', fr: 'Approvisionnement / achats' },
    'rfp.opt.role3': { en: 'Operations / Ops Manager', fr: 'Opérations / gestionnaire' },
    'rfp.opt.role4': { en: 'Founder / Owner', fr: 'Fondateur / propriétaire' },
    'rfp.opt.role5': { en: 'Marketing / Brand', fr: 'Marketing / marque' },
    'rfp.opt.role6': { en: 'Event coordinator', fr: 'Coordonnateur d\'événement' },
    'rfp.opt.role7': { en: 'Office manager', fr: 'Gestionnaire de bureau' },
    'rfp.opt.role8': { en: 'Other', fr: 'Autre' },
    'rfp.label.email': { en: 'Work email', fr: 'Courriel professionnel' },
    'rfp.ph.email': { en: 'you@company.com', fr: 'vous@entreprise.com' },
    'rfp.label.phone': { en: 'Phone', fr: 'Téléphone' },
    'rfp.label.volume': { en: 'Annual unit volume', fr: 'Volume annuel d\'unités' },
    'rfp.vol.500': { en: 'Under 500 units', fr: 'Moins de 500 unités' },
    'rfp.vol.500-2000': { en: '500 – 2,000', fr: '500 à 2 000' },
    'rfp.vol.2000-10000': { en: '2,000 – 10,000', fr: '2 000 à 10 000' },
    'rfp.vol.10000+': { en: '10,000+', fr: '10 000+' },
    'rfp.label.cadence': { en: 'Order pattern', fr: 'Modèle de commande' },
    'rfp.cad.onetime': { en: 'One-time order', fr: 'Commande unique' },
    'rfp.cad.quarterly': { en: 'Quarterly refresh', fr: 'Renouvellement trimestriel' },
    'rfp.cad.annual': { en: 'Annual program', fr: 'Programme annuel' },
    'rfp.cad.ongoing': { en: 'Ongoing / reorder-driven', fr: 'Continu / réapprovisionnement' },
    'rfp.label.garments': { en: 'What are you ordering?', fr: 'Que commandez-vous ?' },
    'rfp.ph.garments': { en: 'E.g. 80 hi-vis t-shirts (cotton blend, embroidered logo left chest), 40 fleece hoodies for winter. Include any spec you have.', fr: 'Ex. 80 t-shirts hi-vis (coton mélangé, logo brodé poitrine gauche), 40 hoodies en molleton pour l\'hiver. Incluez toute spécification utile.' },
    'rfp.label.needed': { en: 'Needed by', fr: 'Requis pour le' },
    'rfp.hint.turnaround': { en: 'Standard turnaround is 7–14 business days from sample approval. Faster possible with rush surcharge.', fr: 'Délai standard de 7 à 14 jours ouvrables après l\'approbation de l\'échantillon. Plus rapide possible avec supplément urgent.' },
    'rfp.label.terms': { en: 'Preferred payment terms', fr: 'Modalités de paiement souhaitées' },
    'rfp.terms.prepaid': { en: 'Prepaid (2% discount)', fr: 'Prépayé (rabais de 2 %)' },
    'rfp.terms.deposit30': { en: '50% deposit + Net 30 balance', fr: 'Dépôt 50 % + solde Net 30' },
    'rfp.terms.net30': { en: 'Full Net 30', fr: 'Net 30 complet' },
    'rfp.terms.net60': { en: 'Net 60 / custom', fr: 'Net 60 / sur mesure' },
    'rfp.hint.terms': { en: '50% deposit + Net 30 is our standard for new accounts. Better terms available once we\'ve worked together.', fr: 'Dépôt 50 % + Net 30 est notre standard pour les nouveaux comptes. De meilleures modalités sont possibles après une première collaboration.' },
    'rfp.label.compliance': { en: 'Required compliance / certifications', fr: 'Conformité / certifications requises' },
    'rfp.comp.csa': { en: 'CSA-compliant hi-vis', fr: 'Hi-vis conforme CSA' },
    'rfp.comp.oeko': { en: 'OEKO-TEX certified', fr: 'Certifié OEKO-TEX' },
    'rfp.comp.union': { en: 'Montreal-based supplier', fr: 'Fournisseur montréalais' },
    'rfp.comp.gots': { en: 'Organic / GOTS', fr: 'Biologique / GOTS' },
    'rfp.comp.none': { en: 'None required', fr: 'Aucune requise' },
    'rfp.label.brandfile': { en: 'Brand guidelines / sample artwork (optional)', fr: 'Charte graphique / visuel d\'exemple (facultatif)' },
    'rfp.upload.text': { en: 'Attach brand guidelines, existing artwork, or a previous sample', fr: 'Joignez la charte graphique, un visuel existant ou un échantillon antérieur' },
    'rfp.upload.sub': { en: 'PDF, AI, PSD, PNG, JPG — up to 15 MB', fr: 'PDF, AI, PSD, PNG, JPG — jusqu\'à 15 Mo' },
    'rfp.label.extra': { en: 'Anything else we should know?', fr: 'Autre chose qu\'on devrait savoir ?' },
    'rfp.ph.extra': { en: 'Sizing data, attrition rate, existing supplier (and what\'s missing), specific compliance audit windows, etc.', fr: 'Données de taille, taux d\'attrition, fournisseur actuel (et ce qui manque), fenêtres d\'audit de conformité, etc.' },
    'rfp.compliance.line': { en: 'By submitting, you agree we may contact you with quote details. No spam, no list-sharing. We respond within an hour during business hours.', fr: 'En soumettant, vous acceptez qu\'on vous contacte avec les détails de la soumission. Aucun pourriel, aucun partage de liste. On répond en moins d\'une heure pendant les heures d\'ouverture.' },
    'rfp.submit': { en: 'Send RFP →', fr: 'Envoyer la demande →' },
    'rfp.success.h2': { en: 'RFP received', fr: 'Demande reçue' },
    'rfp.success.p': { en: 'We\'ll be in touch with quoted pricing, a sample timeline, and proposed payment terms — usually within the hour during business hours, otherwise first thing next business day.', fr: 'On vous reviendra avec les prix, un échéancier d\'échantillon et les modalités de paiement proposées — habituellement en moins d\'une heure pendant les heures d\'ouverture, sinon dès le prochain jour ouvrable.' },
    'rfp.rail.next.h': { en: 'What happens after you submit', fr: 'Et la suite après votre envoi' },
    'rfp.rail.next.li1': { en: 'We reply within the hour during business hours with quoted bulk pricing.', fr: 'On répond en moins d\'une heure pendant les heures d\'ouverture avec des prix de gros.' },
    'rfp.rail.next.li2': { en: 'We send a physical sample for approval before any production run.', fr: 'On envoie un échantillon physique pour approbation avant toute production.' },
    'rfp.rail.next.li3': { en: 'Approved samples kick off production. Standard turnaround is 7–14 business days.', fr: 'Les échantillons approuvés lancent la production. Délai standard de 7 à 14 jours ouvrables.' },
    'rfp.rail.next.li4': { en: 'Reorders for new hires or program refreshes go through your dedicated account manager.', fr: 'Les recommandes pour nouveaux employés ou renouvellements passent par votre gestionnaire de compte attitré.' },
    'rfp.rail.terms.h': { en: 'Standard terms', fr: 'Modalités standards' },
    'rfp.rail.terms.li1': { en: '50% deposit to start production, balance Net 30 from invoice date.', fr: 'Dépôt 50 % pour démarrer la production, solde Net 30 à partir de la date de facture.' },
    'rfp.rail.terms.li2': { en: 'Custom terms available for repeat accounts and standing programs.', fr: 'Modalités sur mesure pour les comptes habituels et les programmes permanents.' },
    'rfp.rail.terms.li3': { en: 'Free quote — no obligation, no commitment until you approve the sample.', fr: 'Soumission gratuite — sans obligation, aucun engagement avant l\'approbation de l\'échantillon.' },
    'rfp.rail.terms.li4': { en: '5.0 stars on Google from 25 verified Montreal clients.', fr: '5,0 étoiles sur Google par 25 clients montréalais vérifiés.' },
    'rfp.rail.quote.body': { en: 'Perfect quality and excellent service. Definitely worth checking out!', fr: 'Qualité parfaite et excellent service. Vaut vraiment la peine d\'essayer !' },
    'rfp.rail.quote.attr': { en: '— Bavneet Kaur, verified Google review (5.0 / 25 on Google)', fr: '— Bavneet Kaur, avis Google vérifié (5,0 / 25 sur Google)' },

    // ===== INDUSTRIES =====
    // Construction
    'ind.construction.label': { en: 'For Construction &amp; Trades', fr: 'Pour la construction et les métiers' },
    'ind.construction.h1': { en: 'Branded workwear for Montreal construction crews', fr: 'Vêtements de travail marqués pour les équipes de construction à Montréal' },
    'ind.construction.sub': { en: 'Hi-vis tees and hoodies, embroidered crew uniforms, branded coveralls. Built to survive the job site, the wash cycle, and the next hire. Volume pricing from 5 units, sample-first production, dedicated account manager.', fr: 'T-shirts et hoodies hi-vis, uniformes brodés, salopettes marquées. Conçus pour survivre au chantier, au lavage et au prochain embauché. Prix de volume à partir de 5 unités, production avec échantillon, gestionnaire de compte attitré.' },
    'ind.construction.cta1': { en: 'Request crew pricing', fr: 'Demander des prix d\'équipe' },
    'ind.construction.h2.challenges': { en: 'The three things that actually matter', fr: 'Les trois choses qui comptent vraiment' },
    'ind.construction.h2.products': { en: 'Workwear we print for Montreal contractors', fr: 'Vêtements de travail qu\'on imprime pour les entrepreneurs montréalais' },
    'ind.construction.h2.pricing': { en: 'What a 50-person crew uniform actually costs', fr: 'Ce que coûte vraiment l\'uniforme d\'une équipe de 50 personnes' },
    'ind.construction.h2.bulk': { en: 'Hi-vis T-Shirt — per unit by quantity', fr: 'T-shirt hi-vis — prix unitaire selon la quantité' },
    'ind.construction.h2.process': { en: 'From RFP to delivered crew uniforms', fr: 'De la demande aux uniformes livrés' },
    'ind.construction.h2.faq': { en: 'Questions construction procurement leads ask us', fr: 'Questions des responsables d\'approvisionnement en construction' },
    'ind.construction.cta.h2': { en: 'Ready to outfit the crew?', fr: 'Prêt à habiller votre équipe ?' },
    'ind.construction.cta.sub': { en: 'Submit a 2-minute RFP. We\'ll quote your crew within the hour during business hours.', fr: 'Soumettez une demande de 2 minutes. On vous fait une soumission en moins d\'une heure pendant les heures d\'ouverture.' },

    // Restaurant / Hospitality
    'ind.hospitality.label': { en: 'For Restaurants &amp; Hospitality', fr: 'Pour la restauration et l\'hôtellerie' },
    'ind.hospitality.h1': { en: 'Staff uniforms for Montreal restaurants &amp; hospitality groups', fr: 'Uniformes pour les restaurants et groupes hôteliers de Montréal' },
    'ind.hospitality.sub': { en: 'Embroidered aprons, branded polos, chef coats, and front-of-house tees. Built for high-turnover staffing, fast reorders for new hires, and embroidery that survives the dish pit.', fr: 'Tabliers brodés, polos marqués, vestes de chef et t-shirts pour la salle. Conçus pour le roulement de personnel, les recommandes rapides et une broderie qui survit à la plonge.' },
    'ind.hospitality.cta1': { en: 'Request staff uniform pricing', fr: 'Demander des prix d\'uniforme' },
    'ind.hospitality.h2.challenges': { en: 'Restaurant ops problems we solve', fr: 'Problèmes d\'opérations qu\'on règle' },
    'ind.hospitality.h2.products': { en: 'Staff apparel we print for Montreal restaurants', fr: 'Vêtements d\'équipe qu\'on imprime pour les restaurants montréalais' },
    'ind.hospitality.h2.pricing': { en: 'What a 25-person team uniform actually costs', fr: 'Ce que coûte vraiment un uniforme pour une équipe de 25 personnes' },
    'ind.hospitality.h2.process': { en: 'From RFP to staff in uniform', fr: 'De la demande à l\'équipe en uniforme' },
    'ind.hospitality.h2.faq': { en: 'Questions restaurant operators ask us', fr: 'Questions des exploitants de restaurants' },
    'ind.hospitality.cta.h2': { en: 'Ready to outfit the team?', fr: 'Prêt à habiller l\'équipe ?' },
    'ind.hospitality.cta.sub': { en: 'Submit a 2-minute RFP. We\'ll quote within the hour during business hours.', fr: 'Soumettez une demande de 2 minutes. On vous fait une soumission en moins d\'une heure pendant les heures d\'ouverture.' },

    // Corporate / Tech
    'ind.corporate.label': { en: 'For Corporate &amp; Tech Teams', fr: 'Pour les équipes corporatives et techno' },
    'ind.corporate.h1': { en: 'Branded apparel for Montreal startups, agencies &amp; corporate offices', fr: 'Vêtements de marque pour startups, agences et bureaux corporatifs de Montréal' },
    'ind.corporate.sub': { en: 'Onboarding hoodie kits, branded tees for the team, embroidered polos for client-facing roles, conference swag that doesn\'t land in the hotel trash. Volume pricing, account manager, Net 30 on standing programs.', fr: 'Kits hoodies d\'accueil, t-shirts de marque pour l\'équipe, polos brodés pour les rôles client, swag de conférence qui ne finit pas à la poubelle de l\'hôtel. Prix de volume, gestionnaire de compte, Net 30 sur les programmes permanents.' },
    'ind.corporate.cta1': { en: 'Request team swag pricing', fr: 'Demander des prix de swag d\'équipe' },
    'ind.corporate.h2.challenges': { en: 'Three real problems with company swag', fr: 'Trois vrais problèmes avec le swag d\'entreprise' },
    'ind.corporate.h2.products': { en: 'Tech &amp; corporate apparel we print', fr: 'Vêtements techno et corporatifs qu\'on imprime' },
    'ind.corporate.h2.pricing': { en: 'What a 40-person team swag drop costs', fr: 'Ce que coûte un drop de swag pour 40 personnes' },
    'ind.corporate.h2.process': { en: 'From RFP to team in branded gear', fr: 'De la demande à l\'équipe en tenue de marque' },
    'ind.corporate.h2.faq': { en: 'Questions HR &amp; office managers ask us', fr: 'Questions des RH et gestionnaires de bureau' },
    'ind.corporate.cta.h2': { en: 'Ready to swag the team?', fr: 'Prêt à équiper l\'équipe ?' },
    'ind.corporate.cta.sub': { en: 'Submit a 2-minute RFP. We\'ll quote within the hour during business hours.', fr: 'Soumettez une demande de 2 minutes. On vous fait une soumission en moins d\'une heure pendant les heures d\'ouverture.' },

    // Charity
    'ind.charity.label': { en: 'For Charity Runs, Events &amp; Fundraisers', fr: 'Pour les courses caritatives, événements et collectes de fonds' },
    'ind.charity.h1': { en: 'Custom apparel for charity runs, fundraisers &amp; community events', fr: 'Vêtements personnalisés pour courses caritatives, collectes et événements communautaires' },
    'ind.charity.sub': { en: 'Race shirts, volunteer apparel, multi-sponsor logo placement, event merch you can sell on the day. Scalable from a 50-person fundraiser to a 5,000-runner charity race. 2-week turnaround with the right lead time.', fr: 'T-shirts de course, vêtements de bénévoles, placement de logos multi-commanditaires, marchandise vendable le jour J. De la collecte de 50 personnes à la course caritative de 5 000 coureurs. Délai de 2 semaines avec le bon préavis.' },
    'ind.charity.cta1': { en: 'Request event pricing', fr: 'Demander des prix d\'événement' },
    'ind.charity.h2.challenges': { en: 'Three things that go wrong at event-shirt distribution', fr: 'Trois choses qui dérapent à la distribution des t-shirts d\'événement' },
    'ind.charity.h2.products': { en: 'Event apparel we print for Montreal organizers', fr: 'Vêtements d\'événement qu\'on imprime pour les organisateurs montréalais' },
    'ind.charity.h2.pricing': { en: 'What a 200-runner race shirt order costs', fr: 'Ce que coûte une commande de t-shirts pour 200 coureurs' },
    'ind.charity.h2.timeline': { en: 'The 6-week ideal timeline', fr: 'L\'échéancier idéal de 6 semaines' },
    'ind.charity.h2.faq': { en: 'Questions event coordinators ask us', fr: 'Questions des coordonnateurs d\'événement' },
    'ind.charity.cta.h2': { en: 'Ready to outfit the event?', fr: 'Prêt à habiller l\'événement ?' },
    'ind.charity.cta.sub': { en: 'Submit a 2-minute RFP. We\'ll quote within the hour during business hours.', fr: 'Soumettez une demande de 2 minutes. On vous fait une soumission en moins d\'une heure pendant les heures d\'ouverture.' },

    // Schools / Sports
    'ind.schools.label': { en: 'For Schools, Universities &amp; Sports Leagues', fr: 'Pour les écoles, universités et ligues sportives' },
    'ind.schools.h1': { en: 'School &amp; team apparel for Montreal academic and athletic programs', fr: 'Vêtements d\'école et d\'équipe pour les programmes académiques et sportifs de Montréal' },
    'ind.schools.sub': { en: 'Embroidered crest hoodies, custom team jerseys, graduation merch, parent-association store apparel. Built for annual reorder cycles, recurring grad-class orders, and league-wide jersey programs.', fr: 'Hoodies à écusson brodé, chandails d\'équipe personnalisés, merch de graduation, vêtements pour les boutiques d\'associations de parents. Pensés pour les cycles de recommande annuels et les programmes de chandails à l\'échelle d\'une ligue.' },
    'ind.schools.cta1': { en: 'Request school pricing', fr: 'Demander des prix scolaires' },
    'ind.schools.h2.challenges': { en: 'Three things that make school apparel orders messy', fr: 'Trois choses qui compliquent les commandes pour écoles' },
    'ind.schools.h2.products': { en: 'School &amp; team apparel we print', fr: 'Vêtements scolaires et d\'équipe qu\'on imprime' },
    'ind.schools.h2.pricing': { en: 'What a 60-person grad class hoodie order costs', fr: 'Ce que coûte une commande de hoodies pour 60 finissants' },
    'ind.schools.h2.process': { en: 'From order list to delivered apparel', fr: 'De la liste de commande aux vêtements livrés' },
    'ind.schools.h2.faq': { en: 'Questions schools and league organizers ask us', fr: 'Questions des écoles et organisateurs de ligues' },
    'ind.schools.cta.h2': { en: 'Ready to outfit the program?', fr: 'Prêt à habiller votre programme ?' },
    'ind.schools.cta.sub': { en: 'Submit a 2-minute RFP. We\'ll quote within the hour during business hours.', fr: 'Soumettez une demande de 2 minutes. On vous fait une soumission en moins d\'une heure pendant les heures d\'ouverture.' },

    // ===== GUIDES =====
    // Charity run timeline
    'guide.charity.label': { en: 'Guide · Event apparel', fr: 'Guide · Vêtements d\'événement' },
    'guide.charity.h1': { en: 'Charity run t-shirt timeline: from sponsor approval to event day', fr: 'Échéancier pour t-shirt de course caritative : de l\'approbation des commanditaires au jour J' },
    'guide.charity.lede': { en: 'Six weeks is the ideal lead time for a charity run shirt order. Here\'s what to do in each of them so race-day distribution doesn\'t fall apart at the volunteer table.', fr: 'Six semaines est le délai idéal pour une commande de t-shirts de course caritative. Voici ce qu\'il faut faire chaque semaine pour que la distribution le jour J ne s\'effondre pas à la table des bénévoles.' },
    'guide.charity.h2.timeline': { en: 'The six-week ideal timeline', fr: 'L\'échéancier idéal de six semaines' },
    'guide.charity.h2.compressed': { en: 'What goes wrong when you compress to 2 weeks', fr: 'Ce qui dérape quand on comprime à 2 semaines' },
    'guide.charity.h2.related': { en: 'Related guides &amp; industry programs', fr: 'Guides et programmes connexes' },
    'guide.charity.cta.h3': { en: 'Planning a charity run or community event?', fr: 'Vous planifiez une course caritative ou un événement communautaire ?' },
    'guide.charity.cta.btn': { en: 'Request event quote →', fr: 'Demander une soumission d\'événement →' },

    // Construction crew cost
    'guide.crew.label': { en: 'Guide · Cost analysis', fr: 'Guide · Analyse des coûts' },
    'guide.crew.h1': { en: 'What does it actually cost to outfit a 50-person construction crew?', fr: 'Combien coûte vraiment équiper une équipe de construction de 50 personnes ?' },
    'guide.crew.lede': { en: 'Most "uniform cost" articles quote the unit price and stop. The real number includes sizing-day labor, sample approvals, reorder budget, and year-2 attrition. Here\'s the actual math.', fr: 'La plupart des articles sur le coût d\'uniforme donnent juste le prix unitaire. Le vrai chiffre inclut la journée de prise des tailles, les approbations d\'échantillon, le budget de recommande et l\'attrition de l\'an 2. Voici le calcul réel.' },
    'guide.crew.h2.scenario': { en: 'The scenario', fr: 'Le scénario' },
    'guide.crew.h2.initial': { en: 'Initial outfit cost — the unit-price math', fr: 'Coût initial — le calcul au prix unitaire' },
    'guide.crew.h2.hidden': { en: 'The four hidden costs nobody quotes', fr: 'Les quatre coûts cachés que personne ne mentionne' },
    'guide.crew.h2.year1': { en: 'The full year-1 cost', fr: 'Le coût complet de l\'an 1' },
    'guide.crew.h2.year2': { en: 'Year-2 onward — the steady-state cost', fr: 'À partir de l\'an 2 — le coût en régime permanent' },
    'guide.crew.h2.savings': { en: 'Where the savings come from', fr: 'D\'où viennent les économies' },
    'guide.crew.h2.formula': { en: 'Recommended budget formula', fr: 'Formule budgétaire recommandée' },
    'guide.crew.h2.related': { en: 'Related guides &amp; industry programs', fr: 'Guides et programmes connexes' },
    'guide.crew.cta.h3': { en: 'Quote your crew, not someone else\'s', fr: 'Faites évaluer votre équipe, pas celle d\'un autre' },
    'guide.crew.cta.btn': { en: 'Quote my crew →', fr: 'Évaluer mon équipe →' },

    // Decoration durability
    'guide.deco.label': { en: 'Guide · Decoration methods', fr: 'Guide · Méthodes de décoration' },
    'guide.deco.h1': { en: 'Screen print vs DTG vs embroidery: which lasts longest on staff uniforms?', fr: 'Sérigraphie vs DTG vs broderie : laquelle dure le plus longtemps sur les uniformes ?' },
    'guide.deco.lede': { en: 'A side-by-side durability comparison written for the HR lead or operations manager about to order 50+ uniforms and trying to figure out which decoration method to specify.', fr: 'Une comparaison de durabilité côte à côte, écrite pour le RH ou le gestionnaire des opérations qui s\'apprête à commander 50 uniformes ou plus et veut savoir quelle méthode spécifier.' },
    'guide.deco.h2.methods': { en: 'The four methods, briefly', fr: 'Les quatre méthodes, brièvement' },
    'guide.deco.h2.compare': { en: 'Side-by-side comparison', fr: 'Comparaison côte à côte' },
    'guide.deco.h2.tree': { en: 'Decision tree by use case', fr: 'Arbre de décision par cas d\'usage' },
    'guide.deco.h2.ignore': { en: 'What we tell HR managers to ignore', fr: 'Ce qu\'on dit aux RH d\'ignorer' },
    'guide.deco.h2.choose': { en: 'How we recommend you choose', fr: 'Comment on vous recommande de choisir' },
    'guide.deco.h2.related': { en: 'Related industry programs', fr: 'Programmes connexes' },
    'guide.deco.cta.h3': { en: 'Need help speccing the decoration on your uniform order?', fr: 'Besoin d\'aide pour spécifier la décoration sur votre commande ?' },
    'guide.deco.cta.btn': { en: 'Request RFP →', fr: 'Faire une demande →' },

    // Procurement checklist
    'guide.proc.label': { en: 'Guide · Procurement', fr: 'Guide · Approvisionnement' },
    'guide.proc.h1': { en: 'How to spec a uniform program for 50–500 employees: a procurement checklist', fr: 'Comment spécifier un programme d\'uniforme pour 50 à 500 employés : une liste d\'approvisionnement' },
    'guide.proc.lede': { en: 'A six-step procurement framework for HR and operations leads building a uniform program from scratch. Avoids the three things that make uniform programs fail.', fr: 'Un cadre d\'approvisionnement en six étapes pour les responsables RH et opérations qui bâtissent un programme d\'uniforme. Évite les trois choses qui font échouer un programme.' },
    'guide.proc.h2.step1': { en: 'Step 1 — Define the wear policy', fr: 'Étape 1 — Définir la politique de port' },
    'guide.proc.h2.step2': { en: 'Step 2 — Pick the base garments', fr: 'Étape 2 — Choisir les vêtements de base' },
    'guide.proc.h2.step3': { en: 'Step 3 — Standardize decoration method and placement', fr: 'Étape 3 — Standardiser la méthode et l\'emplacement de la décoration' },
    'guide.proc.h2.step4': { en: 'Step 4 — Capture sizes once, then maintain', fr: 'Étape 4 — Prendre les tailles une fois, puis maintenir' },
    'guide.proc.h2.step5': { en: 'Step 5 — Design the reorder workflow', fr: 'Étape 5 — Concevoir le flux de recommande' },
    'guide.proc.h2.step6': { en: 'Step 6 — Evaluate suppliers on the right criteria', fr: 'Étape 6 — Évaluer les fournisseurs sur les bons critères' },
    'guide.proc.h2.rfp': { en: 'What an actual RFP looks like', fr: 'À quoi ressemble une vraie demande de prix' },
    'guide.proc.h2.related': { en: 'Related industry programs', fr: 'Programmes connexes' },
    'guide.proc.cta.h3': { en: 'Build the program with us', fr: 'Bâtissons le programme ensemble' },
    'guide.proc.cta.btn': { en: 'Start your RFP →', fr: 'Démarrer votre demande →' },

    // ===== ACCOUNT =====
    'account.back.home':       { en: '← Back to homepage',  fr: '← Retour à l\'accueil' },
    'account.back.account':    { en: '← Back to account',   fr: '← Retour au compte' },
    'account.signout':         { en: 'Sign out',            fr: 'Déconnexion' },
    'account.business.badge':  { en: 'Business',            fr: 'Entreprise' },

    // Sign in
    'account.signin.h1':       { en: 'Sign in', fr: 'Connexion' },
    'account.signin.sub':      { en: 'We\'ll send you a 6-digit code — no password needed.', fr: 'Nous vous enverrons un code à 6 chiffres — aucun mot de passe requis.' },
    'account.signin.tab.email':{ en: 'Email', fr: 'Courriel' },
    'account.signin.tab.phone':{ en: 'Phone', fr: 'Téléphone' },
    'account.signin.label.email':{ en: 'Email address', fr: 'Adresse courriel' },
    'account.signin.label.phone':{ en: 'Phone number',  fr: 'Numéro de téléphone' },
    'account.signin.send':     { en: 'Send code',       fr: 'Envoyer le code' },
    'account.signin.code':     { en: 'Enter the 6-digit code', fr: 'Entrez le code à 6 chiffres' },
    'account.signin.verify':   { en: 'Verify and sign in', fr: 'Vérifier et se connecter' },
    'account.signin.resend':   { en: 'Resend code', fr: 'Renvoyer le code' },
    'account.signin.different':{ en: '← Use a different address', fr: '← Utiliser une autre adresse' },
    'account.signin.help':     { en: 'Saving a card later? You\'ll be asked to set a payment password so only you can use it at checkout.', fr: 'Vous voulez enregistrer une carte plus tard ? Nous vous demanderons un mot de passe de paiement pour qu\'elle ne soit utilisable que par vous au moment du paiement.' },

    // Dashboard
    'account.dash.h1':            { en: 'My account', fr: 'Mon compte' },
    'account.dash.stat.active':   { en: 'Active quotes', fr: 'Demandes en cours' },
    'account.dash.stat.active.sub':{ en: 'In review or being contacted', fr: 'En révision ou en contact' },
    'account.dash.stat.past':     { en: 'Past orders', fr: 'Commandes passées' },
    'account.dash.stat.past.sub': { en: 'Reorder with one click', fr: 'Recommandez en un clic' },
    'account.dash.stat.credit':   { en: 'Credit balance', fr: 'Solde de crédit' },
    'account.dash.stat.credit.sub':{ en: 'From referrals and rewards', fr: 'Provenant des parrainages et récompenses' },
    'account.dash.stat.ref':      { en: 'Referrals', fr: 'Parrainages' },
    'account.dash.stat.ref.sub':  { en: 'People who signed up with your code', fr: 'Personnes inscrites avec votre code' },
    'account.dash.card.orders':   { en: 'Quotes &amp; orders', fr: 'Demandes et commandes' },
    'account.dash.card.orders.sub':{ en: 'See pending quote requests, track current orders, and reorder anything you\'ve printed with us before.', fr: 'Consultez vos demandes en attente, suivez vos commandes actuelles et recommandez ce que vous avez déjà imprimé avec nous.' },
    'account.dash.card.ref':      { en: 'Referrals &amp; credit', fr: 'Parrainages et crédit' },
    'account.dash.card.ref.sub':  { en: 'Share your code, earn $25 for every friend whose order ships, and apply credits at checkout.', fr: 'Partagez votre code, gagnez 25 $ pour chaque ami dont la commande est expédiée, et appliquez vos crédits au paiement.' },
    'account.dash.card.biz':      { en: 'Business account', fr: 'Compte entreprise' },
    'account.dash.card.biz.sub':  { en: 'Submitted an RFP? Request business pricing, net-30 terms, multi-user teams, and the artwork library.', fr: 'Vous avez soumis un appel d\'offres ? Demandez les tarifs entreprise, les conditions net 30, les comptes d\'équipe et la bibliothèque graphique.' },
    'account.dash.card.programs': { en: 'Programs', fr: 'Programmes' },
    'account.dash.card.programs.sub':{ en: 'Institutional ordering with cohorts, gated catalogs, and spending allowances.', fr: 'Achats institutionnels avec cohortes, catalogue restreint et plafonds de dépenses.' },
    'account.dash.card.settings': { en: 'Settings', fr: 'Paramètres' },
    'account.dash.card.settings.sub':{ en: 'Profile info, payment password, saved cards, and sign out.', fr: 'Profil, mot de passe de paiement, cartes enregistrées et déconnexion.' },
    'account.cta.view':        { en: 'View →',   fr: 'Voir →' },
    'account.cta.share':       { en: 'Share →',  fr: 'Partager →' },
    'account.cta.open':        { en: 'Open →',   fr: 'Ouvrir →' },
    'account.cta.manage':      { en: 'Manage →', fr: 'Gérer →' },
    'account.cta.apply':       { en: 'Apply →',  fr: 'Demander →' },

    // Orders
    'account.orders.h1':       { en: 'Quotes &amp; orders', fr: 'Demandes et commandes' },
    'account.orders.sub':      { en: 'Track active requests and reorder past prints.', fr: 'Suivez vos demandes en cours et recommandez vos impressions précédentes.' },
    'account.orders.active':   { en: 'Active', fr: 'En cours' },
    'account.orders.past':     { en: 'Past orders', fr: 'Commandes passées' },
    'account.orders.empty.active':{ en: 'No active quotes. <a href="/quote">Start a new one →</a>', fr: 'Aucune demande en cours. <a href="/quote">Démarrer une nouvelle →</a>' },
    'account.orders.empty.past':{ en: 'No past orders yet — they\'ll show up here after your first one ships.', fr: 'Aucune commande passée — elles apparaîtront ici après l\'expédition de votre première.' },
    'account.orders.btn.track':{ en: 'Track',   fr: 'Suivre' },
    'account.orders.btn.reorder':{ en: 'Reorder', fr: 'Recommander' },

    // Referrals
    'account.ref.h1':          { en: 'Referrals &amp; credit', fr: 'Parrainages et crédit' },
    'account.ref.sub':         { en: 'Share your code, earn credit when friends order.', fr: 'Partagez votre code, gagnez du crédit quand vos amis commandent.' },
    'account.ref.code.h2':     { en: 'Your referral code', fr: 'Votre code de parrainage' },
    'account.ref.copy.code':   { en: 'Copy code', fr: 'Copier le code' },
    'account.ref.copy.link':   { en: 'Copy link', fr: 'Copier le lien' },
    'account.ref.stat.signups':{ en: 'Signed up', fr: 'Inscriptions' },
    'account.ref.stat.qual':   { en: 'Qualifying orders', fr: 'Commandes admissibles' },
    'account.ref.stat.paid':   { en: 'Paid out', fr: 'Versés' },
    'account.ref.bal.h2':      { en: 'Credit balance', fr: 'Solde de crédit' },
    'account.ref.bal.applies': { en: 'applies at checkout', fr: 'appliqué au paiement' },
    'account.ref.redeem.h2':   { en: 'Have a referral code?', fr: 'Vous avez un code de parrainage ?' },
    'account.ref.redeem.btn':  { en: 'Apply', fr: 'Appliquer' },
    'account.ref.redeem.ph':   { en: 'ENTER CODE', fr: 'ENTREZ LE CODE' },

    // Business
    'account.biz.h1':          { en: 'Business account', fr: 'Compte entreprise' },
    'account.biz.sub':         { en: 'Net-30 invoicing, multi-user teams, an artwork library, and volume pricing for repeat buyers.', fr: 'Facturation net 30, comptes d\'équipe, bibliothèque graphique et tarifs de volume pour les acheteurs réguliers.' },
    'account.biz.request.h2':  { en: 'Request business status', fr: 'Demander le statut entreprise' },
    'account.biz.team.h2':     { en: 'Team',     fr: 'Équipe' },
    'account.biz.artwork.h2':  { en: 'Artwork library', fr: 'Bibliothèque graphique' },
    'account.biz.invoices.h2': { en: 'Invoices', fr: 'Factures' },
    'account.biz.terms.h2':    { en: 'Payment terms &amp; pricing', fr: 'Conditions de paiement et tarifs' },
    'account.biz.invite.btn':  { en: 'Send invite', fr: 'Envoyer l\'invitation' },
    'account.biz.invite.ph':   { en: 'teammate@acme.com', fr: 'collègue@acme.com' },
    'account.biz.upload.btn':  { en: 'Upload', fr: 'Téléverser' },

    // Programs
    'account.prog.h1':         { en: 'Programs', fr: 'Programmes' },
    'account.prog.sub':        { en: 'Institutional ordering — cohorts, catalog whitelists, spending allowances, reporting.', fr: 'Achats institutionnels — cohortes, listes de catalogues, plafonds de dépenses, rapports.' },
    'account.prog.your':       { en: 'Your program', fr: 'Votre programme' },
    'account.prog.shop':       { en: 'Shop your catalog →', fr: 'Voir votre catalogue →' },
    'account.prog.allowance':  { en: 'Allowance', fr: 'Plafond' },
    'account.prog.spent':      { en: 'Spent', fr: 'Dépensé' },
    'account.prog.remaining':  { en: 'Remaining', fr: 'Restant' },
    'account.prog.new.btn':    { en: '+ New program', fr: '+ Nouveau programme' },
    'account.prog.export.csv': { en: 'Export CSV', fr: 'Exporter CSV' },
    'account.prog.banner.full':{ en: 'View full catalog →', fr: 'Voir le catalogue complet →' },

    // ===== QUOTE PAGE — ACCOUNT INTEGRATION =====
    'quote.account.signedin':  { en: 'Signed in as', fr: 'Connecté en tant que' },
    'quote.account.changeacct':{ en: 'Use a different account', fr: 'Utiliser un autre compte' },
    // 2026-05-24 — Shortened from a 157-char paragraph per operator
    // feedback on mobile rendering. Full pitch now lives in the
    // post-submit confirmation panel + the OTP email so the form stays
    // scannable on iPhone.
    'quote.account.signup':    {
      en: '<strong>Create an account</strong> to track this quote and reorder later — we\'ll email you a sign-in link.',
      fr: '<strong>Créer un compte</strong> pour suivre cette soumission et recommander plus tard — nous vous enverrons un lien de connexion par courriel.'
    }
  };

  function t(key) {
    var entry = translations[key];
    if (!entry) return '';
    return entry[currentLang] || entry['en'] || '';
  }

  function applyLang() {
    // Swap all data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      var val = t(key);
      if (val) el.innerHTML = val;
    });
    // Swap all placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-placeholder');
      var val = t(key);
      if (val) el.placeholder = val;
    });
    // Update lang attribute
    document.documentElement.lang = currentLang;
    // Update toggle button text
    var btn = document.getElementById('langToggle');
    if (btn) btn.textContent = currentLang === 'en' ? 'FR' : 'EN';
    // Notify listeners (catalog AI-translate overlay, etc.) so they can
    // translate dynamic/supplier-fed content that lang.js can't reach.
    try {
      document.dispatchEvent(new CustomEvent('sp-lang-change', { detail: { lang: currentLang } }));
    } catch (e) {}
  }

  // Toggle the active language.
  //
  // Two flavours of localization in play across the site:
  //   1. Pages that translate in-place via `data-i18n` attributes (most
  //      single-file marketing pages, e.g. /index, /catalog).
  //   2. Pages that have a separate French HTML file at /fr/<path>
  //      (e.g. /quote ↔ /fr/quote, /about ↔ /fr/about,
  //      /youth-initiative ↔ /fr/youth-initiative).
  //
  // Flavour 2 doesn't use data-i18n attributes on its hardcoded copy, so
  // calling applyLang() in place does nothing visible. We detect those
  // pages by looking for a `<link rel="alternate" hreflang="<target>">`
  // tag in <head> and navigate there. Falls back to in-place swap when
  // no hreflang alternate is declared.
  function toggleLang() {
    var next = currentLang === 'en' ? 'fr' : 'en';
    // Look up the hreflang alternate for the target language. Pages
    // that ship a separate /fr/ HTML file declare these in <head>.
    var alt = document.querySelector('link[rel="alternate"][hreflang="' + next + '"]');
    if (alt) {
      var href = alt.getAttribute('href');
      if (href) {
        // Persist the preference BEFORE navigating so the destination
        // boots with the right currentLang and doesn't flicker EN-first
        // before reading localStorage.
        try { localStorage.setItem('sp-lang', next); } catch (e) {}
        window.location.href = href;
        return;
      }
    }
    // No mirror — fall back to in-place data-i18n swap.
    currentLang = next;
    try { localStorage.setItem('sp-lang', currentLang); } catch (e) {}
    applyLang();
  }

  function getLang() {
    return currentLang;
  }

  // Auto-apply when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    // Small delay to let components.js inject nav/footer first
    setTimeout(applyLang, 50);
  });

  return { t: t, applyLang: applyLang, toggleLang: toggleLang, getLang: getLang };
})();
