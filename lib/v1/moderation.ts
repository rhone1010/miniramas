// moderation.ts
// lib/v1/moderation.ts
//
// Pre-flight image moderation. Runs BEFORE any analyzer or generator.
// Uses gpt-4o-mini as a fast vision classifier — much cheaper than gpt-4o
// and the response time is sub-second.
//
// Three outcome categories:
//   - 'allowed'  — proceed normally, no flags
//   - 'soft'     — reject this image but invite trying another (gray-area or
//                   commonly-false-positive cases). User can immediately upload
//                   a different photo.
//   - 'hard'     — reject and never offer retry on this image. Categories that
//                   are unambiguously off-limits (CSAM, real gore, etc).
//
// IMPORTANT: We NEVER store the image content itself. Only the moderation
// outcome (category + reason + hash) is logged for pattern analysis.

import OpenAI from 'openai'
import crypto from 'crypto'

export type ModerationCategory =
  | 'allowed'
  | 'csam'                    // hard
  | 'real_gore'               // hard
  | 'hate_extremism'          // hard
  | 'real_person_compromised' // hard
  | 'weapons'                 // soft
  | 'nudity'                  // soft
  | 'violent_action'          // soft (wrestling, MMA OK by config)
  | 'drugs'                   // soft
  | 'unclear'                 // soft

export type ModerationVerdict = 'allowed' | 'hard' | 'soft'

export interface ModerationResult {
  allowed:    boolean
  verdict:    ModerationVerdict
  category:   ModerationCategory
  reason:     string                  // human-readable, shown to user
  imageHash:  string                  // sha256 of the b64 — used for pattern logs, NEVER the image itself
  modelUsed:  string                  // for debugging
}

// ── CATEGORY → VERDICT MAP ──────────────────────────────────
// Hard categories: never accept, even on retry
// Soft categories: reject this image, user can upload another
// Allowed action sports (wrestling, MMA, boxing) are explicitly NOT in the list
// — they are valid Action Mini subjects and must pass the soft 'violent_action'
// gate. The classifier prompt below distinguishes sport from real violence.
const HARD_CATEGORIES = new Set<ModerationCategory>([
  'csam',
  'real_gore',
  'hate_extremism',
  'real_person_compromised',
])

// ── PROMPT ──────────────────────────────────────────────────
// We pass the image to gpt-4o-mini and ask for a one-token category.
// Note the explicit allowlist of sport-violence so wrestling/MMA pass.
const MODERATION_PROMPT = `You are an image moderation classifier. Look at this image and respond with EXACTLY ONE of these category strings, nothing else:

"allowed" — Image is safe to process.

"csam" — The image contains any sexualized depiction of a minor (anyone who appears under 18). This includes suggestive poses, nudity, or romantic contexts involving anyone who looks young. ZERO TOLERANCE.

"real_gore" — Real-world graphic injury, death, severe wounds, or visible internal anatomy. NOT sport contact (boxing, MMA, wrestling), NOT minor scrapes/bruises, NOT artistic violence (movies, fictional).

"hate_extremism" — Visible Nazi imagery, KKK robes, ISIS flags, or other recognized extremist hate symbols/uniforms. NOT historical educational context that incidentally shows such imagery.

"real_person_compromised" — A clearly identifiable real person (politician, celebrity, named individual) shown in a sexual, demeaning, or degrading context. Casual photos of real people are fine.

"weapons" — Firearms, explosives, or weapons featured prominently. Hunting/sport context still flagged. NOT toy weapons, NOT historical/military photography, NOT video game screenshots.

"nudity" — Visible adult nudity (sexual or non-sexual). Beach photos in swimwear are NOT nudity. Breastfeeding/medical/art context still flagged.

"violent_action" — Real-world violence, fighting, attacks. NOT sanctioned sport contact (wrestling, judo, BJJ, MMA, boxing, taekwondo, karate, fencing, hockey checks, football tackles, rugby) — those are ALWAYS "allowed" because they are valid sport subjects.

"drugs" — Illegal drug use, drug paraphernalia clearly displayed. NOT alcohol, NOT prescription pill bottles, NOT cigarettes/vapes.

"unclear" — Image quality too low or content too ambiguous to classify confidently.

Respond with ONLY the category string. No explanation. No punctuation. No quotes.`

// ── HUMAN-READABLE REASONS ──────────────────────────────────
// Shown to the user when their image is rejected.
// Keep these honest, brief, non-accusatory. They explain WHAT was detected
// without telling the user what to do — the UI handles "try another photo."
const REASONS: Record<ModerationCategory, string> = {
  allowed:                 '',
  csam:                    'Images involving minors in inappropriate contexts cannot be processed.',
  real_gore:               'Images depicting real-world graphic injury or death cannot be processed.',
  hate_extremism:          'Images containing extremist or hate symbols cannot be processed.',
  real_person_compromised: 'Images of identifiable real people in compromising contexts cannot be processed.',
  weapons:                 'Images featuring weapons cannot be processed for Mini generation.',
  nudity:                  'Images containing nudity cannot be processed.',
  violent_action:          'Images depicting real-world violence cannot be processed. (Sanctioned sport contact like wrestling, MMA, or boxing is fine.)',
  drugs:                   'Images depicting illegal drug use cannot be processed.',
  unclear:                 'Image quality or content is unclear — try a different photo.',
}

// ── MAIN ENTRY POINT ────────────────────────────────────────
export async function moderateUploadedImage(input: {
  imageB64:     string
  openaiApiKey: string
}): Promise<ModerationResult> {

  // Hash the image for pattern logs — used as a stable key without storing content
  const imageHash = crypto.createHash('sha256').update(input.imageB64).digest('hex').slice(0, 16)

  try {
    const openai = new OpenAI({ apiKey: input.openaiApiKey })
    const response = await openai.chat.completions.create({
      model:      'gpt-4o-mini',  // fast + cheap, image-capable
      max_tokens: 12,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${input.imageB64}`, detail: 'low' },
          },
          { type: 'text', text: MODERATION_PROMPT },
        ],
      }],
    })

    const raw = response.choices[0]?.message?.content?.trim().toLowerCase() || ''
    const category = parseCategory(raw)

    if (category === 'allowed') {
      return {
        allowed:   true,
        verdict:   'allowed',
        category:  'allowed',
        reason:    '',
        imageHash,
        modelUsed: 'gpt-4o-mini',
      }
    }

    const verdict: ModerationVerdict = HARD_CATEGORIES.has(category) ? 'hard' : 'soft'
    console.log(`[moderation] ${verdict.toUpperCase()} block — category=${category} hash=${imageHash}`)

    return {
      allowed:   false,
      verdict,
      category,
      reason:    REASONS[category] || REASONS.unclear,
      imageHash,
      modelUsed: 'gpt-4o-mini',
    }

  } catch (err: any) {
    // If moderation fails, FAIL OPEN with a soft warning logged.
    // Failing closed would block legitimate users on transient errors.
    // Hard categories are extremely rare; the trade-off favors availability.
    console.error('[moderation] classifier call failed — failing open:', err.message)
    return {
      allowed:   true,
      verdict:   'allowed',
      category:  'allowed',
      reason:    '',
      imageHash,
      modelUsed: 'fail_open',
    }
  }
}

// ── HELPERS ─────────────────────────────────────────────────

function parseCategory(raw: string): ModerationCategory {
  // Strip quotes/whitespace/punctuation and exact-match
  const cleaned = raw.replace(/[^a-z_]/g, '')
  const valid: ModerationCategory[] = [
    'allowed', 'csam', 'real_gore', 'hate_extremism', 'real_person_compromised',
    'weapons', 'nudity', 'violent_action', 'drugs', 'unclear',
  ]
  for (const c of valid) {
    if (cleaned === c) return c
  }
  // If model returned something unexpected, treat as unclear (soft block)
  console.warn(`[moderation] unexpected classifier output: "${raw}" — treating as unclear`)
  return 'unclear'
}
