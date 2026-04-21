// moments-generator.ts
// lib/v1/moments-generator.ts

import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'

// ── SCENE PROFILES ────────────────────────────────────────────
const SCENE_PROFILES: Record<string, {
  name:     string
  setting:  string
  details:  string
  mood:     string
}> = {
  wedding: {
    name: 'Wedding',
    setting: 'An outdoor garden wedding ceremony — a flower arch or altar in the background, petals on the ground, soft linen runners, seating for small groups in warm white chairs. Soft romantic golden-hour light.',
    details: 'Subtle romantic details: a small bouquet of flowers, rings on a pillow, a few scattered petals, a ribbon tied to an altar post. Everything is tasteful and elegant, never overloaded.',
    mood: 'Warm joyful romance with dignity. Late afternoon golden light kisses the scene.',
  },
  family: {
    name: 'Family',
    setting: 'A warm domestic setting — the front step of a home with a painted door, a backyard with green grass, or a living room with warm indoor light. Feels lived-in and loved.',
    details: 'Small family-life details: a wreath on the door, a toy in the corner, flowers in a window box, or a cozy rug if indoors. Never cluttered — the people are the subject.',
    mood: 'Warm, relaxed, affectionate. Soft natural light from a window or open sky.',
  },
  graduation: {
    name: 'Graduation',
    setting: 'An outdoor campus setting — a small section of stone steps leading to a columned building, a manicured lawn edge with a flowering tree. A graduation banner or school colors suggested in the background bokeh.',
    details: 'Diploma scroll with ribbon. Perhaps a bouquet of congratulation flowers. A cap tossed or held. School-color accents in banners softly out of focus.',
    mood: 'Proud, celebratory, slightly formal. Bright clear midday light with optimistic feel.',
  },
  birthday: {
    name: 'Birthday',
    setting: 'A festive setting — a party table with a small cake, candles, a few wrapped gifts stacked neatly, paper streamers or balloons in soft focus behind. Indoor warm party lighting or bright outdoor daylight.',
    details: 'A small birthday cake with a few lit candles. Ribbons, a party hat or two, wrapped gifts. Streamers or balloons in the blurred background.',
    mood: 'Playful, joyful, full of warmth. Bright celebratory lighting.',
  },
  sports: {
    name: 'Sports',
    setting: 'A stadium or sports venue — the edge of a field with grass, or a court surface, with stadium seating rising in the blurred background. Distinctive sports venue atmosphere.',
    details: 'Sports context cues visible at scale: a ball, a trophy, a flag, or equipment appropriate to the sport suggested by the uniforms. Field/court markings visible on the ground.',
    mood: 'Triumphant, energetic, victorious. Bright stadium lighting or afternoon game-day sun.',
  },
  memorial: {
    name: 'Memorial',
    setting: 'A quiet dignified setting — a gentle garden path with flowers, a bench beneath a tree, or a peaceful chapel step. Soft overcast light or gentle morning sun.',
    details: 'Softly lit candles, a small framed remembrance or single flower, a folded cloth. Understated and respectful.',
    mood: 'Quiet, reflective, tender. Soft diffuse light with no harsh shadows.',
  },
}

// ── IDENTITY BLOCK BUILDER ────────────────────────────────────
function buildIdentityBlock(features: any[]): string {
  if (!features || features.length === 0) {
    return 'PEOPLE: Render the figures as clearly identifiable from the source photograph. Match their apparent age, build, clothing colors, and pose.'
  }

  const lines = features.map((p, i) => {
    const parts = [
      `Figure ${i + 1}${p.position ? ` (${p.position})` : ''}:`,
      p.apparent_age      && `age ${p.apparent_age}`,
      p.apparent_sex      && `${p.apparent_sex}`,
      p.skin_tone         && `${p.skin_tone} skin`,
      p.hair              && `${p.hair} hair`,
      p.facial_hair && p.facial_hair !== 'none' && `${p.facial_hair}`,
      p.build             && `${p.build} build`,
      p.clothing_top      && `wearing ${p.clothing_top}`,
      p.clothing_bottom   && `with ${p.clothing_bottom}`,
      p.distinctive       && `${p.distinctive}`,
      p.pose              && `— pose: ${p.pose}`,
    ].filter(Boolean)
    return parts.join(', ')
  })

  return `PEOPLE — IDENTITY-MATCHED MINIATURE FIGURES:

Render each person as a clearly-recognizable miniature figurine that reads as a small-scale collectible version of the actual individual in the source photograph.

Per-figure features (match each exactly):
${lines.join('\n')}

IDENTITY HANDLING — CLOSE-ENOUGH, NOT PHOTOREALISTIC:
- Match apparent age, sex presentation, skin tone, hair color and length, build, and clothing colors faithfully
- Figures should be recognizable to someone who knows them — close enough that a family member would say "that's us" — but these are MINIATURES, not photographic portraits
- Subtle stylization appropriate to miniature figurine work is expected: slightly simplified facial features, softened skin texture, painted-resin finish
- Do NOT attempt hyper-realistic face reconstruction — the miniature-figure aesthetic is the goal
- Preserve the spatial relationship and pose from the source: who is standing next to whom, who is holding whom, who is seated vs standing

MATERIAL AND FINISH:
Satin-painted resin figurines — skin slightly satin with natural highlights; clothing slightly higher sheen; eyes with small clear highlights for life. Premium collectible quality, not toy-like.`
}

// ── MAIN GENERATOR ────────────────────────────────────────────
export async function generateMoments(input: {
  sourceImageB64:    string
  scene:             string
  notes?:            string
  groupDescription?: string
  people?:           any[]
  emotionalTone?:    string
  settingHint?:      string
  openaiApiKey:      string
}): Promise<{ imageB64: string; promptUsed: string }> {

  const openai  = new OpenAI({ apiKey: input.openaiApiKey })
  const profile = SCENE_PROFILES[input.scene] || SCENE_PROFILES.family

  const identityBlock = buildIdentityBlock(input.people || [])
  const groupLine     = input.groupDescription
    ? `GROUP: ${input.groupDescription}.`
    : ''
  const toneLine      = input.emotionalTone
    ? `EMOTIONAL TONE TO CAPTURE: ${input.emotionalTone}.`
    : ''

  const prompt = [
    `THIS IS A MUSEUM-QUALITY MINIATURE FIGURINE DIORAMA PHOTOGRAPH.
The source image shows real people — recreate them as a precious collectible miniature scene celebrating this moment.`,

    identityBlock,

    `SCENE TYPE: ${profile.name.toUpperCase()}
SETTING: ${profile.setting}
DETAILS: ${profile.details}
MOOD: ${profile.mood}`,

    groupLine,
    toneLine,

    input.notes ? `ADDITIONAL NOTES FROM THE PERSON WHO OWNS THIS MEMORY:\n${input.notes}` : '',

    `DIORAMA BASE:
Circular dark walnut display plinth — thick, heavy, turned-wood profile. Full base rim clearly visible. All figures and scene elements contained within the circular base footprint.
The miniature figures stand or sit on a surface material appropriate to the scene (grass for outdoor ceremonies, wood flooring for indoor scenes, grass/turf for sports, stone path for memorial, etc.).`,

    `COMPOSITION:
The base occupies approximately 65% of the image width.
15-20% clear breathing room on the LEFT of the base, 15-20% on the RIGHT. 10-15% top and bottom.
The entire base including its full rim is visible with generous space around it.
Camera 35-45 degrees elevated, angled down. Macro product photography feel — a precious small object.`,

    `ENVIRONMENT AROUND BASE:
Soft warm studio backdrop with a subtle gradient — warmer in tone behind and below the diorama, fading quietly upward. No defined features, no sky scenery, no room clutter. The diorama is the hero subject on a beautifully lit stage.
The base casts a clear soft shadow on the surface beneath it.`,

    `QUALITY:
Museum-quality miniature craftsmanship — tactile, three-dimensional, real. Every surface has physical texture and material weight. The figurines are clearly handcrafted collectibles, not toys and not photographs.
This is a treasured object someone will display forever.`,
  ].filter(Boolean).join('\n\n')

  // Brightness normalization
  const srcBuf = Buffer.from(input.sourceImageB64, 'base64')
  const bright = (await sharp(srcBuf).greyscale().stats()).channels[0].mean
  const lift   = bright < 165 ? Math.min(165 / bright, 2.0) : 1.0
  const prepared = lift > 1.0
    ? await sharp(srcBuf).modulate({ brightness: lift }).png().toBuffer()
    : srcBuf

  const file = await toFile(prepared, 'source.png', { type: 'image/png' })
  const res  = await openai.images.edit({
    model: 'gpt-image-1',
    image: file,
    prompt,
    size:  '1024x1024',
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('moments_generation_failed')

  console.log(`[moments] ${profile.name} — ${input.people?.length ?? 0} figures — done`)
  return { imageB64: b64, promptUsed: prompt }
}
