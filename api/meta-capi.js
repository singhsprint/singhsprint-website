/* =========================================================================
 * Meta Conversions API (CAPI) - SERVER-SIDE PROXY
 * -------------------------------------------------------------------------
 * Vercel serverless function. The client (pixel.js) POSTs events here; we
 * hash PII with SHA-256, enrich with IP + user agent from the request, and
 * forward to Meta's Graph API. The client NEVER touches graph.facebook.com
 * directly, so ad-blockers that kill connect.facebook.net can't stop this
 * path.
 *
 * Env vars required (set in Vercel Dashboard -> Project -> Settings -> Env Vars):
 *   META_PIXEL_ID          - your Pixel ID (must match window.SP_PIXEL_ID)
 *   META_CAPI_ACCESS_TOKEN - Events Manager -> Settings -> "Generate access token"
 *   META_TEST_EVENT_CODE   - (optional) TEST12345 value from Events Manager
 *                            "Test events" tab; omit for production traffic.
 *
 * Endpoint: POST /api/meta-capi
 * Body: { event_name, event_id, event_time, event_source_url, action_source,
 *         user_data: { em?, ph?, fn?, ln?, ct?, st?, zp?, country?, fbp?, fbc? },
 *         custom_data: { ... } }
 * ========================================================================= */

const crypto = require('crypto');

const GRAPH_URL_BASE = 'https://graph.facebook.com/v19.0';

// Fields in user_data that Meta expects hashed (SHA-256, lowercase hex).
// fbp / fbc / client_ip_address / client_user_agent are NOT hashed.
const HASHED_FIELDS = ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country', 'ge', 'db'];

// Normalize then SHA-256 hash a PII field. Meta's required normalization:
//   email/name/city/state/country: trim + lowercase
//   phone: strip everything non-digit
//   zip: trim + lowercase
function hashPII(field, value) {
  if (value == null) return undefined;
  let v = String(value).trim().toLowerCase();
  if (field === 'ph') v = v.replace(/\D/g, ''); // phone: digits only
  if (!v) return undefined;
  return crypto.createHash('sha256').update(v).digest('hex');
}

// Read the client's real IP from Vercel/Proxy headers. Meta wants the end
// user's IP, not our server's. x-forwarded-for is a comma-separated chain;
// first entry is the original client.
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress;
}

// Best-effort JSON body parse. sendBeacon sometimes arrives as text/plain.
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

module.exports = async function handler(req, res) {
  // -- CORS: same-origin only, but explicit for safety (Vercel preview URLs)
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // -- Env var sanity check. Fail closed, but log clearly.
  const PIXEL_ID    = process.env.META_PIXEL_ID;
  const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
  const TEST_CODE   = process.env.META_TEST_EVENT_CODE; // optional
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.error('[meta-capi] Missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN env var');
    return res.status(500).json({ error: 'capi_not_configured' });
  }

  const incoming = await readBody(req);
  if (!incoming.event_name || !incoming.event_id) {
    return res.status(400).json({ error: 'missing_event_name_or_event_id' });
  }

  // -- Build user_data: hash PII, attach IP + UA from the request itself.
  const rawUser = incoming.user_data || {};
  const user_data = {};
  for (const f of HASHED_FIELDS) {
    const h = hashPII(f, rawUser[f]);
    if (h) user_data[f] = h;
  }
  if (rawUser.fbp) user_data.fbp = rawUser.fbp;
  if (rawUser.fbc) user_data.fbc = rawUser.fbc;
  user_data.client_ip_address = clientIp(req);
  user_data.client_user_agent = req.headers['user-agent'];

  const payload = {
    data: [{
      event_name:       incoming.event_name,
      event_id:         incoming.event_id,           // <-- matches client fbq eventID -> dedup
      event_time:       incoming.event_time || Math.floor(Date.now() / 1000),
      event_source_url: incoming.event_source_url,
      action_source:    incoming.action_source || 'website',
      user_data,
      custom_data:      incoming.custom_data || {}
    }]
  };
  if (TEST_CODE) payload.test_event_code = TEST_CODE;

  // -- Forward to Meta. Node 18+ has global fetch.
  const url = `${GRAPH_URL_BASE}/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const meta = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('[meta-capi] Graph API error', r.status, meta);
      return res.status(502).json({ error: 'graph_api_error', status: r.status, meta });
    }
    // Echo event_id back so /debug-pixel can display what it sent.
    return res.status(200).json({ ok: true, event_id: incoming.event_id, meta });
  } catch (err) {
    console.error('[meta-capi] fetch failed', err);
    return res.status(502).json({ error: 'fetch_failed' });
  }
};
