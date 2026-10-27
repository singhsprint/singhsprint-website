/* Client gift boxes — /gifts/build and /gifts/order (+ /fr/ mirrors).
 *
 * Vanilla port of the CRM's builder, "do it for me" form and buyer status
 * page, so the whole buyer journey stays inside the site nav like /jerseys.
 * Every number comes from the CRM: /api/gifts/price runs the same engine
 * checkout charges from. Nothing is priced in the browser.
 *
 *   /gifts/build                    fork: build it myself | have us build it
 *   /gifts/build?tier=signature     start a self-serve draft from a tier
 *   /gifts/build?d=<id>&k=<secret>  resume a draft (also Stripe's cancel_url)
 *   /gifts/build?path=concierge     the 2-minute "have us build it" form
 *   /gifts/order?t=<token>[&paid=1] buyer status (Stripe's success_url)
 */
(function () {
  'use strict';
  var API = 'https://singhsprint-crm.vercel.app';
  var IMAGE_PROXY = API + '/api/image-proxy';
  var PROXIED_HOSTS = ['ssactivewear.com', 'blanks.ca', 'sanmarcanada.com'];
  var L = (document.documentElement.lang || 'en').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en';
  var BASE = L === 'fr' ? '/fr' : '';
  var MIN = 10, STEP = 5, MAX = 100;
  var me = document.currentScript || document.querySelector('script[data-page]');
  var PAGE = (me && me.getAttribute('data-page')) || 'landing';
  var LS_KEY = 'sp_gift_draft';

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function qp(n) { try { return new URLSearchParams(location.search).get(n); } catch (e) { return null; } }
  function imgUrl(raw) {
    if (!raw) return '/images/product-tshirt-white.jpg';
    if (raw.charAt(0) === '/' || raw.indexOf('singhsprint.com') >= 0) return raw;
    for (var i = 0; i < PROXIED_HOSTS.length; i++) if (raw.indexOf(PROXIED_HOSTS[i]) >= 0) return IMAGE_PROXY + '?url=' + encodeURIComponent(raw);
    return raw;
  }
  function money(n) {
    if (n == null || isNaN(n)) return '—';
    var s = Number(n).toLocaleString(L === 'fr' ? 'fr-CA' : 'en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return L === 'fr' ? s + ' $' : '$' + s;
  }
  function whole(n) { return L === 'fr' ? Math.round(n) + ' $' : '$' + Math.round(n); }
  function lsGet() { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { return null; } }
  function lsSet(v) { try { v ? localStorage.setItem(LS_KEY, JSON.stringify(v)) : localStorage.removeItem(LS_KEY); } catch (e) {} }
  function setUrl(q) { try { history.replaceState(null, '', location.pathname + (q ? '?' + q : '')); } catch (e) {} }
  function j(url, opt) {
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, status: r.status, body: b }; });
    });
  }
  function jpost(url, body, method) { return j(url, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  function isEmbOnly(g) { g = String(g || '').toLowerCase(); return g === 'hat' || g === 'cap'; }

  var PLACE = {
    shirt: [['left-chest', 'Left chest', 'Poitrine gauche'], ['center-chest', 'Center chest', 'Centre poitrine'], ['full-front', 'Full front', 'Devant complet'], ['back-top', 'Top back', 'Haut du dos'], ['left-sleeve', 'Left sleeve', 'Manche gauche'], ['right-sleeve', 'Right sleeve', 'Manche droite']],
    cap: [['cap-front', 'Cap front', 'Devant'], ['cap-left-side', 'Left side', 'Côté gauche'], ['cap-right-side', 'Right side', 'Côté droit'], ['cap-back', 'Back panel', 'Arrière']],
    bag: [['bag-front', 'Front of bag', 'Devant du sac'], ['bag-pocket', 'Front pocket', 'Poche avant']]
  };
  function placementsFor(g) { g = String(g || '').toLowerCase(); return g === 'hat' || g === 'cap' ? PLACE.cap : (g === 'tote' || g === 'bag') ? PLACE.bag : PLACE.shirt; }
  function placeLabel(id) { var all = PLACE.shirt.concat(PLACE.cap, PLACE.bag); for (var i = 0; i < all.length; i++) if (all[i][0] === id) return L === 'fr' ? all[i][2] : all[i][1]; return id; }

  var T = {
    en: {
      steps: ['The pieces', 'Your logo', 'Your clients', 'Review & pay'], saved: 'Saved', saving: 'Saving…', draft: 'Your draft saves as you go - this link brings you back.', hand: 'Stuck? Hand it to us →', handed: "Got it - we'll take it from here.", handedp: 'Mockups and a price within 1 business day, to',
      pickh: 'Start with a tier', pickp: 'Each one fills the box with pieces that work together. Swap anything after.', custom: 'Custom', customp: 'Set your own budget and pick every piece.', resume: 'Continue your saved box →', starting: 'Setting up your box…',
      s1h: 'Pick the pieces', s1p: 'Start from a tier or set your own budget, then pick what goes in the box.', tier: 'Tier', budget: 'Budget per client', clients: 'How many clients?', min: 'min ' + MIN + ', steps of ' + STEP, add: 'Add to box', inbox: '✓ In the box', coll: 'Same catalog as the shop, picked for gifting.', next1: 'Your logo →', max6: 'Up to 6 pieces per box.',
      s2h: 'Your logo on the gear', s2p: "One logo, used everywhere. Pick a colour and placement per piece - or skip and we'll keep it small and tasteful.", upload: 'Upload your logo', replace: 'Replace', uploading: 'Uploading…', logohint: 'PNG, SVG, AI or PDF. We clean it up if needed, free.', mode: 'How much logo?',
      modes: [['subtle', 'Small and subtle', 'Tonal left-chest or sleeve. Clients actually wear it.'], ['none', 'No logo on the gear', 'Your brand on the box and the card only.'], ['bold', 'Front and centre', 'Big logo. For your own team, not for clients.']],
      colour: 'Colour', place: 'Placement', method: 'Decoration', ink: 'Logo colour', inks: [['match', 'Match my logo'], ['white', 'White'], ['black', 'Black'], ['tone', 'Tone-on-tone']], printed: 'Printed (DTG)', embroidered: 'Embroidered', capnote: 'Caps are always embroidered.', preview: 'Photo-real mockups come after checkout, within 1 business day.', skip: 'Skip - keep it simple', next2: 'Your clients →', back: '← Back', cmyk: 'Our printers print CMYK, so colours can shift a touch from your screen. Black is black.', lid: 'The box lid: we design it from your logo and you approve it with the mockups.',
      s3h: 'Your clients', s3p: "Name and email is all we need. They'll pick their own size and confirm their address from a private link.", paste: 'Paste one per line:\nName, email, size (optional), address (optional)', addthese: 'Add these', listed: 'listed', togo: 'to go', noemail: 'no email', delivery: 'Delivery', d1: ['Ship to each client', 'One box, one tracking number, per client.'], d2: ['Deliver to me', 'Inner boxes in bulk, no outer shipper. Lower price.'], card: 'The card', cardph: 'Thank you for working with us this year…', signer: 'Signed by', pers: 'Personalized card - a handwritten note to each client', perbox: 'box', noanswer: "If a client doesn't answer: reminders on day 2 and 5, then size", after: 'after 14 days.', next3: 'Review and pay →', cardlang: { en: 'English', fr: 'Français', both: 'EN + FR' },
      s4h: 'Review and pay', s4p: 'Nothing is made until you approve the mockups.', you: 'Where do we send the mockups?', name: 'Name', company: 'Company', email: 'Email', phone: 'Phone', yourbox: 'Your box', totals: 'Totals', pieces: 'pieces', boxline: 'Box, card, tissue', ship: ', shipping', perscard: 'Personalized cards', stdcard: 'standard card', vol: 'Volume', setup: 'Setup', tax: 'GST 5% + QST 9.975%', total: 'Total', pay: 'Pay', dep: '50% deposit now', depsub: 'balance when it ships', full: 'Pay in full', fullsub: 'card or Affirm', promise: 'Mockups of the gear and the box within 1 business day. One click to approve. Nothing is made until you do.', paybtn: 'Pay securely →', paying: 'Opening checkout…', secure: 'Secure checkout by Stripe · GST/QST included', needemail: 'We need your name and email to send the mockups.', empty: 'Pick at least one piece first.',
      per: 'Per client', over: 'over budget', under: 'under budget', boxes: 'boxes', ordertotal: 'Order total', warn: 'Heads up', sizeS: 'Small', sizeM: 'Medium', sizeL: 'Large', box: 'box', colours: 'colours', missing: "This draft link isn't valid any more.", startover: 'Start a new box →', cantedit: 'This box has been submitted.', seeorder: 'See your order →', loadfail: "We couldn't load the catalog. Refresh, or email sales@singhsprint.com.",
      // concierge
      ce: 'Have us build it', ch: 'Tell us about the box', cp: "Two minutes. We'll send mockups and a quote within 1 business day. No payment now.", cbudget: 'Budget per client', cbudgets: [[80, 'About $80'], [165, 'About $165'], [195, 'About $195'], [0, "I'll say"]], cbph: '$ per client', cwho: 'Who are these for?', cwhos: [['past_clients', 'Past clients'], ['referral_partners', 'Referral partners'], ['employees', 'Employees'], ['event', 'Event / launch']], cbiz: "What's your business?", cbizs: [['real_estate', 'Real estate'], ['mortgage_insurance', 'Mortgage / insurance'], ['construction', 'Construction / reno'], ['dealership', 'Dealership'], ['other', 'Other']], clogo: 'Your logo and colours', cbrand: 'Brand colour', cmatch: 'or match my logo', cmatched: "we'll match your logo", cgear: 'Logo on the gear?', cnotes: 'Anything we should know?', optional: 'optional', cnotesph: 'e.g. mostly men 35-55, no hoodies, French cards, need them before Dec 10', csend: 'Where do we send the mockups?', cbtn: 'Send me mockups and a quote →', cbusy: 'Sending…', cfine: 'No payment now. Within 1 business day you get mockups of the gear and the box, the per-client price, and a deposit link if you like it.', cget: "What you'll get back", cgets: ['2-3 pieces picked to fit your budget and your clients', 'Photo-real mockups with your logo on each piece', 'A proof of your box lid and card', 'The price per client and the order total, taxes in', 'One click to approve, or tell us what to change'], cbox: 'The box, so you know', cboxes: [['Small', '12 × 10 × 5 in', 'tee or polo + cap'], ['Medium', '14 × 11 × 6.5 in', 'quarter-zip or crewneck + tee + cap'], ['Large', '16 × 12 × 7.5 in', 'hoodie or fleece + tee + cap']], cboxnote: 'Kraft mailer with your logo sticker (printed box available), tissue, logo seal, printed card. Shipped in a plain outer box.', cdoneh: 'Got it', cdonep: "We're building a box for about {n} clients{b}. You'll get mockups and the price at {e} within 1 business day. The proof has one-click approve, or a comment box if you want changes.", cdonep2: 'Reply to that email any time - it comes straight to us. Or call 438-544-3800.', cerr: 'Something went wrong - try again or email sales@singhsprint.com', reorder: 'Same box as order', each: ' at around {b} each', choose: 'Choose file'
    },
    fr: {
      steps: ['Les morceaux', 'Votre logo', 'Vos clients', 'Réviser et payer'], saved: 'Enregistré', saving: 'Enregistrement…', draft: 'Le brouillon s’enregistre - ce lien vous ramène ici.', hand: 'Bloqué? Confiez-nous la suite →', handed: 'C’est noté - on prend le relais.', handedp: 'Maquettes et prix en 1 jour ouvrable, à',
      pickh: 'Partez d’un forfait', pickp: 'Chacun remplit la boîte de morceaux qui vont bien ensemble. Changez ce que vous voulez ensuite.', custom: 'Sur mesure', customp: 'Fixez votre budget et choisissez chaque morceau.', resume: 'Reprendre votre boîte →', starting: 'Préparation de votre boîte…',
      s1h: 'Choisissez les morceaux', s1p: 'Partez d’un forfait ou fixez votre budget, puis choisissez ce qui va dans la boîte.', tier: 'Forfait', budget: 'Budget par client', clients: 'Combien de clients?', min: 'min ' + MIN + ', par ' + STEP, add: 'Ajouter', inbox: '✓ Dans la boîte', coll: 'Le même catalogue que la boutique, choisi pour les cadeaux.', next1: 'Votre logo →', max6: 'Jusqu’à 6 morceaux par boîte.',
      s2h: 'Votre logo sur les vêtements', s2p: 'Un logo, partout. Choisissez couleur et emplacement par morceau - ou passez, on le garde petit et de bon goût.', upload: 'Téléversez votre logo', replace: 'Remplacer', uploading: 'Téléversement…', logohint: 'PNG, SVG, AI ou PDF. On le nettoie au besoin, gratuitement.', mode: 'Quelle taille de logo?',
      modes: [['subtle', 'Petit et discret', 'Ton sur ton, poitrine gauche ou manche. Vos clients le portent vraiment.'], ['none', 'Aucun logo sur les vêtements', 'Votre marque sur la boîte et la carte seulement.'], ['bold', 'Bien en vue', 'Gros logo. Pour votre équipe, pas pour vos clients.']],
      colour: 'Couleur', place: 'Emplacement', method: 'Décoration', ink: 'Couleur du logo', inks: [['match', 'Comme mon logo'], ['white', 'Blanc'], ['black', 'Noir'], ['tone', 'Ton sur ton']], printed: 'Imprimé (DTG)', embroidered: 'Brodé', capnote: 'Les casquettes sont toujours brodées.', preview: 'Les maquettes photo arrivent après le paiement, en 1 jour ouvrable.', skip: 'Passer - rester simple', next2: 'Vos clients →', back: '← Retour', cmyk: 'Nos imprimantes impriment en CMJN : les couleurs peuvent varier un peu de votre écran. Le noir reste noir.', lid: 'Le couvercle : on le conçoit à partir de votre logo et vous l’approuvez avec les maquettes.',
      s3h: 'Vos clients', s3p: 'Nom et courriel, c’est tout. Ils choisissent leur taille et confirment leur adresse à partir d’un lien privé.', paste: 'Collez un par ligne :\nNom, courriel, taille (facultatif), adresse (facultatif)', addthese: 'Ajouter', listed: 'inscrits', togo: 'à venir', noemail: 'sans courriel', delivery: 'Livraison', d1: ['Expédier à chaque client', 'Une boîte, un numéro de suivi, par client.'], d2: ['Livrer chez moi', 'Boîtes intérieures en lot, sans boîte d’expédition. Moins cher.'], card: 'La carte', cardph: 'Merci d’avoir travaillé avec nous cette année…', signer: 'Signé par', pers: 'Carte personnalisée - une note manuscrite pour chaque client', perbox: 'boîte', noanswer: 'Si un client ne répond pas : rappels aux jours 2 et 5, puis taille', after: 'après 14 jours.', next3: 'Réviser et payer →', cardlang: { en: 'English', fr: 'Français', both: 'FR + EN' },
      s4h: 'Réviser et payer', s4p: 'Rien n’est fabriqué avant votre approbation des maquettes.', you: 'Où envoie-t-on les maquettes?', name: 'Nom', company: 'Entreprise', email: 'Courriel', phone: 'Téléphone', yourbox: 'Votre boîte', totals: 'Totaux', pieces: 'morceaux', boxline: 'Boîte, carte, papier de soie', ship: ', livraison', perscard: 'Cartes personnalisées', stdcard: 'carte standard', vol: 'Volume', setup: 'Mise en route', tax: 'TPS 5 % + TVQ 9,975 %', total: 'Total', pay: 'Payer', dep: 'Dépôt de 50 % maintenant', depsub: 'solde à l’expédition', full: 'Payer en entier', fullsub: 'carte ou Affirm', promise: 'Maquettes des vêtements et de la boîte en 1 jour ouvrable. Un clic pour approuver. Rien n’est fabriqué avant.', paybtn: 'Payer en toute sécurité →', paying: 'Ouverture du paiement…', secure: 'Paiement sécurisé par Stripe · TPS/TVQ incluses', needemail: 'Il nous faut votre nom et votre courriel pour envoyer les maquettes.', empty: 'Choisissez au moins un morceau.',
      per: 'Par client', over: 'au-dessus du budget', under: 'sous le budget', boxes: 'boîtes', ordertotal: 'Total de la commande', warn: 'À noter', sizeS: 'Petite', sizeM: 'Moyenne', sizeL: 'Grande', box: 'boîte', colours: 'couleurs', missing: 'Ce lien de brouillon n’est plus valide.', startover: 'Commencer une nouvelle boîte →', cantedit: 'Cette boîte a été soumise.', seeorder: 'Voir votre commande →', loadfail: 'Impossible de charger le catalogue. Actualisez, ou écrivez à sales@singhsprint.com.',
      ce: 'On s’en occupe', ch: 'Parlez-nous de la boîte', cp: 'Deux minutes. On vous envoie maquettes et soumission en 1 jour ouvrable. Aucun paiement maintenant.', cbudget: 'Budget par client', cbudgets: [[80, 'Environ 80 $'], [165, 'Environ 165 $'], [195, 'Environ 195 $'], [0, 'Je précise']], cbph: '$ par client', cwho: 'Pour qui?', cwhos: [['past_clients', 'Anciens clients'], ['referral_partners', 'Partenaires de référence'], ['employees', 'Employés'], ['event', 'Événement / lancement']], cbiz: 'Votre secteur?', cbizs: [['real_estate', 'Immobilier'], ['mortgage_insurance', 'Hypothèque / assurance'], ['construction', 'Construction / réno'], ['dealership', 'Concessionnaire'], ['other', 'Autre']], clogo: 'Votre logo et vos couleurs', cbrand: 'Couleur de marque', cmatch: 'ou comme mon logo', cmatched: 'on suivra votre logo', cgear: 'Logo sur les vêtements?', cnotes: 'Quelque chose à savoir?', optional: 'facultatif', cnotesph: 'ex. surtout des hommes 35-55 ans, pas de kangourous, cartes en français, besoin avant le 10 déc.', csend: 'Où envoie-t-on les maquettes?', cbtn: 'Envoyez-moi maquettes et soumission →', cbusy: 'Envoi…', cfine: 'Aucun paiement maintenant. En 1 jour ouvrable : maquettes des vêtements et de la boîte, prix par client, et un lien de dépôt si ça vous plaît.', cget: 'Ce que vous recevrez', cgets: ['2-3 morceaux choisis selon votre budget et vos clients', 'Des maquettes photo avec votre logo sur chaque morceau', 'Une épreuve du couvercle et de la carte', 'Le prix par client et le total, taxes incluses', 'Un clic pour approuver, ou dites-nous quoi changer'], cbox: 'La boîte, pour info', cboxes: [['Petite', '12 × 10 × 5 po', 't-shirt ou polo + casquette'], ['Moyenne', '14 × 11 × 6,5 po', 'quart-de-zip ou col rond + t-shirt + casquette'], ['Grande', '16 × 12 × 7,5 po', 'kangourou ou molleton + t-shirt + casquette']], cboxnote: 'Boîte kraft avec votre autocollant logo (boîte imprimée offerte), papier de soie, sceau logo, carte imprimée. Expédiée dans une boîte neutre.', cdoneh: 'C’est noté', cdonep: 'On prépare une boîte pour environ {n} clients{b}. Vous recevrez maquettes et prix à {e} en 1 jour ouvrable. L’épreuve s’approuve en un clic, ou laissez un commentaire pour des changements.', cdonep2: 'Répondez à ce courriel quand vous voulez - il nous arrive directement. Ou appelez au 438-544-3800.', cerr: 'Un problème est survenu - réessayez ou écrivez à sales@singhsprint.com', reorder: 'Même boîte que la commande', each: ' à environ {b} chacune', choose: 'Choisir un fichier'
    }
  };
  var t = T[L];
  var TIERS = [['starter', 'Starter', 'Essentiel', 80, 'product-tshirt-white.jpg'], ['signature', 'Signature', 'Signature', 165, 'product-crewneck-mcgill.jpg'], ['premium', 'Premium', 'Premium', 195, 'product-hoodie-concordia.jpg'], ['custom', 'Custom', 'Sur mesure', null, 'product-hat-artwood.jpg']];
  var TIER_STYLES = { starter: ['ATC1000', '112'], signature: ['L00875', '112', 'ATC1000'], premium: ['FPL-1', '112', 'ATC1000'] };
  function tierName(k) { for (var i = 0; i < TIERS.length; i++) if (TIERS[i][0] === k) return L === 'fr' ? TIERS[i][2] : TIERS[i][1]; return k; }

  function upload(file) {
    var fd = new FormData(); fd.append('file', file); fd.append('kind', 'design');
    return j(API + '/api/inbound/upload', { method: 'POST', body: fd }).then(function (r) {
      if (!r.ok) throw new Error(r.body.error || 'upload failed');
      return r.body;
    });
  }

  /* ================================================================ BUILD */
  var S = { view: 'pick', id: null, k: null, order: null, items: [], recipients: [], coll: [], price: null, step: 1, saving: 'idle', err: null, gear: 0, uploading: false, payKind: 'deposit', paying: false, c: null };
  var app, fork;

  function forkSel(p) { if (!fork) return; Array.prototype.forEach.call(fork.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.getAttribute('data-path') === p); }); }

  function initBuild() {
    app = document.getElementById('gbApp'); fork = document.getElementById('gbFork');
    if (!app) return;
    fork.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-path]'); if (!b) return;
      if (b.getAttribute('data-path') === 'concierge') { setUrl('path=concierge'); openConcierge(); }
      else { if (S.id) { setUrl('d=' + S.id + '&k=' + S.k); S.view = 'draft'; forkSel('self'); render(); } else { setUrl(''); openPick(); } }
    });
    app.addEventListener('click', onClick);
    app.addEventListener('change', onChange);
    app.addEventListener('input', onInput);
    var d = qp('d'), k = qp('k'), tier = qp('tier');
    if (qp('path') === 'concierge') return openConcierge();
    if (d && k) return loadDraft(d, k, Number(qp('step')) || null);
    if (tier) return createDraft(tier);
    openPick();
  }

  function openPick() { S.view = 'pick'; forkSel('self'); render(); }
  function openConcierge() {
    forkSel('concierge');
    if (!S.c) {
      var tier = qp('tier'), budget = 165;
      for (var i = 0; i < TIERS.length; i++) if (TIERS[i][0] === tier && TIERS[i][3]) budget = TIERS[i][3];
      var re = qp('reorder');
      S.c = { budget: budget, custom: '', n: 25, audience: 'past_clients', biz: 'real_estate', color: '#1e3a5f', logoMode: 'subtle', logo: null, uploading: false, notes: re ? t.reorder + ' ' + re.slice(0, 8) + '. ' : '', name: '', company: '', email: '', phone: '', website: '', busy: false, err: null, done: null };
    }
    S.view = 'concierge'; render();
  }

  function createDraft(tier) {
    S.view = 'starting'; forkSel('self'); render();
    jpost(API + '/api/gifts/drafts', { tier: tier || 'custom', lang: L, source_url: location.href }).then(function (r) {
      if (!r.ok || !r.body.id) { S.view = 'pick'; S.err = (r.body && typeof r.body.error === 'string' ? r.body.error : t.cerr); render(); return; }
      lsSet({ id: r.body.id, k: r.body.secret });
      setUrl('d=' + r.body.id + '&k=' + r.body.secret);
      loadDraft(r.body.id, r.body.secret, 1);
    }).catch(function () { S.view = 'pick'; S.err = t.cerr; render(); });
  }

  function draftUrl() { return API + '/api/gifts/drafts/' + encodeURIComponent(S.id) + '?k=' + encodeURIComponent(S.k); }

  function loadDraft(id, k, step) {
    S.id = id; S.k = k; forkSel('self');
    if (S.view !== 'starting') { S.view = 'starting'; render(); }
    Promise.all([j(draftUrl()), j(API + '/api/gifts/collection/public')]).then(function (rs) {
      var a = rs[0], b = rs[1];
      if (!a.ok) { S.view = 'missing'; var ls = lsGet(); if (ls && ls.id === id) lsSet(null); render(); return; }
      S.order = a.body.order; S.items = a.body.items || []; S.recipients = a.body.recipients || []; S.coll = (b.body && b.body.items) || [];
      if (!b.ok) S.err = t.loadfail;
      lsSet({ id: id, k: k });
      if (S.order.path === 'concierge') { S.view = 'handed'; render(); return; }
      if (['draft', 'priced'].indexOf(S.order.status) < 0) { S.view = 'locked'; render(); return; }
      S.step = step || Math.min(4, Math.max(1, S.order.step || 1));
      S.view = 'draft';
      if (S.order.lang !== L) save({ lang: L });
      render(); reprice();
    }).catch(function () { S.view = 'missing'; render(); });
  }

  // --- saving & pricing (debounced, like the CRM builder) ---
  var saveTimer = null, pending = {}, pendingItems = null, savePromise = null;
  function itemPayload(list) { return list.map(function (i) { return { product_id: i.product_id, color_id: i.color_id, placements: i.placements, decoration_method: i.decoration_method, logo_ink: i.logo_ink }; }); }
  function save(patch, nextItems) {
    for (var key in (patch || {})) pending[key] = patch[key];
    if (nextItems) pendingItems = nextItems;
    S.saving = 'saving'; paintStatus();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 400);
  }
  function flush() {
    clearTimeout(saveTimer);
    var body = pending; pending = {};
    if (pendingItems) { body.items = itemPayload(pendingItems); pendingItems = null; }
    if (!Object.keys(body).length) return savePromise || Promise.resolve();
    var hadItems = !!body.items;
    savePromise = jpost(draftUrl(), body, 'PATCH').then(function (r) {
      if (!r.ok) { S.err = typeof r.body.error === 'string' ? r.body.error : 'save failed'; S.saving = 'idle'; render(); return; }
      S.order = r.body.order;
      if (hadItems && r.body.items) {
        // keep display fields the PATCH echo may not carry (brand, style, colour name)
        var local = {}; S.items.forEach(function (x) { local[x.product_id] = x; });
        S.items = r.body.items.map(function (x) { var l = local[x.product_id] || {}; var y = {}; for (var k1 in l) y[k1] = l[k1]; for (var k2 in x) if (x[k2] != null) y[k2] = x[k2]; return y; });
      }
      S.saving = 'saved'; paintStatus();
    }).catch(function () { S.saving = 'idle'; paintStatus(); });
    return savePromise;
  }
  var priceTimer = null;
  function reprice() {
    clearTimeout(priceTimer);
    priceTimer = setTimeout(function () {
      var o = S.order; if (!o) return;
      if (!S.items.length) { S.price = null; paintSummary(); return; }
      jpost(API + '/api/gifts/price', { items: S.items.map(function (i) { return { product_id: i.product_id, color_id: i.color_id, placements: i.placements, decoration_method: i.decoration_method, name: i.name, garment_type: i.garment_type }; }), recipient_count: o.recipient_count, card_mode: o.card_mode, layout: 'clean', delivery_mode: o.delivery_mode, budget_per_recipient: o.budget_per_recipient, session_id: S.id })
        .then(function (r) { S.price = r.body; paintSummary(); if (S.step === 1 || S.step === 4) paintPrices(); });
    }, 350);
  }
  function patchOrder(p, rerender) { for (var key in p) S.order[key] = p[key]; save(p); reprice(); if (rerender !== false) render(); }
  function setItems(next, patch) { S.items = next; save(patch || {}, next); reprice(); render(); }
  function goStep(n) { S.step = n; save({ step: n }); render(); try { window.scrollTo({ top: app.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' }); } catch (e) {} }

  function collBy(pid) { for (var i = 0; i < S.coll.length; i++) if (S.coll[i].product_id === pid) return S.coll[i]; return null; }
  function newItem(c) {
    var g = c.product.garment_type, col = c.product.colors[0] || {};
    return { product_id: c.product_id, color_id: col.color_id || null, placements: [c.default_placement || (isEmbOnly(g) ? 'cap-front' : 'left-chest')], decoration_method: isEmbOnly(g) ? 'embroidery' : (c.default_decoration || 'dtg'), logo_ink: 'match', name: c.product.name, brand: c.product.brand, style_number: c.product.style_number, color_name: col.color_name || null, garment_type: g };
  }
  function toggleItem(pid) {
    var c = collBy(pid); if (!c) return;
    var idx = -1; S.items.forEach(function (i, n) { if (i.product_id === pid) idx = n; });
    if (idx >= 0) return setItems(S.items.filter(function (_, n) { return n !== idx; }));
    if (S.items.length >= 6) { S.err = t.max6; render(); return; }
    setItems(S.items.concat([newItem(c)]));
  }
  function applyTier(tier) {
    var budget = S.order.budget_per_recipient || 125;
    TIERS.forEach(function (x) { if (x[0] === tier && x[3]) budget = x[3]; });
    S.order.tier = tier; S.order.budget_per_recipient = budget;
    if (tier === 'custom') { save({ tier: tier, budget_per_recipient: budget }); reprice(); render(); return; }
    var next = [];
    (TIER_STYLES[tier] || []).forEach(function (s) { S.coll.forEach(function (c) { if (String(c.product.style_number || '').toUpperCase() === s && !next.some(function (n) { return n.product_id === c.product_id; })) next.push(newItem(c)); }); });
    setItems(next, { tier: tier, budget_per_recipient: budget });
  }

  function handToUs() {
    if (!S.order.buyer_email) { S.step = 4; S.err = t.needemail; render(); return; }
    flush();
    jpost(draftUrl(), { hand_to_us: true, step: S.step }, 'PATCH').then(function (r) {
      if (r.ok) { S.view = 'handed'; render(); window.scrollTo(0, 0); } else { S.err = 'could not hand off - email sales@singhsprint.com'; render(); }
    });
  }
  function addRecipients() {
    var ta = app.querySelector('#gbPaste'); var paste = ta ? ta.value : '';
    if (!paste.trim()) return;
    jpost(API + '/api/gifts/drafts/' + encodeURIComponent(S.id) + '/recipients?k=' + encodeURIComponent(S.k), { paste: paste }).then(function (r) {
      if (!r.ok) { S.err = r.body.error || 'could not add'; render(); return; }
      S.recipients = r.body.recipients || [];
      if (S.recipients.length > S.order.recipient_count) patchOrder({ recipient_count: Math.min(MAX, Math.ceil(S.recipients.length / STEP) * STEP) }, false);
      render();
    });
  }
  function removeRecipient(rid) {
    j(API + '/api/gifts/drafts/' + encodeURIComponent(S.id) + '/recipients?k=' + encodeURIComponent(S.k) + '&recipient_id=' + encodeURIComponent(rid), { method: 'DELETE' });
    S.recipients = S.recipients.filter(function (x) { return x.id !== rid; }); render();
  }
  function pay() {
    var o = S.order;
    if (!o.buyer_email || !o.buyer_name) { S.err = t.needemail; render(); return; }
    if (!S.items.length) { S.err = t.empty; render(); return; }
    S.paying = true; S.err = null; render();
    Promise.resolve(flush()).then(function () {
      return jpost(API + '/api/gifts/checkout', { draft_id: S.id, k: S.k, deposit_choice: depositOK() ? S.payKind : 'full', source_url: location.href });
    }).then(function (r) {
      if (!r.ok || !r.body.payment_url) { S.paying = false; S.err = r.body.error || 'could not start checkout'; render(); return; }
      location.href = r.body.payment_url;
    }).catch(function () { S.paying = false; S.err = t.cerr; render(); });
  }
  function depositOK() { return ((S.price && S.price.order && S.price.order.total) || 0) > 1200; }

  // --- events ---
  function onClick(e) {
    var el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    var a = el.getAttribute('data-act'), v = el.getAttribute('data-v');
    if (S.view === 'concierge') return cClick(a, v, el);
    switch (a) {
      case 'tierstart': createDraft(v); break;
      case 'resume': var ls = lsGet(); if (ls) { setUrl('d=' + ls.id + '&k=' + ls.k); loadDraft(ls.id, ls.k); } break;
      case 'step': goStep(Number(v)); break;
      case 'hand': handToUs(); break;
      case 'dismiss': S.err = null; render(); break;
      case 'tier': applyTier(v); break;
      case 'n': patchOrder({ recipient_count: Math.max(MIN, Math.min(MAX, S.order.recipient_count + Number(v) * STEP)) }); break;
      case 'toggle': toggleItem(v); break;
      case 'rmitem': setItems(S.items.filter(function (_, n) { return n !== Number(v); })); break;
      case 'gear': S.gear = Number(v); render(); break;
      case 'mode': patchOrder({ logo_mode: v }); break;
      case 'colour': case 'place': case 'method': case 'ink':
        var it = S.items[S.gear]; if (!it) break;
        var c = collBy(it.product_id);
        var next = S.items.map(function (x, n) {
          if (n !== S.gear) return x; var y = {}; for (var kk in x) y[kk] = x[kk];
          if (a === 'colour') { y.color_id = v; (c ? c.product.colors : []).forEach(function (cc) { if (cc.color_id === v) y.color_name = cc.color_name; }); }
          if (a === 'place') y.placements = [v];
          if (a === 'method') y.decoration_method = v;
          if (a === 'ink') y.logo_ink = v;
          return y;
        });
        setItems(next); break;
      case 'skip': patchOrder({ logo_mode: 'subtle' }, false); goStep(3); break;
      case 'addrec': addRecipients(); break;
      case 'rmrec': removeRecipient(v); break;
      case 'delivery': patchOrder({ delivery_mode: v }); break;
      case 'perscard': patchOrder({ card_mode: S.order.card_mode === 'personalized' ? 'standard' : 'personalized' }); break;
      case 'paykind': S.payKind = v; render(); break;
      case 'pay': pay(); break;
      case 'restart': lsSet(null); S.id = null; setUrl(''); openPick(); break;
    }
  }
  function onChange(e) {
    var el = e.target, f = el.getAttribute('data-f');
    if (S.view === 'concierge') return cChange(e);
    if (el.type === 'file' && el.files && el.files[0]) {
      S.uploading = true; render();
      upload(el.files[0]).then(function (b) { S.uploading = false; S.order.logo_name = el.files[0] && el.files[0].name; patchOrder({ logo_path: b.path }); })
        .catch(function (err) { S.uploading = false; S.err = err.message; render(); });
      return;
    }
    if (!f) return;
    if (f === 'budget') { patchOrder({ budget_per_recipient: Number(el.value), tier: 'custom' }); return; }
    var val = el.value === '' ? null : el.value;
    var p = {}; p[f] = val;
    patchOrder(p, f === 'card_lang' || f === 'default_size' ? true : false);
  }
  function onInput(e) {
    var el = e.target;
    if (S.view === 'concierge') return cInput(e);
    if (el.getAttribute('data-f') === 'budget') { S.order.budget_per_recipient = Number(el.value); var o = app.querySelector('#gbBudgetVal'); if (o) o.textContent = whole(el.value); }
  }

  // --- render ---
  function render() {
    if (!app) return;
    var h = '';
    if (S.view === 'pick') h = vPick();
    else if (S.view === 'starting') h = '<p class="gb-note" style="padding:30px 0">' + t.starting + '</p>';
    else if (S.view === 'missing') h = '<div class="gb-done"><div class="ic">📦</div><h2>' + t.missing + '</h2><p><button class="gx-btn" data-act="restart">' + t.startover + '</button></p></div>';
    else if (S.view === 'handed') h = '<div class="gb-done"><div class="ic">✉️</div><h2>' + t.handed + '</h2><p>' + t.handedp + ' <b>' + esc(S.order && S.order.buyer_email) + '</b>.</p></div>';
    else if (S.view === 'locked') h = '<div class="gb-done"><div class="ic">📦</div><h2>' + t.cantedit + '</h2>' + (S.order && S.order.buyer_token ? '<p><a class="gx-btn" href="' + BASE + '/gifts/order?t=' + encodeURIComponent(S.order.buyer_token) + '">' + t.seeorder + '</a></p>' : '') + '</div>';
    else if (S.view === 'concierge') h = vConcierge();
    else h = vDraft();
    app.innerHTML = h;
  }
  function errBox() { return S.err ? '<div class="gb-err">' + esc(S.err) + ' <button data-act="dismiss" style="background:none;border:none;text-decoration:underline;cursor:pointer;color:inherit;margin-left:8px">×</button></div>' : ''; }

  function vPick() {
    var ls = lsGet();
    var cards = TIERS.map(function (x) {
      return '<button class="gx-tier" data-act="tierstart" data-v="' + x[0] + '" style="text-align:left;cursor:pointer;font:inherit;color:inherit">' +
        '<div class="pics" style="grid-template-columns:1fr"><img src="/images/' + x[4] + '" alt=""></div>' +
        '<div class="body"><h3>' + (L === 'fr' ? x[2] : x[1]) + '</h3><div class="price">' + (x[3] ? (L === 'fr' ? 'environ ' : 'around ') + '<b>' + whole(x[3]) + '</b> / client' : t.customp) + '</div></div></button>';
    }).join('');
    return errBox() + '<h2 class="gb-h">' + t.pickh + '</h2><p class="gb-sub">' + t.pickp + '</p>' +
      (ls && ls.id ? '<p style="margin:-6px 0 16px"><button class="gx-btn sm ghost" data-act="resume">' + t.resume + '</button></p>' : '') +
      '<div class="gx-tiers" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));margin-top:10px">' + cards + '</div>';
  }

  function vDraft() {
    var o = S.order;
    var tabs = t.steps.map(function (s, i) { var n = i + 1; return '<button class="gb-tab' + (S.step === n ? ' on' : '') + (n < S.step ? ' done' : '') + '" data-act="step" data-v="' + n + '"><i>' + n + '</i>' + s + '</button>'; }).join('');
    var body = S.step === 1 ? vS1(o) : S.step === 2 ? vS2(o) : S.step === 3 ? vS3(o) : vS4(o);
    return '<div class="gb-tabs">' + tabs + '</div>' +
      '<div class="gb-status"><span id="gbSaveState">' + saveText() + '</span><button data-act="hand">' + t.hand + '</button></div>' + errBox() +
      '<div class="gb-grid"><div>' + body + '</div><aside class="gb-card gb-sum" id="gbSum">' + vSummary() + '</aside></div>';
  }
  function saveText() { return S.saving === 'saving' ? t.saving : S.saving === 'saved' ? t.saved + ' · ' + t.draft : t.draft; }
  function paintStatus() { var el = app && app.querySelector('#gbSaveState'); if (el) el.textContent = saveText(); }
  function paintSummary() { var el = app && app.querySelector('#gbSum'); if (el) el.innerHTML = vSummary(); }
  function paintPrices() {
    if (!app) return;
    if (S.step === 1) Array.prototype.forEach.call(app.querySelectorAll('[data-price-for]'), function (el) { el.textContent = unitPrice(el.getAttribute('data-price-for')); });
    if (S.step === 4) { var el = app.querySelector('#gbS4'); if (el) el.innerHTML = vS4Inner(S.order); }
  }
  function unitPrice(pid) {
    if (!S.price || !S.price.items) return '';
    for (var i = 0; i < S.items.length; i++) if (S.items[i].product_id === pid && S.price.items[i]) return money(S.price.items[i].unit_price);
    return '';
  }

  function vS1(o) {
    var tiers = TIERS.map(function (x) { return '<button class="gb-chip' + (o.tier === x[0] ? ' on' : '') + '" data-act="tier" data-v="' + x[0] + '">' + (L === 'fr' ? x[2] : x[1]) + '</button>'; }).join('');
    var b = o.budget_per_recipient || 125;
    var vol = S.price && S.price.volume && S.price.volume.discount_pct > 0 && S.price.volume.label ? '<p class="gb-note" style="color:var(--ok);margin-top:8px">' + esc(S.price.volume.label) + '</p>' : '';
    var prods = S.coll.map(function (c) {
      var on = S.items.some(function (i) { return i.product_id === c.product_id; });
      var it = null; S.items.forEach(function (i) { if (i.product_id === c.product_id) it = i; });
      var col = null; c.product.colors.forEach(function (x) { if (it && x.color_id === it.color_id) col = x; }); col = col || c.product.colors[0];
      var img = imgUrl((col && col.mockup_front_url) || c.product.hero_image_url);
      var emb = c.forced_decoration === 'embroidery' || c.default_decoration === 'embroidery' || isEmbOnly(c.product.garment_type);
      return '<div class="gb-prod' + (on ? ' on' : '') + '"><div class="ph"><img src="' + esc(img) + '" alt="' + esc(c.product.name) + '" loading="lazy"></div><div class="bd">' +
        '<div class="br">' + esc(c.product.brand || '') + ' ' + esc(c.product.style_number || '') + '</div><div class="nm">' + esc(c.product.name) + '</div>' +
        '<div class="mt">' + (emb ? t.embroidered : (L === 'fr' ? 'Imprimé' : 'Printed')) + ' · ' + c.product.colors.length + ' ' + t.colours + '</div>' +
        '<div class="ft"><b data-price-for="' + esc(c.product_id) + '">' + unitPrice(c.product_id) + '</b><button class="gx-btn sm' + (on ? '' : ' ghost') + '" data-act="toggle" data-v="' + esc(c.product_id) + '">' + (on ? t.inbox : t.add) + '</button></div></div></div>';
    }).join('');
    return '<h2 class="gb-h">' + t.s1h + '</h2><p class="gb-sub">' + t.s1p + '</p>' +
      '<div class="gb-card"><div class="gb-2" style="gap:24px"><div><span class="gb-lbl">' + t.tier + '</span><div class="gb-chips">' + tiers + '</div>' +
      '<div class="gb-row" style="justify-content:space-between;margin-top:16px"><span class="gb-lbl" style="margin:0">' + t.budget + '</span><b id="gbBudgetVal">' + whole(b) + '</b></div>' +
      '<input type="range" min="60" max="300" step="5" value="' + b + '" data-f="budget" style="width:100%;accent-color:#1a1a1a"></div>' +
      '<div><span class="gb-lbl">' + t.clients + '</span><div class="gb-row"><div class="gb-step"><button data-act="n" data-v="-1">−</button><b>' + o.recipient_count + '</b><button data-act="n" data-v="1">+</button></div><span class="gb-note">' + t.boxes + ' · ' + t.min + '</span></div>' + vol + '</div></div></div>' +
      '<p class="gb-note" style="margin:22px 0 4px">' + t.coll + '</p><div class="gb-prods">' + prods + '</div>' +
      '<div class="gb-nav"><span></span><button class="gx-btn" data-act="step" data-v="2"' + (S.items.length ? '' : ' disabled') + '>' + t.next1 + '</button></div>';
  }

  function vS2(o) {
    var logoName = o.logo_name || (o.logo_path ? String(o.logo_path).split('/').pop() : '');
    var modes = t.modes.map(function (m) { return '<button class="gb-opt' + (o.logo_mode === m[0] ? ' on' : '') + '" data-act="mode" data-v="' + m[0] + '"><b>' + m[1] + '</b>' + m[2] + '</button>'; }).join('');
    var h = '<h2 class="gb-h">' + t.s2h + '</h2><p class="gb-sub">' + t.s2p + '</p>' +
      '<div class="gb-card"><label class="gb-drop"><input type="file" accept=".png,.jpg,.jpeg,.svg,.pdf,.ai"><span class="ic">' + (o.logo_path ? '✓' : '⬆') + '</span><span style="flex:1;font-size:.9rem"><b>' + (S.uploading ? t.uploading : logoName ? esc(logoName) : t.upload) + '</b><br><span class="gb-note">' + t.logohint + '</span></span><span class="gx-btn sm ghost">' + (o.logo_path ? t.replace : t.choose) + '</span></label>' +
      '<div class="gb-warn">' + t.cmyk + '</div><span class="gb-lbl" style="margin-top:18px">' + t.mode + '</span><div class="gb-opts">' + modes + '</div></div>';
    var it = S.items[S.gear] || S.items[0];
    if (it) {
      if (!S.items[S.gear]) S.gear = 0;
      var c = collBy(it.product_id), colours = c ? c.product.colors : [], cur = null;
      colours.forEach(function (x) { if (x.color_id === it.color_id) cur = x; });
      var itabs = S.items.map(function (x, n) { return '<button class="' + (n === S.gear ? 'on' : '') + '" data-act="gear" data-v="' + n + '">' + esc((x.brand || '') + ' ' + (x.style_number || '')) + '</button>'; }).join('');
      var sw = colours.map(function (x) { return '<button class="gb-sw' + (x.color_id === it.color_id ? ' on' : '') + '" title="' + esc(x.color_name) + '" aria-label="' + esc(x.color_name) + '" style="background:' + esc(x.hex_code || '#ccc') + '" data-act="colour" data-v="' + esc(x.color_id) + '"></button>'; }).join('');
      var pl = placementsFor(it.garment_type).map(function (p) { return '<button class="gb-chip' + (it.placements[0] === p[0] ? ' on' : '') + '" data-act="place" data-v="' + p[0] + '">' + (L === 'fr' ? p[2] : p[1]) + '</button>'; }).join('');
      var forced = isEmbOnly(it.garment_type);
      var me = [['dtg', t.printed], ['embroidery', t.embroidered]].map(function (m) { return '<button class="gb-chip' + (it.decoration_method === m[0] ? ' on' : '') + '" data-act="method" data-v="' + m[0] + '"' + (forced && m[0] !== 'embroidery' ? ' disabled' : '') + '>' + m[1] + '</button>'; }).join('');
      var ink = t.inks.map(function (m) { return '<button class="gb-chip' + (it.logo_ink === m[0] ? ' on' : '') + '" data-act="ink" data-v="' + m[0] + '">' + m[1] + '</button>'; }).join('');
      h += '<div class="gb-card"><div class="gb-itabs">' + itabs + '</div><div class="gb-gear"><div class="ph">' +
        (cur && cur.mockup_front_url ? '<img src="' + esc(imgUrl(cur.mockup_front_url)) + '" alt="">' : '<img src="' + esc(imgUrl(c && c.product.hero_image_url)) + '" alt="">') +
        '<small>' + esc(it.color_name || '') + ' · ' + esc(placeLabel(it.placements[0])) + '</small></div>' +
        '<div style="display:grid;gap:16px;align-content:start"><div><span class="gb-lbl">' + t.colour + '</span><div class="gb-swatches">' + sw + '</div><div class="gb-note" style="margin-top:4px">' + esc(it.color_name || '') + '</div></div>' +
        '<div><span class="gb-lbl">' + t.place + '</span><div class="gb-chips">' + pl + '</div></div>' +
        '<div><span class="gb-lbl">' + t.method + '</span><div class="gb-chips">' + me + '</div>' + (forced ? '<div class="gb-note" style="margin-top:4px">' + t.capnote + '</div>' : '') + '</div>' +
        '<div><span class="gb-lbl">' + t.ink + '</span><div class="gb-chips">' + ink + '</div></div><p class="gb-note">' + t.preview + '</p></div></div></div>';
    }
    h += '<p class="gb-note" style="margin-top:14px">' + t.lid + '</p><div class="gb-nav"><button class="gx-btn ghost" data-act="step" data-v="1">' + t.back + '</button><span style="display:flex;gap:8px;flex-wrap:wrap"><button class="gx-btn ghost" data-act="skip">' + t.skip + '</button><button class="gx-btn" data-act="step" data-v="3">' + t.next2 + '</button></span></div>';
    return h;
  }

  function vS3(o) {
    var recs = S.recipients.map(function (r) { return '<li><span><b>' + esc(r.name) + '</b> <span class="gb-note">' + esc(r.email || t.noemail) + '</span></span><button data-act="rmrec" data-v="' + esc(r.id) + '" aria-label="remove">✕</button></li>'; }).join('');
    var dl = [['ship_each', t.d1], ['deliver_to_me', t.d2]].map(function (d) { return '<button class="gb-opt' + (o.delivery_mode === d[0] ? ' on' : '') + '" data-act="delivery" data-v="' + d[0] + '"><b>' + d[1][0] + '</b>' + d[1][1] + '</button>'; }).join('');
    var sizes = ['S', 'M', 'L', 'XL', '2XL'].map(function (s) { return '<option' + (o.default_size === s ? ' selected' : '') + '>' + s + '</option>'; }).join('');
    var cl = ['en', 'fr', 'both'].map(function (x) { return '<option value="' + x + '"' + (o.card_lang === x ? ' selected' : '') + '>' + t.cardlang[x] + '</option>'; }).join('');
    var up = (S.price && S.price.per_recipient && S.price.per_recipient.card_upgrade) || 4;
    return '<h2 class="gb-h">' + t.s3h + '</h2><p class="gb-sub">' + t.s3p + '</p><div class="gb-2" style="gap:14px;align-items:start">' +
      '<div class="gb-card"><textarea class="gb-fld" id="gbPaste" style="min-height:130px;font-family:ui-monospace,monospace;font-size:.8rem" placeholder="' + esc(t.paste) + '"></textarea>' +
      '<button class="gx-btn sm ghost" style="margin-top:8px" data-act="addrec">' + t.addthese + '</button>' +
      '<p class="gb-note" style="margin-top:12px"><b>' + S.recipients.length + '</b> / ' + o.recipient_count + ' ' + t.listed + (S.recipients.length < o.recipient_count ? ' · ' + (o.recipient_count - S.recipients.length) + ' ' + t.togo : '') + '</p>' +
      (recs ? '<ul class="gb-recs">' + recs + '</ul>' : '') + '</div>' +
      '<div><div class="gb-card"><span class="gb-lbl">' + t.delivery + '</span><div class="gb-opts two">' + dl + '</div>' +
      '<p class="gb-note" style="margin-top:12px">' + t.noanswer + ' <select data-f="default_size" class="gb-fld" style="width:auto;display:inline-block;padding:3px 6px">' + sizes + '</select> ' + t.after + '</p></div>' +
      '<div class="gb-card"><span class="gb-lbl">' + t.card + '</span><textarea class="gb-fld" data-f="card_text" maxlength="600" placeholder="' + esc(t.cardph) + '">' + esc(o.card_text || '') + '</textarea>' +
      '<div class="gb-2" style="margin-top:8px"><input class="gb-fld" data-f="card_signer" placeholder="' + esc(t.signer) + '" value="' + esc(o.card_signer || '') + '"><select class="gb-fld" data-f="card_lang">' + cl + '</select></div>' +
      '<div class="gb-tog' + (o.card_mode === 'personalized' ? ' on' : '') + '" data-act="perscard" role="switch" aria-checked="' + (o.card_mode === 'personalized') + '"><span class="sw"></span><span>' + t.pers + ' <b>+' + money(up) + ' / ' + t.perbox + '</b></span></div></div></div></div>' +
      '<div class="gb-nav"><button class="gx-btn ghost" data-act="step" data-v="2">' + t.back + '</button><button class="gx-btn" data-act="step" data-v="4">' + t.next3 + '</button></div>';
  }

  function boxSize(s) { return s === 'S' ? t.sizeS : s === 'L' ? t.sizeL : t.sizeM; }
  function vS4(o) {
    var fl = function (f, ph, type) { return '<input class="gb-fld" data-f="' + f + '" type="' + (type || 'text') + '" placeholder="' + esc(ph) + '" value="' + esc(o[f] || '') + '">'; };
    return '<h2 class="gb-h">' + t.s4h + '</h2><p class="gb-sub">' + t.s4p + '</p><div class="gb-2" style="gap:14px;align-items:start"><div>' +
      '<div class="gb-card"><span class="gb-lbl">' + t.you + '</span><div class="gb-2">' + fl('buyer_name', t.name) + fl('buyer_company', t.company) + fl('buyer_email', t.email, 'email') + fl('buyer_phone', t.phone, 'tel') + '</div></div>' +
      '</div><div id="gbS4">' + vS4Inner(o) + '</div></div><div class="gb-nav"><button class="gx-btn ghost" data-act="step" data-v="3">' + t.back + '</button></div>';
  }
  function vS4Inner(o) {
    var p = S.price, n = o.recipient_count, ok = p && p.ok;
    var items = S.items.map(function (it, i) { return '<div class="gb-line"><span>' + esc((it.brand || '') + ' ' + (it.style_number || '')) + ' <span class="gb-mute">· ' + esc(it.color_name || '') + ' · ' + esc(placeLabel(it.placements[0])) + '</span></span><b>' + (p && p.items && p.items[i] ? money(p.items[i].unit_price) : '') + '</b></div>'; }).join('');
    var tot = ok ? '<div class="gb-lines">' +
      '<div class="gb-line"><span>' + S.items.length + ' ' + t.pieces + ' × ' + n + '</span><span>' + money(p.per_recipient.pieces * n) + '</span></div>' +
      '<div class="gb-line"><span>' + t.boxline + (o.delivery_mode === 'ship_each' ? t.ship : '') + ' × ' + n + '</span><span>' + money(p.per_recipient.box_line * n) + '</span></div>' +
      (p.per_recipient.card_upgrade > 0 ? '<div class="gb-line"><span>' + t.perscard + ' × ' + n + '</span><span>' + money(p.per_recipient.card_upgrade * n) + '</span></div>' : '') +
      (p.order.discount > 0 ? '<div class="gb-line"><span>' + t.vol + ' ' + p.volume.discount_pct + '%</span><span>−' + money(p.order.discount) + '</span></div>' : '') +
      (p.order.setup_fee > 0 ? '<div class="gb-line"><span>' + t.setup + '</span><span>' + money(p.order.setup_fee) + '</span></div>' : '') +
      '<div class="gb-line gb-mute"><span>' + t.tax + '</span><span>' + money(p.order.tax) + '</span></div><hr class="gb-hr" style="margin:6px 0"><div class="gb-line gb-tot"><span>' + t.total + '</span><span>' + money(p.order.total) + '</span></div></div>'
      : '<p class="gb-note" style="margin-top:8px">' + esc((p && p.error) || t.empty) + '</p>';
    var dep = depositOK(), kind = dep ? S.payKind : 'full';
    return '<div class="gb-card"><span class="gb-lbl">' + t.yourbox + '</span><div class="gb-lines">' + items + '</div><p class="gb-note">' + (p ? boxSize(p.box_size) + ' ' + t.box + ' · ' : '') + (o.delivery_mode === 'ship_each' ? t.d1[0] : t.d2[0]) + ' · ' + S.recipients.length + ' ' + t.listed + ' · ' + (o.card_mode === 'personalized' ? t.perscard : t.stdcard) + '</p></div>' +
      '<div class="gb-card"><span class="gb-lbl">' + t.totals + '</span>' + tot + '</div>' +
      '<div class="gb-card"><span class="gb-lbl">' + t.pay + '</span><div class="gb-pay">' +
      '<button data-act="paykind" data-v="deposit" class="' + (kind === 'deposit' ? 'on' : '') + '"' + (dep ? '' : ' disabled') + '><small>' + t.dep + '</small><b>' + (ok ? money(p.order.total / 2) : '—') + '</b><small>' + t.depsub + '</small></button>' +
      '<button data-act="paykind" data-v="full" class="' + (kind === 'full' ? 'on' : '') + '"><small>' + t.full + '</small><b>' + (ok ? money(p.order.total) : '—') + '</b><small>' + t.fullsub + '</small></button></div>' +
      '<div class="gb-okbox" style="margin-top:12px">✓ ' + t.promise + '</div>' +
      '<button class="gx-btn hi" style="width:100%;margin-top:12px;padding:16px" data-act="pay"' + (S.paying || !ok ? ' disabled' : '') + '>' + (S.paying ? t.paying : t.paybtn) + '</button>' +
      '<p class="gb-note" style="text-align:center;margin-top:8px">' + t.secure + '</p></div>';
  }

  function vSummary() {
    var o = S.order; if (!o) return '';
    var p = S.price, ok = p && p.ok, b = o.budget_per_recipient;
    var h = '<span class="gb-lbl">' + t.per + '</span><div class="big">' + (ok ? money(p.per_recipient.subtotal) : money(0)) + '</div>';
    if (b != null && ok) {
      var over = p.per_recipient.subtotal > b;
      h += '<div class="gb-bar' + (over ? ' over' : '') + '"><i style="width:' + Math.min(100, p.per_recipient.subtotal / b * 100) + '%"></i></div>' +
        '<div class="gb-line gb-note" style="margin-top:5px"><span>' + t.budget + ' ' + whole(b) + '</span><span style="color:' + (over ? 'var(--bad)' : 'var(--ok)') + '">' + whole(Math.abs(p.per_recipient.subtotal - b)) + ' ' + (over ? t.over : t.under) + '</span></div>';
    }
    h += '<hr class="gb-hr"><div class="gb-lines">';
    S.items.forEach(function (it, i) { h += '<div class="gb-line pc"><span><b>' + esc((it.brand || '') + ' ' + (it.style_number || '')) + '</b><small>' + esc(it.color_name || '') + ' · ' + (it.decoration_method === 'embroidery' ? t.embroidered : t.printed) + '</small></span><span>' + (p && p.items && p.items[i] ? money(p.items[i].unit_price) : '') + '<button data-act="rmitem" data-v="' + i + '" aria-label="remove">✕</button></span></div>'; });
    if (!S.items.length) h += '<div class="gb-note">' + t.empty + '</div>';
    if (ok) h += '<div class="gb-line gb-mute" style="padding:0 9px"><span>' + t.boxline + (o.delivery_mode === 'ship_each' ? t.ship : '') + '</span><span>' + money(p.per_recipient.box_line) + '</span></div>';
    if (ok && p.per_recipient.card_upgrade > 0) h += '<div class="gb-line gb-mute" style="padding:0 9px"><span>' + t.perscard + '</span><span>+' + money(p.per_recipient.card_upgrade) + '</span></div>';
    h += '</div>';
    if (ok) h += '<hr class="gb-hr"><div class="gb-lines"><div class="gb-line"><span>' + o.recipient_count + ' ' + t.boxes + '</span><span>' + money(p.order.subtotal) + '</span></div>' +
      (p.order.discount > 0 ? '<div class="gb-line gb-mute"><span>' + t.vol + ' ' + p.volume.discount_pct + '%</span><span>−' + money(p.order.discount) + '</span></div>' : '') +
      '<div class="gb-line gb-mute"><span>' + t.tax + '</span><span>' + money(p.order.tax) + '</span></div><div class="gb-line gb-tot"><span>' + t.ordertotal + '</span><span>' + money(p.order.total) + '</span></div></div>';
    if (p && p.warnings && p.warnings.length) h += '<p class="gb-warn"><b>' + t.warn + ':</b> ' + p.warnings.map(esc).join(' · ') + '</p>';
    return h;
  }

  /* ---------------------------------------------------------- concierge */
  var COLORS = ['#1e3a5f', '#1a1a1a', '#1f4d33', '#5c1a2a', '#c8102e', '#e8ff3c'];
  function vConcierge() {
    var c = S.c;
    if (c.done) {
      var bb = c.budget ? t.each.replace('{b}', whole(c.budget)) : '';
      return '<div class="gb-done"><div class="ic">✉️</div><h2>' + t.cdoneh + ', ' + esc(c.done.name) + '.</h2><p>' + t.cdonep.replace('{n}', c.n).replace('{b}', bb).replace('{e}', '<b>' + esc(c.done.email) + '</b>') + '</p><p class="gb-note" style="margin-top:10px">' + t.cdonep2 + '</p></div>';
    }
    var chip = function (act, v, on, l) { return '<button type="button" class="gb-chip' + (on ? ' on' : '') + '" data-act="' + act + '" data-v="' + esc(v) + '">' + l + '</button>'; };
    var budgets = t.cbudgets.map(function (x) { return chip('cbudget', x[0], c.budget === x[0], x[1]); }).join('');
    var who = t.cwhos.map(function (x) { return chip('caud', x[0], c.audience === x[0], x[1]); }).join('');
    var biz = t.cbizs.map(function (x) { return chip('cbiz', x[0], c.biz === x[0], x[1]); }).join('');
    var sw = COLORS.map(function (x) { return '<button type="button" class="gb-sw' + (c.color === x ? ' on' : '') + '" style="background:' + x + '" aria-label="' + x + '" data-act="ccolor" data-v="' + x + '"></button>'; }).join('');
    var modes = t.modes.map(function (m) { return '<button type="button" class="gb-opt' + (c.logoMode === m[0] ? ' on' : '') + '" data-act="cmode" data-v="' + m[0] + '"><b>' + m[1] + '</b>' + m[2] + '</button>'; }).join('');
    var f = function (k, ph, type, req) { return '<input class="gb-fld" data-c="' + k + '" type="' + (type || 'text') + '" placeholder="' + esc(ph) + '" value="' + esc(c[k]) + '"' + (req ? ' required' : '') + '>'; };
    var gets = t.cgets.map(function (x) { return '<li>' + x + '</li>'; }).join('');
    var boxes = t.cboxes.map(function (x) { return '<div><b>' + x[0] + '</b><span class="gb-mute">' + x[1] + '</span><span class="gb-mute" style="font-size:.75rem">' + x[2] + '</span></div>'; }).join('');
    return '<div class="gb-grid"><form id="gbCForm" novalidate>' +
      '<h2 class="gb-h">' + t.ch + '</h2><p class="gb-sub">' + t.cp + '</p>' +
      '<div class="gb-card"><span class="gb-lbl">' + t.cbudget + '</span><div class="gb-chips">' + budgets + '</div>' +
      (c.budget === 0 ? '<input class="gb-fld" style="margin-top:10px;max-width:220px" inputmode="numeric" data-c="custom" placeholder="' + esc(t.cbph) + '" value="' + esc(c.custom) + '">' : '') +
      '<div class="gb-row" style="margin-top:16px"><span class="gb-note">' + t.clients + '</span><div class="gb-step"><button type="button" data-act="cn" data-v="-1">−</button><b>' + c.n + '</b><button type="button" data-act="cn" data-v="1">+</button></div><span class="gb-note">min ' + MIN + '</span></div></div>' +
      '<div class="gb-card"><span class="gb-lbl">' + t.cwho + '</span><div class="gb-chips">' + who + '</div><span class="gb-lbl" style="margin-top:16px">' + t.cbiz + '</span><div class="gb-chips">' + biz + '</div></div>' +
      '<div class="gb-card"><span class="gb-lbl">' + t.clogo + '</span><label class="gb-drop"><input type="file" accept=".png,.jpg,.jpeg,.svg,.pdf,.ai"><span class="ic">' + (c.logo ? '✓' : '⬆') + '</span><span style="flex:1;font-size:.9rem"><b>' + (c.uploading ? t.uploading : c.logo ? esc(c.logo.name) : t.upload) + '</b><br><span class="gb-note">' + t.logohint + '</span></span><span class="gx-btn sm ghost">' + (c.logo ? t.replace : t.choose) + '</span></label>' +
      '<div class="gb-row" style="margin-top:14px"><span class="gb-note">' + t.cbrand + '</span><div class="gb-swatches">' + sw + '</div><button type="button" class="gb-note" style="background:none;border:none;text-decoration:underline;cursor:pointer" data-act="ccolor" data-v="">' + (c.color ? t.cmatch : t.cmatched) + '</button></div>' +
      '<span class="gb-lbl" style="margin-top:16px">' + t.cgear + '</span><div class="gb-opts">' + modes + '</div></div>' +
      '<div class="gb-card"><span class="gb-lbl">' + t.cnotes + ' <small>' + t.optional + '</small></span><textarea class="gb-fld" data-c="notes" maxlength="2000" placeholder="' + esc(t.cnotesph) + '">' + esc(c.notes) + '</textarea></div>' +
      '<div class="gb-card"><span class="gb-lbl">' + t.csend + '</span><div class="gb-2">' + f('name', t.name, 'text', 1) + f('company', t.company) + f('email', t.email, 'email', 1) + f('phone', t.phone, 'tel') + '</div>' +
      '<div class="gb-hp" aria-hidden="true"><input tabindex="-1" autocomplete="off" data-c="website" value=""></div></div>' +
      (c.err ? '<div class="gb-err">' + esc(c.err) + '</div>' : '') +
      '<button type="button" class="gx-btn hi" style="width:100%;padding:17px;font-size:1rem" data-act="csubmit"' + (c.busy || c.uploading ? ' disabled' : '') + '>' + (c.busy ? t.cbusy : t.cbtn) + '</button>' +
      '<p class="gb-note" style="text-align:center;margin-top:10px">' + t.cfine + '</p></form>' +
      '<aside class="gb-card gb-sum gb-side-box"><span class="gb-lbl">' + t.cget + '</span><ol>' + gets + '</ol><hr class="gb-hr"><span class="gb-lbl">' + t.cbox + '</span><div class="gb-sizes">' + boxes + '</div><p class="gb-note" style="margin-top:10px">' + t.cboxnote + '</p></aside></div>';
  }
  function cClick(a, v) {
    var c = S.c;
    switch (a) {
      case 'cbudget': c.budget = Number(v); break;
      case 'caud': c.audience = v; break;
      case 'cbiz': c.biz = v; break;
      case 'ccolor': c.color = v || null; break;
      case 'cmode': c.logoMode = v; break;
      case 'cn': c.n = Math.max(MIN, Math.min(MAX, c.n + Number(v) * STEP)); break;
      case 'csubmit': return cSubmit();
      default: return;
    }
    render();
  }
  function cInput(e) { var k = e.target.getAttribute('data-c'); if (k) S.c[k] = e.target.value; }
  function cChange(e) {
    var el = e.target;
    if (el.type === 'file' && el.files && el.files[0]) {
      var file = el.files[0]; S.c.uploading = true; S.c.err = null; render();
      upload(file).then(function (b) { S.c.uploading = false; S.c.logo = { path: b.path, signed_url: b.signed_url, mime: b.mime, bytes: b.bytes, name: file.name }; render(); })
        .catch(function (err) { S.c.uploading = false; S.c.err = err.message; render(); });
    }
  }
  function cSubmit() {
    var c = S.c;
    if (c.busy) return;
    if (!c.name.trim() || !/^\S+@\S+\.\S+$/.test(c.email.trim())) { c.err = t.needemail; render(); return; }
    c.busy = true; c.err = null; render();
    var budget = c.budget === 0 ? (Number(c.custom) || null) : c.budget;
    jpost(API + '/api/gifts/request', {
      budget_per_recipient: budget, recipient_count: c.n, audience: c.audience, business_type: c.biz,
      brand_color: c.color || undefined, logo_mode: c.logoMode,
      logo: c.logo ? { path: c.logo.path, signed_url: c.logo.signed_url, mime: c.logo.mime, bytes: c.logo.bytes } : null,
      notes: c.notes || undefined, contact_name: c.name, company: c.company || undefined, email: c.email.trim(), phone: c.phone || undefined,
      lang: L, source_url: location.href, website: c.website
    }).then(function (r) {
      c.busy = false;
      if (!r.ok) { c.err = typeof r.body.error === 'string' ? r.body.error : t.cerr; render(); return; }
      c.done = { email: c.email.trim(), name: c.name.split(' ')[0] }; c.budget = budget;
      render(); window.scrollTo(0, 0);
      try { if (window.gtag) gtag('event', 'generate_lead', { form: 'gift_box_concierge' }); } catch (e) {}
    }).catch(function () { c.busy = false; c.err = t.cerr; render(); });
  }

  /* ================================================================ ORDER */
  var O = {
    en: { order: 'Order', h1: 'Your gift boxes', paid: "Payment received - thank you. Mockups of the gear and the box are coming within 1 business day.", onit: "We're on it.", onitp: 'Mockups of the gear and the box, the per-client price and a deposit link are coming to your inbox within 1 business day.', boxes: 'boxes', sizesin: 'sizes in', waiting: 'waiting on a size', notans: 'not answered', shipped: 'shipped', collecting: 'collecting sizes', client: 'Client', sizes: 'Sizes', status: 'Status', tracking: 'Tracking', afterShip: 'after ship', nolist: "Your client list will show here once it's in.", box: 'The box', nopieces: "Pieces will show here once we've picked them with you.", bulk: 'delivered to you in bulk', each: 'shipped to each client', cutoff: 'size cutoff', def: 'default', balance: 'Balance', total: 'Order total', paidl: 'Paid', due: 'Due when it ships', next: 'Next season', nextp: 'Your box and client list are saved. Reorder with a new list or the same one.', same: 'Same box as last time →', q: 'Questions? Reply to any email from us, or call 438-544-3800.', bad: "This link isn't valid.",
      groups: ['Requested', 'Paid', 'Mockups', 'Approved', 'Sizes', 'Production', 'Shipped'], st: { pending: 'Link not sent yet', sent: 'Link sent', opened: 'Opened, no size yet', done: 'Size in · address ok', defaulted: 'No answer · default size', declined: 'Declined' } },
    fr: { order: 'Commande', h1: 'Vos boîtes-cadeaux', paid: 'Paiement reçu - merci. Les maquettes des vêtements et de la boîte arrivent en 1 jour ouvrable.', onit: 'On s’en occupe.', onitp: 'Maquettes des vêtements et de la boîte, prix par client et lien de dépôt arrivent dans votre boîte courriel en 1 jour ouvrable.', boxes: 'boîtes', sizesin: 'tailles reçues', waiting: 'en attente d’une taille', notans: 'sans réponse', shipped: 'expédiées', collecting: 'collecte des tailles', client: 'Client', sizes: 'Tailles', status: 'Statut', tracking: 'Suivi', afterShip: 'à l’envoi', nolist: 'Votre liste de clients apparaîtra ici.', box: 'La boîte', nopieces: 'Les morceaux apparaîtront ici une fois choisis avec vous.', bulk: 'livrée chez vous en lot', each: 'expédiée à chaque client', cutoff: 'date limite des tailles', def: 'par défaut', balance: 'Solde', total: 'Total de la commande', paidl: 'Payé', due: 'Dû à l’expédition', next: 'La saison prochaine', nextp: 'Votre boîte et votre liste sont enregistrées. Recommandez avec une nouvelle liste ou la même.', same: 'Même boîte que la dernière fois →', q: 'Des questions? Répondez à n’importe lequel de nos courriels, ou appelez au 438-544-3800.', bad: 'Ce lien n’est pas valide.',
      groups: ['Demandée', 'Payée', 'Maquettes', 'Approuvée', 'Tailles', 'Production', 'Expédiée'], st: { pending: 'Lien pas encore envoyé', sent: 'Lien envoyé', opened: 'Ouvert, sans taille', done: 'Taille reçue · adresse ok', defaulted: 'Sans réponse · taille par défaut', declined: 'Refusé' } }
  }[L];
  var GROUPS = [['draft', 'quote_requested', 'priced', 'changes_requested'], ['paid'], ['mockups', 'awaiting_approval'], ['approved'], ['size_links_sent', 'sizes_locked'], ['blanks_ordered', 'box_file_ready', 'box_ordered', 'decorating', 'packing'], ['shipped', 'closed']];

  function initOrder() {
    var el = document.getElementById('goApp'); if (!el) return;
    var tok = qp('t');
    if (!tok) { el.innerHTML = '<div class="gb-done"><h2>' + O.bad + '</h2></div>'; return; }
    j(API + '/api/gifts/o/' + encodeURIComponent(tok)).then(function (r) {
      if (!r.ok) { el.innerHTML = '<div class="gb-done"><h2>' + O.bad + '</h2></div>'; return; }
      if (qp('paid')) { var ls = lsGet(); if (ls) lsSet(null); }
      el.innerHTML = vOrder(r.body, tok);
    }).catch(function () { el.innerHTML = '<div class="gb-done"><h2>' + O.bad + '</h2></div>'; });
  }
  function vOrder(d, tok) {
    var o = d.order, cn = d.counts || {};
    var gi = -1; GROUPS.forEach(function (g, i) { if (g.indexOf(o.status) >= 0) gi = i; });
    var collecting = o.status === 'size_links_sent';
    var dloc = L === 'fr' ? 'fr-CA' : 'en-CA';
    var cutoff = o.cutoff ? new Date(o.cutoff).toLocaleDateString(dloc, { month: 'long', day: 'numeric' }) : null;
    var bars = GROUPS.map(function (_, i) { return '<i class="' + (i < gi ? 'past' : i === gi ? 'now' : '') + '"></i>'; }).join('');
    var lbls = O.groups.map(function (g) { return '<span>' + g + '</span>'; }).join('');
    var kpis = [[cn.total || o.recipient_count, O.boxes], [cn.done || 0, O.sizesin], [(cn.opened || 0) + (cn.sent || 0), collecting ? O.waiting : O.notans], [cn.shipped || 0, O.shipped]].map(function (k) { return '<div><b>' + k[0] + '</b><span>' + k[1] + '</span></div>'; }).join('');
    var rows = (d.recipients || []).map(function (r) {
      return '<tr><td><b>' + esc(r.name) + '</b>' + (r.city ? '<div class="gb-note">' + esc(r.city) + '</div>' : '') + '</td><td>' + (r.sizes && r.sizes.some(Boolean) ? r.sizes.map(function (s) { return esc(s || '—'); }).join(' / ') : '<span class="gb-mute">—</span>') + '</td>' +
        '<td><span class="go-pill ' + esc(r.status) + '">' + esc(O.st[r.status] || r.status) + '</span></td><td style="font-size:.8rem">' +
        (r.tracking_number ? '<a style="text-decoration:underline" target="_blank" rel="noreferrer" href="https://www.canadapost-postescanada.ca/track-reperage/' + L + '#/search?searchFor=' + encodeURIComponent(r.tracking_number) + '">' + esc(r.tracking_number) + '</a>' : '<span class="gb-mute">' + O.afterShip + '</span>') + '</td></tr>';
    }).join('');
    var items = (d.items || []).map(function (it) { return '<div class="go-item">' + (it.mockup ? '<img src="' + esc(it.mockup) + '" alt="">' : '<span class="ph"></span>') + '<span>' + esc(it.name) + (it.color_name ? '<span class="gb-mute"> · ' + esc(it.color_name) + '</span>' : '') + '</span></div>'; }).join('');
    var mocks = (d.mockups || []).map(function (m) { return '<a href="' + esc(m.url) + '" target="_blank" rel="noreferrer"><img src="' + esc(m.url) + '" alt="' + esc(m.label || '') + '"></a>'; }).join('');
    var mo = o.money || {};
    var paidOn = mo.deposit_paid_at ? ' ' + new Date(mo.deposit_paid_at).toLocaleDateString(dloc) : '';
    return '<header class="gb-head"><div class="gb-crumb"><a href="' + BASE + '/gifts">' + (L === 'fr' ? 'Boîtes-cadeaux' : 'Gift boxes') + '</a> / ' + O.order + ' ' + esc(o.ref) + (o.company || o.buyer ? ' · ' + esc(o.company || o.buyer) : '') + '</div>' +
      '<div class="gb-row" style="justify-content:space-between"><h1>' + O.h1 + '</h1><span class="go-pill done" style="font-weight:600">' + (collecting ? O.collecting : (O.groups[gi] || esc(o.status))) + '</span></div>' +
      '<div class="go-stages">' + bars + '</div><div class="go-stl">' + lbls + '</div></header>' +
      (qp('paid') ? '<div class="gb-okbox" style="margin-top:14px">✓ ' + O.paid + '</div>' : '') +
      (o.status === 'quote_requested' ? '<div class="gb-warn" style="font-size:.9rem;padding:14px 16px;margin-top:14px"><b>' + O.onit + '</b> ' + O.onitp + '</div>' : '') +
      '<div class="go-kpis">' + kpis + '</div>' +
      '<div class="gb-grid"><div class="gb-card" style="padding:0;overflow:hidden">' + (rows ? '<table class="go-tbl"><thead><tr><th>' + O.client + '</th><th>' + O.sizes + '</th><th>' + O.status + '</th><th>' + O.tracking + '</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p class="gb-note" style="padding:20px">' + O.nolist + '</p>') + '</div>' +
      '<div><div class="gb-card"><span class="gb-lbl">' + O.box + '</span>' + (items || '<p class="gb-note">' + O.nopieces + '</p>') + (mocks ? '<div class="go-thumbs">' + mocks + '</div>' : '') +
      '<p class="gb-note" style="margin-top:10px">' + (o.box_size ? boxSize(o.box_size) + ' ' + t.box + ' · ' : '') + (o.delivery_mode === 'deliver_to_me' ? O.bulk : O.each) + (cutoff && collecting ? ' · ' + O.cutoff + ' ' + cutoff + ' (' + O.def + ' ' + esc(o.default_size) + ')' : '') + '</p></div>' +
      '<div class="gb-card"><span class="gb-lbl">' + O.balance + '</span><div class="gb-lines"><div class="gb-line"><span>' + O.total + '</span><b>' + money(mo.total) + '</b></div><div class="gb-line"><span>' + O.paidl + paidOn + '</span><b>' + money(mo.paid) + '</b></div>' +
      (mo.total != null && mo.paid != null ? '<div class="gb-line"><span>' + O.due + '</span><b>' + money(Math.max(0, mo.total - mo.paid)) + '</b></div>' : '') + '</div></div>' +
      '<div class="gb-card"><span class="gb-lbl">' + O.next + '</span><p style="font-size:.9rem;margin-bottom:10px">' + O.nextp + '</p><a class="gx-btn sm ghost" href="' + BASE + '/gifts/build?path=concierge&reorder=' + encodeURIComponent(tok) + '">' + O.same + '</a></div>' +
      '<p class="gb-note">' + O.q + '</p></div></div>';
  }

  function boot() { if (PAGE === 'build') initBuild(); else if (PAGE === 'order') initOrder(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
