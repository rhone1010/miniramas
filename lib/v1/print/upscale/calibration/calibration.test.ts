import { describe, it, expect } from 'vitest'
import { selectCases, nativeDims, buildPlan, estimateTotals, renderGallery, CONFIGS, DEFAULT_CONFIGS, type Candidate, type RunRecord } from './calibration-lib'

const effects = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']
const pool: Candidate[] = (['portraits', 'groups', 'pets'] as const).flatMap(series => effects.flatMap(effect => ['1:1', '2:3', '3:2', '4:3', '9:16'].map(ratio => ({ series, effect: `${series}-${effect}`, path: `E:/x/${series}/${effect}-${ratio}.jpg`, ratio }))))

describe('choosing 20 representative images', () => {
  const cases = selectCases(pool)
  it('is 7 portraits, 6 groups and 7 pets, each a different effect', () => {
    expect(cases).toHaveLength(20)
    for (const [s, n] of [['portraits', 7], ['groups', 6], ['pets', 7]] as const) {
      const mine = cases.filter(c => c.series === s); expect(mine).toHaveLength(n); expect(new Set(mine.map(c => c.effect)).size).toBe(n)
    }
    expect(new Set(cases.map(c => c.id)).size).toBe(20)
  })
  it('mixes square and 2:3/3:2 shapes and several products, never a shape that would need AI outpaint', () => {
    expect(cases.some(c => c.ratio === '1:1')).toBe(true); expect(cases.some(c => c.ratio === '2:3' || c.ratio === '3:2')).toBe(true)
    expect(new Set(cases.map(c => c.finish)).size).toBeGreaterThanOrEqual(3)
    expect(cases.every(c => !['4:3', '9:16'].includes(c.ratio))).toBe(true)
  })
  it('is deterministic, and offers a 20x30 only when asked', () => {
    expect(selectCases(pool)).toEqual(cases)
    expect(cases.some(c => c.size === '20x30')).toBe(false)
    expect(selectCases(pool, { includeXl: true }).some(c => c.size === '20x30')).toBe(true)
  })
  it('copes with a thin pool', () => expect(selectCases(pool.filter(c => c.series === 'pets')).length).toBe(7))
})

describe('native size and the plan', () => {
  it('derives the dimensions of a ~1.5 MP render at each aspect', () => {
    expect(nativeDims('1:1', 1.5)).toEqual({ w: 1225, h: 1225 })
    const d = nativeDims('2:3', 1.5); expect(d.w / d.h).toBeCloseTo(2 / 3, 2); expect((d.w * d.h) / 1e6).toBeCloseTo(1.5, 1)
  })
  it('prices every run from the real target megapixels and totals them', () => {
    const { rows, skipped } = buildPlan(selectCases(pool), DEFAULT_CONFIGS)
    expect(skipped).toEqual([]); expect(rows).toHaveLength(60)
    const t = estimateTotals(rows)
    expect(t.calls).toBe(60); expect(t.expectedUsd).toBeGreaterThan(1); expect(t.expectedUsd).toBeLessThan(5); expect(t.worstUsd).toBeGreaterThan(t.expectedUsd)
  })
  it('compares one enhancement at a time against the production default', () => {
    expect(CONFIGS.off).toEqual({ enhance_details: false, enhance_realism: false })
    expect(CONFIGS.details).toEqual({ enhance_details: true, enhance_realism: false })
    expect(CONFIGS.realism).toEqual({ enhance_details: false, enhance_realism: true })
  })
})

describe('review gallery', () => {
  const rec = (config: string, over: Partial<RunRecord> = {}): RunRecord => ({
    caseId: 'pets-01-jade', series: 'pets', effect: 'jade', size: '12x12', finish: 'premium', config, params: { enhance_details: config === 'details', enhance_realism: false, output_quality: 95, output_format: 'jpg' },
    provider: 'replicate', predictionId: 'p1', input: [1225, 1225], output: [3606, 3606], final: [3600, 3600], targetMp: 13, sourcePpi: 102, upscaleMs: 5200, wallMs: 9000, costUsdEst: 0.02, costBasis: 'x',
    status: 'approved', reviewReason: null, error: null, warnings: [], qaVerdict: 'pass', qaSummary: 'faithful <b>', qaDefects: [], qaCostUsd: 0.011,
    files: { cropResult: `pets-01-jade/${config}/crop-result.jpg`, previewRef: 'pets-01-jade/reference-preview.jpg', cropRef: `pets-01-jade/${config}/crop-reference.jpg` }, ...over,
  })
  const html = renderGallery([rec('off'), rec('details'), rec('realism', { qaVerdict: 'defect', qaDefects: [{ code: 'texture_altered', severity: 'major', explanation: 'plastic' }], status: 'review' })], { title: 'T', mode: 'live', generated: 'run-1', provider: 'replicate' })
  it('shows every configuration side by side with its parameters, dimensions, time and cost', () => {
    expect(html.split('class="cfg"').length - 1).toBe(3)
    for (const t of ['enhance details on', '1225×1225 → 3606×3606', 'target 13 MP', '5.2 s', 'est. $0.02', 'QA $0.011', 'texture_altered']) expect(html).toContain(t)
  })
  it('keeps model predictions apart from human judgments, with explicit choices', () => {
    for (const t of ['Better than the others', 'Worse', 'Unacceptable', 'Too strict', 'Too lenient', 'Best configuration', 'none acceptable']) expect(html).toContain(t)
    expect(html).toContain('human:{verdict'); expect(html).toContain('"qaVerdict":"defect"')
  })
  it('escapes model text and embeds no file paths from the run in the data block', () => {
    expect(html).toContain('faithful &lt;b&gt;'); expect(html).not.toContain('faithful <b>'); expect(html).not.toContain('"files"')
  })
  it('the embedded script is valid JavaScript', () => {
    const script = html.match(/<script>([\s\S]*)<\/script>/)![1]
    expect(() => new Function(script)).not.toThrow()
  })
  it('a dry run says "not run" and shows no verdict', () => {
    const d = renderGallery([rec('off', { status: 'not_run', qaVerdict: null, qaSummary: null, files: {} })], { title: 'T', mode: 'dry-run', generated: 'g', provider: 'replicate' })
    expect(d).toContain('not run'); expect(d).toContain('no image')
  })
})
