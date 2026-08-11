// lib/v1/_core/text-moderation.ts
//
// TEXT MODERATION, FOR THE COMMUNITY BOARD.
//
// Separate from moderation.ts, which is an IMAGE classifier on gpt-4o-mini
// and is called before a render. This is text: comments, ideas, handles.
// One module could have done both, and then a change to how a photograph is
// judged would have quietly changed how a comment is judged.
//
// WHY THE MODERATION ENDPOINT AND NOT ANOTHER 4o-mini PROMPT
//   It is purpose-built, it is calibrated, and it is free - confirmed against
//   OpenAI's own documentation on 10 August 2026: the endpoint costs nothing
//   and does not count against usage limits. A hand-written classifier prompt
//   costs money per comment and is worse at the job.
//
// THE POSTURE IS THE OPPOSITE OF THE IMAGE CLASSIFIER'S
//   moderation.ts FAILS OPEN, because a transient error there blocks a
//   paying customer's render. This FAILS CLOSED - a comment that could not
//   be classified is HELD, not published. Nobody is blocked from anything
//   they paid for; they wait for the next digest. Publishing unclassified
//   text into a public marketing surface is the worse of the two mistakes.

import OpenAI from 'openai'

export type TextVerdict = 'live' | 'held'

export interface TextModerationResult {
  verdict:  TextVerdict
  reason:   string | null   // internal only - never shown to the person
  category: string | null
  scored:   boolean         // false when the call failed and we held blind
}

// The categories that hold something back. OpenAI returns rather more than
// this; these are the ones the guidelines Rich set actually name - hate
// speech, sexual content, vulgarity, bullying.
//
// `violence` is deliberately absent. This is a portrait studio with rooms
// called Fantasy & Future and effects called Dragon Skin; "the dragon one
// looks like it wants to eat me" is a compliment, and holding it would teach
// people the board is broken.
const HOLD_ON = [
  'sexual',
  'sexual/minors',
  'hate',
  'hate/threatening',
  'harassment',
  'harassment/threatening',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
  'violence/graphic',
]

export async function moderateText(input: {
  text: string
  openaiApiKey?: string
}): Promise<TextModerationResult> {
  const text = (input.text || '').trim()
  if (!text) {
    return { verdict: 'held', reason: 'empty', category: null, scored: false }
  }

  const key = input.openaiApiKey || process.env.OPENAI_API_KEY
  if (!key) {
    console.error('[text-moderation] no OPENAI_API_KEY - holding')
    return { verdict: 'held', reason: 'no_key', category: null, scored: false }
  }

  try {
    const openai = new OpenAI({ apiKey: key })
    const res = await openai.moderations.create({
      model: 'omni-moderation-latest',
      input: text,
    })

    const r = res.results?.[0]
    if (!r) {
      return { verdict: 'held', reason: 'no_result', category: null, scored: false }
    }

    // Read the categories we care about rather than trusting the top-level
    // `flagged`, which is tuned to OpenAI's policy and not to Rich's.
    const cats = (r.categories || {}) as Record<string, boolean>
    const hit = HOLD_ON.find((c) => cats[c] === true)

    if (hit) {
      return { verdict: 'held', reason: 'classifier', category: hit, scored: true }
    }
    return { verdict: 'live', reason: null, category: null, scored: true }

  } catch (err) {
    // HELD, not published. See the note at the top.
    console.error('[text-moderation] call failed - holding:', (err as Error).message)
    return { verdict: 'held', reason: 'error', category: null, scored: false }
  }
}

// ── HANDLES ────────────────────────────────────────────────────────────────
// A handle is not a comment. It appears on every post that person ever makes,
// so it gets the classifier AND a short list of shapes that are a problem
// regardless of what any model says: anything that reads as us.
//
// Impersonating the studio is the one abuse a classifier will never catch,
// because "litenco" is not offensive - it is just not theirs.
const RESERVED = [
  'liten', 'litenco', 'liten_co', 'litenandco', 'thestudio', 'studio',
  'curator', 'theconcierge', 'concierge', 'admin', 'administrator',
  'support', 'help', 'staff', 'official', 'moderator', 'mod',
]

export function handleShapeError(handle: string): string | null {
  const h = (handle || '').trim()
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(h)) {
    return 'Three to twenty characters, letters, numbers, hyphen or underscore.'
  }
  const flat = h.toLowerCase().replace(/[_-]/g, '')
  if (RESERVED.some((r) => flat === r || flat.startsWith(r))) {
    return 'That one is kept for the studio. Try another.'
  }
  return null
}
