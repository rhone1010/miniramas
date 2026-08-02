// lib/v1/portraits/style-refs.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// CENG-OWNED. STYLE REFERENCE PLATE LOADER.
//
// SERVER ONLY. These are the full-resolution plates. They are never web-served
// and must never be imported into anything that reaches the browser. The 400px
// public copies live at public/previews/effects/<id>/ and are a separate tree.
//
// Layout on disk:
//   lib/v1/portraits/style-refs/<effect_id>/1_man.jpg
//   lib/v1/portraits/style-refs/<effect_id>/2_woman.jpg
//
// COSTUME VARIANTS. The Another Age effects are gendered pairs — `victorian`
// and `victorian_woman` — but both genders were shot into the BASE folder:
//
//   style-refs/victorian/1_woman.jpg  2_woman.jpg  3_woman.jpg  4_man.jpg
//
// So `victorian_woman` has no folder of its own. Rather than move files, this
// loader resolves a `_woman` id to its base folder and selects plates whose
// filename carries the matching subject word. `_woman` is not a substring of
// `_man`, so the two never cross-match.
//
// When a folder holds no plate for the requested subject, the full set is
// returned rather than nothing — a reference of the wrong gender still teaches
// the period, costume and lighting, which is most of what the plate is for.
//
// Cache is process-lifetime and unbounded by design: 92 plates at ~21.6 MB is
// a fixed, known ceiling and the files never change at runtime.
// ─────────────────────────────────────────────────────────────────────────────

import fs   from 'fs'
import path from 'path'

/** NB2 accepts 14 images total. One source plus this. */
export const MAX_STYLE_REFS = 2

const ROOT = path.join(process.cwd(), 'lib', 'v1', 'portraits', 'style-refs')

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])

export type Subject = 'man' | 'woman'

interface Plate {
  name: string
  b64:  string
}

/** folder name -> plates in sorted filename order. */
const cache = new Map<string, Plate[]>()

/** Warnings are logged once per key, not once per render. */
const warned = new Set<string>()

function warnOnce(key: string, msg: string): void {
  if (warned.has(key)) return
  warned.add(key)
  console.warn(msg)
}

/**
 * Effect id -> the folder its plates actually live in, plus the subject to
 * select for. `victorian_woman` -> { folder: 'victorian', subject: 'woman' }.
 * A base costume id resolves to itself with subject 'man'; a material effect
 * resolves to itself with no subject at all.
 */
export function resolvePlateSource(effectId: string): {
  folder:   string
  subject?: Subject
} {
  if (effectId.endsWith('_woman')) {
    const base = effectId.slice(0, -'_woman'.length)
    // Own folder wins when one exists — a future split needs no code change.
    if (fs.existsSync(path.join(ROOT, effectId))) {
      return { folder: effectId, subject: 'woman' }
    }
    return { folder: base, subject: 'woman' }
  }
  return { folder: effectId }
}

/** Every plate in a folder, sorted by filename, base64-encoded. */
function readFolder(folder: string): Plate[] {
  const cached = cache.get(folder)
  if (cached) return cached

  const dir = path.join(ROOT, folder)

  let names: string[]
  try {
    names = fs.readdirSync(dir)
  } catch {
    warnOnce(folder, `[style-refs] no plate folder "${folder}" at ${dir}`)
    cache.set(folder, [])
    return []
  }

  const files = names
    .filter(n => IMAGE_EXT.has(path.extname(n).toLowerCase()))
    .sort()

  if (files.length === 0) {
    warnOnce(folder, `[style-refs] plate folder "${folder}" is empty`)
  }

  const plates: Plate[] = []
  for (const name of files) {
    try {
      plates.push({
        name,
        b64: fs.readFileSync(path.join(dir, name)).toString('base64'),
      })
    } catch (e: any) {
      console.warn(`[style-refs] failed to read ${folder}/${name}: ${e?.message}`)
    }
  }

  cache.set(folder, plates)
  console.log(`[style-refs] loaded ${plates.length} plate(s) from "${folder}"`)
  return plates
}

export interface StyleRefOptions {
  /** Override the subject inferred from the effect id. */
  subject?: Subject
  /** Default MAX_STYLE_REFS. */
  limit?: number
}

/**
 * Style reference plates for an effect, as base64 strings ready for NB2.
 * Returns [] when the effect has no folder — never throws. An effect with no
 * plates renders from its prompt body alone.
 */
export function loadStyleRefs(effectId: string, opts: StyleRefOptions = {}): string[] {
  const limit = opts.limit ?? MAX_STYLE_REFS
  if (limit <= 0) return []

  const resolved = resolvePlateSource(effectId)
  const subject  = opts.subject ?? resolved.subject

  const plates = readFolder(resolved.folder)
  if (plates.length === 0) return []

  if (subject) {
    const token   = `_${subject}`
    const matched = plates.filter(p => p.name.toLowerCase().includes(token))
    if (matched.length > 0) {
      return matched.slice(0, limit).map(p => p.b64)
    }
    warnOnce(
      `${resolved.folder}:${subject}`,
      `[style-refs] no "${subject}" plate in "${resolved.folder}" — ` +
      `falling back to the full set`,
    )
  }

  return plates.slice(0, limit).map(p => p.b64)
}

/** Plate count without encoding. For the registry's refs: field and for QA. */
export function countStyleRefs(effectId: string): number {
  const resolved = resolvePlateSource(effectId)
  let names: string[]
  try {
    names = fs.readdirSync(path.join(ROOT, resolved.folder))
  } catch {
    return 0
  }
  const files = names.filter(n => IMAGE_EXT.has(path.extname(n).toLowerCase()))
  if (!resolved.subject) return files.length
  const token   = `_${resolved.subject}`
  const matched = files.filter(n => n.toLowerCase().includes(token))
  return matched.length > 0 ? matched.length : files.length
}

/** Test hook. Not called in the request path. */
export function clearStyleRefCache(): void {
  cache.clear()
  warned.clear()
}
