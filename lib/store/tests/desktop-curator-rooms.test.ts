import { readFileSync } from 'fs'
import { runInNewContext } from 'vm'
import { describe, it, expect } from 'vitest'
const html = readFileSync('public/discovery-consolidated-draft.html', 'utf8')
const code = html.slice(html.indexOf('function desktopMapRooms(){'), html.indexOf('function restoreDiscoveryRail(){'))
function harness(mode = 'curated', selected: string[] = []) {
  const elements = Object.fromEntries(['dcurRooms', 'dcurCount', 'dcurPositions'].map(id => [id, { innerHTML: '', textContent: '' }]))
  const context = {
    DESKTOP_MAP_MODE: mode,
    SILOS: [{ id: 'one', name: 'One', effects: [{ id: 'a' }, { id: 'b' }] }, { id: 'two', name: 'Two', effects: [{ id: 'c' }] }],
    CURATED: { bench: ['a', 'b'] }, SELECTED: selected,
    isChosen: (id: string) => selected.includes(id), iconMarkup: () => '<img alt="">',
    document: { getElementById: (id: string) => elements[id], querySelectorAll: () => [] },
  }
  runInNewContext(code + '\npaintDesktopCurator();', context)
  return { context, elements }
}
describe('desktop Curator room map', () => {
  it('represents curated rooms once, not individual effects', () => {
    const { elements } = harness()
    expect(elements.dcurRooms.innerHTML.match(/data-curator-room=/g)).toHaveLength(1)
    expect(elements.dcurRooms.innerHTML).not.toContain('data-curator-effect')
  })
  it('all mode includes rooms outside the current curated collection', () => {
    expect(harness('all').elements.dcurRooms.innerHTML.match(/data-curator-room=/g)).toHaveLength(2)
  })
  it('highlights the same whole room for one or multiple selections', () => {
    expect(harness('all', ['a']).elements.dcurRooms.innerHTML).toBe(harness('all', ['a', 'b']).elements.dcurRooms.innerHTML)
    expect(harness('all', ['a']).elements.dcurRooms.innerHTML.match(/dcur__room selected/g)).toHaveLength(1)
  })
  it('reads a changed mix without maintaining a second collection', () => {
    const { context, elements } = harness()
    context.CURATED.bench = ['c']
    runInNewContext(code + '\npaintDesktopCurator();', context)
    expect(elements.dcurRooms.innerHTML).toContain('data-curator-room="two"')
    expect(elements.dcurRooms.innerHTML).not.toContain('data-curator-room="one"')
  })
})
