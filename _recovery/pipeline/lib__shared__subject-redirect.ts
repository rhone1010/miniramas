// lib/shared/subject-redirect.ts
//
// Subject classification + Series redirect.
//
// PRODUCTION-BOUND CODE. This file lives in lib/shared (not lib/bench)
// because the whole point is that the bench and the live upload flow
// run the SAME classifier — the bench validates the exact behavior
// customers will get. The bench imports it; the Series upload routes
// import it; nobody forks it.
//
// Behavior: classify what the photo is actually of, compare against
// the Series the customer is standing in, and on mismatch produce
// (a) a machine tag for logging/QA and (b) ready-to-ship user-facing
// copy offering the right Series.
//
// Copy rules honored here (locked brand vocabulary):
//   * "craft" is the verb — a photo is never "rendered" user-facing
//   * Series names capitalized, always "Series"
//   * CTA pattern: "Step Inside [Series Name]"
//   * Plain, warm language — no apology, no tech terms

import OpenAI from 'openai'

// ─── TAXONOMY ────────────────────────────────────────────────────

export const SUBJECT_TYPES = [
  'person_single',      // one hero person
  'person_group',       // two or more hero people
  'pet_animal',         // dog, cat, horse, bird — a companion animal as the subject
  'house_building',     // a home, building, or structure as the subject
  'landscape_place',    // a scene/vista/place where no single structure dominates
  'object_other',       // vehicles, food, products, abstract — none of the above
] as const

export type SubjectType = typeof SUBJECT_TYPES[number]

export type RedirectSeriesId =
  | 'portraits' | 'groups' | 'actionmini' | 'pets'
  | 'houses' | 'landscapes' | 'forfun' | 'artist'

export const SERIES_DISPLAY_NAMES: Record<RedirectSeriesId, string> = {
  portraits:  'Portrait',
  groups:     'Groups',
  actionmini: 'Action',
  pets:       'Pets',
  houses:     'Houses',
  landscapes: 'Landscapes',
  forfun:     'For Fun',
  artist:     'The Artist Series',
}

// What each Series accepts. For Fun and The Artist Series accept
// everything by design — they're the playgrounds. Tighten later if
// product says otherwise.
export const SERIES_ACCEPTS: Record<RedirectSeriesId, ReadonlyArray<SubjectType>> = {
  portraits:  ['person_single'],
  groups:     ['person_group'],
  actionmini: ['person_single', 'person_group'],   // activity refines, not gates
  pets:       ['pet_animal'],
  houses:     ['house_building'],
  landscapes: ['landscape_place'],
  forfun:     [...SUBJECT_TYPES],
  artist:     [...SUBJECT_TYPES],
}

// Where a mismatched subject SHOULD go. Activity flag refines the
// person cases toward Action.
export function bestSeriesFor(
  subject: SubjectType,
  activityDetected: boolean,
): RedirectSeriesId | null {
  switch (subject) {
    case 'person_single':  return activityDetected ? 'actionmini' : 'portraits'
    case 'person_group':   return activityDetected ? 'actionmini' : 'groups'
    case 'pet_animal':     return 'pets'
    case 'house_building': return 'houses'
    case 'landscape_place':return 'landscapes'
    case 'object_other':   return null   // no confident home — tag only, let the user decide
  }
}

// ─── CLASSIFIER ──────────────────────────────────────────────────

const CLASSIFY_PROMPT = `You are identifying what a customer photograph is primarily of, so a studio can guide it to the right art collection.

Decide the single dominant subject — the thing the photograph is clearly about:
- person_single: one hero person
- person_group: two or more hero people together
- pet_animal: a companion animal (dog, cat, horse, bird) as the subject
- house_building: a home, building, or structure as the subject
- landscape_place: a vista, garden, beach, mountain, or scene where the place itself is the subject and no single structure dominates
- object_other: vehicles, food, products, or anything else

Also note whether the subject is engaged in a clear physical activity (sport, dance, climbing, riding — distinct from standing or posing).

Respond with ONLY a JSON object:
{
  "subject_type": "<one value from the list, verbatim>",
  "activity_detected": <boolean>,
  "confidence": <integer 1-10, how unambiguous the dominant subject is>,
  "description": "<5-10 plain words naming what you see, e.g. 'a craftsman bungalow with a porch'>"
}

Respond with ONLY the JSON. No preamble.`

export interface SubjectClassification {
  subjectType:      SubjectType
  activityDetected: boolean
  confidence:       number          // 1-10
  description:      string          // feeds the user-facing copy
}

export async function classifySubject(input: {
  sourceImageB64: string
  openaiApiKey:   string
}): Promise<SubjectClassification> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model:      'gpt-4o-mini',
    max_tokens: 120,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`, detail: 'low' } },
        { type: 'text', text: CLASSIFY_PROMPT },
      ],
    }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  let parsed: any = {}
  try { parsed = JSON.parse(content) } catch { /* defaults below */ }

  const raw = String(parsed.subject_type || 'object_other')
  const subjectType: SubjectType =
    (SUBJECT_TYPES as readonly string[]).includes(raw) ? raw as SubjectType : 'object_other'

  return {
    subjectType,
    activityDetected: Boolean(parsed.activity_detected),
    confidence:       Math.max(1, Math.min(10, Number(parsed.confidence) || 5)),
    description:      String(parsed.description || 'this photograph').slice(0, 120),
  }
}

// ─── REDIRECT DECISION ───────────────────────────────────────────

export interface RedirectDecision {
  match:           boolean
  detected:        SubjectClassification
  currentSeries:   RedirectSeriesId
  redirectSeries:  RedirectSeriesId | null
  // Ready-to-ship user-facing strings (null when match=true or no
  // confident destination). Frontend renders verbatim.
  userMessage:     string | null
  ctaLabel:        string | null      // "Step Inside Houses"
  stayLabel:       string | null      // secondary action — craft here anyway
}

// Low-confidence classifications never redirect. A wrong redirect is
// worse UX than a soft render attempt — the customer told us where
// they want to be.
export const REDIRECT_MIN_CONFIDENCE = 7

export function decideRedirect(input: {
  classification: SubjectClassification
  currentSeries:  RedirectSeriesId
}): RedirectDecision {
  const { classification, currentSeries } = input
  const accepted = SERIES_ACCEPTS[currentSeries]
  const match = accepted.includes(classification.subjectType)

  if (match || classification.confidence < REDIRECT_MIN_CONFIDENCE) {
    return {
      match: true,   // treated as match downstream; low confidence = benefit of the doubt
      detected: classification,
      currentSeries,
      redirectSeries: null,
      userMessage: null, ctaLabel: null, stayLabel: null,
    }
  }

  const redirectSeries = bestSeriesFor(classification.subjectType, classification.activityDetected)

  if (!redirectSeries || redirectSeries === currentSeries) {
    // Mismatch with no confident home: tag for QA, but don't block or
    // confuse the customer with a destination we're not sure about.
    return {
      match: false,
      detected: classification,
      currentSeries,
      redirectSeries: null,
      userMessage: null, ctaLabel: null, stayLabel: null,
    }
  }

  const fromName = SERIES_DISPLAY_NAMES[currentSeries]
  const toName   = SERIES_DISPLAY_NAMES[redirectSeries]

  return {
    match: false,
    detected: classification,
    currentSeries,
    redirectSeries,
    userMessage:
      `We see ${classification.description} in your photograph. ` +
      `The ${fromName} Series is made for ${seriesSubjectPhrase(currentSeries)} — ` +
      `a photograph like this truly shines in our ${toName} Series.`,
    ctaLabel:  `Step Inside ${toName}`,
    stayLabel: `Craft it in ${fromName} anyway`,
  }
}

// Plain-language phrase for what each Series is "made for".
function seriesSubjectPhrase(series: RedirectSeriesId): string {
  switch (series) {
    case 'portraits':  return 'a single person'
    case 'groups':     return 'people together'
    case 'actionmini': return 'people in motion'
    case 'pets':       return 'animal companions'
    case 'houses':     return 'homes and buildings'
    case 'landscapes': return 'places and scenery'
    case 'forfun':     return 'anything you can imagine'
    case 'artist':     return 'artful experiments'
  }
}
