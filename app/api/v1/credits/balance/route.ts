// app/api/v1/credits/balance/route.ts
// GET → { balance, admin }. Owner = auth user id, else ?guest_key. Display-only.
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser }      from '@/lib/store/auth'

export const runtime = 'nodejs'

function svc() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(req: Request) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ balance: 0, admin: false })
    const url  = new URL(req.url)
    const user = await getUser().catch(() => null)
    const owner = user?.id || (url.searchParams.get('guest_key') || '').trim() || null
    if (!owner) return NextResponse.json({ balance: 0, admin: false })

    const { data: bal } = await db.from('credit_balances').select('balance').eq('owner_key', owner).maybeSingle()
    let admin = false
    const { data: reds } = await db.from('code_redemptions').select('code').eq('owner_key', owner)
    const codes = (reds || []).map((r: { code: string }) => r.code)
    if (codes.length) {
      const { data: ac } = await db.from('access_codes').select('code').eq('kind', 'admin').in('code', codes).limit(1)
      admin = Array.isArray(ac) && ac.length > 0
    }
    return NextResponse.json({ balance: bal?.balance ?? 0, admin })
  } catch {
    return NextResponse.json({ balance: 0, admin: false })
  }
}
