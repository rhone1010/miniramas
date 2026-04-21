import OpenAI from 'openai'

const ARCHITECTURE_PROMPT = `
You are an expert architectural analyst. Examine this building photograph and provide a precise, structured description for use in creating a museum-quality scale model replica.

Describe the following in detail — be specific and factual, not poetic:

BUILDING TYPE & STYLE:
- Architectural style (e.g. Second Empire, Queen Anne Victorian, Colonial Revival, Craftsman Bungalow, Ranch, etc.)
- Number of stories

ROOF:
- Roof type — be precise (mansard, gable, hip, gambrel, flat, etc.)
- For MANSARD roofs specifically: describe the steep near-vertical lower slope angle (typically 70-80 degrees), the flat or low-pitched upper deck, and confirm it wraps all four sides of the building
- For GAMBREL roofs: describe both slope angles
- Dormer count, exact style (pedimented, arched, eyebrow, shed, etc.), and placement — count them precisely from each view
- Any roof projections, turrets, cupolas, or towers
- Roofing material visible on both upper and lower slopes if different
- Height of roof relative to building walls — is the roof taller than, equal to, or shorter than the wall height?

FACADE LAYOUT:
- Number of bays across the front facade
- Any projecting bays, corner bays, or octagonal/polygonal sections
- Any setbacks or recesses in the facade plane
- Describe which direction the main porch faces and its exact configuration (wraparound, front-only, octagonal corner projection, etc.)

PORCH:
- Porch type and extent (full wraparound, partial, corner projection, etc.)
- Column style and count visible
- Railing style
- STAIR LOCATION — this is critical: state exactly which side of the porch the entry stairs are on (left, right, center, or not visible). Only describe stairs that are clearly visible. Example: "Entry stairs on the LEFT side of the front porch" or "Stairs centered on front facade"
- Any decorative porch details

WINDOWS:
- Window style (double-hung, bay, arched, palladian, etc.)
- Approximate count per floor
- Any notable window groupings or decorative surrounds

EXTERIOR MATERIALS:
- Siding type and color (clapboard, shingles, brick, stucco, etc.)
- Trim color and material
- Foundation material if visible

DECORATIVE ELEMENTS:
- Cornices, brackets, moldings
- Any gingerbread, bargeboards, or decorative trim
- Chimneys — count, position, material

Be precise and literal. This description will be used to reconstruct the exact 3D form of this building as a scale model.

CRITICAL GEOMETRY FLAGS — call these out explicitly if present:
- MANSARD ROOF: Flag as "MANSARD — steep lower slope, flat upper deck" and state the approximate lower slope angle
- OCTAGONAL/POLYGONAL BAYS: Flag as "OCTAGONAL BAY — projects outward as a multi-faceted 3D corner, NOT a flat wall" and describe which corner
- WRAPAROUND PORCH: Flag its exact extent (full wrap, three-quarter, L-shape, etc.)
- PROJECTING BAYS: Flag each one with "BAY PROJECTION — extends outward from main wall plane" and its position
These flags will be used to ensure the 3D model does not simplify complex geometry.

ELEMENT VISIBILITY FLAGS — explicitly state for each:
- STAIRS: "Stairs visible on [left/right/center] side of porch" or "Stairs NOT clearly visible — do not add"
- SIDE PORCH or EXTENSIONS: "Side extension visible on [left/right]" or "Not visible — do not add"
- Any element you are uncertain about: flag it as "NOT CONFIRMED — do not render" 
`.trim()

export async function analyzeArchitecture(input: {
  sourceImageB64: string
  extraImages?:   string[]
  openaiApiKey:   string
}): Promise<{ description: string; success: boolean; error?: string }> {
  try {
    const openai = new OpenAI({ apiKey: input.openaiApiKey })
    const extras = (input.extraImages || []).filter(Boolean)
    const totalImages = 1 + extras.length

    // Build content array — all images first, then the analysis prompt
    // GPT-4o will analyze all angles together for a complete 3D picture
    const imageContent: any[] = [
      {
        type: 'image_url',
        image_url: {
          url:    `data:image/jpeg;base64,${input.sourceImageB64}`,
          detail: 'high',
        },
      },
      ...extras.map((b64, i) => ({
        type: 'image_url',
        image_url: {
          url:    `data:image/jpeg;base64,${b64}`,
          detail: 'high',
        },
      })),
    ]

    const promptText = totalImages > 1
      ? `You have been provided ${totalImages} photographs of the same building from different angles (street view perspectives). Analyze ALL images together to build a complete understanding of the building's 3D form — each image reveals aspects of the structure not visible from other angles.\n\n${ARCHITECTURE_PROMPT}`
      : ARCHITECTURE_PROMPT

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: totalImages > 1 ? 1200 : 800,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: promptText,
            },
          ],
        },
      ],
    })

    const description = response.choices[0]?.message?.content?.trim()
    if (!description) throw new Error('No description returned')

    console.log(`[analyze-architecture] Done — ${totalImages} image(s), ${description.length} chars`)
    return { description, success: true }

  } catch (e: any) {
    console.error('[analyze-architecture] Error:', e.message)
    return { description: '', success: false, error: e.message }
  }
}
