/* =========================================================================
 * /api/account/quote
 *
 * The customer-portal data + write endpoint for ONE quote. Backs the
 * /account/quote.html page where a customer can:
 *   - view their quote (read-only line items + totals + revision history)
 *   - submit qty / size / note changes (held as proposed_changes for rep approval)
 *   - send messages in the bidirectional thread with us
 *   - read the activity log
 *
 * All writes are scoped to orders the caller owns (orders.customer_id
 * must belong to a customers row with email = caller's auth email).
 *
 * Routes — single endpoint, action-routed:
 *   GET  /api/account/quote?id=<orderId>
 *        → { order, items, changes, messages, audit, latest_sent }
 *
 *   POST /api/account/quote?id=<orderId>&action=propose-change
 *        body: { line_item_id?, change_kind, change, customer_message? }
 *        → { ok, change }
 *
 *   POST /api/account/quote?id=<orderId>&action=send-message
 *        body: { body_text }
 *        → { ok, message }
 *
 * Why route by action instead of separate routes: keeps the customer-
 * portal API surface tiny, mirrors the orders.js / cards.js / programs.js
 * pattern already used across /api/account/*. New actions can be added
 * here as the portal grows without spinning up new lambdas (Vercel
 * Hobby has a 12-function cap and we're close).
 *
 * Auth: requireUser → JWT-bearer matched against Supabase. CORS open
 * for singhsprint.com.
 * ========================================================================= */

const { requireUser, setCorsHeaders } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');

// Customer-safe column list. NEVER expose total_cost / profit / supplier
// costs to the browser. Mirrors /api/account/orders' ROW_COLUMNS but
// adds the revision + acceptance fields the portal needs to render
// "v2 · sent v1 on Mar 3" badges.
const QUOTE_COLUMNS = [
  'id', 'created_at', 'updated_at',
  'order_number', 'status', 'paid_status', 'paid',
  'items', 'subtotal', 'tax', 'total',
  'due_date', 'deadline', 'notes',
  'deposit_paid_at', 'balance_paid_at', 'deposit_percent',
  'revision', 'accepted_revision',
  'customer_id', 'lead_id',
].join(', ');

// Whitelist for the proposed-change kinds the portal accepts. Mirrors
// the CHECK constraint on customer_proposed_changes.change_kind.
const VALID_KINDS = new Set([
  'qty', 'sizes', 'design', 'note', 'delete_line', 'add_line',
]);

// ---------------------------------------------------------------------
// Ownership check. Returns the order row (with customer.email validated)
// or throws an HTTP-shaped error. Both the GET path and every POST
// action route through this so we have one place to enforce access.
// ---------------------------------------------------------------------
async function loadOwnedOrder(supabase, orderId, userEmail) {
  if (!orderId) {
    throw { status: 400, body: { error: 'order id is required' } };
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select(QUOTE_COLUMNS + ', customers!inner(id, email, contact_name, company_name)')
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    throw { status: 500, body: { error: 'order lookup failed', details: error.message } };
  }
  if (!order) {
    throw { status: 404, body: { error: 'quote not found' } };
  }
  // Supabase nests one-to-one joins as either an array or object
  // depending on FK direction — flatten defensively.
  const cust = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const ownerEmail = (cust && cust.email) ? String(cust.email).toLowerCase() : null;
  if (!ownerEmail || ownerEmail !== String(userEmail || '').toLowerCase()) {
    // Don't leak existence — same 404 as if the row doesn't exist.
    throw { status: 404, body: { error: 'quote not found' } };
  }
  return order;
}

// ---------------------------------------------------------------------
// GET handler — bundles the everything-the-portal-needs into one round
// trip so the page can render without a waterfall of fetches.
// ---------------------------------------------------------------------
async function handleGet(req, res, supabase, user) {
  const orderId = req.query?.id || (req.url && new URL(req.url, 'http://x').searchParams.get('id'));
  let order;
  try { order = await loadOwnedOrder(supabase, orderId, user.email); }
  catch (e) { return res.status(e.status).json(e.body); }

  // Fire the auxiliary queries in parallel — each tiny, indexed.
  const [changesRes, messagesRes, auditRes, latestSentRes] = await Promise.all([
    supabase
      .from('customer_proposed_changes')
      .select('id, line_item_id, change_kind, change, customer_message, status, bound_check, reviewer_note, reviewed_at, reviewed_by, submitted_at, submitted_by')
      .eq('order_id', orderId)
      .order('submitted_at', { ascending: false })
      .limit(50),
    supabase
      .from('customer_messages')
      .select('id, from_kind, from_email, body_text, sent_at, read_at, attachments')
      .eq('order_id', orderId)
      .order('sent_at', { ascending: false })
      .limit(100),
    supabase
      .from('quote_audit_log')
      .select('id, ts, actor, actor_kind, event, summary, revision')
      .eq('order_id', orderId)
      .order('ts', { ascending: false })
      .limit(50),
    supabase
      .from('sent_quotes')
      .select('revision, sent_at, sent_to, totals')
      .eq('order_id', orderId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return res.status(200).json({
    order: {
      id:               order.id,
      order_number:     order.order_number,
      status:           order.status,
      paid:             !!order.paid,
      paid_status:      order.paid_status,
      deposit_paid_at:  order.deposit_paid_at,
      balance_paid_at:  order.balance_paid_at,
      deposit_percent:  order.deposit_percent,
      revision:         order.revision || 0,
      accepted_revision: order.accepted_revision || null,
      deadline:         order.deadline,
      notes:            order.notes,
      // Money totals — safe to expose; not cost/profit.
      subtotal:         order.subtotal,
      tax:              order.tax,
      total:            order.total,
      created_at:       order.created_at,
      updated_at:       order.updated_at,
    },
    items:    Array.isArray(order.items) ? order.items : [],
    changes:  changesRes.data || [],
    messages: messagesRes.data || [],
    audit:    auditRes.data    || [],
    latest_sent: latestSentRes.data || null,
  });
}

// ---------------------------------------------------------------------
// POST handler — action-routed.
// ---------------------------------------------------------------------
async function handlePost(req, res, supabase, user) {
  const url = new URL(req.url, 'http://x');
  const orderId = req.query?.id || url.searchParams.get('id');
  const action  = req.query?.action || url.searchParams.get('action');

  let order;
  try { order = await loadOwnedOrder(supabase, orderId, user.email); }
  catch (e) { return res.status(e.status).json(e.body); }

  let body = {};
  try {
    if (typeof req.body === 'string') body = JSON.parse(req.body);
    else if (req.body && typeof req.body === 'object') body = req.body;
  } catch (_) { /* allow empty */ }

  // -------- propose-change --------
  if (action === 'propose-change') {
    const kind = String(body.change_kind || '').trim();
    if (!VALID_KINDS.has(kind)) {
      return res.status(400).json({
        error: 'change_kind must be one of: ' + Array.from(VALID_KINDS).join(', '),
      });
    }
    if (!body.change || typeof body.change !== 'object') {
      return res.status(400).json({ error: 'change object is required' });
    }
    const lineItemId = body.line_item_id ? String(body.line_item_id).slice(0, 100) : null;
    const customerMessage = body.customer_message
      ? String(body.customer_message).slice(0, 1000)
      : null;

    // Mirror the deposit-paid / paid-full bounds in JS. Same rules as
    // /lib/quotes/bounds.ts on the CRM side. Returned as bound_check
    // on the inserted row so the rep sees the rule in the inbox.
    const isPaid = !!order.paid;
    const depositPaid = !!order.deposit_paid_at;
    if (isPaid) {
      return res.status(409).json({
        error: 'This quote is already paid in full. Send us a message instead.',
        bound_check: { rule: 'order_paid' },
      });
    }
    if (depositPaid) {
      // Light client-side guardrail; the rep-side accept route enforces
      // the same logic on apply, so anyone bypassing the UI still gets
      // their change rejected at the accept step.
      if (kind === 'qty' && Number(body.change.to) < Number(body.change.from)) {
        return res.status(409).json({
          error: 'Quantity cannot be reduced after the deposit has been paid.',
          bound_check: { rule: 'deposit_paid_qty_decrease_blocked' },
        });
      }
      if (kind === 'delete_line') {
        return res.status(409).json({
          error: 'Lines cannot be removed after the deposit has been paid.',
          bound_check: { rule: 'deposit_paid_delete_line_blocked' },
        });
      }
    }

    const { data: inserted, error } = await supabase
      .from('customer_proposed_changes')
      .insert({
        order_id:         order.id,
        line_item_id:     lineItemId,
        change_kind:      kind,
        change:           body.change,
        customer_message: customerMessage,
        bound_check: {
          paid:            isPaid,
          deposit_paid_at: order.deposit_paid_at,
          rule:            depositPaid ? 'deposit_paid_review_required' : 'pre_deposit_review_optional',
        },
        submitted_by:     user.email,
      })
      .select('*')
      .single();
    if (error) {
      return res.status(500).json({ error: 'change submit failed', details: error.message });
    }

    // Audit log — best effort, never fails the user-facing request.
    try {
      await supabase.from('quote_audit_log').insert({
        order_id:   order.id,
        revision:   order.revision || null,
        actor:      user.email,
        actor_kind: 'customer',
        event:      'customer_proposed_change',
        after_state: { change_id: inserted.id, change_kind: kind, change: body.change },
        summary:    'Customer submitted a ' + kind + ' change',
      });
    } catch (e) {
      console.error('[customer-portal] audit insert failed (non-fatal):', e?.message || e);
    }

    return res.status(200).json({ ok: true, change: inserted });
  }

  // -------- send-message --------
  if (action === 'send-message') {
    const bodyText = (body.body_text || '').toString().trim();
    if (!bodyText) {
      return res.status(400).json({ error: 'body_text is required' });
    }
    if (bodyText.length > 20000) {
      return res.status(413).json({ error: 'body_text exceeds 20KB cap' });
    }

    const { data: msg, error } = await supabase
      .from('customer_messages')
      .insert({
        order_id:   order.id,
        from_kind:  'customer',
        from_email: user.email,
        body_text:  bodyText,
      })
      .select('*')
      .single();
    if (error) {
      return res.status(500).json({ error: 'message insert failed', details: error.message });
    }

    try {
      await supabase.from('quote_audit_log').insert({
        order_id:   order.id,
        revision:   order.revision || null,
        actor:      user.email,
        actor_kind: 'customer',
        event:      'customer_message_sent',
        after_state: { message_id: msg.id, preview: bodyText.slice(0, 200) },
        summary:    'Customer sent a message (' + bodyText.length + ' chars)',
      });
    } catch (e) {
      console.error('[customer-portal] audit insert failed (non-fatal):', e?.message || e);
    }

    return res.status(200).json({ ok: true, message: msg });
  }

  return res.status(400).json({ error: 'unknown action; expected propose-change or send-message' });
}

// =====================================================================
module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();
  if (req.method === 'GET')  return handleGet(req, res, supabase, user);
  if (req.method === 'POST') return handlePost(req, res, supabase, user);
  return res.status(405).json({ error: 'method not allowed' });
};
