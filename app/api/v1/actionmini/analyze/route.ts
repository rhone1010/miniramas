// actionmini-analyze-route.ts
// app/api/v1/actionmini/analyze/route.ts
//
// Action Minis analyze endpoint.
// Feeds actionmini-generator.ts with:
//   - Kinetic medium detection (whitewater / surf / snow / skate / bike / climb / run / dance / combat / other)
//   - Single hero identity profile (hard face-lock depth — per SportsMemories pattern)
//   - Secondary figure count + short description (for blur/dim treatment, not identity preservation)
//   - Action character: what the body is doing, kinetic energy cues, freeze-moment qualities
//   - Environment block (plinth surround + blurred background — per Landscapes pattern)
//   - Distinctive features that must carry into the sculpt
//   - Suitability verdict (flags posed/static shots that don't belong in this module)
//   - Display name, memory text, preset + mood recommendation with alternatives
//
// Face-lock discipline: one hero at full identity depth. At In-Situ/Museum scale the
// rendered face will be small (~40px at 1024) — target is "~90% recognizable as them",
// not photographic. Card preset gets more face real estate and tighter lock.

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { moderateUploadedImage } from '@/lib/v1/moderation'
import { logRejection, deriveUserId } from '@/lib/v1/rejection-log'
import { checkRateLimit } from '@/lib/v1/rate-limit'

// ── ANALYZE PROMPT ────────────────────────────────────────────

const ANALYZE_PROMPT = `You are analyzing a photograph for Action Minis — a collectible diorama product that transforms action/adventure photos into a single hero figure mid-action, with the kinetic medium (wave, rapids, snow spray, dust, rock face, ramp) sculpted AS PART of the miniature base. The hero is photorealistic and identity-locked; everything around them is sculpted as physical diorama material.

Return a valid JSON object with exactly these fields. No markdown, no explanation, just JSON.

{
  "kinetic_medium": "whitewater" | "surf" | "snow" | "skate" | "bike" | "climb" | "run" | "dance" | "combat" | "other",
  "medium_confidence": "high" | "medium" | "low",
  "medium_cues": "brief description of what indicates the medium (gear, terrain, visible elements)",

  "action_description": "30-50 word description of WHAT THE HERO IS DOING, focused on kinetic energy — the body action, direction of motion, the moment being frozen. Example: 'Kayaker mid-paddle stroke in churning whitewater, paddle raised high in right hand, mouth open in exertion, leaning forward into the rapid, spray exploding around the bow of the boat.'",

  "freeze_moment_quality": "one short phrase naming the specific athletic/expressive moment — 'mid-paddle stroke', 'carving bottom turn', 'airborne kickflip', 'cranking uphill switchback', 'peak of leap', 'dropping in', 'mid-crux move'",

  "hero": {
    "position_in_frame": "left" | "center" | "right" | "back-left" | "back-center" | "back-right" | "foreground",
    "age_range": "specific age band like 'mid-30s', 'late 20s', 'child 10-12', 'teen 15-17'",
    "gender_presentation": "masculine" | "feminine" | "neutral",
    "ethnicity_apparent": "brief description",
    "skin_tone": "specific — 'fair with warm undertone', 'medium olive', 'deep brown'",
    "hair": {
      "color": "specific — 'dark brown', 'sun-bleached blond', 'jet black'",
      "length": "very short" | "short" | "medium" | "long" | "very long" | "hidden under helmet",
      "style": "specific — 'wet and slicked back', 'ponytail out the back of helmet', 'short and damp', 'fully concealed by helmet'",
      "distinct_features": "notable details or 'none visible — hair covered'"
    },
    "face": {
      "shape": "oval" | "round" | "square" | "heart" | "long" | "diamond",
      "notable_features": "distinct features — 'strong jaw', 'prominent cheekbones', 'soft rounded cheeks', 'wide mouth'"
    },
    "glasses": true | false,
    "glasses_description": "style if present — 'sport wraparound', 'goggles over eyes', 'none' or null",
    "facial_hair": "description if present — 'clean-shaven', 'light stubble', 'trimmed beard', 'none'",
    "expression": "detailed — the exact kinetic expression. 'Mouth wide open in effort, eyes focused forward, brow furrowed', 'teeth gritted in concentration, eyes narrowed', 'laughing mid-action, full open smile, eyes crinkled'",
    "gear_top": "what they're wearing on torso — 'yellow dry top over PFD', 'black wetsuit top', 'red technical jacket', 'white running singlet'",
    "gear_head": "helmet/headwear — 'blue whitewater helmet with chin strap', 'black ski helmet with goggles on forehead', 'snapback cap backwards', 'none'",
    "gear_hands": "what's visible on hands — 'black neoprene gloves', 'bare hands gripping paddle', 'white chalk on fingers', 'none visible'",
    "body_position": "detailed pose description — 'seated in kayak, torso rotated right, left arm extended high overhead gripping paddle shaft, right hand at mid-paddle below water, leaning forward into stroke'",
    "distinct_identifiers": "anything else that makes this person specifically recognizable — 'slight overbite visible in open-mouth expression', 'freckles across nose', 'mole on left jaw', 'distinct smile lines' — or 'no distinguishing marks visible at this resolution'"
  },

  "secondary_figures": {
    "count": 0-4,
    "description": "brief description for blur/dim treatment — 'one other kayaker in upper right, partially submerged, blue helmet, green jacket', 'two skiers downslope behind hero', 'empty' when count is 0. Do NOT provide identity detail — secondaries are context, not product."
  },

  "environment": "formatted as TWO sentences matching this pattern exactly: 'The diorama sits on [immediate surround material — the real-world ground around the plinth that echoes the scene]. Background is blurred [far atmospheric zone — the continued environment softly receding].' Examples: 'The diorama sits on dark damp pebbles and river stones. Background is blurred forested riverbank with moss-covered rocks and dappled shade.' or 'The diorama sits on fine grey sand with scattered shell fragments. Background is blurred open ocean with low horizon and soft morning haze.' or 'The diorama sits on weathered concrete with skatepark graffiti fragments. Background is blurred urban park at dusk with warm sodium lights.'",

  "distinctive_features": "comma-separated list of 2-5 SPECIFIC features in the source that must carry into the sculpt — gear colors, terrain character, distinctive elements that make this THIS shot. Examples: 'yellow paddle blade, orange kayak hull, mossy boulder stage-left, churning white foam breaking over bow' or 'red surfboard with white pinline, peeling wave face, spray fanning from heel edge' or 'black snowboard with orange graphic, powder plume fanning behind, dark pine silhouettes in middle distance'. Do NOT list generic features (sky, water) — list SPECIFIC memorable content.",

  "source_lighting": "brief — 'outdoor overcast afternoon', 'bright midday sun with hard shadows', 'golden hour side-rake', 'evening/dusk with low contrast'",

  "display_name": "short 2-4 word name — 'Rapid Run', 'Reef Break', 'Powder Line', 'Ramp Drop', 'Crux Move', 'Trail Blast'",

  "memory_text": "20-30 word evocative italic-style sentence for the back of a card. Sensory, about the moment, not naming the person. Example: 'The roar of white water, the pull of the paddle, one breath held and released — the river takes you and you answer back.'",

  "default_plaque_text": "short 1-3 word phrase matching the medium — 'Send It', 'Drop In', 'Full Send', 'Line Run', 'Hold Fast', 'Ride On' — calibrate tone to the action",

  "action_suitability": {
    "verdict": "well_suited" | "poorly_suited",
    "subject": "1-4 word subject phrase, lowercase — 'the kayaker', 'the surfer', 'the skater', 'the climber', 'the runner'",
    "reason": "ONE sentence max 30 words, populated only when verdict is poorly_suited, written directly to the user. Framing: 'This image may not work well as an Action Mini — [why]'. When well_suited, return empty string."
  },

  "recommendation": {
    "preset": "insitu" | "museum" | "collectable_card",
    "mood": "golden" | "dramatic" | "peaceful" | "vivid",
    "reasoning": "1-2 sentences explaining the choice based on the source photo"
  },
  "alternatives": [
    { "preset": "...", "mood": "...", "reasoning": "..." },
    { "preset": "...", "mood": "...", "reasoning": "..." }
  ]
}

CRITICAL INSTRUCTIONS:

1. HERO IDENTIFICATION — this is the core of the product:
   - Exactly ONE hero. If multiple people are mid-action, pick the one most prominent/centered/in-focus.
   - Full identity detail on the hero. Generator will hard-lock this face — missing features cause face failures.
   - All OTHER people in frame are "secondary_figures" — count and short description only, NO per-figure identity detail.
   - Hero face may be partially obscured (helmet, goggles, spray, exertion). Describe what IS visible — "mouth and chin visible below helmet", "eyes visible behind goggles".

2. AGE ACCURACY — extremely important:
   - A 45-year-old should be described as 45, not 30. Don't flatter.
   - Aging cues (fine lines, weathered skin from sun exposure, graying temples) should be noted honestly.
   - Kid/teen athletes — use specific age bands.

3. EXPRESSION FIDELITY — action expressions are specific:
   - "Concentrating" is not enough. "Teeth gritted, eyes narrowed, brow furrowed in effort" tells the generator what to render.
   - An open-mouth yell during exertion is different from a calm focused face or a mid-action grin. Capture which it is.
   - Helmet/goggles constrain what's visible — say what's actually readable.

4. ACTION DESCRIPTION — focus on KINETIC:
   - What the body is doing mechanically (which arm is where, which way they're leaning).
   - The direction of motion (into the wave, down the slope, up the rock face).
   - The freeze_moment_quality names the instant — mid-stroke, mid-air, bottom-turn, etc.

5. KINETIC MEDIUM — this drives the whole sculpt:
   - whitewater: rapids, kayak, raft, paddle
   - surf: wave, board, ocean
   - snow: ski, snowboard, sled, snow spray, slope
   - skate: ramp, street, concrete, board
   - bike: mtb/bmx, dirt, jumps, trail
   - climb: rock face, rope, chalk
   - run: trail, track, road
   - dance: stage, studio floor
   - combat: wrestling, boxing, MMA, judo, BJJ, taekwondo, karate — any mat-based or ring-based combat sport
   - other: anything kinetic that doesn't fit above (parkour, dog mid-fetch, etc.)

6. SUITABILITY — this module is about KINETIC ACTION:
   - well_suited: clear athletic action frozen mid-motion (paddle stroke, carve, leap, crux move)
   - poorly_suited: posed photos (skater holding board, runner standing still, climber on the ground), static portraits with action gear, group shots without a clear hero mid-motion
   - Bias: when uncertain, lean well_suited. Only flag poorly_suited when the image genuinely lacks kinetic energy.

7. SECONDARY FIGURES:
   - If other humans are in frame but not the hero, note their count and rough description.
   - These will be dimmed/blurred in output to hold focus on the hero.
   - Do NOT try to identify them or give identity detail — that's wasted tokens for a treatment they won't receive.

8. DISTINCTIVE FEATURES:
   - Gear colors (yellow paddle, red kayak, blue helmet) — these anchor the sculpt.
   - Terrain character (mossy boulder, churning white foam, peeling wave, powder plume).
   - Specific elements visible in source that must carry through.

9. DISPLAY_NAME AND MEMORY_TEXT:
   - display_name: warm but punchy, not corporate. "Rapid Run", "Powder Line" — not "Whitewater Kayaking Experience".
   - memory_text: like a line on the back of a keepsake card. Sensory, atmospheric, not about naming people.

10. RECOMMENDATION:
    - insitu: hero fits nicely on a plinth with kinetic medium sculpted around/into the base — default for most shots
    - museum: source has strong standalone "heroic" isolation that works under spot lighting on a desk
    - collectable_card: tight single hero with clear character, card-worthy moment, strong face visibility
    - Mood: match source lighting (golden for warm light, dramatic for stormy/intense, peaceful for soft/quiet, vivid for saturated midday)

11. NEVER invent details not visible in the source. If unclear, flag it or use null — don't guess.

Respond ONLY with the JSON object.`.trim()

// ── HANDLER ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { image_b64 } = await req.json()

    if (!image_b64) {
      return NextResponse.json({ error: 'image_b64 required' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })
    }

    const userId = deriveUserId(req)

    // ── PRE-FLIGHT MODERATION ────────────────────────────────
    const mod = await moderateUploadedImage({ imageB64: image_b64, openaiApiKey })
    if (!mod.allowed) {
      logRejection({
        userId,
        category:  mod.category,
        verdict:   mod.verdict,
        imageHash: mod.imageHash,
        reason:    mod.reason,
        route:     'actionmini',
      })
      const rate = checkRateLimit(userId)
      return NextResponse.json({
        error:           mod.reason,
        category:        mod.category,
        verdict:         mod.verdict,
        retryable:       mod.verdict === 'soft',
        delayMs:         rate.delayMs,
        rateLimitTier:   rate.tier,
      }, { status: 422 })
    }

    // ── RATE LIMIT (image was allowed but user may still have a cooldown) ─
    const rate = checkRateLimit(userId)
    if (rate.delayMs > 0) {
      return NextResponse.json({
        error:         rate.message || 'Please wait before trying again.',
        delayMs:       rate.delayMs,
        rateLimitTier: rate.tier,
        cooldown:      true,
      }, { status: 429 })
    }

    const openai = new OpenAI({ apiKey: openaiApiKey })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2500,   // single hero at sportsmem depth + scene blocks — generous ceiling
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${image_b64}`, detail: 'high' },   // high — need face features
          },
          {
            type: 'text',
            text: ANALYZE_PROMPT,
          },
        ],
      }],
    })

    const raw = response.choices[0]?.message?.content?.trim() || '{}'

    // Strip markdown fences if GPT wrapped the JSON
    const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

    let parsed: any = {}
    try {
      parsed = JSON.parse(clean)
    } catch (e) {
      console.error('[actionmini-analyze] JSON parse failed:', e)
      console.error('[actionmini-analyze] Raw:', raw.slice(0, 500))
      parsed = {
        kinetic_medium: 'other',
        medium_confidence: 'low',
        medium_cues: '',
        action_description: 'A moment of action frozen in time.',
        freeze_moment_quality: 'mid-motion',
        hero: null,
        secondary_figures: { count: 0, description: 'empty' },
        environment: 'The diorama sits on neutral textured ground appropriate to the scene. Background is blurred natural environment with soft atmospheric light.',
        distinctive_features: '',
        source_lighting: 'neutral',
        display_name: 'Action Shot',
        memory_text: 'A moment worth keeping.',
        default_plaque_text: 'Send It',
        action_suitability: { verdict: 'well_suited', subject: '', reason: '' },
        recommendation: { preset: 'insitu', mood: 'golden', reasoning: 'Default — analyze parse failed.' },
        alternatives: [],
      }
    }

    // Normalize suitability (defensive — LLM may omit or malform)
    const suitRaw = parsed.action_suitability || {}
    const suitability = {
      verdict: suitRaw.verdict === 'poorly_suited' ? 'poorly_suited' : 'well_suited',
      subject: typeof suitRaw.subject === 'string' ? suitRaw.subject : '',
      reason:  typeof suitRaw.reason  === 'string' ? suitRaw.reason  : '',
    }
    parsed.action_suitability = suitability

    // Normalize secondary_figures
    const secRaw = parsed.secondary_figures || {}
    parsed.secondary_figures = {
      count: Math.max(0, Math.min(4, Number(secRaw.count) || 0)),
      description: typeof secRaw.description === 'string' ? secRaw.description : 'empty',
    }

    // Log diagnostics
    const heroSummary = parsed.hero
      ? `${parsed.hero.age_range || '?'} ${parsed.hero.gender_presentation || '?'} hero`
      : 'NO HERO'
    console.log(
      `[actionmini-analyze] Detected: ${parsed.display_name} — ${parsed.kinetic_medium} (${parsed.medium_confidence}) — ` +
      `${heroSummary} + ${parsed.secondary_figures.count} secondary — suitability: ${suitability.verdict}`
    )

    return NextResponse.json(parsed)

  } catch (err: any) {
    console.error('[actionmini-analyze] Fatal:', err.message)
    return NextResponse.json({
      kinetic_medium: 'other',
      medium_confidence: 'low',
      medium_cues: '',
      action_description: 'A moment of action frozen in time.',
      freeze_moment_quality: 'mid-motion',
      hero: null,
      secondary_figures: { count: 0, description: 'empty' },
      environment: 'The diorama sits on neutral textured ground. Background is blurred natural environment with soft atmospheric light.',
      distinctive_features: '',
      source_lighting: 'neutral',
      display_name: 'Action Shot',
      memory_text: 'A moment worth keeping.',
      default_plaque_text: 'Send It',
      action_suitability: { verdict: 'well_suited', subject: '', reason: '' },
      recommendation: { preset: 'insitu', mood: 'golden', reasoning: 'Default — analyze request failed.' },
      alternatives: [],
      _error: err.message,
    })
  }
}
