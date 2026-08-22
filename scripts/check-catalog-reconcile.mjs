#!/usr/bin/env node
/**
 * scripts/check-catalog-reconcile.mjs
 *
 * Asserts the properties of catalog.js's grid reconciler that the old
 * `grid.innerHTML = ''` renderer violated.
 *
 * WHAT WENT WRONG. render() cleared the grid and rebuilt every card, and
 * infinite scroll calls render() on every page. Measured on the live
 * catalogue at the instant the 5th page landed:
 *
 *     cards removed      61
 *     document height    14,284px -> 6,319px
 *     scroll position    13,506   -> 5,541  (the new maximum)
 *
 * The page lost 7,965px in one frame, the browser clamped the scroll to the
 * new bottom, and the customer was thrown into the footer. Two more
 * symptoms shared the root: overlapping chunk pumps drew 30 products twice
 * (152 cards, 120 unique), and a fast scroll could strand the grid at 24
 * cards forever.
 *
 * WHY THESE ASSERTIONS. None of them check "the right products are on
 * screen" — the old renderer got that right too, eventually. They check
 * WHAT THE RENDERER DID TO THE DOM to get there, because that is the thing
 * that moved the scroll. The load-bearing one is node IDENTITY: if the
 * nodes that were already correct are the same objects afterwards, they
 * were never destroyed, the document never shrank, and the bounce is not
 * expressible.
 *
 * The reconciler is sliced out of the shipped catalog.js between its
 * SP_RECONCILE markers and run against a fake grid — a check that reads a
 * copy of the source is a check of the copy.
 *
 *   node scripts/check-catalog-reconcile.mjs
 *
 * Exit 0 = pass, 1 = fail. No network, no DOM, no browser.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC  = join(HERE, '..', 'catalog.js')

const problems = []
function eq(label, got, expected) {
  const g = JSON.stringify(got), e = JSON.stringify(expected)
  if (g !== e) problems.push(`${label}\n      got:      ${g}\n      expected: ${e}`)
}

// ---------------------------------------------------------------------------
// Load the real function out of the real file.
// ---------------------------------------------------------------------------
function loadReconcile() {
  const src = readFileSync(SRC, 'utf8')
  const a = src.indexOf('// ===== SP_RECONCILE_START')
  const b = src.indexOf('// ===== SP_RECONCILE_END')
  if (a < 0 || b < 0 || b < a) {
    console.error('check-catalog-reconcile: SP_RECONCILE markers not found in catalog.js')
    process.exit(1)
  }
  const body = src.slice(a, b)
  if (!/function reconcileGrid\s*\(/.test(body)) {
    console.error('check-catalog-reconcile: reconcileGrid not inside the markers')
    process.exit(1)
  }
  // The block must not reach outside itself, or this harness is testing
  // something the browser will not run.
  for (const forbidden of ['document.', 'window.', 'state.', 'productCard(', 'byoCard(']) {
    if (body.includes(forbidden)) {
      problems.push(`reconcileGrid reaches outside its arguments: ${forbidden}`)
    }
  }
  return new Function(body + '\n; return reconcileGrid;')()
}

// ---------------------------------------------------------------------------
// A grid just big enough. Counts every structural write so the assertions can
// be about DOM churn and not only about the final list.
// ---------------------------------------------------------------------------
function makeGrid() {
  const ops = { insert: 0, append: 0, remove: 0, built: 0 }
  const grid = {
    _kids: [],
    get firstChild() { return this._kids[0] || null },
    _detach(node) {
      const i = this._kids.indexOf(node)
      if (i >= 0) this._kids.splice(i, 1)
    },
    insertBefore(node, ref) {
      ops.insert++
      this._detach(node)
      const i = ref ? this._kids.indexOf(ref) : -1
      if (i < 0) this._kids.push(node)
      else this._kids.splice(i, 0, node)
      node._grid = this
      return node
    },
    appendChild(node) {
      ops.append++
      this._detach(node)
      this._kids.push(node)
      node._grid = this
      return node
    },
    keys() { return this._kids.map(n => n.key) },
  }
  const node = (key, kind) => {
    const n = {
      key, kind,
      get nextSibling() {
        const k = grid._kids, i = k.indexOf(this)
        return i < 0 ? null : (k[i + 1] || null)
      },
      remove() { ops.remove++; grid._detach(this); this._grid = null },
    }
    return n
  }
  return { grid, ops, node }
}

function makeOpts(grid, ops, node, scheduler, currentRef, gen) {
  return {
    keyOf:        n => n.key,
    keyOfProduct: p => p.id,
    mountedCards: g => g._kids.filter(n => n.kind === 'card'),
    makeCard:     (p) => { ops.built++; return node(p.id, 'card') },
    makeTailCard: ()  => { ops.built++; return node('__byo__', 'byo') },
    isCard:       n   => n.kind === 'card',
    isTailCard:   n   => n.kind === 'byo',
    initialCount: 24,
    chunkSize:    12,
    schedule:     fn  => scheduler.push(fn),
    isCurrent:    ()  => currentRef.gen === gen,
    onSettled:    ()  => { ops.settled = (ops.settled || 0) + 1 },
  }
}

const P = (n, from = 0) => Array.from({ length: n }, (_, i) => ({ id: 'p' + (i + from) }))

/** Run a render to completion, draining the deferred chunks. */
function drawFully(reconcile, ctx, visible, gen) {
  const queue = []
  ctx.current.gen = gen
  reconcile(ctx.grid, visible, makeOpts(ctx.grid, ctx.ops, ctx.node, queue, ctx.current, gen))
  let guard = 0
  while (queue.length) {
    if (++guard > 10000) throw new Error('chunk pump did not terminate')
    queue.shift()()
  }
}

function freshCtx() {
  const { grid, ops, node } = makeGrid()
  return { grid, ops, node, current: { gen: 0 } }
}

function main() {
  const reconcile = loadReconcile()

  // ── An append must not destroy anything ─────────────────────────────────
  //
  // THE assertion. The scroll jump was a consequence of the document getting
  // shorter, and the document got shorter because nodes were removed. If an
  // append removes nothing and rebuilds nothing, the height cannot fall.
  {
    const ctx = freshCtx()
    drawFully(reconcile, ctx, P(60), 1)
    const before = ctx.grid._kids.filter(n => n.kind === 'card')
    const builtAfterFirst = ctx.ops.built

    ctx.ops.remove = 0; ctx.ops.insert = 0; ctx.ops.append = 0
    drawFully(reconcile, ctx, P(90), 2)          // page 3 lands
    const after = ctx.grid._kids.filter(n => n.kind === 'card')

    eq('60 + 30 draws 90 cards', after.length, 90)
    eq('…and removes NOTHING', ctx.ops.remove, 0)
    eq('…and builds only the 30 new ones', ctx.ops.built - builtAfterFirst, 30)
    // Identity, not equality. Same objects = never destroyed = height only grew.
    eq('…and the first 60 nodes are the SAME objects',
       before.every((n, i) => after[i] === n), true)
    eq('…and only the 30 new cards were inserted (the tail card is moved once)',
       ctx.ops.insert, 30)
    eq('…in the right order', after.map(n => n.key).slice(58, 62),
       ['p58', 'p59', 'p60', 'p61'])
  }

  // ── Six pages in a row: still zero removals ─────────────────────────────
  {
    const ctx = freshCtx()
    let removals = 0
    for (let page = 1; page <= 6; page++) {
      ctx.ops.remove = 0
      drawFully(reconcile, ctx, P(page * 30), page)
      removals += ctx.ops.remove
    }
    eq('six sequential pages remove nothing at all', removals, 0)
    eq('…and end with 180 cards', ctx.grid._kids.filter(n => n.kind === 'card').length, 180)
    eq('…with no duplicate keys',
       new Set(ctx.grid.keys()).size, ctx.grid.keys().length)
  }

  // ── The "bring your own" card stays last, and is not rebuilt ────────────
  {
    const ctx = freshCtx()
    drawFully(reconcile, ctx, P(30), 1)
    const byo = ctx.grid._kids[ctx.grid._kids.length - 1]
    eq('the tail card is last after the first draw', byo.kind, 'byo')
    const builtBefore = ctx.ops.built
    drawFully(reconcile, ctx, P(60), 2)
    const last = ctx.grid._kids[ctx.grid._kids.length - 1]
    eq('…still last after an append', last.kind, 'byo')
    eq('…and it is the same node, not a fresh one', last === byo, true)
    eq('…so only the 30 new product cards were built', ctx.ops.built - builtBefore, 30)
  }

  // ── A sort change moves nodes; it does not rebuild them ─────────────────
  // This is why the fix is a reconcile and not an append-only fast path:
  // an append-only renderer is wrong the moment the ordering changes.
  {
    const ctx = freshCtx()
    drawFully(reconcile, ctx, P(60), 1)
    const byKey = new Map(ctx.grid._kids.filter(n => n.kind === 'card').map(n => [n.key, n]))
    const builtBefore = ctx.ops.built
    const reversed = P(60).slice().reverse()
    drawFully(reconcile, ctx, reversed, 2)
    const after = ctx.grid._kids.filter(n => n.kind === 'card')
    eq('a reversed sort re-orders the grid', after.map(n => n.key).slice(0, 3),
       ['p59', 'p58', 'p57'])
    eq('…by MOVING the existing nodes', ctx.ops.built - builtBefore, 0)
    eq('…which are the same objects', after.every(n => byKey.get(n.key) === n), true)
    eq('…and removes nothing', ctx.ops.remove, 0)
  }

  // ── A narrowing filter detaches immediately, not at settle ──────────────
  // Waiting for the chunked tail would leave stale products on screen for as
  // long as the tail takes, which is exactly when a customer is looking.
  {
    const ctx = freshCtx()
    drawFully(reconcile, ctx, P(60), 1)
    const queue = []
    ctx.current.gen = 2
    // Only 5 of the 60 survive, plus 40 brand-new ones so a tail is pending.
    const next = P(5).concat(P(40, 100))
    reconcile(ctx.grid, next, makeOpts(ctx.grid, ctx.ops, ctx.node, queue, ctx.current, 2))
    const midFlight = ctx.grid._kids.filter(n => n.kind === 'card').map(n => n.key)
    eq('the tail has NOT finished yet', queue.length > 0, true)
    eq('…and no filtered-out product is still on screen',
       midFlight.some(k => /^p([5-9]|[1-5][0-9])$/.test(k)), false)
    while (queue.length) queue.shift()()
    eq('…and the finished grid is exactly the new set',
       ctx.grid._kids.filter(n => n.kind === 'card').length, 45)
  }

  // ── A superseded render stops writing ───────────────────────────────────
  // The 30 duplicated products came from two pumps appending into one grid.
  {
    const ctx = freshCtx()
    const queueA = []
    ctx.current.gen = 1
    reconcile(ctx.grid, P(90), makeOpts(ctx.grid, ctx.ops, ctx.node, queueA, ctx.current, 1))
    eq('render A yielded with work outstanding', queueA.length, 1)
    const midCount = ctx.grid._kids.length

    ctx.current.gen = 2                       // render B supersedes A
    let guard = 0
    while (queueA.length) { if (++guard > 100) break; queueA.shift()() }
    eq('…and the stale pump wrote nothing more', ctx.grid._kids.length, midCount)
    eq('…and did not queue itself again', queueA.length, 0)
  }

  // ── Two renders racing produce no duplicates ────────────────────────────
  // The shipped failure, reproduced: 152 cards, 120 unique.
  {
    const ctx = freshCtx()
    const qA = [], qB = []
    ctx.current.gen = 1
    reconcile(ctx.grid, P(90), makeOpts(ctx.grid, ctx.ops, ctx.node, qA, ctx.current, 1))
    ctx.current.gen = 2
    reconcile(ctx.grid, P(120), makeOpts(ctx.grid, ctx.ops, ctx.node, qB, ctx.current, 2))
    // Drain both, interleaved, the way two live pumps would run.
    let guard = 0
    while (qA.length || qB.length) {
      if (++guard > 10000) throw new Error('pumps did not terminate')
      if (qA.length) qA.shift()()
      if (qB.length) qB.shift()()
    }
    const keys = ctx.grid.keys()
    eq('a race leaves no duplicate keys', new Set(keys).size, keys.length)
    eq('…and exactly the newer render\'s products',
       ctx.grid._kids.filter(n => n.kind === 'card').length, 120)
  }

  // ── An append must not YIELD ────────────────────────────────────────────
  // Reusing a mounted node costs nothing, so it must not be charged against
  // the build budget. Charge it, and a 600-card grid defers 570 reused nodes
  // into chunked work on every single append — slower, and back to having a
  // long asynchronous pump in flight for a race to land in.
  {
    const ctx = freshCtx()
    drawFully(reconcile, ctx, P(60), 1)
    const queue = []
    ctx.current.gen = 2
    reconcile(ctx.grid, P(90), makeOpts(ctx.grid, ctx.ops, ctx.node, queue, ctx.current, 2))
    eq('appending a page defers NOTHING — it finishes in the sync pass', queue.length, 0)
    eq('…with all 90 cards already drawn',
       ctx.grid._kids.filter(n => n.kind === 'card').length, 90)
    eq('…and the tail card already last',
       ctx.grid._kids[ctx.grid._kids.length - 1].kind, 'byo')
  }

  // ── New items landing BEFORE mounted ones ───────────────────────────────
  // Sort by price ascending, then append a page of cheap products: the new
  // cards belong at the FRONT, so the sync pass hits its build budget with
  // every existing node still unclaimed. Those nodes are still wanted, and
  // killing them is the original bug wearing a different hat — 60 cards
  // destroyed and rebuilt, document collapses, scroll clamps.
  {
    const ctx = freshCtx()
    drawFully(reconcile, ctx, P(60), 1)
    const byKey = new Map(ctx.grid._kids.filter(n => n.kind === 'card').map(n => [n.key, n]))
    const builtBefore = ctx.ops.built
    ctx.ops.remove = 0

    // 30 brand-new products sorted ahead of all 60 mounted ones.
    const next = P(30, 900).concat(P(60))
    drawFully(reconcile, ctx, next, 2)
    const after = ctx.grid._kids.filter(n => n.kind === 'card')

    eq('90 cards after the cheap page lands', after.length, 90)
    eq('…the new ones are first', after.slice(0, 2).map(n => n.key), ['p900', 'p901'])
    eq('…and NOT ONE mounted card was removed', ctx.ops.remove, 0)
    eq('…nor rebuilt: only the 30 new ones were built', ctx.ops.built - builtBefore, 30)
    // The identity assertion again, in the case that actually threatens it.
    eq('…all 60 originals are still the same objects',
       after.slice(30).every(n => byKey.get(n.key) === n), true)
  }

  // ── The grid does not start empty ───────────────────────────────────────
  // catalog.html ships 12 `.skel` placeholders and the <script> that made
  // them, plus the whitespace between them. innerHTML = '' used to sweep all
  // of that away as a side effect. Forgetting to do it on purpose parked
  // twelve grey placeholders after the last product, permanently — which is
  // exactly what shipped, and what the live page showed mid-scroll.
  {
    const ctx = freshCtx()
    // Seed the grid the way the server does: a script node, 12 skeletons,
    // and whitespace between them. None of them carry a product key.
    ctx.grid.appendChild(ctx.node(null, 'script'))
    for (let i = 0; i < 12; i++) {
      ctx.grid.appendChild(ctx.node(null, 'skel'))
      ctx.grid.appendChild(ctx.node(null, 'text'))
    }
    eq('the grid starts with scaffolding', ctx.grid._kids.length, 25)

    drawFully(reconcile, ctx, P(30), 1)
    const kinds = [...new Set(ctx.grid._kids.map(n => n.kind))].sort()
    eq('…which is gone after the first draw', kinds, ['byo', 'card'])
    eq('…leaving 30 products + the tail card', ctx.grid._kids.length, 31)
    eq('…with the tail card last', ctx.grid._kids[30].kind, 'byo')

    // And the sweep must not become a per-render teardown of real cards.
    ctx.ops.remove = 0
    const builtBefore = ctx.ops.built
    drawFully(reconcile, ctx, P(60), 2)
    eq('…and the next append still removes nothing', ctx.ops.remove, 0)
    eq('…and still builds only the new cards', ctx.ops.built - builtBefore, 30)
  }

  // ── Emptying the grid ───────────────────────────────────────────────────
  {
    const ctx = freshCtx()
    drawFully(reconcile, ctx, P(30), 1)
    drawFully(reconcile, ctx, [], 2)
    eq('an empty result set clears the grid', ctx.grid._kids.length, 0)
  }

  // ── Redrawing the identical list is a no-op ─────────────────────────────
  // An append-only renderer passes every test above and still repaints the
  // world on a no-change render. This is the one that catches that.
  {
    const ctx = freshCtx()
    drawFully(reconcile, ctx, P(60), 1)
    ctx.ops.insert = 0; ctx.ops.remove = 0
    const builtBefore = ctx.ops.built
    drawFully(reconcile, ctx, P(60), 2)
    eq('re-rendering the same list inserts nothing', ctx.ops.insert, 0)
    eq('…removes nothing', ctx.ops.remove, 0)
    eq('…and builds nothing', ctx.ops.built - builtBefore, 0)
  }

  if (problems.length) {
    console.error(`check-catalog-reconcile: ${problems.length} problem(s)\n`)
    for (const p of problems) console.error(`  - ${p}\n`)
    process.exit(1)
  }
  console.log(
    'check-catalog-reconcile: OK — an append removes nothing, rebuilds nothing and leaves ' +
    'the existing nodes as the same objects (so the document cannot shrink and the scroll ' +
    'cannot be clamped); a sort change moves nodes instead of recreating them; a narrowing ' +
    'filter detaches immediately; and a superseded render stops writing, so racing pumps ' +
    'cannot duplicate a product.'
  )
}

main()
