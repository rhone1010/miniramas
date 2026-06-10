// lib/v1/groups/groups-shared-helpers.ts
//
// Small helper utilities for the Groups silo. Kept separate from
// groups-shared.ts so that the types file stays type-only.

// ── PROMPT ASSEMBLY ──────────────────────────────────────────
// Final prompt = preset line + assembled blocks + optional notes.
// Mirrors actionmini-shared.ts assemblePrompt.
export function assemblePrompt(input: {
  presetLine: string
  notes?:     string
}): string {
  if (input.notes?.trim()) {
    return `${input.presetLine}\n\n${input.notes.trim()}`
  }
  return input.presetLine
}
