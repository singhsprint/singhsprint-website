/* =========================================================================
 * Singhs Print — customer-account client config.
 *
 * These values are PUBLIC. Both the Supabase anon key and the Stripe
 * publishable key are intended to be exposed in the browser; security comes
 * from RLS (Supabase) and the fact that the publishable key can only create
 * tokens, not move money (Stripe).
 *
 * Update these values in TWO places when rotating:
 *   1. Here (rebuilds the static site on next push)
 *   2. The matching PUBLIC_* env vars in Vercel (used by the serverless API
 *      so it can hand back consistent values).
 * Secrets (SERVICE_ROLE_KEY, STRIPE_SECRET_KEY) live ONLY in Vercel env.
 * ========================================================================= */

window.SP_AUTH = {
  // Supabase project — same project as singhsprint-crm
  supabaseUrl:     'https://ptrqsjexrbyupexhcjdr.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0cnFzamV4cmJ5dXBleGhjamRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxODg5NzgsImV4cCI6MjA5MTc2NDk3OH0.aqYJAXmmCEjtHU97UDTLZZlWwoS9ERldFzxTvunZEgA',

  // Stripe — publishable key only (pk_live_... or pk_test_...)
  stripePublishableKey: 'pk_live_51TD4p84Ofo0ogaX0D0JMl2342yImrJ37mPE3s8BNMkOZF6l17mGbQlyKYMQwWjF9LevWinYulVmHegwfo5avwgr100EyxAiruI',

  // Where to send the user after successful sign-in if no ?returnTo= is set.
  defaultReturnTo: '/account/'
};
