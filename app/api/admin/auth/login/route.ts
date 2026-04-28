// admin-auth-login-route.ts
// app/api/admin/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { checkPassword, setAdminCookie } from '@/lib/admin/auth'

export async function POST(req: NextRequest) {
  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const password = typeof body?.password === 'string' ? body.password : ''
  if (!password) {
    return NextResponse.json({ error: 'missing_password' }, { status: 400 })
  }

  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 500))
    return NextResponse.json({ error: 'invalid_password' }, { status: 401 })
  }

  await setAdminCookie()
  return NextResponse.json({ ok: true })
}
