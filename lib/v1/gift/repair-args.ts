// lib/v1/gift/repair-args.ts: the argument contract of scripts/gift-repair-line.ts (pure, so it is tested without a database). One line per run; --execute is opt-in.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const known = new Set(['--session', '--user', '--line', '--operator', '--execute'])

export function parseRepairArgs(argv: string[]): { session: string; user: string; line: string; operator: string; execute: boolean } {
  const out: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!known.has(a)) throw new Error(`unknown argument: ${a}`)
    if (a === '--execute') { out.execute = true; continue }
    const v = argv[++i]
    if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`)
    out[a.slice(2)] = v
  }
  const { session, user, line, operator } = out as Record<string, string | undefined>
  if (!session || !UUID.test(session)) throw new Error('--session must be a session uuid')
  if (!user || !UUID.test(user)) throw new Error('--user must be the customer user uuid')
  if (!line || line.length > 64) throw new Error('--line must be one line id')
  if (!operator || !operator.trim() || operator.length > 100) throw new Error('--operator must name the person running this')
  return { session, user, line, operator: operator.trim(), execute: out.execute === true }
}

