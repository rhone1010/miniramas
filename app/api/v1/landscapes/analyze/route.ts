// landscape-analyze-route.ts
// app/api/v1/landscapes/analyze/route.ts

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: NextRequest) {
  try {
    const { image_b64 } = await req.json()
    if (!image_b64) return NextResponse.json({ error: 'image_b64 required' }, { status: 400 })

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })

    const openai = new OpenAI({ apiKey: openaiApiKey })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${image_b64}`, detail: 'low' },
          },
          {
            type: 'text',
            text: `Analyze this place photograph and respond with a JSON object containing exactly these six fields:

"scene_description": A vivid, specific 40-60 word description of what this place IS — its physical character, atmosphere, light quality, and defining features. Be specific and sensory. Examples: "A sea grotto with turquoise water, dramatic shafts of light breaking through a rock opening above, cave walls of warm amber limestone, mysterious and luminous" or "An outdoor beach bar under a palm-thatched awning, worn wooden bar top, tropical afternoon light filtering through the leaves, warm and relaxed atmosphere".

"memory_text": A 20-30 word reflective caption written as if it belongs on the back of a keepsake collectable card. Evocative, quiet, slightly lyrical — the kind of line you'd find on a commemorative postcard. Focus on what makes this place worth remembering rather than what it physically looks like. Example: "Where the afternoon light pools golden on the grass and the path winds quietly into low hills — a place that slows the world down." No quotation marks around your answer.

"display_name": A short 2-4 word name for this place type shown to the user. Examples: "Sea Grotto", "Beach Bar", "Alpine Meadow", "Slot Canyon", "Covered Market".

"character_source": Decide where the character of this place lives. Return EXACTLY one of these two values:
- "object" — if the character comes from DEFINED FEATURES: buildings, landmarks, strong geometry, distinctive structures, unique rock formations, architectural elements. Examples: a pier, a grotto, a cave, a lighthouse, a ruined tower, a storefront, a specific beach with arch rocks.
- "atmosphere" — if the character comes from WEATHER, LIGHT, MOOD, OR DIFFUSE LANDSCAPE rather than discrete features. Examples: foggy mountain path, misty meadow, snow-covered field, overcast wetland, atmospheric desert dune, featureless stretch of prairie, low cloud over rolling hills.
If the image has both strong features AND strong atmosphere, prefer "object". Only return "atmosphere" when the features are minimal and mood carries the scene.

"environment_surface": Describe ONLY the ground the diorama base sits on — ONE specific tangible material with a simple descriptor (e.g. "warm pale sand", "damp mossy forest floor", "wet dark stone", "still shallow water", "weathered hardwood"). Do NOT describe sky, backdrop, distant features, or atmosphere. Just the surface. Keep to one short phrase.

"environment_atmosphere": Describe ONLY the sky, weather, and light quality of the place — what the air and sky are doing. Examples: "low grey fog bank across distant mountains, overcast sky, cool damp light", "warm amber sunset sky with peach clouds", "clear midday blue with scattered white cumulus", "stormy dark sky with shafts of light breaking through". Do NOT describe ground features, trees, or objects. Keep to one short sentence.

Respond ONLY with valid JSON. No markdown, no explanation.`,
          },
        ],
      }],
    })

    const raw = response.choices[0]?.message?.content?.trim() || '{}'

    // Strip markdown fences if present
    const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

    let parsed: any = {}
    try {
      parsed = JSON.parse(clean)
    } catch {
      // Fallback if JSON parse fails
      parsed = {
        scene_description:      'A beautiful natural place with unique character and atmosphere.',
        memory_text:            'A quiet place that stays with you long after you leave.',
        display_name:           'Natural Scene',
        character_source:       'object',
        environment_surface:    'neutral natural ground appropriate to the scene',
        environment_atmosphere: 'softly diffused sky with gentle ambient light',
      }
    }

    console.log(`[landscape-analyze] Detected: ${parsed.display_name} (${parsed.character_source})`)
    return NextResponse.json({
      display_name:           parsed.display_name || 'Natural Scene',
      scene_description:      parsed.scene_description || '',
      memory_text:            parsed.memory_text || '',
      character_source:       parsed.character_source === 'atmosphere' ? 'atmosphere' : 'object',
      environment_surface:    parsed.environment_surface || '',
      environment_atmosphere: parsed.environment_atmosphere || '',
    })

  } catch (err: any) {
    console.error('[landscape-analyze]', err.message)
    return NextResponse.json({
      display_name:           'Natural Scene',
      scene_description:      'A beautiful natural place.',
      memory_text:            'A quiet place that stays with you long after you leave.',
      character_source:       'object',
      environment_surface:    'neutral natural ground appropriate to the scene',
      environment_atmosphere: 'softly diffused sky with gentle ambient light',
    })
  }
}
