/* =========================================================================
 * GET /api/shop/list
 *
 * Public endpoint. Returns all drops with status='live', newest first.
 * Powers the /shop hub page rail.
 *
 * Response: { drops: [{ slug, title, mockup_url, retail_price_cents, currency, launched_at }] }
 *
 * Reads via service role (RLS would otherwise hide unauthenticated reads
 * even though the drops policy allows status='live' selects publicly —
 * the storefront's /shop hub is anonymous, so going through admin is
 * simpler than juggling anon-key tokens here).
 * ========================================================================= */

const { adminClient } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const supabase = adminClient();
    const { data, error } = await supabase
      .from('drops')
      .select('slug, title, mockup_url, retail_price_cents, currency, launched_at')
      .eq('status', 'live')
      .order('launched_at', { ascending: false });
    if (error) throw error;

    // Cache for 30s at the edge. New drops appear within that window after
    // status is flipped to 'live'.
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json({ drops: data || [] });
  } catch (e) {
    console.error('[/api/shop/list]', e);
    return res.status(500).json({ error: e.message });
  }
};
