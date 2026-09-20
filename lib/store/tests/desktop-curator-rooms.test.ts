import { readFileSync } from 'fs'
import { runInNewContext } from 'vm'
import { describe, it, expect, vi } from 'vitest'
const html = readFileSync('public/discovery-consolidated-draft.html', 'utf8')
const code = html.slice(html.indexOf('function desktopMapRooms(){'), html.indexOf('function restoreDiscoveryRail(){'))
function harness(selected: string[] = []) {
  const elements = Object.fromEntries(['dcurRooms', 'dcurCount', 'dcurProgress', 'dcurMapBody', 'dcurAll'].map(id => [id, { innerHTML: '', textContent: '', hidden:false, attributes: {} as Record<string, unknown>, fill: { style: { width: '' } }, setAttribute(key: string, value: unknown) { this.attributes[key] = value }, querySelector() { return this.fill } }]))
  const context = {
    DESKTOP_ALL_OPEN: false,
    SILOS: [{ id: 'one', name: 'One', effects: [{ id: 'a' }, { id: 'b' }] }, { id: 'two', name: 'Two', effects: [{ id: 'c' }] }, ...Array.from({length:6},(_,i)=>({id:'room'+i,name:'Room '+i,effects:[]}))],
    CURATED: { bench: ['a', 'b', 'd', 'e', 'f', 'g', 'h', 'i', 'c', 'j', 'k', 'l', 'm', 'n', 'o', 'p'] }, SELECTED: selected,
    isChosen: (id: string) => selected.includes(id), iconMarkup: () => '<img alt="">',
    document: { getElementById: (id: string) => elements[id], querySelectorAll: () => [] },
  }
  runInNewContext(code + '\npaintDesktopCurator();', context)
  return { context, elements }
}
describe('desktop progressive room map', () => {
  it('is collapsed by default and contains only ordinary rooms', () => {
    const {context,elements}=harness()
    const rooms=runInNewContext('desktopMapRooms()',context)
    expect(rooms).toHaveLength(8)
    expect(elements.dcurMapBody.hidden).toBe(true)
    expect(elements.dcurRooms.innerHTML).toContain('<span>One</span>')
    expect(elements.dcurAll.attributes['aria-expanded']).toBe('false')
    expect(elements.dcurRooms.innerHTML).not.toContain('data-curated-room')
    expect(elements.dcurRooms.innerHTML).not.toContain('data-curator-effect')
  })
  it('reveals the same rooms without changing selections or the curated bench', () => {
    const {context,elements}=harness(['a'])
    const original=JSON.stringify({bench:context.CURATED.bench,selected:context.SELECTED})
    context.DESKTOP_ALL_OPEN=true
    runInNewContext('paintDesktopCurator()',context)
    expect(elements.dcurRooms.innerHTML.match(/data-curator-room=/g)).toHaveLength(8)
    expect(elements.dcurAll.attributes['aria-expanded']).toBe('true')
    expect(elements.dcurMapBody.hidden).toBe(false)
    expect(JSON.stringify({bench:context.CURATED.bench,selected:context.SELECTED})).toBe(original)
  })
  it('highlights whole ordinary rooms for any number of selections', () => {
    expect(harness(['a']).elements.dcurRooms.innerHTML).toBe(harness(['a','b']).elements.dcurRooms.innerHTML)
    expect(harness(['a']).elements.dcurRooms.innerHTML.match(/ selected"/g)).toHaveLength(1)
  })
})
it.each([0, 1, 4, 8, 16])('shows accurate progress/count for %i picks', n => {
  const { elements } = harness(Array.from({length:n}, (_, i) => String(i)))
  expect(elements.dcurCount.textContent).toBe(n > 4 ? `${n} selected` : `${n} of 4 selected`)
  expect(elements.dcurProgress.fill.style.width).toBe(`${Math.min(100, n / 4 * 100)}%`)
  expect(elements.dcurProgress.attributes['aria-valuenow']).toBe(Math.min(4, n))
})

it('Remix preserves selected effects and collection records using the existing reroll engine', () => {
  const start=html.indexOf('function rerollBench(){')
  const end=html.indexOf('function ', start+10)
  const scope={CURATED:{bench:['a','b','c','d']},CURATED_UNIVERSE:['a','b','c','d','e','f','g','h'],SELECTED:[{key:'a',baseId:'a'}],
    isChosen:(id:string)=>id==='a',curatedEffect:(id:string)=>({id}),shuffled:(items:string[])=>items.slice()}
  runInNewContext(html.slice(start,end)+'\nrerollBench();',scope)
  expect(scope.CURATED.bench[0]).toBe('a')
  expect(scope.CURATED.bench.slice(1)).not.toEqual(['b','c','d'])
  expect(scope.SELECTED).toEqual([{key:'a',baseId:'a'}])
})


it('keeps old artwork until preloaded, flips out before replacing, and finishes the arrival before resetting the button', async () => {
  vi.useFakeTimers()
  try {
    const classes = () => { const values = new Set<string>(); return {add:(s:string)=>values.add(s),remove:(s:string)=>values.delete(s),contains:(s:string)=>values.has(s)} }
    const grid = {children:Array(8).fill({}),classList:classes()}
    const button = {disabled:false,classList:classes(),label:'Curated',setAttribute(_k:string,v:string){this.label=v}}
    const images: {onload:()=>void}[] = []
    const selected = [{baseId:'kept',key:'unique-original'}]
    let stage = 'old'
    const scope = { document:{getElementById:(id:string)=>id==='dcurRemix'?button:grid},
      setTimeout,clearTimeout,requestAnimationFrame:(cb:()=>void)=>setTimeout(cb,16),
      Image:class {onload=()=>{};onerror=()=>{};src='';constructor(){images.push(this)}},
      SUBJECT:'man',SELECTED:selected,DESKTOP_ALL_OPEN:true,
      rerollBench:vi.fn(),curatedPage:()=>Array(8).fill('effect'),curatedPreviewUrl:()=>'/preview.jpg',
      paintCurated:()=>{stage='new'},paintDesktopCurator:vi.fn(),goCurated:vi.fn() }
    const task = runInNewContext(code.slice(code.indexOf('function desktopCuratedTurn('))+'\nremixDesktopCurated()',scope)
    expect(button.label).toBe('Remixing…')
    await vi.advanceTimersByTimeAsync(180)
    expect(stage).toBe('old')
    expect(grid.classList.contains('is-turning')).toBe(false)
    images.forEach(image=>image.onload())
    await vi.advanceTimersByTimeAsync(0)
    expect(grid.classList.contains('is-turning')).toBe(true)
    await vi.advanceTimersByTimeAsync(685)
    expect(stage).toBe('old')
    await vi.advanceTimersByTimeAsync(1)
    expect(stage).toBe('new')
    expect(grid.classList.contains('is-arriving')).toBe(true)
    expect(button.disabled).toBe(true)
    await vi.advanceTimersByTimeAsync(32)
    expect(grid.classList.contains('has-arrived')).toBe(true)
    await vi.advanceTimersByTimeAsync(686)
    await task
    expect(button.label).toBe('Curated')
    expect(button.disabled).toBe(false)
    expect(grid.classList.contains('is-flipping')).toBe(false)
    expect(selected).toEqual([{baseId:'kept',key:'unique-original'}])
  } finally {vi.useRealTimers()}
})
