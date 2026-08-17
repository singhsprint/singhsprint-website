/**
 * scripts/check-i18n-keys.mjs — every key the site asks for must exist.
 *
 *   node scripts/check-i18n-keys.mjs
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS CATCHES
 * ---------------------------------------------------------------------------
 * Audited 2026-08-17: 19 keys were USED by catalog.js and quote.js and DEFINED
 * nowhere in lang.js. Every one silently fell back to its English default, and
 * they were not scattered chrome — together they were the whole
 * customise-a-garment journey:
 *
 *   Upload artwork · Uploading… · Upload failed — you can try again.
 *   File too large (max 15MB). · Pick a placement above to add artwork.
 *   Render — placement guide · This view is generated to show placement…
 *   Off / White / Black / Auto · Knocks out white everywhere in the artwork.
 *
 * A French customer uploading artwork read English from the button to the
 * error message, and nothing anywhere said so. The fallback is the whole
 * problem: `t(key) || 'English'` cannot fail, it can only be wrong quietly.
 *
 * ---------------------------------------------------------------------------
 * WHY THE PARSER IS HAND-WRITTEN
 * ---------------------------------------------------------------------------
 * The first version of this file matched entries with /'key':\s*\{([^}]*)\}/
 * and reported 19 keys as having no `en` value. All 19 were fine. The regex
 * stopped at the first `}` — which, for 'cat.detail.embmin'
 * ("Needs {min}+ · add {n} more"), is inside the string. A checker that cries
 * wolf on correct entries gets muted, so it is worse than no checker.
 *
 * Line-based matching fails differently: 72 of the entries span multiple
 * lines. So this walks braces while skipping quoted spans, which is the only
 * version that is right about both.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT DELIBERATELY DOES NOT DO
 * ---------------------------------------------------------------------------
 * It does not check that the French is GOOD — no checker can. It checks that a
 * French string was written at all, which is the failure that actually
 * happened. A key present in English with `fr` missing or empty fails, because
 * that reads to a customer exactly like the key not existing.
 *
 * Keys built at runtime (`t('cat.detail.bg.' + k)`) cannot be resolved from
 * source, so the known families are pinned explicitly below. Silently skipping
 * them is how the bg.* keys went missing in the first place.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Runtime-built key families, with the values they can take. */
const DYNAMIC_FAMILIES = [
  { prefix: 'cat.detail.bg.', values: ['off', 'white', 'black', 'auto'] },
  { prefix: 'cat.detail.bg.help.', values: ['off', 'white', 'black', 'auto'] },
  // jerseys.js: SPORTS at the top of that file. Kept in step by hand, and
  // this checker is what says so out loud if they drift.
  { prefix: 'nav.jerseys.', values: ['hockey', 'soccer', 'basketball', 'baseball', 'football', 'volleyball'] },
]
/** Families resolved from server data, so the site cannot know the values. */
const SERVER_DRIVEN = ['cat.detail.method.', 'cat.detail.methoddesc.']

/**
 * A lang.js key, as opposed to the OTHER translation scheme on this site.
 *
 * components.js defines its own `function t(en, fr)` that takes both strings
 * inline and picks by locale — a legitimately different system, and nothing to
 * do with lang.js. Without this filter its arguments get scraped as keys and
 * the checker reports "Shop", "More" and "Searching…" as missing translations,
 * which is nonsense and would get the whole thing ignored.
 *
 * lang.js keys are dotted and lower-case first; English sentences are not.
 */
const looksLikeLangKey = (k) => /^[a-z][a-zA-Z0-9-]*(\.[a-zA-Z0-9_-]+)+$/.test(k)

const problems = []
const notes = []

// ---------------------------------------------------------------------------
// A quote-aware scan. Everything here exists because the naive version lied.
// ---------------------------------------------------------------------------

/** Read a quoted string starting at src[i] (which must be the quote). */
function readQuoted(src, i) {
  const quote = src[i]
  let out = ''
  i++
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue }
    if (c === quote) return [out, i + 1]
    out += c
    i++
  }
  return [out, i]
}

/** Body of the object literal starting at src[i] (which must be '{'). */
function readObjectBody(src, i) {
  let depth = 0
  const start = i
  while (i < src.length) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') { i = readQuoted(src, i)[1]; continue }
    if (c === '{') { depth++; i++; continue }
    if (c === '}') { depth--; i++; if (depth === 0) return [src.slice(start + 1, i - 1), i]; continue }
    i++
  }
  return [src.slice(start + 1), i]
}

/** The value of `field:` inside an entry body, or null. */
function fieldValue(body, field) {
  const m = new RegExp(`\\b${field}\\s*:\\s*['"\`]`).exec(body)
  if (!m) return null
  return readQuoted(body, m.index + m[0].length - 1)[0]
}

// ── What lang.js defines ───────────────────────────────────────────────────
const lang = readFileSync(join(root, 'lang.js'), 'utf8')
const defined = new Map()
{
  const re = /'([a-z][a-zA-Z0-9._-]+)'\s*:\s*\{/g
  let m
  while ((m = re.exec(lang)) !== null) {
    const braceAt = m.index + m[0].length - 1
    const [body, end] = readObjectBody(lang, braceAt)
    defined.set(m[1], body)
    re.lastIndex = end
  }
}
if (defined.size < 500) {
  problems.push(`only ${defined.size} keys parsed out of lang.js — the extraction is broken, not the file`)
}

// ── What the site asks for ─────────────────────────────────────────────────
const jsFiles = readdirSync(root).filter(f => f.endsWith('.js') && f !== 'lang.js')
const used = new Map()
const dynamicSeen = new Set()
for (const file of jsFiles) {
  const src = readFileSync(join(root, file), 'utf8')
  for (const m of src.matchAll(/(?:spAvailT|SP_LANG\.t|\bt)\(\s*'([^']+)'/g)) {
    const key = m[1]
    if (key.endsWith('.')) { if (looksLikeLangKey(key.slice(0, -1) + '.x')) dynamicSeen.add(key); continue }
    if (!looksLikeLangKey(key)) continue   // components.js t(en, fr) — see above
    if (!used.has(key)) used.set(key, file)
  }
}

// ── Every static key must exist ────────────────────────────────────────────
for (const [key, file] of used) {
  if (!defined.has(key)) problems.push(`${key} — used in ${file}, defined nowhere (falls back to English)`)
}

// ── Runtime-built families ─────────────────────────────────────────────────
for (const fam of DYNAMIC_FAMILIES) {
  for (const v of fam.values) {
    const key = fam.prefix + v
    if (!defined.has(key)) problems.push(`${key} — built at runtime from ${fam.prefix}, defined nowhere`)
  }
}
for (const d of dynamicSeen) {
  if (DYNAMIC_FAMILIES.some(f => f.prefix === d)) continue
  if (SERVER_DRIVEN.includes(d)) { notes.push(`${d}* resolves from server data — not checkable here`); continue }
  problems.push(`${d}* — built at runtime and not pinned in DYNAMIC_FAMILIES; add its values or list it as server-driven`)
}

// ── A key defined in English only is the same bug wearing a hat ────────────
for (const [key, body] of defined) {
  const en = fieldValue(body, 'en')
  const fr = fieldValue(body, 'fr')
  if (en === null) problems.push(`${key} — no en value`)
  if (fr === null) problems.push(`${key} — defined with no fr value, so French shows English`)
  else if (fr.trim() === '') problems.push(`${key} — fr is empty, so French shows nothing`)
}

// ── Report ─────────────────────────────────────────────────────────────────
for (const n of notes) console.log(`  note  ${n}`)
if (problems.length) {
  console.error(`\ncheck-i18n-keys: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error(`  - ${p}`)
  console.error('')
  process.exit(1)
}
console.log(
  `check-i18n-keys: OK — ${used.size} static keys used across ${jsFiles.length} files, ` +
  `${defined.size} defined, every one carrying both en and fr.`
)
