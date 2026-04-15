// Shared nav and footer for all Singhs Print pages
// Edit these once, changes apply everywhere.

function loadNav() {
  var el = document.getElementById('nav-placeholder');
  if (!el) return;
  el.innerHTML = ''
    + '<div class="promo-bar">'
    + '  <span data-i18n="promo">15% OFF your first order. No code needed.</span> <a href="quote.html" data-i18n="promo.link">Get your quote</a>'
    + '</div>'
    + '<nav class="navbar">'
    + '  <div class="navbar-inner">'
    + '    <a href="index.html" class="logo"><img src="images/logo.png" alt="Singhs Print" style="height:52px;width:auto"></a>'
    + '    <div class="nav-links" id="navLinks">'
    + '      <a href="portfolio.html" data-i18n="nav.portfolio">Portfolio</a>'
    + '      <a href="inkwear.html" data-i18n="nav.inkwear">Inkwear</a>'
    + '      <a href="businesses.html" data-i18n="nav.businesses">For Businesses</a>'
    + '      <a href="about.html" data-i18n="nav.about">About</a>'
    + '    </div>'
    + '    <div class="nav-cta">'
    + '      <a href="tel:5149151539" class="nav-phone">514-915-1539</a>'
    + '      <button id="langToggle" onclick="SP_LANG.toggleLang()" style="padding:8px 14px;border-radius:50px;border:1.5px solid #ddd;background:#fff;font-size:.8rem;font-weight:700;cursor:pointer;transition:all .2s;letter-spacing:1px">FR</button>'
    + '      <a href="quote.html" class="btn btn-primary btn-sm" data-i18n="nav.quote">Get a Quote</a>'
    + '    </div>'
    + '    <button class="mobile-toggle" id="mobileToggle" aria-label="Menu">'
    + '      <span></span><span></span><span></span>'
    + '    </button>'
    + '  </div>'
    + '</nav>';

  // Wire up mobile menu toggle
  var toggle = document.getElementById('mobileToggle');
  if (toggle) {
    toggle.addEventListener('click', function() {
      document.getElementById('navLinks').classList.toggle('active');
    });
  }
}

function loadFooter() {
  var el = document.getElementById('footer-placeholder');
  if (!el) return;
  el.innerHTML = ''
    + '<footer class="footer">'
    + '  <div class="container">'
    + '    <div class="footer-grid">'
    + '      <div class="footer-brand">'
    + '        <div class="logo"><span>SINGHS</span><span>PRINT</span></div>'
    + '        <p style="margin-top:12px" data-i18n="footer.brand">Custom apparel printing in Montreal\'s West Island. DTG, DTF &amp; Embroidery for brands, creators, and businesses. Open 7 days, 9AM\u20139PM.</p>'
    + '      </div>'
    + '      <div class="footer-col"><h4 data-i18n="footer.pages">Pages</h4><a href="index.html" data-i18n="footer.home">Home</a><a href="quote.html" data-i18n="footer.getquote">Get a Quote</a><a href="portfolio.html" data-i18n="footer.portfolio">Portfolio</a><a href="inkwear.html" data-i18n="footer.inkwear">Inkwear</a><a href="businesses.html" data-i18n="footer.businesses">For Businesses</a><a href="about.html" data-i18n="footer.about">About</a></div>'
    + '      <div class="footer-col"><h4 data-i18n="footer.services">Services</h4><a href="index.html#services" data-i18n="footer.dtg">DTG Printing</a><a href="index.html#services" data-i18n="footer.dtf">DTF Transfers</a><a href="index.html#services" data-i18n="footer.embroidery">Embroidery</a><a href="quote.html" data-i18n="footer.designstudio">Design Studio</a></div>'
    + '      <div class="footer-col"><h4 data-i18n="footer.contact">Contact</h4><a href="tel:5149151539">514-915-1539</a><a href="mailto:sales@singhsprint.com">sales@singhsprint.com</a><a href="https://instagram.com/singhsprint" target="_blank">@singhsprint on Instagram</a><a href="https://maps.app.goo.gl/FX8o2QEvQzngxeiv7" target="_blank" data-i18n="footer.location">West Island, Montreal</a></div>'
    + '    </div>'
    + '    <div class="footer-bottom">'
    + '      <span>&copy; <span data-i18n="footer.rights">2026 Singhs Print. All rights reserved.</span></span>'
    + '      <span data-i18n="footer.tagline">Custom Apparel Printing | Montreal, QC</span>'
    + '      <a href="https://singhsprint-crm.vercel.app/login" style="font-size:.75rem;color:#777;font-weight:500;opacity:.7;transition:opacity .2s" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=.7" data-i18n="nav.login">Login</a>'
    + '    </div>'
    + '  </div>'
    + '</footer>';
}

// Auto-run when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  loadNav();
  loadFooter();
});
