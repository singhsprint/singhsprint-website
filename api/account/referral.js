/* =========================================================================
 * /api/account/referral
 *
 * Routes:
 *
 *   GET  /api/account/referral
 *        → { code, shareUrl, settings, stats: { redeemed, qualifying, paid },
 *            referredBy: { code, alreadyApplied: bool } | null }
 *
 *   POST /api/account/referral?action=redeem  body: { code }
 *        → { ok: true }   |   error 4xx
 *        Sets the caller's profiles.referred_by_user_id to the owner of
 *        `code`. Rules:
 *          - caller must NOT have any converted leads yet (must be a new
 *            customer; otherwise referrals are pointless),
 *          - caller must NOT already have a referred_by_user_id,
 *          - caller's own code is rejected (no self-referrals),
 *          - the referrer must exist and be a different user.
 *        The actual $25 credits are NOT issued here — they're emitted by
 *        the CRM-side order-conversion job, which writes credit_ledger
 *        rows when the first qualifying order ships.
 *
 * Note: this endpoint does NOT require the payment-unlock token. Knowing
 * your referral code or applying someone else's isn't sensitive enough to
 * justify a second factor.
 * ========================================================================= */

const { requireUser, setCorsHeaders, readJsonBody } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');

function siteOrigin(req) {
  // Trust the request's host header for share-link construction. If the
  // site is behind a CDN / preview branch, the share link still points at
  // that origin, which is the right behaviour for QA.
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host || 'singhsprint.com';
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  // ------------------------------------------------------------
  // GET ?view=credits — credit balance + ledger (was /api/account/credits;
  // folded in here to stay under the Vercel Hobby 12-function limit)
  // ------------------------------------------------------------
  if (req.method === 'GET' && req.query?.view === 'credits') {
    const REASON_LABEL = {
      referral_referrer: 'Referral reward',
      referral_referee:  'Welcome credit (referred sign-up)',
      order_completed:   'Order loyalty credit',
      manual_adjust:     'Adjustment',
      spent_on_order:    'Applied to order'
    };
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
  }

  // ------------------------------------------------------------
  // GET
  // ------------------------------------------------------------
  if (req.method === 'GET') {
    const profQ = supabase
      .from('profiles')
      .select('referral_code, referred_by_user_id')
      .eq('id', user.id)
      .maybeSingle();
    const settQ = supabase
      .from('referral_settings')
      .select('referrer_credit_cents, referee_credit_cents, min_qualifying_order_cents, referrer_payout_trigger')
      .eq('is_active', true)
      .maybeSingle();

    const [prof, sett] = await Promise.all([profQ, settQ]);
    if (prof.error) return res.status(500).json({ error: prof.error.message });

    // Who has used this user's code, and how far along are they?
    //   redeemed  = signed up with the code
    //   qualifying = signed up AND has at least one converted lead
    //   paid      = the referrer credit was actually issued
    const [refereesRes, paidRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, created_at')
        .eq('referred_by_user_id', user.id),
      supabase
        .from('credit_ledger')
        .select('id, amount_cents, created_at, reference_id, note')
        .eq('user_id', user.id)
        .eq('reason', 'referral_referrer')
        .order('created_at', { ascending: false })
        .limit(50)
    ]);
    if (refereesRes.error) return res.status(500).json({ error: refereesRes.error.message });
    if (paidRes.error)     return res.status(500).json({ error: paidRes.error.message });

    // "Qualifying" = a referee has at least one paid order on file.
    // Join orders → customers → user_id. We count distinct referees with
    // at least one paid order, not total paid orders.
    let qualifyingCount = 0;
    if (refereesRes.data?.length) {
      const refereeIds = refereesRes.data.map((r) => r.id);
      const { data: refCustomers } = await supabase
        .from('customers').select('id, user_id').in('user_id', refereeIds);
      const userIdByCustomerId = {};
      const refCustomerIds = [];
      for (const c of refCustomers || []) {
        userIdByCustomerId[c.id] = c.user_id;
        refCustomerIds.push(c.id);
      }
      if (refCustomerIds.length) {
        const { data: paidOrds } = await supabase
          .from('orders').select('customer_id, paid_status, balance_paid_at')
          .in('customer_id', refCustomerIds);
        const qualifyingUserIds = new Set();
        for (const o of paidOrds || []) {
          const isPaid = /^(paid|refunded)$/i.test(o.paid_status || '')
            || o.balance_paid_at != null;
          if (isPaid) qualifyingUserIds.add(userIdByCustomerId[o.customer_id]);
        }
        qualifyingCount = qualifyingUserIds.size;
      }
    }

    // If the user themselves was referred, surface that.
    let referredBy = null;
    if (prof.data?.referred_by_user_id) {
      const { data: r } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', prof.data.referred_by_user_id)
        .maybeSingle();
      const { count: refereeCredits } = await supabase
        .from('credit_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('reason', 'referral_referee');
      referredBy = {
        code: r?.referral_code || null,
        alreadyApplied: (refereeCredits || 0) > 0
      };
    }

    const code = prof.data?.referral_code || null;
    return res.status(200).json({
      code,
      shareUrl: code ? `${siteOrigin(req)}/?ref=${encodeURIComponent(code)}` : null,
      settings: sett.data || null,
      stats: {
        redeemed:   refereesRes.data?.length || 0,
        qualifying: qualifyingCount,
        paid:       paidRes.data?.length     || 0
      },
      paidEntries: paidRes.data || [],
      referredBy
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const action = req.query?.action || body.action;

  // ------------------------------------------------------------
  // POST ?action=redeem
  // ------------------------------------------------------------
  if (action === 'redeem') {
    const code = String(body.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(code)) return res.status(400).json({ error: 'invalid code format' });

    // 1. Caller must not already be referred.
    const { data: me, error: meErr } = await supabase
      .from('profiles')
      .select('referral_code, referred_by_user_id')
      .eq('id', user.id)
      .maybeSingle();
    if (meErr) return res.status(500).json({ error: meErr.message });
    if (me?.referred_by_user_id) return res.status(409).json({ error: 'a referral code has already been applied' });
    if (me?.referral_code === code) return res.status(400).json({ error: 'you cannot use your own code' });

    // 2. Caller must have no paid orders yet — referral codes are
    //    redeemed before placing a qualifying first order. Walk
    //    orders ← customers ← user_id.
    const { data: myCustomers } = await supabase
      .from('customers').select('id').eq('user_id', user.id);
    const myCustomerIds = (myCustomers || []).map((c) => c.id);
    if (myCustomerIds.length) {
      const { data: myPaidOrds, error: oErr } = await supabase
        .from('orders').select('id, paid_status, balance_paid_at')
        .in('customer_id', myCustomerIds);
      if (oErr) return res.status(500).json({ error: oErr.message });
      const hasPaid = (myPaidOrds || []).some((o) =>
        /^(paid|refunded)$/i.test(o.paid_status || '') || o.balance_paid_at != null);
      if (hasPaid) {
        return res.status(409).json({ error: 'referral codes can only be applied before your first order' });
      }
    }

    // 3. Find the referrer.
    const { data: referrer, error: rErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle();
    if (rErr) return res.status(500).json({ error: rErr.message });
    if (!referrer) return res.status(404).json({ error: 'no account with that code' });
    if (referrer.id === user.id) return res.status(400).json({ error: 'you cannot use your own code' });

    // 4. Apply.
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ referred_by_user_id: referrer.id, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (updErr) return res.status(500).json({ error: updErr.message });

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'unknown action' });
};
