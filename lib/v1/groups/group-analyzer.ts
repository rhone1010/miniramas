// group-analyzer.ts
// lib/v1/group-analyzer.ts
//
// Photo → short scene summary for Nano Banana.
//
// Empirically, Nano Banana works best with very short prompts. The validated
// "isometric resin figurine family" win used 4 words. Long descriptions
// listing per-person clothing, hair color, expressions etc. fight the model
// instead of helping — Nano Banana looks at the source image directly and
// preserves identity from the photo, not from the prompt.
//
// This analyzer returns a ~10-word scene summary suitable for direct
// substitution into a style template like:
//
//   "isometric resin figurine of {scene_summary}"
//   "puffy plushie figurines of {scene_summary}"
//   "1960s stop motion puppets of {scene_summary}"

import OpenAI from 'openai'

// ── PUBLIC TYPES ─────────────────────────────────────────────────

export interface GroupDescription {
  /** Short scene summary, ready to slot into a style template. ~5-12 words. */
  description:    string
  /** Subject count — informational, not used in the prompt. */
  subjectCount:   number
  /** Same string as description, retained for backwards compat with callers. */
  moodSummary:    string
}

// ── ANALYZER PROMPT ──────────────────────────────────────────────

const ANALYZER_SYSTEM_PROMPT = `Look at this photograph and return a very short scene summary describing the people and what they're doing — the kind of caption you'd put on the back of a postcard.

Respond with valid JSON only:

{
  "description":   "<5-12 word scene summary>",
  "subject_count": <integer count of clearly-posing subjects>
}

DESCRIPTION RULES:

- 5-12 words maximum. Shorter is better.
- Describe the GROUP and the MOMENT, not individual people.
- Use static phrasing — no action verbs that imply motion or effects.
- Don't list clothing colors, hair colors, or per-person attributes.
- Don't include subject count in the description ("a family", not "a family of three").
- Don't use quotation marks.

GOOD EXAMPLES:

"a family playing laser tag together"
"five friends with hands joined in a circle"
"a couple at a baseball game"
"a family flexing muscles together outdoors"
"two wrestlers on the mat"
"a young boy climbing on his bed"

BAD EXAMPLES (too detailed):

"A man with salt-and-pepper hair wearing a grey shirt and jeans, a small blonde boy in a grey t-shirt, and a woman with long brown hair wearing a black star-pattern shirt, all holding laser guns" ← way too long

"A family of three" ← too generic, missing the moment

Output the JSON only — no markdown, no preamble, no explanation.`

// ── PUBLIC API ───────────────────────────────────────────────────

export async function analyzeGroup(input: {
  sourceImageB64: string
  openaiApiKey:   string
}): Promise<GroupDescription> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 200,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url:    `data:image/jpeg;base64,${input.sourceImageB64}`,
            detail: 'low',
          },
        },
        { type: 'text', text: ANALYZER_SYSTEM_PROMPT },
      ],
    }],
  })

  const raw = response.choices[0]?.message?.content?.trim() ?? '{}'
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch (e: any) {
    throw new Error(`group_analyzer_parse_failed: ${e.message} — raw: ${raw.slice(0, 200)}`)
  }

  const description  = String(parsed.description ?? '').replace(/["']/g, '').trim()
  const subjectCount = Number(parsed.subject_count ?? 0) | 0

  if (!description) {
    throw new Error('group_analyzer_empty_description')
  }

  console.log(`[group-analyzer] "${description}" (${subjectCount} subjects)`)
  return {
    description,
    subjectCount,
    moodSummary: description,  // alias for backwards compat
  }
}
