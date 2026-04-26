// group-analyzer.ts
// lib/v1/group-analyzer.ts
//
// PHASE 1 — Sculptor's reference notes for figurines from a group photo.
//
// Richer field schema modeled on the actionmini hero figurine analyzer
// (which produces high-fidelity sculpts) but kept in safe artistic framing.
//
// KEY ADDITIONS over the previous schema:
//   - age_indicators — concrete visual cues (grey hair, smile lines, etc.)
//                      Combats the most common drift: rendering older people
//                      as decades younger than they actually are.
//   - hair_color / hair_style — split out so the generator gets explicit
//                                color guidance separately from style.
//   - facial_hair       — important for older men, was missing.
//   - face_shape        — rough geometric description (oval, round, long).
//   - notable_features  — artistic descriptors (deep-set eyes, full smile).

import OpenAI from 'openai'

export interface PersonIdentity {
  index:            number
  position:         string  // "far left" | "left" | "center-left" | "center" | "center-right" | "right" | "far right"
  approximate_age:  string  // "child", "teen", "young adult", "adult", "older adult"
  age_indicators:   string  // concrete signals: "fully grey hair, smile lines around eyes, weathered hands"
  presentation:     string  // "masculine" | "feminine" | "androgynous"
  hair_color:       string  // explicit color: "salt-and-pepper grey", "warm chestnut brown"
  hair_style:       string  // length and shape: "short, slightly receding at temples"
  facial_hair:      string  // "none" | "stubble" | "short beard" | "full beard" | "mustache only"
  face_shape:       string  // rough geometric: "oval", "round", "long", "square", "heart"
  notable_features: string  // artistic: "deep-set eyes, warm open smile" — short phrase
  skin_tone:        string  // "warm fair", "cool olive", "warm deep brown"
  glasses:          string  // "none" or short description
  clothing:         string  // single phrase: "heather-grey crewneck and blue jeans"
  expression:       string  // "warm closed-mouth smile", "open laughing smile", "calm"
  pose:             string  // "standing relaxed, holding gear", "arm around neighbor"
  notable:          string | null  // optional one-detail flag, or null
}

export interface GroupAnalysis {
  num_people:  number
  arrangement: string
  mood:        string
  setting:     string
  people:      PersonIdentity[]
}

const ANALYSIS_PROMPT = `You're writing reference notes for a sculptor making small painted resin figurines from this group photograph. Think character design notes for an illustrator — observational and stylistic, not technical.

The sculptor needs enough detail to capture each person clearly. Pay particular attention to age signals, because miniatures often drift toward generic young faces if the artist doesn't have explicit cues. Note grey hair, smile lines, weathered skin, balding patterns — anything that grounds the person at their actual age.

For each person visible, ordered LEFT TO RIGHT, fill these fields:

- index (0-based, left to right)
- position ("far left", "left", "center-left", "center", "center-right", "right", "far right")
- approximate_age ("child", "teen", "young adult", "adult", "older adult")
- age_indicators (concrete visual signals that ground them at their actual age — examples: "fully grey hair, smile lines around eyes, weathered hands"; "young face, smooth skin, soft features"; "salt-and-pepper hair, light smile lines". Be specific — this is what keeps the sculptor from rendering them too young.)
- presentation ("masculine", "feminine", "androgynous")
- hair_color (explicit color: "salt-and-pepper grey", "fully grey", "warm chestnut brown", "ash blonde", "honey blonde", "jet black")
- hair_style (length and shape: "short, slightly receding at temples", "long loose waves past shoulders", "shoulder-length, side part", "buzz cut")
- facial_hair ("none", "stubble", "short beard", "full beard", "mustache only", "goatee")
- face_shape (rough geometric: "oval", "round", "long", "square", "heart-shaped")
- notable_features (one short artistic phrase: "deep-set eyes, warm open smile", "rounded cheeks, gentle eyes", "strong jaw, prominent brow")
- skin_tone (warm/cool + tone: "warm fair", "cool olive", "warm deep brown", "lightly weathered fair")
- glasses ("none" or short description: "round wire frames", "rectangular black frames")
- clothing (single phrase: "heather-grey crewneck over jeans", "black star-print tee and light jeans")
- expression ("warm closed-mouth smile", "open laughing smile showing teeth", "calm", "relaxed half-smile")
- pose ("standing relaxed", "arm around neighbor", "leaning in", "hand on hip", "holding gear in both hands")
- notable (one optional artistic detail like "wearing a baseball cap" or "holding a small dog"; use null if nothing notable)

Top-level fields:
- num_people (integer)
- arrangement (one phrase: "single row standing close together", "kids in front of parents", "two adults flanking a child")
- mood ("warm casual", "joyful candid", "formal posed", "relaxed family")
- setting (one short sentence about the place or occasion)

These notes accompany the original photograph — the photograph is the primary reference. Your notes give the sculptor a stylistic reference point alongside the photo.

Respond ONLY with valid JSON in this shape:
{
  "num_people": <int>,
  "arrangement": "...",
  "mood": "...",
  "setting": "...",
  "people": [
    {
      "index": 0,
      "position": "...",
      "approximate_age": "...",
      "age_indicators": "...",
      "presentation": "...",
      "hair_color": "...",
      "hair_style": "...",
      "facial_hair": "...",
      "face_shape": "...",
      "notable_features": "...",
      "skin_tone": "...",
      "glasses": "...",
      "clothing": "...",
      "expression": "...",
      "pose": "...",
      "notable": "..." | null
    }
  ]
}

No markdown. No preamble. No apology. Just JSON.`

export async function analyzeGroup(input: {
  sourceImageB64: string
  openaiApiKey:   string
}): Promise<GroupAnalysis> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 3500,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url:    `data:image/jpeg;base64,${input.sourceImageB64}`,
            detail: 'high',
          },
        },
        { type: 'text', text: ANALYSIS_PROMPT },
      ],
    }],
  })

  const raw   = response.choices[0]?.message?.content?.trim() || '{}'
  const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  // Detect refusal — model returned conversational refusal instead of JSON
  if (!clean.startsWith('{') && /sorry|can'?t (assist|help)|unable to/i.test(clean)) {
    console.warn('[group-analyzer] Model refused. Raw:', raw.slice(0, 200))
    throw new Error('group_analysis_refused')
  }

  let parsed: GroupAnalysis
  try {
    parsed = JSON.parse(clean) as GroupAnalysis
  } catch (e: any) {
    console.error('[group-analyzer] JSON parse failed:', e.message, '\nRaw:', raw.slice(0, 500))
    throw new Error('group_analysis_parse_failed')
  }

  if (!Array.isArray(parsed.people) || parsed.people.length === 0) {
    throw new Error('group_analysis_no_people_detected')
  }

  console.log(
    `[group-analyzer] ${parsed.num_people} people / ${parsed.arrangement} / ${parsed.mood}`
  )
  return parsed
}
