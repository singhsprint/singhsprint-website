// Shared nav and footer for all Singhs Print pages
// Edit these once, changes apply everywhere.

function loadNav() {
  var el = document.getElementById('nav-placeholder');
  if (!el) return;
  el.innerHTML = ''
    + '<div class="promo-bar">'
    + '  15% OFF your first order. No code needed. <a href="quote.html">Get your quote</a>'
    + '</div>'
    + '<nav class="navbar">'
    + '  <div class="navbar-inner">'
    + '    <a href="index.html" class="logo"><img src="images/logo.png" alt="Singhs Print" style="height:52px;width:auto"></a>'
    + '    <div class="nav-links" id="navLinks">'
    + '      <a href="index.html#products">Products</a>'
    + '      <a href="index.html#services">Services</a>'
    + '      <a href="index.html#how-it-works">How It Works</a>'
    + '      <a href="portfolio.html">Portfolio</a>'
    + '      <a href="inkwear.html">Inkwear</a>'
    + '      <a href="about.html">About</a>'
    + '    </div>'
    + '    <div class="nav-cta">'
    + '      <a href="mailto:sales@singhsprint.com" class="nav-phone" style="font-size:.85rem;color:#888">sales@singhsprint.com</a>'
    + '      <a href="tel:5149151539" class="nav-phone">514-915-1539</a>'
    + '      <a href="https://singhsprint-crm.vercel.app/login" class="btn btn-outline btn-sm" style="padding:10px 20px;font-size:.85rem">Login</a>'
    + '      <a href="quote.html" class="btn btn-primary btn-sm">Get a Quote</a>'
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
    + '        <p style="margin-top:12px">Custom apparel printing in Montreal\'s West Island. DTG, DTF &amp; Embroidery for brands, creators, and businesses. Open 7 days, 9AM\u20139PM.</p>'
    + '      </div>'
    + '      <div class="footer-col"><h4>Pages</h4><a href="index.html">Home</a><a href="quote.html">Get a Quote</a><a href="portfolio.html">Portfolio</a><a href="inkwear.html">Inkwear</a><a href="about.html">About</a></div>'
    + '      <div class="footer-col"><h4>Services</h4><a href="index.html#services">DTG Printing</a><a href="index.html#services">DTF Transfers</a><a href="index.html#services">Embroidery</a><a href="quote.html">Design Studio</a></div>'
    + '      <div class="footer-col"><h4>Contact</h4><a href="tel:5149151539">514-915-1539</a><a href="mailto:sales@singhsprint.com">sales@singhsprint.com</a><a href="https://instagram.com/singhsprint" target="_blank">@singhsprint on Instagram</a><a href="https://maps.app.goo.gl/FX8o2QEvQzngxeiv7" target="_blank">West Island, Montreal</a></div>'
    + '    </div>'
    + '    <div class="footer-bottom">'
    + '      <span>&copy; 2026 Singhs Print. All rights reserved.</span>'
    + '      <span>Custom Apparel Printing | Montreal, QC</span>'
    + '    </div>'
    + '  </div>'
    + '</footer>';
}

// Auto-run when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  loadNav();
  loadFooter();
});
