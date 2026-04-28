// admin-auth-logout-route.ts
// app/api/admin/auth/logout/route.ts

import { NextResponse } from 'next/server'
import { clearAdminCookie } from '@/lib/admin/auth'

export async function POST() {
  await clearAdminCookie()
  return NextResponse.json({ ok: true })
}
