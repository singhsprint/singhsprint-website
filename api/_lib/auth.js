/* =========================================================================
 * Caller-authentication helpers for the customer-account API.
 *
 * Every protected endpoint must call requireUser(req) at the top. It:
 *   1. Reads the Bearer token from the Authorization header (the
 *      Supabase access token the browser holds).
 *   2. Asks Supabase Auth to validate it via auth.getUser(jwt).
 *   3. Returns { user, accessToken } so the endpoint can spin up a
 *      userClient() that respects RLS for the caller.
 *
 * If the token is missing or invalid, it throws an object shaped
 * { status, body } — endpoints catch this and forward to res.
 * ========================================================================= */

const { adminClient } = require('./supabase');

async function requireUser(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) throw { status: 401, body: { error: 'missing bearer token' } };
  const accessToken = m[1].trim();

  // adminClient().auth.getUser(jwt) verifies the token's signature and
  // expiry against Supabase Auth. It does NOT consume the token.
  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) {
    throw { status: 401, body: { error: 'invalid or expired session' } };
  }
  return { user: data.user, accessToken };
}

// Standard CORS + JSON response helpers used by every endpoint.
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment-Unlock');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => { buf += c; if (buf.length > 1_000_000) reject(new Error('body too large')); });
    req.on('end', () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

module.exports = { requireUser, setCorsHeaders, readJsonBody };
