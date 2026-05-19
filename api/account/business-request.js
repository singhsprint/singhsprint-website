/* =========================================================================
 * /api/account/business-request  (REWRITTEN for real schema)
 *
 * Customer-side endpoint for requesting a business-tier upgrade. The
 * earlier version required the customer to reference an RFP submission
 * (which would have lived in a dedicated rfps table). Real schema has no
 * such table — RFPs are submitted through a separate form/table that
 * we'll point at later. For now, any customer can request business
 * status by submitting their company info; staff reviews and decides.
 *
 * Approval still happens server-side: staff updates
 * profiles.account_type='business' (and net30_approved if applicable)
 * via Supabase Studio or a future CRM admin endpoint.
 *
 * Routes:
 *   GET /api/account/business-request
 *     → { accountType, net30Approved, volumePricingTier, organizationName,
 *         requests: [...], canRequest: bool }
 *
 *   POST /api/account/business-request
 *     body: { companyName, expectedMonthlyVolume?, notes?,
 *             relatedLeadId?, relatedOrderId? }
 *     - relatedLeadId / relatedOrderId are optional pointers if the
 *       customer wants to cite a specific record they want considered.
 *     - One pending request per user — re-POSTing while pending updates
 *       the existing row.
 *     → { request: {...} }
 * ========================================================================= */

const { requireUser, setCorsHeaders, readJsonBody } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');

const VOLUME_BUCKETS = ['under_1k', '1k_5k', '5k_25k', '25k_plus'];

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  // ------------------------------------------------------------
  // GET
  // ------------------------------------------------------------
  if (req.method === 'GET') {
    const [profRes, reqsRes] = await Promise.all([
      supabase.from('profiles')
        .select('account_type, net30_approved, volume_pricing_tier, default_organization_id')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.from('business_status_requests')
        .select('id, related_lead_id, related_order_id, company_name, expected_monthly_volume, notes, status, decided_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
    ]);
    if (profRes.error) return res.status(500).json({ error: profRes.error.message });
    if (reqsRes.error) return res.status(500).json({ error: reqsRes.error.message });

    let organizationName = null;
    if (profRes.data?.default_organization_id) {
      const { data: org } = await supabase
        .from('organizations').select('name')
        .eq('id', profRes.data.default_organization_id).maybeSingle();
      organizationName = org?.name || null;
    }

    // Surface the customer's company_name from the CRM (auto-populates
    // the request form so they don't retype it).
    const { data: cust } = await supabase
      .from('customers').select('company_name')
      .eq('user_id', user.id).limit(1).maybeSingle();

    const hasPending = (reqsRes.data || []).some((r) => r.status === 'pending');
    const isBusiness = profRes.data?.account_type === 'business';
    return res.status(200).json({
      accountType:        profRes.data?.account_type        || 'personal',
      net30Approved:      profRes.data?.net30_approved      || false,
      volumePricingTier:  profRes.data?.volume_pricing_tier || null,
      organizationName,
      suggestedCompanyName: cust?.company_name || null,
      requests:           reqsRes.data || [],
      canRequest:         !isBusiness && !hasPending
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const companyName = String(body.companyName || '').trim();
  const volume      = body.expectedMonthlyVolume ? String(body.expectedMonthlyVolume) : null;
  const notes       = body.notes ? String(body.notes).slice(0, 2000) : null;
  const relatedLeadId  = body.relatedLeadId  || null;
  const relatedOrderId = body.relatedOrderId || null;

  if (!companyName)         return res.status(400).json({ error: 'companyName required' });
  if (companyName.length > 200) return res.status(400).json({ error: 'companyName too long' });
  if (volume && !VOLUME_BUCKETS.includes(volume)) {
    return res.status(400).json({ error: `expectedMonthlyVolume must be one of ${VOLUME_BUCKETS.join(', ')}` });
  }

  // If a related order is cited, verify the caller owns it.
  if (relatedOrderId) {
    const { data: cust } = await supabase.from('customers').select('id').eq('user_id', user.id);
    const customerIds = (cust || []).map((c) => c.id);
    if (!customerIds.length) return res.status(400).json({ error: 'no customer record on file' });
    const { data: ord } = await supabase
      .from('orders').select('id').eq('id', relatedOrderId).in('customer_id', customerIds).maybeSingle();
    if (!ord) return res.status(400).json({ error: 'relatedOrderId not found in your orders' });
  }

  const { data: prof } = await supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle();
  if (prof?.account_type === 'business') {
    return res.status(409).json({ error: 'account is already business' });
  }

  // Update existing pending row if any; otherwise insert.
  const { data: existing } = await supabase
    .from('business_status_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  let result;
  if (existing) {
    const upd = await supabase
      .from('business_status_requests')
      .update({
        related_lead_id:  relatedLeadId,
        related_order_id: relatedOrderId,
        company_name:     companyName,
        expected_monthly_volume: volume,
        notes
      })
      .eq('id', existing.id)
      .select('id, related_lead_id, related_order_id, company_name, expected_monthly_volume, notes, status, created_at')
      .single();
    if (upd.error) return res.status(500).json({ error: upd.error.message });
    result = upd.data;
  } else {
    const ins = await supabase
      .from('business_status_requests')
      .insert({
        user_id:          user.id,
        related_lead_id:  relatedLeadId,
        related_order_id: relatedOrderId,
        company_name:     companyName,
        expected_monthly_volume: volume,
        notes
      })
      .select('id, related_lead_id, related_order_id, company_name, expected_monthly_volume, notes, status, created_at')
      .single();
    if (ins.error) return res.status(500).json({ error: ins.error.message });
    result = ins.data;
  }

  return res.status(201).json({ request: result });
};
