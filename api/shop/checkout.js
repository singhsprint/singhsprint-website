/* =========================================================================
 * POST /api/shop/checkout
 *
 * Public endpoint. Creates a Stripe Checkout Session for a drop purchase
 * and returns the redirect URL. The /shop/<slug> page POSTs to this when
 * the customer clicks "Buy now".
 *
 * Body: { drop_id }  (UUID — comes from the rendered page's data-drop-id)
 *
 * Response: { url }   (the Stripe Checkout URL to redirect to)
 *
 * Pattern mirrors api/account/allocations.js's allocation_extras checkout
 * but for an anonymous DTC buyer — no signed-in user required. Metadata
 * carries purpose='drop_purchase' and drop_id so the stripe-webhook can
 * route the completion event to the drop_orders table.
 *
 * automatic_tax is enabled — your Stripe account is configured for CA
 * tax (GST/HST/PST/QST) and Stripe handles the math.
 * ========================================================================= */

const Stripe = require('stripe');
const { adminClient } = require('../_lib/supabase');

function stripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
}

function siteUrl(req) {
  // Follow the convention set by api/account/allocations.js — env var name
  // is PUBLIC_SITE_URL. Fall back to the request host so this still works
  // before that env is set.
  return process.env.PUBLIC_SITE_URL
      || process.env.SITE_URL
      || `https://${req.headers.host || 'singhsprint.com'}`;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => { buf += c; });
    req.on('end', () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Quote shipping rates from the CRM's Chit Chats integration. We hit
// `/api/shipping/estimate` once for a representative CA postal (M5V 2T6 —
// Toronto, urban CA-wide tracked rate) and once for a representative US
// postal (10001 — NYC). Stripe Checkout presents both as options; the
// customer's address determines which one applies.
//
// If the CRM endpoint is unreachable or returns no rate, fall back to a
// conservative flat amount so the checkout flow never blocks on a transient
// shipping-quoter outage.
//
// Returns Stripe shipping_options[] ready to splat into a Checkout Session.
// ---------------------------------------------------------------------------
async function buildShippingOptions(drop) {
  const currency = (drop.currency || 'CAD').toLowerCase();
  const crmBase  = process.env.CRM_BASE_URL || 'https://singhsprint-crm.vercel.app';

  async function quote(postal, country) {
    try {
      const res = await fetch(`${crmBase}/api/shipping/estimate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          items:        [{ qty: 1, garment_type: 'tshirt' }], // representative item; ~180g
          postal_code:  postal,
          country_code: country,
          declared_value_cad: Math.max(20, Math.round((drop.retail_price_cents || 4500) / 100)),
        }),
      });
      if (!res.ok) return null;
      const j = await res.json();
      const cents = Math.round(Number(j?.cheapest?.fee_cad || 0) * 100);
      if (!cents) return null;
      return cents;
    } catch (e) {
      console.warn('[buildShippingOptions] CRM unreachable for', country, e?.message);
      return null;
    }
  }

  const [caCents, usCents] = await Promise.all([
    quote('M5V 2T6', 'CA'),
    quote('10001',   'US'),
  ]);

  // Fallbacks tuned against Chit Chats averages so a customer never sees $0
  // or a broken-looking option if the rate quote fails.
  const caFinal = caCents ?? 1000;  // $10 CAD
  const usFinal = usCents ?? 1800;  // $18 CAD

  return [
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: caFinal, currency },
        display_name: 'Canada — Standard',
        tax_behavior: 'exclusive',
        delivery_estimate: {
          minimum: { unit: 'business_day', value: 3 },
          maximum: { unit: 'business_day', value: 7 },
        },
      },
    },
    {
      shipping_rate_data: {
        type: 'fixed_amount',
        fixed_amount: { amount: usFinal, currency },
        display_name: 'United States — Standard',
        tax_behavior: 'exclusive',
        delivery_estimate: {
          minimum: { unit: 'business_day', value: 5 },
          maximum: { unit: 'business_day', value: 12 },
        },
      },
    },
  ];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const body = await readBody(req);
    const dropId = (body.drop_id || '').toString().trim();
    const size = (body.size || '').toString().trim();
    if (!dropId) return res.status(400).json({ error: 'drop_id required' });

    // Load the drop (service role bypasses RLS; we re-check status here).
    const supabase = adminClient();
    const { data: drop, error } = await supabase
      .from('drops')
      .select('id, slug, title, mockup_url, inventory_limit, sizes, retail_price_cents, currency, status')
      .eq('id', dropId)
      .maybeSingle();
    if (error) throw error;
    if (!drop)               return res.status(404).json({ error: 'drop not found' });
    if (drop.status !== 'live') return res.status(409).json({ error: 'drop not live' });

    // Size: required + validated when the drop offers sizes.
    const offeredSizes = Array.isArray(drop.sizes) ? drop.sizes.filter(Boolean) : [];
    if (offeredSizes.length && (!size || !offeredSizes.includes(size))) {
      return res.status(400).json({ error: 'Please choose a valid size.' });
    }

    // Limited-run guard: block checkout when sold out, and cap to 1 unit per
    // order so the paid-order count stays equal to units sold.
    let maxQty = 10;
    if (drop.inventory_limit != null) {
      const { count } = await supabase
        .from('drop_orders')
        .select('id', { count: 'exact', head: true })
        .eq('drop_id', drop.id)
        .in('status', ['paid', 'fulfilled']);
      if ((drop.inventory_limit - (count || 0)) <= 0) {
        return res.status(409).json({ error: 'This drop is sold out.' });
      }
      maxQty = 1;
    }

    const base = siteUrl(req);
    const successUrl = `${base}/shop/${encodeURIComponent(drop.slug)}?paid=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = `${base}/shop/${encodeURIComponent(drop.slug)}?cancel=1`;

    // Inline price_data — no need to create a persistent Stripe Product/Price.
    // Same shape as api/account/allocations.js. Currency from the drop row.
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode:                'payment',
      payment_method_types: ['card'],
      automatic_tax:       { enabled: true },          // Stripe Tax (configured at account level)
      billing_address_collection: 'required',          // needed for tax calc + shipping label
      shipping_address_collection: { allowed_countries: ['CA', 'US'] },
      // Stripe-managed promo codes. Create codes in Dashboard → Products →
      // Coupons → Promotion codes. Customers paste at checkout. This does
      // NOT bridge to /api/promo (B2B system); that's a follow-up.
      allow_promotion_codes: true,
      line_items: [{
        price_data: {
          currency:     (drop.currency || 'CAD').toLowerCase(),
          product_data: {
            name:   drop.title + (size ? ` — Size ${size}` : ''),
            images: drop.mockup_url ? [drop.mockup_url] : undefined,
          },
          unit_amount: drop.retail_price_cents,
          tax_behavior: 'exclusive',                    // tax added on top; Stripe Tax requires this
        },
        quantity: 1,
        adjustable_quantity: { enabled: maxQty > 1, minimum: 1, maximum: maxQty },
      }],
      // Real shipping rates via Chit Chats (CRM `/api/shipping/estimate`).
      // We quote TWO rates at session creation — one for CA, one for US —
      // using representative postals; Stripe Checkout shows both and the
      // customer's selected country drives which one applies cleanly.
      // Falls back to a flat $10/$18 if Chit Chats is unreachable so the
      // checkout never breaks on a transient outage.
      shipping_options: await buildShippingOptions(drop),
      metadata: {
        purpose:   'drop_purchase',
        drop_id:   drop.id,
        drop_slug: drop.slug,
        size:      size || '',
      },
      success_url: successUrl,
      cancel_url:  cancelUrl,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('[/api/shop/checkout]', e);
    return res.status(500).json({ error: e.message });
  }
};
