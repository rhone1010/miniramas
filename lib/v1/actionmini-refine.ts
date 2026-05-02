// lib/v1/actionmini-refine.ts
// Render-refinement support for Action Minis.
//
// Flow:
//   1. User clicks Refine on a tile after a render lands.
//   2. UI calls /api/v1/actionmini/analyze-render with source + rendered images.
//   3. GPT-4o compares them, returns a single short adjustment suggestion (≤150 chars).
//   4. UI shows the suggestion in an editable input.
//   5. User confirms (possibly edited). UI re-runs the same generate endpoint with
//      the original preset + a refinement_tweak field.
//   6. Generate endpoint appends the REFINEMENT_GUARD_BLOCK + tweak to the prompt
//      and calls nano banana. Same prompt scaffolding as before, just with the
//      user's correction added at the very end.
//
// The 150-char cap is enforced both by GPT-4o's prompt and by route-side validation.
// In-scope adjustments: pose, expression, visible equipment, gesture, body angle.
// Out-of-scope: identity changes, facial features, additions, removals, scene/lighting/material.

import OpenAI from 'openai'

// ── REFINEMENT GUARD BLOCK ───────────────────────────────────
// Appended to the prompt right before the user's tweak text. Tells nano banana
// the tweak is a CORRECTION to a prior render, scopes what kinds of changes
// are valid, and reinforces the rules the original prompt established.
//
// This goes LAST in the prompt — highest attention weight — to ensure the
// correction overrides whatever produced the wrong result the first time,
// while the guard prevents the user from drifting outside scope.
export const REFINEMENT_GUARD_BLOCK = `
USER REFINEMENT (HIGHEST PRIORITY ADJUSTMENT):
The previous render of this prompt produced a result that needed correction.
The line below describes the specific adjustment to make on this re-render.
Honor the adjustment exactly while keeping every other rule from the prompt above intact:
- Same material, same staging, same lighting, same scene, same composition.
- The figure's identity (face, body, age, ethnicity) stays exactly as before — only the requested adjustment changes.
- Do NOT add anything not present in the source photograph.
- Do NOT remove anything that should be present per the prompt above.
- The adjustment is for pose, expression, visible equipment, body angle, or gesture only.
`.trim()

// ── ANALYZE-RENDER ───────────────────────────────────────────
// GPT-4o sees source photo + rendered miniature, identifies the most important
// thing that's off, returns a 150-char adjustment instruction.

const ANALYZE_PROMPT = `You are reviewing a rendered miniature sculpture against the source photograph it was supposed to be based on.

The miniature should preserve the source's POSE, EXPRESSION, BODY ANGLE, and VISIBLE EQUIPMENT (helmets, gear, gloves, knee dragging, leaning, racing tuck, etc.) — even though the material has changed (resin, bronze, wax, etc.).

Compare the two images. Identify the SINGLE MOST IMPORTANT thing that is wrong about the miniature's pose, expression, body angle, or equipment compared to the source.

Respond with ONE short adjustment instruction:
- Maximum 150 characters
- Start with "Adjust" or "Show"
- Be specific and actionable
- Focus on pose / body angle / expression / visible equipment ONLY
- Do NOT suggest changes to identity, face shape, age, ethnicity, additions, or removals
- Do NOT mention the material, lighting, base, or surrounding scene

If the miniature looks substantially correct, respond exactly: "No adjustment needed."

Examples of good responses:
- "Adjust pose to leaning hard into a corner with right knee dragging the ground, racing tuck"
- "Show rider's body lower over the tank, head tucked behind windscreen"
- "Adjust arms to be raised overhead in victory rather than at sides"

Respond with ONLY the instruction, nothing else.`

export async function analyzeRender(input: {
  sourceImageB64:   string
  renderedImageB64: string
  openaiApiKey:     string
}): Promise<{ suggestion: string; needsAdjustment: boolean }> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 80,    // ≥150 chars budget plus tokenization overhead
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`,   detail: 'high' } },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${input.renderedImageB64}`,  detail: 'high' } },
        { type: 'text', text: ANALYZE_PROMPT },
      ],
    }],
  })

  let suggestion = (response.choices[0]?.message?.content || '').trim()

  // Strip surrounding quotes nano banana sometimes returns
  suggestion = suggestion.replace(/^["']|["']$/g, '').trim()

  // Hard cap at 150 chars even if GPT-4o went over
  if (suggestion.length > 150) {
    suggestion = suggestion.slice(0, 147) + '...'
  }

  const needsAdjustment = !/^no adjustment needed/i.test(suggestion)
  return { suggestion, needsAdjustment }
}

// ── TWEAK SANITIZER ──────────────────────────────────────────
// Used by route to clean user-provided tweak text before it lands in the prompt.
// Cap at 150 chars, strip control characters, no newlines (single-line scope).
export function sanitizeTweak(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  let s = raw.trim()
  if (!s) return undefined
  s = s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ')
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x1F\x7F]/g, '')
  if (s.length > 150) s = s.slice(0, 150)
  return s || undefined
}
