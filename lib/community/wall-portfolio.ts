import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchCleanOriginal } from '@/lib/store/preview'

// Bridge an authenticated owner's unlocked portfolio item into the existing wall.
// Using the preview ID as the piece ID preserves the database's once-per-piece rule.
export async function wallPortfolioPiece(db: SupabaseClient, owner: string, previewId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(previewId)) return null
  const ledger = await db.from('preview_ledger')
    .select('id,email,storage_path,unlocked_at').eq('id', previewId).maybeSingle()
  if (ledger.error) throw new Error('ledger_unavailable')
  if (!ledger.data?.unlocked_at || !ledger.data.storage_path) return null
  const origin = /^portfolio:([0-9a-f-]{36}):(\d+)$/i.exec(ledger.data.email || '')
  if (!origin) return null
  const portfolio = await db.from('portfolios').select('id,series')
    .eq('id', origin[1]).eq('user_id', owner).maybeSingle()
  if (portfolio.error) throw new Error('portfolio_unavailable')
  if (!portfolio.data || !['groups', 'portraits', 'pets'].includes(portfolio.data.series)) return null
  const item = await db.from('portfolio_items').select('preview_id,preset,status')
    .eq('portfolio_id', origin[1]).eq('slot', Number(origin[2])).eq('preview_id', previewId).maybeSingle()
  if (item.error) throw new Error('item_unavailable')
  if (item.data?.status !== 'done') return null

  const columns = 'id,owner_key,series,preset,image_path,archived,meta'
  const existing = await db.from('collection_pieces').select(columns).eq('id', previewId).maybeSingle()
  if (existing.error) throw new Error('piece_unavailable')
  const belongs = (piece: { owner_key: string; meta?: { community_preview_id?: string } } | null) =>
    !!piece && piece.owner_key === owner && piece.meta?.community_preview_id === previewId
  if (existing.data) return belongs(existing.data) ? existing.data : null

  const original = await fetchCleanOriginal(db, ledger.data.storage_path)
  if (!original) throw new Error('original_unavailable')
  const imagePath = `${owner}/${previewId}.png`
  const uploaded = await db.storage.from('collection').upload(imagePath, Buffer.from(original, 'base64'), {
    contentType: 'image/png', upsert: true,
  })
  if (uploaded.error) throw new Error('upload_failed')
  const inserted = await db.from('collection_pieces').insert({
    id: previewId, owner_key: owner, user_id: owner, series: portfolio.data.series,
    preset: item.data.preset, image_path: imagePath, product_path: 'discovery',
    meta: { community_preview_id: previewId },
  })
  if (inserted.error && inserted.error.code !== '23505') throw new Error('insert_failed')
  const resolved = await db.from('collection_pieces').select(columns).eq('id', previewId).maybeSingle()
  if (resolved.error) throw new Error('piece_unavailable')
  return belongs(resolved.data) ? resolved.data : null
}
