// lib/v1/curator/standout.ts
//
// SCORES A CRAFTED PIECE FOR "WOULD A STRANGER STOP ON THIS".
//
// A different question from every other scorer in this repo. The Groups
// scorer asks whether a render looks like the people in the source, and a
// piece can score ten on every figure and still be dull.
//
// This asks whether the thing is worth showing to somebody who has never
// met the people in it.
//
// ── IT SAMPLES, IT DOES NOT SWEEP ──────────────────────────────────────
//
// Five pieces at random from the collection, scored until one reaches the
// bar, then stop. Not the whole collection.
//
// Three reasons, and the third is the one that matters:
//
//   Cost. Five vision calls at most, once per session, and usually one or
//   two because the hit rate is good.
//
//   Nothing is scored that nobody looks at. The work happens when the
//   customer is present and there is something to say.
//
//   NO PERMANENT VERDICT. A fresh sample each session means a piece that
//   missed the cut can come up again. Scoring the whole collection once
//   would file every piece under a number, and some of those numbers would
//   be low, and they would be low about photographs of people's families.
//
// ── IF NOTHING CLEARS THE BAR, SHE SAYS NOTHING ────────────────────────
//
// Not another five. The voice doc's own rule is that when in doubt, prefer
// silence — and hunting for something to praise is exactly how she ends up
// praising something ordinary. A session where she does not speak costs
// nothing.
//
// ── THE SCORE NEVER REACHES A BROWSER ──────────────────────────────────
//
// Stored for tuning, returned to no one. The moment a customer can see
// that their family portrait scored 4, you have told them it is not good
// enough, and no Curator line survives that.

import OpenAI from 'openai'

/** The bar. Rich, 19 August: find a 9 out of 10. */
export const STANDOUT_THRESHOLD = 9

/** How many to look at before giving up for this session. */
export const STANDOUT_SAMPLE_SIZE = 5

const STANDOUT_PROMPT = `You are judging a finished art piece for whether it deserves to be shown publicly on a gallery wall, alongside work by strangers.

You are NOT judging likeness. You are not comparing it to a source photograph and you will not be shown one. Assume the people in it are recognisable to those who know them.

Judge only this: would somebody who has never met these people stop scrolling on this image?

SCORE HIGH for:
- A striking or unusual idea, clearly realised
- Material or light doing something genuinely beautiful
- Composition that holds together as a picture, not just as a transformation
- Emotional weight that reads without context

SCORE LOW for:
- Muddy, unclear or confusing rendering
- Visible failure: melted features, wrong number of limbs, garbled text, duplicated faces
- Flat, dull or generic execution of an interesting idea
- Anything where the eye does not know where to land

Be strict. A 9 means genuinely exceptional and worth a stranger's attention. A 7 is a good piece that nobody would stop on. Most competent work is a 6 or 7.

Reply with JSON only, no preamble and no markdown fences:
{
  "score": <integer 1-10>,
  "reason": "<one short clause, describing the PICTURE and never a person>"
}`

export interface StandoutScore {
  score:  number
  reason: string
}

/**
 * Score one piece.
 *
 * `reason` is written to describe the picture rather than anybody in it,
 * because it is the only field that might ever inform something the
 * customer reads. Even so, the Curator does not quote it — she is given
 * the piece and speaks in her own voice.
 */
export async function scoreStandout(input: {
  imageB64:     string
  openaiApiKey: string
}): Promise<StandoutScore> {

  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: STANDOUT_PROMPT },
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${input.imageB64}` },
        },
      ],
    }],
    max_tokens: 200,
  })

  const raw = res.choices[0]?.message?.content ?? ''

  try {
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    const score = Number(parsed.score)
    return {
      score:  Number.isFinite(score) ? Math.max(1, Math.min(10, Math.round(score))) : 0,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    }
  } catch {
    // A parse failure is NOT a low score. It is no score, and the piece is
    // simply passed over — scoring it zero would file a good piece as bad
    // on the strength of a malformed response.
    console.warn('[standout] parse failed')
    return { score: 0, reason: 'scoring unavailable' }
  }
}
