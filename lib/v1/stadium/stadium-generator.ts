// stadium-generator.ts
// lib/v1/stadium-generator.ts

import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'

// ── STADIUM SCENE PROFILES ────────────────────────────────────
const SCENE_PROFILES: Record<string, {
  name:    string
  surface: string
  venue:   string
  details: string
}> = {
  football: {
    name: 'Football Stadium',
    surface: 'American football gridiron — perfect natural or artificial turf, yard line markings crisp and white, hash marks, end zones in team colors.',
    venue: 'Large stadium bowl — tiered seating rising steeply, scoreboard visible, tunnel entrances. The scale of the real venue captured in miniature.',
    details: 'Goal posts at each end. Team logos on the 50-yard line. Sideline benches and equipment. Tiny crowd figures in the stands. Stadium lights.',
  },
  baseball: {
    name: 'Baseball Stadium',
    surface: 'Baseball diamond — perfect infield dirt, white bases, pitcher\'s mound, warning track. Outfield grass in perfect condition with mowing pattern.',
    venue: 'Classic baseball park — green seats, ivy on the outfield wall if classic park, scoreboard, dugouts. The soul of the specific stadium.',
    details: 'Chalk baselines. On-deck circles. Bullpen areas. The scoreboard. Tiny crowd in the stands. The classic beauty of baseball architecture.',
  },
  basketball: {
    name: 'Basketball Arena',
    surface: 'Basketball court — polished hardwood with team logo at center court, three-point lines, key painted in team colors.',
    venue: 'Indoor arena — lower bowl seating close to the court, upper deck rising, arena lighting above. The intimacy of basketball.',
    details: 'Scorer\'s table courtside. Team benches. Shot clock. Jumbotron scoreboard. Tiny crowd filling the arena. Championship banners hanging.',
  },
  soccer: {
    name: 'Soccer Stadium',
    surface: 'Soccer pitch — lush natural grass with mowing stripes, white line markings, center circle, penalty areas.',
    venue: 'Soccer stadium — four-sided stands, open or covered roof, the specific character of the stadium. International scale.',
    details: 'Goal nets. Corner flags. Advertising boards at pitch edge. Tiny crowd in the stands. The drama of the empty or full stadium.',
  },
  hockey: {
    name: 'Hockey Rink',
    surface: 'Ice hockey rink — perfect white ice surface, face-off circles in team colors, blue lines, red center line, goal creases.',
    venue: 'Hockey arena — boards and glass around the rink, penalty boxes, team benches, arena seating rising above.',
    details: 'Hockey nets with mesh detail. Boards with advertising. Scoreboard clock. Ice resurfacing door. Tiny crowd behind the glass.',
  },
  tennis: {
    name: 'Tennis Court',
    surface: 'Tennis court — hard court, clay, or grass surface with crisp white line markings, net perfectly centered and taut.',
    venue: 'Tennis venue — stadium court with tiered seating all around, the specific color of the surface, umpire chair.',
    details: 'Umpire chair. Ball boy positions. Net posts. Chair umpire. Player benches. Scoreboard. Tiny crowd in the distinctive seats.',
  },
}

const BASE_PROMPT = `
THIS IS A MUSEUM-QUALITY MINIATURE SPORTS VENUE DIORAMA PHOTOGRAPH.

The source image shows a real sports stadium or venue — recreate it as a precision architectural scale model.
This is the level of craftsmanship seen in stadium architect presentation models — exact geometry, 
accurate seating tiers, precise playing surface markings, the specific character of this venue.

The playing surface is flawless — every line marking, every detail of the field or court.
The seating is represented as a scale model — individual seat rows visible, the bowl shape accurate.
Stadium infrastructure — lights, scoreboards, roof structure — all present and accurate.

If the stadium has crowd figures, they read as tiny 1:500 scale human figures filling the seats.

BASE: The stadium sits on a large oval or rectangular dark walnut display plinth.
The full base is visible. This is an architectural presentation model of the highest quality.

CAMERA: 50-60 degrees elevated — looking down at the stadium from above at an angle,
showing the full playing surface, seating bowl, and surrounding area. Like an aerial photograph.
`.trim()

export async function generateStadium(input: {
  sourceImageB64: string
  scene:          string
  notes?:         string
  openaiApiKey:   string
}): Promise<{ imageB64: string; promptUsed: string }> {
  const openai  = new OpenAI({ apiKey: input.openaiApiKey })
  const profile = SCENE_PROFILES[input.scene] || SCENE_PROFILES.football

  const prompt = [
    BASE_PROMPT,
    `SPORT / VENUE TYPE: ${profile.name.toUpperCase()}`,
    `PLAYING SURFACE: ${profile.surface}`,
    `VENUE CHARACTER: ${profile.venue}`,
    `DETAILS: ${profile.details}`,
    input.notes ? `ADDITIONAL NOTES: ${input.notes}` : '',
    `STYLE: Architectural presentation model — the quality an architect would show a client.`,
  ].filter(Boolean).join('\n\n')

  const srcBuf = Buffer.from(input.sourceImageB64, 'base64')
  const srcBright = (await sharp(srcBuf).greyscale().stats()).channels[0].mean
  const lift = srcBright < 165 ? Math.min(165 / srcBright, 2.0) : 1.0
  const prepared = lift > 1.0
    ? await sharp(srcBuf).modulate({ brightness: lift }).png().toBuffer()
    : srcBuf

  const file = await toFile(prepared, 'source.png', { type: 'image/png' })
  const res  = await openai.images.edit({
    model: 'gpt-image-1', image: file, prompt, size: '1024x1024',
  })
  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('stadium_generation_failed')

  console.log(`[stadium] ${profile.name} — done`)
  return { imageB64: b64, promptUsed: prompt }
}
