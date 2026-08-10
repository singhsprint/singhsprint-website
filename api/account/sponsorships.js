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
    .select('id, slug, name, status, views, clearance_in, owner_email, theme, '
            + 'headline, subhead, cta_label, success_message, deadline_at, qr_url, '
            + 'price_ladder, currency, green_discount_pct, min_slot_in, max_slot_in, notify_emails')
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


/* ---------------------------------------------------------------------------
 * Campaign settings the client may change himself.
 *
 * Everything in section 7 of his brief used to mean messaging us. That is a
 * bottleneck on a campaign with a two-week fuse, so the fields that are his
 * commercial decisions — his prices, his copy, his deadline, his colours — are
 * his to change.
 *
 * WHAT IS DELIBERATELY NOT HERE, and why:
 *
 *   owner_email   Whoever holds this owns the campaign. Editable, it is a way
 *                 to hand the campaign to someone else — or to lock yourself
 *                 out of it — through a form. Operator-only.
 *   slug          The embed URL on his site is built from it. Changing it
 *                 breaks the iframe silently, mid-campaign.
 *   views         Which panels exist drives mask generation and pricing caps.
 *   clearance_in  The gap between two prints is a press constraint, not a
 *                 commercial one. We own it.
 *   product/color The garment. Changing it invalidates every mask and every
 *                 mockup already sent to a sponsor.
 *
 * Status is limited to live/paused. draft and ended are operator states — one
 * precedes launch, the other is how a campaign is retired, and neither should
 * be reachable from a settings form by accident.
 * ------------------------------------------------------------------------- */

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FONT_RE = /^[A-Za-z][A-Za-z \-]{0,39}$/;
const EDITABLE_STATUS = new Set(['live', 'paused']);

/** Collects field-level errors so the form can show all of them at once. */
function Validator() { this.errors = []; }
Validator.prototype.fail = function (field, msg) { this.errors.push(field + ': ' + msg); return null; };

Validator.prototype.text = function (field, v, max) {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (s.length > max) return this.fail(field, 'must be ' + max + ' characters or fewer');
  return s || null;
};

Validator.prototype.number = function (field, v, min, max) {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return this.fail(field, 'must be a number');
  if (n < min || n > max) return this.fail(field, 'must be between ' + min + ' and ' + max);
  return n;
};

/**
 * The price ladder.
 *
 * Rejected rather than repaired when it is wrong. A ladder that silently drops
 * a malformed rung would change what every sponsor is quoted from that moment
 * on, and the person who typed the typo would have no idea.
 */
Validator.prototype.ladder = function (v) {
  if (v == null) return undefined;
  if (!Array.isArray(v)) return this.fail('price_ladder', 'must be a list of rungs');
  if (v.length === 0) return this.fail('price_ladder', 'needs at least one rung, or sponsors see no prices at all');
  if (v.length > 24) return this.fail('price_ladder', 'is limited to 24 rungs');

  const out = [];
  const seen = {};
  for (let i = 0; i < v.length; i++) {
    const inches = Number(v[i] && v[i].in);
    const price = Number(v[i] && v[i].price);
    if (!Number.isFinite(inches) || inches <= 0 || inches > 60) {
      return this.fail('price_ladder', 'rung ' + (i + 1) + ' has an invalid size');
    }
    if (!Number.isFinite(price) || price < 0 || price > 1000000) {
      return this.fail('price_ladder', 'rung ' + (i + 1) + ' has an invalid price');
    }
    const key = inches.toFixed(2);
    if (seen[key]) return this.fail('price_ladder', 'has two rungs at ' + inches + '"');
    seen[key] = true;
    out.push({ in: Math.round(inches * 100) / 100, price: Math.round(price * 100) / 100 });
  }
  out.sort(function (a, b) { return a.in - b.in; });
  return out;
};

/**
 * The embed palette.
 *
 * These values are interpolated into a <style> tag inside an iframe framed by
 * his own site, so a colour carrying a stray brace would be arbitrary CSS on
 * his page. Anything that is not a hex colour, a plain font name, or a Google
 * Fonts URL is refused outright.
 */
Validator.prototype.theme = function (v) {
  if (v == null) return undefined;
  if (typeof v !== 'object') return this.fail('theme', 'is malformed');

  const out = {};
  const colours = ['bg', 'text', 'accent', 'accentText', 'highlight', 'stage'];
  for (const k of colours) {
    if (v[k] == null || v[k] === '') continue;
    const c = String(v[k]).trim();
    if (!HEX_RE.test(c)) return this.fail('theme.' + k, 'must be a hex colour like #0D52A1');
    out[k] = c;
  }
  for (const k of ['displayFont', 'bodyFont']) {
    if (v[k] == null || v[k] === '') continue;
    const f = String(v[k]).trim();
    if (!FONT_RE.test(f)) return this.fail('theme.' + k, 'must be a font family name');
    out[k] = f;
  }
  if (v.fontUrl) {
    const u = String(v.fontUrl).trim();
    let parsed = null;
    try { parsed = new URL(u); } catch (e) { parsed = null; }
    if (!parsed || parsed.protocol !== 'https:' || parsed.hostname !== 'fonts.googleapis.com') {
      return this.fail('theme.fontUrl', 'must be a https://fonts.googleapis.com stylesheet');
    }
    out.fontUrl = u;
  }
  out.mode = v.mode === 'dark' ? 'dark' : 'light';
  out.uppercaseHeadings = v.uppercaseHeadings === true;

  // bg and text are the two ends of the grey ramp the embed mixes. Without
  // both there is nothing to interpolate, and a half-applied theme lands as
  // unreadable text on a branded panel — worse than no theme at all.
  if (!out.bg || !out.text) return this.fail('theme', 'needs both a background and a text colour');
  return out;
};

Validator.prototype.emails = function (v) {
  if (v == null) return undefined;
  const list = (Array.isArray(v) ? v : String(v).split(/[,\n]/))
    .map(function (e) { return String(e).trim().toLowerCase(); })
    .filter(Boolean);
  if (list.length > 5) return this.fail('notify_emails', 'is limited to 5 addresses');
  for (const e of list) {
    if (!EMAIL_RE.test(e) || e.length > 300) return this.fail('notify_emails', '"' + e + '" is not a valid address');
  }
  // An empty list means nobody is told when a sponsor claims a spot, and the
  // failure looks exactly like "no sponsors yet". Refuse it.
  if (list.length === 0) return this.fail('notify_emails', 'needs at least one address, or claims arrive silently');
  return list;
};

/** Build the patch, or throw a 400 with every problem listed at once. */
function settingsPatch(body) {
  const v = new Validator();
  const p = {};
  const set = function (key, value) { if (value !== undefined) p[key] = value; };

  set('headline',        v.text('headline', body.headline, 160));
  set('subhead',         v.text('subhead', body.subhead, 400));
  set('cta_label',       v.text('cta_label', body.cta_label, 60));
  set('success_message', v.text('success_message', body.success_message, 600));
  set('qr_url',          v.text('qr_url', body.qr_url, 500));

  set('green_discount_pct', v.number('green_discount_pct', body.green_discount_pct, 0, 100));
  set('min_slot_in',        v.number('min_slot_in', body.min_slot_in, 0.5, 60));
  set('max_slot_in',        v.number('max_slot_in', body.max_slot_in, 0.5, 60));
  set('price_ladder',       v.ladder(body.price_ladder));
  set('theme',              v.theme(body.theme));
  set('notify_emails',      v.emails(body.notify_emails));

  if (body.deadline_at !== undefined) {
    if (!body.deadline_at) { p.deadline_at = null; }
    else {
      const d = new Date(body.deadline_at);
      if (isNaN(d.getTime())) v.fail('deadline_at', 'is not a valid date');
      else p.deadline_at = d.toISOString();
    }
  }

  if (body.status !== undefined) {
    const st = String(body.status);
    if (!EDITABLE_STATUS.has(st)) v.fail('status', "must be 'live' or 'paused'");
    else p.status = st;
  }

  // A minimum above the maximum is not a field error, it is a pair error, and
  // it would leave the embed with no size a sponsor could legally pick.
  const lo = p.min_slot_in, hi = p.max_slot_in;
  if (lo != null && hi != null && lo > hi) {
    v.fail('min_slot_in', 'cannot be larger than the maximum slot size');
  }

  if (v.errors.length) { const e = new Error(v.errors.join('; ')); e.status = 400; throw e; }
  return p;
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


  // ── settings ──────────────────────────────────────────────────────────
  if (req.method === 'POST' && (req.query.action || '') === 'settings') {
    const body = await readJsonBody(req);
    const id = String(body.id || '');
    if (!id) return res.status(400).json({ error: 'id required' });

    const ownedIds = owned.map(function (c) { return c.id; });
    if (ownedIds.length === 0) return res.status(404).json({ error: 'not found' });

    let patch;
    try { patch = settingsPatch(body); }
    catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'nothing to change' });

    // Same shape as the decide route: ownership is enforced by constraining
    // the UPDATE itself rather than by reading the row and trusting a
    // comparison, so a campaign this person does not own matches zero rows and
    // answers 404 — indistinguishable from an id that never existed.
    const { data, error } = await supabase
      .from('sponsor_campaigns')
      .update(patch)
      .eq('id', id)
      .in('id', ownedIds)
      .select('id, slug, status, headline, subhead, cta_label, success_message, deadline_at, '
            + 'price_ladder, green_discount_pct, min_slot_in, max_slot_in, notify_emails, theme, qr_url')
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data)  return res.status(404).json({ error: 'not found' });
    return res.status(200).json({ ok: true, campaign: data });
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
      // The current values, so the settings form opens on what is actually
      // live rather than on blanks the client has to re-type.
      settings: {
        headline: c.headline || '',
        subhead: c.subhead || '',
        ctaLabel: c.cta_label || '',
        successMessage: c.success_message || '',
        deadlineAt: c.deadline_at || null,
        qrUrl: c.qr_url || '',
        priceLadder: Array.isArray(c.price_ladder) ? c.price_ladder : [],
        currency: c.currency || 'CAD',
        greenDiscountPct: c.green_discount_pct == null ? null : Number(c.green_discount_pct),
        minSlotIn: c.min_slot_in == null ? null : Number(c.min_slot_in),
        maxSlotIn: c.max_slot_in == null ? null : Number(c.max_slot_in),
        notifyEmails: Array.isArray(c.notify_emails) ? c.notify_emails : [],
      },
    };
  });

  return res.status(200).json({ campaigns: campaigns });
};
