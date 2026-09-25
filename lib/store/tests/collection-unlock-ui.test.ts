import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

for (const file of ['discovery-consolidated-draft', 'pets']) {
  const html = readFileSync(`public/${file}.html`, 'utf8')
  const code = html.slice(html.indexOf('var MC_UNLOCK_BUSY ='), html.indexOf('function mcUnlockShow(offer)'))
  const make = () => {
    const elements: any = { ckErr: {}, ckModal: { classList: { add: vi.fn() } } }
    const storage = { setItem: vi.fn(), removeItem: vi.fn() }
    const embed = { mount: vi.fn() }
    const init = vi.fn().mockResolvedValue(embed)
    const ctx: any = {
      ME: { id: 'owner' }, MC_UNLOCK_REVIEW: { offers: [{ count: 3, cents: 799 }] },
      document: { getElementById: (id: string) => elements[id] },
      location: { pathname: file === 'pets' ? '/pets/discovery' : '/discovery', href: 'https://preview.example/discovery?collection_unlock_session=session' },
      sessionStorage: storage, history: { replaceState: vi.fn() }, URL,
      loadStripeJs: vi.fn().mockResolvedValue(undefined),
      fetch: vi.fn().mockResolvedValue({ json: async () => ({ clientSecret: 'secret', sessionId: 'session', publishableKey: 'pk_test_fixture', priceCents: 799 }) }),
      window: { Stripe: vi.fn(() => ({ initEmbeddedCheckout: init })) },
      closeCheckout: vi.fn(), paintCheckoutHead: vi.fn(), mcUnlockMoney: (c: number) => '$' + (c / 100).toFixed(2),
      showUnlockNote: vi.fn(), clearUnlockNote: vi.fn(), openSignin: vi.fn(), openMyCollection: vi.fn(),
      renderCollection: vi.fn().mockResolvedValue(undefined), mcUnlockRefresh: vi.fn().mockResolvedValue(undefined),
      UNLOCK_CONFIRM_TRIES: 4, UNLOCK_CONFIRM_EVERY: 2000, setTimeout: (f: () => void) => f(),
    }
    vm.createContext(ctx); vm.runInContext(code, ctx)
    return { ctx, init, embed, storage }
  }
  describe(`${file} wallet wiring`, () => {
    it('routes Unlock All through its distinct set checkout and confirmation', async () => {
      const { ctx, init } = make()
      ctx.MC_UNLOCK_REVIEW.all = { count: 20, rateCents: 159, cents: 3180 }
      ctx.MC_UNLOCK_REVIEW.allCheckoutEnabled = true
      await ctx.mcUnlockCheckout('all')
      expect(ctx.fetch.mock.calls[0][0]).toBe('/api/v1/collection/unlocks/all')
      expect(JSON.parse(ctx.fetch.mock.calls[0][1].body).count).toBe(20)
      ctx.fetch.mockResolvedValue({ json: async () => ({ confirmed: true }) })
      await init.mock.calls[0][0].onComplete()
      expect(ctx.fetch.mock.calls[1][0]).toBe('/api/v1/collection/unlocks/all')
    })
    it('submits the selected bundle to the shared checkout and mounts the existing shell', async () => {
      const { ctx, init, embed } = make()
      await ctx.mcUnlockCheckout('3')
      expect(JSON.parse(ctx.fetch.mock.calls[0][1].body)).toEqual({ count: 3, returnPath: ctx.location.pathname })
      expect(embed.mount).toHaveBeenCalledWith('#ckForm')
      expect(init.mock.calls[0][0].onComplete).toBeTypeOf('function')
    })
    it('requires authentication and prevents duplicate in-flight clicks', async () => {
      const { ctx } = make()
      ctx.ME = null; await ctx.mcUnlockCheckout('3')
      expect(ctx.openSignin).toHaveBeenCalledOnce(); expect(ctx.fetch).not.toHaveBeenCalled()
      ctx.ME = {}; await Promise.all([ctx.mcUnlockCheckout('3'), ctx.mcUnlockCheckout('3')])
      expect(ctx.fetch).toHaveBeenCalledOnce()
    })
    it('confirms payment server-side before refreshing Collection and balance', async () => {
      const { ctx, storage } = make()
      ctx.fetch.mockResolvedValue({ json: async () => ({ confirmed: true }) })
      await ctx.mcUnlockConfirm('session')
      expect(JSON.parse(ctx.fetch.mock.calls[0][1].body)).toEqual({ sessionId: 'session' })
      expect(ctx.renderCollection).toHaveBeenCalledOnce()
      expect(ctx.mcUnlockRefresh).toHaveBeenCalledOnce()
      expect(storage.removeItem).toHaveBeenCalledWith('liten_collection_unlock_session')
    })
    it('does not treat failed confirmation as credit availability and retains recovery state', async () => {
      const { ctx, storage } = make()
      ctx.fetch.mockResolvedValue({ json: async () => ({ confirmed: false }) })
      await ctx.mcUnlockConfirm('session')
      expect(ctx.fetch).toHaveBeenCalledTimes(4)
      expect(ctx.renderCollection).not.toHaveBeenCalled()
      expect(storage.removeItem).not.toHaveBeenCalled()
    })
    it('keeps every inline script syntactically valid', () => {
      for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1])
    })
  })
}
