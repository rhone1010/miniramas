import { describe, it, expect, vi } from 'vitest'
import { sceneErrorDiagnostic, logSceneDiagnostic } from './scene-diagnostics'
import { resolveScene } from './scenes'
import { getProduct } from '../print/catalog'

describe('private-data-free scene fallback diagnostics', () => {
  it('records the exact missing public dependency without exception details', () => {
    const error = Object.assign(new Error("Cannot find module '/var/task/tools/catalog-samples/scene-replacement-review.next.cjs'\n private-customer-id https://private.test/art?token=secret"), { code: 'MODULE_NOT_FOUND' })
    expect(sceneErrorDiagnostic(error)).toEqual({ code: 'MODULE_NOT_FOUND', dependency: 'tools/catalog-samples/scene-replacement-review.next.cjs' })
    expect(sceneErrorDiagnostic(new Error('private artwork /customer/master.png'))).toEqual({ code: 'scene_operation_failed' })
  })
  it('reports describe failures instead of silently returning scene_unavailable', () => {
    const diagnostic = vi.fn()
    const r = resolveScene(getProduct('canvas:8x8')!, () => { throw Object.assign(new Error("ENOENT /var/task/public/gift-wizard/mockup-scenes/inventory.next.json"), { code: 'ENOENT' }) }, diagnostic)
    expect(r).toEqual({ scene: null, reason: 'scene_unavailable' })
    expect(diagnostic).toHaveBeenCalledWith({ sceneId: 'gallery-canvas-square', stage: 'describe', reason: 'scene_dependency_unavailable', code: 'ENOENT', dependency: 'public/gift-wizard/mockup-scenes/inventory.next.json' })
  })
  it('keeps catalog identifiers and phase in the internal log', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try { logSceneDiagnostic('GLOBAL-CAN-8X8', { stage: 'selection', reason: 'feature_disabled' }); expect(spy).toHaveBeenCalledWith('[gift/mockup] scene fallback', { sku: 'GLOBAL-CAN-8X8', stage: 'selection', reason: 'feature_disabled' }) } finally { spy.mockRestore() }
  })
})
