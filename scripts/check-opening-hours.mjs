/**
 * Hours are stated in many places. They have to agree.
 *
 * 2026-09-20 — the shop opened Sundays 9–6. Before that the site said
 * "Mon–Sat" in eight bits of copy and in FOUR separate JSON-LD
 * openingHoursSpecification blocks, and carried a live hero badge that read
 * "CLOSED NOW · Opens Monday 9 AM" to anyone landing on a Sunday.
 *
 * The badge is gone. This holds the rest together: structured data is what
 * Google reads, so a stale dayOfWeek array here quietly contradicts the hours
 * set on the Business Profile.
 *
 * Run: node scripts/check-opening-hours.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../', import.meta.url).pathname
const SKIP = new Set(['node_modules', '.git', '_to_delete', 'scripts'])
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

// 1. No page may still claim a Mon–Sat week, in either language.
const STALE = [/Mon[–-]Sat/i, /Monday to Saturday/i, /lundi au samedi/i]
const offenders = []
for (const f of files) {
  const t = readFileSync(f, 'utf8')
  for (const re of STALE) if (re.test(t)) { offenders.push(relative(ROOT, f)); break }
}
ok('H1 nothing still says Mon–Sat', offenders.length === 0,
   offenders.slice(0, 6).join(', '))

// 2. Every openingHoursSpecification must include Sunday — this is the copy
//    Google reads, and it is the one nobody looks at.
let specs = 0, withSunday = 0, parsed = 0, bad = []
for (const f of files) {
  const t = readFileSync(f, 'utf8')
  if (!/openingHoursSpecification/.test(t)) continue
  for (const m of t.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); parsed++ } catch { bad.push(relative(ROOT, f)) }
  }
  for (const m of t.matchAll(/"openingHoursSpecification":\s*(\[[\s\S]*?\}\s*\])/g)) {
    specs++
    if (/"Sunday"/.test(m[1])) withSunday++
    else bad.push(relative(ROOT, f) + ' (no Sunday)')
  }
}
ok('H2 at least one openingHoursSpecification exists', specs > 0, `${specs} found`)
ok('H3 every one of them includes Sunday', specs > 0 && withSunday === specs,
   `${withSunday}/${specs}; ${bad.join(', ')}`)
ok('H4 every JSON-LD block still parses', bad.filter(b => !/no Sunday/.test(b)).length === 0)

// 3. The live open/closed badge is gone — it is the thing that actively said
//    "closed" on a day we now trade.
const idx = readFileSync(join(ROOT, 'index.html'), 'utf8')
const fidx = readFileSync(join(ROOT, 'fr/index.html'), 'utf8')
// Keyed to CODE SHAPES, not bare identifiers. The first version of these
// matched the COMMENT left where the stamp used to be — the fourth time in
// this session a checker has been satisfied, or broken, by prose explaining
// the very thing it was testing for. An invocation, an attribute and an
// assignment cannot appear in a comment by accident.
ok('H5 no hero open/closed stamp script',
   !/\(function setupHeroStamp/.test(idx) && !/\(function setupHeroStamp/.test(fidx))
ok('H6 no heroStampTag element',
   !/id="heroStampTag"/.test(idx) && !/id="heroStampTag"/.test(fidx))
ok('H7 nothing ASSIGNS a closed state',
   !/textContent = 'Closed now'/.test(idx) && !/textContent = 'Opens Monday/.test(idx) &&
   !/textContent = 'Ferm/.test(fidx) && !/textContent = 'Ouvre lundi/.test(fidx))
// The address beside it was worth keeping — a checker that passes because the
// whole block was deleted is not a passing checker.
ok('H8 the hero still shows the address', /hero-stamp__detail/.test(idx) && /Sainte/.test(idx))

// 2026-11-24 — owner's hours: Mon-Fri 10-4, Sat-Sun 12-4. The site said
// "Open 7 days, 10am-4pm" in copy and one 7-day 10:00-16:00 block in the
// hidden data; product pages said "9 AM to 9 PM, 7 days a week".
{
  const all = walk(ROOT).filter((f) => /\.(html|js)$/.test(f) && !/[\\/]p[\\/]/.test(relative(ROOT, f)))
  const stale = [], weekendWrong = []
  for (const f of all) {
    const t = readFileSync(f, 'utf8')
    if (/Open 7 days, 10am-4pm|Ouvert 7 jours sur 7, (de )?10 h à 16 h/.test(t)) stale.push(relative(ROOT, f))
    for (const m of t.matchAll(/"dayOfWeek":\s*\[([^\]]*)\],\s*"opens":\s*"(\d\d:\d\d)"/g)) {
      const days = m[1], opens = m[2]
      if (/Saturday|Sunday/.test(days) && opens !== '12:00') weekendWrong.push(relative(ROOT, f))
      if (/Monday/.test(days) && opens !== '10:00') weekendWrong.push(relative(ROOT, f))
    }
  }
  ok('H9 nothing still says open 7 days 10-4', stale.length === 0, stale.join(', '))
  ok('H10 hidden data: weekdays open at 10, weekends at 12', weekendWrong.length === 0, [...new Set(weekendWrong)].join(', '))
}

console.log(`\n${pass} passed, ${fails.length} failed`)
if (fails.length) { fails.forEach(f => console.log('  ✗ ' + f)); process.exit(1) }
