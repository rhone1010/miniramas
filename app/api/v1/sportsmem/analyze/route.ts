// sportsmem-analyze-route.ts
// app/api/v1/sportsmem/analyze/route.ts
//
// SportsMinis (sportsmem) analyze endpoint.
// Feeds sportsmem-generator.ts with:
//   - Sport + venue context detection
//   - Per-subject identity extraction (up to 4 foreground subjects, hard-locked downstream)
//   - Fan gear colors and style (Layer 1 — colors only, no marks)
//   - Display name, memory text, default plaque text
//   - Preset + mood recommendation
//
// Liability posture: Layer 1. Team identity is DETECTED for context (suggesting plaque
// defaults, matching crowd affiliation, locking color palette) but never rendered
// as marks in output — sportsmem-generator.ts strips mark reproduction regardless of
// what's detected here.

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// ── ANALYZE PROMPT ────────────────────────────────────────────
// Asks GPT-4o to return a strict JSON object matching the schema below.
// Includes per-subject detail for hard identity lock in downstream generator.

const ANALYZE_PROMPT = `You are analyzing a photograph for SportsMinis — a collectible diorama product that transforms fan photos into photorealistic stadium-tableau memorabilia. Your analysis is critical because faces and identities MUST be preserved exactly in the output.

Return a valid JSON object with exactly these fields. No markdown, no explanation, just JSON.

{
  "sport": "baseball" | "basketball" | "football" | "soccer" | "hockey" | "tennis" | "other" | "none",
  "sport_confidence": "high" | "medium" | "low",
  "sport_cues": "brief description of what indicates the sport (fan gear, venue visible, etc.)",

  "at_the_game": true | false,
  "venue_description": "brief description of visible stadium/venue context, or null if none visible",

  "team_detected": "team name if identifiable (e.g. 'San Francisco Giants') or null",
  "team_confidence": "high" | "medium" | "low",
  "team_colors": ["primary color", "secondary color"],

  "num_subjects": 1-4,
  "subjects": [
    {
      "subject_id": 1,
      "position_in_frame": "left" | "center" | "right" | "back-left" | "back-center" | "back-right",
      "age_range": "specific age band like 'mid-60s', 'early 30s', 'child 8-10', 'teen 14-16'",
      "gender_presentation": "masculine" | "feminine" | "neutral",
      "ethnicity_apparent": "brief description",
      "skin_tone": "specific — 'fair with warm undertone', 'medium olive', 'deep brown'",
      "hair": {
        "color": "specific — 'dark brown', 'graying at temples', 'jet black with gray streaks'",
        "length": "very short" | "short" | "medium" | "long" | "very long",
        "style": "specific — 'tight curls worn up', 'straight ponytail', 'short crew cut'",
        "distinct_features": "notable details like 'receding hairline', 'side-swept bangs', 'natural volume'"
      },
      "face": {
        "shape": "oval" | "round" | "square" | "heart" | "long" | "diamond",
        "notable_features": "distinct features — 'strong jaw', 'soft rounded cheeks', 'prominent cheekbones', 'dimples when smiling'"
      },
      "glasses": true | false,
      "glasses_description": "style if present — 'round dark frames', 'rimless', 'aviator', or null",
      "facial_hair": "description if present — 'clean-shaven', 'light stubble', 'full beard', 'mustache'",
      "expression": "detailed — 'broad genuine smile showing upper teeth, eyes crinkled', 'soft closed-lip smile', 'laughing with head tilted back'",
      "fan_gear_top": "what they're wearing — 'black baseball jersey with team colors', 'orange team t-shirt', 'navy jacket over team shirt'",
      "fan_gear_head": "hat/cap description or null — 'gray baseball cap with orange monogram', 'knit beanie in team colors', 'no hat'",
      "pose_and_body_language": "detailed — 'leaning in for selfie, head tilted toward subject 2, arm around their shoulder', 'standing arm around partner, both facing camera'",
      "distinct_identifiers": "anything else that makes this person specifically recognizable — 'slight gap between front teeth', 'mole on left cheek', 'distinctive broad smile'"
    }
  ],

  "source_lighting": "brief — 'outdoor overcast afternoon', 'golden hour evening', 'indoor arena fluorescent'",
  "time_of_day_feel": "daytime" | "evening" | "night" | "unclear",
  "crowd_visible": true | false,
  "crowd_team_affiliation": "brief — 'home team colors dominant, orange and black', 'mixed', 'none visible'",

  "display_name": "short 2-5 word name for this moment — 'Game Day at the Park', 'First Giants Game', 'Championship Night', 'Father-Daughter Opening Day'",
  "memory_text": "single evocative italic sentence 18-30 words about the experience, NOT about the people by name — 'The crack of the bat, the smell of popcorn, the roar of a full house — a perfect afternoon.'",
  "default_plaque_text": "sport-appropriate short phrase, 1-3 words — 'Play Ball!' for baseball, 'Game Day' for football, 'Tip-Off' for basketball, 'Match Day' for soccer, 'Drop the Puck' for hockey, 'Set Point' for tennis, 'Game Day' as generic fallback",

  "recommendation": {
    "preset": "stadium_tableau" | "trophy_shelf" | "trading_card",
    "mood": "game_day" | "under_the_lights" | "golden_hour",
    "reasoning": "1-2 sentences explaining the choice based on the source photo"
  },
  "alternatives": [
    { "preset": "...", "mood": "...", "reasoning": "..." }
  ]
}

CRITICAL INSTRUCTIONS:

1. SUBJECT IDENTIFICATION — this is non-negotiable for product quality:
   - FOREGROUND subjects only. People in the background (crowd) are NOT subjects — they are context and should NOT appear in the "subjects" array.
   - Maximum 4 subjects. If more than 4 people are in the foreground, include the 4 most prominent.
   - Each subject needs FULL detail. The generator uses this to hard-lock identity — missing features cause face failures.

2. AGE ACCURACY — extremely important:
   - A 60-year-old should be described as 60, not 50. Don't flatter.
   - A child should be described with specific age band like "child 8-10".
   - Aging cues like gray hair, laugh lines, crow's feet, soft jawline should be noted honestly.

3. FACIAL DISTINCTION — capture what makes THIS person this person:
   - Specific teeth features (gap, crooked incisor, bright smile)
   - Specific eye features (almond shape, droopy lid, bright blue)
   - Specific skin features (freckles, mole, dimples)
   - If there's nothing distinctive, say so — "average regular features, distinguished mainly by [X]"

4. EXPRESSION FIDELITY:
   - "Smiling" is not enough. "Broad genuine smile showing upper teeth, eyes crinkled with laugh lines" tells the generator what to render.
   - A nervous half-smile is different from a laughing belly-smile. Capture which it is.

5. FAN GEAR CAPTURE:
   - Describe colors precisely (use color terms, not team names).
   - Describe garment type accurately (jersey vs t-shirt vs jacket).
   - Note headwear style and colors.
   - Team identity detection (team_detected) is for context only — the product does not reproduce team marks.

6. DISPLAY_NAME AND MEMORY_TEXT:
   - display_name should feel like a title someone would put on a photo album page. Warm, evocative, specific.
   - memory_text should feel like something a fan would write in a journal. Sensory, atmospheric, not about naming people.
   - default_plaque_text should match the detected sport. Keep it short.

7. RECOMMENDATION:
   - stadium_tableau: source clearly shows people AT a game with visible stadium context
   - trophy_shelf: source is a home/casual photo of fans in team gear, or a posed photo
   - trading_card: source has strong character, single subject or close couple, or especially collectible moment
   - Match the mood to the lighting in the source or to the scene's emotional weight.

8. NEVER invent subjects, gear, or context not visible in the source. If something is unclear, flag it as "unclear" or null rather than guessing.

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

    const openai = new OpenAI({ apiKey: openaiApiKey })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2500,   // higher than landscapes — per-subject detail is long
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${image_b64}`, detail: 'high' },   // high detail — need facial features
          },
          {
            type: 'text',
            text: ANALYZE_PROMPT,
          },
        ],
      }],
    })

    const raw = response.choices[0]?.message?.content?.trim() || '{}'

    // Strip markdown fences if GPT wrapped the JSON despite being told not to
    const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

    let parsed: any = {}
    try {
      parsed = JSON.parse(clean)
    } catch (e) {
      console.error('[sports-analyze] JSON parse failed:', e)
      console.error('[sports-analyze] Raw response:', raw.slice(0, 500))
      // Fallback — minimal valid response so downstream doesn't break
      parsed = {
        sport: 'other',
        sport_confidence: 'low',
        at_the_game: false,
        team_detected: null,
        team_confidence: 'low',
        team_colors: [],
        num_subjects: 0,
        subjects: [],
        display_name: 'Game Day',
        memory_text: 'A day to remember.',
        default_plaque_text: 'Game Day',
        recommendation: { preset: 'stadium_tableau', mood: 'game_day', reasoning: 'Default recommendation — analyze parse failed.' },
        alternatives: [],
      }
    }

    // Log diagnostics
    console.log(`[sports-analyze] Detected: ${parsed.display_name} — ${parsed.sport} (${parsed.sport_confidence}) — ${parsed.num_subjects} subject(s)`)
    if (parsed.team_detected) {
      console.log(`[sports-analyze] Team: ${parsed.team_detected} (${parsed.team_confidence}) — colors: ${(parsed.team_colors || []).join(', ')}`)
    }

    return NextResponse.json(parsed)

  } catch (err: any) {
    console.error('[sports-analyze] Fatal:', err.message)
    // Graceful fallback — product should still function if analyze fails
    return NextResponse.json({
      sport: 'other',
      sport_confidence: 'low',
      at_the_game: false,
      team_detected: null,
      team_confidence: 'low',
      team_colors: [],
      num_subjects: 0,
      subjects: [],
      display_name: 'Game Day',
      memory_text: 'A moment worth keeping.',
      default_plaque_text: 'Game Day',
      recommendation: { preset: 'stadium_tableau', mood: 'game_day', reasoning: 'Default — analyze request failed.' },
      alternatives: [],
      _error: err.message,
    })
  }
}
