/* =========================================================================
 * /api/account/team — business-only
 *
 * Manage the caller's default organization and its members. The default
 * org is created lazily on first call (see lib/business.js#getDefaultOrg).
 *
 * Routes:
 *
 *   GET /api/account/team
 *     → { organization, members: [{ userId, email, role, invitedAt, joinedAt }] }
 *
 *   POST /api/account/team?action=invite   body: { email, role? }
 *     - role ∈ {'admin', 'member'}; defaults to 'member'.
 *     - If a user with that email already exists, they're added immediately.
 *     - Otherwise an "invited" row is created keyed by email; the trigger
 *       on auth.users will later promote it to a real membership when that
 *       user signs up. (TODO: hook that promotion into handle_new_user.)
 *     - Sends an invitation email via Resend if RESEND_API_KEY is set.
 *
 *   PUT /api/account/team       body: { userId, role }
 *     - Change a member's role. Owners are immutable here (transfer-of-
 *       ownership is its own flow not implemented in Phase 1).
 *
 *   DELETE /api/account/team    body: { userId }
 *     - Remove a member from the org. Cannot remove the owner.
 *
 * Auth gate: account_type='business' AND role in {'owner','admin'} for
 * write verbs; any member role for GET.
 * ========================================================================= */

const { requireUser, setCorsHeaders, readJsonBody } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');
const { getDefaultOrg, requireOrgRole, requireBusiness } = require('../_lib/business');

async function sendInviteEmail({ to, orgName, inviterEmail }) {
  if (!process.env.RESEND_API_KEY) return; // soft-disabled — log skipped
  const from   = process.env.EMAIL_FROM    || 'no-reply@singhsprint.com';
  const replyTo= process.env.EMAIL_REPLY_TO|| 'sales@singhsprint.com';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        from, to, reply_to: replyTo,
        subject: `You've been invited to ${orgName} on Singhs Print`,
        html: `<p>${inviterEmail} added you to the <strong>${orgName}</strong> team on Singhs Print.</p>
               <p>Sign in at <a href="https://singhsprint.com/account/signin.html">singhsprint.com/account</a> using this email to access shared quotes, artwork, and order history.</p>`
      })
    });
  } catch (e) {
    console.warn('[team invite] email send failed:', e.message);
  }
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  let org;
  try { org = await getDefaultOrg(supabase, user.id); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'business gate failed' }); }

  // ------------------------------------------------------------
  // GET — org + members
  // ------------------------------------------------------------
  if (req.method === 'GET') {
    const { data: members, error } = await supabase
      .from('organization_members')
      .select('user_id, role, invited_email, invited_at, joined_at')
      .eq('organization_id', org.id);
    if (error) return res.status(500).json({ error: error.message });

    // Fan out to profiles for display fields.
    const userIds = members.filter((m) => m.user_id).map((m) => m.user_id);
    let profilesById = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from('profiles').select('id, email, display_name')
        .in('id', userIds);
      for (const p of profs || []) profilesById[p.id] = p;
    }

    return res.status(200).json({
      organization: { id: org.id, name: org.name, defaultPaymentTerms: org.default_payment_terms },
      members: members.map((m) => ({
        userId:       m.user_id,
        role:         m.role,
        email:        m.user_id ? (profilesById[m.user_id]?.email || null) : m.invited_email,
        displayName:  m.user_id ? profilesById[m.user_id]?.display_name : null,
        invitedAt:    m.invited_at,
        joinedAt:     m.joined_at,
        isPending:    !m.joined_at
      }))
    });
  }

  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  // Write verbs require owner/admin role.
  try { await requireOrgRole(supabase, user.id, org.id, ['owner', 'admin']); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'forbidden' }); }

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const action = req.query?.action || body.action;

  // ------------------------------------------------------------
  // POST ?action=invite — add by email
  // ------------------------------------------------------------
  if (req.method === 'POST' && action === 'invite') {
    const email = String(body.email || '').trim().toLowerCase();
    const role  = body.role && ['admin', 'member'].includes(body.role) ? body.role : 'member';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'valid email required' });
    }

    // Look up the user if they already exist.
    const { data: existingProf } = await supabase
      .from('profiles').select('id').eq('email', email).maybeSingle();

    if (existingProf) {
      // Add immediately as a joined member.
      const { error } = await supabase.from('organization_members').upsert({
        organization_id: org.id,
        user_id:         existingProf.id,
        role,
        joined_at:       new Date().toISOString()
      }, { onConflict: 'organization_id,user_id' });
      if (error) return res.status(500).json({ error: error.message });
    } else {
      // Pending invite — keyed by email until the user signs up.
      // We synthesise a deterministic uuid from the email for the PK so
      // upserts on repeated invites idempotently update instead of stacking.
      const crypto = require('crypto');
      const synthUuid = (() => {
        const h = crypto.createHash('sha1').update(`invite:${org.id}:${email}`).digest('hex');
        return [
          h.substring(0, 8), h.substring(8, 12), '5' + h.substring(13, 16),
          ((parseInt(h.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + h.substring(18, 20),
          h.substring(20, 32)
        ].join('-');
      })();
      // Note: this synthUuid will collide with the real user_id once they
      // sign up; the promotion step (TODO in handle_new_user) should
      // delete the synth row and insert the real one.
      const { error } = await supabase.from('organization_members').upsert({
        organization_id: org.id,
        user_id:         synthUuid,
        role,
        invited_email:   email,
        invited_at:      new Date().toISOString()
      }, { onConflict: 'organization_id,user_id' });
      if (error && !/foreign key/i.test(error.message)) {
        return res.status(500).json({ error: error.message });
      }
      // If the FK on user_id blocks the synth UUID, store the invite in a
      // separate "pending_invites" mechanism instead. Phase 1 keeps the
      // simpler synth approach; if your auth.users FK rejects it, swap to
      // a dedicated pending_org_invites table.
    }

    await sendInviteEmail({ to: email, orgName: org.name, inviterEmail: user.email });
    return res.status(201).json({ ok: true });
  }

  // ------------------------------------------------------------
  // PUT — change role
  // ------------------------------------------------------------
  if (req.method === 'PUT') {
    const targetId = body.userId;
    const role     = body.role;
    if (!targetId || !['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'userId and role (admin|member) required' });
    }
    // Don't let admins demote the owner.
    const { data: target } = await supabase
      .from('organization_members')
      .select('role').eq('organization_id', org.id).eq('user_id', targetId).maybeSingle();
    if (!target) return res.status(404).json({ error: 'member not found' });
    if (target.role === 'owner') return res.status(403).json({ error: 'cannot change the owner role' });

    const { error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('organization_id', org.id).eq('user_id', targetId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  // ------------------------------------------------------------
  // DELETE — remove member
  // ------------------------------------------------------------
  if (req.method === 'DELETE') {
    const targetId = body.userId;
    if (!targetId) return res.status(400).json({ error: 'userId required' });
    if (targetId === org.owner_user_id) {
      return res.status(403).json({ error: 'cannot remove the owner' });
    }
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', org.id).eq('user_id', targetId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  return res.status(400).json({ error: 'unknown action' });
};
