/* =========================================================================
 * /api/account/cards
 *
 * Manage the customer's saved payment methods. Every verb requires:
 *   - A valid Supabase access token  (Authorization: Bearer ...)
 *   - A valid payment-unlock token   (X-Payment-Unlock: ...)
 *
 * The unlock token is issued by /api/account/payment-password (action=verify)
 * after the customer enters their payment password. It is bound to the
 * caller's user_id and expires in PAYMENT_UNLOCK_TTL_SECONDS.
 *
 * Routes:
 *
 *   GET  /api/account/cards
 *     → { cards: [{ id, brand, last4, exp_month, exp_year, label,
 *                   is_default, created_at }] }
 *
 *   POST /api/account/cards
 *     body: { returnUrl? }
 *     → { clientSecret, stripeCustomerId, publishableKey }
 *     The browser uses { clientSecret, publishableKey } with Stripe Elements
 *     to confirm a SetupIntent. On success Stripe fires a webhook to
 *     /api/account/stripe-webhook which inserts the saved_cards row.
 *
 *   DELETE /api/account/cards
 *     body: { id }            // saved_cards.id  (UUID)
 *     → 204 No Content
 *     Detaches the PaymentMethod from Stripe AND deletes the local row.
 *
 *   POST /api/account/cards?action=set-default
 *     body: { id }
 *     → { ok: true }
 *
 * The Stripe customer is created lazily on first POST. We store
 * profiles.stripe_customer_id so subsequent saves reuse the same customer.
 * ========================================================================= */

const Stripe = require('stripe');
const { requireUser, setCorsHeaders, readJsonBody } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');
const { verifyUnlockToken } = require('../_lib/payment-password');

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing env var STRIPE_SECRET_KEY');
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

function requireUnlock(req, userId) {
  const token = req.headers['x-payment-unlock'];
  if (!token || !verifyUnlockToken(token, userId)) {
    return { ok: false, status: 401, body: { error: 'payment-unlock token missing or invalid' } };
  }
  return { ok: true };
}

async function ensureStripeCustomer(supabase, user) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email, phone, display_name')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const stripe = stripeClient();
  const customer = await stripe.customers.create({
    email: profile?.email || user.email || undefined,
    phone: profile?.phone || user.phone || undefined,
    name:  profile?.display_name || undefined,
    metadata: { supabase_user_id: user.id }
  });

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (updErr) throw updErr;

  return customer.id;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const unlock = requireUnlock(req, user.id);
  if (!unlock.ok) return res.status(unlock.status).json(unlock.body);

  const supabase = adminClient();

  // ------------------------------------------------------------
  // GET — list this user's saved cards
  // ------------------------------------------------------------
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('saved_cards')
      .select('id, brand, last4, exp_month, exp_year, label, is_default, created_at')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ cards: data || [] });
  }

  let body = {};
  if (req.method === 'POST' || req.method === 'DELETE') {
    try { body = await readJsonBody(req); }
    catch (e) { return res.status(400).json({ error: e.message }); }
  }
  const action = req.query?.action || body.action;

  // ------------------------------------------------------------
  // POST ?action=set-default
  // ------------------------------------------------------------
  if (req.method === 'POST' && action === 'set-default') {
    if (!body.id) return res.status(400).json({ error: 'id required' });
    // Verify ownership first; service-role bypasses RLS so we must check.
    const { data: card, error: rErr } = await supabase
      .from('saved_cards').select('id, user_id').eq('id', body.id).maybeSingle();
    if (rErr || !card || card.user_id !== user.id) return res.status(404).json({ error: 'card not found' });
    // Atomically: clear other defaults, then set this one.
    const off = await supabase.from('saved_cards').update({ is_default: false }).eq('user_id', user.id);
    if (off.error) return res.status(500).json({ error: off.error.message });
    const on  = await supabase.from('saved_cards').update({ is_default: true  }).eq('id', body.id);
    if (on.error)  return res.status(500).json({ error: on.error.message });
    return res.status(200).json({ ok: true });
  }

  // ------------------------------------------------------------
  // POST (default) — start the add-a-card flow (SetupIntent)
  // ------------------------------------------------------------
  if (req.method === 'POST') {
    let customerId;
    try { customerId = await ensureStripeCustomer(supabase, user); }
    catch (e) { return res.status(500).json({ error: e.message || 'failed to create stripe customer' }); }

    const stripe = stripeClient();
    const intent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: { supabase_user_id: user.id }
    });

    return res.status(200).json({
      clientSecret:     intent.client_secret,
      stripeCustomerId: customerId,
      publishableKey:   process.env.PUBLIC_STRIPE_PUBLISHABLE_KEY || null
    });
  }

  // ------------------------------------------------------------
  // DELETE — detach payment method + delete local row
  // ------------------------------------------------------------
  if (req.method === 'DELETE') {
    if (!body.id) return res.status(400).json({ error: 'id required' });

    const { data: card, error: rErr } = await supabase
      .from('saved_cards')
      .select('id, user_id, stripe_payment_method_id')
      .eq('id', body.id)
      .maybeSingle();
    if (rErr || !card || card.user_id !== user.id) return res.status(404).json({ error: 'card not found' });

    try {
      await stripeClient().paymentMethods.detach(card.stripe_payment_method_id);
    } catch (e) {
      // If Stripe says it's already detached, fall through to delete the row.
      if (!/No such PaymentMethod|already been detached/i.test(e.message || '')) {
        return res.status(502).json({ error: `stripe detach failed: ${e.message}` });
      }
    }
    const { error: delErr } = await supabase.from('saved_cards').delete().eq('id', card.id);
    if (delErr) return res.status(500).json({ error: delErr.message });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'method not allowed' });
};
