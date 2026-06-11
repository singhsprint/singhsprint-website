// Extracted from jerseys.html (was the main inline <script> block). Loaded with
// defer; shared by the EN page and its /fr/ mirror so it is parsed from cache.
(function(){
    'use strict';
    var API   = 'https://singhsprint-crm.vercel.app/api/catalog';
    var IMAGE_PROXY   = 'https://singhsprint-crm.vercel.app/api/image-proxy';
    var PROXIED_HOSTS = ['ssactivewear.com','blanks.ca','sanmarcanada.com'];
    var SPORTS = ['hockey','soccer','basketball','baseball','football','volleyball'];

    // Tiny i18n shim — uses SP_LANG when present, else the inline fallback.
    function t(key, fallback){
      try { if (window.SP_LANG && SP_LANG.t){ var v = SP_LANG.t(key); if (v) return v; } } catch(e){}
      return fallback;
    }
    function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
    function qp(name){ try { return new URLSearchParams(location.search).get(name); } catch(e){ return null; } }
    function imgUrl(raw){
      if (!raw) return '/images/product-tshirt-white.jpg';
      if (raw.charAt(0)==='/' || raw.indexOf('singhsprint.com')>=0) return raw;
      for (var i=0;i<PROXIED_HOSTS.length;i++){ if (raw.indexOf(PROXIED_HOSTS[i])>=0) return IMAGE_PROXY + '?url=' + encodeURIComponent(raw); }
      return raw;
    }

    // ---- Shared cart (same sessionStorage module as catalog.html / quote.html)
    // Abandonment recovery: same stable cart_id + debounced /api/carts/upsert
    // sync as catalog.html, so jersey-only carts are visible to the daily
    // recovery sweeper too (previously this page never synced).
    function getCartId(){
      var k = 'singhsCartId_v1';
      var existing = null;
      try { existing = localStorage.getItem(k); } catch(e){}
      if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
      var id = '';
      try {
        if (window.crypto && crypto.randomUUID) id = crypto.randomUUID().replace(/-/g, '');
      } catch(e){}
      if (!id) id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      try { localStorage.setItem(k, id); } catch(e){}
      return id;
    }
    var SINGHS_CART_ID = getCartId();
    var _cartSyncTimer = null;
    function queueCartSync(){
      if (_cartSyncTimer) clearTimeout(_cartSyncTimer);
      _cartSyncTimer = setTimeout(function(){
        try {
          var c = JSON.parse(sessionStorage.getItem('singhsCart_v1') || '{"items":[]}');
          fetch('https://singhsprint-crm.vercel.app/api/carts/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart_id: SINGHS_CART_ID, items: c.items || [], source_url: location.href }),
            keepalive: true
          }).catch(function(){});
        } catch(e){}
      }, 800);
    }
    var SinghsCart = {
      key: 'singhsCart_v1',
      read: function(){ try { return JSON.parse(sessionStorage.getItem(this.key) || '{"items":[]}'); } catch(e){ return {items:[]}; } },
      write: function(c){ try { sessionStorage.setItem(this.key, JSON.stringify(c)); } catch(e){} queueCartSync(); try { window.dispatchEvent(new Event('singhsCartChange')); } catch(e){} },
      add: function(item){ var c=this.read(); c.items.push(item); this.write(c); },
      count: function(){ return this.read().items.length; }
    };

    // ---- Sport icons (line-art, inherit currentColor)
    var SICON = {
      hockey:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 5v9c0 3 3 5 8 5s8-2 8-5V5"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/></svg>',
      soccer:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7l4 3-1.5 5h-5L8 10z"/></svg>',
      basketball:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5 5c4 3 4 11 0 14M19 5c-4 3-4 11 0 14"/></svg>',
      baseball:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M6 6c2 2 2 10 0 12M18 6c-2 2-2 10 0 12"/></svg>',
      football:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7z"/><path d="M9 12h6M12 10v4"/></svg>',
      volleyball:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 3c3 4 3 14-4 17M21 10c-5 1-13-2-15-7"/></svg>'
    };

    // ---- Fonts offered for the jersey lettering (single team font).
    // ALL are Google Fonts (open-source SIL OFL) — downloadable for print so
    // the shop reproduces the exact lettering, nothing proprietary/site-only.
    // `google` = the real font family name to download from fonts.google.com.
    var FONTS = [
      { id:'anton',   label:'Block',     css:"'Anton',sans-serif",           google:'Anton' },
      { id:'oswald',  label:'Condensed', css:"'Oswald',sans-serif",          google:'Oswald' },
      { id:'saira',   label:'Athletic',  css:"'Saira Condensed',sans-serif", google:'Saira Condensed' },
      { id:'archivo', label:'Heavy',     css:"'Archivo Black',sans-serif",   google:'Archivo Black' },
      { id:'teko',    label:'Tall',      css:"'Teko',sans-serif",            google:'Teko' }
    ];
    function fontCss(id){ for (var i=0;i<FONTS.length;i++){ if (FONTS[i].id===id) return FONTS[i].css; } return FONTS[0].css; }
    function fontGoogle(id){ for (var i=0;i<FONTS.length;i++){ if (FONTS[i].id===id) return FONTS[i].google; } return FONTS[0].google; }

    // Decoration model (per shop): names + numbers are ALWAYS DTF, priced
    // like an oversized DTF on the back (full_back placement). An optional
    // front logo can be DTF or embroidery at a chest placement, priced via
    // the same engine the quote builder uses for Bring-Your-Own decoration.
    var DECO_API = 'https://singhsprint-crm.vercel.app/api/pricing/decoration-only';
    var PRICING_API = 'https://singhsprint-crm.vercel.app/api/pricing';
    var UPLOAD_API = 'https://singhsprint-crm.vercel.app/api/inbound/upload';
    // Team discount applied to jersey prices only (not the wider catalog) to
    // sit at the competitive low end while staying well above cost.
    var TEAM_DISCOUNT = 0.12;
    function teamPrice(p){ return round95(p * (1 - TEAM_DISCOUNT)); }
    var NAME_NUMBER_PLACEMENT = 'full_back';      // oversized DTF on the back
    var LOGO_METHODS = [
      { id:'none',       label:'jersey.cz.logo.none', fallback:'No logo' },
      { id:'dtf',        label:'jersey.cz.logo.dtf',  fallback:'DTF print' },
      { id:'embroidery', label:'jersey.cz.logo.emb',  fallback:'Embroidery' }
    ];
    var LOGO_PLACEMENTS = [
      { id:'left_chest',   label:'jersey.cz.place.left',   fallback:'Left chest' },
      { id:'center_chest', label:'jersey.cz.place.center', fallback:'Center chest' },
      { id:'full_front',   label:'jersey.cz.place.full',   fallback:'Full front' }
    ];
    function round95(p){ return (Number(p) % 1 === 0.95) ? Number(p) : Math.ceil(p) - 0.05; }
    // Default on-jersey logo box (center x/y + width, % of the front image) per
    // placement. Left chest = wearer's left = viewer's right. Used as the
    // starting point; the customer then drags/resizes it on the jersey.
    function defaultLogoBox(placement){
      if (placement === 'left_chest')  return { x:64, y:33, w:18 };
      if (placement === 'full_front')  return { x:50, y:48, w:52 };
      return { x:50, y:32, w:24 };  // center_chest
    }

    var SIZES = ['YS','YM','YL','XS','S','M','L','XL','2XL','3XL'];
    // Suppliers use verbose size labels ("Mens-XL", "Youth-L") that overflow
    // the size picker. Normalize to clean standard sizes: adult → bare
    // (Mens-XL → XL), youth → Y-prefixed (Youth-L → YL). Unambiguous + short.
    function sizeLabel(s){
      var m = String(s||'').trim();
      var y = m.match(/^youth[\s\-_]*(.+)$/i); if (y) return ('Y' + y[1]).toUpperCase().replace(/\s+/g,'');
      var a = m.match(/^(?:adult|mens?|men|unisex)[\s\-_]*(.+)$/i); if (a) return a[1].toUpperCase().replace(/\s+/g,'');
      return m.toUpperCase().replace(/\s+/g,'');
    }

    // ============ state ============
    var state = { sport: null, products: [], sort: 'featured' };
    // Sort the loaded jerseys for display. Keeps state.products in fetch order
    // ('featured') and returns a sorted copy; price sorts use the discounted
    // team price and push quote-on-request (no price) to the end.
    function sortedProducts(){
      var list = state.products.slice();
      var s = state.sort;
      function pr(p){ return (typeof p.price_from==='number' && p.price_from>0) ? teamPrice(p.price_from) : null; }
      if (s === 'price_asc' || s === 'price_desc'){
        list.sort(function(a,b){
          var pa = pr(a), pb = pr(b);
          if (pa == null && pb == null) return 0;
          if (pa == null) return 1;
          if (pb == null) return -1;
          return s === 'price_asc' ? pa - pb : pb - pa;
        });
      } else if (s === 'name'){
        list.sort(function(a,b){ return String(a.name||'').localeCompare(String(b.name||'')); });
      }
      return list;
    }
    var cz = null; // active customizer state

    // ============ sport picker ============
    function renderSportPicker(){
      var host = document.getElementById('sportPicker');
      var html = '<button class="jh-sport' + (!state.sport?' active':'') + '" data-sport="">'
               + '<span data-i18n="jersey.all">' + t('jersey.all','All jerseys') + '</span></button>';
      SPORTS.forEach(function(s){
        html += '<button class="jh-sport' + (state.sport===s?' active':'') + '" data-sport="'+s+'">'
              + (SICON[s]||'') + '<span data-i18n="nav.jerseys.'+s+'">' + t('nav.jerseys.'+s, cap(s)) + '</span></button>';
      });
      host.innerHTML = html;
      host.querySelectorAll('.jh-sport').forEach(function(b){
        b.addEventListener('click', function(){
          var s = b.getAttribute('data-sport') || null;
          setSport(s, true);
        });
      });
    }
    function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

    function setSport(s, push){
      state.sport = (s && SPORTS.indexOf(s)>=0) ? s : null;
      renderSportPicker();
      if (push){
        var url = state.sport ? ('?sport='+state.sport) : location.pathname;
        try { history.replaceState({}, '', url); } catch(e){}
      }
      load();
    }

    // ============ fetch + grid ============
    function load(){
      var grid = document.getElementById('jhGrid');
      var meta = document.getElementById('jhMeta');
      grid.innerHTML = '';
      meta.innerHTML = '<span class="jh-loading">' + t('jersey.loading','Loading jerseys…') + '</span>';
      var url = API + '?limit=300&' + (state.sport ? ('sport='+state.sport) : 'jerseys=1');
      fetch(url).then(function(r){ return r.json(); }).then(function(j){
        // Only show jerseys our supplier actually has in stock (in_stock is
        // synced daily from S&S/Blanks). This also drops incomplete catalog
        // entries with no variants (which report in_stock=false).
        state.products = (((j && j.products) || []).filter(function(p){ return p.in_stock === true; }));
        renderGrid();
      }).catch(function(){
        meta.innerHTML = '';
        grid.innerHTML = '<div class="jh-empty">' + t('jersey.empty','No jerseys found for this sport yet.') + '</div>';
      });
    }

    function renderGrid(){
      var grid = document.getElementById('jhGrid');
      var meta = document.getElementById('jhMeta');
      var p = state.products;
      var sortWrap = document.getElementById('jhSortWrap');
      if (!p.length){
        meta.innerHTML = '';
        if (sortWrap) sortWrap.style.display = 'none';
        grid.innerHTML = '<div class="jh-empty">' + t('jersey.empty','No jerseys found for this sport yet — call us at 438-544-3800 and we will source them.') + '</div>';
        return;
      }
      meta.innerHTML = '<strong>' + p.length + '</strong> ' + t('jersey.count','jerseys')
        + (state.sport ? ' · ' + t('nav.jerseys.'+state.sport, cap(state.sport)) : '');
      if (sortWrap) sortWrap.style.display = '';
      grid.innerHTML = '';
      sortedProducts().forEach(function(prod, idx){
        var c0 = (prod.colors||[])[0] || {};
        var photo = imgUrl(c0.mockup_front_url || prod.hero_image_url);
        var tags = (prod.sports||[]).slice(0,3).map(function(s){ return '<span class="sporttag">'+esc(s)+'</span>'; }).join('');
        var price = (typeof prod.price_from==='number' && prod.price_from>0)
          ? ('<span data-i18n="jersey.from">'+t('jersey.from','From')+'</span> <strong>$'+teamPrice(prod.price_from).toFixed(2)+'</strong><span data-i18n="jersey.perunit">'+t('jersey.perunit','/unit')+'</span>')
          : '<strong>Quote on request</strong>';
        var card = document.createElement('div');
        card.className = 'jh-card';
        card.setAttribute('role','button');
        card.setAttribute('tabindex','0');
        card.style.cursor = 'pointer';
        card.innerHTML =
          '<div class="photo">' + (photo?'<img src="'+esc(photo)+'" alt="'+esc((prod.brand||'')+' '+(prod.style_number||''))+'" loading="lazy" decoding="async">':'') + '</div>'
          + '<div class="body">'
          + '<div class="brand-row">' + esc((prod.brand||'').toUpperCase()) + (prod.style_number?(' · '+esc(prod.style_number)):'') + '</div>'
          + '<div class="name">' + esc(prod.name||'') + '</div>'
          + (tags?('<div class="sporttags">'+tags+'</div>'):'')
          + '<div class="price">' + price + '</div>'
          + '<button class="jh-add" data-idx="'+idx+'">' + t('jersey.card.cta','Customize this jersey') + '</button>'
          + '</div>';
        // Whole card opens the customizer (matches the catalog UX); the
        // button inside bubbles up to this same handler.
        card.addEventListener('click', function(){ openCustomizer(prod); });
        card.addEventListener('keydown', function(e){ if (e.key==='Enter' || e.key===' '){ e.preventDefault(); openCustomizer(prod); } });
        grid.appendChild(card);
      });
    }

    // ============ customizer ============
    function openCustomizer(prod){
      var colors = (prod.colors||[]);
      cz = {
        prod: prod,
        colorIdx: 0,
        keeperColorIdx: defaultKeeperIdx(colors),   // alt color for goalies
        fontId: FONTS[0].id,
        logoMethod: 'none',            // none | dtf | embroidery
        logoPlacement: 'left_chest',   // left_chest | center_chest | full_front
        logoUrl: null,                 // uploaded logo signed URL (set after upload)
        logoPath: null,                // storage path (durable; CRM re-signs)
        logoName: '',                  // uploaded file name
        logoPreviewUrl: null,          // local object URL for the on-jersey preview
        logoBox: null,                 // { x, y, w } as % of the front image — drag/size
        logoRemoveBg: false,           // remove white background around the logo
        // Front-of-jersey extras. Each player's own number on the front
        // (frontNumber) and/or one team name across the front (frontName +
        // teamName). Boxes hold drag position { x, y } in % of the front
        // image plus a font size in px. They lazily default on first render.
        frontNumber: false,
        frontName: false,
        teamName: '',
        frontNumBox: null,             // { x, y, size }
        frontNameBox: null,            // { x, y, size }
        roster: [ blankRow(), blankRow() ],
        previewRow: 0
      };
      // product line
      var c0 = colors[0] || {};
      document.getElementById('czProd').innerHTML =
        '<img src="'+esc(imgUrl(c0.mockup_front_url||prod.hero_image_url))+'" alt="">'
        + '<div><div class="pb">'+esc((prod.brand||'').toUpperCase())+(prod.style_number?(' · '+esc(prod.style_number)):'')+'</div>'
        + '<div class="pn">'+esc(prod.name||'')+'</div></div>';
      // Tech specs (fabric / weight / gender) + available sizes from the catalog.
      var specs = [];
      if (prod.fabric) specs.push(esc(prod.fabric));
      if (prod.weight_oz) specs.push(esc(prod.weight_oz) + ' oz');
      if (prod.gender && String(prod.gender).toLowerCase() !== 'unisex') specs.push(esc(prod.gender));
      var sizeSet = {};
      (prod.colors||[]).forEach(function(c){ (c.sizes_in_stock||[]).forEach(function(s){ sizeSet[sizeLabel(s)]=1; }); });
      var SORD = ['YXS','YS','YM','YL','YXL','XS','S','M','L','XL','2XL','XXL','3XL','XXXL','4XL','5XL'];
      var sizes = Object.keys(sizeSet).sort(function(a,b){ var ia=SORD.indexOf(a), ib=SORD.indexOf(b); return (ia<0?99:ia)-(ib<0?99:ib); });
      // The roster size picker only offers sizes the supplier actually stocks
      // for this jersey (falls back to the generic list if the feed has none).
      cz.sizes = sizes.length ? sizes : SIZES.slice();
      var specHtml = specs.length ? specs.join(' · ') : '';
      if (sizes.length) specHtml += (specHtml?'<br>':'') + t('jersey.cz.sizes','Sizes')+': ' + sizes.join(', ');
      document.getElementById('czSpecs').innerHTML = specHtml;
      renderSwatches();
      renderKeeperSwatches();
      renderFonts();
      renderLogo();
      resetFrontControls();
      renderRoster();
      renderPreview();
      renderSummary();
      document.getElementById('czOverlay').classList.add('open');
      lockScroll();
    }
    // iOS-safe background scroll lock: body { overflow:hidden } alone doesn't
    // stop iOS Safari from scrolling the page behind a fixed overlay, so we
    // pin the body in place and restore the scroll position on close.
    var _lockY = 0;
    function lockScroll(){
      _lockY = window.scrollY || window.pageYOffset || 0;
      var b = document.body;
      b.style.position = 'fixed'; b.style.top = (-_lockY) + 'px';
      b.style.left = '0'; b.style.right = '0'; b.style.width = '100%';
      b.style.overflow = 'hidden';
    }
    function unlockScroll(){
      var b = document.body;
      b.style.position = ''; b.style.top = ''; b.style.left = ''; b.style.right = ''; b.style.width = ''; b.style.overflow = '';
      window.scrollTo(0, _lockY);
    }
    function closeCustomizer(){
      document.getElementById('czOverlay').classList.remove('open');
      unlockScroll();
      cz = null;
    }
    function blankRow(){ return { name:'', number:'', size:'L', keeper:false }; }
    // Sports where one player wears a contrasting-color jersey. Only hockey and
    // soccer have a goalie; the picker also needs 2+ colorways to make sense.
    function czRole(){
      if (!cz || !cz.prod) return null;
      if ((cz.prod.colors||[]).length < 2) return null;
      var sp = (cz.prod.sports||[]).slice();
      if (state && state.sport) sp.push(state.sport);
      sp = sp.map(function(s){ return String(s||'').toLowerCase(); });
      if (sp.indexOf('hockey') >= 0 || sp.indexOf('soccer') >= 0) return t('jersey.cz.goalie','Goalie');
      if (sp.indexOf('volleyball') >= 0) return t('jersey.cz.libero','Libero');   // libero wears a contrasting jersey by rule
      return null;
    }
    // Default the goalie color to the product colorway that contrasts most with
    // the team's first color, so the alt jersey actually stands out.
    function defaultKeeperIdx(colors){
      if (!colors || colors.length < 2) return 0;
      function lum(c){ try { var h=primaryHex(c).replace('#',''); if(h.length===3) h=h.split('').map(function(x){return x+x;}).join(''); var r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16); return (0.299*r+0.587*g+0.114*b)/255; } catch(e){ return 0.5; } }
      var l0=lum(colors[0]), best=1, bd=-1;
      for (var i=1;i<colors.length;i++){ var d=Math.abs(lum(colors[i])-l0); if (d>bd){ bd=d; best=i; } }
      return best;
    }
    function renderKeeperSwatches(){
      var field = document.getElementById('czKeeperField');
      if (!field) return;
      var role = czRole();
      if (!role){ field.style.display='none'; return; }
      field.style.display='';
      var lbl = document.getElementById('czKeeperLabel');
      var labelKey = (role.toLowerCase().indexOf('libero') >= 0) ? 'jersey.cz.liberocolor' : 'jersey.cz.goaliecolor';
      if (lbl) lbl.textContent = t(labelKey, role + ' color');
      var host = document.getElementById('czKeeperSwatches');
      var colors = cz.prod.colors||[];
      host.innerHTML = colors.map(function(c,i){
        return '<span class="cz-swatch'+(i===cz.keeperColorIdx?' sel':'')+'" data-kidx="'+i+'" title="'+esc(prettyColor(c.color_name))+'" style="background:'+esc(swatchBg(c))+'"></span>';
      }).join('');
      host.querySelectorAll('.cz-swatch').forEach(function(s){
        s.addEventListener('click', function(){
          cz.keeperColorIdx = parseInt(s.getAttribute('data-kidx'),10)||0;
          renderKeeperSwatches();
          var pr = cz.roster[cz.previewRow];
          if (pr && pr.keeper) renderPreview();
        });
      });
    }

    // ---- Colorway helpers -------------------------------------------------
    // Catalog jersey colors carry NO hex_code and only placeholder swatch
    // images, but their color_name encodes the colorway, e.g.
    // "Black-Charcoal_grey-Red". Map the name tokens to representative hexes
    // so swatches + the lettering preview show real colors instead of gray.
    var COLORMAP = {
      'black':'#1a1a1a','jet black':'#1a1a1a','white':'#f4f4f2','grey':'#9aa0a6','gray':'#9aa0a6',
      'charcoal':'#3a3d42','charcoal grey':'#3a3d42','graphite':'#3a3d42','silver':'#c8ccd0','steel':'#8a9099','steel grey':'#8a9099',
      'red':'#c8102e','av red':'#a4133c','cardinal':'#8c1d24','maroon':'#6a1a2a','crimson':'#b00020','scarlet':'#c8102e','dark red':'#7a0c1c',
      'navy':'#0a1f44','navy blue':'#0a1f44','royal':'#1f3a93','royal blue':'#1f3a93','blue':'#1d4ed8','columbia':'#6cace4','columbia blue':'#6cace4','carolina':'#6cace4','carolina blue':'#6cace4','sky':'#6cace4','sky blue':'#6cace4','powder':'#9bb7d4','light blue':'#7fb0e0',
      'green':'#1b7a3d','dark green':'#14532d','kelly':'#1b7a3d','kelly green':'#1b7a3d','forest':'#14532d','forest green':'#14532d','lime':'#7cb518','lime green':'#7cb518','mint':'#8fd9b6',
      'teal':'#0e8c8c','aqua':'#2dd4bf','turquoise':'#1fb6a6',
      'gold':'#d4af37','vegas gold':'#c5b358','old gold':'#cda434','athletic gold':'#ffc72c','sun gold':'#ffc72c','yellow':'#ffd200','athletic yellow':'#ffd200',
      'orange':'#e35205','texas orange':'#bf5700','burnt orange':'#bf5700',
      'purple':'#5b2a86','violet':'#7140a3',
      'pink':'#e0457b','hot pink':'#e0457b','neon pink':'#ff4fa3',
      'sand':'#d8c79a','vegas sand':'#d8c79a','tan':'#cda878','khaki':'#bfae86','cream':'#f1e7cf','natural':'#efe6d0','brown':'#5a3b22'
    };
    function _colNorm(s){ return String(s||'').toLowerCase().replace(/_/g,' ').trim(); }
    // Split a colorway name into its color tokens. Brands use different
    // separators: Athletic Knit "Black-Red-White", Augusta "Royal/White",
    // some "Black & Gold" — split on hyphen, slash, and ampersand.
    function _colSplit(name){ return _colNorm(name).split(/[\-\/&]/).map(function(s){ return s.trim(); }).filter(Boolean); }
    function colorHexes(name){
      var parts = _colSplit(name);
      var out = [];
      parts.forEach(function(tok){
        if (COLORMAP[tok]) { out.push(COLORMAP[tok]); return; }
        var words = tok.split(/\s+/), hit = null;
        for (var n=words.length; n>=1 && !hit; n--){
          for (var i=0; i+n<=words.length && !hit; i++){ var k=words.slice(i,i+n).join(' '); if (COLORMAP[k]) hit=COLORMAP[k]; }
        }
        if (hit) out.push(hit);
      });
      return out.length ? out : ['#9aa0a6'];
    }
    function swatchBg(c){
      if (c.hex_code) return c.hex_code;
      var hs = colorHexes(c.color_name);
      if (hs.length === 1) return hs[0];
      var n=hs.length, step=100/n, stops=[];
      for (var i=0;i<n;i++){ stops.push(hs[i]+' '+(i*step).toFixed(1)+'%'); stops.push(hs[i]+' '+((i+1)*step).toFixed(1)+'%'); }
      return 'linear-gradient(135deg,'+stops.join(',')+')';
    }
    function primaryHex(c){ return c.hex_code || colorHexes(c.color_name)[0]; }
    function prettyColor(name){
      return _colSplit(_colNorm(name).replace(/\s+\d+$/,'')).map(function(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : ''; }).filter(Boolean).join(' / ');
    }

    function renderSwatches(){
      var host = document.getElementById('czSwatches');
      var colors = cz.prod.colors||[];
      if (!colors.length){ document.getElementById('czColorField').style.display='none'; return; }
      document.getElementById('czColorField').style.display='';
      host.innerHTML = colors.map(function(c,i){
        return '<span class="cz-swatch'+(i===cz.colorIdx?' sel':'')+'" data-idx="'+i+'" title="'+esc(prettyColor(c.color_name))+'" style="background:'+esc(swatchBg(c))+'"></span>';
      }).join('');
      host.querySelectorAll('.cz-swatch').forEach(function(s){
        s.addEventListener('click', function(){ cz.colorIdx = parseInt(s.getAttribute('data-idx'),10)||0; renderSwatches(); renderPreview(); });
      });
    }
    function renderFonts(){
      var host = document.getElementById('czFonts');
      host.innerHTML = FONTS.map(function(f){
        return '<span class="cz-fontchip'+(f.id===cz.fontId?' sel':'')+'" data-id="'+f.id+'" style="font-family:'+f.css+'">'+esc(f.label.toUpperCase())+'</span>';
      }).join('');
      host.querySelectorAll('.cz-fontchip').forEach(function(c){
        c.addEventListener('click', function(){ cz.fontId = c.getAttribute('data-id'); renderFonts(); renderPreview(); });
      });
    }
    function renderLogo(){
      var mh = document.getElementById('czLogoMethod');
      mh.innerHTML = LOGO_METHODS.map(function(d){
        return '<span class="cz-chip'+(d.id===cz.logoMethod?' sel':'')+'" data-id="'+d.id+'">'+t(d.label,d.fallback)+'</span>';
      }).join('');
      mh.querySelectorAll('.cz-chip').forEach(function(c){
        c.addEventListener('click', function(){ cz.logoMethod = c.getAttribute('data-id'); renderLogo(); renderPreview(); });
      });
      var opts = document.getElementById('czLogoOpts');
      opts.style.display = (cz.logoMethod === 'none') ? 'none' : 'block';
      if (cz.logoMethod === 'none') return;
      var ph = document.getElementById('czLogoPlace');
      ph.innerHTML = LOGO_PLACEMENTS.map(function(d){
        return '<span class="cz-chip'+(d.id===cz.logoPlacement?' sel':'')+'" data-id="'+d.id+'">'+t(d.label,d.fallback)+'</span>';
      }).join('');
      ph.querySelectorAll('.cz-chip').forEach(function(c){
        c.addEventListener('click', function(){ cz.logoPlacement = c.getAttribute('data-id'); cz.logoBox = defaultLogoBox(cz.logoPlacement); renderLogo(); renderPreview(); });
      });
      var fn = document.getElementById('czLogoFileName');
      if (fn) fn.textContent = cz.logoName || t('jersey.cz.nologo','No file chosen yet');
    }
    // Capture the logo: show it on the jersey instantly via a local object
    // URL, and upload it in the background so its URL rides on the cart item.
    function handleLogoFile(file){
      if (!file) return;
      if (file.size && file.size > 15*1024*1024){ alert('Logo file is over 15 MB. Please compress it or email sales@singhsprint.com.'); return; }
      var fn = document.getElementById('czLogoFileName');
      cz.logoName = file.name;
      try { if (cz.logoPreviewUrl) URL.revokeObjectURL(cz.logoPreviewUrl); cz.logoPreviewUrl = URL.createObjectURL(file); } catch(e){ cz.logoPreviewUrl = null; }
      if (cz.logoMethod === 'none') { cz.logoMethod = 'dtf'; renderLogo(); }
      if (!cz.logoBox) cz.logoBox = defaultLogoBox(cz.logoPlacement);
      renderPreview();  // show the logo on the jersey right away
      if (fn) fn.textContent = t('jersey.cz.uploading','Uploading…');
      var fd = new FormData(); fd.append('file', file); fd.append('kind', 'design');
      fetch(UPLOAD_API, { method:'POST', body:fd }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
        cz.logoUrl  = (j && (j.signed_url || j.url)) || null;
        cz.logoPath = (j && j.path) || null;   // durable; CRM re-signs from this
        if (fn) fn.textContent = (cz.logoUrl || cz.logoPath) ? ('✓ ' + file.name) : (file.name + ' — ' + t('jersey.cz.uploadfail','upload failed, we will collect it with your quote'));
      }).catch(function(){ if (fn) fn.textContent = file.name + ' — ' + t('jersey.cz.uploadfail','upload failed, we will collect it with your quote'); });
    }
    function renderRoster(){
      var host = document.getElementById('czRoster');
      host.innerHTML = '';
      var role = czRole();
      // Rebuild the header so the goalie ("G") column only appears for keeper sports.
      var headRow = document.getElementById('czRosterHeadRow');
      if (headRow){
        headRow.innerHTML =
          '<th style="width:'+(role?'42%':'48%')+'">'+t('jersey.cz.name','Player name')+'</th>'
          + '<th style="width:14%">'+t('jersey.cz.number','No.')+'</th>'
          + '<th style="width:'+(role?'22%':'26%')+'">'+t('jersey.cz.size','Size')+'</th>'
          + (role ? ('<th style="width:12%;text-align:center" title="'+esc(role)+'">'+esc(role.charAt(0).toUpperCase())+'</th>') : '')
          + '<th style="width:10%"></th>';
      }
      var sizeList = (cz.sizes && cz.sizes.length) ? cz.sizes : SIZES;
      var defSize = (sizeList.indexOf('L') >= 0) ? 'L' : (sizeList[Math.floor(sizeList.length/2)] || sizeList[0]);
      cz.roster.forEach(function(row, i){
        if (sizeList.indexOf(row.size) < 0) row.size = defSize;   // coerce to a stocked size
        var tr = document.createElement('tr');
        var sizeOpts = sizeList.map(function(s){ return '<option'+(s===row.size?' selected':'')+'>'+s+'</option>'; }).join('');
        tr.innerHTML =
          '<td><input data-f="name" data-i="'+i+'" value="'+esc(row.name)+'" placeholder="'+t('jersey.cz.name','Player name')+'"></td>'
          + '<td class="col-no"><input data-f="number" data-i="'+i+'" value="'+esc(row.number)+'" maxlength="3" inputmode="numeric" placeholder="00"></td>'
          + '<td><select data-f="size" data-i="'+i+'" style="width:100%;padding:8px 9px;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:.86rem;background:#fff">'+sizeOpts+'</select></td>'
          + (role ? ('<td style="text-align:center"><input type="checkbox" data-f="keeper" data-i="'+i+'"'+(row.keeper?' checked':'')+' aria-label="'+esc(role)+'" title="'+esc(role)+'" style="width:18px;height:18px;accent-color:var(--ink);cursor:pointer"></td>') : '')
          + '<td><button class="rmrow" data-rm="'+i+'" aria-label="'+t('jersey.cz.remove','Remove')+'">&times;</button></td>';
        host.appendChild(tr);
      });
      host.querySelectorAll('input[type=checkbox][data-f="keeper"]').forEach(function(cb){
        cb.addEventListener('change', function(){
          var i = parseInt(cb.getAttribute('data-i'),10);
          if (cz.roster[i]){ cz.roster[i].keeper = cb.checked; if (i===cz.previewRow) renderPreview(); renderSummary(); }
        });
      });
      host.querySelectorAll('input[data-f]:not([type=checkbox]),select[data-f]').forEach(function(el){
        var ev = el.tagName==='SELECT' ? 'change' : 'input';
        el.addEventListener(ev, function(){
          var i = parseInt(el.getAttribute('data-i'),10); var f = el.getAttribute('data-f');
          if (cz.roster[i]){ cz.roster[i][f] = el.value; if (i===cz.previewRow && (f==='name'||f==='number')) updateLettering(); renderSummary(); }
        });
        if (el.tagName!=='SELECT'){
          el.addEventListener('focus', function(){ var i=parseInt(el.getAttribute('data-i'),10); cz.previewRow=i; updateLettering(); });
        }
      });
      host.querySelectorAll('.rmrow').forEach(function(b){
        b.addEventListener('click', function(){
          var i = parseInt(b.getAttribute('data-rm'),10);
          cz.roster.splice(i,1);
          if (!cz.roster.length) cz.roster.push(blankRow());
          cz.previewRow = Math.min(cz.previewRow, cz.roster.length-1);
          renderRoster(); renderPreview(); renderSummary();
        });
      });
    }

    function toggleFrontHint(){
      var h = document.getElementById('czFrontHint');
      if (h) h.style.display = (cz && (cz.frontNumber || cz.frontName)) ? 'block' : 'none';
    }
    // The front toggles / team-name input are static DOM, so reset them to the
    // fresh cz state every time the customizer opens (otherwise a previous
    // jersey's choices linger).
    function resetFrontControls(){
      var n = document.getElementById('czFrontNumber'); if (n) n.checked = false;
      var m = document.getElementById('czFrontName');   if (m) m.checked = false;
      var ti = document.getElementById('czTeamName');
      if (ti){ ti.value = ''; ti.style.display = 'none'; ti.placeholder = t('jersey.cz.teamnameph','Team name (e.g. Thunder)'); }
      toggleFrontHint();
    }

    function renderPreview(){
      var row = cz.roster[cz.previewRow] || cz.roster[0] || blankRow();
      var name = (row.name||'').toUpperCase() || 'NAME';
      var num  = row.number || '00';
      var colors = cz.prod.colors||[];
      var useKeeper = czRole() && row && row.keeper;
      var col = (useKeeper ? colors[cz.keeperColorIdx] : colors[cz.colorIdx]) || colors[cz.colorIdx] || {};
      var hex = primaryHex(col);
      var ink = contrastInk(hex);
      var fam = fontCss(cz.fontId);
      // Show the REAL product photo for the selected colorway (jersey colors
      // have no flat hex, so the photo is the honest "real thing"), then the
      // name + number rendered in the chosen team font on a chip tinted with
      // the colorway's primary color so the lettering + font read clearly.
      var img = imgUrl(col.mockup_front_url || cz.prod.hero_image_url);
      // Composite the uploaded logo onto the FRONT jersey photo. The customer
      // drags it to position and uses the Size slider to scale it — a real
      // manual mockup. Box = { x, y, w } as % of the front image.
      var hasLogo = cz.logoMethod !== 'none' && cz.logoPreviewUrl;
      if (hasLogo && !cz.logoBox) cz.logoBox = defaultLogoBox(cz.logoPlacement);
      var box = cz.logoBox || { x:50, y:32, w:24 };
      var logoOverlay = hasLogo
        ? '<img id="czLogoArt" src="'+esc(cz.logoPreviewUrl)+'" alt="" draggable="false" style="position:absolute;top:'+box.y+'%;left:'+box.x+'%;width:'+box.w+'%;transform:translate(-50%,-50%);object-fit:contain;cursor:move;touch-action:none;'+(cz.logoRemoveBg?'mix-blend-mode:multiply;':'')+'filter:drop-shadow(0 1px 2px rgba(0,0,0,.25))">'
        : '';
      // Front extras: each player's own number and/or one team name, dragged
      // onto the front photo. Lazily default their boxes (position % + px size).
      var hasFrontNum  = !!cz.frontNumber;
      var hasFrontName = !!cz.frontName && !!(cz.teamName||'').trim();
      if (hasFrontNum  && !cz.frontNumBox)  cz.frontNumBox  = { x:50, y:32, size:34 };
      if (hasFrontName && !cz.frontNameBox) cz.frontNameBox = { x:50, y:15, size:18 };
      var fnumBox  = cz.frontNumBox  || { x:50, y:32, size:34 };
      var fnameBox = cz.frontNameBox || { x:50, y:15, size:18 };
      var frontNumOverlay = hasFrontNum
        ? '<div id="czFrontNumArt" style="position:absolute;top:'+fnumBox.y+'%;left:'+fnumBox.x+'%;transform:translate(-50%,-50%);font-family:'+fam+';font-size:'+fnumBox.size+'px;line-height:1;color:'+ink+';cursor:move;touch-action:none;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.35)">'+esc(num)+'</div>'
        : '';
      var frontNameOverlay = hasFrontName
        ? '<div id="czFrontNameArt" style="position:absolute;top:'+fnameBox.y+'%;left:'+fnameBox.x+'%;transform:translate(-50%,-50%);font-family:'+fam+';font-size:'+fnameBox.size+'px;line-height:1;letter-spacing:1px;color:'+ink+';cursor:move;touch-action:none;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.35)">'+esc((cz.teamName||'').toUpperCase())+'</div>'
        : '';
      var html = '';
      // min-height reserves space so re-rendering the image doesn't collapse
      // the layout and jump the page scroll (notably on mobile).
      if (img) html += '<div id="czStage" style="position:relative;width:100%;min-height:200px;background:#fff;border-radius:10px;overflow:hidden;touch-action:none">'
        + '<img src="'+esc(img)+'" alt="" style="width:100%;max-height:230px;object-fit:contain;display:block;pointer-events:none" loading="lazy" decoding="async">'
        + frontNameOverlay + frontNumOverlay + logoOverlay
        + '<span style="position:absolute;top:6px;left:8px;font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:#9b958a;pointer-events:none">'+t('jersey.cz.front','Front')+'</span></div>';
      html += '<div style="margin-top:12px;width:100%;background:'+esc(hex)+';border-radius:12px;padding:14px 12px 16px;text-align:center;position:relative">'
        + '<span style="position:absolute;top:6px;left:8px;font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:'+ink+';opacity:.5">'+t('jersey.cz.back','Back')+'</span>'
        + '<div id="czBackName" style="font-family:'+fam+';font-size:22px;color:'+ink+';letter-spacing:1px;line-height:1">'+esc(name)+'</div>'
        + '<div id="czBackNum" style="font-family:'+fam+';font-size:58px;color:'+ink+';line-height:1.02">'+esc(num)+'</div>'
        + '</div>';
      document.getElementById('czSvg').innerHTML = html;
      var tools = document.getElementById('czLogoTools');
      if (tools) tools.style.display = hasLogo ? 'block' : 'none';
      if (hasLogo){
        var sizeEl = document.getElementById('czLogoSize'); if (sizeEl) sizeEl.value = Math.round(box.w);
        var bgEl = document.getElementById('czLogoRemoveBg'); if (bgEl) bgEl.checked = !!cz.logoRemoveBg;
        makeDragEl('czLogoArt', cz.logoBox || (cz.logoBox = box));
      }
      // Front number / team name: draggable, with a size slider each + Save.
      if (hasFrontNum)  makeDragEl('czFrontNumArt',  cz.frontNumBox);
      if (hasFrontName) makeDragEl('czFrontNameArt', cz.frontNameBox);
      var ftools = document.getElementById('czFrontTools');
      if (ftools) ftools.style.display = (hasFrontNum || hasFrontName) ? 'block' : 'none';
      var numRow = document.getElementById('czFrontNumSizeRow');
      if (numRow){ numRow.style.display = hasFrontNum ? 'flex' : 'none';
        var ns = document.getElementById('czFrontNumSize'); if (ns) ns.value = Math.round(fnumBox.size); }
      var nameRow = document.getElementById('czFrontNameSizeRow');
      if (nameRow){ nameRow.style.display = hasFrontName ? 'flex' : 'none';
        var nms = document.getElementById('czFrontNameSize'); if (nms) nms.value = Math.round(fnameBox.size); }
      var cn = prettyColor(col.color_name);
      var extras = (hasFrontName ? ' · front name' : '') + (hasFrontNum ? ' · front #' : '') + (hasLogo ? ' · + logo' : '');
      document.getElementById('czPrevHint').textContent = (cn ? (cn + ' · ') : '') + name + ' ' + num + extras;
    }
    // Lightweight update for the BACK name/number as the customer types — only
    // touches text, never rebuilds the image. This avoids the reflow/scroll
    // jump a full renderPreview() caused on every keystroke (mobile bug).
    function updateLettering(){
      if (!cz) return;
      var row = cz.roster[cz.previewRow] || cz.roster[0] || blankRow();
      var name = (row.name||'').toUpperCase() || 'NAME';
      var num  = row.number || '00';
      var bn = document.getElementById('czBackName'); if (bn) bn.textContent = name;
      var bx = document.getElementById('czBackNum');  if (bx) bx.textContent = num;
      var fnum = document.getElementById('czFrontNumArt'); if (fnum) fnum.textContent = num;  // front number is per-player
      var useKeeper = czRole() && row && row.keeper;
      var col = (useKeeper ? (cz.prod.colors||[])[cz.keeperColorIdx] : (cz.prod.colors||[])[cz.colorIdx]) || (cz.prod.colors||[])[cz.colorIdx] || {};
      var cn = prettyColor(col.color_name);
      var hasLogo = cz.logoMethod !== 'none' && cz.logoPreviewUrl;
      var hint = document.getElementById('czPrevHint');
      if (hint) hint.textContent = (cn ? (cn + ' · ') : '') + name + ' ' + num + (hasLogo ? ' · + logo' : '');
    }
    // Make any overlay (logo image, front number, team name) draggable around
    // the front jersey image; mutates the passed box's x/y (% of the stage).
    function makeDragEl(id, box){
      var stage = document.getElementById('czStage'), el = document.getElementById(id);
      if (!stage || !el || !box) return;
      var dragging = false;
      el.addEventListener('pointerdown', function(e){ dragging = true; try{ el.setPointerCapture(e.pointerId); }catch(_){} e.preventDefault(); e.stopPropagation(); });
      el.addEventListener('pointermove', function(e){
        if (!dragging || !cz) return;
        var r = stage.getBoundingClientRect();
        box.x = Math.max(4, Math.min(96, ((e.clientX - r.left) / r.width) * 100));
        box.y = Math.max(4, Math.min(96, ((e.clientY - r.top) / r.height) * 100));
        el.style.left = box.x + '%'; el.style.top = box.y + '%';
      });
      var end = function(e){ dragging = false; try{ el.releasePointerCapture(e.pointerId); }catch(_){} };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    }
    // Pick black or white lettering for legibility on the jersey color.
    function contrastInk(hex){
      try {
        var h = hex.replace('#',''); if (h.length===3) h=h.split('').map(function(x){return x+x;}).join('');
        var r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16);
        var lum = (0.299*r+0.587*g+0.114*b)/255;
        return lum>0.6 ? '#1a1a1a' : '#ffffff';
      } catch(e){ return '#ffffff'; }
    }

    function filledRows(){ return cz.roster.filter(function(r){ return (r.name||'').trim() || (r.number||'').trim(); }); }
    function renderSummary(){
      var fr = filledRows();
      var n = fr.length;
      var role = czRole();
      var gk = role ? fr.filter(function(r){ return r.keeper; }).length : 0;
      var pluralKey = (role && role.toLowerCase().indexOf('libero') >= 0) ? 'jersey.cz.liberos' : 'jersey.cz.goalies';
      var extra = gk ? (' · ' + gk + ' ' + (gk===1 ? role.toLowerCase() : t(pluralKey, role.toLowerCase()+'s'))) : '';
      document.getElementById('czSummary').innerHTML = '<strong>'+n+'</strong> '+t('jersey.cz.players','players')+esc(extra);
      document.getElementById('czAdd').disabled = n===0;
    }

    // Paste-a-list parsing: "Name, Number, Size" per line (commas or tabs).
    function parsePaste(text){
      var rows = [];
      var sizeList = (cz && cz.sizes && cz.sizes.length) ? cz.sizes : SIZES;
      var defSize = (sizeList.indexOf('L') >= 0) ? 'L' : (sizeList[Math.floor(sizeList.length/2)] || sizeList[0]);
      (text||'').split(/\r?\n/).forEach(function(line){
        var parts = line.split(/[,\t]/).map(function(s){ return s.trim(); });
        if (!parts.length || !parts.join('')) return;
        var name = parts[0]||'';
        var number = (parts[1]||'').replace(/[^0-9]/g,'').slice(0,3);
        var size = sizeLabel(parts[2]||'');
        if (sizeList.indexOf(size)<0) size = defSize;
        if (name || number) rows.push({ name:name, number:number, size:size });
      });
      return rows;
    }

    // ============ add to quote ============
    function logoPlacementLabel(id){ for(var i=0;i<LOGO_PLACEMENTS.length;i++){ if(LOGO_PLACEMENTS[i].id===id) return t(LOGO_PLACEMENTS[i].label, LOGO_PLACEMENTS[i].fallback); } return id; }

    // Per-jersey price is ALL-IN and QUANTITY-AWARE — priced at the team's
    // size (roster qty), via the SAME engine the rest of the site uses. The
    // engine price already includes the blank PLUS each decoration side, so
    // we never add the name/number again (that was a double-charge).
    //   Primary:  /api/pricing — qty + sides aware (name/number = 1 side on
    //             the back; a DTF logo adds a 2nd side).
    //   Fallback: some catalog entries have no variant/stock data so
    //             /api/pricing can't price them — fall back to the qty-aware
    //             catalog price (1 side) and, for a DTF logo, add it via
    //             decoration-only. NEVER fall back to a static/non-qty price.
    // Embroidery logos are always a decoration-only add (the base covers the
    // garment + lettering). cb({ unit, allin, logo_add }).
    // frontDeco describes the ONE front decoration (or null): the combined
    // logo / front-number / team-name print. { method, placement }. Pricing:
    //   base  = blank + back name/number (full-back, 1 side) via /api/pricing —
    //           exactly the figure the catalog "From" already reflects, so the
    //           back lettering is never double-charged.
    //   front = a single decoration-only add at the effective placement
    //           (center-chest for text, the logo's spot for a logo alone, or
    //           oversized when a logo is combined with front text).
    function computeJerseyUnitPrice(prod, qty, frontDeco, cb){
      function decoOnly(method, placement){
        return fetch(DECO_API + '?qty=' + qty + '&method=' + method + '&placements=' + encodeURIComponent(placement))
          .then(function(r){ return r.ok?r.json():null; }).then(function(j){ return (j && typeof j.unit_price==='number') ? j.unit_price : 0; }).catch(function(){ return 0; });
      }
      var frontP = frontDeco ? decoOnly(frontDeco.method, frontDeco.placement) : Promise.resolve(0);
      var engineUrl = PRICING_API + '?product_id=' + encodeURIComponent(prod.product_id) + '&qty=' + qty
                    + '&sides=1&decoration_method=dtf&embroidery_placements=' + encodeURIComponent('full-back');
      fetch(engineUrl).then(function(r){ return r.ok?r.json():null; })
        .then(function(j){ return (j && typeof j.unit_price==='number') ? { price: j.unit_price, full: true } : null; })
        .catch(function(){ return null; })
        .then(function(res){
          if (res) return res;
          // Fallback: qty-aware catalog price (1 side, blank + name/number).
          return fetch(API + '?product_id=' + encodeURIComponent(prod.product_id) + '&qty=' + qty)
            .then(function(r){ return r.ok?r.json():null; })
            .then(function(d){ var p=(d&&d.products&&d.products[0]&&typeof d.products[0].price_from==='number')?d.products[0].price_from:((typeof prod.price_from==='number'&&prod.price_from>0)?prod.price_from:0); return { price:p, full:false }; })
            .catch(function(){ return { price:(typeof prod.price_from==='number'&&prod.price_from>0)?prod.price_from:0, full:false }; });
        })
        .then(function(res){
          frontP.then(function(add){
            cb({ unit: teamPrice(res.price + add), allin: res.price, logo_add: add, front_add: add, team_discount: TEAM_DISCOUNT });
          });
        });
    }

    function addToQuote(){
      var rows = filledRows();
      if (!rows.length) return;
      var prod = cz.prod;
      var color = (prod.colors||[])[cz.colorIdx] || {};
      var role = czRole();
      var anyKeeper = !!role && rows.some(function(r){ return r.keeper; });
      var kColor = (role ? ((prod.colors||[])[cz.keeperColorIdx] || null) : null);
      var sizes = {};
      rows.forEach(function(r){ sizes[r.size] = (sizes[r.size]||0) + 1; });
      var qty = rows.length;
      var logoMethod = cz.logoMethod, logoPlacement = cz.logoPlacement, logoUrl = cz.logoUrl, logoPath = cz.logoPath, logoName = cz.logoName, fontId = cz.fontId;
      var logoBox = cz.logoBox ? { x:cz.logoBox.x, y:cz.logoBox.y, w:cz.logoBox.w } : null, logoRemoveBg = !!cz.logoRemoveBg;
      // Resolve the ONE front decoration + its price tier.
      var teamName = (cz.frontName && (cz.teamName||'').trim()) ? cz.teamName.trim() : null;
      var hasFrontText = !!cz.frontNumber || !!teamName;
      var hasLogo = logoMethod !== 'none';
      var logoPlaceKey = { left_chest:'left-chest', center_chest:'center-chest', full_front:'full-front' }[logoPlacement] || 'center-chest';
      var frontDeco = null, frontKind = null;
      if (hasLogo && hasFrontText){ frontDeco = { method:'dtf', placement:'oversized' }; frontKind = 'oversized'; }
      else if (hasLogo){ frontDeco = { method: logoMethod, placement: logoPlaceKey }; frontKind = 'logo'; }
      else if (hasFrontText){ frontDeco = { method:'dtf', placement:'center-chest' }; frontKind = 'front-text'; }
      var fNumBox  = (cz.frontNumber && cz.frontNumBox)  ? { x:cz.frontNumBox.x,  y:cz.frontNumBox.y,  size:cz.frontNumBox.size }  : null;
      var fNameBox = (teamName && cz.frontNameBox)       ? { x:cz.frontNameBox.x, y:cz.frontNameBox.y, size:cz.frontNameBox.size } : null;
      var btn = document.getElementById('czAdd'), prevTxt = btn.textContent;
      btn.disabled = true; btn.textContent = t('jersey.cz.adding','Pricing…');
      computeJerseyUnitPrice(prod, qty, frontDeco, function(price){
        var logo = (logoMethod === 'none') ? null : { method: logoMethod, placement: logoPlacement, placement_label: logoPlacementLabel(logoPlacement), url: logoUrl || null, path: logoPath || null, filename: logoName || null, box: logoBox, remove_bg: logoRemoveBg };
        var frontPrint = frontDeco ? { kind: frontKind, placement: frontDeco.placement, method: frontDeco.method, has_number: !!cz.frontNumber, has_team_name: !!teamName, number_box: fNumBox, name_box: fNameBox } : null;
        var item = {
          product_id:   prod.product_id,
          color_id:     color.color_id || null,
          color_name:   (color.color_name||'').replace(/_\d+$/,''),
          brand:        prod.brand || '',
          style_number: prod.style_number || '',
          name:         prod.name || '',
          garment_type: prod.garment_type || 'jersey',
          hero_url:     imgUrl(color.mockup_front_url || prod.hero_image_url),
          qty:          qty,
          sides:        1,
          placements:   [],                 // jersey is priced via jersey_unit_price, not the sides model
          decoration_type: 'dtf',
          sizes:        sizes,
          // ----- jersey-specific structured data (rides in cart_items JSONB) -----
          is_jersey:    true,
          sport:        state.sport || (prod.sports && prod.sports[0]) || null,
          jersey_font:  fontId,
          jersey_font_label: (function(){ for(var i=0;i<FONTS.length;i++){ if(FONTS[i].id===fontId) return FONTS[i].label; } return fontId; })(),
          // Exact Google Font so the shop downloads the real face for print.
          jersey_font_family: fontGoogle(fontId),
          jersey_font_source: 'Google Fonts',
          jersey_font_url: 'https://fonts.google.com/specimen/' + encodeURIComponent(fontGoogle(fontId).replace(/ /g,'+')),
          jersey_names_numbers: { method:'dtf', placement: NAME_NUMBER_PLACEMENT },
          jersey_front_logo: logo,
          // Front-of-jersey extras: each player's own number on the front
          // and/or the team name across the front. jersey_front_print is the
          // single combined front decoration we priced (front-text / logo /
          // oversized when both) with the customer's drag positions.
          jersey_front_number: !!cz.frontNumber,
          jersey_team_name: teamName,
          jersey_front_print: frontPrint,
          jersey_unit_price: price.unit,
          jersey_price_breakdown: { allin_blank_plus_decoration: price.allin, front_addon: price.front_add, logo_addon: price.logo_add },
          // Goalie (or other contrasting-color player): same blank, alternate
          // colorway. Counted in the same qty/price; only the color differs.
          jersey_keeper: anyKeeper ? { role: role, color_id: (kColor && kColor.color_id) || null, color_name: kColor ? (kColor.color_name||'').replace(/_\d+$/,'') : null } : null,
          roster:       rows.map(function(r){ return { name:r.name||'', number:r.number||'', size:r.size||'L', font:fontId, keeper: !!r.keeper, color_name: (r.keeper && kColor) ? (kColor.color_name||'').replace(/_\d+$/,'') : ((color.color_name||'').replace(/_\d+$/,'')) }; })
        };
        SinghsCart.add(item);
        try { if (window.spTrack) window.spTrack('jersey_add_to_quote', { product_id:prod.product_id, sport:item.sport, players:qty, font:fontId, logo:logoMethod, unit:price.unit }); } catch(e){}
        btn.disabled = false; btn.textContent = prevTxt;
        closeCustomizer();
        showToast(qty);
      });
    }

    function showToast(n){
      var el = document.getElementById('czToast');
      el.innerHTML = '<span>' + t('jersey.cz.added','Team added to your quote') + ' · <strong>'+n+'</strong> '+t('jersey.cz.players','players')+'</span>'
        + '<a href="/quote#cart" data-i18n="jersey.cz.viewquote">' + t('jersey.cz.viewquote','Review quote') + '</a>';
      el.classList.add('show');
      clearTimeout(showToast._t);
      showToast._t = setTimeout(function(){ el.classList.remove('show'); }, 4200);
    }

    // ============ wire-up ============
    function init(){
      // hero CTA scrolls to sport picker
      document.getElementById('heroCta').addEventListener('click', function(){
        document.getElementById('sportPicker').scrollIntoView({ behavior:'smooth', block:'center' });
      });
      document.getElementById('czClose').addEventListener('click', closeCustomizer);
      document.getElementById('czOverlay').addEventListener('click', function(e){ if (e.target.id==='czOverlay') closeCustomizer(); });
      document.addEventListener('keydown', function(e){ if (e.key==='Escape' && cz) closeCustomizer(); });
      document.getElementById('czAddRow').addEventListener('click', function(){ cz.roster.push(blankRow()); renderRoster(); renderSummary(); });
      document.getElementById('czPasteToggle').addEventListener('click', function(){
        var w = document.getElementById('czPasteWrap');
        w.style.display = w.style.display==='none' ? 'block' : 'none';
      });
      document.getElementById('czPasteTa').addEventListener('input', function(){
        var rows = parsePaste(this.value);
        if (rows.length){ cz.roster = rows.concat([blankRow()]); cz.previewRow = 0; renderRoster(); renderPreview(); renderSummary(); }
      });
      document.getElementById('czAdd').addEventListener('click', addToQuote);
      var lf = document.getElementById('czLogoFile');
      if (lf) lf.addEventListener('change', function(){ handleLogoFile(this.files && this.files[0]); });
      var ls = document.getElementById('czLogoSize');
      if (ls) ls.addEventListener('input', function(){ if(!cz) return; cz.logoBox = cz.logoBox || defaultLogoBox(cz.logoPlacement); cz.logoBox.w = parseInt(this.value,10)||24; var a=document.getElementById('czLogoArt'); if(a) a.style.width = cz.logoBox.w + '%'; });
      var lb = document.getElementById('czLogoRemoveBg');
      if (lb) lb.addEventListener('change', function(){ if(!cz) return; cz.logoRemoveBg = this.checked; renderPreview(); });

      // Front-of-jersey extras: toggles, team-name input, size sliders, Save.
      var fNum = document.getElementById('czFrontNumber');
      if (fNum) fNum.addEventListener('change', function(){ if(!cz) return; cz.frontNumber = this.checked; toggleFrontHint(); renderPreview(); });
      var fName = document.getElementById('czFrontName');
      if (fName) fName.addEventListener('change', function(){
        if(!cz) return; cz.frontName = this.checked;
        var ti = document.getElementById('czTeamName'); if (ti) ti.style.display = this.checked ? 'block' : 'none';
        toggleFrontHint(); renderPreview();
      });
      var tName = document.getElementById('czTeamName');
      if (tName) tName.addEventListener('input', function(){ if(!cz) return; cz.teamName = this.value; renderPreview(); });
      var fns = document.getElementById('czFrontNumSize');
      if (fns) fns.addEventListener('input', function(){ if(!cz||!cz.frontNumBox) return; cz.frontNumBox.size = parseInt(this.value,10)||34; var a=document.getElementById('czFrontNumArt'); if(a) a.style.fontSize = cz.frontNumBox.size + 'px'; });
      var fnms = document.getElementById('czFrontNameSize');
      if (fnms) fnms.addEventListener('input', function(){ if(!cz||!cz.frontNameBox) return; cz.frontNameBox.size = parseInt(this.value,10)||18; var a=document.getElementById('czFrontNameArt'); if(a) a.style.fontSize = cz.frontNameBox.size + 'px'; });
      var fsave = document.getElementById('czFrontSave');
      if (fsave) fsave.addEventListener('click', function(){
        var s = document.getElementById('czFrontSaved'); if (!s) return;
        s.style.display = 'inline'; clearTimeout(fsave._t);
        fsave._t = setTimeout(function(){ s.style.display = 'none'; }, 1800);
      });

      var sortSel = document.getElementById('jhSort');
      if (sortSel) sortSel.addEventListener('change', function(){ state.sort = this.value; renderGrid(); });

      renderSportPicker();
      setSport(qp('sport'), false);
    }
    if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);
  })();
