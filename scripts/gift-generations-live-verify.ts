// scripts/gift-generations-live-verify.ts
//
// ISOLATED LIVE VERIFICATION of the product-first generation contract against the real Supabase database and storage (migration 059 applied). Two throwaway auth users, real giftDeps (live store
// and storage), a stand-in photo analyzer (no paid vision), ONE real NB2.1 generation (the first); every other generation reuses that picture through a stand-in generator (no spend) so the
// ledger can be exercised to its limits. No order, Stripe, Prodigi or manufacturing call. Removes only what it created and proves the pre-existing sessions and orders are unchanged.
//
//   npx tsx --env-file=<env file> scripts/gift-generations-live-verify.ts <portrait photo.jpg>

import fs from 'node:fs'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { giftDeps, generateMasterInProcess } from '../lib/v1/gift/real'
import { supabaseAdmin as db } from '../lib/supabase'
import { createSession, getSessionView, restoreSession, setLines, startBatch, deleteSessionNow } from '../lib/v1/gift/service'
import { chooseEffect, startGeneration, acceptGeneration, listGenerations, getGeneration } from '../lib/v1/gift/generations'
import { liveEffectIds } from '../lib/v1/gift/effects'

const out: string[] = [], failures: string[] = []
const say = (...a: unknown[]) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); out.push(s); console.log(s) }
const ok = (c: boolean, w: string) => { say(c ? 'PASS' : 'FAIL', w); if (!c) failures.push(w) }
const code = (p: Promise<unknown>) => p.then(() => 'no_error', (e: any) => String(e?.code ?? e?.message ?? e))
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')

/** The one real picture cropped (centered) to the requested ratio, for the stand-in generations that must not spend. */
async function atAspect(b64: string, aspect: string): Promise<string> {
  const [a, b] = aspect.split(':').map(Number), buf = Buffer.from(b64, 'base64'), md = await sharp(buf).metadata(), W = md.width!, H = md.height!
  const w = W / H > a / b ? Math.round(H * a / b) : W, h = W / H > a / b ? H : Math.round(W * b / a)
  return (await sharp(buf).extract({ left: Math.floor((W - w) / 2), top: Math.floor((H - h) / 2), width: w, height: h }).png().toBuffer()).toString('base64')
}

async function legacySnapshot() {
  const s = (await db.from('gift_sessions').select('*').order('id')).data ?? []
  const b = (await db.from('gift_batches').select('*').order('id')).data ?? []
  const p = (await db.from('gift_preview_packs').select('*').order('id')).data ?? []
  const o = (await db.from('print_orders').select('id,status,paid_at,updated_at').order('id')).data ?? []
  return { sessions: s.length, json: JSON.stringify({ s, b, p, o }), flows: [...new Set(s.map((x: any) => x.flow))] }
}

async function main() {
  const photoPath = process.argv[2]; if (!photoPath) throw new Error('usage: <photo.jpg>')
  const photo = (await sharp(fs.readFileSync(photoPath)).rotate().jpeg().toBuffer()).toString('base64')
  const stamp = Date.now()
  const mkUser = async (n: string) => { const r = await db.auth.admin.createUser({ email: `fixture-gen-${n}-${stamp}@liten.invalid`, email_confirm: true, user_metadata: { fixture: 'cc-generation-verify' } }); if (r.error || !r.data.user) throw new Error('user ' + r.error?.message); return r.data.user.id }
  const A = await mkUser('a'), B = await mkUser('b'); say('fixture users', A.slice(0, 8), B.slice(0, 8))
  const before = await legacySnapshot(); say('legacy before', { sessions: before.sessions, flows: before.flows })
  ok(before.flows.every(f => f === 'previews'), 'every pre-existing session is flow previews (059 default)')
  const sessions: string[] = []; let realCalls = 0, standIn = 0
  let reuseImage: string | null = null
  const base = giftDeps()
  const deps: any = {
    ...base, analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null, subjectGender: 'unknown' }), kick: async () => { throw new Error('fixture_no_manufacturing') },
    generate: async (i: any) => {
      if (!reuseImage) { realCalls++; const r = await generateMasterInProcess(i); reuseImage = r.imageB64; return r }
      standIn++; if (failNext.v) { failNext.v = false; throw new Error('fixture_provider_failure') }
      return { imageB64: await atAspect(reuseImage, i.aspect), generation: { v: 1, series: 'portraits', effectId: i.effectId, aspect: i.aspect, attempts: 1, passed: true, quality: 'passed', reason: null, scores: null, postProcessing: { outpaint: false, skipped: null }, durationMs: 1 } }
    },
  }
  const failNext = { v: false }
  process.env.GIFT_NEW_SESSION_FLOW = 'generations'
  const effect = liveEffectIds('portraits')[0]
  const key = (n: string | number) => `live-${stamp}-${n}`
  try {
    // ── session creation in the new flow
    const v = await createSession(deps, { userId: A, imageB64: photo }); sessions.push(v.sessionId)
    ok(v.flow === 'generations' && v.generations?.allowance.next === 'blocked' && v.generations.allowance.blockedReason === 'effect_not_chosen' && v.batches.length === 0, 'live create: flow generations, no batches, allowance blocked until an effect is chosen')
    const row = (await db.from('gift_sessions').select('flow,user_id,series').eq('id', v.sessionId).single()).data!; ok(row.flow === 'generations' && row.user_id === A, 'database row: flow generations, owner A')
    ok(await code(startBatch(deps, A, v.sessionId, { idempotencyKey: 'live-legacy-key-1' })) === 'legacy_batches_closed', 'legacy six-preview batch refused for a generations session')
    const trig = await db.from('gift_batches').insert({ session_id: v.sessionId, user_id: A, batch_index: 9, kind: 'free', idempotency_key: 'live-trigger-test', effect_ids: ['a', 'b', 'c', 'd', 'e', 'f'] }); ok(!!trig.error && /legacy_batches_closed/.test(trig.error.message), 'the database trigger refuses a legacy batch even bypassing the service')
    ok(await code(startGeneration(deps, A, v.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key('pre') })) === 'effect_not_chosen', 'generation before an effect is refused')
    ok(await code(getSessionView(deps, B, v.sessionId)) === 'session_not_found' && await code(chooseEffect(deps, B, v.sessionId, effect)) === 'session_not_found', 'another account cannot read or use the session')

    // ── one effect, idempotent
    const c1 = await chooseEffect(deps, A, v.sessionId, effect), c2 = await chooseEffect(deps, A, v.sessionId, effect)
    ok(c1.generations!.anchorPreviewId === c2.generations!.anchorPreviewId && c1.generations!.effectId === effect && c1.artworkPreviewId === c1.generations!.anchorPreviewId, 'one effect chosen twice: the same anchor, artwork selected')
    ok((await db.from('gift_batches').select('id').eq('session_id', v.sessionId).eq('kind', 'generation')).data!.length === 1, 'exactly one anchor batch row')
    ok(await code(chooseEffect(deps, A, v.sessionId, 'not_an_effect')) === 'invalid_effect_selection', 'unknown effect refused')

    // ── the ONE real NB2.1 generation, 2:3 for a 12x18 Fine Art Print
    const t0 = Date.now()
    const g1 = await startGeneration(deps, A, v.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) }); const gen = g1.generation
    say('real generation', { seconds: Math.round((Date.now() - t0) / 1000), status: g1.status, w: gen.width, h: gen.height, conform: gen.conform, quality: gen.quality, kind: gen.kind })
    ok(g1.status === 'ok' && gen.status === 'ready' && realCalls === 1, 'real generation delivered (one model call)')
    ok(gen.width! * 3 === gen.height! * 2, 'delivered picture is exactly 2:3 (width x 3 = height x 2)')
    const dbRow = (await db.from('gift_generations').select('*').eq('id', gen.generationId).single()).data!
    ok(dbRow.status === 'ready' && dbRow.kind === 'free' && dbRow.sha256 === gen.sha256 && dbRow.width === gen.width && dbRow.generation?.conform && dbRow.generation?.quality, 'database row: ready, free, hash, size, quality and conform record')
    const file = await db.storage.from('previews').download(dbRow.master_path); const bytes = Buffer.from(await file.data!.arrayBuffer())
    ok(sha(bytes) === gen.sha256, 'the stored file hashes to the recorded sha256'); const md = await sharp(bytes).metadata(); ok(md.width === gen.width && md.height === gen.height && md.format === 'png', 'stored file is the PNG at the recorded size')
    const wm = await db.storage.from('previews').download(dbRow.preview_path); ok(!!wm.data && (await sharp(Buffer.from(await wm.data.arrayBuffer())).metadata()).format === 'jpeg', 'watermarked large preview stored')
    ok((await db.from('gift_free_grants').select('id').eq('generation_id', gen.generationId)).data!.length === 1, 'one free grant recorded in the ledger')
    ok((await db.from('gift_previews').select('status,master_path').eq('id', g1.session.generations!.anchorPreviewId!).single()).data!.status === 'ready', 'the artwork anchor is ready (approval SQL compatible)')
    ok(g1.session.generations!.allowance.freeUsed === 1 && g1.session.generations!.allowance.freeRemaining === 5, 'allowance: 1 of 6 used')

    // ── duplicates and reuse (no model call)
    const callsBefore = realCalls + standIn
    const d1 = await startGeneration(deps, A, v.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) }); ok(d1.reused && d1.generation.generationId === gen.generationId, 'same key: same generation, reused')
    const d2 = await startGeneration(deps, A, v.sessionId, { productId: 'canvas:16x24', idempotencyKey: key('other') }); ok(d2.reused && d2.generation.generationId === gen.generationId, 'another 2:3 product reuses it')
    const burst = await Promise.all([1, 2, 3].map(() => startGeneration(deps, A, v.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key(1) }))); ok(burst.every(r => r.generation.generationId === gen.generationId), 'three concurrent repeats: one generation')
    ok(realCalls + standIn === callsBefore && (await db.from('gift_generations').select('id').eq('session_id', v.sessionId)).data!.length === 1, 'no model call and no extra row for duplicates')

    // ── history, refresh, restoration, acceptance, cart binding
    const hist = await listGenerations(deps, A, v.sessionId); ok(hist.generations.length === 1 && hist.generations[0].url!.startsWith('https://') && hist.generations[0].sha256 === gen.sha256, 'history lists the generation with a signed large-preview URL')
    const rs = await restoreSession(deps, A); ok(rs.current?.sessionId === v.sessionId && rs.current.flow === 'generations' && rs.current.generations!.items.length === 1 && rs.current.generations!.effectId === effect, 'restoration returns flow, effect and history')
    ok(await code(setLines(deps, A, v.sessionId, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1, generationId: gen.generationId }])) === 'generation_not_accepted', 'a line cannot take a generation that is not accepted')
    const acc = await acceptGeneration(deps, A, v.sessionId, gen.generationId); ok(acc.generation.accepted && !!acc.generation.acceptedAt, 'accepted')
    ok((await acceptGeneration(deps, A, v.sessionId, gen.generationId)).generation.acceptedAt === acc.generation.acceptedAt, 'accept is idempotent')
    const cart = await setLines(deps, A, v.sessionId, [{ lineId: 'a', productId: 'fine_art:12x18', copies: 1, generationId: gen.generationId }])
    ok(cart.lines[0].generationId === gen.generationId, 'cart line bound to the accepted generation')
    const comp = (await db.from('gift_compositions').select('*').eq('session_id', v.sessionId)).data!; ok(comp.length === 1 && comp[0].status === 'approved' && comp[0].generation_id === gen.generationId && comp[0].composed_path === dbRow.master_path && comp[0].plan?.artworkSha256 === gen.sha256, 'composition row: approved, points at the generation file, pins its sha256')
    ok(await code(setLines(deps, A, v.sessionId, [{ lineId: 'a', productId: 'canvas:12x12', copies: 1, generationId: gen.generationId }])) === 'composition_geometry_mismatch', 'a 2:3 picture cannot be bound to a square product')

    // ── failure does not count; retry with the same key succeeds
    failNext.v = true
    const f = await startGeneration(deps, A, v.sessionId, { productId: 'canvas:12x12', idempotencyKey: key('sq') }); ok(f.generation.status === 'failed' && f.generation.retryable && f.session.generations!.allowance.freeUsed === 1, 'provider failure: failed, retryable, allowance unchanged (still 1)')
    ok((await db.from('gift_free_grants').select('id').eq('generation_id', f.generation.generationId)).data!.length === 0, 'the failed generation holds no free grant')
    const f2 = await startGeneration(deps, A, v.sessionId, { productId: 'canvas:12x12', idempotencyKey: key('sq') }); ok(f2.generation.generationId === f.generation.generationId && f2.generation.status === 'ready' && f2.session.generations!.allowance.freeUsed === 2, 'retry with the same key: same row, delivered, now counted (2)')

    // ── six free, then payment_required; a pack of six; then payment_required again
    for (let i = 3; i <= 6; i++) { const r = await startGeneration(deps, A, v.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key('n' + i), mode: 'new' }); ok(r.generation.kind === 'free' && r.generation.status === 'ready', `free generation ${i} delivered`) }
    const full = (await getSessionView(deps, A, v.sessionId)).generations!.allowance; ok(full.freeUsed === 6 && full.freeRemaining === 0 && full.next === 'payment_required' && full.freeBlockedReason === 'session_limit', 'allowance after six: payment_required, session_limit')
    ok(await code(startGeneration(deps, A, v.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key('n7'), mode: 'new' })) === 'payment_required', 'the seventh is refused: payment_required')
    ok((await db.from('gift_generations').select('id').eq('session_id', v.sessionId)).data!.length === 6, 'a refused request creates no row')
    const pack = await db.from('gift_preview_packs').insert({ user_id: A, stripe_session_id: `cs_test_fixture_${stamp}`, amount_cents: 299 }).select('id,units,status').single(); ok(pack.data?.units === 6 && pack.data.status === 'paid', 'fixture pack inserted: worth 6 generations (units default)')
    ok((await getSessionView(deps, A, v.sessionId)).generations!.allowance.next === 'paid', 'allowance now: paid (from the pack)')
    for (let i = 7; i <= 12; i++) { const r = await startGeneration(deps, A, v.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key('n' + i), mode: 'new' }); ok(r.generation.kind === 'paid' && r.generation.status === 'ready', `paid generation ${i - 6} of 6 delivered`) }
    ok((await db.from('gift_preview_packs').select('status').eq('id', pack.data!.id).single()).data!.status === 'consumed', 'the pack is consumed after six')
    ok(await code(startGeneration(deps, A, v.sessionId, { productId: 'fine_art:12x18', idempotencyKey: key('n13'), mode: 'new' })) === 'payment_required', 'after the pack: payment_required again')
    ok(realCalls === 1, `exactly one real model call was made in total (${realCalls}), ${standIn} stand-in generations`)

    // ── persistence across the "refresh": a fresh deps object reads the same truth
    const again = await getSessionView(giftDeps(), A, v.sessionId); ok(again.generations!.items.length === 12 && again.generations!.items.filter(x => x.accepted).length === 1 && again.lines[0].generationId === gen.generationId, 'a fresh read shows all 12 generations, the accepted one and the bound line')
    const gv = await getGeneration(deps, A, v.sessionId, gen.generationId); ok(gv.status === 'ready' && gv.sha256 === gen.sha256, 'single-generation read agrees')

    // ── account limits outlive deleting the project (the same photograph)
    await deleteSessionNow(deps, A, v.sessionId)
    ok((await db.from('gift_generations').select('id').eq('session_id', v.sessionId)).data!.length === 0 && (await db.from('gift_free_grants').select('id').eq('user_id', A)).data!.length === 6, 'deleting the session removes its generations; the six free grants stay in the ledger')
    const v2 = await createSession(deps, { userId: A, imageB64: photo }); sessions.push(v2.sessionId); await chooseEffect(deps, A, v2.sessionId, effect)
    const st = (await getSessionView(deps, A, v2.sessionId)).generations!.allowance; ok(!st.freeAvailable && st.freeBlockedReason === 'photo_limit', 'the same photograph in a new session is photo_limit: free generations cannot be reset by deleting the project')
  } catch (e: any) { say('ERROR', String(e?.stack ?? e).slice(0, 800)); failures.push('exception ' + e?.message) }
  finally {
    try {
      const allSess = (await db.from('gift_sessions').select('id').in('user_id', [A, B])).data ?? []
      for (const s of allSess) for (const d of ['', 'masters', 'previews', 'product-previews']) { const l = (await db.storage.from('previews').list(`gift/${s.id}${d ? '/' + d : ''}`, { limit: 200 })).data ?? []; const f = l.filter(x => x.id).map(x => `gift/${s.id}${d ? '/' + d : ''}/${x.name}`); if (f.length) await db.storage.from('previews').remove(f) }
      await db.from('gift_sessions').delete().in('user_id', [A, B])
      await db.from('gift_free_grants').delete().in('user_id', [A, B]); await db.from('gift_session_attempts').delete().in('user_id', [A, B]); await db.from('gift_preview_packs').delete().in('user_id', [A, B])
      const del: string[] = []; for (const u of [A, B]) { const r = await db.auth.admin.deleteUser(u); const g = await db.auth.admin.getUserById(u); del.push(r.error || g.data.user ? 'USER LEFT' : 'user deleted') }
      say('cleanup', del.join(', '))
      const left = { sessions: (await db.from('gift_sessions').select('id', { count: 'exact', head: true }).in('user_id', [A, B])).count, generations: (await db.from('gift_generations').select('id', { count: 'exact', head: true }).in('user_id', [A, B])).count, grants: (await db.from('gift_free_grants').select('id', { count: 'exact', head: true }).in('user_id', [A, B])).count, packs: (await db.from('gift_preview_packs').select('id', { count: 'exact', head: true }).in('user_id', [A, B])).count }
      ok(Object.values(left).every(x => x === 0), 'nothing of the fixture remains: ' + JSON.stringify(left))
    } catch (e: any) { say('CLEANUP ERROR', String(e?.message ?? e)); failures.push('cleanup ' + e?.message) }
  }
  const after = await legacySnapshot()
  ok(after.json === before.json && after.sessions === before.sessions, `all ${before.sessions} pre-existing sessions, their batches, every pack and every print order are byte-identical before and after`)
  say(failures.length ? 'FAILED: ' + failures.join('; ') : 'ALL LIVE GENERATION CHECKS PASSED')
  process.exit(failures.length ? 1 : 0)
}
main()
