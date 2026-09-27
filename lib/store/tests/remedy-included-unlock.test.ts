import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const h = vi.hoisted(() => ({ user: vi.fn(), clean: vi.fn(), rpc: vi.fn(), from: vi.fn(), consume: vi.fn() }))
vi.mock('@/lib/store/auth', () => ({ getUser: h.user }))
vi.mock('@/lib/store/preview', () => ({ fetchCleanOriginal: h.clean, normalizeEmail: (s: string) => s || null }))
vi.mock('@/lib/store/entitlements', () => ({ consumeEntitlement: h.consume }))
vi.mock('@/lib/store/discovery-unlock', () => ({ DISCOVERY_UNLOCK_LOCK: 'discovery_unlock' }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: h.from, rpc: h.rpc }) }))
import { POST } from '@/app/api/v1/portraits/unlock/route'
const redeem = (confirmation?:string) => POST(new NextRequest('https://preview.example/api/v1/portraits/unlock', { method: 'POST', body: JSON.stringify({ preview_id: 'preview',confirm_included:confirmation }) }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SUPABASE_URL', 'https://db.example')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'fixture')
  h.user.mockResolvedValue({ id: 'owner' })
  h.clean.mockResolvedValue('CLEAN_BYTES')
  h.rpc.mockResolvedValue({ data: {status:'unlocked',reusable:true}, error: null })
  h.from.mockImplementation(() => {
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: 'preview', email: 'portfolio:portfolio:0', storage_path: 'clean.png', unlocked_at: null } }) }
    return q
  })
})
describe('staged Collection credit redemption', () => {
  it('fetches clean bytes before the atomic ownership/credit transaction', async () => {
    const response = await redeem()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ image_b64: 'CLEAN_BYTES', preview_id: 'preview', reusable: true,redelivered:false,originPortfolioId:null })
    expect(h.rpc).toHaveBeenCalledWith('redeem_collection_unlock_v2', { p_user: 'owner', p_preview: 'preview',p_confirm_cross:null })
    expect(h.clean.mock.invocationCallOrder[0]).toBeLessThan(h.rpc.mock.invocationCallOrder[0])
    expect(h.consume).not.toHaveBeenCalled()
  })
  it('does not spend a credit when the clean file is missing', async () => {
    h.clean.mockResolvedValue(null)
    expect((await redeem()).status).toBe(404)
    expect(h.rpc).not.toHaveBeenCalled()
  })
  it('does not return clean bytes or fall through to another debit after a transaction error', async () => {
    h.rpc.mockResolvedValue({ error: { message: 'failed' } })
    const response = await redeem()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'unlock_wallet_unavailable' })
    expect(h.consume).not.toHaveBeenCalled()
  })
  it('redelivers an ownership-verified retry without another entitlement consumption', async () => {
    h.rpc.mockResolvedValue({ data: {status:'already_unlocked'}, error: null })
    expect((await redeem()).status).toBe(200)
    expect(h.consume).not.toHaveBeenCalled()
  })
  it('asks for crossover confirmation without releasing clean artwork',async()=>{
    h.rpc.mockResolvedValue({data:{status:'confirm_included',entitlementId:'included',originPortfolioId:'original'},error:null})
    const r=await redeem();expect(r.status).toBe(409)
    expect(await r.json()).toEqual({confirmation:'included_crossover',entitlementId:'included'})
    expect(h.consume).not.toHaveBeenCalled()
  })
  it('carries the exact confirmed allowance and returns its provenance',async()=>{
    h.rpc.mockResolvedValue({data:{status:'unlocked',reusable:false,originPortfolioId:'original'},error:null})
    const r=await redeem('included');expect(r.status).toBe(200)
    expect(h.rpc).toHaveBeenCalledWith('redeem_collection_unlock_v2',{p_user:'owner',p_preview:'preview',p_confirm_cross:'included'})
    expect((await r.json()).originPortfolioId).toBe('original')
  })
})
