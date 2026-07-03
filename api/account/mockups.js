/* =========================================================================
 * /api/account/mockups — read-only, any signed-in customer
 *
 * Returns the mockups a shop operator has chosen to SHARE with this customer.
 * Mirrors /api/account/artwork's auth + signed-URL plumbing, but:
 *   - read-only (no upload/delete; the shop controls sharing in the CRM)
 *   - NOT business-gated (any customer can have shared mockups)
 *   - scoped by customers.user_id = caller, and visible_to_customer = true
 *
 * The mockup images live in the shared `mockups` storage bucket (same one the
 * CRM writes to). That bucket is private to customers — we only ever hand out
 * signed URLs (1 hour), never raw bucket URLs, and never a row that the
 * operator hasn't toggled visible.
 *
 *   GET /api/account/mockups
 *     → { mockups: [{ id, label, placement, imageUrl, createdAt }] }
 *
 * The caller→customer bridge is the same one orders.js / reorder.js use:
 * customers.user_id = auth user id (populated by the handle_new_user trigger).
 * A user may map to MORE THAN ONE customers row (legacy email merges), so we
 * resolve a SET of customer ids and filter the library by all of them.
 * ========================================================================= */

const { requireUser, setCorsHeaders } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');

const BUCKET = process.env.MOCKUP_BUCKET || 'mockups';
const SIGNED_URL_TTL = 3600; // 1 hour

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  // Resolve this caller's CRM customer id(s). Same pattern as orders.js.
  const { data: cust, error: cErr } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', user.id);
  if (cErr) return res.status(500).json({ error: cErr.message });

  const customerIds = (cust || []).map((c) => c.id);
  if (!customerIds.length) return res.status(200).json({ mockups: [] });

  // Shared rows only. visible_to_customer = true is enforced HERE, server-side
  // — never trust the client to hide private mockups.
  const { data, error } = await supabase
    .from('customer_mockups')
    .select('id, label, placement, mockup_path, mockup_url, created_at')
    .in('customer_id', customerIds)
    .eq('visible_to_customer', true)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });

  const out = [];
  for (const row of data || []) {
    let imageUrl = null;
    if (row.mockup_path) {
      const { data: signed } = await supabase
        .storage.from(BUCKET)
        .createSignedUrl(row.mockup_path, SIGNED_URL_TTL);
      imageUrl = signed?.signedUrl || null;
    }
    out.push({
      id:        row.id,
      label:     row.label,
      placement: row.placement,
      imageUrl,                 // signed 1-hour URL, or null if we can't sign it
      createdAt: row.created_at,
    });
  }

  return res.status(200).json({ mockups: out });
};
