# Customer accounts — setup checklist

This is the one-time wiring you do in the Supabase, Twilio, Stripe, and
Vercel dashboards. The code is already in place — these are the toggles
that make it work in production.

## 1 · Run the database migration

Add the new tables to the same Supabase project the website's `leads` table
already lives in (`ptrqsjexrbyupexhcjdr.supabase.co`).

```
cd ../singhsprint-crm
psql "$SUPABASE_DB_URL" -f migrations/004_customer_accounts.sql
```

(or paste the file into Supabase Studio → SQL Editor → Run). This creates
`public.profiles`, `public.saved_cards`, RLS policies, and the auto-create-
profile trigger.

## 2 · Supabase Auth providers

Supabase Studio → Authentication → Providers.

### Email
* **Enable Email provider** — on.
* **Confirm email** — off (passwordless OTP).
* **Secure email change** — on.
* **Email OTP** — enabled (this is what `signInWithOtp({ email })` uses).
* In **URL Configuration** → **Site URL**, set `https://singhsprint.com`.
  Add `https://*.vercel.app` to the redirect allow-list while previewing.

### Phone
* **Enable Phone provider** — on.
* **Phone OTP length** — 6.
* **SMS template**: short, brand-safe. E.g.
  `Singhs Print code: {{ .Code }}. Expires in 5 minutes.`

### SMS provider — Twilio
Supabase Studio → Authentication → Providers → Phone → SMS provider = Twilio.

* `TWILIO_ACCOUNT_SID` — Twilio Console → Account Info.
* `TWILIO_AUTH_TOKEN` — same place. Treat like a password.
* `TWILIO_PHONE_NUMBER` — a Canadian long code or short code you own
  (e.g. `+15145550199`). Long codes work for low-volume OTP without
  A2P 10DLC registration; for higher volume register a 10DLC campaign
  or move to a toll-free number.

Send a test OTP from `/account/signin.html` (phone tab) to confirm
delivery before flipping any DNS.

## 3 · Stripe

1. Stripe Dashboard → **Developers → API keys**.
   * `STRIPE_SECRET_KEY` (Vercel env, server-only)
   * `PUBLIC_STRIPE_PUBLISHABLE_KEY` (Vercel env, also pasted into
     `/account/config.js` so the static page can boot Stripe.js).
2. Stripe Dashboard → **Developers → Webhooks → + Add endpoint**.
   * URL: `https://singhsprint.com/api/account/stripe-webhook`
   * Events to send:
     * `setup_intent.succeeded`
     * `payment_method.detached`
   * Copy the **signing secret** → Vercel env `STRIPE_WEBHOOK_SECRET`.

## 4 · Vercel environment variables

Vercel → singhsprint-site project → Settings → Environment Variables.
Add for **Production** AND **Preview**:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | `https://ptrqsjexrbyupexhcjdr.supabase.co` |
| `PUBLIC_SUPABASE_URL` | same |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase Studio → Settings → API → `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Studio → Settings → API → `service_role` key — **server only** |
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |
| `PAYMENT_UNLOCK_SECRET` | `openssl rand -hex 32` |
| `PAYMENT_UNLOCK_TTL_SECONDS` | `600` (optional; defaults to 10 min) |

Anything prefixed `PUBLIC_` is safe in the browser. The other three are
secrets — Vercel keeps them server-side.

After saving, **redeploy** so the serverless functions pick up the new vars.

## 5 · `/account/config.js`

Open `/account/config.js` in the repo and replace the two placeholders
with the same `anon` key and `pk_live_…` you put in Vercel. This file is
static and shipped to the browser — it does not read from Vercel env vars
at runtime, so it must be committed with real values.

> Why duplicated? The serverless API reads from `process.env`; the static
> sign-in page is plain HTML and has no build step. Keeping the two in
> sync is the trade-off. Set yourself a reminder to update both when
> rotating keys.

## 6 · Smoke test

1. Visit `https://singhsprint.com/account/`.
2. Sign in with email — confirm you get a 6-digit code and that it logs
   you in.
3. Sign in with phone — confirm Twilio delivers the SMS.
4. Set a payment password (any 8+ char string).
5. Click **Add card** → enter Stripe test card `4242 4242 4242 4242`,
   any future expiry, any CVC. Confirm the row appears in the saved cards
   list within ~3s (Stripe webhook latency).
6. **Remove** the card — confirm it disappears from both the UI and the
   Stripe customer's payment methods (Stripe → Customers → that user).

## 7 · Rotation

* **Anon key** — rotate in Supabase Studio, then update `PUBLIC_SUPABASE_ANON_KEY`
  in Vercel **and** the literal in `/account/config.js`. Redeploy.
* **Service-role key** — rotate in Supabase Studio → update `SUPABASE_SERVICE_ROLE_KEY`
  in Vercel. Server-only, no static file to touch.
* **Stripe keys** — rotate in Stripe Dashboard → update `STRIPE_SECRET_KEY`
  and `PUBLIC_STRIPE_PUBLISHABLE_KEY` in Vercel and `/account/config.js`.
* **`PAYMENT_UNLOCK_SECRET`** — generate a new value; every outstanding
  unlock token is invalidated. Sign-in sessions are NOT affected. Use
  this if you suspect the secret leaked.

## 8 · Account features layer (migration 005)

Run the second migration after 004:

```
psql "$SUPABASE_DB_URL" -f ../singhsprint-crm/migrations/005_account_features.sql
```

This adds:
* `leads.user_id` and a trigger that auto-links historical leads by
  matching email or phone when a customer signs in.
* `profiles.referral_code` (auto-generated 8-char), `referred_by_user_id`,
  `account_type` (personal|business), `credit_balance_cents`,
  `volume_pricing_tier`, `net30_approved`, `default_organization_id`.
* `credit_ledger` — signed ledger of all credit movements.
* `referral_settings` — a single editable row holding the $25/$25/$100
  defaults. Tweak from Supabase Studio without redeploying.
* `business_status_requests` — pending/approved/rejected workflow.
* `organizations` + `organization_members` — multi-user team accounts.
* `artwork_assets` — pointers to objects in the artwork Storage bucket.

## 9 · Supabase Storage bucket — `artwork`

Supabase Studio → Storage → Create bucket.
* Name: `artwork` (or whatever you set `ARTWORK_BUCKET` to in Vercel).
* Public bucket: **OFF**. We hand out signed URLs from the API.
* File size limit: 25 MB (matches `MAX_BYTES` in `api/account/artwork.js`).
* Allowed MIME types: leave wide — image/*, application/pdf, application/postscript,
  image/svg+xml.

RLS policies on `storage.objects` (Storage → Policies → New):
* `service-role full access` — auto-exists; no change needed.
* No `authenticated` policy. Customers never touch storage directly —
  they read via signed URLs the API mints and write via signed PUT URLs
  the API mints. Both bypass storage RLS by design.

## 10 · Approving business-status requests

For now this is a Supabase Studio task (no admin UI yet):

1. Studio → Table editor → `business_status_requests`.
2. Find the pending row, sanity-check the company / lead.
3. Set `status='approved'`, `decided_by='<your email>'`,
   `decided_at=now()`. If approving net-30 too, set
   `net30_approved_with_request=true`.
4. Open `profiles`, find the matching user, set:
   * `account_type='business'`
   * `net30_approved=true` if applicable
   * `volume_pricing_tier='tier1'` (or whichever tier they earned).

The next time they refresh `/account/business.html` the page flips from
the request form to the team/artwork tools.

A token-gated admin endpoint that does all four updates in one click is
straightforward to add later — mirror the `promo-admin.js` pattern in the
CRM repo.

## 11 · Wiring credits and referrals into order conversion

When a CRM order is marked **paid + shipped** (status='converted' in the
leads table), a worker needs to write the credit ledger entries:

```sql
-- pseudo, do this inside your conversion job after lead.status='converted'
with referee as (
  select id, referred_by_user_id from profiles where id = :user_id
), settings as (
  select * from referral_settings where is_active
)
-- 1. Referee welcome credit (only once per referee)
insert into credit_ledger (user_id, amount_cents, reason, reference_id, note)
select r.id, s.referee_credit_cents, 'referral_referee', :lead_id, 'Welcome credit'
from referee r, settings s
where r.referred_by_user_id is not null
  and not exists (select 1 from credit_ledger c where c.user_id=r.id and c.reason='referral_referee')
  and :order_total_cents >= s.min_qualifying_order_cents;

-- 2. Referrer reward (only when first qualifying order ships)
insert into credit_ledger (user_id, amount_cents, reason, reference_id, note)
select r.referred_by_user_id, s.referrer_credit_cents, 'referral_referrer', :lead_id,
       'Referral: order shipped'
from referee r, settings s
where r.referred_by_user_id is not null
  and not exists (select 1 from credit_ledger c
                   where c.user_id=r.referred_by_user_id
                     and c.reason='referral_referrer'
                     and c.reference_id=:lead_id)
  and :order_total_cents >= s.min_qualifying_order_cents;
```

The cached `profiles.credit_balance_cents` is kept in sync by the
after-insert trigger on `credit_ledger` — don't update it directly.

## 12 · Volume-pricing tier — where to wire it

The `profiles.volume_pricing_tier` column is in place but no pricing code
reads from it yet. To activate it:

* In `singhsprint-crm/lib/pricing.js`, accept an optional
  `pricingTier` argument on the pricing function.
* In `singhsprint-crm/api/pricing.js` and `api/catalog.js`, look up the
  caller's tier:
  - For a logged-in customer, pass their `profiles.volume_pricing_tier`
    (use the user-scoped Supabase client built from the request's JWT).
  - For anonymous traffic, pass null (standard pricing).
* Apply the tier as a flat % discount or a separate price column,
  whichever your pricing model already supports.

This is the only Phase 2 piece that requires touching existing catalog/
pricing code — the rest is additive.

## 12.5 · Stripe invoicing for business customers

Business customers see their invoice history on `/account/business.html`
under the "Invoices" section. The invoices themselves live in Stripe —
the portal is read-only on this side.

Workflow when an order needs to be invoiced:

1. **Stripe Dashboard → Customers** → find the customer (look up by the
   email on their account). The Stripe customer was created lazily the
   first time they hit the "Add card" flow on the portal; if they've
   never opened that, create the customer manually with their portal
   email so the link works.
2. Click the customer → **Invoices → Create invoice**.
3. Add line items (you can copy from the lead the order maps to), set
   due date, add net-30 payment terms if approved, attach a PO if
   they provided one.
4. Click **Finalize and send**. Stripe emails the customer; the same
   row immediately appears in the portal's invoice list.
5. Once the customer pays via the Stripe-hosted invoice link, the
   status flips to `paid` in both Stripe and the portal automatically.

**One-time portal config**: Stripe Dashboard → Settings → Billing →
Customer portal → **Activate**. This enables the "Manage in Stripe →"
button on the invoices section, which deep-links the customer into
their own Stripe-hosted billing page (no separate login required —
each link is a one-time session URL minted by the API).

No new env vars; no webhook addition; no PDF generation work. Stripe
hosts the PDF and the payment page. The portal's role is just to make
the list discoverable inside the account UI.

## 13 · What's NOT done (still)

* The CRM still uses `PROMO_ADMIN_TOKEN` for staff — by design.
* No checkout-time flow yet — `saved_cards` and credit balance both
  exist; the quote/order pages haven't been wired to charge a saved card
  or apply credit. Next endpoint: `/api/checkout/charge-saved-card` that
  requires Bearer + Payment-Unlock, debits credit_ledger if requested,
  and creates a Stripe PaymentIntent off-session for the remainder.
* No in-app PDF for net-30 invoices yet. Currently `net30_approved` is a
  flag only — staff issue invoices via their existing tooling.
* Team invites use a synthesised UUID for pending members. If your
  `auth.users` FK on `organization_members.user_id` rejects synthetic
  IDs, swap to a dedicated `pending_org_invites` table and have
  `handle_new_user` consume rows on first sign-in.
