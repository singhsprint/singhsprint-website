/* =========================================================================
 * /api/account/credits
 *
 * Read-only view of the caller's credit — BOTH systems:
 *
 *   1. Referral credit — credit_ledger keyed by auth user_id, balance
 *      cached on profiles.credit_balance_cents (kept in sync by the
 *      after-insert trigger). Earned via the referral program.
 *
 *   2. Store credit (2026-07-25) — store_credit_ledger keyed by the
 *      CRM's contacts.id. This is the credit the SHOP grants (refund to
 *      credit, goodwill, loyalty) and applies to invoices from the CRM.
 *      Until now the portal never showed it, so a customer with $40 of
 *      shop credit saw $0 here. We resolve the caller's contact rows by
 *      their sign-in email (exact, case-insensitive) and sum the ledger.
 *
 *   GET /api/account/credits
 *     → { balanceCents,                 // combined total (what the tile shows)
 *         referralCents, storeCreditCents,
 *         entries: [{ id, amountCents, reason, reasonLabel,
 *                     source: 'referral'|'store', referenceId, note, createdAt }] }
 *
 * This endpoint never writes.
 * ========================================================================= */

const { requireUser, setCorsHeaders } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');

const REASON_LABEL = {
  referral_referrer: 'Referral reward',
  referral_referee:  'Welcome credit (referred sign-up)',
  order_completed:   'Order loyalty credit',
  manual_adjust:     'Adjustment',
  spent_on_order:    'Applied to order',
  // store_credit_ledger kinds
  grant:             'Credit from Singhs Print',
  refund:            'Refund to credit',
  adjustment:        'Adjustment',
  redemption:        'Applied to an invoice'
};

// Exact case-insensitive ilike (escape wildcards so "_" in an email can't
// match a different person's address).
function ilikeExact(s) {
  return String(s).replace(/([%_\\])/g, '\\$1');
}

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

  // ── Store credit (CRM-granted), matched by sign-in email. Best-effort:
  //    a hiccup here must never hide the referral balance. ──────────────
  let storeCreditCents = 0;
  let storeEntries = [];
  const email = (user.email || '').trim();
  if (email) {
    try {
      const { data: contacts } = await supabase
        .from('contacts').select('id').ilike('email', ilikeExact(email)).limit(10);
      const contactIds = (contacts || []).map((c) => c.id);
      if (contactIds.length) {
        const { data: rows } = await supabase
          .from('store_credit_ledger')
          .select('id, amount_cents, kind, note, order_id, created_at')
          .in('contact_id', contactIds)
          .order('created_at', { ascending: false })
          .limit(100);
        storeEntries = rows || [];
        storeCreditCents = storeEntries.reduce((s, e) => s + Number(e.amount_cents || 0), 0);
      }
    } catch (_) { /* best-effort — referral credit still returns below */ }
  }

  const referralCents = profRes.data?.credit_balance_cents || 0;

  const entries = [
    ...(ledgerRes.data || []).map((e) => ({
      id:          e.id,
      amountCents: e.amount_cents,
      reason:      e.reason,
      reasonLabel: REASON_LABEL[e.reason] || e.reason,
      source:      'referral',
      referenceId: e.reference_id,
      note:        e.note,
      createdAt:   e.created_at
    })),
    ...storeEntries.map((e) => ({
      id:          e.id,
      amountCents: e.amount_cents,
      reason:      e.kind,
      reasonLabel: REASON_LABEL[e.kind] || e.kind,
      source:      'store',
      referenceId: e.order_id,
      note:        e.note,
      createdAt:   e.created_at
    }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.status(200).json({
    balanceCents: referralCents + Math.max(0, storeCreditCents),
    referralCents,
    storeCreditCents: Math.max(0, storeCreditCents),
    entries
  });
};
