/* =========================================================================
 * /api/account/allocations  —  student-facing entitlement order flow
 *
 * The "allocations" model: the school (org) sets aside a fixed number of
 * covered items per student per program. Each "slot" (scrub_top,
 * scrub_bottom, …) offers one or more product options the student can
 * pick from, plus optional paid customizations (embroidered name, etc.).
 *
 *   GET /api/account/allocations
 *     → {
 *         programs: [{
 *           id, name, cohortLabel, isOpen,
 *           slots: [{
 *             id, key, label, coveredCount,
 *             options: [{
 *               id, productId, isDefault, presetMockupId, basePriceCents,
 *               customizations: [{ id, key, label, priceCents, config }]
 *             }],
 *             claim: null | {
 *               id, optionId, selectedCustomizationIds: [],
 *               size, orderId, claimedAt
 *             }
 *           }]
 *         }]
 *       }
 *
 *   POST /api/account/allocations?action=claim
 *     body: { programId, slotId, optionId, size, customizationIds: [...] }
 *     → {
 *         order: { id, orderNumber, total, extrasTotal, coveredTotal },
 *         claim: { id, slotId },
 *         checkoutUrl?: '<Stripe Checkout URL if extrasTotal > 0>'
 *       }
 *
 *     Server logic on claim:
 *       1. Validate the user is a member of the program.
 *       2. Validate slot ∈ program, option ∈ slot, customizations ∈ option.
 *       3. Reject if a claim row already exists (program, user, slot).
 *       4. Build items[] with line-level paid_by ('organization' for base,
 *          'customer' for each customization).
 *       5. Insert orders row with paid_by='split' or 'organization' as
 *          appropriate, status='in_production' (no quote/approval).
 *       6. Insert program_member_slot_claims row (unique constraint catches
 *          double-submit races).
 *       7. If extras > 0, create a Stripe Checkout session with metadata
 *          { order_id, purpose='allocation_extras' } and return its URL.
 *
 * Auth: any signed-in customer. Program membership is the gate.
 * ========================================================================= */

const Stripe = require('stripe');
const { requireUser, setCorsHeaders, readJsonBody } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');
const crypto = require('crypto');

// Site origin used to build Stripe Checkout return URLs. Falls back to a
// reasonable production default so previews still work.
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://singhsprint.com';

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return Stripe(key, { apiVersion: '2024-04-10' });
}

// Order numbers for allocation claims get an ALC- prefix so the CRM ops
// team can spot them at a glance. Same scheme as reorder.js's REO-.
function freshOrderNumber() {
  const suffix = crypto.randomBytes(4).toString('base64')
    .replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
  return `ALC-${suffix}`;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  if (req.method === 'GET') return handleList(req, res, supabase, user);
  if (req.method === 'POST') {
    const action = (req.query && req.query.action) || '';
    if (action === 'claim') return handleClaim(req, res, supabase, user);
    return res.status(400).json({ error: `unknown action ${action}` });
  }
  return res.status(405).json({ error: 'method not allowed' });
};

// -------------------------------------------------------------------------
// GET — list this user's programs + slots + options + claims
// -------------------------------------------------------------------------
async function handleList(req, res, supabase, user) {
  // 1. Programs the user is a member of.
  const { data: memberships, error: mErr } = await supabase
    .from('program_members')
    .select(`
      program_id,
      programs:program_id (
        id, slug, name, cohort_label,
        first_batch_covered, first_batch_per_student_limit,
        order_window_opens_at, order_window_closes_at, is_active
      )
    `)
    .eq('user_id', user.id);
  if (mErr) return res.status(500).json({ error: mErr.message });

  const activeMemberships = (memberships || []).filter((m) => m.programs && m.programs.is_active);
  const programIds = activeMemberships.map((m) => m.program_id);
  if (programIds.length === 0) return res.status(200).json({ programs: [] });

  // 2. Slots for those programs.
  const { data: slots, error: sErr } = await supabase
    .from('program_allocation_slots')
    .select('id, program_id, slot_key, label, covered_count, sort_order')
    .in('program_id', programIds)
    .order('sort_order', { ascending: true });
  if (sErr) return res.status(500).json({ error: sErr.message });

  const slotIds = (slots || []).map((s) => s.id);

  // 3. Options across all those slots.
  const { data: options, error: oErr } = slotIds.length
    ? await supabase
        .from('program_slot_options')
        .select('id, slot_id, product_id, is_default, sort_order, preset_mockup_id, base_price_cents')
        .in('slot_id', slotIds)
        .order('sort_order', { ascending: true })
    : { data: [], error: null };
  if (oErr) return res.status(500).json({ error: oErr.message });

  const optionIds = (options || []).map((o) => o.id);

  // 4. Customizations across all those options.
  const { data: customizations, error: cErr } = optionIds.length
    ? await supabase
        .from('program_slot_customizations')
        .select('id, option_id, customization_key, label, price_cents, config, sort_order')
        .in('option_id', optionIds)
        .order('sort_order', { ascending: true })
    : { data: [], error: null };
  if (cErr) return res.status(500).json({ error: cErr.message });

  // 5. Existing claims for THIS user across these programs.
  const { data: claims, error: clErr } = await supabase
    .from('program_member_slot_claims')
    .select('id, program_id, slot_id, option_id, selected_customizations, size, order_id, claimed_at')
    .in('program_id', programIds)
    .eq('user_id', user.id);
  if (clErr) return res.status(500).json({ error: clErr.message });

  // Build nested response.
  const customByOpt = {};
  for (const c of customizations || []) {
    (customByOpt[c.option_id] ||= []).push({
      id:         c.id,
      key:        c.customization_key,
      label:      c.label,
      priceCents: c.price_cents,
      config:     c.config || null,
    });
  }
  const optsBySlot = {};
  for (const o of options || []) {
    (optsBySlot[o.slot_id] ||= []).push({
      id:              o.id,
      productId:       o.product_id,
      isDefault:       o.is_default,
      presetMockupId:  o.preset_mockup_id,
      basePriceCents:  o.base_price_cents,
      customizations:  customByOpt[o.id] || [],
    });
  }
  const slotsByProgram = {};
  for (const s of slots || []) {
    (slotsByProgram[s.program_id] ||= []).push({
      id:           s.id,
      key:          s.slot_key,
      label:        s.label,
      coveredCount: s.covered_count,
      options:      optsBySlot[s.id] || [],
      claim:        null, // filled below
    });
  }
  // Attach claims to their slot.
  for (const cl of claims || []) {
    const slotsForProg = slotsByProgram[cl.program_id] || [];
    const slot = slotsForProg.find((s) => s.id === cl.slot_id);
    if (slot) {
      slot.claim = {
        id:                       cl.id,
        optionId:                 cl.option_id,
        selectedCustomizationIds: Array.isArray(cl.selected_customizations)
                                    ? cl.selected_customizations : [],
        size:                     cl.size,
        orderId:                  cl.order_id,
        claimedAt:                cl.claimed_at,
      };
    }
  }

  const now = Date.now();
  const out = activeMemberships.map((m) => {
    const p = m.programs;
    const opensTs  = p.order_window_opens_at  ? new Date(p.order_window_opens_at).getTime()  : null;
    const closesTs = p.order_window_closes_at ? new Date(p.order_window_closes_at).getTime() : null;
    const isOpen = (opensTs == null || opensTs <= now) && (closesTs == null || closesTs >= now);
    return {
      id:          p.id,
      slug:        p.slug,
      name:        p.name,
      cohortLabel: p.cohort_label,
      isOpen,
      firstBatchCovered:         p.first_batch_covered,
      firstBatchPerStudentLimit: p.first_batch_per_student_limit,
      slots: slotsByProgram[p.id] || [],
    };
  });

  return res.status(200).json({ programs: out });
}

// -------------------------------------------------------------------------
// POST ?action=claim — student claims a slot
// -------------------------------------------------------------------------
async function handleClaim(req, res, supabase, user) {
  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const { programId, slotId, optionId, size } = body || {};
  const customizationIds = Array.isArray(body.customizationIds) ? body.customizationIds : [];

  if (!programId || !slotId || !optionId) {
    return res.status(400).json({ error: 'programId, slotId, optionId required' });
  }
  if (!size || typeof size !== 'string') {
    return res.status(400).json({ error: 'size required' });
  }

  // 1. Verify membership.
  const { data: membership, error: memErr } = await supabase
    .from('program_members')
    .select('program_id')
    .eq('program_id', programId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (memErr)       return res.status(500).json({ error: memErr.message });
  if (!membership)  return res.status(403).json({ error: 'not a member of this program' });

  // 2. Validate slot belongs to program, option to slot, customizations to option.
  const { data: slot, error: slotErr } = await supabase
    .from('program_allocation_slots')
    .select('id, label, slot_key, covered_count, program_id')
    .eq('id', slotId)
    .eq('program_id', programId)
    .maybeSingle();
  if (slotErr) return res.status(500).json({ error: slotErr.message });
  if (!slot)   return res.status(404).json({ error: 'slot not found in this program' });

  const { data: option, error: optErr } = await supabase
    .from('program_slot_options')
    .select('id, slot_id, product_id, base_price_cents, preset_mockup_id')
    .eq('id', optionId)
    .eq('slot_id', slotId)
    .maybeSingle();
  if (optErr) return res.status(500).json({ error: optErr.message });
  if (!option) return res.status(404).json({ error: 'option not found in this slot' });

  let pickedCustomizations = [];
  if (customizationIds.length) {
    const { data: customs, error: cErr } = await supabase
      .from('program_slot_customizations')
      .select('id, option_id, customization_key, label, price_cents')
      .eq('option_id', optionId)
      .in('id', customizationIds);
    if (cErr) return res.status(500).json({ error: cErr.message });
    if ((customs || []).length !== customizationIds.length) {
      return res.status(400).json({ error: 'one or more customizationIds invalid for this option' });
    }
    pickedCustomizations = customs;
  }

  // 3. Reject if a claim already exists for this slot. (UNIQUE constraint also
  //    catches the race; this gives a friendlier error first.)
  const { data: existingClaim } = await supabase
    .from('program_member_slot_claims')
    .select('id')
    .eq('program_id', programId).eq('user_id', user.id).eq('slot_id', slotId)
    .maybeSingle();
  if (existingClaim) {
    return res.status(409).json({ error: 'you have already claimed this slot' });
  }

  // 4. Look up the caller's customer row (we use customer_id, not user_id, on orders).
  const { data: cust, error: custErr } = await supabase
    .from('customers')
    .select('id, email, name')
    .eq('user_id', user.id)
    .maybeSingle();
  if (custErr) return res.status(500).json({ error: custErr.message });
  if (!cust)   return res.status(404).json({ error: 'no customer record on file' });

  // 5. Compute totals + items[].
  const coveredCents = option.base_price_cents || 0;
  const extrasCents  = pickedCustomizations.reduce((sum, c) => sum + (c.price_cents || 0), 0);
  const totalCents   = coveredCents + extrasCents;

  const items = [];
  items.push({
    id:                crypto.randomUUID(),
    kind:              'allocation_base',
    slot_id:           slot.id,
    slot_key:          slot.slot_key,
    slot_label:        slot.label,
    option_id:         option.id,
    product_id:        option.product_id,
    preset_mockup_id:  option.preset_mockup_id || null,
    size,
    qty:               1,
    unit_price_cents:  coveredCents,
    paid_by:           'organization',
  });
  for (const c of pickedCustomizations) {
    items.push({
      id:                 crypto.randomUUID(),
      kind:               'allocation_customization',
      slot_id:            slot.id,
      option_id:          option.id,
      customization_id:   c.id,
      customization_key:  c.customization_key,
      label:              c.label,
      qty:                1,
      unit_price_cents:   c.price_cents || 0,
      paid_by:            'customer',
    });
  }

  // 6. Insert the order.
  const orderPaidBy = extrasCents > 0 ? 'split' : 'organization';
  const insertOrder = {
    order_number:                   freshOrderNumber(),
    customer_id:                    cust.id,
    program_id:                     programId,
    status:                         'in_production', // skips quote + approval
    paid_status:                    extrasCents > 0 ? 'awaiting_extras' : 'covered_pending_invoice',
    paid:                           false,
    paid_by:                        orderPaidBy,
    is_allocation_claim:            true,
    items,
    subtotal:                       totalCents / 100,
    tax:                            0,
    total:                          totalCents / 100,
    organization_paid_total_cents:  coveredCents,
    customer_paid_total_cents:      extrasCents,
  };

  const { data: orderRow, error: ordErr } = await supabase
    .from('orders')
    .insert(insertOrder)
    .select('id, order_number')
    .single();
  if (ordErr) return res.status(500).json({ error: ordErr.message });

  // 7. Insert the claim. UNIQUE (program, user, slot) catches concurrent claims.
  const { data: claimRow, error: claimErr } = await supabase
    .from('program_member_slot_claims')
    .insert({
      program_id:              programId,
      user_id:                 user.id,
      slot_id:                 slotId,
      option_id:               optionId,
      selected_customizations: pickedCustomizations.map((c) => c.id),
      size,
      order_id:                orderRow.id,
    })
    .select('id, slot_id')
    .single();
  if (claimErr) {
    // Race: someone else inserted between our check and our insert. Roll back
    // the order so we don't leave a phantom.
    await supabase.from('orders').delete().eq('id', orderRow.id);
    if (/duplicate key|unique/i.test(claimErr.message || '')) {
      return res.status(409).json({ error: 'you have already claimed this slot' });
    }
    return res.status(500).json({ error: claimErr.message });
  }

  // 8. If extras > 0, kick off Stripe Checkout for the student's portion.
  let checkoutUrl = null;
  if (extrasCents > 0) {
    try {
      const stripe = stripeClient();
      const session = await stripe.checkout.sessions.create({
        mode:                      'payment',
        payment_method_types:      ['card'],
        customer_email:            cust.email || user.email || undefined,
        line_items: pickedCustomizations.map((c) => ({
          price_data: {
            currency:     'cad',
            product_data: { name: `${slot.label}: ${c.label}` },
            unit_amount:  c.price_cents || 0,
          },
          quantity: 1,
        })),
        metadata: {
          order_id:    orderRow.id,
          program_id:  programId,
          user_id:     user.id,
          purpose:     'allocation_extras',
        },
        success_url: `${SITE_URL}/account/orders?claim=ok&order=${encodeURIComponent(orderRow.order_number)}`,
        cancel_url:  `${SITE_URL}/account/allocations?cancel=1`,
      });
      checkoutUrl = session.url;
      await supabase.from('orders')
        .update({ stripe_checkout_session_id: session.id })
        .eq('id', orderRow.id);
    } catch (e) {
      // Stripe failure: leave the order in place — operator can resend a
      // checkout link from the CRM. The covered portion still ships.
      // eslint-disable-next-line no-console
      console.error('[allocations.claim] stripe checkout failed:', e.message);
    }
  }

  return res.status(201).json({
    order: {
      id:           orderRow.id,
      orderNumber:  orderRow.order_number,
      coveredCents,
      extrasCents,
      totalCents,
    },
    claim: { id: claimRow.id, slotId: claimRow.slot_id },
    checkoutUrl,
  });
}
