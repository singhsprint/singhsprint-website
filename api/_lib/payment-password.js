/* =========================================================================
 * Payment-password hashing + unlock-token signing.
 *
 * Two distinct primitives:
 *
 *   hashPassword(plain)        → { hash, salt } stored in profiles
 *   verifyPassword(plain, h, s) → boolean, timing-safe
 *
 *   signUnlockToken(userId)    → opaque base64url token: "<payload>.<sig>"
 *                                 where payload = base64url(JSON {uid, exp})
 *                                 and sig = HMAC-SHA256(payload, PAYMENT_UNLOCK_SECRET).
 *   verifyUnlockToken(token, userId) → true if the signature is valid and
 *                                 the token has not expired and the embedded
 *                                 uid matches.
 *
 * The unlock token is what the browser sends in X-Payment-Unlock when it
 * calls /api/account/cards. It is short-lived (PAYMENT_UNLOCK_TTL_SECONDS,
 * default 600s) and bound to one user, so even if it leaks it can only be
 * replayed by that one user for ~10 minutes.
 *
 * Why scrypt over bcrypt: scrypt is in node:crypto (no native compile, no
 * extra dependency on Vercel) and is memory-hard. N=2^15 is the OWASP 2024
 * suggested floor for interactive logins.
 * ========================================================================= */

const crypto = require('crypto');

const SCRYPT_N      = 1 << 15;   // CPU/memory cost
const SCRYPT_R      = 8;
const SCRYPT_P      = 1;
const SCRYPT_KEYLEN = 64;
const SALT_BYTES    = 16;

function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length < 8) {
    throw new Error('payment password must be at least 8 characters');
  }
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.scryptSync(plain, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P
  });
  return { hash: hash.toString('hex'), salt: salt.toString('hex') };
}

function verifyPassword(plain, hashHex, saltHex) {
  if (!hashHex || !saltHex || typeof plain !== 'string') return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(plain, salt, expected.length, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P
  });
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

// --------------------------------------------------------------
// Unlock token
// --------------------------------------------------------------

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function unlockSecret() {
  const s = process.env.PAYMENT_UNLOCK_SECRET;
  if (!s) throw new Error('Missing env var PAYMENT_UNLOCK_SECRET');
  return s;
}

function unlockTtlSeconds() {
  const n = parseInt(process.env.PAYMENT_UNLOCK_TTL_SECONDS || '600', 10);
  return Number.isFinite(n) && n > 0 ? n : 600;
}

function signUnlockToken(userId) {
  const payload = b64url(JSON.stringify({
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + unlockTtlSeconds()
  }));
  const sig = crypto.createHmac('sha256', unlockSecret()).update(payload).digest();
  return `${payload}.${b64url(sig)}`;
}

function verifyUnlockToken(token, expectedUserId) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expectedSig = crypto.createHmac('sha256', unlockSecret()).update(payload).digest();
  const providedSig = b64urlDecode(sig);
  if (providedSig.length !== expectedSig.length) return false;
  if (!crypto.timingSafeEqual(providedSig, expectedSig)) return false;
  let body;
  try { body = JSON.parse(b64urlDecode(payload).toString('utf8')); }
  catch { return false; }
  if (body.uid !== expectedUserId) return false;
  if (typeof body.exp !== 'number' || body.exp < Math.floor(Date.now() / 1000)) return false;
  return true;
}

module.exports = {
  hashPassword, verifyPassword,
  signUnlockToken, verifyUnlockToken,
  unlockTtlSeconds
};
