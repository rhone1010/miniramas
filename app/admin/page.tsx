// app/admin/page.tsx
//
// The control panel. Server component: it checks the admin cookie, pulls
// every tab's data in one parallel round trip, and hands it to the client
// shell for rendering.
//
// Auth reuses lib/admin/auth.ts — the same HMAC-signed cookie already
// guarding the bundle catalog. No second login to maintain.

import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin/auth'
import { getAll } from '@/lib/admin/panel-data'
import Panel from './panel'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  if (!(await isAdmin())) redirect('/admin/login')

  const params = await searchParams
  const days = [1, 7, 30, 365].includes(Number(params.days)) ? Number(params.days) : 7

  const data = await getAll(days)

  return <Panel data={data} days={days} env={process.env.PRODIGI_ENV || 'sandbox'} />
}
