/* =========================================================================
 * /api/account/stripe-webhook
 *
 * Receives Stripe events for the customer-account flow. Currently handled:
 *
 *   setup_intent.succeeded  → insert a saved_cards row for the new
 *                             PaymentMethod. We use the SetupIntent's
 *                             metadata.supabase_user_id (set when the
 *                             intent was created in /api/account/cards)
 *                             to know which user to attach the card to.
 *
 *   payment_method.detached → delete the corresponding saved_cards row,
 *                             in case detach happens from the Stripe
 *                             dashboard rather than via our API.
 *
 * Stripe sends a raw request body and a signature in `Stripe-Signature`.
 * We disable Vercel's default body parsing so we can verify the signature
 * against the byte-for-byte original. This is a hard requirement; without
 * it the signature check will fail intermittently.
 *
 * Configure once: Stripe Dashboard → Developers → Webhooks → "+ Add endpoint"
 *   URL:     https://singhsprint.com/api/account/stripe-webhook
 *   Events:  setup_intent.succeeded, payment_method.detached
 *   Signing secret → copy into Vercel env STRIPE_WEBHOOK_SECRET.
 * ========================================================================= */

const Stripe = require('stripe');
const { adminClient } = require('../_lib/supabase');

function stripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return res.status(400).send('missing signature or secret');

  let raw;
  try { raw = await readRawBody(req); }
  catch (e) { return res.status(400).send(`body read failed: ${e.message}`); }

  let event;
  try { event = stripeClient().webhooks.constructEvent(raw, sig, secret); }
  catch (e) { return res.status(400).send(`signature verification failed: ${e.message}`); }

  const supabase = adminClient();

  try {
    if (event.type === 'setup_intent.succeeded') {
      const si = event.data.object;
      const userId = si.metadata?.supabase_user_id;
      const pmId   = si.payment_method;
      if (!userId || !pmId) {
        // Not one of ours; ack so Stripe doesn't retry forever.
        return res.status(200).json({ received: true, skipped: 'missing metadata or payment_method' });
      }

      const pm = await stripeClient().paymentMethods.retrieve(pmId);
      const card = pm.card || {};

      // Idempotency: stripe_payment_method_id is unique, so a duplicate
      // event from Stripe (which retries on 5xx) will hit conflict-do-nothing.
      const { error } = await supabase
        .from('saved_cards')
        .upsert({
          user_id:                  userId,
          stripe_payment_method_id: pmId,
          brand:                    card.brand   || null,
          last4:                    card.last4   || null,
          exp_month:                card.exp_month || null,
          exp_year:                 card.exp_year  || null
        }, { onConflict: 'stripe_payment_method_id' });
      if (error) throw error;

      return res.status(200).json({ received: true });
    }

    if (event.type === 'payment_method.detached') {
      const pm = event.data.object;
      const { error } = await supabase
        .from('saved_cards')
        .delete()
        .eq('stripe_payment_method_id', pm.id);
      if (error) throw error;
      return res.status(200).json({ received: true });
    }

    // Unhandled event types are still ACKed so Stripe stops retrying.
    return res.status(200).json({ received: true, ignored: event.type });
  } catch (e) {
    // Return 500 → Stripe will retry with exponential backoff.
    console.error('[stripe-webhook]', event.type, e);
    return res.status(500).json({ error: e.message });
  }
};

// Vercel: disable the default body parser so signature verification gets
// the raw request body byte-for-byte. MUST be set AFTER `module.exports =`
// is assigned the handler; otherwise the handler assignment overwrites it.
module.exports.config = { api: { bodyParser: false } };
