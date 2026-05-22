/* =========================================================================
 * /api/account/payment-methods
 *
 * Manage an organization's saved payment methods. Used for cohort
 * invoice billing — when the operator clicks "Create cohort invoice"
 * on the CRM, the Stripe invoice is charged automatically against the
 * org's default payment method.
 *
 * Two payment-method types supported:
 *   - 'card'              (Visa / MC / Amex)
 *   - 'acss_debit'        (Canadian Pre-Authorized Debit — direct deposit)
 *   - 'us_bank_account'   (US ACH, for future US schools)
 *
 * The school admin (org owner) is the only role that can manage these.
 * Membership is verified against organization_members.role='owner'.
 *
 * Routes:
 *
 *   GET /api/account/payment-methods?organizationId=...
 *     → { paymentMethods: [{ id, type, last4, brand?, isDefault,
 *                            bankName?, accountHolderType? }],
 *         defaultPaymentMethodId, billingEmail }
 *
 *   POST /api/account/payment-methods?action=setup-intent
 *     body: { organizationId, paymentMethodType }
 *     → { clientSecret, stripeCustomerId, publishableKey }
 *     Browser then confirms the SetupIntent with Stripe Elements.
 *     On success the stripe-webhook setup_intent.succeeded handler
 *     sees metadata.organization_id and sets the default PM.
 *
 *   POST /api/account/payment-methods?action=set-default
 *     body: { organizationId, paymentMethodId }
 *     → { ok: true }
 *
 *   POST /api/account/payment-methods?action=set-billing-email
 *     body: { organizationId, billingEmail }
 *     → { ok: true }
 *
 *   DELETE /api/account/payment-methods
 *     body: { organizationId, paymentMethodId }
 *     → 204 No Content
 *     Detaches from Stripe. If it was the default, default is cleared
 *     by the stripe-webhook payment_method.detached handler.
 *
 * Note: this is the ORG payment-method endpoint. The customer's personal
 * saved-cards endpoint is /api/account/cards (unchanged).
 * ========================================================================= */

const Stripe = require('stripe');
const { requireUser, setCorsHeaders, readJsonBody } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing env var STRIPE_SECRET_KEY');
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

// Verify the caller is an owner of the given organization. Returns the
// org row on success; sends a 403 / 404 on failure (caller should
// return the response).
async function requireOrgOwner(supabase, user, organizationId, res) {
  if (!organizationId) {
    res.status(400).json({ error: 'organizationId required' });
    return null;
  }
  const { data: membership, error: mErr } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (mErr) { res.status(500).json({ error: mErr.message }); return null; }
  if (!membership) { res.status(403).json({ error: 'not a member of this organization' }); return null; }
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    res.status(403).json({ error: 'owner or admin role required' });
    return null;
  }
  const { data: org, error: oErr } = await supabase
    .from('organizations')
    .select('id, name, stripe_customer_id, default_payment_method_id, payment_method_type, payment_method_last4, billing_email')
    .eq('id', organizationId).maybeSingle();
  if (oErr) { res.status(500).json({ error: oErr.message }); return null; }
  if (!org)  { res.status(404).json({ error: 'organization not found' }); return null; }
  return org;
}

// Create-or-fetch the Stripe Customer for an org. Stored on
// organizations.stripe_customer_id so subsequent SetupIntents reuse it.
async function ensureOrgStripeCustomer(supabase, org, fallbackEmail) {
  if (org.stripe_customer_id) return org.stripe_customer_id;
  const stripe = stripeClient();
  const customer = await stripe.customers.create({
    name:  org.name || undefined,
    email: org.billing_email || fallbackEmail || undefined,
    metadata: { organization_id: org.id },
  });
  const { error } = await supabase
    .from('organizations')
    .update({ stripe_customer_id: customer.id })
    .eq('id', org.id);
  if (error) throw error;
  return customer.id;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  // -----------------------------------------------------------------
  // GET — list org payment methods (from Stripe — single source of truth)
  // -----------------------------------------------------------------
  if (req.method === 'GET') {
    const organizationId = req.query?.organizationId;
    const org = await requireOrgOwner(supabase, user, organizationId, res);
    if (!org) return; // response already sent

    // No Stripe customer yet → no payment methods. Return empty + the cached
    // billing email so the UI can render the "Add a payment method" CTA.
    if (!org.stripe_customer_id) {
      return res.status(200).json({
        paymentMethods:         [],
        defaultPaymentMethodId: null,
        billingEmail:           org.billing_email || null,
      });
    }

    const stripe = stripeClient();
    // Fetch all PM types we support, then merge. Stripe doesn't have a
    // "list all types" endpoint; type is required.
    const pmTypes = ['card', 'acss_debit', 'us_bank_account'];
    const all = [];
    for (const t of pmTypes) {
      try {
        const list = await stripe.paymentMethods.list({
          customer: org.stripe_customer_id,
          type:     t,
        });
        for (const pm of list.data) all.push(pm);
      } catch (e) {
        // Some account regions don't have certain types enabled; ignore.
        if (!/payment_method_type_unsupported|not.*enabled/i.test(e.message || '')) {
          throw e;
        }
      }
    }

    const paymentMethods = all.map((pm) => ({
      id:                pm.id,
      type:              pm.type,
      isDefault:         pm.id === org.default_payment_method_id,
      brand:             pm.card?.brand || null,
      last4:             pm.card?.last4 || pm.us_bank_account?.last4 || pm.acss_debit?.last4 || null,
      expMonth:          pm.card?.exp_month || null,
      expYear:           pm.card?.exp_year || null,
      bankName:          pm.us_bank_account?.bank_name || pm.acss_debit?.institution_number || null,
      accountHolderType: pm.us_bank_account?.account_holder_type || pm.acss_debit?.account_holder_type || null,
    }));

    return res.status(200).json({
      paymentMethods,
      defaultPaymentMethodId: org.default_payment_method_id || null,
      billingEmail:           org.billing_email || null,
    });
  }

  // -----------------------------------------------------------------
  // POST — actions: setup-intent / set-default / set-billing-email
  // -----------------------------------------------------------------
  if (req.method === 'POST') {
    let body = {};
    try { body = await readJsonBody(req); }
    catch (e) { return res.status(400).json({ error: e.message }); }

    const action = req.query?.action || body.action;
    const org = await requireOrgOwner(supabase, user, body.organizationId, res);
    if (!org) return;

    // ---------------- setup-intent ----------------
    if (action === 'setup-intent') {
      const t = body.paymentMethodType;
      const allowed = ['card', 'acss_debit', 'us_bank_account'];
      if (!allowed.includes(t)) {
        return res.status(400).json({ error: `paymentMethodType must be one of ${allowed.join(',')}` });
      }

      let customerId;
      try { customerId = await ensureOrgStripeCustomer(supabase, org, user.email); }
      catch (e) { return res.status(500).json({ error: e.message }); }

      const stripe = stripeClient();
      // payment_method_options shape differs per type:
      //   card                → no extra options needed
      //   acss_debit / ach    → mandate options required for off-session billing
      const pmo = {};
      if (t === 'acss_debit') {
        pmo.acss_debit = {
          mandate_options: {
            payment_schedule:  'sporadic',  // cohort invoices are bursty
            transaction_type:  'business',
          },
        };
      }
      if (t === 'us_bank_account') {
        pmo.us_bank_account = {
          verification_method: 'instant',   // Stripe Financial Connections
        };
      }

      const intent = await stripe.setupIntents.create({
        customer:             customerId,
        payment_method_types: [t],
        usage:                'off_session',
        payment_method_options: pmo,
        metadata: {
          organization_id: org.id,
          initiated_by:    user.id,
        },
      });

      return res.status(200).json({
        clientSecret:     intent.client_secret,
        stripeCustomerId: customerId,
        publishableKey:   process.env.PUBLIC_STRIPE_PUBLISHABLE_KEY || null,
      });
    }

    // ---------------- set-default ----------------
    if (action === 'set-default') {
      if (!body.paymentMethodId) return res.status(400).json({ error: 'paymentMethodId required' });
      if (!org.stripe_customer_id) {
        return res.status(400).json({ error: 'no payment methods on file' });
      }

      // Verify PM belongs to this org's customer.
      const stripe = stripeClient();
      let pm;
      try { pm = await stripe.paymentMethods.retrieve(body.paymentMethodId); }
      catch (e) { return res.status(404).json({ error: 'payment method not found' }); }
      if (pm.customer !== org.stripe_customer_id) {
        return res.status(403).json({ error: 'payment method does not belong to this organization' });
      }

      const last4 = pm.card?.last4 || pm.us_bank_account?.last4 || pm.acss_debit?.last4 || null;
      const { error } = await supabase
        .from('organizations')
        .update({
          default_payment_method_id: pm.id,
          payment_method_type:       pm.type,
          payment_method_last4:      last4,
        })
        .eq('id', org.id);
      if (error) return res.status(500).json({ error: error.message });

      // Also set as the Stripe Customer's invoice default so cohort invoices
      // created later automatically use it.
      try {
        await stripe.customers.update(org.stripe_customer_id, {
          invoice_settings: { default_payment_method: pm.id },
        });
      } catch (e) {
        // Non-fatal — we still have our own default_payment_method_id.
        // eslint-disable-next-line no-console
        console.warn('[payment-methods] customer.update failed:', e.message);
      }

      return res.status(200).json({ ok: true });
    }

    // ---------------- set-billing-email ----------------
    if (action === 'set-billing-email') {
      const email = (body.billingEmail || '').trim();
      // Basic format check; Stripe rejects bad addresses on its end.
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: 'invalid email format' });
      }
      const { error } = await supabase
        .from('organizations')
        .update({ billing_email: email || null })
        .eq('id', org.id);
      if (error) return res.status(500).json({ error: error.message });

      // Mirror to Stripe so invoices are emailed correctly.
      if (org.stripe_customer_id) {
        try {
          await stripeClient().customers.update(org.stripe_customer_id, { email: email || undefined });
        } catch (e) {
          console.warn('[payment-methods] customer.update email failed:', e.message);
        }
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `unknown action ${action}` });
  }

  // -----------------------------------------------------------------
  // DELETE — detach a payment method
  // -----------------------------------------------------------------
  if (req.method === 'DELETE') {
    let body = {};
    try { body = await readJsonBody(req); }
    catch (e) { return res.status(400).json({ error: e.message }); }

    const org = await requireOrgOwner(supabase, user, body.organizationId, res);
    if (!org) return;

    if (!body.paymentMethodId) return res.status(400).json({ error: 'paymentMethodId required' });
    if (!org.stripe_customer_id) return res.status(404).json({ error: 'no payment methods on file' });

    const stripe = stripeClient();
    let pm;
    try { pm = await stripe.paymentMethods.retrieve(body.paymentMethodId); }
    catch (e) { return res.status(404).json({ error: 'payment method not found' }); }
    if (pm.customer !== org.stripe_customer_id) {
      return res.status(403).json({ error: 'payment method does not belong to this organization' });
    }

    try { await stripe.paymentMethods.detach(body.paymentMethodId); }
    catch (e) {
      if (!/already been detached|No such PaymentMethod/i.test(e.message || '')) {
        return res.status(500).json({ error: e.message });
      }
    }
    // The stripe-webhook payment_method.detached handler clears the org's
    // default_payment_method_id if this was the default. Belt-and-suspenders
    // we also clear here in case the webhook hasn't run yet.
    if (org.default_payment_method_id === body.paymentMethodId) {
      await supabase
        .from('organizations')
        .update({
          default_payment_method_id: null,
          payment_method_type:       null,
          payment_method_last4:      null,
        })
        .eq('id', org.id);
    }
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'method not allowed' });
};
