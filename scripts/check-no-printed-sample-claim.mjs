/**
 * We do NOT offer a printed sample. Nothing on the site may say we do.
 *
 * Confirmed by the owner 2026-09-20: the digital mockup is real; the printed
 * sample is not. The claim — "Want a printed sample first? Add one at checkout
 * for the cost of a blank." — had spread to 41 files in both languages, into
 * 10 lang.js strings, and into the homepage JSON-LD FAQ, which is the copy
 * Google can surface as a rich result.
 *
 * Marketing copy gets pasted between pages, so this guards the whole tree
 * rather than the handful of files that happened to carry it.
 *
 * Run: node scripts/check-no-printed-sample-claim.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../', import.meta.url).pathname
const SKIP = new Set(['node_modules', '.git', '_to_delete', 'scripts'])

// Phrases that assert a physical sample is available. Deliberately includes
// the "not available on this timeline" forms: telling a reader the option
// exists but not for them still tells them it exists.
const BANNED = [
  /printed sample/i,
  /stitched sample/i,
  /pressed sample/i,
  /physical proof/i,
  /cost of a blank/i,
  /cost of one blank/i,
  /échantillon imprimé/i,
  /preuve physique/i,
]
// The mockup promise is TRUE and must survive — a checker that passes because
// someone deleted the whole section is not a passing checker.
const MUST_KEEP = [
  { file: 'index.html',     re: /photoreal mockup/i },
  { file: 'quote.html',     re: /approve a mockup|photoreal mockup/i },
  { file: 'why-us.html',    re: /mockup/i },
  { file: 'lang.js',        re: /maquette/i },
]

let pass = 0
const fails = []
const ok = (id, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok  ${id}`) }
  else { fails.push(id); console.log(`FAIL  ${id}${detail ? ' — ' + detail : ''}`) }
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(html|js)$/.test(e)) out.push(p)
  }
  return out
}

const files = walk(ROOT)
console.log(`scanning ${files.length} html/js files\n`)
const offenders = []
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  for (const re of BANNED) {
    const m = text.match(re)
    if (m) {
      const line = text.slice(0, m.index).split('\n').length
      offenders.push(`${relative(ROOT, f)}:${line} "${m[0]}"`)
      break
    }
  }
}
ok('S1 no page claims a printed/stitched/pressed sample', offenders.length === 0,
   `${offenders.length} file(s): ${offenders.slice(0, 6).join(' | ')}`)

// The true promise still stands.
for (const { file, re } of MUST_KEEP) {
  let text = ''
  try { text = readFileSync(join(ROOT, file), 'utf8') } catch { /* missing */ }
  ok(`S2 ${file} still promises the mockup`, re.test(text))
}

// The FAQ schema is a separate copy of the answer from the visible FAQ — both
// have to be clean, and the JSON must still parse after editing.
for (const page of ['index.html', 'fr/index.html']) {
  const html = readFileSync(join(ROOT, page), 'utf8')
  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  ok(`S3 ${page}: JSON-LD present`, blocks.length > 0)
  let allParse = true, sampleClaim = false
  for (const b of blocks) {
    try {
      const d = JSON.parse(b[1])
      const json = JSON.stringify(d)
      if (/printed sample|cost of a blank|cost of one blank/i.test(json)) sampleClaim = true
    } catch { allParse = false }
  }
  ok(`S4 ${page}: every JSON-LD block still parses`, allParse)
  ok(`S5 ${page}: no sample claim inside the structured data`, !sampleClaim)
}

console.log(`\n${pass} passed, ${fails.length} failed`)
if (fails.length) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1) }
