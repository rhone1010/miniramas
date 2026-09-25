import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const h=vi.hoisted(()=>({user:vi.fn(),create:vi.fn(),fulfill:vi.fn()}))
vi.mock('@/lib/store/auth',()=>({getUser:h.user}))
vi.mock('@/lib/store/collection-unlock-set',()=>({createCollectionSetCheckout:h.create,fulfillCollectionSet:h.fulfill}))
import { POST } from '@/app/api/v1/collection/unlocks/all/route'
const post=(body:unknown)=>POST(new NextRequest('https://preview.example/api/v1/collection/unlocks/all',{method:'POST',body:JSON.stringify(body)}))
beforeEach(()=>{
 vi.clearAllMocks();h.user.mockResolvedValue({id:'owner'});vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLIC_KEY','pk_test_fixture')
 h.create.mockResolvedValue({sessionId:'session',clientSecret:'secret',priceCents:1790,count:10})
 h.fulfill.mockResolvedValue({confirmed:true,count:10})
})
it('requires authentication for set purchase and confirmation',async()=>{
 h.user.mockResolvedValue(null)
 expect((await post({count:10})).status).toBe(401)
 expect((await post({sessionId:'session'})).status).toBe(401)
 expect(h.create).not.toHaveBeenCalled();expect(h.fulfill).not.toHaveBeenCalled()
})
it('takes only a quoted count and local return path, never a client-supplied set or price',async()=>{
 await post({count:10,cents:1,previewIds:['foreign'],returnPath:'/pets/discovery'})
 expect(h.create).toHaveBeenCalledWith('owner',10,'https://preview.example/pets/discovery?collection_unlock_set_session={CHECKOUT_SESSION_ID}')
})
it('rejects invalid quantities and external return destinations',async()=>{
 expect((await post({count:9})).status).toBe(400)
 expect((await post({count:10.5})).status).toBe(400)
 await post({count:20,returnPath:'https://evil.example'})
 expect(h.create.mock.calls[0][2]).toMatch(/^https:\/\/preview.example\/discovery\?/)
})
it('confirms only for the signed-in owner',async()=>{
 expect(await (await post({sessionId:'session'})).json()).toEqual({confirmed:true,count:10})
 expect(h.fulfill).toHaveBeenCalledWith('session','owner')
})
it('does not report success on failed fulfillment',async()=>{
 h.fulfill.mockRejectedValue(new Error('rollback'))
 expect((await post({sessionId:'session'})).status).toBe(503)
})
