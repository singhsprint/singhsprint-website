/**
 * singhsprint.com/m/<code> sends customers to pay.singhsprint.com, never to
 * singhsprint-crm.vercel.app, and stays temporary (307) so old links keep
 * working wherever the page ends up living.
 *
 *   node scripts/check-m-redirect.mjs
 *
 * Reads vercel.json and runs every redirect against sample paths the way
 * Vercel matches them (":name" segments), so the check is on where a customer
 * actually lands, not on one string.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(process.env['F_' + f.replace(/\W/g, '_')] || join(ROOT, f), 'utf8')
let pass = 0, fail = 0
const ok = (n, c, d = '') => { if (c) { pass++; console.log('  ok  ' + n) } else { fail++; console.log('  FAIL ' + n + (d ? ' -- ' + d : '')) } }

const v = JSON.parse(read('vercel.json'))
const toRe = (src) => new RegExp('^' + src.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$')
function land(path) {
  for (const r of v.redirects || []) {
    const m = toRe(r.source).exec(path)
    if (m) return { to: r.destination.replace(/:(\w+)/g, (_, k) => m.groups[k]), status: r.permanent === false ? 307 : r.statusCode || 308 }
  }
  return null
}
for (const code of ['arq9us', 'abc234']) {
  const r = land('/m/' + code)
  ok(`A1 /m/${code} lands on https://pay.singhsprint.com/m/${code}`, r && r.to === `https://pay.singhsprint.com/m/${code}`, JSON.stringify(r))
  ok(`A2 /m/${code} is temporary (307), so old links keep working`, r && r.status === 307, JSON.stringify(r))
}
const leaks = (v.redirects || []).filter((r) => /vercel\.app/.test(r.destination))
ok('B no redirect sends a customer to a vercel.app address', leaks.length === 0, JSON.stringify(leaks))
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
