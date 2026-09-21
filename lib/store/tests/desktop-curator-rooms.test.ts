import { readFileSync } from 'fs'
import { runInNewContext } from 'vm'
import { describe, it, expect, vi } from 'vitest'
const html = readFileSync('public/discovery-consolidated-draft.html', 'utf8')
const code = html.slice(html.indexOf('function desktopMapRooms(){'), html.indexOf('function restoreDiscoveryRail(){'))
function harness(selected: string[] = []) {
  const elements = Object.fromEntries(['dcurRooms', 'dcurCount', 'dcurProgress', 'dcurMapBody', 'dcurAll', 'dcurNext'].map(id => [id, { innerHTML: '', textContent: '', hidden:false, attributes: {} as Record<string, unknown>, fill: { style: { width: '' } }, setAttribute(key: string, value: unknown) { this.attributes[key] = value }, querySelector() { return this.fill } }]))
  const context = {
    DESKTOP_ALL_OPEN: false, VALID_SIZES:[1,4,8,16], targetFor:(n:number)=>n<=1?1:n<=4?4:n<=8?8:16,
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
it.each([0, 1, 3, 4, 7, 8, 12, 16])('shows accurate progress/count for %i picks', n => {
  const { elements } = harness(Array.from({length:n}, (_, i) => String(i)))
  expect(elements.dcurCount.textContent).toBe(`${n} selected`)
  expect(elements.dcurProgress.attributes['aria-valuenow']).toBe(n)
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


it.each([[0,1,'1 more'],[1,1,'reached'],[3,4,'1 more'],[4,4,'reached'],[7,8,'1 more'],[8,8,'reached'],[12,16,'4 more'],[16,16,'reached']])('bundle progress at %i matches the existing target %i', (n,target,copy) => {
 const {context,elements}=harness(Array.from({length:n as number},(_,i)=>String(i)))
 const state=runInNewContext('desktopBundleProgress('+n+')',context)
 expect(state.message).toContain(copy)
 expect(state.message).toContain(target+'-image bundle')
 expect(elements.dcurProgress.innerHTML.match(/dcur__milestone/g)).toHaveLength(4)
 expect(state.position).toBeGreaterThanOrEqual(0)
 expect(state.position).toBeLessThanOrEqual(100)
})

it('flips only changed slots in reading order and swaps on the moving midpoint', async () => {
 const frames: ((now:number)=>void)[]=[]
 function card(id:string){return {dataset:{baseId:id},classList:{add(){},remove(){}},style:{transform:'',removeProperty(){this.transform=''}},replaceWith:vi.fn()}}
 const old=[card('selected'),card('old1'),card('old2')],fresh=[card('selected'),card('new1'),card('new2')]
 const scope={performance:{now:()=>0},matchMedia:()=>({matches:false}),requestAnimationFrame:(f:(n:number)=>void)=>frames.push(f)}
 const animation=code.slice(code.indexOf('function portraitFlipEase'),code.indexOf('async function remixDesktopCurated'))
 runInNewContext(animation,scope)
 const task=runInNewContext('desktopCuratedTurn',scope)({children:old},{children:fresh})
 function tick(now:number){frames.splice(0).forEach(f=>f(now))}
 tick(40)
 expect(old[0].style.transform).toBe('')
 expect(old[0].replaceWith).not.toHaveBeenCalled()
 tick(150)
 expect(old[1].style.transform).not.toBe(old[2].style.transform)
 tick(350)
 expect(old[1].replaceWith).toHaveBeenCalledWith(fresh[1])
 expect(fresh[1].style.transform).toContain('rotateY(-')
 tick(1000); await task
 expect(old[0].replaceWith).not.toHaveBeenCalled()
 expect(old[2].replaceWith).toHaveBeenCalledWith(fresh[2])
 expect(fresh[1].style.transform).toBe('')
})
