// lib/store/tests/portraits-grant-client.test.ts
//
// The Portraits page carries each image's grant from /credits/gate to
// /portraits/generate, and retries the SAME grant when a request dies on the
// network.
//
// These cut the shipped spendCredits, payloadFor and generateWithGrant out of
// public/portraits.html by name and run them in a sandbox. Only fetch, the DOM
// and the clock are stubs.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const HTML = readFileSync(path.join(process.cwd(), 'public', 'portraits.html'), 'utf8').replace(/\r\n/g, '\n')

function matchBrace(src: string, open: number): number {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const c = src[i], n = src[i + 1]
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 1; continue }
    if (c === "'" || c === '"' || c === '`') { for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++; continue }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return i }
  }
  throw new Error('unbalanced from ' + open)
}
function fn(name: string): string {
  const at = HTML.indexOf('\n  function ' + name + '(')
  if (at < 0) throw new Error('not in page: ' + name)
  return HTML.slice(at + 1, matchBrace(HTML, HTML.indexOf('{', at)) + 1)
}
const constLine = (name: string) => {
  const m = HTML.match(new RegExp('^\\s*var ' + name + ' = [^;]+;', 'm'))
  if (!m) throw new Error('not in page: ' + name)
  return m[0].trim()
}

let calls: Array<{ url: string; body: any }>
let script: Array<any>
let sb: any

function build() {
  const env: Record<string, unknown> = {
    fetch: async (url: string, init: any) => {
      calls.push({ url, body: JSON.parse(init.body) })
      const next = script.shift()
      if (next === 'network') throw new TypeError('Failed to fetch')
      return { ok: next.status >= 200 && next.status < 300, status: next.status, json: async () => next.body }
    },
    setTimeout: (f: () => void, ms: number) => setTimeout(f, ms),
    console: { log() {}, warn() {}, error() {} },
    CREDITS_GATE_URL: '/api/v1/credits/gate',
    GENERATE_URL: '/api/v1/portraits/generate',
    CREDITS_PER_IMAGE: 10,
    RUN_REF: null,
    SRC: { skipRedirect: false },
    setCredits() {}, creditsNotice() {}, __openPaywall: undefined,
  }
  const body = [
    constLine('GENERATE_RETRY_EVERY'), constLine('GENERATE_RETRY_TRIES'),
    fn('grantRetryWait'), fn('generateWithGrant'), fn('spendCredits'), fn('payloadFor'),
    'return { spendCredits: spendCredits, payloadFor: payloadFor, generateWithGrant: generateWithGrant,',
    '  ref: function(){ return RUN_REF; } };',
  ].join('\n')
  sb = new Function(...Object.keys(env), body)(...Object.values(env))
  return sb
}

const item = (i: number, preset: string) => ({ id: i, preset, style_id: 'realistic', source_image_b64: 'SRC' })

beforeEach(() => { vi.useFakeTimers(); calls = []; script = []; build() })
afterEach(() => vi.useRealTimers())

describe('each image keeps its own grant from the gate', () => {
  it('maps grants to items by unit, not by array position', async () => {
    const items = [item(1, 'bronze'), item(2, 'walnut'), item(3, 'stone')]
    script.push({ status: 200, body: { ok: true, ref_id: 'craft_9', balance_after: 70,
      grants: [{ id: 'g2', unit: 2, preset: 'stone' }, { id: 'g0', unit: 0, preset: 'bronze' }, { id: 'g1', unit: 1, preset: 'walnut' }] } })
    expect(await sb.spendCredits(items)).toBe(true)
    expect(items.map((q: any) => q.grant_id)).toEqual(['g0', 'g1', 'g2'])
    expect(items.every((q: any) => q.paid && q.ref_id === 'craft_9')).toBe(true)
  })

  it('an answer without grants leaves no grant on the item (generate will refuse it)', async () => {
    const items = [item(1, 'bronze')]
    script.push({ status: 200, body: { ok: true, ref_id: 'craft_9', balance_after: 90 } })
    await sb.spendCredits(items)
    expect((items[0] as any).grant_id).toBeNull()
  })

  it('payloadFor sends the grant with the render', () => {
    const p = sb.payloadFor({ ...item(1, 'bronze'), grant_id: 'g0' })
    expect(p.grant_id).toBe('g0')
    expect(p.preset).toBe('bronze')
  })
})

describe('the same grant is retried when the network drops -- 2500ms x 4', () => {
  const OK = { status: 200, body: { result: { ok: true, image_b64: 'IMG' } } }

  it('retries a request that produced no response, with the SAME grant', async () => {
    script.push('network', 'network', OK)
    const p = sb.generateWithGrant({ grant_id: 'g0', preset: 'bronze' })
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2499)
    expect(calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls).toHaveLength(2)
    await vi.runAllTimersAsync()
    expect((await p).result.image_b64).toBe('IMG')
    expect(calls.map((c) => c.body.grant_id)).toEqual(['g0', 'g0', 'g0'])
  })

  it('retries a grant still in progress', async () => {
    script.push({ status: 409, body: { error: 'grant_in_progress' } }, OK)
    const p = sb.generateWithGrant({ grant_id: 'g0' })
    await vi.runAllTimersAsync()
    expect((await p).result.image_b64).toBe('IMG')
    expect(calls).toHaveLength(2)
  })

  it('five attempts at most, then the failure stands', async () => {
    script.push('network', 'network', 'network', 'network', 'network', OK)
    const p = sb.generateWithGrant({ grant_id: 'g0' }).catch((e: any) => e)
    await vi.runAllTimersAsync()
    expect(await p).toBeInstanceOf(TypeError)
    expect(calls).toHaveLength(5)
  })

  it('a real refusal is NOT retried: it fails exactly as before', async () => {
    for (const r of [{ status: 409, body: { error: 'grant_refunded' } }, { status: 403, body: { error: 'grant_invalid' } }, { status: 503, body: { error: 'result_persist_failed' } }]) {
      calls = []; script = [r]
      const p = sb.generateWithGrant({ grant_id: 'g0' }).catch((e: any) => e)
      await vi.runAllTimersAsync()
      expect((await p).message).toContain('HTTP ' + r.status)
      expect(calls).toHaveLength(1)
    }
  })

  it('the shipped constants are the ruled ones', () => {
    expect(constLine('GENERATE_RETRY_EVERY')).toBe('var GENERATE_RETRY_EVERY = 2500;')
    expect(constLine('GENERATE_RETRY_TRIES')).toBe('var GENERATE_RETRY_TRIES = 4;')
  })

  it('runQueueItem renders through generateWithGrant', () => {
    expect(fn('runQueueItem')).toContain('return generateWithGrant(payloadFor(item))')
  })
})
