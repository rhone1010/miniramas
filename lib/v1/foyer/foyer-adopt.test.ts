import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const state=vi.hoisted(()=>({user:null as any,rpc:vi.fn()}))
vi.mock('@/lib/store/auth',()=>({getUser:async()=>state.user}))
vi.mock('@/lib/v1/foyer/foyer-source',()=>({foyerDb:()=>({rpc:state.rpc})}))
vi.mock('@/lib/v1/foyer/foyer-identity',()=>({foyerSecret:()=> 'test-only-result-signing-secret-32-bytes'}))
import { POST } from '../../../../app/api/v1/foyer/adopt/route'
import { signResultClaim, RESULT_COOKIE_PREFIX } from './foyer-result-claim'
const id='10000000-0000-4000-8000-000000000001'
function req(origin='https://preview.example') {
  const token=signResultClaim('test-only-result-signing-secret-32-bytes',id,Date.now()+7200000)
  return new NextRequest('https://preview.example/api/v1/foyer/adopt',{method:'POST',headers:{origin,cookie:RESULT_COOKIE_PREFIX+id+'='+token}})
}
beforeEach(()=>{state.user={id:'verified-owner'};state.rpc.mockReset()})
describe('Authenticated Foyer adoption',()=>{
  it('requires same-origin authenticated request',async()=>{
    expect((await POST(req('https://other.example'))).status).toBe(403)
    state.user=null;expect((await POST(req())).status).toBe(401)
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it('takes identity only from auth and clears only completed claim cookies',async()=>{
    state.rpc.mockResolvedValue({data:'canonical-portfolio',error:null})
    const response=await POST(req())
    expect(state.rpc).toHaveBeenCalledWith('adopt_foyer_result',{p_claim:id,p_user:'verified-owner'})
    expect(await response.json()).toEqual({portfolios:['canonical-portfolio']})
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  })
  it('retains credentials on a transient failure for retry',async()=>{
    state.rpc.mockResolvedValue({data:null,error:{message:'database unavailable'}})
    const response=await POST(req());expect(response.status).toBe(503)
    expect(response.headers.get('set-cookie')).toBeNull()
  })
  it('rejects different-account replay without disclosing result or source',async()=>{
    state.rpc.mockResolvedValue({data:null,error:{message:'foyer_claim_owner_mismatch'}})
    const response=await POST(req());expect(response.status).toBe(409)
    expect(await response.json()).toEqual({portfolios:[],error:'claim_owner_mismatch'})
  })
})
