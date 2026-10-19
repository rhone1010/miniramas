// My Collection: what a tile may claim for each server state (pending/unstarted, rendering, completed, failed), through the REAL loadPortfolio of each live page,
// and the frontend/backend portfolio route contract (every route a live page calls exists; the dead /activate call is gone).

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const PAGES = ['public/pets.html', 'public/discovery-consolidated-draft.html', 'public/groups.html']
const text = (f: string) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')

/** The function source from `function name(` to its closing brace at column 0. */
function fn(src: string, name: string): string {
  const a = src.indexOf(`function ${name}(`); if (a < 0) throw new Error('missing ' + name)
  const z = src.indexOf('\n}\n', a); return src.slice(a, z + 3)
}
async function load(file: string, portfolioStatus: string, itemStatuses: string[]) {
  const src = text(file)
  const ctx: any = {
    console, canonicalSeries: (s: string) => s, setTimeout,
    INCLUDED_BY_PORTFOLIO: {},
    fetch: (url: string) => Promise.resolve({ ok: true, json: async () => url.endsWith('/status')
      ? { status: portfolioStatus, series: 'pets', aspectRatio: null, items: itemStatuses.map((status, slot) => ({ slot, preset: 'bronze', status, previewId: status === 'done' ? 'p' + slot : null, previewUrl: status === 'done' ? '/a' + slot : null })) }
      : { items: [], includedRemaining: 0 } }),
  }
  vm.runInNewContext(fn(src, 'loadPortfolio') + '\nthis.loadPortfolio = loadPortfolio', ctx)
  return await ctx.loadPortfolio('pf1') as Array<{ crafting: boolean; queued: boolean; failed: boolean; art: string | null }>
}

describe.each(PAGES)('%s: what a Collection tile claims', file => {
  it('an item that has not started is queued ("Waiting to start"), not crafting; a rendering item is crafting; done is done; failed is failed', async () => {
    const t = await load(file, 'generating', ['pending', 'rendering', 'done', 'failed'])
    expect(t.map(x => ({ crafting: x.crafting, queued: x.queued, failed: x.failed }))).toEqual([
      { crafting: true, queued: true, failed: false },        // pending: in the queue, still counted as in flight (the page keeps polling) but it does not say it is being made
      { crafting: true, queued: false, failed: false },       // rendering
      { crafting: false, queued: false, failed: false },      // done
      { crafting: false, queued: false, failed: true },       // failed
    ])
    expect(t[2].art).toBe('/a2'); expect(t[0].art).toBeNull()
  })
  it('an unrecognised server state is never drawn as work in progress', async () => {
    const [t] = await load(file, 'generating', ['paused-by-a-future-release'])
    expect(t.queued).toBe(true); expect(t.failed).toBe(false)
  })
  it('a failed portfolio shows its unfinished items as failed, and keeps the finished ones', async () => {
    const t = await load(file, 'failed', ['done', 'pending', 'rendering'])
    expect(t.map(x => x.failed)).toEqual([false, true, true]); expect(t[0].art).toBe('/a0')
  })
  it('a portfolio that is not yet activated: Pets lists nothing (as before); the other two pages keep listing its items (their paid-run polling depends on it) but as waiting, never as being made', async () => {
    const t = await load(file, 'pending', ['pending', 'pending'])
    if (file.endsWith('pets.html')) expect(t).toEqual([])
    else expect(t.map(x => [x.crafting, x.queued, x.failed])).toEqual([[true, true, false], [true, true, false]])
  })
  it('the tile wording distinguishes queued from rendering', () => {
    const s = text(file); expect(s).toContain('Waiting to start…'); expect(s).toContain('Crafting…')
  })
})

describe('the portfolio route contract', () => {
  const ROUTES = 'app/api/v1/portfolios/[portfolioId]'
  it('every /api/v1/portfolios/<id>/<segment> a live page calls has a route behind it', () => {
    for (const f of [...PAGES, 'public/portraits.html', 'public/halloween.html']) {
      const s = text(f)
      for (const m of s.matchAll(/'\/api\/v1\/portfolios\/'\s*\+\s*encodeURIComponent\([^)]*\)\s*\+\s*'\/([a-z-]+)/g)) expect(fs.existsSync(path.join(ROUTES, m[1], 'route.ts')), `${f} calls /${m[1]}`).toBe(true)
    }
  })
  it('no live page calls /activate (no such route exists, and activation is the Stripe webhook\'s alone)', () => {
    expect(fs.existsSync(path.join(ROUTES, 'activate'))).toBe(false)
    for (const f of PAGES) { const s = text(f); expect(s).not.toMatch(/fetch\([^)]*\/activate/); expect(s).not.toContain('activateIfStalled(d.portfolios)') }
  })
  it('the activation the pages rely on is the webhook\'s: confirmPurchase, then activatePortfolio', () => {
    const w = text('app/api/v1/webhooks/stripe/route.ts'); expect(w).toMatch(/confirmPurchase\(/); expect(w).toMatch(/await activatePortfolio\(purchaseId\)/)
  })
})
