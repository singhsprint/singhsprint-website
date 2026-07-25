/* =========================================================================
 * /api/account/orders  (REWRITTEN for real schema)
 *
 * Returns the caller's orders. The chain is:
 *   auth.users  ── 1:1 ──> profiles
 *                  ──> customers.user_id (linked by handle_new_user trigger)
 *                  ──> orders.customer_id
 *
 * 2026-07-25 — REQUEST-TIME forgiving match + self-heal.
 * The 006_forgiving_account_linking trigger links customers → user_id on
 * sign-in/sign-up (email, cc_emails, digit-normalized phone). But the
 * trigger only fires on AUTH events — when the shop creates or edits a
 * customers row AFTER this person already signed in (the common flow:
 * customer signs up via the portal/popup first, rep converts their quote
 * to an order later), that row never links and the portal showed ZERO
 * orders. Now every request ALSO matches customers by the caller's
 * email (exact, case-insensitive) + cc_emails, and self-heals by
 * stamping user_id on the rows it finds — so the fast user_id path
 * covers them from then on.
 *
 * Orders live in the public.orders table with columns:
 *   id, created_at, customer_id, lead_id, order_number, status,
 *   items (jsonb), subtotal, tax, total, paid, payment_method,
 *   stripe_invoice_id, due_date, notes, deadline, paid_status,
 *   deposit_paid_at, balance_paid_at, ...
 *
 * "Active" vs "past" buckets — there's no canonical status enum on the
 * orders table, so we use a heuristic:
 *   past   = paid_status in ('paid','refunded') OR balance_paid_at IS NOT NULL
 *   active = everything else
 *
 * The route returns a narrow row shape — never raw cost / profit
 * fields which are staff-only.
 *
 * Routes:
 *   GET /api/account/orders                 → { active: [...], past: [...] }
 *   GET /api/account/orders?id=<uuid>       → { order: {...} }
 * ========================================================================= */

const { requireUser, setCorsHeaders } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');

// Customer-safe column list. NEVER expose total_cost / profit / supplier
// costs to the browser.
const ROW_COLUMNS = [
  'id', 'created_at', 'updated_at',
  'order_number', 'status', 'paid_status', 'paid',
  'items', 'subtotal', 'tax', 'total',
  'due_date', 'deadline',
  'deposit_paid_at', 'balance_paid_at',
  'stripe_invoice_id',
  'customer_id',
  // 2026-07-25 — payment-ledger figures so the portal can show what's
  // been paid and what's still owed (both customer-safe; the ledger is
  // the customer's own money). credit_applied_cents is store credit the
  // shop applied to this invoice.
  'amount_paid', 'credit_applied_cents',
  // Added with the first-batch coverage flow (migration 20260520):
  // paid_by tells the orders.html UI whether to show the Stripe portal
  // launcher + invoice link, or hide them in favor of a "Paid by your
  // program" pill. cohort_invoice_id is exposed so the UI can deep-link
  // to the cohort invoice if/when we build that surface.
  'paid_by', 'cohort_invoice_id',
  // Fulfillment method (pickup|delivery) so the account UI can offer
  // "Add delivery" only on orders that are still pickup.
  'fulfillment_method'
].join(', ');

// The branded customer payment domain — every order links to its live
// invoice page there (balance display + embedded Stripe checkout).
const INVOICE_BASE = 'https://pay.singhsprint.com';

// Exact case-insensitive match via ilike: escape ilike's wildcards so a
// literal "_" in an email can't wildcard-match a DIFFERENT customer's
// address (that would leak someone else's orders).
function ilikeExact(s) {
  return String(s).replace(/([%_\\])/g, '\\$1');
}

/**
 * Every customers.id belonging to this caller:
 *   1. rows already linked (user_id = caller) — the fast path;
 *   2. rows matching the caller's sign-in email on customers.email
 *      (case-insensitive) or customers.cc_emails — same predicate the
 *      sign-in trigger uses, evaluated fresh so rows the shop created
 *      after sign-up still match;
 *   3. self-heal: stamp user_id on rows found via (2) so next time the
 *      fast path covers them.
 */
async function resolveCustomerIds(supabase, user) {
  const ids = new Set();

  const { data: byUid, error: uErr } = await supabase
    .from('customers').select('id').eq('user_id', user.id);
  if (uErr) throw uErr;
  (byUid || []).forEach((c) => ids.add(c.id));

  const email = (user.email || '').trim();
  if (email) {
    const [primary, cc] = await Promise.all([
      supabase.from('customers').select('id, user_id').ilike('email', ilikeExact(email)),
      // cc_emails is text[]; `contains` is exact-match on elements. The shop
      // stores addresses as typed, so try the raw + lowercased forms.
      supabase.from('customers').select('id, user_id')
        .or(`cc_emails.cs.{"${email}"},cc_emails.cs.{"${email.toLowerCase()}"}`)
    ]);
    const matched = [...(primary.data || []), ...(cc.data || [])];
    const toLink = [];
    for (const c of matched) {
      ids.add(c.id);
      if (!c.user_id) toLink.push(c.id);
    }
    if (toLink.length) {
      // Best-effort self-heal — never block the read on it. `is('user_id',
      // null)` guards the race where the trigger linked it milliseconds ago.
      await supabase.from('customers')
        .update({ user_id: user.id })
        .in('id', toLink)
        .is('user_id', null)
        .then(() => {}, () => {});
    }
  }

  return Array.from(ids);
}

// Stamp the branded invoice link + the outstanding balance on a row so
// the UI never re-derives money math. balance uses the payment ledger
// (amount_paid = dollars actually received) + applied store credit.
function decorate(o) {
  const total  = Number(o.total || 0);
  const paid   = Math.max(0, Number(o.amount_paid || 0));
  const credit = Math.max(0, Number(o.credit_applied_cents || 0)) / 100;
  const balance = Math.max(0, Math.round((total - paid - credit) * 100) / 100);
  return {
    ...o,
    invoice_url: `${INVOICE_BASE}/invoice/${o.id}`,
    balance_due: balance
  };
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  let customerIds;
  try { customerIds = await resolveCustomerIds(supabase, user); }
  catch (e) { return res.status(500).json({ error: e.message || 'customer lookup failed' }); }

  const singleId = req.query?.id;

  if (singleId) {
    if (!customerIds.length) return res.status(404).json({ error: 'not found' });
    const { data, error } = await supabase
      .from('orders')
      .select(ROW_COLUMNS)
      .eq('id', singleId)
      .in('customer_id', customerIds)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: 'not found' });
    return res.status(200).json({ order: decorate(data) });
  }

  // List all orders, partition into active vs past in JS so we can
  // tweak the heuristic without a new DB query.
  let rows = [];
  if (customerIds.length) {
    const { data, error } = await supabase
      .from('orders')
      .select(ROW_COLUMNS)
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: error.message });
    rows = data || [];
  }

  const active = [];
  const past   = [];
  for (const o of rows) {
    const isPaid = o.paid === true
      || (o.paid_status && /^(paid|refunded)$/i.test(o.paid_status))
      || o.balance_paid_at != null;
    (isPaid ? past : active).push(decorate(o));
  }

  // DTC drop purchases — linked by customer_email since drop buyers are
  // typically anonymous (no `customer_id` to join on). If a user later
  // signs up with the same email they used at a drop checkout, this
  // surfaces those past purchases in their portal. ilike (with escaped
  // wildcards) so a checkout typed as MixedCase@Hotmail.com still matches.
  let drops = [];
  if (user.email) {
    const { data: dropRows, error: dErr } = await supabase
      .from('drop_orders')
      .select(`
        id, paid_at, fulfilled_at, status,
        amount_total_cents, amount_subtotal_cents, tax_cents, currency,
        stripe_session_id,
        shipping_name,
        drop:drops!inner ( slug, title, mockup_url, blank_label )
      `)
      .ilike('customer_email', ilikeExact(user.email.trim()))
      .order('paid_at', { ascending: false })
      .limit(50);
    if (!dErr) drops = dropRows || [];
  }

  return res.status(200).json({ active, past, drops });
};
