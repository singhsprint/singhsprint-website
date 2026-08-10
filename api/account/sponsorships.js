/* =========================================================================
 * /api/account/sponsorships — the client's own sponsor campaign
 *
 * A sponsor campaign is ONE physical tee that many brands claim regions of.
 * The person who owns the campaign — whose audience is driving it — approves
 * or denies each claim, and that decision changes the shirt: approving locks
 * the area to that brand for good, denying releases it back into the embed
 * within seconds.
 *
 *   GET  /api/account/sponsorships
 *     → { campaigns: [{ id, slug, name, status, views, claimedAreas,
 *                       submissions: [{ id, company, contactName, email,
 *                         phone, notes, status, createdAt, placements: [...] }] }] }
 *
 *   POST /api/account/sponsorships?action=decide
 *     body { id, decision: 'approved'|'denied'|'pending', note? }
 *     → { ok, submission }
 *
 * THE IDENTITY BRIDGE is the email on the verified Supabase session, matched
 * against sponsor_campaigns.owner_email — the same convention every other
 * account route here uses (orders.js and mockups.js bridge through customers,
 * designs.js through contacts.email_norm). The client signs in with the
 * account he already has; there is no second login and no separate password.
 * The email is NEVER read from the request body.
 *
 * DECISIONS ARE REVERSIBLE. Occupancy is derived from status by the
 * sponsor_live_claims view rather than stored separately, so undo is just
 * another status change — nothing is destroyed to make a decision, and the
 * next time a sponsor loads the embed it simply computes a different mask.
 * ========================================================================= */

const { requireUser, setCorsHeaders, readJsonBody } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');

const DECISIONS = new Set(['approved', 'denied', 'pending']);
const MAX_SUBMISSIONS = 300;

const VIEW_LABELS = {
  front: 'Front', back: 'Back',
  'sleeve-left': 'Left sleeve', 'sleeve-right': 'Right sleeve', side: 'Side seam',
};

/** Campaigns this signed-in person owns. Empty array is a valid answer. */
async function campaignsFor(supabase, user) {
  const email = (user && user.email ? String(user.email) : '').trim().toLowerCase();
  if (!email) return [];
  const { data, error } = await supabase
    .from('sponsor_campaigns')
    .select('id, slug, name, status, views, clearance_in, owner_email, theme')
    .ilike('owner_email', email);
  if (error) throw new Error(error.message);
  // ilike without wildcards is an exact, case-insensitive match — but be
  // explicit rather than trusting that, since a stray % in a stored value
  // would otherwise widen the match.
  return (data || []).filter(function (c) {
    return String(c.owner_email || '').trim().toLowerCase() === email;
  });
}

function shapeSubmission(row, signedByPath) {
  const placements = (row.sponsor_placements || []).map(function (p) {
    return {
      id: p.id,
      view: p.view,
      viewLabel: VIEW_LABELS[p.view] || p.view,
      widthIn: p.width_in == null ? null : Number(p.width_in),
      slotIn: p.slot_in == null ? null : Number(p.slot_in),
      slotPrice: p.slot_price == null ? null : Number(p.slot_price),
      mockupUrl: p.mockup_url || null,
      // The artwork that actually gets printed. It lives in a private bucket,
      // so what goes over the wire is a short-lived signed link rather than a
      // path the browser could not fetch anyway.
      designUrl: p.design_url || signedByPath[p.design_path] || null,
      designMime: p.design_mime || null,
    };
  });
  return {
    id: row.id,
    company: row.company || null,
    contactName: row.contact_name || null,
    email: row.email,
    phone: row.phone || null,
    notes: row.notes || null,
    status: row.status,
    statusNote: row.status_note || null,
    // What the sponsor claimed versus what the client has actually granted.
    // Two fields on purpose: the discount is not real until he says it is.
    isGreen: row.is_green === true,
    greenVerified: row.green_verified == null ? null : row.green_verified === true,
    // Frozen at claim time. This is the number to invoice against, not a
    // re-computation off today's ladder.
    quotedTotal: row.quoted_total == null ? null : Number(row.quoted_total),
    quotedCurrency: row.quoted_currency || null,
    decidedAt: row.decided_at || null,
    createdAt: row.created_at,
    placements: placements,
  };
}

/**
 * Sign every artwork path in one batch.
 *
 * Only paths reachable from submissions this person owns are ever passed in,
 * so there is no way to ask for someone else's file. One hour is deliberately
 * short — long enough to review and download, not long enough for the link to
 * outlive the page it was rendered into.
 */
async function signDesigns(supabase, rows) {
  const paths = [];
  (rows || []).forEach(function (row) {
    (row.sponsor_placements || []).forEach(function (p) {
      if (p.design_path && paths.indexOf(p.design_path) === -1) paths.push(p.design_path);
    });
  });
  const byPath = {};
  if (paths.length === 0) return byPath;

  const { data, error } = await supabase.storage.from('designs').createSignedUrls(paths, 60 * 60);
  if (error || !data) return byPath;
  data.forEach(function (d, i) {
    if (d && d.signedUrl) byPath[d.path || paths[i]] = d.signedUrl;
  });
  return byPath;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  let owned;
  try { owned = await campaignsFor(supabase, user); }
  catch (e) { return res.status(500).json({ error: e.message }); }

  // ── decide ────────────────────────────────────────────────────────────
  if (req.method === 'POST' && (req.query.action || '') === 'decide') {
    const body = await readJsonBody(req);
    const id = String(body.id || '');
    const decision = String(body.decision || '');
    if (!id) return res.status(400).json({ error: 'id required' });
    if (!DECISIONS.has(decision)) {
      return res.status(400).json({ error: "decision must be 'approved', 'denied' or 'pending'" });
    }

    const ownedIds = owned.map(function (c) { return c.id; });
    if (ownedIds.length === 0) return res.status(404).json({ error: 'not found' });

    // Ownership is checked by constraining the UPDATE itself to campaigns this
    // person owns, not by reading the row first and trusting a comparison. A
    // claim on someone else's campaign matches zero rows and returns 404 — the
    // same answer a non-existent id gets, so a probe cannot use the response
    // to discover that a submission exists.
    const patch = {
      status: decision,
      status_note: typeof body.note === 'string' ? body.note.slice(0, 500) || null : null,
      decided_at: decision === 'pending' ? null : new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('sponsor_submissions')
      .update(patch)
      .eq('id', id)
      .in('campaign_id', ownedIds)
      .neq('status', 'spam')
      .select('id, status, decided_at')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: 'not found' });
    return res.status(200).json({ ok: true, submission: data });
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  // ── read ──────────────────────────────────────────────────────────────
  if (owned.length === 0) return res.status(200).json({ campaigns: [] });

  const { data: subs, error } = await supabase
    .from('sponsor_submissions')
    .select(`
      id, campaign_id, contact_name, email, phone, company, notes,
      status, status_note, decided_at, created_at,
      is_green, green_verified, quoted_total, quoted_currency,
      sponsor_placements ( id, view, width_in, slot_in, slot_price, mockup_url, design_url, design_path, design_mime )
    `)
    .in('campaign_id', owned.map(function (c) { return c.id; }))
    .neq('status', 'spam')
    .order('created_at', { ascending: false })
    .limit(MAX_SUBMISSIONS);
  if (error) return res.status(500).json({ error: error.message });

  let signedByPath = {};
  try { signedByPath = await signDesigns(supabase, subs); }
  catch (e) { signedByPath = {}; } // a signing hiccup must not blank the queue

  const byCampaign = {};
  (subs || []).forEach(function (row) {
    (byCampaign[row.campaign_id] = byCampaign[row.campaign_id] || []).push(shapeSubmission(row, signedByPath));
  });

  const campaigns = owned.map(function (c) {
    const list = byCampaign[c.id] || [];
    // "Areas taken" counts APPROVED placements only — a pending claim is
    // holding space but has not been granted, and conflating the two would
    // tell the client the shirt is fuller than he has agreed to.
    const claimedAreas = list
      .filter(function (s) { return s.status === 'approved'; })
      .reduce(function (n, s) { return n + s.placements.length; }, 0);
    return {
      id: c.id, slug: c.slug, name: c.name, status: c.status,
      views: c.views || [], claimedAreas: claimedAreas, submissions: list,
      // The campaign's own palette, so his section of the page wears his brand
      // rather than ours. Passed through as stored; the page validates before
      // it touches a style, because this ends up in CSS.
      theme: c.theme || null,
    };
  });

  return res.status(200).json({ campaigns: campaigns });
};
