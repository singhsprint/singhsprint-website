// ==============================
// Singhs Print - Bilingual System
// ==============================
// Usage: Add data-i18n="key" to any element. Text will swap on toggle.
// For inputs: data-i18n-placeholder="key" swaps placeholder text.
// The toggle button is injected by components.js.

var SP_LANG = (function() {
  var currentLang = localStorage.getItem('sp-lang') || 'en';

  var translations = {
    // ===== NAV / PROMO =====
    'promo': {
      en: '15% OFF your first order. No code needed.',
      fr: '15% DE RABAIS sur votre premiere commande. Aucun code requis.'
    },
    'promo.link': { en: 'Get your quote', fr: 'Obtenir votre soumission' },
    'nav.products': { en: 'Products', fr: 'Produits' },
    'nav.services': { en: 'Services', fr: 'Services' },
    'nav.howitworks': { en: 'How It Works', fr: 'Comment ca marche' },
    'nav.portfolio': { en: 'Portfolio', fr: 'Portfolio' },
    'nav.inkwear': { en: 'Inkwear', fr: 'Inkwear' },
    'nav.businesses': { en: 'For Businesses', fr: 'Pour entreprises' },
    'nav.about': { en: 'About', fr: 'A propos' },
    'nav.login': { en: 'Login', fr: 'Connexion' },
    'nav.quote': { en: 'Get a Quote', fr: 'Soumission' },

    // ===== FOOTER =====
    'footer.brand': {
      en: "Custom apparel printing in Montreal's West Island. DTG, DTF & Embroidery for brands, creators, and businesses. Open 7 days, 9AM\u20139PM.",
      fr: "Impression de vetements personnalises dans l'Ouest-de-l'Ile de Montreal. DTG, DTF et broderie pour marques, createurs et entreprises. Ouvert 7 jours, 9h a 21h."
    },
    'footer.pages': { en: 'Pages', fr: 'Pages' },
    'footer.home': { en: 'Home', fr: 'Accueil' },
    'footer.getquote': { en: 'Get a Quote', fr: 'Soumission' },
    'footer.portfolio': { en: 'Portfolio', fr: 'Portfolio' },
    'footer.inkwear': { en: 'Inkwear', fr: 'Inkwear' },
    'footer.businesses': { en: 'For Businesses', fr: 'Pour entreprises' },
    'footer.about': { en: 'About', fr: 'A propos' },
    'footer.services': { en: 'Services', fr: 'Services' },
    'footer.dtg': { en: 'DTG Printing', fr: 'Impression DTG' },
    'footer.dtf': { en: 'DTF Transfers', fr: 'Transferts DTF' },
    'footer.embroidery': { en: 'Embroidery', fr: 'Broderie' },
    'footer.designstudio': { en: 'Design Studio', fr: 'Studio de design' },
    'footer.contact': { en: 'Contact', fr: 'Contact' },
    'footer.location': { en: 'West Island, Montreal', fr: 'Ouest-de-l\'Ile, Montreal' },
    'footer.rights': { en: '2026 Singhs Print. All rights reserved.', fr: '2026 Singhs Print. Tous droits reserves.' },
    'footer.tagline': { en: 'Custom Apparel Printing | Montreal, QC', fr: 'Impression de vetements personnalises | Montreal, QC' },

    // ===== INDEX / HOME =====
    'home.badge': { en: 'Open 7 days | West Island, Montreal', fr: 'Ouvert 7 jours | Ouest-de-l\'Ile, Montreal' },
    'home.hero.h1a': { en: "West Island's", fr: "L'Ouest-de-l'Ile," },
    'home.hero.h1b': { en: 'custom apparel printing studio.', fr: 'votre studio d\'impression personnalisee.' },
    'home.hero.sub': {
      en: 'DTG, DTF & Embroidery for brands, businesses, and creators. No minimums. 2-4 day turnaround. Everything printed in-house.',
      fr: 'DTG, DTF et broderie pour marques, entreprises et createurs. Aucun minimum. Delai de 2 a 4 jours. Tout imprime sur place.'
    },
    'home.hero.cta1': { en: 'Get a Free Quote', fr: 'Soumission gratuite' },
    'home.hero.cta2': { en: 'See Our Work', fr: 'Voir nos realisations' },
    'home.hero.guarantee': { en: 'Quality Guarantee: Love it or we reprint it.', fr: 'Garantie qualite : Satisfait ou on reimprime.' },
    'home.stats.orders': { en: 'Orders Completed', fr: 'Commandes completees' },
    'home.stats.turnaround': { en: 'Day Avg Turnaround', fr: 'Jours delai moyen' },
    'home.stats.rating': { en: 'Google Rating', fr: 'Note Google' },
    'home.trust': {
      en: 'Trusted by brands & businesses across the West Island & Montreal',
      fr: 'La confiance des marques et entreprises de l\'Ouest-de-l\'Ile et Montreal'
    },
    'home.products.label': { en: 'Products', fr: 'Produits' },
    'home.products.h2': { en: 'What we print on', fr: 'Sur quoi on imprime' },
    'home.products.sub': {
      en: 'Premium blanks, printed or embroidered exactly how you want them.',
      fr: 'Des vetements de qualite, imprimes ou brodes exactement comme vous le souhaitez.'
    },
    'home.services.label': { en: 'Services', fr: 'Services' },
    'home.services.h2': { en: 'Three methods, one studio', fr: 'Trois methodes, un studio' },
    'home.services.sub': {
      en: 'Every method in-house means we pick the right one for your project.',
      fr: 'Toutes les methodes sur place, on choisit la meilleure pour votre projet.'
    },
    'home.hiw.label': { en: 'How It Works', fr: 'Comment ca marche' },
    'home.hiw.h2': { en: 'From idea to finished product', fr: 'De l\'idee au produit fini' },
    'home.hiw.step1.h': { en: 'Tell us what you need', fr: 'Dites-nous ce qu\'il vous faut' },
    'home.hiw.step1.p': {
      en: 'Fill out a quick form or send us a message. Include your design, garment preferences, and quantity.',
      fr: 'Remplissez un formulaire rapide ou envoyez-nous un message. Incluez votre design, vos preferences et la quantite.'
    },
    'home.hiw.step2.h': { en: 'We prep & sample', fr: 'On prepare et echantillonne' },
    'home.hiw.step2.p': {
      en: 'Our design studio preps your artwork for print. You approve a physical sample before we produce the full order.',
      fr: 'Notre studio prepare votre visuel pour l\'impression. Vous approuvez un echantillon physique avant la production.'
    },
    'home.hiw.step3.h': { en: 'Pick up or get it delivered', fr: 'Ramassage ou livraison' },
    'home.hiw.step3.p': {
      en: 'Most orders ready in 2-4 business days. Local pickup in the West Island or delivery across Montreal.',
      fr: 'La plupart des commandes pretes en 2 a 4 jours ouvrables. Ramassage local dans l\'Ouest-de-l\'Ile ou livraison a Montreal.'
    },
    'home.cta.h2': { en: 'Ready to get started?', fr: 'Pret a commencer?' },
    'home.cta.p': {
      en: 'Get a quote in hours, not days. First order is 15% off.',
      fr: 'Obtenez une soumission en heures, pas en jours. 15% de rabais sur la premiere commande.'
    },
    'home.cta.btn': { en: 'Get a Free Quote', fr: 'Soumission gratuite' },

    // ===== ABOUT =====
    'about.hero.h1': { en: 'Your local print shop,<br>built for real deadlines.', fr: 'Votre imprimerie locale,<br>faite pour les vrais delais.' },
    'about.hero.p': {
      en: 'Singhs Print is a Montreal-based custom apparel studio specializing in DTG, DTF, and embroidery. We help brands, businesses, creators, and teams bring their ideas to life with honest pricing, fast turnaround, and quality you can see and feel.',
      fr: 'Singhs Print est un studio d\'impression de vetements personnalises a Montreal, specialise en DTG, DTF et broderie. Nous aidons les marques, entreprises, createurs et equipes a realiser leurs idees avec des prix honnetes, un delai rapide et une qualite visible.'
    },
    'about.who.label': { en: 'Who we are', fr: 'Qui sommes-nous' },
    'about.who.h2': { en: 'A studio that actually cares about your order', fr: 'Un studio qui se soucie vraiment de votre commande' },
    'about.who.p1': {
      en: 'We started Singhs Print because we were tired of seeing custom apparel done poorly: slow turnarounds, inconsistent quality, and shops that treat small orders like an inconvenience.',
      fr: 'Nous avons lance Singhs Print parce qu\'on en avait assez de voir l\'impression personnalisee mal faite : delais lents, qualite inconsistante et ateliers qui traitent les petites commandes comme un derangement.'
    },
    'about.who.p2': {
      en: 'Every order that comes through our door gets the same attention, whether it\'s 5 tees for a birthday or 500 hoodies for a brand launch. We print everything in-house in Montreal, which means we control the quality from start to finish.',
      fr: 'Chaque commande recoit la meme attention, que ce soit 5 t-shirts pour un anniversaire ou 500 hoodies pour un lancement de marque. Tout est imprime sur place a Montreal, ce qui nous permet de controler la qualite du debut a la fin.'
    },
    'about.what.label': { en: 'What we do', fr: 'Ce qu\'on fait' },
    'about.what.h2': { en: 'DTG, DTF & Embroidery under one roof', fr: 'DTG, DTF et broderie sous un meme toit' },
    'about.what.p1': {
      en: 'Having all three printing methods in-house means we can recommend the right approach for your project instead of forcing everything through one method. Cotton tees? DTG. Polyester jerseys? DTF. Corporate polos with your logo? Embroidery.',
      fr: 'Avoir les trois methodes d\'impression sur place nous permet de recommander la bonne approche pour votre projet. T-shirts en coton? DTG. Jerseys en polyester? DTF. Polos corporatifs avec votre logo? Broderie.'
    },
    'about.what.p2': {
      en: 'We also have a design studio on-site for cleanups, mockups, and brand assets, so even if your artwork isn\'t print-ready, we\'ll get it there.',
      fr: 'Nous avons aussi un studio de design sur place pour les retouches, maquettes et actifs de marque. Meme si votre visuel n\'est pas pret pour l\'impression, on s\'en occupe.'
    },
    'about.clients.label': { en: 'Who we work with', fr: 'Avec qui on travaille' },
    'about.clients.h2': { en: 'From startups to schools to Saturday markets', fr: 'Des startups aux ecoles en passant par les marches du samedi' },
    'about.clients.p1': {
      en: 'Our clients include local businesses needing staff uniforms, content creators launching merch, gyms and cafes with branded gear, schools and event organizers, and artists selling at pop-ups.',
      fr: 'Nos clients incluent des entreprises locales qui ont besoin d\'uniformes, des createurs de contenu qui lancent du merch, des gyms et cafes avec des vetements de marque, des ecoles et organisateurs d\'evenements, et des artistes qui vendent dans des pop-ups.'
    },
    'about.clients.p2': {
      en: 'Whether you need 1 item or 1,000+, there\'s no minimum and no judgment. We\'ve built our process to be friendly for first-timers and efficient for repeat clients.',
      fr: 'Que vous ayez besoin de 1 article ou 1 000+, il n\'y a pas de minimum et aucun jugement. Notre processus est convivial pour les nouveaux clients et efficace pour les habitues.'
    },
    'about.values.h2': { en: 'How we work', fr: 'Comment on travaille' },
    'about.values.transparent.h': { en: 'Transparent pricing', fr: 'Prix transparents' },
    'about.values.transparent.p': {
      en: 'You get a clear quote upfront with no hidden fees. Bulk discounts and business packages available for recurring orders.',
      fr: 'Vous recevez une soumission claire sans frais caches. Rabais de volume et forfaits entreprises pour les commandes recurrentes.'
    },
    'about.values.sample.h': { en: 'Sample-first approach', fr: 'Approche echantillon d\'abord' },
    'about.values.sample.p': {
      en: 'Every order gets a physical sample before full production. You verify colors, placement, and quality before we print a single extra piece.',
      fr: 'Chaque commande recoit un echantillon physique avant la production. Vous verifiez les couleurs, le placement et la qualite avant qu\'on imprime le reste.'
    },
    'about.values.turnaround.h': { en: 'Real turnaround times', fr: 'De vrais delais de livraison' },
    'about.values.turnaround.p': {
      en: 'Most orders ready in 2-4 business days. We don\'t quote timelines we can\'t hit, and rush options are available when you need them.',
      fr: 'La plupart des commandes pretes en 2 a 4 jours ouvrables. On ne promet pas de delais qu\'on ne peut pas tenir, et des options urgentes sont disponibles.'
    },
    'about.values.qc.h': { en: 'Quality control', fr: 'Controle de qualite' },
    'about.values.qc.p': {
      en: '100% in-house production means we catch issues before they reach you. No outsourcing, no middlemen, no surprises.',
      fr: '100% production interne. On detecte les problemes avant qu\'ils ne vous atteignent. Pas de sous-traitance, pas d\'intermediaires, pas de surprises.'
    },
    'about.values.design.h': { en: 'Free design help', fr: 'Aide au design gratuite' },
    'about.values.design.p': {
      en: 'Don\'t have print-ready artwork? Our design studio helps with cleanups, mockups, and getting your files production-ready at no extra charge.',
      fr: 'Votre visuel n\'est pas pret pour l\'impression? Notre studio de design aide avec les retouches, maquettes et la preparation de vos fichiers sans frais supplementaires.'
    },
    'about.values.delivery.h': { en: 'Flexible delivery', fr: 'Livraison flexible' },
    'about.values.delivery.p': {
      en: 'Local pickup in the West Island, delivery across Montreal, or Canada-wide shipping. Free delivery on orders of 25+ units.',
      fr: 'Ramassage local dans l\'Ouest-de-l\'Ile, livraison a Montreal ou expedition partout au Canada. Livraison gratuite pour les commandes de 25+ unites.'
    },
    'about.map.h2': { en: 'Visit our studio', fr: 'Visitez notre studio' },
    'about.map.p': {
      en: 'Montreal\'s West Island. Open 7 days a week, 9AM to 9PM. Call first to schedule a visit.',
      fr: 'Ouest-de-l\'Ile de Montreal. Ouvert 7 jours sur 7, de 9h a 21h. Appelez avant pour planifier une visite.'
    },
    'about.cta.h2': { en: 'Ready to get started?', fr: 'Pret a commencer?' },
    'about.cta.p': {
      en: 'Tell us what you need and get a quote in hours, not days. First order is 15% off.',
      fr: 'Dites-nous ce qu\'il vous faut et recevez une soumission en heures, pas en jours. 15% de rabais sur la premiere commande.'
    },
    'about.cta.btn': { en: 'Get a Free Quote', fr: 'Soumission gratuite' },

    // ===== PORTFOLIO =====
    'portfolio.h1': { en: 'Our work', fr: 'Nos realisations' },
    'portfolio.sub': {
      en: 'Recent prints, merch drops, uniforms, and creative projects, all done in-house at our Montreal studio.',
      fr: 'Impressions recentes, lancements de merch, uniformes et projets creatifs, le tout realise dans notre studio de Montreal.'
    },
    'portfolio.filter.all': { en: 'All', fr: 'Tout' },
    'portfolio.filter.dtg': { en: 'DTG', fr: 'DTG' },
    'portfolio.filter.dtf': { en: 'DTF', fr: 'DTF' },
    'portfolio.filter.embroidery': { en: 'Embroidery', fr: 'Broderie' },
    'portfolio.cta.h2': { en: 'Like what you see?', fr: 'Vous aimez ce que vous voyez?' },
    'portfolio.cta.p': {
      en: 'Let\'s make something great for your brand, team, or next event.',
      fr: 'Creons quelque chose de genial pour votre marque, equipe ou prochain evenement.'
    },
    'portfolio.cta.btn': { en: 'Get a Free Quote', fr: 'Soumission gratuite' },

    // ===== INKWEAR =====
    'inkwear.label': { en: 'By Singhs Print', fr: 'Par Singhs Print' },
    'inkwear.tagline': { en: 'Turning tattoo art into wearable designs.', fr: 'Transformer l\'art du tatouage en designs portables.' },
    'inkwear.sub': {
      en: 'A merch partnership for tattoo studios. Your clients already invest in personal art. That connection doesn\'t have to end at the chair.',
      fr: 'Un partenariat merch pour les studios de tatouage. Vos clients investissent deja dans l\'art personnel. Ce lien ne doit pas se terminer au fauteuil.'
    },
    'inkwear.hero.cta1': { en: 'See How It Works', fr: 'Voir comment ca marche' },
    'inkwear.hero.cta2': { en: 'Partner With Us', fr: 'Devenez partenaire' },
    'inkwear.what.label': { en: 'What We Do', fr: 'Ce qu\'on fait' },
    'inkwear.what.h2': { en: 'We help tattoo studios monetize their artwork', fr: 'On aide les studios de tatouage a monetiser leur art' },
    'inkwear.what.sub': {
      en: 'No equipment. No production headaches. We handle design prep, printing, and fulfillment from our West Island studio.',
      fr: 'Aucun equipement. Aucun mal de tete de production. On gere la preparation, l\'impression et la livraison depuis notre studio de l\'Ouest-de-l\'Ile.'
    },
    'inkwear.stream1.tag': { en: 'Revenue Stream 1', fr: 'Source de revenus 1' },
    'inkwear.stream1.h': { en: 'Post-Tattoo Upsell', fr: 'Vente apres-tatouage' },
    'inkwear.stream1.p': {
      en: 'Offer clients apparel featuring their tattoo design, printed or embroidered immediately after their session. It captures the excitement of the moment and gives them a personalized extension of their new art.',
      fr: 'Offrez a vos clients des vetements avec leur design de tatouage, imprimes ou brodes juste apres leur session. Cela capture l\'excitation du moment et prolonge leur nouvel art.'
    },
    'inkwear.stream2.tag': { en: 'Revenue Stream 2', fr: 'Source de revenus 2' },
    'inkwear.stream2.h': { en: 'In-Shop Merch Shelf', fr: 'Etagere merch en boutique' },
    'inkwear.stream2.p': {
      en: 'Sell artist-designed apparel directly in your studio. Showcase your artists\' flash sheets and custom designs on premium garments for walk-ins and loyal clients. Build a brand beyond the chair.',
      fr: 'Vendez des vetements designes par vos artistes directement en studio. Presentez vos flash sheets et designs personnalises sur des vetements haut de gamme. Construisez une marque au-dela du fauteuil.'
    },
    'inkwear.statement': {
      en: 'Tattoo clients already spend hundreds on designs they connect with emotionally. Now they can wear them too.',
      fr: 'Les clients de tatouage depensent deja des centaines de dollars pour des designs auxquels ils s\'attachent. Maintenant, ils peuvent aussi les porter.'
    },
    'inkwear.why.label': { en: 'Why It Works', fr: 'Pourquoi ca marche' },
    'inkwear.why.h2': { en: 'Everyone wins', fr: 'Tout le monde y gagne' },
    'inkwear.why.studios': { en: 'Tattoo Studios', fr: 'Studios de tatouage' },
    'inkwear.why.artists': { en: 'Artists', fr: 'Artistes' },
    'inkwear.why.sp': { en: 'Singhs Print', fr: 'Singhs Print' },
    'inkwear.hiw.label': { en: 'How It Works', fr: 'Comment ca marche' },
    'inkwear.hiw.h2': { en: 'Simple for you, seamless for your clients', fr: 'Simple pour vous, transparent pour vos clients' },
    'inkwear.hiw.step1.h': { en: 'Send us the artwork', fr: 'Envoyez-nous le visuel' },
    'inkwear.hiw.step1.p': {
      en: 'Share the tattoo design, flash sheet, or sketch. We prep it for print at no extra charge.',
      fr: 'Partagez le design de tatouage, la feuille flash ou le croquis. On le prepare pour l\'impression sans frais supplementaires.'
    },
    'inkwear.hiw.step2.h': { en: 'We print a sample', fr: 'On imprime un echantillon' },
    'inkwear.hiw.step2.p': {
      en: 'You approve the sample before anything goes into production. Pick your blanks, colors, and placements.',
      fr: 'Vous approuvez l\'echantillon avant la production. Choisissez vos vetements, couleurs et emplacements.'
    },
    'inkwear.hiw.step3.h': { en: 'Sell in your studio', fr: 'Vendez dans votre studio' },
    'inkwear.hiw.step3.p': {
      en: 'Stock your merch shelf or offer it as a post-session add-on. We handle reorders and scaling when you\'re ready.',
      fr: 'Garnissez votre etagere merch ou offrez-le en ajout apres la session. On gere les recommandes et la croissance quand vous etes prets.'
    },
    'inkwear.cta.tagline': { en: 'Let\'s start small. One design. One product.', fr: 'Commencons petit. Un design. Un produit.' },
    'inkwear.cta.h2': { en: 'If it works, we scale.', fr: 'Si ca marche, on grandit.' },
    'inkwear.cta.sub': {
      en: 'Get in touch to set up your first sample run. No commitment, no minimums.',
      fr: 'Contactez-nous pour votre premier echantillon. Aucun engagement, aucun minimum.'
    },
    'inkwear.cta.email': { en: 'Email Us to Get Started', fr: 'Ecrivez-nous pour commencer' },

    // ===== BUSINESSES =====
    'biz.label': { en: 'For Businesses', fr: 'Pour entreprises' },
    'biz.hero.h1': { en: 'Custom apparel at<br>volume pricing', fr: 'Vetements personnalises<br>a prix de volume' },
    'biz.hero.sub': {
      en: 'Staff uniforms, corporate swag, event merch, team gear. Transparent bulk pricing, dedicated account support, and everything printed in-house at our West Island studio.',
      fr: 'Uniformes d\'equipe, swag corporatif, merch evenementiel, vetements d\'equipe. Prix de volume transparents, support dedie et tout imprime sur place dans notre studio de l\'Ouest-de-l\'Ile.'
    },
    'biz.hero.cta1': { en: 'See Volume Pricing', fr: 'Voir les prix de volume' },
    'biz.hero.cta2': { en: 'Get a Custom Quote', fr: 'Obtenir une soumission' },
    'biz.who.label': { en: 'Who We Serve', fr: 'Qui on sert' },
    'biz.who.h2': { en: 'Built for businesses of every size', fr: 'Concu pour les entreprises de toute taille' },
    'biz.who.sub': {
      en: 'From a 10-person cafe team to a 500-unit corporate order, we treat every account with the same care and quality.',
      fr: 'D\'une equipe de 10 personnes dans un cafe a une commande corporative de 500 unites, on traite chaque compte avec le meme soin et la meme qualite.'
    },
    'biz.seg1.h': { en: 'Gyms, Cafes & Restaurants', fr: 'Gyms, cafes et restaurants' },
    'biz.seg1.p': {
      en: 'Branded staff uniforms and merchandise that represent your brand every day.',
      fr: 'Uniformes d\'equipe et produits de marque qui representent votre entreprise chaque jour.'
    },
    'biz.seg2.h': { en: 'Schools, Universities & Clubs', fr: 'Ecoles, universites et clubs' },
    'biz.seg2.p': {
      en: 'Team gear, event merch, and student org apparel with fast turnaround.',
      fr: 'Vetements d\'equipe, merch evenementiel et vetements d\'association etudiante avec un delai rapide.'
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
      fr: 'Pas de surprises. Voyez votre cout exact par unite selon la quantite et les cotes d\'impression.'
    },
    'biz.why.sample.h': { en: 'Sample Before Production', fr: 'Echantillon avant production' },
    'biz.why.sample.p': {
      en: 'Every order gets a physical sample for approval before we print the full run.',
      fr: 'Chaque commande recoit un echantillon physique pour approbation avant la production complete.'
    },
    'biz.why.turnaround.h': { en: '2-4 Day Turnaround', fr: 'Delai de 2 a 4 jours' },
    'biz.why.turnaround.p': {
      en: 'Most orders ready in 2-4 business days. Rush options available when deadlines are tight.',
      fr: 'La plupart des commandes pretes en 2 a 4 jours ouvrables. Options urgentes disponibles.'
    },
    'biz.why.design.h': { en: 'Free Design Help', fr: 'Aide au design gratuite' },
    'biz.why.design.p': {
      en: 'Our in-house design studio preps your artwork for production at no extra charge.',
      fr: 'Notre studio de design prepare votre visuel pour la production sans frais supplementaires.'
    },
    'biz.why.delivery.h': { en: 'Free Delivery (25+ Units)', fr: 'Livraison gratuite (25+ unites)' },
    'biz.why.delivery.p': {
      en: 'Free delivery across Montreal on orders of 25+ units. Canada-wide shipping available.',
      fr: 'Livraison gratuite a Montreal pour les commandes de 25+ unites. Expedition partout au Canada.'
    },
    'biz.why.reorder.h': { en: 'Easy Reorders', fr: 'Recommandes faciles' },
    'biz.why.reorder.p': {
      en: 'We keep your artwork and specs on file. Reordering is as simple as sending a message.',
      fr: 'On conserve vos visuels et specifications. Recommander est aussi simple que d\'envoyer un message.'
    },
    'biz.statement.h2': { en: 'The bigger the order, the better the price. No hidden fees, ever.', fr: 'Plus la commande est grande, meilleur est le prix. Aucuns frais caches.' },
    'biz.statement.p': { en: 'All prices include printing. What you see is what you pay.', fr: 'Tous les prix incluent l\'impression. Ce que vous voyez est ce que vous payez.' },
    'biz.pricing.label': { en: 'Volume Pricing', fr: 'Prix de volume' },
    'biz.pricing.h2': { en: 'Print prices per unit', fr: 'Prix d\'impression par unite' },
    'biz.pricing.note': {
      en: 'Prices include printing on your chosen blank. Select a product to see the full breakdown by quantity and number of print sides.',
      fr: 'Les prix incluent l\'impression sur le vetement choisi. Selectionnez un produit pour voir la ventilation par quantite et nombre de cotes d\'impression.'
    },
    'biz.pricing.canadian': { en: '+$2 each for all-Canadian shirts (Rue Saint-Patrick)', fr: '+2$ chacun pour les chandails canadiens (Rue Saint-Patrick)' },
    'biz.pricing.qty': { en: 'Quantity', fr: 'Quantite' },
    'biz.hiw.label': { en: 'How It Works', fr: 'Comment ca marche' },
    'biz.hiw.h2': { en: 'From first contact to delivery', fr: 'Du premier contact a la livraison' },
    'biz.hiw.step1.h': { en: 'Tell us what you need', fr: 'Dites-nous ce qu\'il vous faut' },
    'biz.hiw.step1.p': {
      en: 'Fill out a quick quote form or email us. Include your garment type, quantity, and any artwork you have.',
      fr: 'Remplissez un formulaire de soumission ou ecrivez-nous. Incluez le type de vetement, la quantite et votre visuel.'
    },
    'biz.hiw.step2.h': { en: 'Get your quote', fr: 'Recevez votre soumission' },
    'biz.hiw.step2.p': {
      en: 'We respond within hours with a clear price breakdown. No back-and-forth, no hidden fees.',
      fr: 'On repond en quelques heures avec une ventilation claire des prix. Pas de va-et-vient, pas de frais caches.'
    },
    'biz.hiw.step3.h': { en: 'Approve a sample', fr: 'Approuvez un echantillon' },
    'biz.hiw.step3.p': {
      en: 'We print a physical sample for your approval. You check colors, placement, and quality before full production.',
      fr: 'On imprime un echantillon physique pour votre approbation. Vous verifiez les couleurs, le placement et la qualite avant la production.'
    },
    'biz.hiw.step4.h': { en: 'We deliver', fr: 'On livre' },
    'biz.hiw.step4.p': {
      en: 'Full order ready in 2-4 business days. Free delivery across Montreal for 25+ units.',
      fr: 'Commande complete prete en 2 a 4 jours ouvrables. Livraison gratuite a Montreal pour 25+ unites.'
    },
    'biz.cta.h2': { en: 'Ready to outfit your team?', fr: 'Pret a habiller votre equipe?' },
    'biz.cta.sub': {
      en: 'Get a volume quote in hours, not days. No minimums, no commitments.',
      fr: 'Obtenez une soumission de volume en heures, pas en jours. Aucun minimum, aucun engagement.'
    },
    'biz.cta.btn': { en: 'Get a Business Quote', fr: 'Soumission entreprise' },

    // ===== QUOTE FORM =====
    'quote.h1': { en: 'Build your custom order', fr: 'Creez votre commande personnalisee' },
    'quote.sub': {
      en: 'Design your mockup, pick your options, and request a quote in minutes. No account needed.',
      fr: 'Creez votre maquette, choisissez vos options et demandez une soumission en quelques minutes. Aucun compte requis.'
    },
    'quote.step1.h': { en: 'Choose your product', fr: 'Choisissez votre produit' },
    'quote.step1.desc': { en: 'Select a garment type to start building your order.', fr: 'Selectionnez un type de vetement pour commencer votre commande.' },
    'quote.step2.h': { en: 'Customize your design', fr: 'Personnalisez votre design' },
    'quote.step2.desc': { en: 'Pick your color, placement, and print method.', fr: 'Choisissez votre couleur, emplacement et methode d\'impression.' },
    'quote.step3.h': { en: 'Order details', fr: 'Details de la commande' },
    'quote.step3.desc': { en: 'Tell us about quantity, sizes, and your timeline.', fr: 'Dites-nous la quantite, les tailles et votre delai.' },
    'quote.step4.h': { en: 'Get your quote', fr: 'Obtenez votre soumission' },
    'quote.step4.desc': { en: 'Review and submit. We\'ll get back to you within hours.', fr: 'Revisez et soumettez. On vous repond en quelques heures.' },
    'quote.next': { en: 'Next', fr: 'Suivant' },
    'quote.back': { en: 'Back', fr: 'Retour' },
    'quote.submit': { en: 'Submit Quote Request', fr: 'Soumettre la demande' },
    'quote.garmentcolor': { en: 'Garment Color', fr: 'Couleur du vetement' },
    'quote.placement': { en: 'Print Placement', fr: 'Emplacement de l\'impression' },
    'quote.placement.front': { en: 'Front', fr: 'Avant' },
    'quote.placement.back': { en: 'Back', fr: 'Arriere' },
    'quote.placement.rightchest': { en: 'Right Chest', fr: 'Poitrine droite' },
    'quote.placement.sleeve': { en: 'Sleeve', fr: 'Manche' },
    'quote.method': { en: 'Print Method', fr: 'Methode d\'impression' },
    'quote.method.dtg': { en: 'DTG (Direct to Garment)', fr: 'DTG (directement sur vetement)' },
    'quote.method.dtf': { en: 'DTF (Direct to Film)', fr: 'DTF (direct sur film)' },
    'quote.method.embroidery': { en: 'Embroidery', fr: 'Broderie' },
    'quote.method.notsure': { en: 'Not sure (we\'ll recommend)', fr: 'Pas certain (on vous conseille)' },
    'quote.garmentsource': { en: 'Garment Source', fr: 'Source du vetement' },
    'quote.garmentsource.wesupply': { en: 'We Supply', fr: 'On fournit' },
    'quote.garmentsource.bringyourown': { en: 'Bring Your Own', fr: 'Apportez le votre' },
    'quote.blankbrand': { en: 'Blank Brand', fr: 'Marque du vetement' },
    'quote.blankbrand.any': { en: 'Any / Let us recommend', fr: 'Au choix / On recommande' },
    'quote.quantity': { en: 'Quantity', fr: 'Quantite' },
    'quote.sizes': { en: 'Sizes Needed', fr: 'Tailles requises' },
    'quote.timeline': { en: 'Timeline', fr: 'Delai' },
    'quote.timeline.standard': { en: 'Standard (2-4 business days)', fr: 'Standard (2-4 jours ouvrables)' },
    'quote.timeline.rush': { en: 'Rush (1-2 business days)', fr: 'Urgent (1-2 jours ouvrables)' },
    'quote.timeline.flexible': { en: 'Flexible / No rush', fr: 'Flexible / Pas presse' },
    'quote.upload': { en: 'Upload Your Design', fr: 'Televersez votre design' },
    'quote.notes': { en: 'Additional Notes', fr: 'Notes supplementaires' },
    'quote.name': { en: 'Full Name', fr: 'Nom complet' },
    'quote.email': { en: 'Email', fr: 'Courriel' },
    'quote.phone': { en: 'Phone', fr: 'Telephone' },
    'quote.summary': { en: 'Order Summary', fr: 'Resume de la commande' },
    'quote.summary.product': { en: 'Product', fr: 'Produit' },
    'quote.summary.color': { en: 'Color', fr: 'Couleur' },
    'quote.summary.placement': { en: 'Placement', fr: 'Emplacement' },
    'quote.summary.method': { en: 'Method', fr: 'Methode' },
    'quote.summary.qty': { en: 'Qty', fr: 'Qte' },
    'quote.designhere': { en: 'Your design appears here', fr: 'Votre design apparait ici' }
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
  }

  function toggleLang() {
    currentLang = currentLang === 'en' ? 'fr' : 'en';
    localStorage.setItem('sp-lang', currentLang);
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
