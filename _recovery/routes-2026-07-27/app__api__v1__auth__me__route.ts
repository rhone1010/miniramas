// auth-me-route.ts
// app/api/v1/auth/me/route.ts
//
// Lightweight signed-in check for client components.

import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ user: null }, { status: 401 })
  return NextResponse.json({ user })
}
