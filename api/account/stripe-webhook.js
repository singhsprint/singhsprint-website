/* =========================================================================
 * /api/account/stripe-webhook
 *
 * Receives Stripe events for the customer-account flow. Currently handled:
 *
 *   setup_intent.succeeded       → insert a saved_cards row for the new
 *                                  PaymentMethod (existing customer
 *                                  Stripe-cards-on-file flow), OR attach
 *                                  the new pm_id to organizations.default
 *                                  _payment_method_id when the SetupIntent
 *                                  was started for an org (metadata
 *                                  .organization_id present).
 *
 *   payment_method.detached      → delete the corresponding saved_cards
 *                                  row, in case detach happens from the
 *                                  Stripe dashboard rather than via our
 *                                  API. Also clears org default_payment
 *                                  _method_id when the detached PM was
 *                                  the org's default.
 *
 *   checkout.session.completed   → student paid their allocation extras
 *                                  (metadata.purpose='allocation_extras').
 *                                  Flip the order's paid_status and
 *                                  customer_extras_paid_at. Covered lines
 *                                  continue to production independently.
 *
 *   invoice.payment_succeeded    → school paid a cohort invoice
 *                                  (metadata.cohort_invoice_id). Flip
 *                                  cohort_invoices.status='paid' and
 *                                  mark every linked order paid_status
 *                                  ='paid'.
 *
 *   invoice.payment_failed       → cohort invoice charge bounced. Logged
 *                                  + cohort_invoices.status stays 'sent'
 *                                  so the operator sees it as still owed.
 *
 * Stripe sends a raw request body and a signature in `Stripe-Signature`.
 * We disable Vercel's default body parsing so we can verify the signature
 * against the byte-for-byte original. This is a hard requirement; without
 * it the signature check will fail intermittently.
 *
 * Configure once: Stripe Dashboard → Developers → Webhooks → "+ Add endpoint"
 *   URL:     https://singhsprint.com/api/account/stripe-webhook
 *   Events:  setup_intent.succeeded, payment_method.detached,
 *            checkout.session.completed, invoice.payment_succeeded,
 *            invoice.payment_failed
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
      const si    = event.data.object;
      const orgId = si.metadata?.organization_id;
      const userId = si.metadata?.supabase_user_id;
      const pmId   = si.payment_method;
      if (!pmId) {
        return res.status(200).json({ received: true, skipped: 'missing payment_method' });
      }

      // Branch: org SetupIntent (metadata.organization_id) vs user
      // SetupIntent (metadata.supabase_user_id). Originally only the
      // user variant existed; the org branch is new for cohort billing.
      if (orgId) {
        const pm = await stripeClient().paymentMethods.retrieve(pmId);
        const last4 =
          pm.card?.last4 ||
          pm.us_bank_account?.last4 ||
          pm.acss_debit?.last4 ||
          null;
        const { error } = await supabase
          .from('organizations')
          .update({
            default_payment_method_id: pmId,
            payment_method_type:       pm.type || null,
            payment_method_last4:      last4,
          })
          .eq('id', orgId);
        if (error) throw error;
        return res.status(200).json({ received: true, scope: 'organization' });
      }

      if (!userId) {
        return res.status(200).json({ received: true, skipped: 'missing org and user metadata' });
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

      return res.status(200).json({ received: true, scope: 'user' });
    }

    if (event.type === 'payment_method.detached') {
      const pm = event.data.object;
      // Clear from saved_cards (user-side).
      await supabase.from('saved_cards').delete().eq('stripe_payment_method_id', pm.id);
      // Clear from organizations (org-side) if it was someone's default.
      await supabase.from('organizations')
        .update({
          default_payment_method_id: null,
          payment_method_type:       null,
          payment_method_last4:      null,
        })
        .eq('default_payment_method_id', pm.id);
      return res.status(200).json({ received: true });
    }

    // ----------------------------------------------------------------
    // checkout.session.completed — student paid their allocation extras.
    // ----------------------------------------------------------------
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const purpose = session.metadata?.purpose;
      const orderId = session.metadata?.order_id;

      if (purpose !== 'allocation_extras' || !orderId) {
        return res.status(200).json({ received: true, skipped: 'not an allocation_extras session' });
      }
      // payment_status === 'paid' is the gate per Stripe docs; session.completed
      // also fires for synchronous-zero-amount sessions, so we re-check here.
      if (session.payment_status !== 'paid') {
        return res.status(200).json({ received: true, skipped: 'session not paid' });
      }
      const { error } = await supabase
        .from('orders')
        .update({
          paid_status:               'paid_extras',
          customer_extras_paid_at:   new Date().toISOString(),
        })
        .eq('id', orderId);
      if (error) throw error;
      return res.status(200).json({ received: true, scope: 'allocation_extras' });
    }

    // ----------------------------------------------------------------
    // invoice.payment_succeeded — school paid a cohort invoice.
    // The CRM-side rollup endpoint writes metadata.cohort_invoice_id on
    // the Stripe invoice; we use it here to fan out the paid_status.
    // ----------------------------------------------------------------
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      const cohortInvoiceId = invoice.metadata?.cohort_invoice_id;
      if (!cohortInvoiceId) {
        return res.status(200).json({ received: true, skipped: 'no cohort_invoice_id metadata' });
      }

      // Mark the cohort invoice row.
      const { error: ciErr } = await supabase
        .from('cohort_invoices')
        .update({
          status:            'paid',
          paid_at:           new Date().toISOString(),
          stripe_invoice_id: invoice.id,
          hosted_invoice_url: invoice.hosted_invoice_url || null,
        })
        .eq('id', cohortInvoiceId);
      if (ciErr) throw ciErr;

      // Fan out: every order linked to this cohort invoice gets paid_status='paid'.
      const { error: ordErr } = await supabase
        .from('orders')
        .update({ paid_status: 'paid', paid: true })
        .eq('cohort_invoice_id', cohortInvoiceId);
      if (ordErr) throw ordErr;

      return res.status(200).json({ received: true, scope: 'cohort_invoice' });
    }

    // ----------------------------------------------------------------
    // invoice.payment_failed — school's auto-charge bounced.
    // ----------------------------------------------------------------
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const cohortInvoiceId = invoice.metadata?.cohort_invoice_id;
      if (!cohortInvoiceId) {
        return res.status(200).json({ received: true, skipped: 'no cohort_invoice_id metadata' });
      }
      // We don't flip status to 'failed' — Stripe will keep retrying per
      // its dunning settings. We just log so the operator can see it on
      // their next dashboard load. (Future: store last_failure_at on the
      // cohort_invoices row.)
      console.warn('[stripe-webhook] cohort invoice payment failed', cohortInvoiceId, invoice.id);
      return res.status(200).json({ received: true, scope: 'cohort_invoice_failed' });
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
