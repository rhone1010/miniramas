// lib/v1/groups/groups-prompt.ts
//
// Minimal prompt builder for the Groups silo.
//
// NB2 (google/nano-banana-2 on Replicate) understands a sentence like
// "group photo rendered as 3D bronze statue" natively — it produces clean,
// recognizable, multi-figure sculptural renders without any of the prompt
// machinery the silo used to ship with (700+ lines of emergence blocks,
// merging blocks, face rules, plinth instructions, per-subject descriptors,
// height-class warnings, etc.). Every one of those blocks was fighting the
// model rather than helping it.
//
// Empirically validated on:
//   - 12-subject wedding party, navy + sage, well-lit outdoors → spot on
//   - 17-subject multi-generation family with four toddlers in laps → spot on,
//     including correct child proportions which the old pipeline needed
//     explicit HEIGHT_CLASS guard language to maintain
//
// The whole assembled prompt is between 11 and 17 words. NB2 figures out:
//   - exact subject count (no need to interpolate it)
//   - per-figure likeness (faceswap is no longer the default)
//   - child vs adult proportions
//   - plinth / base shape and material
//   - surrounding setting / lighting / props from the location phrase
//
// If a render misses likeness on a particular face, that's the analyzer's
// job to flag and the user's decision via the QA gate — not something this
// prompt should try to prevent with directives the model would just ignore.

import type { GroupsPresetId, LocationId, Scale } from './groups-shared'
import { DEFAULT_PLAQUE_TEXT } from './groups-shared'

const MATERIAL_PHRASE: Record<GroupsPresetId, string> = {
  bronze:       'bronze statue',
  alabaster:    'alabaster statue',
  marble:       'marble statue',
  terracotta:   'terracotta sculpture',
  wax:          'translucent wax sculpture',
  wood:         'carved wood statue',
  iron:         'hand-forged iron sculpture',
  resin:        'hand-painted resin figurine',
  plushy:       'soft handmade plushy figures',
}

// Location phrases are written as directorial cues, not just labels. Each
// captures the staging the silo is selling — scale, framing, lighting,
// background register. NB2 reliably picks these up when phrased as visual
// nouns rather than abstract design language.
//
// Tea House — the sculpture is on a small Japanese display base inside a
//   traditional tea house. The view is filled by the sculpture but the
//   "scaled like a tabletop model" cue keeps it from filling the room.
//   Cherry blossoms outside the shoji screens set the aesthetic register.
//
// Mantel — sculpture is the hero on an elegant marble mantel. The great
//   room behind it (skylights, ornate trim) is softly blurred so the
//   sculpture stays the focal subject. No directive about the mirror —
//   trust the model to handle reflection logic.
//
// Pedestal — round marble pedestal in a museum gallery. Gallery lighting
//   PLUS a volumetric beam from a skylight above. "Natural light from a
//   skylight" implies the source without naming a visible fixture.
//
// Plushy Shelf and Wall Mount remain in the type for API compatibility
// (Art Gallery may pick them up later) but no Groups material routes here.
const LOCATION_PHRASE: Record<LocationId, string> = {
  mantel:       'as the focal subject on an elegant marble mantel in an upscale sun-lit great room with skylights and ornate window trim, the room softly blurred behind the sculpture',
  tea_house:    'on a small Japanese-style display base inside a traditional tea house, scaled like a tabletop model, cherry blossom trees visible through shoji screen doors',
  pedestal:     'on a round marble pedestal in a museum gallery, illuminated by a volumetric beam of natural light streaming from a skylight above',
  plushy_shelf: "on a child's plush-toy shelf",
  wall_mount:   'mounted on a gallery wall',
}

/**
 * Build the prompt sent to NB2 for a Groups render.
 *
 * Scale handling:
 *   - `'fill'`  (UI label "Close Up") — render tight, append composition note
 *   - `'close_up'` (UI label "Margins") — outpaint adds breathing room
 *     post-generation; the prompt stays silent on composition
 *
 * Note that the code values are inverted from the UI labels. This is
 * intentional back-compat (the rename was deferred); don't fix it here.
 *
 * Plaque handling:
 *   - `plaqueText` undefined or empty → DEFAULT_PLAQUE_TEXT ("Liten & Co · 2025")
 *   - `plaqueText` is a string       → inscribe that text verbatim
 *   - `plaqueText` is null           → suppress the plaque entirely
 * We always emit a plaque clause because without one, NB2 spontaneously
 * confabulates a plausible-but-fictional surname ("The Anderson Family
 * Reunion - Autumn 1980"). That's bad for a personalized product —
 * the model invented a name that doesn't belong to the actual user.
 */
export function buildGroupsPrompt(input: {
  presetId:    GroupsPresetId
  locationId:  LocationId
  scale:       Scale
  plaqueText?: string | null
}): string {
  const material    = MATERIAL_PHRASE[input.presetId]
  const location    = LOCATION_PHRASE[input.locationId]
  const composition = input.scale === 'fill' ? ', tight composition' : ''

  let plaqueClause: string
  if (input.plaqueText === null) {
    // Explicit off — positive language ("clean unmarked base") is more
    // reliable than a negative directive at suppressing the plaque.
    plaqueClause = ', with a clean unmarked base'
  } else {
    const text = (input.plaqueText && input.plaqueText.trim()) || DEFAULT_PLAQUE_TEXT
    // Wrap the text in quotes so NB2 inscribes those characters verbatim
    // rather than treating them as descriptive guidance to interpret.
    plaqueClause = `, with a small plaque on the base reading "${text}"`
  }

  return `Group photo rendered as 3D ${material}, ${location}${composition}${plaqueClause}.`
}
