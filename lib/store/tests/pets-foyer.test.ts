import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
import { NextRequest } from 'next/server'
import { PETS_35 } from '@/lib/v1/pets/pets-catalog-35'
import { signIntake, sha256Hex } from '@/lib/v1/foyer/foyer-identity'

const h = vi.hoisted(() => ({ user: vi.fn(), analyze: vi.fn(), render: vi.fn(), claim: vi.fn(), finish: vi.fn() }))
vi.mock('@/lib/store/auth', () => ({ getUser: h.user }))
vi.mock('@/lib/v1/pets/pets-refine', () => ({ analyzePetSourceSet: h.analyze }))
vi.mock('@/lib/v1/foyer/foyer-source', () => ({ decodeSource: async () => ({ b64: 'source', bytes: Buffer.from('source') }), foyerDb: () => ({}) }))
vi.mock('@/lib/v1/foyer/foyer-allowance', () => ({ claimIntake: async () => 'ok', claimReveal: h.claim, finalizeReveal: h.finish, revealAvailable: async () => true }))
vi.mock('@/lib/v1/foyer/foyer-preview-bypass', () => ({ previewAllowanceBypass: () => false, previewIntakeCapBypass: () => false }))
vi.mock('@/lib/v1/pets/pets-foyer-render', () => ({ renderPetsFoyerReveal: h.render }))
import { POST as intake } from '@/app/api/v1/pets/foyer/intake/route'
import { POST as reveal } from '@/app/api/v1/pets/foyer/reveal/route'

const secret = 'pets-foyer-test-secret-12345678901234567890'
const ids = 'action_figure art_nouveau bronze clockwork cubism designer_vinyl driftwood_resin elizabethan impressionist iron jade mosaic_portrait neon oil_impasto pencil_sketch persian_court plushy porcelain quilted retro_robot samurai sea_glass sheet_music polished_gold origami stained_glass'.split(' ')
const request = (body: object) => new NextRequest('https://preview.test/api/v1/pets/foyer/reveal', { method: 'POST', body: JSON.stringify(body) })
const page = fs.readFileSync('public/pets-foyer.html', 'utf8')
const reference = fs.readFileSync('public/foyer.html', 'utf8')

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('FOYER_HMAC_SECRET', secret)
  vi.stubEnv('OPENAI_API_KEY', 'test')
  vi.stubEnv('REPLICATE_API_TOKEN', 'test')
  h.user.mockResolvedValue({ id: 'customer' })
  h.analyze.mockResolvedValue({ ok: true })
  h.claim.mockResolvedValue({ kind: 'ok', id: 'claim' })
  h.render.mockResolvedValue({ imageDataUrl: 'data:image/jpeg;base64,marked', label: 'Pets', presetId: 'plushy', promptChars: 100, timing: { nb2Ms: 1, markMs: 1, styleRefs: 0 } })
})

describe('approved Pets Foyer port', () => {
  it('maps exactly the approved 26 slots to unchanged Pets preview paths', () => {
    const data = {} as { PETS_FOYER_SLOTS: Record<string, string>; FLIPS: string[][]; IMG: (slot: string) => string }
    vm.runInNewContext(fs.readFileSync('public/pets-foyer-DATA.js', 'utf8'), data)
    expect(Object.values(data.PETS_FOYER_SLOTS)).toEqual(ids)
    expect(data.FLIPS).toHaveLength(26)
    expect(data.PETS_FOYER_SLOTS.flip_18).toBeUndefined()
    for (const [slot, id] of Object.entries(data.PETS_FOYER_SLOTS)) {
      expect(data.IMG(slot)).toBe(`/previews/pets/pets_${id}.jpg`)
      expect(fs.existsSync(`public${data.IMG(slot)}`)).toBe(true)
      expect(PETS_35[id as string]).toBeDefined()
    }
  })
  it('copies presentation and all animation/reveal sequencing bytes', () => {
    expect(page.match(/<style>[\s\S]*?<\/style>/)?.[0]).toBe(reference.match(/<style>[\s\S]*?<\/style>/)?.[0])
    for (const [start, end] of [
      ['var PHOTO_BEAT', '/* montage bg'],
      ['function begin(src)', '/* ── PRODUCTION: THE REAL REVEAL'],
      ['/* STATE 4: one result,', '/* PORTED VERBATIM from public/portraits.html:6414-6467'],
    ]) expect(page).toContain(reference.slice(reference.indexOf(start), reference.indexOf(end)))
    for (const match of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) expect(() => new vm.Script(match[1])).not.toThrow()
    expect(page).toContain("location.href='/pets/discovery'")
    expect(page).not.toContain("p = '/previews/foyer-flip-male/'")
  })
  it('requires the existing Pets authentication before analysis or generation', async () => {
    h.user.mockResolvedValue(null)
    expect((await intake(request({ image_b64: 'source' }))).status).toBe(401)
    expect((await reveal(request({ image_b64: 'source' }))).status).toBe(401)
    expect(h.analyze).not.toHaveBeenCalled()
    expect(h.render).not.toHaveBeenCalled()
  })
  it('rejects human intake tokens and tokens from another customer', async () => {
    for (const key of [secret, secret + ':pets:someone-else']) {
      const token = signIntake(key, { sha: sha256Hex(Buffer.from('source')), subject: null, ageGroup: null, exp: Date.now() + 60000 })
      expect((await reveal(request({ image_b64: 'source', intake: token }))).status).toBe(403)
    }
    expect(h.render).not.toHaveBeenCalled()
  })
  it('uses authenticated Pets analysis, then real reveal adapter and successful allowance finalization', async () => {
    const accepted = await (await intake(request({ image_b64: 'source' }))).json()
    expect(accepted.status).toBe('ok')
    expect(h.analyze).toHaveBeenCalledWith({ sourceImageB64: 'source', additionalImagesB64: [], openaiApiKey: 'test' })
    const response = await reveal(request({ image_b64: 'source', intake: accepted.intake }))
    expect(response.status).toBe(200)
    expect(ids).toContain(h.render.mock.calls[0][0].effectId)
    expect(h.finish).toHaveBeenCalledWith({}, 'claim', true)
  })
  it('releases allowance on generation failure without substituting artwork', async () => {
    const accepted = await (await intake(request({ image_b64: 'source' }))).json()
    h.render.mockRejectedValue(new Error('generation failed'))
    expect((await reveal(request({ image_b64: 'source', intake: accepted.intake }))).status).toBe(502)
    expect(h.finish).toHaveBeenCalledWith({}, 'claim', false)
  })
})
