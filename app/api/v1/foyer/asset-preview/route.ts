import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { buildAssetPreview } from '@/lib/foyer/asset-preview'
import pets from '@/public/foyers/pets/manifest.next.json'
import groups from '@/public/foyers/groups/manifest.next.json'
import halloween from '@/public/foyers/halloween/manifest.next.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const manifests = { pets, groups, halloween }

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== 'preview') return new Response(null, { status: 404 })
  const category = new URL(request.url).searchParams.get('category') || 'pets'
  if (!Object.hasOwn(manifests, category)) return new Response('Unknown asset category', { status: 404 })
  try {
    const reference = await readFile(path.join(process.cwd(), 'public/foyer.html'), 'utf8')
    const html = buildAssetPreview(reference, manifests[category as keyof typeof manifests])
    return new Response(html, { headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': "connect-src 'none'; form-action 'none'; object-src 'none'; base-uri 'none'",
    } })
  } catch {
    return new Response('Foyer asset review could not load its reference or manifest.', { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
