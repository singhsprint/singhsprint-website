/* =========================================================================
 * Meta Pixel - CLIENT-SIDE CONFIG
 * -------------------------------------------------------------------------
 * Rotate the PIXEL_ID here. This file is loaded BEFORE the Meta base code
 * in the <head> of every page, so both the client Pixel and the server-side
 * CAPI proxy (/api/meta-capi) read the same ID.
 *
 * IMPORTANT: SP_PIXEL_ID is PUBLIC (visible in the browser). That's fine —
 * the Pixel ID is not a secret. The CAPI access token lives in Vercel env
 * vars (META_CAPI_ACCESS_TOKEN) and is NEVER exposed client-side.
 *
 * When you rotate the Pixel, update BOTH:
 *   1. SP_PIXEL_ID below
 *   2. META_PIXEL_ID env var in Vercel (Project → Settings → Env Vars)
 * ========================================================================= */

window.SP_PIXEL_ID    = '1198620955711122'; // Singhs Print "Quote" dataset
window.SP_CAPI_ENDPOINT = '/api/meta-capi';           // server-side CAPI proxy (same origin)
