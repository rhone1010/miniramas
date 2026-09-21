import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { buildAssetPreview } from '@/lib/foyer/asset-preview'
import { GET } from '@/app/api/v1/foyer/asset-preview/route'
import pets from '@/public/foyers/pets/manifest.next.json'
import groups from '@/public/foyers/groups/manifest.next.json'
import halloween from '@/public/foyers/halloween/manifest.next.json'

const reference = readFileSync('public/foyer.html', 'utf8')
const html = buildAssetPreview(reference, pets)
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'))
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

describe('isolated Foyer asset review', () => {
  it.each(['production', 'development', ''])('is absent in %s', async env => {
    vi.stubEnv('VERCEL_ENV', env)
    expect((await GET(new Request('https://example.test/api/v1/foyer/asset-preview'))).status).toBe(404)
  })
  it('serves only an allowed Preview category and blocks API connections', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    const response = await GET(new Request('https://example.test/api/v1/foyer/asset-preview?category=pets'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Security-Policy')).toContain("connect-src 'none'")
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect((await GET(new Request('https://example.test/api/v1/foyer/asset-preview?category=constructor'))).status).toBe(404)
  })
  it.each([pets, groups, halloween])('preserves reference shell and animation for $category', manifest => {
    const page = buildAssetPreview(reference, manifest)
    const shell = reference.slice(0, reference.indexOf('<script src="foyer-DATA.js"></script>'))
    expect(page.startsWith(shell)).toBe(true)
    for (const [start, end] of [
      ['var PHOTO_BEAT', '/* montage bg'],
      ['function begin(src)', '/* ── PRODUCTION: THE REAL REVEAL'],
      ['/* STATE 4: one result,', '/* PORTED VERBATIM from public/portraits.html:6414-6467'],
    ]) {
      expect(page).toContain(reference.slice(reference.indexOf(start), reference.indexOf(end)))
    }
    expect(manifest.transformations).toHaveLength(26)
    expect(page).toContain("var FAN = ['flip_23','flip_26','flip_24','flip_13','flip_06','flip_16'];")
    expect(page).toContain("var MOSAIC_MORE = ['flip_17','flip_11'];")
  })
  it('has no intake, generation, handoff, session or checkout execution', () => {
    expect(() => new Function(script)).not.toThrow()
    expect(script).not.toMatch(/fetch\(|foyerPost\(|LitenHandoff|localStorage|sessionStorage|document\.cookie|location\.href|FileReader/)
    expect(html).not.toContain('src="/foyer-handoff.js"')
    expect(script).not.toMatch(/['"]\/previews\/foyer-flip\//)
  })
  it('rejects slot reordering rather than changing reference behavior', () => {
    expect(() => buildAssetPreview(reference, { ...pets, transformations: pets.transformations.slice().reverse() })).toThrow()
  })

  function browser(assetError?: string, mobile = false) {
    const requests: string[] = []
    const dom = new JSDOM(html.slice(0, html.lastIndexOf('<script>')), {
      url: 'https://preview.test/api/v1/foyer/asset-preview?category=pets', runScripts: 'outside-only',
    })
    const w = dom.window as any
    w.matchMedia = () => ({ matches: mobile })
    w.requestAnimationFrame = (callback: () => void) => w.setTimeout(callback, 16)
    w.HTMLDialogElement.prototype.showModal = function(){ this.open = true }
    w.HTMLDialogElement.prototype.close = function(){ this.open = false }
    w.Image = class {
      naturalWidth = 800; naturalHeight = 1192
      onload?: () => void; onerror?: () => void
      set src(value: string) {
        requests.push(value)
        Promise.resolve().then(() => value.endsWith(assetError || 'never-match') ? this.onerror?.() : this.onload?.())
      }
      decode(){ return Promise.resolve() }
    }
    w.eval(script)
    return { dom, w, requests }
  }
  it('reports a missing slot and prevents a partial or substituted experience', async () => {
    const b = browser('flip_07.jpg')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(b.w.document.getElementById('assetReviewErrors').textContent).toContain('flip_07.jpg: missing or unreadable')
    expect(b.w.document.getElementById('assetReviewStart').disabled).toBe(true)
    expect(b.requests).toHaveLength(27)
    expect(b.requests.every((p: string) => p.startsWith('/foyers/pets/'))).toBe(true)
    b.dom.window.close()
  })
  it('probes delivered files even while staged manifest availability remains false', async () => {
    const b = browser()
    await new Promise(resolve => setTimeout(resolve, 0))
    const select = b.w.document.getElementById('assetReviewResult')
    select.value = 'flip_01'; select.dispatchEvent(new b.w.Event('change'))
    expect(b.w.document.getElementById('assetReviewStatus').textContent).toContain('27 / 27')
    expect(b.w.document.getElementById('assetReviewStart').disabled).toBe(false)
    b.w.document.getElementById('assetReviewStart').click()
    expect(b.w.document.querySelectorAll('.montage .tile')).toHaveLength(6)
    expect(b.requests.every((p: string) => p.startsWith('/foyers/pets/'))).toBe(true)
    b.dom.window.close()
  })
  it.each([false, true])('runs the supplied deck into the reference fan/grid (mobile=%s), without navigation', async mobile => {
    vi.useFakeTimers()
    const b = browser(undefined, mobile)
    await vi.advanceTimersByTimeAsync(0)
    const select = b.w.document.getElementById('assetReviewResult')
    select.value = 'flip_03'; select.dispatchEvent(new b.w.Event('change'))
    b.w.document.getElementById('assetReviewStart').click()
    b.w.document.getElementById('empty').click()
    await vi.advanceTimersByTimeAsync(600)
    expect(b.w.document.querySelectorAll('#front .flip')).toHaveLength(26)
    await vi.advanceTimersByTimeAsync(13_000)
    expect(b.w.document.querySelector('#back img').getAttribute('src')).toBe('/foyers/pets/flip_03.jpg')
    expect(b.w.document.querySelectorAll(mobile ? '#mgrid .gc' : '.fc')).toHaveLength(mobile ? 8 : 6)
    expect(b.requests.every((p: string) => p.startsWith('/foyers/pets/'))).toBe(true)
    b.w.document.getElementById('go').click()
    expect(b.w.document.getElementById('assetReview').open).toBe(true)
    expect(b.w.location.pathname).toBe('/api/v1/foyer/asset-preview')
    b.dom.window.close()
  })
})
