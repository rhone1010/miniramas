import { beforeEach, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ detect: vi.fn(), routing: vi.fn(), sign: vi.fn(), claim: vi.fn() }))
vi.mock('@/lib/shared/upload-routing', () => ({ analyzeUploadRouting: h.routing }))
vi.mock('@/lib/v1/portraits/portraits-refine', () => ({ detectFaceVisibility: h.detect }))
vi.mock('@/lib/v1/foyer/foyer-source', () => ({
  decodeSource: async (b64: string) => ({ b64, bytes: Buffer.from(b64, 'base64') }), foyerDb: () => ({}),
}))
vi.mock('@/lib/v1/foyer/foyer-identity', () => ({
  foyerSecret: () => 'test-secret', ipIdentity: () => 'ip', deviceMarker: () => 'device',
  sha256Hex: () => 'source-hash', signIntake: h.sign,
}))
vi.mock('@/lib/v1/foyer/foyer-allowance', () => ({ claimIntake: h.claim }))
vi.mock('@/lib/v1/foyer/foyer-preview-bypass', () => ({ previewIntakeCapBypass: () => false }))
import { POST } from '@/app/api/v1/foyer/intake/route'

beforeEach(() => {
  vi.clearAllMocks()
  h.claim.mockResolvedValue('ok')
  h.sign.mockReturnValue('signed-intake')
  h.detect.mockResolvedValue({ gender: null, age_group: 'child', face_visible: true })
  h.routing.mockResolvedValue({ decisions: { portraits: { redirectSeries: 'pets' } } })
})
const request = () => new Request('https://example.test/api/v1/foyer/intake', {
  method: 'POST', body: JSON.stringify({ image_b64: 'YWJj' }),
}) as Parameters<typeof POST>[0]

it('offers the existing Pets handoff without applying human age detection to a confidently identified kitten', async () => {
  const response = await POST(request())
  const result = await response.json()
  expect(response.status).toBe(200)
  expect(result).toMatchObject({ status: 'ok', age_group: null, gender: null, intake: 'signed-intake', routing: { decisions: { portraits: { redirectSeries: 'pets' } } } })
  expect(h.routing).toHaveBeenCalledExactlyOnceWith('YWJj')
  expect(h.detect).not.toHaveBeenCalled()
  expect(h.sign).toHaveBeenCalledWith('test-secret', expect.objectContaining({ sha: 'source-hash', subject: null, ageGroup: null }))
})
it.each(['child', 'teen'])('continues refusing a human %s', async age => {
  h.routing.mockResolvedValue({ decisions: { portraits: { redirectSeries: null } } })
  h.detect.mockResolvedValue({ gender: 'f', age_group: age, face_visible: true })
  const response = await POST(request())
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ status: 'refused', code: 'age_restricted' })
  expect(h.sign).not.toHaveBeenCalled()
})
it.each([null, { decisions: { portraits: { redirectSeries: null } } }])('retains human checks when routing is absent or uncertain: %j', async routing => {
  h.routing.mockResolvedValue(routing)
  expect((await POST(request())).status).toBe(403)
  expect(h.detect).toHaveBeenCalledTimes(1)
})
it('preserves the adult Portraits verdict', async () => {
  h.routing.mockResolvedValue({ decisions: { portraits: { redirectSeries: null } } })
  h.detect.mockResolvedValue({ gender: 'm', age_group: 'adult', face_visible: true })
  const result = await (await POST(request())).json()
  expect(result).toMatchObject({ status: 'ok', subject: 'man', gender: 'm', age_group: 'adult', intake: 'signed-intake' })
})
