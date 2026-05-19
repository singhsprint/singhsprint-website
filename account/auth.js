/* =========================================================================
 * Singhs Print — passwordless sign-in helpers (client-side).
 *
 * Customers sign in with either email or phone — no password. The flow:
 *
 *   1. requestEmailOtp(email)  or  requestPhoneOtp(phone)
 *        → Supabase emails / SMSes a 6-digit code.
 *   2. verifyEmailOtp(email, code)  or  verifyPhoneOtp(phone, code)
 *        → on success, a session is created and stored in localStorage
 *          (handled automatically by supabase-js).
 *
 * Phone numbers are normalized to E.164 (`+1...` for North America). If the
 * user types "514-555-1234" we'll send "+15145551234".
 *
 * This file expects /account/config.js to have set window.SP_AUTH and the
 * supabase-js library to be available as window.supabase. The HTML loads
 * both before this script.
 * ========================================================================= */

(function () {
  'use strict';

  if (!window.SP_AUTH) {
    console.error('SP_AUTH not configured; load /account/config.js first');
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('supabase-js not loaded; include the CDN script before auth.js');
    return;
  }

  const client = window.supabase.createClient(
    window.SP_AUTH.supabaseUrl,
    window.SP_AUTH.supabaseAnonKey,
    {
      auth: {
        persistSession:   true,
        autoRefreshToken: true,
        storageKey:       'sp.session.v1'
      }
    }
  );

  // Make the client reachable from other scripts (cards.js, account/index.html).
  window.SP_SUPABASE = client;

  // --------------------------------------------------------------
  // Phone normalization
  // --------------------------------------------------------------
  function normalizePhone(input) {
    if (typeof input !== 'string') return null;
    let s = input.trim();
    if (!s) return null;
    if (s.startsWith('+')) {
      const digits = s.slice(1).replace(/\D/g, '');
      return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
    }
    const digits = s.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;             // assume NA
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
    return null;
  }

  function normalizeEmail(input) {
    if (typeof input !== 'string') return null;
    const s = input.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
  }

  // --------------------------------------------------------------
  // OTP request + verify
  // --------------------------------------------------------------
  async function requestEmailOtp(email) {
    const e = normalizeEmail(email);
    if (!e) throw new Error('Please enter a valid email address.');
    // emailRedirectTo points magic-link clicks at /account/ where this
    // auth client is initialized — the Supabase JS client picks the
    // access token out of the URL hash automatically. Without this,
    // links land at the bare homepage (which doesn't initialize Supabase)
    // and the sign-in is silently dropped. The current email template
    // shows only the 6-digit code (no link), but this guards against
    // template changes.
    const { error } = await client.auth.signInWithOtp({
      email: e,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin + '/account/'
      }
    });
    if (error) throw error;
    return { email: e };
  }

  async function requestPhoneOtp(phone) {
    const p = normalizePhone(phone);
    if (!p) throw new Error('Please enter a valid phone number.');
    const { error } = await client.auth.signInWithOtp({
      phone: p,
      options: { shouldCreateUser: true }
    });
    if (error) throw error;
    return { phone: p };
  }

  async function verifyEmailOtp(email, code) {
    const e = normalizeEmail(email);
    if (!e) throw new Error('Invalid email.');
    if (!/^\d{6}$/.test(String(code || '').trim())) throw new Error('Enter the 6-digit code.');
    const { data, error } = await client.auth.verifyOtp({
      email: e, token: String(code).trim(), type: 'email'
    });
    if (error) throw error;
    return data;
  }

  async function verifyPhoneOtp(phone, code) {
    const p = normalizePhone(phone);
    if (!p) throw new Error('Invalid phone number.');
    if (!/^\d{6}$/.test(String(code || '').trim())) throw new Error('Enter the 6-digit code.');
    const { data, error } = await client.auth.verifyOtp({
      phone: p, token: String(code).trim(), type: 'sms'
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    try { localStorage.removeItem('sp.account.profile'); } catch (_) {}
    await client.auth.signOut();
  }

  // Cache key the global nav reads to decide whether to render the
  // "Business" pill instead of the round account icon. Account pages
  // call this with the freshest accountType + orgName after each
  // dashboard load — keeps the chip in sync without forcing every page
  // on the site to hit /api on load.
  function cacheAccountProfile(profile) {
    try {
      if (!profile) localStorage.removeItem('sp.account.profile');
      else          localStorage.setItem('sp.account.profile', JSON.stringify({
        accountType: profile.accountType || 'personal',
        orgName:     profile.orgName     || null,
        cachedAt:    Date.now()
      }));
    } catch (_) { /* localStorage full or blocked — silently ignore */ }
  }

  async function getSession() {
    const { data } = await client.auth.getSession();
    return data.session || null;
  }

  // Authorized fetch — attaches Bearer header for any /api/account/* call.
  async function authedFetch(path, options) {
    const session = await getSession();
    if (!session) throw new Error('Not signed in.');
    const headers = Object.assign({}, (options && options.headers) || {}, {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type':  'application/json'
    });
    return fetch(path, Object.assign({}, options || {}, { headers }));
  }

  window.SP_AUTH_API = {
    requestEmailOtp,
    requestPhoneOtp,
    verifyEmailOtp,
    verifyPhoneOtp,
    signOut,
    getSession,
    authedFetch,
    normalizePhone,
    normalizeEmail,
    cacheAccountProfile
  };
})();
