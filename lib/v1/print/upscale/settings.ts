// lib/v1/print/upscale/settings.ts
//
// Remotely adjustable upscale configuration. Rows live in print_upscale_settings (migration 046):
// a complete 'global' row, plus optional 'family:<finish>' and 'sku:<SKU>' rows that override only
// the columns they set. Resolution order: sku, then family, then global.
//
// FAIL-SAFE: if the table cannot be read, the built-in defaults below apply. They are the same
// approved defaults the migration seeds, so an outage never changes behaviour or invents a provider.
// A job snapshots the resolved settings when it starts (see process.ts); nothing here is re-read mid-job.

import { createHash } from 'node:crypto'

export type ProviderName = 'replicate' | 'pruna'
export type OutputFormat = 'jpg' | 'png' | 'webp'

export interface UpscaleSettings {
  provider: ProviderName
  target_ppi: number
  max_megapixels: number
  output_format: OutputFormat
  output_quality: number
  enhance_details: boolean
  enhance_realism: boolean
  disable_safety_checker: boolean
  min_source_ppi: number
  qa_enabled: boolean
  /** 'flagged': only uncertain/defective/warned jobs wait for a person. 'all': every job does. */
  human_approval: 'all' | 'flagged'
}

export const SETTING_KEYS = [
  'provider', 'target_ppi', 'max_megapixels', 'output_format', 'output_quality', 'enhance_details',
  'enhance_realism', 'disable_safety_checker', 'min_source_ppi', 'qa_enabled', 'human_approval',
] as const satisfies readonly (keyof UpscaleSettings)[]

/** The approved initial defaults. Keep identical to the seed row in migration 046. */
export const DEFAULT_SETTINGS: UpscaleSettings = {
  provider: 'replicate',
  target_ppi: 300,
  max_megapixels: 128,
  output_format: 'jpg',
  output_quality: 95,
  enhance_details: false,
  enhance_realism: false,
  disable_safety_checker: false,
  min_source_ppi: 100,
  qa_enabled: true,
  human_approval: 'flagged',
}

export type SettingsRow = { scope: string; version?: number } & Partial<UpscaleSettings>

export interface ResolvedSettings {
  settings: UpscaleSettings
  /** Highest version among the rows that contributed, so a snapshot says which config era it used. */
  version: number
  sources: string[]
}

const clean = (row: SettingsRow): Partial<UpscaleSettings> => {
  const out: Record<string, unknown> = {}
  for (const k of SETTING_KEYS) if (row[k] !== null && row[k] !== undefined) out[k] = row[k]
  return out as Partial<UpscaleSettings>
}

export function resolveSettings(rows: SettingsRow[], sku: string, family: string): ResolvedSettings {
  const by = new Map(rows.map(r => [r.scope, r]))
  const chain = ['global', `family:${family}`, `sku:${sku}`].filter(s => by.has(s))
  let settings: UpscaleSettings = { ...DEFAULT_SETTINGS }
  let version = 0
  for (const scope of chain) {
    const row = by.get(scope)!
    settings = { ...settings, ...clean(row) }
    version = Math.max(version, row.version ?? 0)
  }
  return { settings, version, sources: chain.length ? chain : ['builtin'] }
}

/** Stable hash of the settings actually used, for the idempotency record and the audit trail. */
export function settingsHash(s: UpscaleSettings): string {
  const canonical = JSON.stringify(SETTING_KEYS.map(k => [k, s[k]]))
  return createHash('sha256').update(canonical).digest('hex').slice(0, 24)
}

export type PatchResult = { ok: true; value: Partial<UpscaleSettings> } | { ok: false; error: string }

const isInt = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi

/** Validates an admin edit. Unknown keys are rejected, never ignored. `null` clears an override. */
export function validatePatch(patch: unknown, scope: string): PatchResult {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { ok: false, error: 'invalid_patch' }
  const value: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (!(SETTING_KEYS as readonly string[]).includes(k)) return { ok: false, error: `unknown_setting:${k}` }
    if (v === null) {
      if (scope === 'global') return { ok: false, error: `global_requires_value:${k}` }
      value[k] = null
      continue
    }
    const bad = (() => {
      switch (k) {
        case 'provider': return v !== 'replicate' && v !== 'pruna'
        case 'output_format': return v !== 'jpg' && v !== 'png' && v !== 'webp'
        case 'human_approval': return v !== 'all' && v !== 'flagged'
        case 'target_ppi': return !isInt(v, 72, 600)
        case 'max_megapixels': return !isInt(v, 1, 128)
        case 'output_quality': return !isInt(v, 0, 100)
        case 'min_source_ppi': return !isInt(v, 0, 600)
        default: return typeof v !== 'boolean'
      }
    })()
    if (bad) return { ok: false, error: `invalid_value:${k}` }
    value[k] = v
  }
  if (!Object.keys(value).length) return { ok: false, error: 'empty_patch' }
  return { ok: true, value: value as Partial<UpscaleSettings> }
}

export function validateScope(scope: unknown): scope is string {
  return typeof scope === 'string' && (scope === 'global' || /^(family|sku):[A-Za-z0-9_-]+$/.test(scope))
}

/** Minimal client shape so tests need no Supabase. */
export interface SettingsDb {
  from(table: string): { select(cols: string): PromiseLike<{ data: SettingsRow[] | null; error: { message: string } | null }> }
}

export async function loadSettings(db: SettingsDb, sku: string, family: string): Promise<ResolvedSettings> {
  try {
    const { data, error } = await db.from('print_upscale_settings').select('*')
    if (error || !data) throw new Error(error?.message || 'no_data')
    return resolveSettings(data, sku, family)
  } catch (e) {
    console.error('[print-upscale] settings unreadable — using built-in defaults:', e instanceof Error ? e.message : e)
    return { settings: { ...DEFAULT_SETTINGS }, version: 0, sources: ['builtin'] }
  }
}
