import {NextResponse} from 'next/server'
import {getUser} from '@/lib/store/auth'
import {retryPrintFulfillment} from '@/lib/v1/print/retry'
export const runtime='nodejs'
export const maxDuration=300
export async function POST(req:Request){
 const expected='https://miniramas-git-codex-canonical-2026-09-24-litenco.vercel.app'
 if(new URL(req.url).origin!==expected||req.headers.get('origin')!==expected)return NextResponse.json({error:'origin_required'},{status:403})
 const user=await getUser();if(!user)return NextResponse.json({error:'auth_required'},{status:401})
 const body=await req.json().catch(()=>null),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
 if(!uuid.test(body?.orderId||'')||!uuid.test(body?.retryId||''))return NextResponse.json({error:'order_and_retry_id_required'},{status:400})
 try{return NextResponse.json(await retryPrintFulfillment(user.id,body.orderId,body.retryId))}
 catch(e){const error=e instanceof Error?e.message:'retry_failed';console.error('[print-retry]',error);return NextResponse.json({error},{status:error==='retry_not_authorized'?403:409})}
}
