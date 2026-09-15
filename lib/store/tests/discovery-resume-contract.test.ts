// lib/store/tests/discovery-resume-contract.test.ts
//
// The resume contract: Discovery state survives a magic-link authentication
// round trip. The source photo goes to IndexedDB (never localStorage); the
// small state goes to localStorage. On return the customer sees the same
// photo, selections, subject, bench, override and target they left with.
//
// Also: guest Change Photo runs through foyer/intake, clears the manual
// override, and sets SUBJECT from the intake's answer.
//
// THE PHOTO GUARD (Rich, 2026-09-15): a resumed Discovery may come back
// without its source photograph, but it must not enter Review or go toward
// checkout until a VALID photograph is restored or newly uploaded. A
// restored photograph is valid only if it decodes as an image; missing,
// empty, malformed, non-image, corrupt and unreadable are all "no photo".
//
// These run the SHIPPED saveResume, restoreResume, clearResume, acceptPhoto,
// takeNewPhoto, applyDetection, subjectFromPhoto, validSourcePhoto,
// requirePhoto, requestReview and startCheckout, cut out of the page by
// name. Only the DOM, the network and IndexedDB are stubs -- and the
// browser's image decoder, which here is sharp decoding the same bytes
// (Image.onload once the header reads, decode() once every pixel does).

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import sharp from 'sharp'

const HTML = readFileSync(
  path.join(process.cwd(), 'public', 'discovery-consolidated-draft.html'), 'utf8',
).replace(/\r\n/g, '\n')

// ── function extraction (same pattern as post-purchase-discovery.test.ts) ──

function matchBrace(src: string, open: number): number {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const c = src[i], n = src[i + 1]
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 1; continue }
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++
      continue
    }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i }
  }
  throw new Error('unbalanced braces from ' + open)
}
function fn(name: string): string {
  // Some functions are indented (inside an IIFE or block); try both
  const re = new RegExp('\\n[ \\t]*function ' + name + '\\(')
  const m = re.exec(HTML)
  if (!m) throw new Error('function not found in page: ' + name)
  const at = m.index
  const fnStart = HTML.indexOf('function ' + name, at)
  return HTML.slice(fnStart, matchBrace(HTML, HTML.indexOf('{', fnStart)) + 1)
}

// ── fake localStorage ──

function fakeLocalStorage() {
  const store: Record<string, string> = {}
  return {
    getItem(k: string) { return store[k] ?? null },
    setItem(k: string, v: string) { store[k] = v },
    removeItem(k: string) { delete store[k] },
    _store: store,
  }
}

// ── fake LitenHandoff (IndexedDB stub) ──

function fakeLitenHandoff() {
  const blobs: Record<string, string> = {}
  return {
    putPhoto(key: string, dataUrl: string) { blobs['resume:' + key] = dataUrl; return Promise.resolve() },
    getPhoto(key: string) { return Promise.resolve(blobs['resume:' + key] || null) },
    dropPhoto(key: string) { delete blobs['resume:' + key]; return Promise.resolve() },
    _blobs: blobs,
  }
}

// ── the browser's image decoder, played by sharp on the same bytes ──

class DecodingImage {
  onload: null | (() => void) = null
  onerror: null | (() => void) = null
  naturalWidth = 0
  naturalHeight = 0
  private bytes: Buffer = Buffer.alloc(0)
  set src(url: string) {
    this.bytes = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
    sharp(this.bytes).metadata()
      .then((m) => {
        if (!m.width || !m.height) throw new Error('no dimensions')
        this.naturalWidth = m.width; this.naturalHeight = m.height
        this.onload && this.onload()
      })
      .catch(() => { this.onerror && this.onerror() })
  }
  decode() { return sharp(this.bytes).raw().toBuffer().then(() => undefined) }
}

// ── photographs: real images, and the ways a stored one can be bad ──

const JPEG_URL = (b: Buffer) => 'data:image/jpeg;base64,' + b.toString('base64')
let VALID = '', VALID_2 = ''
// what no decoder accepts
const BAD: Record<string, string | null> = {}
// what a browser's decoder DOES accept -- Chrome draws a JPEG cut short with
// the rest grey -- and only the saved fingerprint (photoPrint) catches
const CUT: Record<string, string> = {}
beforeAll(async () => {
  const a = await sharp({ create: { width: 24, height: 32, channels: 3, background: '#8a6a4a' } }).jpeg().toBuffer()
  const b = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#4a6a8a' } }).jpeg().toBuffer()
  VALID = JPEG_URL(a); VALID_2 = JPEG_URL(b)
  BAD.missing = null
  BAD.emptyBlob = 'data:'                                            // FileReader on a zero-byte, untyped Blob
  BAD.emptyPayload = 'data:image/jpeg;base64,'                       // a typed Blob with no bytes
  BAD.malformed = 'data:image/jpeg;base64,@@not base64@@'
  BAD.notAnImageType = 'data:text/plain;base64,' + Buffer.from('hello').toString('base64')
  BAD.corrupt = JPEG_URL(Buffer.from('these bytes are not a photograph at all'))
  CUT.truncated = JPEG_URL(a.subarray(0, Math.floor(a.length / 2)))   // a half-written store
  CUT.headerOnly = JPEG_URL(a.subarray(0, Math.floor(a.length / 4)))
  const p = VALID.indexOf(',') + 1 + 200                              // same length, 8 base64 chars changed mid-image
  const was = VALID.slice(p, p + 8)
  CUT.sameLength = VALID.slice(0, p) + was.replace(/./g, (c) => (c === 'A' ? 'B' : 'A')) + VALID.slice(p + 8)
})

// ── build the sandbox ──

type Sandbox = ReturnType<typeof build>

function build(opts?: {
  me?: { id: string; email: string } | null
  selected?: Array<{ key: string; baseId: string; name: string; siloName: string }>
  subject?: string
  subjectForced?: boolean
  subjectDetected?: string | null
  analyze?: { subject: string | null; gender: string | null; age_group: string | null } | null
  pose?: string
  aspect?: string
  bench?: string[]
  page?: number
  photo?: string | null
  pendingReview?: boolean
  fetchResponse?: (url: string, init: any) => Promise<any>
}) {
  const o = opts || {}
  const ls = fakeLocalStorage()
  const handoff = fakeLitenHandoff()
  const log: string[] = []
  const fetchLog: string[] = []
  const btnCraft = { disabled: false, textContent: 'Craft My Collection', classList: { add() {}, remove() {} } }

  const env: Record<string, unknown> = {
    // globals
    localStorage: ls,
    window: { LitenHandoff: handoff, indexedDB: {}, __ageCheck: null, location: { origin: 'https://discovery.test', pathname: '/discovery' } },
    LitenHandoff: handoff,
    console: { log() {}, warn() {}, error() {} },
    Date: { now: () => Date.now() },
    Promise: Promise,
    Image: DecodingImage,

    // auth
    ME: o.me ?? null,

    // state
    SELECTED: (o.selected || []).slice(),
    SUBJECT: o.subject || 'man',
    SUBJECT_FORCED: o.subjectForced || false,
    SUBJECT_DETECTED: o.subjectDetected ?? null,
    ANALYZE_RESULT: o.analyze || null,
    ANALYZE_SEQ: 0,
    CURATED: { bench: (o.bench || []).slice(), page: o.page || 0 },
    POSE: o.pose || 'as_photographed',
    ASPECT: o.aspect || 'portrait',
    uploadedPhotoDataUrl: o.photo || null,
    PENDING_REVIEW: o.pendingReview || false,
    PENDING_CRAFT: false,
    SRC_B64: null,
    SRC_MIME: null,
    SESSION_ID: null,
    SOURCE_ASSET_ID: null,
    TARGET_PICK: 0,

    // constants
    VALID_SIZES: [1, 4, 8, 16],
    SIZE_PRICE: { 1: 2.99, 4: 4.99, 8: 7.99, 16: 12.99 },
    RESUME_KEY: 'liten_resume_v1',
    RESUME_MAX_MS: 2 * 60 * 60 * 1000,
    RESUME_AWAITS_PHOTO: false,
    CURATED_UNIVERSE: [
      'reclaimed_bronze', 'retro_robot', 'stained_glass', 'plushy', 'ice', 'impressionist', 'art_deco',
      'stone', 'petal_sculpture', 'renaissance', 'victorian', 'wild_west', 'neon', 'oil_impasto',
      'balloon_face', 'sheet_music', 'origami', 'linocut', 'art_nouveau', 'crystallized', 'deco_twenties',
      'elizabethan', 'iron', 'cast_glass', 'quilted', 'porcelain', 'sand_form',
    ],
    SILOS: [{ name: 'Test', id: 'test', effects: [
      'reclaimed_bronze', 'retro_robot', 'stained_glass', 'plushy', 'ice', 'impressionist', 'art_deco',
      'stone', 'petal_sculpture', 'renaissance', 'victorian', 'wild_west', 'neon', 'oil_impasto',
      'balloon_face', 'sheet_music', 'origami', 'linocut', 'art_nouveau', 'crystallized', 'deco_twenties',
      'elizabethan', 'iron', 'cast_glass', 'quilted', 'porcelain', 'sand_form',
    ].map((id) => ({ id, label: id, hasVariant: false })) }],

    // network -- every request is logged, so "no checkout request" is provable
    fetch: async (url: string, init: any) => {
      fetchLog.push(url)
      return o.fetchResponse ? o.fetchResponse(url, init) : { ok: true, json: async () => ({}) }
    },

    // DOM stubs (all no-ops; we only test state)
    document: {
      querySelector: () => null,
      getElementById: (id: string) => (id === 'btnCraft' ? btnCraft : null),
      addEventListener: () => {},
      createElement: () => ({ style: {} }),
      body: { appendChild: () => {} },
    },
    setTimeout: (f: () => void) => { f() },

    // the log array is passed so the return body can reference it
    _log: log,
    _fetchLog: fetchLog,

    // functions called by the extracted code that we stub
    repaintSubject: () => { log.push('repaintSubject') },
    paintAgeTog: () => { log.push('paintAgeTog') },
    paintCurated: () => { log.push('paintCurated') },
    syncDiscoveryChecks: () => { log.push('syncDiscoveryChecks') },
    afterSelectionChange: () => { log.push('afterSelectionChange') },
    showReview: () => { log.push('showReview') },
    ensureSession: () => Promise.resolve('sess-test'),
    syncSelect: () => Promise.resolve(null),
    detectPhotoOrientation: () => {},
    setUploadState: () => {},
    photoStampHtml: () => '',
    fitStampThumb: () => {},
    focusStampThumb: () => {},
    openAgeGate: () => { log.push('ageGate') },
    isUnderage: () => false,
    newAssetId: () => 'asset-test',
    runAnalyze: () => { log.push('runAnalyze') },
    act: () => {},
    GUEST_INTAKE_SEQ: 0,
    // requirePhoto's nudge, Review's entry, and what startCheckout reads
    nudge: (_el: unknown, text: string) => { log.push('nudge:' + text) },
    closePickSizes: () => {},
    openSignin: () => { log.push('openSignin') },
    openSlots: () => 0,
    aspectRatioOf: (a: string) => ({ square: '1:1', portrait: '3:4', landscape: '4:3' } as any)[a],
    SERVER_OFFER: null,
    loadStripeJs: () => Promise.resolve(),
    showCheckoutError: (m: string) => { log.push('checkoutError:' + m) },
    resetCraftBtn: () => {},
    onEmbeddedCheckoutComplete: () => {},
    STRIPE_EMBED: null,
  }

  const body = [
    fn('targetFor'), fn('targetBundle'),
    fn('subjectFromPhoto'), fn('applyDetection'),
    fn('curatedEffect'), fn('validBench'),
    fn('acceptPhoto'),
    fn('takeNewPhoto'),
    fn('photoPrint'), fn('validSourcePhoto'), fn('requirePhoto'), fn('requestReview'), fn('startCheckout'),
    fn('saveResume'), fn('restoreResume'), fn('clearResume'),
    `return {
      saveResume: saveResume,
      restoreResume: restoreResume,
      clearResume: clearResume,
      acceptPhoto: acceptPhoto,
      takeNewPhoto: takeNewPhoto,
      validSourcePhoto: validSourcePhoto,
      photoPrint: photoPrint,
      requestReview: requestReview,
      startCheckout: startCheckout,
      state: function() {
        return {
          SELECTED: SELECTED, SUBJECT: SUBJECT, SUBJECT_FORCED: SUBJECT_FORCED,
          SUBJECT_DETECTED: SUBJECT_DETECTED, ANALYZE_RESULT: ANALYZE_RESULT,
          CURATED: CURATED, POSE: POSE, ASPECT: ASPECT,
          uploadedPhotoDataUrl: uploadedPhotoDataUrl, SRC_B64: SRC_B64,
          PENDING_REVIEW: PENDING_REVIEW, ME: ME, TARGET_PICK: TARGET_PICK,
          RESUME_AWAITS_PHOTO: RESUME_AWAITS_PHOTO,
        };
      },
      log: function() { return _log; },
      fetchLog: function() { return _fetchLog; },
      ls: localStorage,
      handoff: LitenHandoff,
      setMe: function(v) { ME = v; },
    };`,
  ].join('\n')

  return new Function(...Object.keys(env), body)(...Object.values(env)) as {
    saveResume: () => void
    restoreResume: () => Promise<boolean>
    clearResume: () => void
    acceptPhoto: (url: string, trusted?: any) => boolean
    takeNewPhoto: (url: string) => void
    validSourcePhoto: (url: unknown, print?: string | null) => Promise<boolean>
    photoPrint: (url: string) => string
    requestReview: (anchorEl?: unknown) => void
    startCheckout: () => void
    state: () => {
      SELECTED: any[]; SUBJECT: string; SUBJECT_FORCED: boolean
      SUBJECT_DETECTED: string | null; ANALYZE_RESULT: any
      CURATED: { bench: string[]; page: number }; POSE: string; ASPECT: string
      uploadedPhotoDataUrl: string | null; SRC_B64: string | null; PENDING_REVIEW: boolean
      ME: any; TARGET_PICK: number; RESUME_AWAITS_PHOTO: boolean
    }
    log: () => string[]
    fetchLog: () => string[]
    ls: ReturnType<typeof fakeLocalStorage>
    handoff: ReturnType<typeof fakeLitenHandoff>
    setMe: (v: any) => void
  }
}

// ── 1 · saveResume schema ──────────────────────────────────────────────

describe('saveResume writes the v2 resume', () => {
  it('localStorage holds the core state, not the photograph', () => {
    const sb = build({
      selected: [{ key: 'reclaimed_bronze', baseId: 'reclaimed_bronze', name: 'Reclaimed Bronze', siloName: 'Test' }],
      subject: 'woman', subjectForced: true, subjectDetected: 'woman',
      analyze: { subject: 'woman', gender: 'f', age_group: 'adult' },
      bench: [
        'reclaimed_bronze', 'retro_robot', 'stained_glass', 'plushy', 'ice', 'impressionist', 'art_deco', 'stone',
        'petal_sculpture', 'renaissance', 'victorian', 'wild_west', 'neon', 'oil_impasto', 'balloon_face', 'sheet_music',
      ],
      page: 1, pose: 'dramatic', aspect: 'landscape',
      photo: 'data:image/jpeg;base64,AAAA', pendingReview: true,
    })
    sb.saveResume()

    const raw = sb.ls.getItem('liten_resume_v1')
    expect(raw).toBeTruthy()
    const core = JSON.parse(raw!)
    expect(core.v).toBe(2)
    expect(core.subject).toBe('woman')
    expect(core.subjectForced).toBe(true)
    expect(core.subjectDetected).toBe('woman')
    expect(core.analyze).toEqual({ subject: 'woman', gender: 'f', age_group: 'adult' })
    expect(core.queue).toHaveLength(1)
    expect(core.queue[0].key).toBe('reclaimed_bronze')
    expect(core.bench).toHaveLength(16)
    expect(core.page).toBe(1)
    expect(core.pose).toBe('dramatic')
    expect(core.aspect).toBe('landscape')
    expect(core.pendingReview).toBe(true)
    expect(core.photo).toBe(true)
    // The photograph itself must NOT be in localStorage
    expect(sb.ls.getItem('liten_resume_v1_img')).toBeNull()
  })

  it('the photograph goes to IndexedDB via LitenHandoff.putPhoto', async () => {
    const sb = build({ photo: 'data:image/jpeg;base64,BIGPHOTO' })
    sb.saveResume()
    // putPhoto is async; let it settle
    await new Promise((r) => setTimeout(r, 10))
    expect(sb.handoff._blobs['resume:source']).toBe('data:image/jpeg;base64,BIGPHOTO')
  })

  it('without a photograph, no IndexedDB write and photo flag is false', () => {
    const sb = build({ photo: null })
    sb.saveResume()
    const core = JSON.parse(sb.ls.getItem('liten_resume_v1')!)
    expect(core.photo).toBe(false)
    expect(sb.handoff._blobs['resume:source']).toBeUndefined()
  })
})

// ── 2 · restoreResume round-trip ───────────────────────────────────────

describe('restoreResume round-trips the full Discovery state', () => {
  const BENCH_16 = [
    'reclaimed_bronze', 'retro_robot', 'stained_glass', 'plushy', 'ice', 'impressionist', 'art_deco', 'stone',
    'petal_sculpture', 'renaissance', 'victorian', 'wild_west', 'neon', 'oil_impasto', 'balloon_face', 'sheet_music',
  ]

  it('photo, subject, override, selections, bench, pose, aspect all survive', async () => {
    // Save
    const saver = build({
      selected: [
        { key: 'reclaimed_bronze', baseId: 'reclaimed_bronze', name: 'Reclaimed Bronze', siloName: 'Test' },
        { key: 'ice', baseId: 'ice', name: 'Ice', siloName: 'Test' },
      ],
      subject: 'woman', subjectForced: true, subjectDetected: 'woman',
      analyze: { subject: 'woman', gender: 'f', age_group: 'adult' },
      bench: BENCH_16, page: 1,
      pose: 'dramatic', aspect: 'landscape',
      photo: VALID,
      pendingReview: false,
    })
    saver.saveResume()
    await new Promise((r) => setTimeout(r, 10))

    // Restore into a fresh sandbox that shares the same storage
    const restorer = build({ me: { id: 'u1', email: 'a@b.com' } })
    // Transplant saved state
    restorer.ls._store['liten_resume_v1'] = saver.ls._store['liten_resume_v1']
    restorer.handoff._blobs['resume:source'] = saver.handoff._blobs['resume:source']

    const ok = await restorer.restoreResume()
    expect(ok).toBe(true)

    const st = restorer.state()
    expect(st.uploadedPhotoDataUrl).toBe(VALID)
    expect(st.SUBJECT).toBe('woman')
    expect(st.SUBJECT_FORCED).toBe(true)
    expect(st.SUBJECT_DETECTED).toBe('woman')
    expect(st.SELECTED).toHaveLength(2)
    expect(st.SELECTED[0].key).toBe('reclaimed_bronze')
    expect(st.SELECTED[1].key).toBe('ice')
    expect(st.CURATED.bench).toEqual(BENCH_16)
    expect(st.CURATED.page).toBe(1)
    expect(st.POSE).toBe('dramatic')
    expect(st.ASPECT).toBe('landscape')
  })

  it('pendingReview + ME + selections → showReview', async () => {
    const saver = build({
      selected: [{ key: 'ice', baseId: 'ice', name: 'Ice', siloName: 'Test' }],
      subject: 'man', pendingReview: true,
      photo: VALID,
    })
    saver.saveResume()
    await new Promise((r) => setTimeout(r, 10))

    const restorer = build({ me: { id: 'u1', email: 'a@b.com' } })
    restorer.ls._store['liten_resume_v1'] = saver.ls._store['liten_resume_v1']
    restorer.handoff._blobs['resume:source'] = saver.handoff._blobs['resume:source']

    await restorer.restoreResume()
    expect(restorer.state().uploadedPhotoDataUrl).toBe(VALID)
    expect(restorer.log()).toContain('showReview')
  })

  it('pendingReview but no ME → showReview NOT called', async () => {
    const saver = build({
      selected: [{ key: 'ice', baseId: 'ice', name: 'Ice', siloName: 'Test' }],
      pendingReview: true, photo: VALID,
    })
    saver.saveResume()
    await new Promise((r) => setTimeout(r, 10))

    const restorer = build({ me: null })
    restorer.ls._store['liten_resume_v1'] = saver.ls._store['liten_resume_v1']
    restorer.handoff._blobs['resume:source'] = saver.handoff._blobs['resume:source']

    await restorer.restoreResume()
    expect(restorer.log()).not.toContain('showReview')
  })
})

// ── 3 · IndexedDB, not localStorage, holds the photograph ─────────────

describe('photo storage is IndexedDB', () => {
  it('the legacy _img key is never written by v2 save', () => {
    const sb = build({ photo: 'data:image/jpeg;base64,BIG' })
    sb.saveResume()
    expect(sb.ls.getItem('liten_resume_v1_img')).toBeNull()
  })

  it('restoreResume reads from IndexedDB when v2 + photo flag', async () => {
    const sb = build({ photo: VALID, me: { id: 'u1', email: 'a@b.com' } })
    sb.saveResume()
    await new Promise((r) => setTimeout(r, 10))

    const restorer = build({ me: { id: 'u1', email: 'a@b.com' } })
    restorer.ls._store['liten_resume_v1'] = sb.ls._store['liten_resume_v1']
    restorer.handoff._blobs['resume:source'] = sb.handoff._blobs['resume:source']

    await restorer.restoreResume()
    expect(restorer.state().uploadedPhotoDataUrl).toBe(VALID)
  })
})

// ── 4 · expiration and missing Blob ────────────────────────────────────

describe('expiration and missing Blob recovery', () => {
  it('an expired resume is dropped without restoring anything', async () => {
    const sb = build({ me: { id: 'u1', email: 'a@b.com' } })
    // Manually write an expired entry
    sb.ls._store['liten_resume_v1'] = JSON.stringify({
      v: 2, at: Date.now() - 3 * 60 * 60 * 1000, // 3 hours ago
      queue: [{ key: 'ice', baseId: 'ice', name: 'Ice', siloName: 'Test' }],
      subject: 'woman', subjectForced: true, photo: true,
    })
    const ok = await sb.restoreResume()
    expect(ok).toBe(false)
    expect(sb.state().SELECTED).toEqual([])
    expect(sb.state().SUBJECT).toBe('man') // default, not restored
    // localStorage cleaned up
    expect(sb.ls.getItem('liten_resume_v1')).toBeNull()
  })

  it('a missing IndexedDB Blob restores state without the photo', async () => {
    const saver = build({
      selected: [{ key: 'neon', baseId: 'neon', name: 'Neon', siloName: 'Test' }],
      subject: 'woman', subjectForced: true,
      photo: VALID,
      pendingReview: true,
    })
    saver.saveResume()
    await new Promise((r) => setTimeout(r, 10))

    const restorer = build({ me: { id: 'u1', email: 'a@b.com' } })
    restorer.ls._store['liten_resume_v1'] = saver.ls._store['liten_resume_v1']
    // Do NOT transplant the IndexedDB blob — simulate it being missing/expired

    const ok = await restorer.restoreResume()
    expect(ok).toBe(true) // rest of state still restores
    const st = restorer.state()
    expect(st.uploadedPhotoDataUrl).toBeNull() // photo lost gracefully
    expect(st.SELECTED).toHaveLength(1)
    expect(st.SELECTED[0].key).toBe('neon')
    expect(st.SUBJECT).toBe('woman')
    expect(st.SUBJECT_FORCED).toBe(true)
    // ...but it was on its way into Review, signed in, with a choice: Review must still NOT open
    expect(restorer.log()).not.toContain('showReview')
  })

  it('corrupt localStorage JSON → returns false, cleans up', async () => {
    const sb = build({ me: { id: 'u1', email: 'a@b.com' } })
    sb.ls._store['liten_resume_v1'] = '{GARBAGE'
    const ok = await sb.restoreResume()
    expect(ok).toBe(false)
    expect(sb.ls.getItem('liten_resume_v1')).toBeNull()
  })
})

// ── 5 · clearResume ────────────────────────────────────────────────────

describe('clearResume', () => {
  it('removes localStorage key and IndexedDB blob', async () => {
    const sb = build({ photo: 'data:image/jpeg;base64,DEL' })
    sb.saveResume()
    await new Promise((r) => setTimeout(r, 10))
    expect(sb.ls.getItem('liten_resume_v1')).toBeTruthy()
    expect(sb.handoff._blobs['resume:source']).toBeTruthy()

    sb.clearResume()
    expect(sb.ls.getItem('liten_resume_v1')).toBeNull()
    // dropPhoto is fire-and-forget; check after a tick
    await new Promise((r) => setTimeout(r, 10))
    expect(sb.handoff._blobs['resume:source']).toBeUndefined()
  })
})

// ── 6 · guest Change Photo ─────────────────────────────────────────────

describe('guest Change Photo via takeNewPhoto', () => {
  it('calls /api/v1/foyer/intake and accepts on success', async () => {
    let intakeCalled = false
    const sb = build({
      me: null, subject: 'man', subjectForced: true,
      fetchResponse: async (url: string) => {
        if (url === '/api/v1/foyer/intake') {
          intakeCalled = true
          return { json: async () => ({ status: 'ok', subject: 'woman', gender: 'f', age_group: 'adult' }) }
        }
        return { ok: true, json: async () => ({}) }
      },
    })
    sb.takeNewPhoto('data:image/jpeg;base64,NEWPHOTO')
    await new Promise((r) => setTimeout(r, 50))

    expect(intakeCalled).toBe(true)
    const st = sb.state()
    expect(st.uploadedPhotoDataUrl).toBe('data:image/jpeg;base64,NEWPHOTO')
    expect(st.SUBJECT).toBe('woman')
    expect(st.SUBJECT_FORCED).toBe(false) // manual override cleared
    expect(st.SUBJECT_DETECTED).toBe('woman')
  })

  it('a signed-in user goes straight to acceptPhoto (no intake call)', async () => {
    let intakeCalled = false
    const sb = build({
      me: { id: 'u1', email: 'a@b.com' }, subject: 'woman', subjectForced: true,
      fetchResponse: async (url: string) => {
        if (url === '/api/v1/foyer/intake') intakeCalled = true
        return { ok: true, json: async () => ({}) }
      },
    })
    sb.takeNewPhoto('data:image/jpeg;base64,AUTHED')
    await new Promise((r) => setTimeout(r, 50))

    expect(intakeCalled).toBe(false)
    const st = sb.state()
    expect(st.uploadedPhotoDataUrl).toBe('data:image/jpeg;base64,AUTHED')
    expect(st.SUBJECT_FORCED).toBe(false) // still cleared on new photo
    expect(sb.log()).toContain('runAnalyze') // authenticated path uses analyze
  })

  it('intake refusal (under 18) does not accept the photo', async () => {
    const sb = build({
      me: null,
      fetchResponse: async () => ({
        json: async () => ({ status: 'refused', code: 'age_restricted' }),
      }),
    })
    sb.takeNewPhoto('data:image/jpeg;base64,CHILD')
    await new Promise((r) => setTimeout(r, 50))

    expect(sb.state().uploadedPhotoDataUrl).toBeNull()
  })

  it('intake network failure does not accept the photo', async () => {
    const sb = build({
      me: null,
      fetchResponse: async () => { throw new Error('network down') },
    })
    sb.takeNewPhoto('data:image/jpeg;base64,FAIL')
    await new Promise((r) => setTimeout(r, 50))

    expect(sb.state().uploadedPhotoDataUrl).toBeNull()
  })
})

// ── 7 · manual gender override rules ───────────────────────────────────

describe('manual gender override rules', () => {
  it('same photo + manual override → override survives auth round-trip', async () => {
    const saver = build({
      subject: 'man', subjectForced: true, subjectDetected: 'woman',
      analyze: { subject: 'woman', gender: 'f', age_group: 'adult' },
      photo: VALID,
      selected: [{ key: 'ice', baseId: 'ice', name: 'Ice', siloName: 'Test' }],
    })
    saver.saveResume()
    await new Promise((r) => setTimeout(r, 10))

    const restorer = build({ me: { id: 'u1', email: 'a@b.com' } })
    restorer.ls._store['liten_resume_v1'] = saver.ls._store['liten_resume_v1']
    restorer.handoff._blobs['resume:source'] = saver.handoff._blobs['resume:source']

    await restorer.restoreResume()
    const st = restorer.state()
    expect(st.SUBJECT).toBe('man') // manual override wins
    expect(st.SUBJECT_FORCED).toBe(true)
    expect(st.SUBJECT_DETECTED).toBe('woman') // detection preserved
  })

  it('new photo → manual override cleared → detection becomes authoritative', async () => {
    const sb = build({
      me: null, subject: 'man', subjectForced: true,
      fetchResponse: async (url: string) => {
        if (url === '/api/v1/foyer/intake') {
          return { json: async () => ({ status: 'ok', subject: 'woman', gender: 'f', age_group: 'adult' }) }
        }
        return { ok: true, json: async () => ({}) }
      },
    })
    // Verify the override is set before
    expect(sb.state().SUBJECT_FORCED).toBe(true)
    expect(sb.state().SUBJECT).toBe('man')

    sb.takeNewPhoto('data:image/jpeg;base64,NEWFACE')
    await new Promise((r) => setTimeout(r, 50))

    const st = sb.state()
    expect(st.SUBJECT_FORCED).toBe(false) // cleared by new photo
    expect(st.SUBJECT).toBe('woman') // detection is now authoritative
  })
})

// ── 8 · the foyer reveal is NOT carried into Discovery ─────────────────

describe('foyer handoff boundaries', () => {
  it('saveResume does not include any foyer reveal or effect state', () => {
    const sb = build({
      selected: [{ key: 'ice', baseId: 'ice', name: 'Ice', siloName: 'Test' }],
      photo: 'data:image/jpeg;base64,X',
    })
    sb.saveResume()
    const core = JSON.parse(sb.ls.getItem('liten_resume_v1')!)
    // No reveal, no foyer effect, no foyer-specific fields
    expect(core).not.toHaveProperty('reveal')
    expect(core).not.toHaveProperty('foyerEffect')
    expect(core).not.toHaveProperty('revealUrl')
  })
})

// ── 9 · THE PHOTO GUARD: no Review, no checkout, without a valid photograph ──

describe('the photo guard: Review and checkout need a VALID source photograph', () => {
  const ME_ = { id: 'u1', email: 'a@b.com' }
  const FOUR = ['reclaimed_bronze', 'ice', 'neon', 'stone'].map((k) => ({ key: k, baseId: k, name: k, siloName: 'Test' }))
  const BENCH_16 = [
    'reclaimed_bronze', 'retro_robot', 'stained_glass', 'plushy', 'ice', 'impressionist', 'art_deco', 'stone',
    'petal_sculpture', 'renaissance', 'victorian', 'wild_west', 'neon', 'oil_impasto', 'balloon_face', 'sheet_music',
  ]

  // Held at sign-in on the way into Review, with a good photograph and four
  // choices (a size checkout accepts, so only the photograph can stop it);
  // back signed in with whatever the photo store now gives up.
  async function returnWith(stored: string | null | { reject: true } | { none: true }) {
    const saver = build({
      selected: FOUR, subject: 'woman', subjectForced: true, subjectDetected: 'woman',
      analyze: { subject: 'woman', gender: 'f', age_group: 'adult' },
      bench: BENCH_16, page: 1, pose: 'dramatic', aspect: 'landscape',
      photo: VALID, pendingReview: true,
    })
    saver.saveResume()
    await new Promise((r) => setTimeout(r, 10))
    const r = build({ me: ME_ })
    r.ls._store['liten_resume_v1'] = saver.ls._store['liten_resume_v1']
    if (stored && typeof stored === 'object' && 'reject' in stored) {
      r.handoff.getPhoto = () => Promise.reject(new Error('IndexedDB unavailable'))
    } else if (stored && typeof stored === 'object' && 'none' in stored) {
      r.handoff.getPhoto = () => Promise.resolve(null)   // foyer-handoff.js getPhoto after a failed read
    } else if (stored !== null) {
      r.handoff._blobs['resume:source'] = stored as string
    }
    const ok = await r.restoreResume()
    return { r, ok }
  }
  // everything recoverable came back, the photograph did not, and nothing was entered
  function expectHeldInDiscovery(r: Sandbox) {
    const st = r.state()
    expect(st.uploadedPhotoDataUrl).toBeNull()
    expect(st.SRC_B64).toBeNull()
    expect(st.SELECTED.map((s: any) => s.key)).toEqual(['reclaimed_bronze', 'ice', 'neon', 'stone'])
    expect(st.CURATED).toEqual({ bench: BENCH_16, page: 1 })
    expect([st.SUBJECT, st.SUBJECT_FORCED]).toEqual(['woman', true])
    expect([st.POSE, st.ASPECT]).toEqual(['dramatic', 'landscape'])
    // the saved detection belonged to the lost photograph: not reused
    expect(st.ANALYZE_RESULT).toBeNull()
    expect(st.SUBJECT_DETECTED).toBeNull()
    expect(r.log()).not.toContain('showReview')
    // the held resume is kept until a photograph is in
    expect(st.RESUME_AWAITS_PHOTO).toBe(true)
    expect(r.ls.getItem('liten_resume_v1')).not.toBeNull()
  }

  it('A · valid Blob + pending Review + signed in + choices -> the photograph restores and Review opens', async () => {
    const { r, ok } = await returnWith(VALID)
    expect(ok).toBe(true)
    const st = r.state()
    expect(st.uploadedPhotoDataUrl).toBe(VALID)
    expect(st.SRC_B64).toBe(VALID.split(',')[1])
    expect(st.ANALYZE_RESULT).toMatchObject({ subject: 'woman' })   // its own detection, reused with it
    expect(st.SUBJECT_DETECTED).toBe('woman')
    expect(r.log()).toContain('showReview')
    expect(st.RESUME_AWAITS_PHOTO).toBe(false)
    expect(r.ls.getItem('liten_resume_v1')).toBeNull()                // done with: cleared, as before
  })

  it('B · missing Blob -> the work restores, Review does NOT open, an upload is required', async () => {
    const { r, ok } = await returnWith(null)
    expect(ok).toBe(true)
    expectHeldInDiscovery(r)
    // pressing Review asks for the photograph instead of opening
    r.requestReview({})
    expect(r.log()).not.toContain('showReview')
    expect(r.log()).not.toContain('openSignin')
    expect(r.log()).toContain('nudge:Please upload an image first')
  })

  it('C · an empty Blob -> Review does NOT open', async () => {
    for (const bad of [BAD.emptyBlob, BAD.emptyPayload]) {
      const { r } = await returnWith(bad)
      expectHeldInDiscovery(r)
    }
  })

  it('D · corrupt / non-image / malformed / cut-short / altered bytes -> rejected, Review does NOT open', async () => {
    for (const bad of [BAD.corrupt, BAD.notAnImageType, BAD.malformed, CUT.truncated, CUT.headerOnly, CUT.sameLength]) {
      const { r } = await returnWith(bad)
      expectHeldInDiscovery(r)
    }
  })

  it('D · validSourcePhoto: an image data URL that decodes, and is the very bytes saved', async () => {
    const sb = build(), v = sb.validSourcePhoto, printOf = sb.photoPrint
    expect(await v(VALID)).toBe(true)
    expect(await v(VALID_2)).toBe(true)
    for (const bad of Object.values(BAD)) expect(await v(bad)).toBe(false)
    for (const bad of [undefined, 42, {}, '']) expect(await v(bad)).toBe(false)
    // with the saved fingerprint: the same bytes pass; cut short or altered do not
    expect(await v(VALID, printOf(VALID))).toBe(true)
    expect(await v(VALID_2, printOf(VALID))).toBe(false)
    for (const bad of Object.values(CUT)) expect(await v(bad, printOf(VALID))).toBe(false)
  })

  it('saveResume records the photograph\'s fingerprint beside it', () => {
    const sb = build({ photo: VALID })
    sb.saveResume()
    const core = JSON.parse(sb.ls.getItem('liten_resume_v1')!)
    expect(core.photoPrint).toBe(sb.photoPrint(VALID))
    expect(core.photoPrint).toBe(VALID.length + ':' + core.photoPrint.split(':')[1])
    const none = build({ photo: null }); none.saveResume()
    expect(JSON.parse(none.ls.getItem('liten_resume_v1')!).photoPrint).toBeNull()
  })

  it('E · IndexedDB unavailable or the read fails -> Review does NOT open', async () => {
    for (const stored of [{ reject: true as const }, { none: true as const }]) {
      const { r, ok } = await returnWith(stored)
      expect(ok).toBe(true)
      expectHeldInDiscovery(r)
    }
  })

  it('E · a reload before the new upload brings the work back again (the held resume was not destroyed)', async () => {
    const { r } = await returnWith(BAD.corrupt)
    const again = build({ me: ME_ })
    again.ls._store['liten_resume_v1'] = r.ls._store['liten_resume_v1']
    again.handoff._blobs['resume:source'] = BAD.corrupt!
    expect(await again.restoreResume()).toBe(true)
    expectHeldInDiscovery(again)
  })

  it('F · a new valid photograph after a failed restore -> the choices survive and Review opens normally', async () => {
    const { r } = await returnWith(null)
    r.requestReview({})
    expect(r.log()).not.toContain('showReview')

    r.takeNewPhoto(VALID_2)                          // signed in: acceptPhoto, then its own analysis
    await new Promise((res) => setTimeout(res, 10))
    const st = r.state()
    expect(st.uploadedPhotoDataUrl).toBe(VALID_2)
    expect(st.SELECTED.map((s: any) => s.key)).toEqual(['reclaimed_bronze', 'ice', 'neon', 'stone'])
    expect(r.log()).toContain('runAnalyze')          // the NEW photograph is examined; the old answer is not used
    // everything the held resume could restore is on the page: it is let go now
    expect(st.RESUME_AWAITS_PHOTO).toBe(false)
    expect(r.ls.getItem('liten_resume_v1')).toBeNull()

    r.requestReview({})
    expect(r.log()).toContain('showReview')
  })

  it('G · Craft with no valid source -> no checkout request is made', async () => {
    const { r } = await returnWith(null)
    r.startCheckout()
    await new Promise((res) => setTimeout(res, 10))
    expect(r.fetchLog()).not.toContain('/api/v1/portfolios')
    expect(r.log()).toContain('nudge:Please upload an image first')
    expect(r.log()).not.toContain('openSignin')
  })

  it('G · control: the same Craft with the photograph restored DOES post the checkout', async () => {
    const { r } = await returnWith(VALID)
    r.startCheckout()
    await new Promise((res) => setTimeout(res, 10))
    expect(r.fetchLog()).toContain('/api/v1/portfolios')
  })

  it('H · a corrupt source never enters Review, never reaches checkout -- so no paid work, no render', async () => {
    const { r } = await returnWith(BAD.corrupt)
    expectHeldInDiscovery(r)
    r.requestReview({})
    r.startCheckout()
    await new Promise((res) => setTimeout(res, 10))
    expect(r.log()).not.toContain('showReview')
    expect(r.fetchLog()).not.toContain('/api/v1/portfolios')     // no purchase is created...
    expect(r.state().SRC_B64).toBeNull()                           // ...and there is no source to send
    const corruptB64 = (BAD.corrupt as string).split(',')[1]
    for (const u of r.fetchLog()) expect(u).not.toContain(corruptB64)
  })
})
