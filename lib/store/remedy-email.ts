import { supabaseAdmin as db } from '@/lib/supabase'
// The existing support/Resend channel; content is from the approved case states.
export async function sendRemedyCaseEmails(row:any) {
 const key=process.env.RESEND_API_KEY
 if(!key||!row.reply_to||!row.case_number)return
 const c=row.context.case
 const events=['received',...(c.status==='awaiting_photo'?['action_required']:[]),...(c.status==='resolved'?['resolved']:[])]
 for(const event of events){
  if(c.email_events?.[event])continue
  const {data:claimed,error}=await db.rpc('claim_make_it_right_email',{p_case:row.id,p_user:row.user_id,p_event:event})
  if(error||!claimed)continue
  const title=event==='received'?'We’ve got it.':event==='action_required'?'A better photo will help.':'We’ve made it right.'
  const result=c.authorized_remedy==='refund'?`Refund issued · $${(c.authorized_amount_cents/100).toFixed(2)}\nReturned to the original payment method.`:'Redo approved\nNew artwork is being crafted.'
  const body=event==='received'?'Case received':event==='action_required'?'New photo requested\nComplimentary retry is waiting for a better source photograph.':result
  const art=[c.artwork.series,c.artwork.preset].filter(Boolean).join(' · ')
  let outcome:any={status:'uncertain'}
  try {
   const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),
    headers:{'content-type':'application/json',authorization:`Bearer ${key}`,'Idempotency-Key':`make-it-right/${row.id}/${event}`},
    body:JSON.stringify({from:process.env.SUPPORT_FROM_EMAIL||'Liten & Co <hello@litenco.com>',to:[row.reply_to],
     subject:`${title} · Case #${row.case_number}`,text:`${title}\n\nCase #${row.case_number}\n${art}\n\n${body}\n\n— The Liten & Co Team`})})
   const data=await response.json().catch(()=>null)
   outcome={status:response.ok?'accepted':'failed',...(response.ok&&data?.id?{id:data.id}:{})}
  }catch{}
  await db.rpc('record_make_it_right_email',{p_case:row.id,p_user:row.user_id,p_event:event,p_result:outcome})
 }
}
