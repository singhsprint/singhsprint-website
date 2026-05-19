/* =========================================================================
 * Business-tier gates shared by /api/account/team and /api/account/artwork.
 *
 *   requireBusiness(supabase, userId)
 *     → { profile }     if account_type === 'business'
 *     throws { status: 403, body }    otherwise
 *
 *   getDefaultOrg(supabase, userId)
 *     → organization row     (the user's default org)
 *     auto-creates one named "<email>'s team" on first call if none exists
 *     and the user is business.
 *
 *   requireOrgRole(supabase, userId, orgId, allowedRoles)
 *     → { membership }      if the user is a member of the org with an
 *                            allowed role
 *     throws { status: 403, body }    otherwise
 * ========================================================================= */

async function requireBusiness(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_type, default_organization_id, email, display_name')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw { status: 500, body: { error: error.message } };
  if (!data || data.account_type !== 'business') {
    throw { status: 403, body: { error: 'business account required' } };
  }
  return { profile: data };
}

async function getDefaultOrg(supabase, userId) {
  const { profile } = await requireBusiness(supabase, userId);

  // 1. Existing default org?
  if (profile.default_organization_id) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.default_organization_id)
      .maybeSingle();
    if (error) throw { status: 500, body: { error: error.message } };
    if (data) return data;
    // Default points at a deleted org — fall through and create a new one.
  }

  // 2. Member of any org? Pick the first.
  const { data: memberRow, error: memErr } = await supabase
    .from('organization_members')
    .select('organization_id, organizations:organizations(*)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (memErr) throw { status: 500, body: { error: memErr.message } };
  if (memberRow?.organizations) {
    await supabase.from('profiles')
      .update({ default_organization_id: memberRow.organizations.id })
      .eq('id', userId);
    return memberRow.organizations;
  }

  // 3. None yet — create one.
  const seedName = profile.display_name
    ? `${profile.display_name}'s team`
    : (profile.email ? `${profile.email.split('@')[0]}'s team` : 'My team');
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({ name: seedName, owner_user_id: userId })
    .select('*')
    .single();
  if (orgErr) throw { status: 500, body: { error: orgErr.message } };

  await supabase.from('organization_members').insert({
    organization_id: org.id,
    user_id:         userId,
    role:            'owner',
    joined_at:       new Date().toISOString()
  });
  await supabase.from('profiles')
    .update({ default_organization_id: org.id })
    .eq('id', userId);

  return org;
}

async function requireOrgRole(supabase, userId, orgId, allowedRoles) {
  const { data, error } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw { status: 500, body: { error: error.message } };
  if (!data || !allowedRoles.includes(data.role)) {
    throw { status: 403, body: { error: 'insufficient org role' } };
  }
  return { membership: data };
}

module.exports = { requireBusiness, getDefaultOrg, requireOrgRole };
