// app/api/v1/support/route.ts
//
// A MESSAGE FROM THE DESK.
//
// The Concierge answers questions and cannot touch an account. When
// somebody needs something done — a refund, a missing order, a craft that
// failed — she takes a message instead, and this is where it goes: an
// email to Rich, sent through Resend.
//
// WHY A MESSAGE AND NOT A mailto: LINK
//   A mailto: opens whatever the machine thinks is an email client, which
//   on a phone is often nothing at all. The customer writes in the panel
//   they are already looking at, and we do the sending.
//
// THE REPLY-TO IS THE CUSTOMER
//   The mail comes FROM our own domain, because a message claiming to be
//   from a customer's address will fail SPF and land in spam. Their
//   address goes in reply-to, so hitting reply in any mail client answers
//   the customer directly.
//
// WHAT HAS TO BE TRUE BEFORE THIS SENDS
//   1. litenco.com verified in Resend (three DNS records; Vercel holds
//      the zone). Until then Resend refuses the from address.
//   2. SUPPORT_TO_EMAIL is a mailbox that exists. Resend sends; it does
//      not receive. rich@litenco.com needs a real inbox behind it, or
//      point this at an address that already works.
//
// Both are environment variables so neither needs a deploy to change.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/store/auth'
import { CaseError, verifyCase } from '@/lib/support-case'
import { authorizeRemedyCase, executeRemedyCase, readRemedyCase, customerRemedyCase } from '@/lib/store/remedy-case-execution'
import { sendRemedyCaseEmails } from '@/lib/store/remedy-email'
import { hashRemedyIdentity, readRemedySource } from '@/lib/store/remedy-evidence'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const maxDuration = 300

async function caseReceipt(user:{id:string,email?:string|null},id:string) {
  let row=await readRemedyCase(user.id,id)
  try {
    row=await authorizeRemedyCase(user,id)
    row=await executeRemedyCase(user.id,id)
  } catch {
    // Durable receipt survives dependency/transport failure; a retry uses the
    // same case and allocation, never a fresh financial request.
    row=await readRemedyCase(user.id,id)
  }
  await sendRemedyCaseEmails(row).catch(()=>{})
  return {ok:true,ref:row.id,saved:true,caseNumber:row.case_number,case:customerRemedyCase(row)}
}

const MAX_BODY    = 4000
const MAX_SUBJECT = 160
const RATE_WINDOW = 10 * 60 * 1000   // ten minutes
const RATE_MAX    = 3                // messages per address in that window

function esc(s: string) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function POST(req: Request) {
  try {
    const key = process.env.RESEND_API_KEY
    const to  = process.env.SUPPORT_TO_EMAIL
    const from = process.env.SUPPORT_FROM_EMAIL || 'Liten & Co <hello@litenco.com>'

    const body = await req.json().catch(() => ({} as any))
    const message = String(body?.message || '').trim().slice(0, MAX_BODY)
    if (message.length < 5) {
      return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 })
    }

    /* Signed in gives us their address for free. Signed out, they have to
       tell us one — a message we cannot answer is not worth taking. */
    const user = await getUser().catch(() => null)
    if (body.case && !user) return NextResponse.json({ ok:false, reason:'auth_required' }, { status:401 })
    const given = String(body?.email || '').trim().toLowerCase()
    const replyTo = user?.email || (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(given) ? given : null)

    if (!replyTo) {
      return NextResponse.json({ ok: false, reason: 'need_email' }, { status: 400 })
    }

    const caseContext = body.case ? await verifyCase(user!.id, body.case) : null
    const requestId = body.case?.requestId
    if (caseContext && (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))) {
      return NextResponse.json({ ok:false, reason:'invalid_request_id' }, { status:400 })
    }
    if (caseContext) {
      const { data: prior, error } = await supabaseAdmin.from('support_messages')
        .select('id,context,body').eq('id', requestId).eq('user_id', user!.id).maybeSingle()
      if (error) throw new CaseError('case_unavailable', 503)
      if (prior) {
        const c = prior.context?.case
        if (c?.artwork?.id !== caseContext.artwork.id || c?.issue !== caseContext.issue ||
            c?.requested_remedy !== caseContext.requested_remedy || (c.scope||'artwork') !== caseContext.scope || prior.body !== message)
          throw new CaseError('request_conflict', 409)
        return NextResponse.json(await caseReceipt(user!,prior.id))
      }
    }

    /* A quiet ceiling. Somebody genuinely stuck writes twice; a script
       writes two hundred, and this endpoint sends mail. */
    const since = new Date(Date.now() - RATE_WINDOW).toISOString()
    const { count, error: rateError } = await supabaseAdmin
      .from('support_messages')
      .select('id', { count: 'exact', head: true })
      .eq('reply_to', replyTo)
      .gte('created_at', since)

    if (rateError) throw new CaseError('case_unavailable', 503)
    if ((count ?? 0) >= RATE_MAX) {
      return NextResponse.json({ ok: false, reason: 'too_many' }, { status: 429 })
    }

    const subject = String(body?.subject || '').trim().slice(0, MAX_SUBJECT)
      || 'A message from the workshop'

    /* Recorded before it is sent. The mail can bounce, the API can be
       down, Resend can be having a day — and none of that should lose
       what the customer wrote. The row is the record; the email is the
       notification. */
    const { data: row, error: insErr } = await supabaseAdmin
      .from('support_messages')
      .insert({
        ...(caseContext ? { id: requestId } : {}),
        user_id:  user?.id ?? null,
        reply_to: replyTo,
        subject,
        body:     message,
        context: { page: String(body?.context?.page || '').slice(0,200),
          history: (Array.isArray(body.history) ? body.history : []).slice(-8).map((m:any) => ({ role:m?.role === 'assistant' ? 'assistant' : 'user', content:String(m?.content || '').slice(0,2000) })),
          ...(caseContext ? { case:caseContext } : {}) },
      })
      .select('id')
      .maybeSingle()

    if (insErr || !row?.id) {
      return NextResponse.json({ ok:false, reason:'record_failed' }, { status:503 })
    }
    const receipt = caseContext ? await caseReceipt(user!,row.id) : {ok:true,ref:row.id,saved:true}
    // Durable receipt is independent of notification availability.
    if (!key || !to) return NextResponse.json({ ...receipt, notification:'unavailable' })

    /* Context worth having before reading the message: who, how much is
       in their account, and where they were standing. */
    const ctx = { page:String(body?.context?.page || '').slice(0,200) }
    const lines = [
      `From:     ${replyTo}`,
      user?.id ? `Account:  ${user.id}` : 'Account:  (signed out)',
      caseContext ? `Case: ${JSON.stringify(caseContext)}` : null,
      ctx.page ? `Page:     ${ctx.page}` : null,
      row?.id ? `Ref:      ${row.id}` : null,
    ].filter(Boolean).join('\n')

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: replyTo,
        subject: `[Liten] ${subject}`,
        text: `${lines}\n\n${'-'.repeat(46)}\n\n${message}\n`,
        html:
          `<pre style="font:13px/1.6 ui-monospace,Menlo,monospace;color:#5a5248;margin:0 0 18px">${esc(lines)}</pre>` +
          `<hr style="border:none;border-top:1px solid #e9dec8;margin:0 0 18px">` +
          `<div style="font:16px/1.6 Georgia,serif;color:#2a241e;white-space:pre-wrap">${esc(message)}</div>`,
      }),
    }).catch(() => null)

    if (!res || !res.ok) {
      const detail = await res?.text().catch(() => '')
      console.error('[support] resend failed', res?.status, detail?.slice(0, 300))
      /* The row is written, so nothing the customer typed is lost — but
         they must not be told it arrived when it has not. */
      return NextResponse.json({ ...receipt, notification:'failed' })
    }

    return NextResponse.json(receipt)
  } catch (e: any) {
    if (e instanceof CaseError) return NextResponse.json({ ok:false, reason:e.message }, { status:e.status })
    console.error('[support] fatal:', e?.message || e)
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}

// Existing support rows are the case spine; never expose another customer's cases.
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ ok:false, reason:'auth_required' }, { status:401 })
  const { data, error } = await supabaseAdmin.from('support_messages')
    .select('id,user_id,reply_to,case_number,context,created_at,handled_at').eq('user_id', user.id)
    .order('created_at', { ascending:false }).limit(50)
  if (error) return NextResponse.json({ ok:false, reason:'case_unavailable' }, { status:503 })
  const cases=[]
  for(const original of (data||[]).filter(r=>r.context?.case?.version===1)) {
    let row=original
    if(row.context.case.authorized_remedy){
      const refreshed=await supabaseAdmin.rpc('refresh_make_it_right_case',{p_case:row.id,p_user:user.id})
      if(!refreshed.error&&refreshed.data)row=refreshed.data
      await sendRemedyCaseEmails(row).catch(()=>{})
    }
    cases.push(customerRemedyCase(row))
  }
  return NextResponse.json({ok:true,cases},{headers:{'Cache-Control':'no-store'}})
}

// Resume only the authenticated customer's durable case, including the approved
// better-photo action. No client-supplied decision, amount or purchase is accepted.
export async function PATCH(req:Request) {
  const user=await getUser()
  if(!user)return NextResponse.json({ok:false,reason:'auth_required'},{status:401})
  const body=await req.json().catch(()=>null)
  if(!/^[0-9a-f-]{36}$/i.test(body?.caseId||'')||!['resume','source_photo'].includes(body?.action))
    return NextResponse.json({ok:false,reason:'invalid_case'},{status:400})
  try {
    const row=await readRemedyCase(user.id,body.caseId)
    if(body.action==='source_photo'){
      if(row.context.case.authorized_remedy!=='source_photo')throw new Error('photo_not_authorized')
      const raw=String(body.source||'').replace(/^data:image\/(?:jpeg|png|webp);base64,/,'')
      if(raw.length>4000000||!raw||!/^[A-Za-z0-9+/=\r\n]+$/.test(raw))throw new Error('invalid_photo')
      const bytes=Buffer.from(raw,'base64'),meta=await sharp(bytes,{limitInputPixels:40000000}).metadata()
      if(!['jpeg','png','webp'].includes(meta.format||''))throw new Error('invalid_photo')
      const source=await readRemedySource(user.id,row.context.case.artwork)
      if(source?.sourceHash===hashRemedyIdentity(bytes.toString('base64')))throw new Error('better_photo_required')
      const result=await supabaseAdmin.rpc('start_make_it_right_redo',{p_case:row.id,p_user:user.id,p_source:bytes.toString('base64')})
      if(result.error)throw new Error('redo_unavailable')
    }
    return NextResponse.json(await caseReceipt(user,body.caseId))
  }catch{return NextResponse.json({ok:false,reason:'case_action_unavailable'},{status:409})}
}
