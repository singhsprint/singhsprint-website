/* =========================================================================
 * Supabase clients for the site's serverless API.
 *
 * Two clients are exported:
 *   adminClient()  — uses SUPABASE_SERVICE_ROLE_KEY. Bypasses RLS. Used only
 *                    by trusted server code (e.g. the Stripe webhook that
 *                    inserts a saved_cards row on the user's behalf).
 *   userClient(jwt) — uses the SUPABASE_ANON_KEY with the caller's JWT in
 *                    the Authorization header. RLS still applies, so this
 *                    client sees exactly what the signed-in user is allowed
 *                    to see. Use this for any read/update of profiles
 *                    triggered by the user.
 *
 * Both are factory functions so we don't accidentally share state between
 * concurrent invocations.
 * ========================================================================= */

const { createClient } = require('@supabase/supabase-js');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function adminClient() {
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function userClient(accessToken) {
  if (!accessToken) throw new Error('userClient requires an access token');
  return createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    }
  );
}

module.exports = { adminClient, userClient };
