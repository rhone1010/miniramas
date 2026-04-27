// group-generator.ts
// lib/v1/group-generator.ts
//
// Generates a group figurine image using Google's Nano Banana
// (Gemini 2.5 Flash Image) on Replicate.
//
// PROMPT PHILOSOPHY: very short. Six-word prompts produced the validated
// outputs ("isometric resin figurine family"). Long prompts with material
// language and subject-isolation negatives actually HURT output quality —
// Nano Banana over-honors literal description and loses the transform.
//
// Each (style, variant) pair maps to a tested prompt template. The user
// picks a Style (one of four) and a Variant within that style (one of
// 2-3). Internally, that selects a one-line prompt template into which
// the analyzer's short scene summary is substituted.

import Replicate from 'replicate'

const NANO_BANANA_MODEL = 'google/nano-banana-2' as const

// ── PUBLIC TYPES ─────────────────────────────────────────────────

export type SceneStyle = 'figurine' | 'plushy' | 'stop_motion' | 'designer'

export type SceneVariant =
  | 'standard'
  | 'action_scene'
  | 'portrait'
  | 'library_edition'

export interface GroupGenerateOptions {
  /** Short scene summary from the analyzer. REQUIRED. ~5-12 words. */
  description:    string
  /** User-supplied plaque title. Appended only if present. */
  plaqueTitle?:   string
  /** Suppress plaque text. */
  noPlaque?:      boolean
  /** Style selection. */
  sceneStyle:     SceneStyle
  /** Variant within the style. Default 'standard'. */
  sceneVariant?:  SceneVariant
  /** Free-text user notes appended to the prompt */
  notes?:         string
  /** Aspect ratio. Default '1:1'. */
  aspectRatio?:   '1:1' | '4:3' | '3:4' | '16:9' | '9:16'
  /** Resolution. Default '1K'. */
  resolution?:    '1K' | '2K' | '4K'
}

export interface GroupGenerateResult {
  imageB64:   string
  promptUsed: string
}

// ── VARIANT METADATA ─────────────────────────────────────────────
// Exposed for UI consumption. The frontend reads VARIANTS_BY_STYLE
// to render the variant picker per card.

export interface VariantInfo {
  key:   SceneVariant
  label: string
}

export const VARIANTS_BY_STYLE: Record<SceneStyle, VariantInfo[]> = {
  figurine: [
    { key: 'standard',     label: 'Standard'     },
    { key: 'action_scene', label: 'Action Scene' },
    { key: 'portrait',     label: 'Portrait'     },
  ],
  plushy: [
    { key: 'standard',     label: 'Standard'     },
    { key: 'action_scene', label: 'Action Scene' },
  ],
  stop_motion: [
    { key: 'standard',     label: 'Standard'     },
    { key: 'action_scene', label: 'Action Scene' },
  ],
  designer: [
    { key: 'standard',        label: 'Standard'        },
    { key: 'library_edition', label: 'Library Edition' },
  ],
}

// ── PROMPT TEMPLATES ─────────────────────────────────────────────
// Each template is a function that takes the scene summary and returns
// the full opener. Tested empirically — these phrasings produce the
// validated outputs. Don't add "premium collectible quality" or
// "displayed on a plinth" or "highly detailed and accurate" generically;
// where templates already include qualifier language, that's intentional.

type PromptTemplate = (scene: string) => string

const PROMPT_TEMPLATES: Record<SceneStyle, Partial<Record<SceneVariant, PromptTemplate>>> = {
  figurine: {
    standard:     (s) => `An isometric resin figurine of ${s}. Highly detailed and accurate.`,
    action_scene: (s) => `An isometric resin figurine of ${s}. Make it an action shot. Highly detailed and accurate.`,
    portrait:     (s) => `Resin figurine of ${s}. Highly detailed and accurate.`,
  },
  plushy: {
    standard:     (s) => `Puffy plushie figurines of ${s}, surrounded by other plushies on a toy store shelf.`,
    action_scene: (s) => `Puffy plushie figurines of ${s}. Make it an action shot.`,
  },
  stop_motion: {
    standard:     (s) => `1960s stop motion puppets from a television show, of ${s}. Visible jointed articulation at knees, elbows, and shoulders. Fabric clothing and pants stitched onto segmented puppet bodies. Set on a 1960s sci-fi television production set with painted backdrop panels and practical stage lighting.`,
    action_scene: (s) => `1960s stop motion puppets from a television show, of ${s}. Visible jointed articulation at knees, elbows, and shoulders. Make it an action shot on a 1960s sci-fi television production set.`,
  },
  designer: {
    standard:
      (s) => `Expensive designer figurines made from high quality porcelain, of ${s}. Detail level high. Displayed inside an open red velvet presentation case with custom-fit velvet cutouts cradling each figure. Soft museum lighting.`,
    library_edition:
      (s) => `Expensive designer figurines made from high quality porcelain, of ${s}. Collector's edition setting in a library with god-rays and warm lamps in the distance. Detail level high. Expensive base with gold trim and engraved title plate.`,
  },
}

function resolveTemplate(style: SceneStyle, variant: SceneVariant): PromptTemplate {
  const styleTemplates = PROMPT_TEMPLATES[style]
  return styleTemplates[variant] ?? styleTemplates.standard!
}

// ── PROMPT ASSEMBLY ──────────────────────────────────────────────

function buildPrompt(opts: GroupGenerateOptions): string {
  const variant = opts.sceneVariant ?? 'standard'
  const template = resolveTemplate(opts.sceneStyle, variant)
  const parts: string[] = [template(opts.description)]

  // Plaque — only mention explicitly if user has an opinion.
  // If neither set: let Nano Banana auto-decide.
  const userPlaque = (opts.plaqueTitle ?? '').replace(/["']/g, '').trim()
  if (opts.noPlaque) {
    parts.push('No plaque or text.')
  } else if (userPlaque) {
    parts.push(`Brass plaque reading "${userPlaque}".`)
  }

  if (opts.notes) {
    parts.push(opts.notes.trim())
  }

  return parts.join(' ')
}

// ── REPLICATE CALL ───────────────────────────────────────────────

async function callNanoBanana(input: {
  prompt:            string
  sourceImageB64:    string
  replicateApiToken: string
  aspectRatio:       string
  resolution:        string
}): Promise<string> {
  const replicate = new Replicate({ auth: input.replicateApiToken })
  const sourceDataUrl = `data:image/jpeg;base64,${input.sourceImageB64}`

  const output: any = await replicate.run(NANO_BANANA_MODEL, {
    input: {
      prompt:        input.prompt,
      image_input:   [sourceDataUrl],
      aspect_ratio:  input.aspectRatio,
      resolution:    input.resolution,
      output_format: 'jpg',
    },
  })

  return await extractImageB64(output)
}

// ── MAIN EXPORT ──────────────────────────────────────────────────

export async function generateGroup(input: {
  sourceImageB64:    string
  replicateApiToken: string
  options:           GroupGenerateOptions
}): Promise<GroupGenerateResult> {
  const opts = input.options
  const variant = opts.sceneVariant ?? 'standard'
  const prompt = buildPrompt(opts)
  console.log(`[group-generator] style=${opts.sceneStyle} variant=${variant} prompt: ${prompt}`)

  const imageB64 = await callNanoBanana({
    prompt,
    sourceImageB64:    input.sourceImageB64,
    replicateApiToken: input.replicateApiToken,
    aspectRatio:       opts.aspectRatio ?? '1:1',
    resolution:        opts.resolution  ?? '1K',
  })

  return { imageB64, promptUsed: prompt }
}

// ── OUTPUT EXTRACTION (Replicate SDK varies; handle all known shapes) ──

async function extractImageB64(output: any): Promise<string> {
  if (typeof output === 'string') {
    return await fetchToB64(output)
  }
  if (Array.isArray(output)) {
    if (output.length === 0) throw new Error('nano_banana_empty_array')
    return await extractImageB64(output[0])
  }
  if (output && typeof output === 'object') {
    if (typeof output.url === 'function') {
      const url = output.url()
      const urlStr = typeof url === 'string' ? url : (url instanceof URL ? url.toString() : null)
      if (urlStr) return await fetchToB64(urlStr)
    }
    if (typeof output.url === 'string') {
      return await fetchToB64(output.url)
    }
    if (typeof output.getReader === 'function' || typeof output[Symbol.asyncIterator] === 'function') {
      const buf = await streamToBuffer(output)
      return buf.toString('base64')
    }
    if (output instanceof ArrayBuffer || ArrayBuffer.isView(output)) {
      return Buffer.from(output as any).toString('base64')
    }
    for (const key of ['image', 'output', 'image_url', 'data']) {
      if (typeof output[key] === 'string') {
        return await fetchToB64(output[key])
      }
    }
  }

  const typeInfo = {
    typeof:      typeof output,
    isArray:     Array.isArray(output),
    constructor: output?.constructor?.name,
    keys:        output && typeof output === 'object' ? Object.keys(output) : null,
    proto:       output && typeof output === 'object' ? Object.getOwnPropertyNames(Object.getPrototypeOf(output) || {}) : null,
  }
  console.error('[group-generator] unrecognized output shape:', typeInfo)
  throw new Error(`nano_banana_unexpected_output: ${JSON.stringify(typeInfo)}`)
}

async function fetchToB64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`nano_banana_fetch_failed: ${res.status} ${res.statusText}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return buf.toString('base64')
}

async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = []
  if (typeof stream.getReader === 'function') {
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(Buffer.from(value))
    }
  } else {
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
  }
  return Buffer.concat(chunks)
}
