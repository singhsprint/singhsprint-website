/* =========================================================================
 * /api/account/programs — admin (business owner / admin only)
 *
 * Create and manage programs for the caller's organization. Programs are
 * the institutional layer (e.g. "uOttawa Nursing 2026 intake"): catalog
 * whitelist, allowed email domains, per-member spending allowance,
 * cohort labels, and the data the admin reporting view reads from.
 *
 * Auth gate: account_type='business' AND org role in {'owner','admin'}.
 *
 * Routes:
 *
 *   GET /api/account/programs
 *     → { programs: [{ id, slug, name, cohortLabel, memberCount,
 *                       allowanceCents, totalSpentCents,
 *                       windowOpensAt, windowClosesAt,
 *                       catalogProductIds, emailDomains }] }
 *
 *   GET /api/account/programs?id=<uuid>
 *     → single program with members list inlined (with email + cohort
 *       + spent_cents per member, for the admin reporting view)
 *
 *   POST /api/account/programs
 *     body: { slug, name, cohortLabel?, defaultSpendingAllowanceCents?,
 *             windowOpensAt?, windowClosesAt? }
 *     → { program }
 *
 *   PUT /api/account/programs    body: { id, ...fields }
 *
 *   POST /api/account/programs?action=add-catalog       body: { id, productIds: [...] }
 *   POST /api/account/programs?action=remove-catalog    body: { id, productIds: [...] }
 *
 *   POST /api/account/programs?action=invite-member
 *        body: { id, email, cohortLabelOverride?, spendingAllowanceCentsOverride? }
 *        - Creates a program_invites row. If the user with that email is
 *          already signed up, the consume-invites helper attaches them
 *          immediately. Otherwise the invite is consumed on their next
 *          sign-in. If allowed-domain guardrails are set on the program,
 *          the email must match one or the invite is rejected.
 *
 *   POST /api/account/programs?action=revoke-invite     body: { id, inviteId }
 *
 *   POST /api/account/programs?action=add-domain        body: { id, domain }
 *        - OPTIONAL guardrail. If any domain rows exist on a program,
 *          invite-member rejects emails that don't match one of them.
 *          Domains do NOT auto-attach anyone.
 *   POST /api/account/programs?action=remove-domain     body: { id, domain }
 *
 *   POST /api/account/programs?action=set-member-allowance
 *        body: { id, userId, spendingAllowanceCents }
 *   POST /api/account/programs?action=remove-member     body: { id, userId }
 *
 *   GET /api/account/programs?id=<uuid>&export=csv
 *     → text/csv attachment with the member list (cohort, email, spent,
 *       remaining, size distribution if available from lead carts)
 * ========================================================================= */

const { requireUser, setCorsHeaders, readJsonBody } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');
const { requireBusiness, getDefaultOrg, requireOrgRole } = require('../_lib/business');

function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  try { await requireBusiness(supabase, user.id); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'business gate failed' }); }

  let org;
  try { org = await getDefaultOrg(supabase, user.id); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'org lookup failed' }); }

  try { await requireOrgRole(supabase, user.id, org.id, ['owner', 'admin']); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'forbidden' }); }

  // ------------------------------------------------------------
  // GET — list, single, or CSV export
  // ------------------------------------------------------------
  if (req.method === 'GET') {
    const id = req.query?.id;
    const wantCsv = req.query?.export === 'csv';

    if (id) {
      const { data: prog, error: pErr } = await supabase
        .from('programs').select('*')
        .eq('id', id).eq('organization_id', org.id).maybeSingle();
      if (pErr) return res.status(500).json({ error: pErr.message });
      if (!prog) return res.status(404).json({ error: 'program not found' });

      const [membersRes, catalogRes, domainsRes, invitesRes] = await Promise.all([
        supabase.from('program_members')
          .select('user_id, cohort_label, spending_allowance_cents, spent_cents, joined_at, joined_via')
          .eq('program_id', id),
        supabase.from('program_catalog_items')
          .select('product_id, display_name, added_at')
          .eq('program_id', id),
        supabase.from('program_email_domains')
          .select('domain, added_at')
          .eq('program_id', id),
        supabase.from('program_invites')
          .select('id, email, invited_at, consumed_at, revoked_at, cohort_label_override, spending_allowance_cents_override')
          .eq('program_id', id)
          .is('consumed_at', null)
          .is('revoked_at',  null)
          .order('invited_at', { ascending: false })
      ]);
      if (membersRes.error)  return res.status(500).json({ error: membersRes.error.message });
      if (catalogRes.error)  return res.status(500).json({ error: catalogRes.error.message });
      if (domainsRes.error)  return res.status(500).json({ error: domainsRes.error.message });
      if (invitesRes.error)  return res.status(500).json({ error: invitesRes.error.message });

      // Hydrate member emails from profiles for the admin table.
      const userIds = (membersRes.data || []).map((m) => m.user_id);
      let profilesById = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles').select('id, email, display_name')
          .in('id', userIds);
        for (const p of profs || []) profilesById[p.id] = p;
      }

      // Compute live spend for each member from the orders table.
      // Joins customers → user_id, then sums orders.total scoped to this
      // program_id. We do this in JS so the SQL stays simple.
      const spentByUser = {};
      if (userIds.length) {
        const { data: customers } = await supabase
          .from('customers').select('id, user_id').in('user_id', userIds);
        const userIdByCustomerId = {};
        const customerIds = [];
        for (const c of customers || []) {
          userIdByCustomerId[c.id] = c.user_id;
          customerIds.push(c.id);
        }
        if (customerIds.length) {
          const { data: ords } = await supabase
            .from('orders').select('customer_id, total, paid_status, balance_paid_at')
            .eq('program_id', id).in('customer_id', customerIds);
          for (const o of ords || []) {
            const uid = userIdByCustomerId[o.customer_id];
            if (!uid) continue;
            // Count only paid orders toward spend.
            const isPaid = /^(paid|refunded)$/i.test(o.paid_status || '')
              || o.balance_paid_at != null;
            if (!isPaid) continue;
            // orders.total is numeric dollars; convert to cents.
            const cents = Math.round(Number(o.total || 0) * 100);
            spentByUser[uid] = (spentByUser[uid] || 0) + cents;
          }
        }
      }

      const members = (membersRes.data || []).map((m) => ({
        userId:                  m.user_id,
        email:                   profilesById[m.user_id]?.email || null,
        displayName:             profilesById[m.user_id]?.display_name || null,
        cohortLabel:             m.cohort_label || prog.cohort_label,
        spendingAllowanceCents:  m.spending_allowance_cents != null
                                   ? m.spending_allowance_cents
                                   : prog.default_spending_allowance_cents,
        // spent_cents on program_members is a stale cache; the live
        // number comes from summing paid orders.
        spentCents:              spentByUser[m.user_id] || 0,
        joinedAt:                m.joined_at,
        joinedVia:               m.joined_via
      }));

      if (wantCsv) {
        const headers = ['email','display_name','cohort','allowance_cents','spent_cents','remaining_cents','joined_at','joined_via'];
        const lines = [headers.join(',')];
        for (const m of members) {
          const rem = m.spendingAllowanceCents != null
            ? Math.max(0, m.spendingAllowanceCents - m.spentCents) : '';
          lines.push([
            csvCell(m.email),
            csvCell(m.displayName),
            csvCell(m.cohortLabel),
            csvCell(m.spendingAllowanceCents),
            csvCell(m.spentCents),
            csvCell(rem),
            csvCell(m.joinedAt),
            csvCell(m.joinedVia)
          ].join(','));
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${prog.slug}-members.csv"`);
        return res.status(200).send(lines.join('\n'));
      }

      return res.status(200).json({
        program: {
          ...prog,
          members,
          catalogProductIds: (catalogRes.data || []).map((c) => c.product_id),
          emailDomains:      (domainsRes.data || []).map((d) => d.domain),
          pendingInvites:    (invitesRes.data || []).map((i) => ({
            id:                              i.id,
            email:                           i.email,
            invitedAt:                       i.invited_at,
            cohortLabelOverride:             i.cohort_label_override,
            spendingAllowanceCentsOverride:  i.spending_allowance_cents_override
          })),
          totalSpentCents:   members.reduce((acc, m) => acc + (m.spentCents || 0), 0)
        }
      });
    }

    // List
    const { data: progs, error } = await supabase
      .from('programs')
      .select('id, slug, name, cohort_label, default_spending_allowance_cents, order_window_opens_at, order_window_closes_at, is_active')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });

    // Member counts in one batch.
    const ids = (progs || []).map((p) => p.id);
    const memberCounts = {};
    if (ids.length) {
      const { data: rows } = await supabase
        .from('program_members')
        .select('program_id, user_id')
        .in('program_id', ids);
      for (const r of rows || []) memberCounts[r.program_id] = (memberCounts[r.program_id] || 0) + 1;
    }

    // Live total spend per program — sum orders.total where program_id
    // matches and the order is paid.
    const spentByProgram = {};
    if (ids.length) {
      const { data: ords } = await supabase
        .from('orders').select('program_id, total, paid_status, balance_paid_at')
        .in('program_id', ids);
      for (const o of ords || []) {
        const isPaid = /^(paid|refunded)$/i.test(o.paid_status || '')
          || o.balance_paid_at != null;
        if (!isPaid) continue;
        const cents = Math.round(Number(o.total || 0) * 100);
        spentByProgram[o.program_id] = (spentByProgram[o.program_id] || 0) + cents;
      }
    }

    return res.status(200).json({
      programs: (progs || []).map((p) => ({
        ...p,
        memberCount:     memberCounts[p.id]    || 0,
        totalSpentCents: spentByProgram[p.id]  || 0
      }))
    });
  }

  // ------------------------------------------------------------
  // Write verbs
  // ------------------------------------------------------------
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
    return res.status(405).json({ error: 'method not allowed' });
  }

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const action = req.query?.action || body.action;

  // CREATE
  if (req.method === 'POST' && !action) {
    const name = String(body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    const slug = slugify(body.slug || name);
    if (!slug) return res.status(400).json({ error: 'slug required' });

    const insertRow = {
      organization_id:                   org.id,
      slug,
      name,
      cohort_label:                      body.cohortLabel || null,
      description:                       body.description || null,
      default_spending_allowance_cents:  body.defaultSpendingAllowanceCents != null
                                           ? Number(body.defaultSpendingAllowanceCents) : null,
      order_window_opens_at:             body.windowOpensAt  || null,
      order_window_closes_at:            body.windowClosesAt || null
    };

    const { data, error } = await supabase
      .from('programs').insert(insertRow).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ program: data });
  }

  // helpers below assume `id` in body and ownership
  async function loadProgram(id) {
    const { data, error } = await supabase
      .from('programs').select('id, organization_id')
      .eq('id', id).maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { notFound: true };
    if (data.organization_id !== org.id) return { forbidden: true };
    return { program: data };
  }

  // UPDATE
  if (req.method === 'PUT') {
    if (!body.id) return res.status(400).json({ error: 'id required' });
    const own = await loadProgram(body.id);
    if (own.error)     return res.status(500).json({ error: own.error });
    if (own.notFound)  return res.status(404).json({ error: 'program not found' });
    if (own.forbidden) return res.status(403).json({ error: 'forbidden' });

    const update = { updated_at: new Date().toISOString() };
    if (body.name              !== undefined) update.name              = body.name;
    if (body.cohortLabel       !== undefined) update.cohort_label      = body.cohortLabel;
    if (body.description       !== undefined) update.description       = body.description;
    if (body.defaultSpendingAllowanceCents !== undefined)
      update.default_spending_allowance_cents = body.defaultSpendingAllowanceCents;
    if (body.windowOpensAt     !== undefined) update.order_window_opens_at  = body.windowOpensAt;
    if (body.windowClosesAt    !== undefined) update.order_window_closes_at = body.windowClosesAt;
    if (body.isActive          !== undefined) update.is_active = !!body.isActive;

    const { data, error } = await supabase
      .from('programs').update(update).eq('id', body.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ program: data });
  }

  // POST actions
  if (req.method === 'POST') {
    if (!body.id) return res.status(400).json({ error: 'id required' });
    const own = await loadProgram(body.id);
    if (own.error)     return res.status(500).json({ error: own.error });
    if (own.notFound)  return res.status(404).json({ error: 'program not found' });
    if (own.forbidden) return res.status(403).json({ error: 'forbidden' });

    if (action === 'add-catalog') {
      const ids = Array.isArray(body.productIds) ? body.productIds : [];
      if (!ids.length) return res.status(400).json({ error: 'productIds required' });
      const rows = ids.map((pid) => ({ program_id: body.id, product_id: pid }));
      const { error } = await supabase
        .from('program_catalog_items').upsert(rows, { onConflict: 'program_id,product_id' });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true, added: ids.length });
    }

    if (action === 'remove-catalog') {
      const ids = Array.isArray(body.productIds) ? body.productIds : [];
      if (!ids.length) return res.status(400).json({ error: 'productIds required' });
      const { error } = await supabase
        .from('program_catalog_items').delete()
        .eq('program_id', body.id).in('product_id', ids);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(204).end();
    }

    if (action === 'add-domain') {
      const domain = String(body.domain || '').trim().toLowerCase();
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return res.status(400).json({ error: 'invalid domain' });
      const { error } = await supabase
        .from('program_email_domains')
        .upsert({ program_id: body.id, domain }, { onConflict: 'program_id,domain' });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === 'invite-member') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'valid email required' });
      }

      // Domain guardrail: if any allowed domains are configured on the
      // program, the invite email MUST match one. This is the security
      // backstop — admins still issue invites explicitly, but if they
      // typo or paste the wrong list, the guardrail catches it.
      const { data: guardrails, error: gErr } = await supabase
        .from('program_email_domains').select('domain').eq('program_id', body.id);
      if (gErr) return res.status(500).json({ error: gErr.message });

      if ((guardrails || []).length > 0) {
        const userDomain = email.split('@')[1];
        const allowed = guardrails.some((g) => g.domain === userDomain);
        if (!allowed) {
          return res.status(400).json({
            error: `email domain @${userDomain} is not on this program's allowed list (${(guardrails || []).map(g => '@' + g.domain).join(', ')})`
          });
        }
      }

      // Reject if the user is already a member.
      const { data: existingProf } = await supabase
        .from('profiles').select('id').eq('email', email).maybeSingle();
      if (existingProf) {
        const { data: existingMem } = await supabase
          .from('program_members').select('user_id')
          .eq('program_id', body.id).eq('user_id', existingProf.id).maybeSingle();
        if (existingMem) {
          return res.status(409).json({ error: 'this user is already a member' });
        }
      }

      const insertRow = {
        program_id:                         body.id,
        email,
        invited_by_user_id:                 user.id,
        cohort_label_override:              body.cohortLabelOverride || null,
        spending_allowance_cents_override:  body.spendingAllowanceCentsOverride != null
                                              ? Number(body.spendingAllowanceCentsOverride) : null
      };
      const { data: invite, error: insErr } = await supabase
        .from('program_invites').insert(insertRow).select().single();
      if (insErr) {
        // Most likely a duplicate-active-invite conflict — clean message.
        if (/duplicate key/i.test(insErr.message)) {
          return res.status(409).json({ error: 'an active invite already exists for this email' });
        }
        return res.status(400).json({ error: insErr.message });
      }

      // If the invitee already has an account, consume the invite on the
      // spot so they don't have to sign in again to see the program.
      if (existingProf) {
        await supabase.rpc('consume_program_invites_for_user', { target_user_id: existingProf.id });
      }

      return res.status(201).json({
        invite,
        appliedImmediately: !!existingProf
      });
    }

    if (action === 'revoke-invite') {
      if (!body.inviteId) return res.status(400).json({ error: 'inviteId required' });
      const { error } = await supabase
        .from('program_invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', body.inviteId)
        .eq('program_id', body.id)
        .is('consumed_at', null);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(204).end();
    }

    if (action === 'remove-domain') {
      const domain = String(body.domain || '').trim().toLowerCase();
      const { error } = await supabase
        .from('program_email_domains').delete()
        .eq('program_id', body.id).eq('domain', domain);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(204).end();
    }

    if (action === 'set-member-allowance') {
      if (!body.userId) return res.status(400).json({ error: 'userId required' });
      const { error } = await supabase
        .from('program_members')
        .update({ spending_allowance_cents: body.spendingAllowanceCents })
        .eq('program_id', body.id).eq('user_id', body.userId);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === 'remove-member') {
      if (!body.userId) return res.status(400).json({ error: 'userId required' });
      const { error } = await supabase
        .from('program_members').delete()
        .eq('program_id', body.id).eq('user_id', body.userId);
      if (error) return res.status(400).json({ error: error.message });
      return res.status(204).end();
    }

    return res.status(400).json({ error: 'unknown action' });
  }

  // DELETE
  if (req.method === 'DELETE') {
    if (!body.id) return res.status(400).json({ error: 'id required' });
    const own = await loadProgram(body.id);
    if (own.error)     return res.status(500).json({ error: own.error });
    if (own.notFound)  return res.status(404).json({ error: 'program not found' });
    if (own.forbidden) return res.status(403).json({ error: 'forbidden' });

    const { error } = await supabase.from('programs').delete().eq('id', body.id);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'method not allowed' });
};
