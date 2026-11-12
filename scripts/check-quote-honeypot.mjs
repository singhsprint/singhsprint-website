/**
 * The quote form's honeypot is not something a browser will autofill.
 *
 *   node scripts/check-quote-honeypot.mjs      (needs jsdom, or JSDOM_DIR=...)
 *
 * It was named "company_website", and autofill put the customer's own site in
 * it: 10 of its 12 firings were real customers (Melanie of Motoflash.ca twice
 * in 20 minutes on Samsung Internet, 2026-11-12). Parses both quote pages and
 * checks, on the real form: exactly one hidden trap field, with a name no
 * autofill heuristic maps (no website / url / company / email / name / phone),
 * off-screen, out of the tab order, hidden from screen readers, with the
 * password-manager ignore attributes; no other hidden-offscreen text input;
 * and quote.js sends THAT field as the payload's `website`.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(process.env['F_' + f.replace(/\W/g, '_')] || join(ROOT, f), 'utf8')
const require = createRequire(process.env.JSDOM_DIR ? join(process.env.JSDOM_DIR, 'x.js') : import.meta.url)
let JSDOM; try { ({ JSDOM } = require('jsdom')) } catch { console.log('jsdom not installed'); process.exit(2) }
let pass = 0, fail = 0
const ok = (n, c, d = '') => { if (c) { pass++; console.log('  ok  ' + n) } else { fail++; console.log('  FAIL ' + n + (d ? ' -- ' + d : '')) } }
const AUTOFILL = /web|site|url|company|org|mail|name|phone|tel|addr|city|zip|postal/i

let trapName = null
for (const page of ['quote.html', 'fr/quote.html']) {
  const doc = new JSDOM(read(page)).window.document
  const form = doc.getElementById('quoteForm')
  const traps = [...form.querySelectorAll('input[type=text]')].filter((i) => /-9999px/.test(i.getAttribute('style') || ''))
  ok(`A1 ${page}: exactly one hidden trap field in the quote form`, traps.length === 1, String(traps.length))
  const t = traps[0]; if (!t) continue
  trapName = trapName || t.name
  ok(`A2 ${page}: its name ("${t.name}") is nothing autofill recognises`, !AUTOFILL.test(t.name) && !AUTOFILL.test(t.id || '') && !AUTOFILL.test(t.getAttribute('placeholder') || ''))
  ok(`A3 ${page}: off-screen, no tab stop, hidden from screen readers, autocomplete off`, t.tabIndex === -1 && t.getAttribute('aria-hidden') === 'true' && t.getAttribute('autocomplete') === 'off')
  ok(`A4 ${page}: LastPass / 1Password / Bitwarden told to leave it alone`, t.getAttribute('data-lpignore') === 'true' && t.hasAttribute('data-1p-ignore') && t.hasAttribute('data-bwignore'))
  ok(`A5 ${page}: same name on both pages`, t.name === trapName)
}
const js = read('quote.js')
ok('B1 quote.js sends that field as the payload\'s `website` (what /api/inbound reads)', !!trapName && new RegExp(`website:\\s*fd\\.get\\('${trapName}'\\)`).test(js))
ok('B2 nothing still reads the old company_website field', !/fd\.get\('company_website'\)/.test(js))
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
