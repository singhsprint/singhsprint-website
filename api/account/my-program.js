/* =========================================================================
 * /api/account/my-program — read-only for the signed-in customer
 *
 * Returns the program(s) the caller belongs to plus the catalog whitelist
 * and remaining spending allowance. Used by:
 *   - the catalog page, to filter products to the program's whitelist
 *   - the dashboard, to show "Your program: Nursing 2026"
 *   - the order flow, to enforce per-order allowance caps client-side
 *     (the server-side enforcement happens when the lead is converted)
 *
 * A user can belong to multiple programs (e.g. faculty member who also
 * teaches in a second school). The response is a list.
 *
 * Route:
 *
 *   GET /api/account/my-program
 *     → { programs: [{ id, slug, name, cohortLabel,
 *                       allowanceCents, remainingCents,
 *                       windowOpensAt, windowClosesAt, isOpen,
 *                       catalogProductIds: [...] }] }
 *
 * No auth-tier gate beyond requireUser: any signed-in customer can have
 * a program membership (the institutional context is what makes them
 * a "program member", not the business tier).
 * ========================================================================= */

const { requireUser, setCorsHeaders } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'method not allowed' });

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  // 1. Member rows for this user.
  const { data: memberships, error: mErr } = await supabase
    .from('program_members')
    .select(`
      program_id, cohort_label, spending_allowance_cents, spent_cents,
      programs:program_id (
        id, slug, name, cohort_label,
        default_spending_allowance_cents,
        order_window_opens_at, order_window_closes_at, is_active
      )
    `)
    .eq('user_id', user.id);
  if (mErr) return res.status(500).json({ error: mErr.message });

  const out = [];
  for (const m of memberships || []) {
    const p = m.programs;
    if (!p || !p.is_active) continue;

    const allowance =
      m.spending_allowance_cents != null ? m.spending_allowance_cents :
      p.default_spending_allowance_cents;

    // Catalog whitelist for this program.
    const { data: items, error: iErr } = await supabase
      .from('program_catalog_items')
      .select('product_id')
      .eq('program_id', p.id);
    if (iErr) return res.status(500).json({ error: iErr.message });

    const now = Date.now();
    const opensTs  = p.order_window_opens_at  ? new Date(p.order_window_opens_at).getTime()  : null;
    const closesTs = p.order_window_closes_at ? new Date(p.order_window_closes_at).getTime() : null;
    const isOpen = (opensTs == null || opensTs <= now) && (closesTs == null || closesTs >= now);

    out.push({
      id:              p.id,
      slug:            p.slug,
      name:            p.name,
      cohortLabel:     m.cohort_label || p.cohort_label,
      allowanceCents:  allowance,
      spentCents:      m.spent_cents || 0,
      remainingCents:  allowance != null ? Math.max(0, allowance - (m.spent_cents || 0)) : null,
      windowOpensAt:   p.order_window_opens_at,
      windowClosesAt:  p.order_window_closes_at,
      isOpen,
      catalogProductIds: (items || []).map((i) => i.product_id)
    });
  }

  return res.status(200).json({ programs: out });
};
