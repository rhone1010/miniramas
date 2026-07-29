// lib/v1/portraits/portraits-shared-helpers.ts
//
// Small helper utilities for the Portraits silo. Kept separate from
// portraits-shared.ts so the types file stays type-only. Mirrors
// groups-shared-helpers.ts.

// ── PROMPT ASSEMBLY ──────────────────────────────────────────
// Final prompt = preset line + optional notes appended on a fresh line.
export function assemblePrompt(input: {
  presetLine: string
  notes?:     string
}): string {
  if (input.notes?.trim()) {
    return `${input.presetLine}\n\n${input.notes.trim()}`
  }
  return input.presetLine
}
