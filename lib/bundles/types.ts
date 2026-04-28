// bundles/types.ts
// lib/bundles/types.ts
//
// Shared bundle types. The DB stores snake_case; everything above the
// fetch layer uses camelCase. See lib/bundles/repo.ts for the translation.

import type { SceneStyle, SceneVariant } from '@/lib/v1/group-generator'

export type BundleItemMode = 'fixed' | 'choose'

export interface ChooseOption {
  style:   SceneStyle
  variant: SceneVariant
  label:   string
}

export interface BundleItem {
  id:             string
  position:       number
  mode:           BundleItemMode
  fixedStyle?:    SceneStyle
  fixedVariant?:  SceneVariant
  chooseLabel?:   string
  chooseOptions?: ChooseOption[]
}

export interface Bundle {
  id:           string
  slug:         string
  name:         string
  tagline:      string | null
  priceCents:   number
  displayOrder: number
  isActive:     boolean
  items:        BundleItem[]
}

// ── Admin write payloads ─────────────────────────────────────────

export interface BundleItemInput {
  mode:           BundleItemMode
  fixedStyle?:    SceneStyle
  fixedVariant?:  SceneVariant
  chooseLabel?:   string
  chooseOptions?: ChooseOption[]
}

export interface BundleInput {
  slug:         string
  name:         string
  tagline:      string | null
  priceCents:   number
  displayOrder: number
  isActive:     boolean
  items:        BundleItemInput[]
}
