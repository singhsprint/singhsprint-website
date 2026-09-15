/**
 * check-home-icons.mjs
 *
 * The homepage's six icon slots — three services, three "why us" — must be
 * drawn, identical in both languages, and each must mean one thing.
 *
 * WHY THIS EXISTS. They were emoji, as HTML entities: &#127912; &#128293;
 * &#129525; on the services and &#9889; &#127912; &#128176; on the why-cards.
 * Two problems, one visible and one not.
 *
 * Visible: an emoji is rendered by the reader's OS, so the same markup is a
 * flat glyph on one machine and a glossy 3D sticker on another. The shop has
 * no say in its own artwork.
 *
 * Not visible: &#127912; appears TWICE in that list. The palette was both
 * "DTG Printing" and "Free design help" — one glyph doing two jobs, which is
 * what a placeholder looks like. That is asserted below, because it is the
 * kind of thing that creeps back the next time a card is added.
 *
 * And the two language mirrors are separate files, so the icons can drift
 * apart silently. They are compared byte for byte.
 *
 * Exit 0 = pass, 1 = fail.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const MIRRORS = ['index.html', 'fr/index.html']

const problems = []
const ok = (label, cond) => { if (!cond) problems.push(label) }
const eq = (label, got, expected) => {
  if (JSON.stringify(got) !== JSON.stringify(expected)) {
    problems.push(`${label}\n      got:      ${JSON.stringify(got)}\n      expected: ${JSON.stringify(expected)}`)
  }
}

/** Every icon slot on a page, in document order. */
function iconSlots(html) {
  const out = []
  const re = /<div class="(service-icon|why-icon)">([\s\S]*?)<\/div>/g
  let m
  while ((m = re.exec(html))) out.push({ cls: m[1], inner: m[2].trim() })
  return out
}

// Emoji as a literal character, and emoji as the numeric entities these
// actually were. Both spellings, or the check only catches the one we fixed.
const EMOJI_CHAR = /[\u{1F300}-\u{1FAFF}\u{2190}-\u{27BF}\u{FE0F}\u{1F000}-\u{1F2FF}]/u
function entityEmoji(s) {
  return (s.match(/&#(\d+);/g) || [])
    .map(e => Number(e.slice(2, -1)))
    .filter(cp => cp >= 0x2190)
}

const pages = {}
for (const f of MIRRORS) pages[f] = readFileSync(join(ROOT, f), 'utf8')

for (const f of MIRRORS) {
  const slots = iconSlots(pages[f])
  eq(`A1 ${f} has all six icon slots`, slots.length, 6)
  eq(`A2 ${f} — three services, three why-cards`,
    slots.map(s => s.cls),
    ['service-icon', 'service-icon', 'service-icon', 'why-icon', 'why-icon', 'why-icon'])

  for (const [i, s] of slots.entries()) {
    ok(`A3.${i} ${f} slot ${i} holds no emoji character`, !EMOJI_CHAR.test(s.inner))
    eq(`A4.${i} ${f} slot ${i} holds no emoji entity`, entityEmoji(s.inner), [])
    ok(`A5.${i} ${f} slot ${i} is a single inline <svg>`,
      s.inner.startsWith('<svg') && s.inner.endsWith('</svg>') &&
      (s.inner.match(/<svg/g) || []).length === 1)
    // Decorative: the heading beside it already names the thing.
    ok(`A6.${i} ${f} slot ${i} is hidden from screen readers`, /aria-hidden="true"/.test(s.inner))
    ok(`A7.${i} ${f} slot ${i} is not tabbable`, /focusable="false"/.test(s.inner))
    // Inherit the card's ink rather than hardcoding a colour.
    ok(`A8.${i} ${f} slot ${i} strokes currentColor`, /stroke="currentColor"/.test(s.inner))
  }

  // One glyph per job. This is the duplicate that was actually there.
  const shapes = slots.map(s => s.inner)
  const dupes = shapes.filter((s, i) => shapes.indexOf(s) !== i)
  eq(`A9 ${f} — no icon is reused for two different cards`, dupes.length, 0)
}

// The mirrors must be the same drawings. Separate files drift; this is the
// only thing standing between them and a redesign that lands in one language.
eq('B1 en and fr carry identical icon markup',
  iconSlots(pages['index.html']).map(s => s.inner),
  iconSlots(pages['fr/index.html']).map(s => s.inner))

// ── the sourcing line, removed 2026-09-15 ─────────────────────────────────
// Dropped from the homepage on the owner's call. Asserted so it cannot come
// back through one mirror only, and so the dead i18n key is not resurrected.
const lang = readFileSync(join(ROOT, 'lang.js'), 'utf8')
for (const f of MIRRORS) {
  ok(`C1 ${f} no longer carries the sourcing note`, !/brands-note/.test(pages[f]))
}
ok('C2 the orphaned i18n key is gone', !/home\.brands\.note/.test(lang))
ok('C3 …and nothing still asks for it',
  !MIRRORS.some(f => /home\.brands\.note/.test(pages[f])))

if (problems.length) {
  console.error(`check-home-icons: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error(`  - ${p}\n`)
  process.exit(1)
}
console.log('check-home-icons: OK — six drawn icons, one meaning each, identical in both languages.')
