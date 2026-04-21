// moments-analyze-route.ts
// app/api/v1/moments/analyze/route.ts

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const ANALYZE_PROMPT = `Analyze this photograph of people for a miniature figurine recreation. Respond ONLY with valid JSON matching this exact shape (no markdown, no explanation).

{
  "people_count": <number>,
  "group_description": "<short 1-sentence summary of who is in the photo and their relationship/configuration — e.g. 'A young couple standing close together', 'A family of four: two parents and two young children', 'A team of six in matching uniforms'>",
  "people": [
    {
      "position": "<where this person is in the group — e.g. 'left of frame', 'center, seated', 'back row right'>",
      "apparent_age": "<e.g. 'child ~6', 'teenager', 'young adult 20s', 'adult 30s-40s', 'older adult 60s+'>",
      "apparent_sex": "<'male-presenting' | 'female-presenting' | 'ambiguous'>",
      "skin_tone": "<1-3 word descriptor — 'fair', 'light olive', 'medium tan', 'deep brown', etc.>",
      "hair": "<color + length + style in one short phrase — 'short dark brown', 'long blonde wavy', 'shaved', 'grey bob', 'curly black shoulder-length'>",
      "facial_hair": "<'none' | 'light stubble' | 'full beard brown' | 'moustache grey' etc.>",
      "build": "<one word — 'petite' | 'average' | 'tall' | 'broad' | 'stocky' | 'slim'>",
      "clothing_top": "<color + garment type — 'white button-down shirt', 'red athletic jersey', 'black leather jacket', 'floral summer dress'>",
      "clothing_bottom": "<color + garment type — 'dark jeans', 'khaki shorts', 'black dress pants' — or 'covered by dress/robe'>",
      "distinctive": "<optional — ONE notable accessory, prop, or trait if clearly visible: 'glasses', 'wearing a graduation cap', 'holding a bouquet', 'carrying a child', 'wheelchair user'. Use empty string '' if nothing distinctive.>",
      "pose": "<short phrase — 'standing arms around partner', 'seated smiling', 'arms raised celebrating', 'hands clasped formal'>"
    }
  ],
  "emotional_tone": "<one short phrase — 'joyful and warm', 'formal and proud', 'playful and relaxed', 'solemn and dignified', 'triumphant'>",
  "setting_hint": "<what the original photo appears to show behind the people in 4-8 words — 'outdoor garden ceremony', 'indoor living room', 'stadium field', 'beach at sunset', 'graduation stage'>"
}

IMPORTANT RULES:
- Describe features as a thoughtful observer would for a figurine artist. Close-enough, NOT high-fidelity portrait work. The goal is recognizable miniature figures, not photorealistic facial reconstruction.
- Do NOT include any names, do NOT guess at identity, do NOT speculate about ethnicity as a label. Describe only what is visually apparent.
- If a feature is unclear, use a reasonable best guess or omit with an empty string.
- Return EXACTLY the people you can see clearly. If some are partially occluded or in deep background, include only the foreground/featured people.
- Keep clothing descriptions to what is visible — no assumptions about what's underneath or behind.`.trim()

export async function POST(req: NextRequest) {
  try {
    const { image_b64 } = await req.json()
    if (!image_b64) return NextResponse.json({ error: 'image_b64 required' }, { status: 400 })

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })

    const openai = new OpenAI({ apiKey: openaiApiKey })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${image_b64}`, detail: 'high' },
          },
          { type: 'text', text: ANALYZE_PROMPT },
        ],
      }],
    })

    const raw   = response.choices[0]?.message?.content?.trim() || '{}'
    const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

    let parsed: any = {}
    try {
      parsed = JSON.parse(clean)
    } catch {
      parsed = {
        people_count: 1,
        group_description: 'A person in a memorable moment',
        people: [],
        emotional_tone: 'warm',
        setting_hint: 'unspecified setting',
      }
    }

    console.log(`[moments-analyze] ${parsed.people_count} people, ${parsed.emotional_tone}`)

    return NextResponse.json({
      people_count:      parsed.people_count ?? (parsed.people?.length ?? 1),
      group_description: parsed.group_description || '',
      people:            Array.isArray(parsed.people) ? parsed.people : [],
      emotional_tone:    parsed.emotional_tone || 'warm',
      setting_hint:      parsed.setting_hint || '',
    })

  } catch (err: any) {
    console.error('[moments-analyze]', err.message)
    return NextResponse.json({
      people_count:      1,
      group_description: 'A person in a memorable moment',
      people:            [],
      emotional_tone:    'warm',
      setting_hint:      '',
    })
  }
}
