// lib/store/portraits-style-lookup.ts
//
// generatePortraitsRender needs BOTH style_id and preset_id. Basket
// items only carry a preset id (from effect-registry.ts, which has no
// style concept at all - it is silo-based). This file bridges that gap.
//
// BUILT FROM PROJECT-KNOWLEDGE portraits-shared.ts, NOT LIVE-VERIFIED
// THIS SESSION. Same class of risk as the effect-registry 'beaded' drift
// - confirm against the real file before trusting this for anything but
// an initial build. Verify with:
//   Get-Content lib\v1\portraits\portraits-shared.ts | Select-String "STYLE_MATERIALS" -Context 0,40
//
// The mapping (as read): STYLE_MATERIALS.realistic contains nearly every
// preset in the catalog. STYLE_MATERIALS.artists_gallery contains exactly
// seven: impressionist, watercolour, charcoal_chalk, sheet_music,
// pencil_sketch, oil_impasto, linocut. STYLE_MATERIALS.people_resolving
// contains four (bronze, iron, stone, ebony) that ALSO appear under
// realistic - Discover baskets pull from the full effect-registry catalog,
// which has no style axis, so there is no signal telling us the customer
// meant people_resolving for those four. Defaulting them to 'realistic'
// is a real choice, not a neutral one - flagging it as such rather than
// treating it as obviously correct.

const ARTISTS_GALLERY_PRESETS = new Set([
  'impressionist', 'watercolour', 'charcoal_chalk', 'sheet_music',
  'pencil_sketch', 'oil_impasto', 'linocut',
])

export function styleIdForPreset(presetId: string): 'realistic' | 'artists_gallery' {
  return ARTISTS_GALLERY_PRESETS.has(presetId) ? 'artists_gallery' : 'realistic'
}
