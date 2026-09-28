import { describe, it, expect, vi } from 'vitest'
import { signResultClaim, verifyResultClaim, cleanupFoyerResults } from './foyer-result-claim'
const secret = 'test-only-result-signing-secret-32-bytes'
const id = '10000000-0000-4000-8000-000000000001'
describe('Foyer result credential', () => {
  it('validates exact server-issued claim only before expiry', () => {
    const token = signResultClaim(secret, id, 2000)
    expect(verifyResultClaim(secret, token, 1999)).toBe(id)
    expect(verifyResultClaim(secret, token, 2000)).toBeNull()
  })
  it('rejects altered identity, expiry, signature and signing purpose', () => {
    const token = signResultClaim(secret, id, 2000)
    for (const bad of [token.replace(id,id.replace(/1$/,'2')),token.replace('2000','3000'),token+'x','invalid',signResultClaim('different-purpose',id,2000)])
      expect(verifyResultClaim(secret,bad,1000)).toBeNull()
  })
})
describe('Foyer cleanup', () => {
  it('only deletes storage returned by the atomic expiry claim, retaining failed deletion tombstones', async () => {
    const remove = vi.fn().mockResolvedValueOnce({error:{message:'storage down'}}).mockResolvedValueOnce({error:null})
    const eqState=vi.fn().mockResolvedValue({error:null}),eqId=vi.fn().mockReturnValue({eq:eqState})
    const sb:any={rpc:vi.fn().mockResolvedValue({data:[{id:'a',clean_path:'a.png',locked_path:'a.jpg'},{id:'b',clean_path:'b.png',locked_path:'b.jpg'}]}),
      storage:{from:vi.fn().mockReturnValue({remove})},from:vi.fn().mockReturnValue({delete:()=>({eq:eqId})})}
    expect(await cleanupFoyerResults(sb)).toBe(1)
    expect(sb.rpc).toHaveBeenCalledWith('claim_expired_foyer_results',{p_limit:10})
    expect(eqId).toHaveBeenCalledTimes(1)
    expect(eqId).toHaveBeenCalledWith('id','b')
    expect(eqState).toHaveBeenCalledWith('state','deleting')
  })
})
