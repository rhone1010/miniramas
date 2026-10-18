import { describe, it, expect } from 'vitest'
import { parseRepairArgs } from './repair-args'
const S = '7c63738b-ccfa-4d55-ba79-a4e1f3a27295', U = '10000000-0000-4000-8000-000000000001'
const base = ['--session', S, '--user', U, '--line', 'a', '--operator', 'ops@liten.co']
describe('the operator script arguments', () => {
  it('default to a dry run and require --execute to change anything', () => {
    expect(parseRepairArgs(base)).toEqual({ session: S, user: U, line: 'a', operator: 'ops@liten.co', execute: false })
    expect(parseRepairArgs([...base, '--execute']).execute).toBe(true)
  })
  it('name exactly one line and one operator, and accept nothing like "all"', () => {
    for (const drop of ['--session', '--user', '--line', '--operator']) { const i = base.indexOf(drop); expect(() => parseRepairArgs(base.filter((_, k) => k !== i && k !== i + 1))).toThrow() }
    expect(() => parseRepairArgs([...base, '--all'])).toThrow(/unknown argument/); expect(() => parseRepairArgs([...base, '--lines', 'a,b'])).toThrow(/unknown argument/)
    expect(() => parseRepairArgs(['--session', 'x', ...base.slice(2)])).toThrow(/session/); expect(() => parseRepairArgs(['--session', S, '--user', U, '--line', '', '--operator', 'o'])).toThrow()
    expect(() => parseRepairArgs(['--session', S, '--user', U, '--line', 'a', '--operator', '  '])).toThrow(/operator/)
  })
})
