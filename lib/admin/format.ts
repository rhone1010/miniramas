// lib/admin/format.ts
//
// Display helpers only. Deliberately free of any Supabase import — this
// file is used by the client component, and anything it touches gets
// bundled into the browser.

export const money = (cents: number | null | undefined) =>
  cents == null ? '—' : '$' + (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })

export const num = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US')

export const pct = (n: number | null | undefined, suffix = '%') =>
  n == null ? '—' : `${n}${suffix}`

export const secs = (ms: number | null | undefined) =>
  ms == null ? '—' : ms >= 1000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms)}ms`

/** Change between two periods, as a display string plus a direction. */
export function delta(now: number, prior: number, unit: '%' | 'n' = '%') {
  if (!prior && !now) return { text: 'no change yet', dir: 'flat' as const }
  if (!prior) return { text: 'first period', dir: 'flat' as const }
  const diff = now - prior
  if (diff === 0) return { text: 'level', dir: 'flat' as const }
  const dir = diff > 0 ? ('up' as const) : ('down' as const)
  const arrow = diff > 0 ? '\u25B2' : '\u25BC'
  if (unit === 'n') return { text: `${arrow} ${Math.abs(diff)}`, dir }
  return { text: `${arrow} ${Math.abs(Math.round((diff / prior) * 100))}%`, dir }
}
