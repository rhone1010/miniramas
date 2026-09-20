import { readFileSync } from 'fs'
import { runInNewContext } from 'vm'
import { describe, it, expect } from 'vitest'
const html = readFileSync('public/discovery-consolidated-draft.html', 'utf8')
const code = html.slice(html.indexOf('function desktopMapRooms(){'), html.indexOf('function restoreDiscoveryRail(){'))
function harness(selected: string[] = []) {
  const elements = Object.fromEntries(['dcurRooms', 'dcurCount', 'dcurPositions'].map(id => [id, { innerHTML: '', textContent: '' }]))
  const context = {
    SILOS: [{ id: 'one', name: 'One', effects: [{ id: 'a' }, { id: 'b' }] }, { id: 'two', name: 'Two', effects: [{ id: 'c' }] }],
    CURATED: { bench: ['a', 'b', 'd', 'e', 'f', 'g', 'h', 'i', 'c', 'j', 'k', 'l', 'm', 'n', 'o', 'p'] }, SELECTED: selected,
    isChosen: (id: string) => selected.includes(id), iconMarkup: () => '<img alt="">',
    document: { getElementById: (id: string) => elements[id], querySelectorAll: () => [] },
  }
  runInNewContext(code + '\npaintDesktopCurator();', context)
  return { context, elements }
}
describe('desktop Curator room map', () => {
  it('keeps two eight-effect Curated rooms first, followed by every ordinary room', () => {
    const { context, elements } = harness()
    const rooms = runInNewContext('desktopMapRooms()', context)
    expect(rooms.map((room: {name: string}) => room.name)).toEqual(['Curated 1', 'Curated 2', 'One', 'Two'])
    expect(rooms[0].effects).toHaveLength(8)
    expect(rooms[1].effects).toHaveLength(8)
    expect(rooms[0].icon).not.toBe(rooms[1].icon)
    expect(elements.dcurRooms.innerHTML).not.toContain('data-curator-effect')
  })
  it('highlights whole rooms identically for one or multiple effects in the same rooms', () => {
    expect(harness(['a']).elements.dcurRooms.innerHTML).toBe(harness(['a', 'b']).elements.dcurRooms.innerHTML)
    expect(harness(['a']).elements.dcurRooms.innerHTML.match(/ selected"/g)).toHaveLength(2)
    expect(harness(['c']).elements.dcurRooms.innerHTML).toContain('dcur__room--curated selected" data-curator-room="curated" data-curated-room="1"')
  })
  it('retains fixed room identities and order after New Mix updates the existing bench', () => {
    const { context } = harness()
    const before = runInNewContext('desktopMapRooms()', context)
    context.CURATED.bench.reverse()
    const after = runInNewContext('desktopMapRooms()', context)
    expect(after.map((room: {name: string}) => room.name)).toEqual(before.map((room: {name: string}) => room.name))
    expect(after[0].effects.map((effect: {id: string}) => effect.id)).toEqual(context.CURATED.bench.slice(0, 8))
    expect(after[1].effects.map((effect: {id: string}) => effect.id)).toEqual(context.CURATED.bench.slice(8, 16))
  })
})
