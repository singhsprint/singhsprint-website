/* =========================================================================
 * Program catalog filter — runs on /catalog
 *
 * If the signed-in customer is a member of any program with a non-empty
 * catalog whitelist, this script:
 *   1. Adds a "Showing approved products for <program name>" banner above
 *      the catalog grid (with a "Clear filter" link for staff/admins).
 *   2. Hides every product card whose data-product-id is not in the
 *      whitelist, by adding a `body.sp-program-filter` class + a CSS rule.
 *   3. Re-runs the filter pass whenever new cards are appended (the
 *      catalog uses infinite scroll), via MutationObserver.
 *
 * No-op for:
 *   - anonymous visitors
 *   - signed-in users with no program membership
 *   - members of "open" programs (catalog whitelist is empty)
 *   - users with ?program=__none in the URL (explicit override for admins)
 *
 * Loaded after the catalog page renders so we don't block first paint.
 * ========================================================================= */
(function () {
  'use strict';

  if (!/^\/(fr\/)?catalog($|[\/?#])/.test(location.pathname)) return;

  const params = new URLSearchParams(location.search);
  if (params.get('program') === '__none') return;

  // Pull the session JWT directly from supabase-js's localStorage cell.
  // We don't want this script to depend on /account/auth.js being loaded
  // on every catalog page — that would pull in the full Supabase UMD too.
  let accessToken = null;
  try {
    const raw = localStorage.getItem('sp.session.v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      accessToken = parsed?.access_token || parsed?.currentSession?.access_token || null;
    }
  } catch (_) { return; }
  if (!accessToken) return;

  fetch('/api/account/my-program', {
    headers: { 'Authorization': 'Bearer ' + accessToken },
    cache: 'no-store'
  })
    .then((r) => r.ok ? r.json() : null)
    .then((j) => {
      if (!j || !j.programs || !j.programs.length) return;

      // Pick the program targeted by ?program=slug if present; otherwise
      // the first program with a non-empty whitelist.
      const slug = params.get('program');
      let chosen = null;
      if (slug) {
        chosen = j.programs.find((p) => p.slug === slug) || null;
      } else {
        chosen = j.programs.find((p) => (p.catalogProductIds || []).length > 0) || null;
      }
      if (!chosen || !(chosen.catalogProductIds || []).length) return;

      activate(chosen);
    })
    .catch(() => { /* anonymous failures are fine — gate stays off */ });

  function activate(program) {
    const allowed = new Set(program.catalogProductIds);

    // 1. CSS gate — hidden cards stay in the DOM (so layout / infinite
    //    scroll counters don't get out of sync) but are display:none.
    const style = document.createElement('style');
    style.id = 'sp-program-filter-style';
    style.textContent = `
      body.sp-program-filter .card[data-product-id]:not(.is-allowed){display:none !important}
    `;
    document.head.appendChild(style);
    document.body.classList.add('sp-program-filter');

    // 2. Banner above the catalog grid.
    const banner = document.createElement('div');
    banner.id = 'sp-program-banner';
    banner.style.cssText = [
      'background:#1a1a1a',
      'color:#e8ff3c',
      'padding:12px 18px',
      'border-radius:14px',
      'margin:0 auto 16px',
      'max-width:1240px',
      'font-size:.9rem',
      'font-weight:600',
      'display:flex',
      'justify-content:space-between',
      'align-items:center',
      'gap:12px',
      'flex-wrap:wrap'
    ].join(';');
    banner.innerHTML =
      '<span><span style="background:#e8ff3c;color:#1a1a1a;padding:2px 8px;border-radius:50px;font-size:.66rem;letter-spacing:.06em;text-transform:uppercase;margin-right:8px">Program</span>' +
      'Showing your approved catalog for <strong>' + escapeHtml(program.name) + '</strong></span>' +
      '<a href="?program=__none" style="color:#e8ff3c;text-decoration:underline;font-size:.78rem">View full catalog →</a>';
    // Inject just above the grid (or as the first child of <main> as a fallback).
    const grid =
      document.querySelector('#catalog-grid') ||
      document.querySelector('.catalog-grid') ||
      document.querySelector('main') ||
      document.body;
    grid.parentNode.insertBefore(banner, grid);

    // 3. Tag any cards already in the DOM, then watch for new ones.
    tagAll();
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (node.matches && node.matches('.card[data-product-id]')) tagOne(node);
            const inner = node.querySelectorAll && node.querySelectorAll('.card[data-product-id]');
            if (inner) inner.forEach(tagOne);
          }
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    function tagAll() {
      document.querySelectorAll('.card[data-product-id]').forEach(tagOne);
    }
    function tagOne(card) {
      if (allowed.has(card.getAttribute('data-product-id'))) {
        card.classList.add('is-allowed');
      } else {
        card.classList.remove('is-allowed');
      }
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
})();
