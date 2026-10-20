// Internal diagnostics contain only public catalog/asset identifiers and allowlisted failure codes.
// Never log exception messages, stacks, artwork paths, signed URLs, or customer/order identifiers.
import bundle from '../../../tools/product-scenes/bundle.next.json'
const codes = new Set(['ENOENT', 'MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND', 'EACCES', 'EINVAL', 'scene_input_shape', 'scene_extension_not_permitted', 'scene_composition_required', 'scene_revision_changed_during_render', 'scene_family_mismatch', 'invalid_scene_input'])
export function sceneErrorDiagnostic(error: unknown): { code: string; dependency?: string } {
  const e = error as { code?: unknown; message?: unknown }
  const message = typeof e?.message === 'string' ? e.message.replace(/\\/g, '/') : ''
  const code = typeof e?.code === 'string' && codes.has(e.code) ? e.code : codes.has(message) ? message : 'scene_operation_failed'
  const dependency = bundle.files.find(f => message.includes(f.path))?.path
  return { code, ...(dependency ? { dependency } : {}) }
}
export type SceneDiagnostic = { sceneId?: string; stage: string; reason: string; code?: string; dependency?: string; openingAspect?: number; productAspect?: number; extension?: number }
export function logSceneDiagnostic(sku: string, event: SceneDiagnostic): void {
  console.warn('[gift/mockup] scene fallback', { sku, ...event })
}
