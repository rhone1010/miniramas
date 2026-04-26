// sportsmem-stadium-tableau.ts
// lib/v1/sportsmem-stadium-tableau.ts
//
// BASELINE — stripped to pure miniature diorama using the museum preset from landscapes.
// No subject logic, no people logic, no sports context, no mode switching, no wrapper.
// Goal: prove margins work first, then build subjects/context back on top.

export type MiniramaMode = 'memory' | 'miniature'

export interface StadiumTableauInput {
  sourceImageB64:    string
  mode?:             MiniramaMode   // accepted but ignored at baseline
  plaqueText?:       string          // accepted but ignored at baseline
  sport?:            string          // accepted but ignored at baseline
  mood?:             string          // accepted but ignored at baseline
  subjectCount?:     number          // accepted but ignored at baseline
  sceneDescription?: string          // accepted but ignored at baseline
  notes?:            string          // accepted but ignored at baseline
}

// ── BASELINE PROMPT ──────────────────────────────────────────
// Cardboard cutouts. Staggered depth. People only — no stadium structure.
const BASELINE_PROMPT = `Convert the image into thin printed cardboard cutouts — flat illustrated panels with crisp die-cut edges and a slight white border, like custom-printed standee stickers or trading-card-style cutouts.

Each person is its own separate cardboard cutout. Each row of seating is its own separate cardboard cutout.

The cutouts are arranged in staggered depth — each row stands behind the row in front of it with a clear physical gap between them. The couple is the front-most row, full size and detailed. Behind them, a second row of three or four individual fan cutouts, each slightly smaller. Behind that, a third row of more fans, smaller still. Behind that, a fourth row, smaller again. The rows continue receding all the way back, with figures becoming progressively smaller and tighter together with distance — at least six or seven rows total, fading toward the back.

Each row casts a soft shadow onto the row behind it, making the staggered separation visible. The cutouts stand on a plain neutral surface. No stadium walls, no roof, no background structure — only the staggered people and seating cutouts.

Printed illustration on thin board. Visible cut edges. Standing pieces. Real depth through real physical staggering.`

export function buildStadiumTableauPrompt(_input: StadiumTableauInput): string {
  return BASELINE_PROMPT
}
