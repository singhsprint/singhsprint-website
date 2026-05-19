/* =========================================================================
 * /api/account/payment-password
 *
 * The "payment password" is the secret a customer sets the first time they
 * save a card. It is SEPARATE from their sign-in credential (they sign in
 * with email or phone OTP — no password). Once set, the password must be
 * re-entered to add a card, list cards in detail, or charge a saved card.
 *
 * Routes (all require a valid Supabase access token):
 *
 *   GET  /api/account/payment-password
 *     → { isSet: boolean, updatedAt: ISO|null }
 *
 *   POST /api/account/payment-password
 *     body: { password, currentPassword? }
 *     - First-time set: currentPassword may be omitted iff no password is
 *       currently on file.
 *     - Change:   currentPassword is required and must verify.
 *     → { ok: true, unlockToken, expiresInSeconds }
 *
 *   POST /api/account/payment-password?action=verify
 *     body: { password }
 *     → { unlockToken, expiresInSeconds }
 *     The browser caches this token in memory and includes it in
 *     X-Payment-Unlock when calling /api/account/cards.
 *
 * Never returns the hash or salt. Never logs the plaintext password.
 * ========================================================================= */

const { requireUser, setCorsHeaders, readJsonBody } = require('../_lib/auth');
const { adminClient } = require('../_lib/supabase');
const {
  hashPassword, verifyPassword,
  signUnlockToken, unlockTtlSeconds
} = require('../_lib/payment-password');

module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (e) { return res.status(e.status || 500).json(e.body || { error: 'auth failed' }); }

  const supabase = adminClient();

  // ------------------------------------------------------------
  // GET — has the user set a payment password yet?
  // ------------------------------------------------------------
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('profiles')
      .select('payment_password_hash, payment_password_updated_at')
      .eq('id', user.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({
      isSet: !!data?.payment_password_hash,
      updatedAt: data?.payment_password_updated_at || null
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const action = req.query?.action || body.action;

  // ------------------------------------------------------------
  // POST ?action=profile — update lightweight profile fields
  // (display_name today, extensible later). Folded into this handler
  // to avoid adding another function under the Hobby 12-fn cap.
  // ------------------------------------------------------------
  if (action === 'profile') {
    const patch = {};
    if (typeof body.displayName === 'string') {
      const name = body.displayName.trim();
      if (name.length > 80) return res.status(400).json({ error: 'displayName too long (max 80 chars)' });
      patch.display_name = name || null;
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'no profile fields supplied' });
    }
    patch.updated_at = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', user.id);
    if (updErr) return res.status(500).json({ error: updErr.message });
    return res.status(200).json({ ok: true, profile: { displayName: patch.display_name } });
  }

  // ------------------------------------------------------------
  // POST ?action=verify — exchange the password for an unlock token
  // ------------------------------------------------------------
  if (action === 'verify') {
    if (typeof body.password !== 'string') return res.status(400).json({ error: 'password required' });

    const { data, error } = await supabase
      .from('profiles')
      .select('payment_password_hash, payment_password_salt')
      .eq('id', user.id)
      .maybeSingle();
    if (error)        return res.status(500).json({ error: error.message });
    if (!data?.payment_password_hash) return res.status(409).json({ error: 'no payment password is set' });

    if (!verifyPassword(body.password, data.payment_password_hash, data.payment_password_salt)) {
      return res.status(401).json({ error: 'incorrect payment password' });
    }
    const token = signUnlockToken(user.id);
    return res.status(200).json({ unlockToken: token, expiresInSeconds: unlockTtlSeconds() });
  }

  // ------------------------------------------------------------
  // POST (default) — set or change the payment password
  // ------------------------------------------------------------
  if (typeof body.password !== 'string' || body.password.length < 8) {
    return res.status(400).json({ error: 'new password must be at least 8 characters' });
  }

  const { data: existing, error: readErr } = await supabase
    .from('profiles')
    .select('payment_password_hash, payment_password_salt')
    .eq('id', user.id)
    .maybeSingle();
  if (readErr) return res.status(500).json({ error: readErr.message });

  if (existing?.payment_password_hash) {
    // Change flow — currentPassword required.
    if (typeof body.currentPassword !== 'string') {
      return res.status(400).json({ error: 'currentPassword required to change an existing payment password' });
    }
    if (!verifyPassword(body.currentPassword, existing.payment_password_hash, existing.payment_password_salt)) {
      return res.status(401).json({ error: 'incorrect current payment password' });
    }
  }

  const { hash, salt } = hashPassword(body.password);
  const { error: updErr } = await supabase
    .from('profiles')
    .update({
      payment_password_hash:       hash,
      payment_password_salt:       salt,
      payment_password_updated_at: new Date().toISOString(),
      updated_at:                  new Date().toISOString()
    })
    .eq('id', user.id);
  if (updErr) return res.status(500).json({ error: updErr.message });

  const token = signUnlockToken(user.id);
  return res.status(200).json({
    ok: true,
    unlockToken: token,
    expiresInSeconds: unlockTtlSeconds()
  });
};
