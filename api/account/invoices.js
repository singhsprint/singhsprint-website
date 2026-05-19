/* =========================================================================
 * /api/account/invoices — business-only, read-only
 *
 * Lists the caller's Stripe invoices. Invoices themselves are created and
 * emailed FROM Stripe (Stripe Dashboard → Invoices → Create or via API);
 * this endpoint is just a read-through so business customers can see
 * their invoice history inside the portal without bouncing to a separate
 * Stripe login.
 *
 * Why a read-through and not a sync to a local table:
 *   - Invoice state (draft → open → paid / void / uncollectible) changes
 *     in Stripe based on customer actions (manual pay, ACH clearance) and
 *     scheduled processes. Mirroring it locally means stale data the
 *     moment Stripe transitions a row.
 *   - The "hosted_invoice_url" Stripe returns is the canonical place a
 *     customer pays — we surface that link verbatim.
 *
 * Routes:
 *
 *   GET /api/account/invoices
 *     → { invoices: [{ id, number, status, currency, amountDueCents,
 *                       amountPaidCents, dueDate, periodStart, periodEnd,
 *                       hostedInvoiceUrl, pdfUrl, createdAt }],
 *         hasStripeCustomer: bool }
 *
 *   GET /api/account/invoices?action=portal-session
 *     → { portalUrl }
 *     Stripe Billing Portal one-time session URL — bounces the customer
 *     to their full Stripe-hosted invoices + payment-methods page.
 *     Optional but useful for "manage everything in Stripe".
 *
 * Gating: account_type='business' (matches team / artwork endpoints).
 * The Bearer token alone is required — NOT the payment-unlock token —
 * since reading invoices isn't a card action.
 * ========================================================================= */

const Stripe = require('stripe');
const { requireUser, setCorsHeaders, readJsonBody } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');
const { requireBusiness } = require('../_lib/business');

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing env var STRIPE_SECRET_KEY');
  return new Stripe(key, { apiVersion: '2024-06-20' });
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query?.action;
  const isPortalAction = action === 'portal' || action === 'portal-session';

  // Portal action accepts GET or POST. Default invoice-list is GET only.
  if (!isPortalAction && req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  // Invoice LIST is a business-tier feature (B2B invoice history view).
  // Billing portal is available to ANY customer with a Stripe profile —
  // it's their own data and Stripe enforces auth on the hosted page.
  if (!isPortalAction) {
    try { await requireBusiness(supabase, user.id); }
    catch (e) { return res.status(e.status || 500).json(e.body || { error: 'business gate failed' }); }
  }

  // Look up the Stripe customer the saved-cards flow created lazily.
  // If absent, the business has no invoices yet — return empty list.
  const { data: prof, error: pErr } = await supabase
    .from('profiles').select('stripe_customer_id')
    .eq('id', user.id).maybeSingle();
  if (pErr) return res.status(500).json({ error: pErr.message });

  if (!prof?.stripe_customer_id) {
    if (isPortalAction) {
      return res.status(409).json({
        error: 'No Stripe customer yet. Add a card or pay an invoice first to set one up.'
      });
    }
    return res.status(200).json({ invoices: [], hasStripeCustomer: false });
  }

  const stripe = stripeClient();

  // ------------------------------------------------------------
  // ?action=portal — bounce to Stripe Billing Portal. Accepts an
  // optional returnTo URL in the POST body; falls back to the
  // orders page.
  // ------------------------------------------------------------
  if (isPortalAction) {
    let body = {};
    if (req.method === 'POST') {
      try { body = await readJsonBody(req); } catch (_) { /* body optional */ }
    }
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host  = req.headers['x-forwarded-host']  || req.headers.host || 'singhsprint.com';
    let returnTo = body.returnTo || `${proto}://${host}/account/orders.html`;
    // Defensive: only allow http(s) targets to avoid open-redirect-style abuse.
    if (!/^https?:\/\//i.test(returnTo)) returnTo = `${proto}://${host}/account/orders.html`;
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer:   prof.stripe_customer_id,
        return_url: returnTo
      });
      // Return both keys for forward-compat with any existing callers.
      return res.status(200).json({ url: session.url, portalUrl: session.url });
    } catch (e) {
      // Most common cause: billing portal not configured in Stripe
      // Dashboard → Settings → Billing → Customer portal.
      return res.status(502).json({
        error: 'Stripe billing portal not configured. Activate it under Stripe → Settings → Billing → Customer portal.',
        stripeMessage: e.message
      });
    }
  }

  // ------------------------------------------------------------
  // Default GET — list invoices
  // ------------------------------------------------------------
  let invoicesList;
  try {
    invoicesList = await stripe.invoices.list({
      customer: prof.stripe_customer_id,
      limit:    100
    });
  } catch (e) {
    return res.status(502).json({ error: 'Stripe list failed', stripeMessage: e.message });
  }

  const invoices = (invoicesList.data || []).map((inv) => ({
    id:                inv.id,
    number:            inv.number,                       // "INV-0042"
    status:            inv.status,                       // draft|open|paid|void|uncollectible
    currency:          inv.currency,
    amountDueCents:    inv.amount_due,
    amountPaidCents:   inv.amount_paid,
    amountRemaining:   inv.amount_remaining,
    dueDate:           inv.due_date    ? new Date(inv.due_date    * 1000).toISOString() : null,
    periodStart:       inv.period_start? new Date(inv.period_start* 1000).toISOString() : null,
    periodEnd:         inv.period_end  ? new Date(inv.period_end  * 1000).toISOString() : null,
    createdAt:         inv.created     ? new Date(inv.created     * 1000).toISOString() : null,
    hostedInvoiceUrl:  inv.hosted_invoice_url,           // customer-facing payment page
    pdfUrl:            inv.invoice_pdf                   // direct PDF download
  }));

  return res.status(200).json({
    invoices,
    hasStripeCustomer: true,
    customerId:        prof.stripe_customer_id
  });
};
