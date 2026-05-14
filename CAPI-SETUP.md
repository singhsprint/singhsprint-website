# Meta Pixel + Conversions API — Setup & Verification

This repo is wired for **parallel client-side Pixel + server-side CAPI** with
shared `event_id` for dedupe. One maintainer. Static site on Vercel.

## File map

| File                   | Role                                                                 |
|------------------------|----------------------------------------------------------------------|
| `pixel-config.js`      | Public constant: `SP_PIXEL_ID`. Rotate here.                         |
| `pixel.js`             | `SP_PIXEL.track(...)` helper — fires client Pixel + CAPI in parallel |
| `api/meta-capi.js`     | Vercel serverless function — hashes PII, forwards to Graph API v19   |
| `debug-pixel.html`     | noindex QA page with test buttons                                    |
| `.env.example`         | Documents env vars                                                   |
| `.gitignore`           | Keeps `.env` out of git                                              |
| `<page>.html` (×6 + debug) | Pixel base code inline in `<head>`                               |

## One-time setup

1. **Paste your Pixel ID in two places** (they MUST match):
   - `pixel-config.js` → `window.SP_PIXEL_ID = 'YOUR_ID';`
   - Vercel → Project → Settings → Environment Variables → add `META_PIXEL_ID`

2. **Generate a CAPI access token**
   - Events Manager → Data Sources → your Pixel → **Settings** tab → *"Generate access token"*
   - Copy it immediately (you can't see it again).
   - Vercel → Env Vars → add `META_CAPI_ACCESS_TOKEN` = that token.

3. **(Optional, for verifying) Add a test event code**
   - Events Manager → your Pixel → **Test events** tab → copy the code shown (e.g. `TEST12345`).
   - Vercel → Env Vars → add `META_TEST_EVENT_CODE` = `TEST12345`.
   - Redeploy. All events will flow into the Test events view rather than production.
   - **Remove this env var once dedupe is verified, or Meta won't count real events.**

4. **Noscript fallback** — already wired to `1198620955711122` in all 7 HTML files.
   If you ever rotate the Pixel ID, do a find-and-replace on `1198620955711122`
   across `*.html` to keep the noscript tags in sync.

5. **Deploy** — `git add . && git commit -m "Add Meta Pixel + CAPI" && git push`
   Vercel will pick up the new `api/` function automatically.

## Verification — paste this into Events Manager to confirm dedupe

After deploy, go to **Events Manager → your Pixel → Test events** tab.

1. In that tab, paste your site URL (e.g., `https://singhsprint.com/debug-pixel.html`)
   into **"Test browser events"** and click **Open Website**. A new tab opens with
   the debug page.

2. On the debug page, the auto `PageView` fires immediately. Then click
   **Fire ViewContent** and **Fire Lead (hashed test PII)**.

3. Flip back to the Events Manager tab. Within ~15s you should see:

   | Event Name  | Received From       | Notes                                     |
   |-------------|---------------------|-------------------------------------------|
   | PageView    | **Browser + Server**| ONE row, not two — dedupe worked          |
   | ViewContent | **Browser + Server**| ONE row                                   |
   | Lead        | **Browser + Server**| ONE row, `em` and `ph` shown as `Hashed`  |

   > **This is the acceptance test.** If an event appears twice (once "Browser",
   > once "Server") the `event_id`s aren't matching — see Troubleshooting below.

4. Click any event row → **"View details"** → confirm:
   - `event_id` is a UUID (e.g. `6c1b…`)
   - `em` / `ph` on the Lead event are 64-char hex strings (SHA-256), not raw
   - `client_ip_address` and `client_user_agent` are populated on the server side

5. **Remove `META_TEST_EVENT_CODE` from Vercel env vars** and redeploy so
   production events flow into your real dataset.

## Firing custom events from your site

```js
// Quote form submit
document.querySelector('#quoteForm').addEventListener('submit', function () {
  SP_PIXEL.track('Lead',
    { content_name: 'Quote Form' },
    { em: document.querySelector('#email').value,
      ph: document.querySelector('#phone').value }
  );
});

// Product view
SP_PIXEL.track('ViewContent', {
  content_ids: ['hoodie-concordia'],
  content_type: 'product',
  value: 45.00,
  currency: 'CAD'
});
```

PII (`em`, `ph`, `fn`, `ln`, `ct`, `st`, `zp`, `country`, `ge`, `db`) is sent
RAW to OUR `/api/meta-capi` endpoint, which hashes with SHA-256 before forwarding
to Meta. **Never send hashed PII to the client Pixel** — fbq handles hashing if
you use `fbq('track', ..., { em: raw })`, but we keep PII off the client Pixel
entirely and let the server handle matching.

## Rotation

- **PIXEL_ID**: update `pixel-config.js` + `META_PIXEL_ID` env var in Vercel. Redeploy.
- **CAPI access token**: update `META_CAPI_ACCESS_TOKEN` in Vercel only. Redeploy.
- **Test event code**: update `META_TEST_EVENT_CODE` in Vercel only. Redeploy.

## Troubleshooting

| Symptom                                  | Likely cause                                                       |
|------------------------------------------|--------------------------------------------------------------------|
| Events appear twice (Browser + Server rows) | `event_id` mismatch. Check `pixel.js` is generating UUID and `api/meta-capi.js` is echoing it back. |
| 500 `capi_not_configured`                | `META_PIXEL_ID` or `META_CAPI_ACCESS_TOKEN` missing in Vercel env. |
| 502 `graph_api_error`                    | Bad token or wrong pixel ID. Check `META_PIXEL_ID` matches the one that owns the token. |
| Client Pixel fires, CAPI never does      | Ad-blocker stopping `/api/meta-capi` — check Network tab. `sendBeacon` is harder to block than a Graph API XHR, which is the whole point. |
| Test events tab shows nothing            | `META_TEST_EVENT_CODE` not set, OR wrong code (codes rotate).      |
