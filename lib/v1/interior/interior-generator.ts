// interior-generator.ts
// lib/v1/interior-generator.ts

import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'

// ── INTERIOR SCENE PROFILES ───────────────────────────────────
const SCENE_PROFILES: Record<string, {
  name:     string
  room:     string
  lighting: string
  details:  string
  style:    string
}> = {
  living_room: {
    name: 'Living Room',
    room: 'A warm, lived-in living room — comfortable sofa and armchairs, coffee table with books, fireplace or feature wall, bookshelves, rugs and cushions.',
    lighting: 'Warm evening light — table lamps glowing amber, fireplace casting warm flicker, the room lit from within in the most inviting way.',
    details: 'Books on shelves with readable spines. Family photos on the mantle. A plant or flowers. Cushions on the sofa. A cup of tea on the table. A dog or cat curled up.',
    style: 'The dollhouse cutaway reveals THREE walls and the ceiling — the room is shown from the open fourth-wall side, so the full interior is visible as a precious box of life.',
  },
  kitchen: {
    name: 'Kitchen',
    room: 'A beautiful kitchen — cabinetry, countertops, a kitchen island or table, appliances, open shelving with crockery and cookbooks.',
    lighting: 'Bright warm kitchen light — overhead fixtures, under-cabinet lighting, a window with natural light. The kitchen is bright and functional.',
    details: 'Cookbooks on the shelf. Herbs in pots on the windowsill. A bowl of fruit. Hanging copper pots. A kitchen timer. Something baking in the oven.',
    style: 'Dollhouse cutaway — three walls and ceiling visible, fourth wall open. Full interior revealed as a miniature stage set of kitchen life.',
  },
  bedroom: {
    name: 'Bedroom',
    room: 'A personal, beautifully made bedroom — bed with layered bedding, nightstands with lamps, a window with curtains, a reading corner perhaps.',
    lighting: 'Warm intimate evening light — bedside lamps casting pools of amber, moonlight through the curtains, the room cozy and personal.',
    details: 'Books on the nightstand. A glass of water. Artwork on the walls. Shoes by the bed. A dressing table. Curtains catching a breeze. Personal touches everywhere.',
    style: 'Dollhouse cutaway — three walls visible, the bedroom presented as a perfectly composed miniature room, full of personality.',
  },
  library: {
    name: 'Library',
    room: 'A private library or study — floor-to-ceiling bookshelves, a leather reading chair, a large desk, a globe, good reading light.',
    lighting: 'Warm library light — a green-shaded desk lamp, the warm glow of a floor lamp, firelight perhaps. The light of knowledge and comfort.',
    details: 'Books of every size and color filling every shelf. A magnifying glass. A brass telescope or globe. Papers on the desk. Reading glasses. A leather bookmark.',
    style: 'Dollhouse cutaway — the library is a cathedral of books, revealed in full by the open fourth wall. A room that tells a story.',
  },
  cafe: {
    name: 'Café',
    room: 'A beloved neighbourhood café — small round tables, mismatched chairs, a coffee bar with espresso machines, chalkboard menu, hanging plants.',
    lighting: 'Warm café light — Edison bulbs hanging from the ceiling, warm and inviting, afternoon light through the window, the glow of the coffee machine.',
    details: 'Chalkboard menu with daily specials. Coffee cups on tables. A pastry display case. Patrons as tiny figures. Newspapers folded on tables. A cat sleeping on the counter.',
    style: 'Dollhouse cutaway — the café is a scene of life, fully revealed, populated with tiny figures going about their day.',
  },
  office: {
    name: 'Office',
    room: 'A well-appointed professional office — a large desk, shelving with files and awards, a meeting table, views from the window.',
    lighting: 'Clear professional light — daylight from the window, a desk lamp, the clean light of a working day.',
    details: 'Framed certificates and awards. Family photos on the desk. A to-do list. A fine pen set. Books on management and history. A plant thriving in the corner.',
    style: 'Dollhouse cutaway — the office is revealed in full, a miniature stage of professional life and personal achievement.',
  },
}

const BASE_PROMPT = `
THIS IS A MUSEUM-QUALITY MINIATURE DOLLHOUSE DIORAMA PHOTOGRAPH.

The scene recreates an interior room as a precision-crafted dollhouse cutaway — 
the fourth wall removed to reveal the full interior as a miniature stage.

THREE WALLS AND CEILING are visible — the room is shown in perfect cross-section.
Every surface, every piece of furniture, every decorative element is a hand-crafted miniature:
- Furniture is scale model furniture with accurate upholstery, wood grain, and joinery
- Books on shelves have individual readable spines
- Artwork on walls is tiny framed pieces with visible brushwork
- Plants are precision model foliage
- Lighting fixtures glow with warm realistic light

The source image shows the actual room to be miniaturized — study the architecture, 
furniture style, color palette, and personal details. Recreate them all faithfully at 1:12 scale.

BASE: The dollhouse room sits on a rectangular dark walnut display plinth or shelf.
The room reads as a precious keepsake box opened for display.

CAMERA: Slightly elevated and front-facing — looking into the open room at a slight downward angle.
The full room interior is visible: back wall, both side walls, floor, and ceiling.
`.trim()

export async function generateInterior(input: {
  sourceImageB64: string
  scene:          string
  notes?:         string
  openaiApiKey:   string
}): Promise<{ imageB64: string; promptUsed: string }> {
  const openai  = new OpenAI({ apiKey: input.openaiApiKey })
  const profile = SCENE_PROFILES[input.scene] || SCENE_PROFILES.living_room

  const prompt = [
    BASE_PROMPT,
    `ROOM TYPE: ${profile.name.toUpperCase()}`,
    `ROOM CHARACTER: ${profile.room}`,
    `LIGHTING: ${profile.lighting}`,
    `DETAILS: ${profile.details}`,
    `PRESENTATION: ${profile.style}`,
    input.notes ? `ADDITIONAL NOTES: ${input.notes}` : '',
    `STYLE: The finest dollhouse craftsmanship — a room someone would treasure for a lifetime.`,
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
  if (!b64) throw new Error('interior_generation_failed')

  console.log(`[interior] ${profile.name} — done`)
  return { imageB64: b64, promptUsed: prompt }
}
