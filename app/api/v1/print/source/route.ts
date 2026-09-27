import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { ownedSquarePreview, ownedSquareSource, requireSandboxPrint } from '@/lib/v1/print/owned-source'
import { canFulfil } from '@/lib/v1/print/db'
import { supabaseAdmin } from '@/lib/supabase'
import { getStripe } from '@/lib/v1/print/stripe-client'
import { getProduct } from '@/lib/v1/print/prodigi-client'

export async function GET(req:Request){
  const user=await getUser()
  if(!user)return NextResponse.json({error:'sign_in_required'},{status:401})
  try{
    if(process.env.VERCEL_ENV==='preview' && new URL(req.url).searchParams.has('readiness')){
      const bucket=await supabaseAdmin.storage.getBucket('print-assets')
      const orders=await supabaseAdmin.from('print_orders').select('id').limit(1)
      let productVerified=false,webhooks:any[]=[]
      try{productVerified=(await getProduct('GLOBAL-FAP-8X8')).outcome==='Ok'}catch{}
      try{webhooks=(await getStripe().webhookEndpoints.list({limit:100})).data
        .filter(w=>new URL(w.url).pathname==='/api/v1/print/webhook')
        .map(w=>({url:w.url,status:w.status,checkoutCompleted:w.enabled_events.includes('*')||w.enabled_events.includes('checkout.session.completed')}))}catch{}
      return NextResponse.json({preview:true,prodigiMode:(process.env.PRODIGI_ENV||'sandbox').toLowerCase(),
        stripeMode:process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')?'test':'not_test',
        upscaleConfigured:!!process.env.REPLICATE_API_TOKEN,signingSecretConfigured:!!(process.env.STRIPE_PRINT_WEBHOOK_SECRET||process.env.STRIPE_WEBHOOK_SECRET),
        assetBucket:!bucket.error,orderTable:!orders.error,fulfilment:await canFulfil(user.id),productVerified,webhooks},
        {headers:{'Cache-Control':'private, no-store'}})
    }
    requireSandboxPrint()
    const id=new URL(req.url).searchParams.get('piece')||''
    if(new URL(req.url).searchParams.has('eligibility')){
      if(!await canFulfil(user.id))return NextResponse.json({eligible:false},{headers:{'Cache-Control':'private, no-store'}})
      await ownedSquareSource(user.id,id)
      return NextResponse.json({eligible:true},{headers:{'Cache-Control':'private, no-store'}})
    }
    return NextResponse.json({piece:await ownedSquarePreview(user.id,id),fulfilment:await canFulfil(user.id)},
      {headers:{'Cache-Control':'private, no-store'}})
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'print_source_unavailable'},{status:409})}
}
