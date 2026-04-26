// moments-prompt.ts
// lib/v1/moments-prompt.ts
//
// Final Moments prompt — ported verbatim from the MOMENTS MODULE (FINAL) spec.
// Single fixed prompt. No mode switching, no variations, no occasion presets.
// Captures real-life moments involving multiple people as miniature diorama figures.

export interface MomentsInput {
  sourceImageB64:    string
  notes?:            string  // optional fan-supplied context (occasion, names, etc.)
}

const MOMENTS_PROMPT = `Convert the people in the image into scale miniature figurines of themselves.

Likeness comes first. Each person must be clearly recognizable as the specific person from the source photo — preserve face, expression, hair, clothing, pose. Style is secondary. The figurines stand on a small circular wooden display base.`

export function buildMomentsPrompt(input: MomentsInput): string {
  if (input.notes?.trim()) {
    return `${MOMENTS_PROMPT}\n\nADDITIONAL CONTEXT FROM THE PERSON:\n${input.notes.trim()}`
  }
  return MOMENTS_PROMPT
}
