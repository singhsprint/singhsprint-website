/* =========================================================================
 * GET /api/shop/list
 *
 * Public endpoint. Powers the /shop hub page rail.
 *
 * Shows ONLY the site primary drop (drops.is_primary = true, status='live').
 * Campaign secondaries stay live and reachable by their own /shop/{slug} ad
 * link (served by api/shop/page.js, which serves any live drop) but never
 * appear in this hub listing. There is at most one primary (a partial unique
 * index in the CRM enforces it), so this rail shows one drop at a time.
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
      .eq('is_primary', true)
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
