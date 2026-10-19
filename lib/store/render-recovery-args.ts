// lib/store/render-recovery-args.ts: the argument contract of scripts/recover-failed-renders.ts (pure, so it is tested without a database).
// Explicit item ids only, never "all"; a dry run unless --execute is given.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_ITEMS_PER_RUN = 5

export interface RecoveryArgs { items: string[]; baseUrl: string | null; execute: boolean }

export function parseRecoveryArgs(argv: string[]): RecoveryArgs {
  const items: string[] = []; let baseUrl: string | null = null, execute = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--execute') { execute = true; continue }
    if (a !== '--item' && a !== '--base-url') throw new Error(`unknown argument: ${a}`)
    const v = argv[++i]
    if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`)
    if (a === '--item') { if (!UUID.test(v)) throw new Error('--item must be a portfolio item uuid'); if (!items.includes(v)) items.push(v) }
    else { if (!/^https:\/\/[a-z0-9.-]+\.vercel\.app\/?$/i.test(v)) throw new Error('--base-url must be an https *.vercel.app deployment (Preview)'); baseUrl = v.replace(/\/$/, '') }
  }
  if (!items.length) throw new Error('name at least one --item')
  if (items.length > MAX_ITEMS_PER_RUN) throw new Error(`at most ${MAX_ITEMS_PER_RUN} items per run`)
  if (execute && !baseUrl) throw new Error('--execute needs --base-url (the deployment that will do the render)')
  return { items, baseUrl, execute }
}
