/* =========================================================================
 * /api/account/designs — read + hide, any signed-in customer
 *
 * The customer's own design library: the garments they customized on the
 * catalog and shared, plus any printable artwork threaded onto their contact.
 *
 * WHY THIS EXISTS (2026-08-02): every route that read design_shares or
 * contact_designs was operator-only — /api/captures,
 * /api/contacts/[id]/designs, /api/contacts/[id]/designs/upload and the two
 * design-share routes. So a customer who built a design, shared it with a
 * colleague and then made an account saw their ORDERS and no trace of the
 * design. For a repeat buyer "my designs" is the reason to have an account at
 * all, and reordering one is a live revenue path, not a gallery.
 *
 *   GET /api/account/designs
 *     → { designs: [{ id, kind, token, label, garment, colour, qty,
 *                     mockupUrl, artworkUrl, placements, createdAt,
 *                     reorderUrl, shareUrl }] }
 *
 *   POST /api/account/designs?action=hide     body { kind, id }
 *   POST /api/account/designs?action=unhide   body { kind, id }
 *     kind ∈ {'share','artwork'} — which table the id belongs to.
 *
 * HIDE IS NOT DELETE. The row and the storage object stay: the shop reprints
 * from that artwork, and a reprint six months from now has to work without
 * asking the customer to re-send a file they believe they deleted. The public
 * /d/<token> link also stays live — that link was sent to other people, and
 * revoking it out from under them is a separate decision nobody has made.
 *
 * THE IDENTITY BRIDGE is the email, not customers.user_id. Design shares hang
 * off CONTACTS (resolveOrCreateContact dedupes on contacts.email_norm, a
 * generated stored column with a unique index), while orders.js / mockups.js
 * bridge through customers. Matching on email_norm is an exact equality
 * against a normalised column — no ILIKE, so none of the wildcard-escaping
 * care orders.js needs applies here. The email itself comes from the verified
 * Supabase session, never from the request body.
 * ========================================================================= */

const { requireUser, setCorsHeaders, readJsonBody } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');

const DESIGN_BUCKET  = process.env.DESIGN_BUCKET || 'designs';
const SIGNED_URL_TTL = 3600;   // 1 hour, same as artwork.js / mockups.js
const MAX_ROWS       = 200;
const SITE           = 'https://www.singhsprint.com';

/** The caller's contact id, or null when they've never touched a design. */
async function contactIdFor(supabase, user) {
  const email = (user && user.email ? String(user.email) : '').trim().toLowerCase();
  if (!email) return null;
  const { data, error } = await supabase
    .from('contacts')
    .select('id')
    .eq('email_norm', email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? data.id : null;
}

function firstMockup(designs) {
  if (!Array.isArray(designs)) return null;
  const hit = designs.find(function (d) { return d && d.mockup_url; });
  return hit ? hit.mockup_url : null;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  let contactId;
  try { contactId = await contactIdFor(supabase, user); }
  catch (e) { return res.status(500).json({ error: e.message }); }

  // ── hide / unhide ──────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const action = (req.query && req.query.action) || '';
    if (action !== 'hide' && action !== 'unhide') {
      return res.status(400).json({ error: 'action must be hide or unhide' });
    }
    if (!contactId) return res.status(404).json({ error: 'no designs for this account' });

    let body;
    try { body = await readJsonBody(req); } catch (e) { return res.status(400).json({ error: 'invalid body' }); }
    const kind = String((body && body.kind) || '');
    const id   = String((body && body.id) || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    if (kind !== 'share' && kind !== 'artwork') {
      return res.status(400).json({ error: 'kind must be share or artwork' });
    }

    const table  = kind === 'share' ? 'design_shares' : 'contact_designs';
    const keyCol = kind === 'share' ? 'token' : 'id';
    const value  = action === 'hide' ? new Date().toISOString() : null;

    // Scoped by contact_id as well as the id: without it, a caller could hide
    // a stranger's design by guessing a token.
    const { data, error } = await supabase
      .from(table)
      .update({ customer_hidden_at: value })
      .eq(keyCol, id)
      .eq('contact_id', contactId)
      .select(keyCol);
    if (error) return res.status(500).json({ error: error.message });
    if (!data || !data.length) return res.status(404).json({ error: 'not found' });

    return res.status(200).json({ ok: true, action: action, kind: kind, id: id });
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  if (!contactId) return res.status(200).json({ designs: [] });

  // ── the library ────────────────────────────────────────────────────────
  const [sharesRes, artworkRes] = await Promise.all([
    supabase
      .from('design_shares')
      .select('token, brand, style_number, product_name, color_name, qty, placements, designs, created_at')
      .eq('contact_id', contactId)
      .is('customer_hidden_at', null)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
    supabase
      .from('contact_designs')
      .select('id, path, label, uploaded_by, created_at')
      .eq('contact_id', contactId)
      .is('customer_hidden_at', null)
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS),
  ]);
  if (sharesRes.error)  return res.status(500).json({ error: sharesRes.error.message });
  if (artworkRes.error) return res.status(500).json({ error: artworkRes.error.message });

  const out = [];
  const sharedPaths = new Set();

  for (const row of sharesRes.data || []) {
    (Array.isArray(row.designs) ? row.designs : []).forEach(function (d) {
      if (d && d.design_path) sharedPaths.add(d.design_path);
    });
    out.push({
      id:         row.token,
      kind:       'share',
      token:      row.token,
      label:      row.product_name || [row.brand, row.style_number].filter(Boolean).join(' ') || 'Your design',
      garment:    [row.brand, row.style_number].filter(Boolean).join(' ') || null,
      colour:     row.color_name || null,
      qty:        row.qty || null,
      placements: Array.isArray(row.placements) ? row.placements : [],
      // Already a permanent public customer-mockups URL — no signing needed.
      mockupUrl:  firstMockup(row.designs),
      artworkUrl: null,
      createdAt:  row.created_at,
      // Reorder is the primary action: the token restores the artwork, colour
      // and placement into the customizer, ready to add to a quote.
      reorderUrl: SITE + '/catalog?design=' + encodeURIComponent(row.token),
      shareUrl:   SITE + '/d/' + encodeURIComponent(row.token),
    });
  }

  // Printable artwork with no share of its own — an operator upload, or the
  // half of a share whose token has since been hidden. Skips anything already
  // represented above so a single design isn't listed twice.
  for (const row of artworkRes.data || []) {
    if (!row.path || sharedPaths.has(row.path)) continue;
    let artworkUrl = null;
    const signed = await supabase.storage.from(DESIGN_BUCKET).createSignedUrl(row.path, SIGNED_URL_TTL);
    if (signed && signed.data) artworkUrl = signed.data.signedUrl || null;
    out.push({
      id:         row.id,
      kind:       'artwork',
      token:      null,
      label:      row.label || 'Artwork',
      garment:    null,
      colour:     null,
      qty:        null,
      placements: [],
      mockupUrl:  null,
      artworkUrl: artworkUrl,          // signed 1-hour URL
      createdAt:  row.created_at,
      reorderUrl: null,
      shareUrl:   null,
    });
  }

  out.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  return res.status(200).json({ designs: out });
};
