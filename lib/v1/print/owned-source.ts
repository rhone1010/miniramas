import sharp from 'sharp'
import { artworkFormat } from './geometry'
import { supabaseAdmin } from '@/lib/supabase'
import { fetchCleanOriginal, PREVIEW_BUCKET } from '@/lib/store/preview'

export async function ownedPrintSource(userId: string, previewId: string, db = supabaseAdmin) {
  if (!/^[0-9a-f-]{36}$/i.test(previewId)) throw new Error('artwork_not_found')
  const {data:ledger,error}=await db.from('preview_ledger').select('id,email,storage_path,unlocked_at').eq('id',previewId).maybeSingle()
  if(error||!ledger?.unlocked_at||!ledger.storage_path)throw new Error('owned_artwork_required')
  const match=/^portfolio:([0-9a-f-]{36}):(\d+)$/i.exec(ledger.email||'')
  if(!match)throw new Error('portfolio_artwork_required')
  const {data:portfolio,error:pfError}=await db.from('portfolios').select('id,series').eq('id',match[1]).eq('user_id',userId).maybeSingle()
  const {data:item,error:itemError}=await db.from('portfolio_items').select('preview_id,preset,status').eq('portfolio_id',match[1]).eq('preview_id',previewId).eq('slot',Number(match[2])).maybeSingle()
  if(pfError||itemError||!portfolio||item?.status!=='done')throw new Error('owned_artwork_required')
  if(!['portraits','pets'].includes(portfolio.series))throw new Error('square_artwork_required')
  const b64=await fetchCleanOriginal(db,ledger.storage_path)
  if(!b64)throw new Error('clean_original_unavailable')
  const bytes=Buffer.from(b64,'base64'),md=await sharp(bytes).metadata()
  if(!md.width||!md.height||!artworkFormat(md.width,md.height))throw new Error('compatible_artwork_required')
  return {previewId,portfolioId:portfolio.id,series:portfolio.series,preset:item.preset,storagePath:ledger.storage_path,bytes,width:md.width,height:md.height}
}

export async function ownedPrintPreview(userId: string, previewId: string) {
  const source=await ownedPrintSource(userId,previewId)
  const {data,error}=await supabaseAdmin.storage.from(PREVIEW_BUCKET).createSignedUrl(source.storagePath,3600)
  if(error||!data?.signedUrl)throw new Error('clean_original_unavailable')
  return {id:source.previewId,serverId:source.previewId,series:source.series,name:source.preset,art:data.signedUrl,width:source.width,height:source.height,format:artworkFormat(source.width,source.height),printTestVerified:true}
}

export function requireSandboxPrint() {
  if(process.env.VERCEL_ENV!=='preview')throw new Error('preview_only')
  if((process.env.PRODIGI_ENV||'sandbox').toLowerCase()!=='sandbox')throw new Error('prodigi_sandbox_required')
  if(!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw new Error('stripe_test_mode_required')
}

export async function ownedSquareSource(userId:string,previewId:string,db=supabaseAdmin){const source=await ownedPrintSource(userId,previewId,db);if(source.width!==source.height)throw new Error('square_artwork_required');return source}
export async function ownedSquarePreview(userId:string,previewId:string){await ownedSquareSource(userId,previewId);return ownedPrintPreview(userId,previewId)}
