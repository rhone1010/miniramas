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
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${image_b64}`, detail: 'low' },
          },
          {
            type: 'text',
            text: `Analyze this place photograph and respond with a JSON object containing exactly these eight fields:

"scene_description": A vivid, specific 40-60 word description of what this place IS — its physical character, atmosphere, light quality, and defining features. Be specific and sensory. Examples: "A sea grotto with turquoise water, dramatic shafts of light breaking through a rock opening above, cave walls of warm amber limestone, mysterious and luminous" or "An outdoor beach bar under a palm-thatched awning, worn wooden bar top, tropical afternoon light filtering through the leaves, warm and relaxed atmosphere".

"viewing_direction": Describe which side of the main subject the photographer is positioned on, and how the subject is oriented in frame. Be very specific and directional. This will be used to recreate the same viewing angle. Include: which side/face of the subject is visible, where the sun/light is relative to the viewer (behind, to the side, in front), and the general camera direction. Examples: "Viewer stands on the beach looking toward the pier from its WEST side, sun setting behind the pier causing silhouette of pilings against the horizon, pier extends left-to-right across the frame", "Viewer stands inland looking SOUTH toward the cliffs, morning sun rising from the left (east) of frame, cliffs angle away to the right", "Viewer inside the grotto looking OUTWARD toward the cave opening, backlit by outdoor light streaming in from the top-right".

"memory_text": A 20-30 word reflective caption written as if it belongs on the back of a keepsake collectable card. Evocative, quiet, slightly lyrical — the kind of line you'd find on a commemorative postcard. Focus on what makes this place worth remembering rather than what it physically looks like. Example: "Where the afternoon light pools golden on the grass and the path winds quietly into low hills — a place that slows the world down." No quotation marks around your answer.

"display_name": A short 2-4 word name for this place type shown to the user. Examples: "Sea Grotto", "Beach Bar", "Alpine Meadow", "Slot Canyon", "Covered Market".

"character_source": Decide where the character of this place lives. Return EXACTLY one of these two values:
- "object" — if the character comes from DEFINED FEATURES: buildings, landmarks, strong geometry, distinctive structures, unique rock formations, architectural elements. Examples: a pier, a grotto, a cave, a lighthouse, a ruined tower, a storefront, a specific beach with arch rocks.
- "atmosphere" — if the character comes from WEATHER, LIGHT, MOOD, OR DIFFUSE LANDSCAPE rather than discrete features. Examples: foggy mountain path, misty meadow, snow-covered field, overcast wetland, atmospheric desert dune, featureless stretch of prairie, low cloud over rolling hills.
If the image has both strong features AND strong atmosphere, prefer "object". Only return "atmosphere" when the features are minimal and mood carries the scene.

"environment": Describe the environment the diorama exists in — formatted as TWO sentences: the surface it sits on, and the blurred background behind it. Match this pattern exactly: "The diorama sits on [immediate surround material — what the base rests on and what continues out from it, one specific tangible material]. Background is blurred [far environment with specific character — soft atmospheric zone behind, with mood and defining features]." Examples: "The diorama sits on warm sandy surface with small pebbles. Background is blurred tropical beach setting, soft ocean in the far distance." or "The diorama sits on dark wet rock with water pooling around the base. Background is blurred cave walls with a shaft of ethereal light from an unseen opening above." or "The diorama sits on damp mossy forest floor scattered with leaves. Background is blurred pine trees fading into morning fog."

"distinctive_features": List 2-5 SPECIFIC features present in the source image that MUST be preserved in any rendering. These are the things that make THIS place that place. Be concrete and identifiable. Format as a short comma-separated phrase. Include proper nouns if visible (signs, buildings, landmarks). Examples: "marsh pond on left side of path, oak-dotted rolling hills in distance, tall dry grass edges", "weathered pier with peeling white paint, cluster of brown pelicans on railings, fishermen on the far end", "twin birch trees flanking the trail, granite outcrop on the right, moss-covered log across the path". These features will be explicitly preserved in the generated diorama — do not list generic features (sky, ground) but SPECIFIC memorable content.

"primary_subject": Return a 1-3 word phrase naming the single most important subject of the scene — the visual hero. This is the element that the composition must anchor on, that light should peak on, that the camera should focus on. Examples: "pier", "gravel path", "sea grotto", "white farmhouse", "twin oak trees", "waterfall". If the scene is genuinely atmosphere-forward with no clear hero (overcast open marsh, featureless dune field, diffuse forest), return "the landscape itself". Keep it short — one concrete noun phrase.

"diorama_suitability": Decide whether this scene can be meaningfully rendered as a physical miniature diorama on a plinth. A diorama works when there is FIGURE-GROUND SEPARATION — a sculptable subject that can be lifted out from its surroundings, while the background recedes as atmospheric context. A diorama FAILS when the subject is inseparable from the scene — when the "subject" IS the whole landscape, with nothing to pull out and nothing meaningful left behind. Return an object with exactly these three fields:
- "verdict": EXACTLY one of "well_suited" or "poorly_suited"
- "subject": the named subject (1-4 words, lowercase phrase with article — e.g. "the bridge", "the lighthouse", "the river", "the meadow", "the open sky")
- "reason": ONE sentence max 30 words, only populated when verdict is "poorly_suited", written directly to the user. Use this framing: "This image may not work well as a diorama — [subject] is part of the entire scene, with no clear element to pull out from the background." Vary the second half naturally to fit the specific image. When verdict is "well_suited", return an empty string "".
CALIBRATION EXAMPLES:
- Stone bridge over forest stream → well_suited (bridge is a crisp sculptable object, forest recedes)
- Lighthouse on cliff → well_suited (lighthouse is the figure, sea+sky the ground)
- Covered market stall → well_suited (architectural subject, street recedes)
- Wide river curving through valley at sunset → poorly_suited ("the river is part of the entire landscape — there's no clear element to pull out from the background")
- Open meadow at dawn with soft hills → poorly_suited ("the meadow is inseparable from the hills around it — the whole scene is the subject")
- Foggy forest path with no focal point → poorly_suited ("the fog and trees dissolve together — there's nothing distinct to sculpt apart from its surroundings")
- Ocean horizon at sunset → poorly_suited ("the scene is pure atmosphere — there's no physical element to render as a miniature")
- Snow-covered field with lone tree → well_suited (the tree is the figure)
BIAS: When uncertain, lean well_suited. Only flag poorly_suited when the image genuinely has no figure-ground separation.

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
        scene_description:    'A beautiful natural place with unique character and atmosphere.',
        viewing_direction:    'Standard frontal view of the subject at eye level.',
        memory_text:          'A quiet place that stays with you long after you leave.',
        display_name:         'Natural Scene',
        character_source:     'object',
        environment:          'The diorama sits on neutral natural ground appropriate to the scene. Background is blurred natural environment with soft atmospheric light.',
        distinctive_features: '',
        primary_subject:      'the landscape itself',
        diorama_suitability:  { verdict: 'well_suited', subject: '', reason: '' },
      }
    }

    // Normalize suitability (defensive — LLM may omit fields or return malformed object)
    const suitRaw = parsed.diorama_suitability || {}
    const suitability = {
      verdict: suitRaw.verdict === 'poorly_suited' ? 'poorly_suited' : 'well_suited',
      subject: typeof suitRaw.subject === 'string' ? suitRaw.subject : '',
      reason:  typeof suitRaw.reason  === 'string' ? suitRaw.reason  : '',
    }

    console.log(`[landscape-analyze] Detected: ${parsed.display_name} (${parsed.character_source}) — hero: ${parsed.primary_subject || '(none)'} — suitability: ${suitability.verdict} — features: ${parsed.distinctive_features || '(none)'}`)
    return NextResponse.json({
      display_name:         parsed.display_name || 'Natural Scene',
      scene_description:    parsed.scene_description || '',
      viewing_direction:    parsed.viewing_direction || '',
      memory_text:          parsed.memory_text || '',
      character_source:     parsed.character_source === 'atmosphere' ? 'atmosphere' : 'object',
      environment:          parsed.environment || '',
      distinctive_features: parsed.distinctive_features || '',
      primary_subject:      parsed.primary_subject || 'the landscape itself',
      diorama_suitability:  suitability,
    })

  } catch (err: any) {
    console.error('[landscape-analyze]', err.message)
    return NextResponse.json({
      display_name:         'Natural Scene',
      scene_description:    'A beautiful natural place.',
      viewing_direction:    'Standard frontal view of the subject at eye level.',
      memory_text:          'A quiet place that stays with you long after you leave.',
      character_source:     'object',
      environment:          'The diorama sits on neutral natural ground appropriate to the scene. Background is blurred natural environment with soft atmospheric light.',
      distinctive_features: '',
      primary_subject:      'the landscape itself',
      diorama_suitability:  { verdict: 'well_suited', subject: '', reason: '' },
    })
  }
}
