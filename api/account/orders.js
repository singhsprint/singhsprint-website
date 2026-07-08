/* =========================================================================
 * /api/account/orders  (REWRITTEN for real schema)
 *
 * Returns the caller's orders. The chain is:
 *   auth.users  ── 1:1 ──> profiles
 *                  ──> customers.user_id (linked by handle_new_user trigger)
 *                  ──> orders.customer_id
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
 * Verify the real status values post-deploy with:
 *   select distinct status, paid_status from orders;
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

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  // Find every customers row belonging to this user. Most users will
  // have exactly one; some long-time customers may have multiple legacy
  // rows that got merged onto the same email.
  const { data: cust, error: cErr } = await supabase
    .from('customers').select('id').eq('user_id', user.id);
  if (cErr) return res.status(500).json({ error: cErr.message });

  const customerIds = (cust || []).map((c) => c.id);
  if (!customerIds.length) {
    // No customer record yet — this user has never placed an order.
    return res.status(200).json({ active: [], past: [] });
  }

  const singleId = req.query?.id;

  if (singleId) {
    const { data, error } = await supabase
      .from('orders')
      .select(ROW_COLUMNS)
      .eq('id', singleId)
      .in('customer_id', customerIds)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: 'not found' });
    return res.status(200).json({ order: data });
  }

  // List all orders, partition into active vs past in JS so we can
  // tweak the heuristic without a new DB query.
  const { data: rows, error } = await supabase
    .from('orders')
    .select(ROW_COLUMNS)
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: error.message });

  const active = [];
  const past   = [];
  for (const o of rows || []) {
    const isPaid = o.paid === true
      || (o.paid_status && /^(paid|refunded)$/i.test(o.paid_status))
      || o.balance_paid_at != null;
    (isPaid ? past : active).push(o);
  }

  // DTC drop purchases — linked by customer_email since drop buyers are
  // typically anonymous (no `customer_id` to join on). If a user later
  // signs up with the same email they used at a drop checkout, this
  // surfaces those past purchases in their portal.
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
      .eq('customer_email', user.email)
      .order('paid_at', { ascending: false })
      .limit(50);
    if (!dErr) drops = dropRows || [];
  }

  return res.status(200).json({ active, past, drops });
};
