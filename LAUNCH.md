# Launch checklist — customer accounts

This is the go-live walkthrough. Follow top-to-bottom. Each step has a
verification check; don't move on until that passes. End-to-end should
take 60–90 minutes the first time.

The deeper reference doc is `ACCOUNTS-SETUP.md` — this file is the
short, sequenced version with the gotchas inline.

Project facts you'll need throughout:

| What | Value |
| --- | --- |
| Supabase project | `ptrqsjexrbyupexhcjdr.supabase.co` |
| Production domain | `https://www.singhsprint.com` |
| Site repo | `singhsprint-site` (Vercel project) |
| CRM repo | `singhsprint-crm` (Vercel project, separate) |

---

## Step 0 · Pre-flight (5 min)

Before touching anything, confirm the `leads` table has the columns my
migration assumes — `email`, `phone`, `cart`, `total_cents`, `token`.
Supabase Studio → SQL editor → paste and run:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'leads'
  and column_name in ('email','phone','cart','total_cents','token','status','kind')
order by column_name;
```

**Expected:** 7 rows. If any column is missing or named differently,
**stop and tell me** — I'll patch migration 005 before you run it. The
columns the new code actually reads from are `email`, `phone`, `cart`,
`total_cents`, `token`, `status`, `kind`.

If everything is there, snapshot the database before you continue (Studio
→ Database → Backups → Create backup). Migration 005 is idempotent but
backups are cheap insurance.

---

## Step 1 · Run the migrations (5 min)

Both new migrations live in `singhsprint-crm/migrations/`. The CRM
already has `npm run migrate` wired to apply them via Supabase's SQL
admin endpoint.

```bash
cd singhsprint-crm
npm install                          # only if you haven't lately
npm run migrate
```

You should see two new files applied:

```
→ Applying 004_customer_accounts.sql (...)
→ Applying 005_account_features.sql (...)
```

If `migrate` fails with "rpc/exec_sql does not exist", your Supabase
project doesn't expose that admin RPC — fall back to Studio → SQL editor
and paste each file's contents in order (004 first, then 005). The SQL
is idempotent; rerunning is safe.

### Verify

In Studio SQL editor:

```sql
-- 6 new tables should exist
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles','saved_cards','credit_ledger',
    'business_status_requests','organizations',
    'organization_members','artwork_assets','referral_settings'
  )
order by table_name;
-- expect 8 rows
```

```sql
-- The handle_new_user trigger now generates a referral_code
select referral_code from profiles limit 5;
-- existing profiles should all have a non-null 8-char code
```

```sql
-- The auto-link backfill ran against existing leads
select count(*) filter (where user_id is not null) as linked,
       count(*) filter (where user_id is null) as unlinked
from leads;
-- "linked" can be 0 if you have no existing customer accounts yet — that's fine
```

---

## Step 2 · Supabase Auth — enable Email + Phone (10 min)

Studio → **Authentication** → **Providers**.

### Email
- Enable Email provider: **on**.
- Confirm email: **off**.
- Secure email change: **on**.
- Save.

### Phone
- Enable Phone provider: **on**.
- Phone OTP length: **6**.
- SMS provider: pick **Twilio** (we'll fill it in at Step 3).
- Save (it may complain about missing Twilio creds — that's expected).

### URL configuration
Studio → **Authentication** → **URL Configuration**.
- Site URL: `https://www.singhsprint.com`
- Redirect URLs: add `https://*.vercel.app` (so preview deploys work)
  and `https://www.singhsprint.com/account/*`.

### SMS template (Authentication → Templates → Phone)
Replace the default with something brand-safe and short:

```
Singhs Print code: {{ .Code }}. Expires in 5 minutes.
```

Save.

---

## Step 3 · Twilio (20 min, the first time)

If you already have a Twilio account with a Canadian long code, skip the
provisioning and go straight to the credential step.

1. Sign up at <https://www.twilio.com/try-twilio>. Verify your business
   address — required for SMS to Canada.
2. **Phone Numbers → Manage → Buy a number.**
   - Country: Canada.
   - Capabilities: **SMS** checked.
   - Choose any available local number (montreal area code makes the
     "from" number recognizable to your customers).
3. Copy three values from the Twilio console home page:
   - Account SID (starts `AC...`)
   - Auth Token (click the eye icon to reveal)
   - The phone number you just bought, in E.164 format (`+15145550199`).
4. Back in Supabase Studio → **Authentication → Providers → Phone**:
   - SMS provider: **Twilio**
   - Account SID: paste
   - Auth Token: paste
   - Message Service SID / Twilio Phone Number: paste the number
   - Save.

### Verify

In Studio → **Authentication → Users**, click **Invite user** (top
right) → Invite by phone with your own cell. You should receive an SMS
within ~10 seconds. If you don't, the most common culprit is the
Twilio business-verification step from the sign-up (re-check it). For
high-volume Canadian SMS you'll eventually want to register a 10DLC
campaign or move to a toll-free number, but a long code works for low
volume immediately.

> Cost note: Canadian Twilio SMS is about **$0.0075/message**. At 500
> sign-ins/month you're looking at $3.75 in Twilio fees.

---

## Step 4 · Stripe (15 min)

### API keys
Stripe Dashboard → **Developers → API keys**. Copy:
- Publishable key (`pk_live_...` for production, `pk_test_...` if you
  want to test first)
- Secret key (`sk_live_...` / `sk_test_...`)

### Webhook endpoint
Stripe Dashboard → **Developers → Webhooks → + Add endpoint**.
- Endpoint URL: `https://www.singhsprint.com/api/account/stripe-webhook`
- Events to send (search and select each):
  - `setup_intent.succeeded`
  - `payment_method.detached`
- Click **Add endpoint**.
- On the endpoint detail page, click **Reveal** under "Signing secret"
  and copy the `whsec_...` value.

### Verify
The "Send test webhook" button on the endpoint page will fire a sample
event. You should get a 200 response. (If you get a 401, the env vars
in Step 6 haven't been deployed yet — come back after that.)

---

## Step 5 · Artwork storage bucket (3 min)

Only needed if you plan to enable the business tier. Skip if you're
launching with personal accounts only.

Supabase Studio → **Storage → Create a new bucket**.
- Name: `artwork`
- Public bucket: **OFF**
- File size limit: **25 MB** (matches `MAX_BYTES` in `api/account/artwork.js`)
- Allowed MIME types: leave blank (allow all) or paste:
  `image/*, application/pdf, application/postscript, image/svg+xml`

No RLS policy work needed — the API uses the service-role key, which
bypasses storage RLS. Customers never get raw bucket URLs.

### Verify
You should now have **two buckets**: `mockups` (already there from the
CRM) and `artwork` (just created).

---

## Step 6 · Vercel environment variables (10 min)

Vercel → `singhsprint-site` project → **Settings → Environment Variables**.

For each row below, add it to **Production** and **Preview** (toggle both
checkboxes). Use the values you collected in the previous steps.

| Name | Value | Env |
| --- | --- | --- |
| `SUPABASE_URL` | `https://ptrqsjexrbyupexhcjdr.supabase.co` | both |
| `PUBLIC_SUPABASE_URL` | same | both |
| `PUBLIC_SUPABASE_ANON_KEY` | Studio → Settings → API → `anon public` | both |
| `SUPABASE_SERVICE_ROLE_KEY` | Studio → Settings → API → `service_role` | both |
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` | both |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from Step 4 | both |
| `PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` or `pk_test_...` | both |
| `PAYMENT_UNLOCK_SECRET` | run `openssl rand -hex 32` and paste | both |
| `PAYMENT_UNLOCK_TTL_SECONDS` | `600` | both |
| `ARTWORK_BUCKET` | `artwork` | both (only if Step 5 done) |

**Critical:** the four `PUBLIC_*` vars are safe in the browser. The
other five are secrets — Vercel keeps them server-side.

Click **Save** after each. When all are added, redeploy from the
Deployments tab (... menu → Redeploy) so the serverless functions pick
up the new vars.

---

## Step 7 · Update `/account/config.js` and commit (3 min)

The static sign-in page can't read Vercel env vars at runtime — it needs
the public keys baked in. Open `singhsprint-site/account/config.js` and
replace the two placeholders:

```js
window.SP_AUTH = {
  supabaseUrl:     'https://ptrqsjexrbyupexhcjdr.supabase.co',
  supabaseAnonKey: 'PASTE_THE_SAME_ANON_KEY_HERE',      // ← step 6
  stripePublishableKey: 'PASTE_THE_SAME_PK_HERE',       // ← step 6
  defaultReturnTo: '/account/'
};
```

Commit and push. Vercel auto-deploys.

```bash
cd singhsprint-site
git add account/config.js .env.example package.json \
        account/ api/ components.js ACCOUNTS-SETUP.md LAUNCH.md
git commit -m "feat(accounts): customer accounts, referrals, business tier"
git push
```

Watch the Vercel build — it should install `@supabase/supabase-js` and
`stripe` from the new `package.json` (~30 sec longer than the previous
build).

---

## Step 8 · Smoke test (10 min)

In a browser:

1. Visit `https://www.singhsprint.com/account/`. You should be redirected
   to `/account/signin.html`.
2. **Email path:** enter your email, click "Send code". Open your inbox
   — you should have a 6-digit code in under 30 seconds. Paste it back,
   click "Verify". You land on the dashboard.
3. **Phone path:** sign out, click "Phone" tab on signin, enter your
   cell, click "Send code". SMS should arrive in ~10 seconds. Verify
   → dashboard.
4. **Old-leads auto-link:** if the email/phone you signed in with
   matches any historical lead in your `leads` table, you should see
   non-zero "Active quotes" or "Past orders" counts on the dashboard
   immediately. (Confirms the trigger ran.)
5. **Payment password + Stripe:** click Settings → set a payment
   password → click "Add card" → enter Stripe test card
   `4242 4242 4242 4242`, any future expiry, any CVC. The row should
   appear in the saved cards list within ~3 seconds (Stripe webhook
   latency).
6. **Referrals:** click Referrals & credit. You should see your
   auto-generated 8-char code. Click Copy code — it copies to clipboard.

Pass = all 6 steps. Any failure, check the **Vercel Functions logs** for
the relevant endpoint — most launch issues are missing or misspelled env
vars.

---

## Step 9 · Tell your team

Two operational things people need to know:

- **Approving business requests** lives in Studio for now: Tables →
  `business_status_requests` → find pending row → set status='approved',
  decided_by, decided_at; then `profiles` → set account_type='business'
  for that user (and `net30_approved=true` if applicable). The full
  procedure is in `ACCOUNTS-SETUP.md` §10. A one-click admin UI is the
  next-best follow-up build.
- **Issuing referral credits** when an order ships: until the CRM
  conversion job is updated to insert the ledger rows, every paid
  referral has to be issued manually:

  ```sql
  insert into credit_ledger (user_id, amount_cents, reason, reference_id, note)
  values (
    (select referred_by_user_id from profiles where id = '<referee user_id>'),
    2500, 'referral_referrer', '<lead_id of qualifying order>',
    'Referral: order shipped'
  );
  ```

  The `profiles.credit_balance_cents` cache updates automatically.

---

## What's still on the roadmap (not blocking launch)

These don't prevent customers from signing in and using their account,
but they're the obvious next-builds once the core is live:

1. Wire the credit-issuing SQL into the CRM's order-conversion job so
   referrals pay out without manual SQL.
2. Build the checkout flow: a `/api/checkout/charge-saved-card` endpoint
   plus a "use saved card / apply credit" UI on the quote and order
   pages. This is what makes "save my card" and "credit balance"
   actually do something at purchase time.
3. CRM admin page for approving business requests in one click.
4. Wire `profiles.volume_pricing_tier` into the catalog/pricing code so
   approved business accounts see their tier pricing automatically.
