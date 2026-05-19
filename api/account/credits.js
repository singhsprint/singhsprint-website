/* =========================================================================
 * /api/account/credits
 *
 * Read-only view of the caller's credit ledger.
 *
 *   GET /api/account/credits
 *     → { balanceCents, entries: [{ id, amountCents, reason,
 *                                    referenceId, note, createdAt }] }
 *
 * The balance comes from the cached profiles.credit_balance_cents (kept
 * in sync by the after-insert trigger on credit_ledger). The entries list
 * is the underlying ledger so users can see exactly where each credit
 * came from.
 *
 * Credits are issued server-side from the CRM order-conversion job; this
 * endpoint never writes.
 * ========================================================================= */

const { requireUser, setCorsHeaders } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');

const REASON_LABEL = {
  referral_referrer: 'Referral reward',
  referral_referee:  'Welcome credit (referred sign-up)',
  order_completed:   'Order loyalty credit',
  manual_adjust:     'Adjustment',
  spent_on_order:    'Applied to order'
};

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'method not allowed' });

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  const [profRes, ledgerRes] = await Promise.all([
    supabase.from('profiles').select('credit_balance_cents').eq('id', user.id).maybeSingle(),
    supabase
      .from('credit_ledger')
      .select('id, amount_cents, reason, reference_id, note, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
  ]);
  if (profRes.error)   return res.status(500).json({ error: profRes.error.message });
  if (ledgerRes.error) return res.status(500).json({ error: ledgerRes.error.message });

  return res.status(200).json({
    balanceCents: profRes.data?.credit_balance_cents || 0,
    entries: (ledgerRes.data || []).map((e) => ({
      id:          e.id,
      amountCents: e.amount_cents,
      reason:      e.reason,
      reasonLabel: REASON_LABEL[e.reason] || e.reason,
      referenceId: e.reference_id,
      note:        e.note,
      createdAt:   e.created_at
    }))
  });
};
