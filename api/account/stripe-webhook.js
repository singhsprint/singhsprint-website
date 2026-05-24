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
    // checkout.session.completed — branches by metadata.purpose:
    //   'allocation_extras' → student paid their allocation extras
    //   'drop_purchase'     → DTC buyer paid for a /shop/{slug} drop
    // ----------------------------------------------------------------
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const purpose = session.metadata?.purpose;

      // payment_status === 'paid' is the gate per Stripe docs; session.completed
      // also fires for synchronous-zero-amount sessions, so we re-check here.
      if (session.payment_status !== 'paid') {
        return res.status(200).json({ received: true, skipped: 'session not paid' });
      }

      if (purpose === 'allocation_extras') {
        const orderId = session.metadata?.order_id;
        if (!orderId) {
          return res.status(200).json({ received: true, skipped: 'allocation_extras without order_id' });
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

      if (purpose === 'drop_purchase') {
        const dropId = session.metadata?.drop_id;
        if (!dropId) {
          return res.status(200).json({ received: true, skipped: 'drop_purchase without drop_id' });
        }
        // Idempotent: stripe_session_id is UNIQUE on drop_orders. Stripe
        // retries on 5xx, so an upsert with onConflict='stripe_session_id'
        // keeps us safe from duplicate writes.
        const customerDetails = session.customer_details || {};
        const totalDetails = session.total_details || {};
        const orderRow = {
          drop_id:                   dropId,
          stripe_session_id:         session.id,
          stripe_payment_intent_id:  session.payment_intent || null,
          customer_email:            customerDetails.email || session.customer_email || null,
          amount_total_cents:        session.amount_total ?? null,
          amount_subtotal_cents:     session.amount_subtotal ?? null,
          tax_cents:                 totalDetails.amount_tax ?? null,
          currency:                  (session.currency || 'cad').toUpperCase(),
          status:                    'paid',
          shipping_name:             session.shipping_details?.name || customerDetails.name || null,
          shipping_address:          session.shipping_details?.address || customerDetails.address || null,
          raw_session:               session,
          paid_at:                   new Date().toISOString(),
        };
        const { error } = await supabase
          .from('drop_orders')
          .upsert(orderRow, { onConflict: 'stripe_session_id' });
        if (error) throw error;

        // Server-side CAPI Purchase event. Fires reliably regardless of
        // whether the customer returns to /shop/{slug}?paid=1. Uses the
        // Stripe session.id as a deterministic event_id so if the client
        // page DID get there and fired its own Purchase (it shouldn't —
        // we removed that branch), Meta dedups via matching event_id.
        try {
          const proto = req.headers['x-forwarded-proto'] || 'https';
          const host  = req.headers.host || 'singhsprint.com';
          const value = (session.amount_total ?? session.amount_subtotal ?? 0) / 100;
          await fetch(`${proto}://${host}/api/meta-capi`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_name:       'Purchase',
              event_id:         `drop_purchase_${session.id}`,    // deterministic
              event_time:       Math.floor(Date.now() / 1000),
              event_source_url: `${proto}://${host}/shop/${session.metadata?.drop_slug || ''}`,
              action_source:    'website',
              user_data: {
                em:      customerDetails.email || session.customer_email || undefined,
                ph:      customerDetails.phone || undefined,
                fn:      (customerDetails.name || '').split(' ').slice(0, 1).join(' ') || undefined,
                ln:      (customerDetails.name || '').split(' ').slice(1).join(' ') || undefined,
                ct:      customerDetails.address?.city || undefined,
                st:      customerDetails.address?.state || undefined,
                zp:      customerDetails.address?.postal_code || undefined,
                country: customerDetails.address?.country || undefined,
              },
              custom_data: {
                value,
                currency:     (session.currency || 'cad').toUpperCase(),
                content_ids:  [session.metadata?.drop_slug].filter(Boolean),
                content_type: 'product',
                content_name: session.metadata?.drop_slug || undefined,
                num_items:    1,
              },
            }),
          });
        } catch (capiErr) {
          console.error('[stripe-webhook] CAPI Purchase POST failed:', capiErr);
        }

        // Fire-and-forget confirmation email via the CRM. Optional — Stripe
        // sends its own receipt regardless. If CRM_BASE_URL or the secret
        // aren't set, we silently skip (no need to break the webhook).
        const crmUrl  = process.env.CRM_BASE_URL;
        const crmSec  = process.env.CRM_WEBHOOK_SECRET;
        if (crmUrl && crmSec) {
          try {
            await fetch(`${crmUrl}/api/drops-email`, {
              method: 'POST',
              headers: {
                'Content-Type':  'application/json',
                'x-singhs-secret': crmSec,
              },
              body: JSON.stringify({ drop_id: dropId, order: orderRow }),
            });
          } catch (mailErr) {
            console.error('[stripe-webhook] drops-email POST failed:', mailErr);
          }
        }
        return res.status(200).json({ received: true, scope: 'drop_purchase' });
      }

      return res.status(200).json({ received: true, skipped: `unrecognized purpose: ${purpose}` });
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
