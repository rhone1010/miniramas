import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const page = readFileSync('public/pets.html', 'utf8')
const block = page.slice(page.indexOf('var PENDING_REVIEW = false;'), page.indexOf('/* One listener for every Curator control'))
function harness(preview: boolean, authenticated: boolean) {
  const ctx: any = {
    SELECTED: ['plushy'], ME: null, requirePhoto: () => false,
    closePickSizes: vi.fn(), act: vi.fn(), showReview: vi.fn(), openSignin: vi.fn(),
    whoAmI: vi.fn(async () => authenticated ? { id: 'tester' } : null),
    fetch: vi.fn(async () => ({ ok: preview, json: async () => ({ available: true }) })),
    window: { addEventListener: vi.fn() }, document: { addEventListener: vi.fn() },
  }
  ctx.closeSignin = vi.fn(() => { ctx.PENDING_REVIEW = false })
  runInNewContext(block, ctx)
  return ctx
}
const settle = () => new Promise(resolve => setImmediate(resolve))
describe('Pets Preview Review session refresh', () => {
  it('recognizes a session established after Discovery loaded', async () => {
    const c = harness(true, true)
    c.requestReview()
    await settle()
    expect(c.showReview).toHaveBeenCalledOnce()
    expect(c.openSignin).not.toHaveBeenCalled()
  })
  it('resumes a pending Review after returning from another tester tab', async () => {
    const c = harness(true, true)
    c.PENDING_REVIEW = true
    c.resumePreviewReview()
    await settle()
    expect(c.closeSignin).toHaveBeenCalledOnce()
    expect(c.showReview).toHaveBeenCalledOnce()
  })
  it('does not grant a session to an anonymous Preview visitor', async () => {
    const c = harness(true, false)
    c.requestReview()
    await settle()
    expect(c.openSignin).toHaveBeenCalledOnce()
    expect(c.showReview).not.toHaveBeenCalled()
  })
  it('retains the normal sign-in path when tester capability is unavailable', async () => {
    const c = harness(false, true)
    c.requestReview()
    await settle()
    expect(c.whoAmI).not.toHaveBeenCalled()
    expect(c.openSignin).toHaveBeenCalledOnce()
  })
})
