import { readFileSync } from 'fs'
import { runInNewContext } from 'vm'
import { describe, expect, it } from 'vitest'
const html = readFileSync('public/discovery-consolidated-draft.next.html', 'utf8')
const code = html.slice(html.indexOf('function pieceDisplayName(p){'), html.indexOf('function pieceTitle(p){'))
const context = { window: { EFFECT_REGISTRY: { effects: [{ id:'art_nouveau', label:'Art Nouveau' }, { id:'bronze', label:'Bronze' }] } } }
runInNewContext(code, context)
describe('collection display names preserve record identity', () => {
  it('uses canonical labels for preset IDs and already canonical names', () => {
    expect(runInNewContext("pieceDisplayName({name:'art_nouveau'})", context)).toBe('Art Nouveau')
    expect(runInNewContext("pieceDisplayName({name:'Bronze'})", context)).toBe('Bronze')
  })
  it('does not expose an unknown filename or account identifier', () => {
    expect(runInNewContext("pieceDisplayName({name:'tester-123-output.jpg'})", context)).toBe('Crafted Images')
  })
  it('does not merge or mutate multiple generations of the same effect', () => {
    const records = [{key:'pfA:1',previewId:'first',name:'art_nouveau'}, {key:'pfB:1',previewId:'second',name:'art_nouveau'}]
    const before = JSON.stringify(records)
    const scope = {...context, records}
    expect(runInNewContext('records.map(pieceDisplayName)', scope)).toEqual(['Art Nouveau','Art Nouveau'])
    expect(JSON.stringify(records)).toBe(before)
  })
})
