// plaque.ts
// lib/v1/plaque.ts
//
// Post-composite a bronze/brass decorative plaque onto a finished diorama image.
// The plaque is drawn as SVG (metallic gradient + antiqued patina + engraved text)
// then composited over the lower-center of the frame where the base rim sits.
//
// Shapes: rectangular, curved, victorian
// Empty text → no-op (returns input unchanged)

import sharp from 'sharp'

type PlaqueShape = 'rectangular' | 'curved' | 'victorian'

function escSvg(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// Build the inner shape path for the plaque. Width/height are the plaque box.
function shapePath(shape: PlaqueShape, w: number, h: number): string {
  switch (shape) {
    case 'curved': {
      // Arched-top plaque — top has a gentle outward curve
      const r = h * 0.45
      return `M 0 ${r} Q 0 0 ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - 4} Q ${w} ${h} ${w - 4} ${h} L 4 ${h} Q 0 ${h} 0 ${h - 4} Z`
    }
    case 'victorian': {
      // Ornate scalloped edges — stylized decorative cartouche
      const lobe = h * 0.32
      return `
        M ${lobe} 0
        Q ${w * 0.15} ${-lobe * 0.5} ${w * 0.28} ${lobe * 0.4}
        Q ${w * 0.5} ${-lobe * 0.3} ${w * 0.72} ${lobe * 0.4}
        Q ${w * 0.85} ${-lobe * 0.5} ${w - lobe} 0
        Q ${w} ${h * 0.18} ${w + lobe * 0.3} ${h * 0.5}
        Q ${w} ${h * 0.82} ${w - lobe} ${h}
        Q ${w * 0.85} ${h + lobe * 0.5} ${w * 0.72} ${h - lobe * 0.4}
        Q ${w * 0.5} ${h + lobe * 0.3} ${w * 0.28} ${h - lobe * 0.4}
        Q ${w * 0.15} ${h + lobe * 0.5} ${lobe} ${h}
        Q ${-lobe * 0.3} ${h * 0.82} ${-lobe * 0.3} ${h * 0.5}
        Q ${-lobe * 0.3} ${h * 0.18} ${lobe} 0 Z
      `.replace(/\s+/g, ' ').trim()
    }
    case 'rectangular':
    default: {
      // Rounded rectangle
      const r = Math.min(h * 0.18, 14)
      return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`
    }
  }
}

// Estimate font size that fits text within the plaque width, with bounds
function estimateFontSize(text: string, innerWidth: number, innerHeight: number): number {
  // Georgia serif — rough average char width ≈ 0.55 × font size
  const maxByWidth  = (innerWidth * 0.95) / (text.length * 0.55)
  const maxByHeight = innerHeight * 0.6
  const fs = Math.min(maxByWidth, maxByHeight)
  // Clamp to a sensible reading size
  return Math.max(16, Math.min(44, Math.floor(fs)))
}

export async function compositePlaque(input: {
  imageB64:  string
  text:      string
  shape?:    PlaqueShape
}): Promise<string> {
  const text  = (input.text || '').trim().slice(0, 40)
  if (!text) return input.imageB64  // no text → no plaque

  const shape: PlaqueShape = input.shape || 'rectangular'

  // Decode input image to get its dimensions
  const imgBuf  = Buffer.from(input.imageB64, 'base64')
  const meta    = await sharp(imgBuf).metadata()
  const imgW    = meta.width  ?? 1024
  const imgH    = meta.height ?? 1024

  // Plaque dimensions — 40% of image width, proportional height
  // Victorian needs a bit more vertical room for lobes; use base and pad the SVG viewport
  const plaqueW = Math.round(imgW * 0.40)
  const plaqueH = Math.round(plaqueW * 0.20)  // ~5:1 aspect

  // Plaque placed centered horizontally, positioned over the lower base rim area
  // Empirically, with 65% base width + current framing, the rim center sits around y = 78% of frame
  const plaqueX = Math.round((imgW - plaqueW) / 2)
  const plaqueY = Math.round(imgH * 0.78)

  // SVG viewport with padding for victorian lobes that extend past the path box
  const pad        = shape === 'victorian' ? Math.round(plaqueH * 0.4) : 4
  const svgW       = plaqueW + pad * 2
  const svgH       = plaqueH + pad * 2

  const fontSize   = estimateFontSize(text, plaqueW, plaqueH)
  const path       = shapePath(shape, plaqueW, plaqueH)

  const svg = `
    <svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Bronze metallic gradient — warm antiqued surface with highlight band -->
        <linearGradient id="bronze" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stop-color="#8A6A3A"/>
          <stop offset="25%"  stop-color="#C49A5A"/>
          <stop offset="50%"  stop-color="#E4C48A"/>
          <stop offset="75%"  stop-color="#A07838"/>
          <stop offset="100%" stop-color="#5A3E1E"/>
        </linearGradient>
        <!-- Subtle patina tint overlay -->
        <linearGradient id="patina" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#2E1E0E" stop-opacity="0.25"/>
          <stop offset="50%"  stop-color="#6A4E2A" stop-opacity="0.05"/>
          <stop offset="100%" stop-color="#1E1408" stop-opacity="0.32"/>
        </linearGradient>
        <!-- Drop shadow beneath plaque (mounting depth) -->
        <filter id="drop" x="-10%" y="-10%" width="120%" height="130%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
          <feOffset dx="0" dy="3" result="offset"/>
          <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <!-- Inner engraved-text shadow -->
        <filter id="engrave" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.8"/>
          <feOffset dx="0" dy="1"/>
          <feComponentTransfer><feFuncA type="linear" slope="0.6"/></feComponentTransfer>
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      <g transform="translate(${pad},${pad})" filter="url(#drop)">
        <!-- Plaque body -->
        <path d="${path}" fill="url(#bronze)" stroke="#3E2A12" stroke-width="1.2"/>
        <!-- Patina overlay -->
        <path d="${path}" fill="url(#patina)"/>
        <!-- Inner bevel hairline -->
        <path d="${path}" fill="none" stroke="#FFF3C8" stroke-width="0.8" stroke-opacity="0.35"
              transform="translate(1,1) scale(${(plaqueW - 2) / plaqueW},${(plaqueH - 2) / plaqueH})"/>

        <!-- Engraved text -->
        <text x="${plaqueW / 2}" y="${plaqueH / 2 + fontSize * 0.35}"
              text-anchor="middle"
              font-family="Georgia, 'Times New Roman', serif"
              font-size="${fontSize}"
              font-weight="500"
              fill="#2A1A0A"
              letter-spacing="1.5"
              filter="url(#engrave)">${escSvg(text)}</text>
      </g>
    </svg>
  `.trim()

  const plaqueBuf = await sharp(Buffer.from(svg)).png().toBuffer()

  const out = await sharp(imgBuf)
    .composite([{
      input: plaqueBuf,
      left:  plaqueX - pad,
      top:   plaqueY - pad,
    }])
    .png({ quality: 95 })
    .toBuffer()

  return out.toString('base64')
}

// ── AI HARMONIZATION PASS ─────────────────────────────────────
// Takes an image that already has a code-composited plaque on it and runs one
// gpt-image-1 edit call to integrate the plaque with the scene's lighting and
// depth. The prompt explicitly forbids rewriting the plaque text — only soft
// blending of edges, shadow matching, and light-direction alignment.

import OpenAI, { toFile } from 'openai'

export async function integratePlaque(input: {
  compositedImageB64: string
  openaiApiKey:       string
}): Promise<string> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const prompt = [
    `PHOTOREALISTIC PLAQUE INTEGRATION PASS.`,

    `The provided image is a miniature diorama photograph. A decorative bronze plaque has been placed on the lower portion of the image where it attaches to the diorama base. The plaque is a real physical object mounted to the base.`,

    `YOUR ONLY JOB:
Integrate the plaque into the scene so it reads as a physical mounted object that belongs in this photograph. Match the scene's lighting, perspective, and depth.

Specifically:
- Match the plaque's lighting direction to the scene's existing light — the same face should be brighter, the opposite face should fall into shadow
- Add a subtle realistic cast shadow from the plaque onto the base surface beneath it, consistent with the scene's shadow angle
- Add gentle edge softening where the plaque meets the base — a tiny shadow seam, the barest suggestion of hardware or mounting
- Adjust the plaque's bronze tone subtly to pick up color bounce from the scene (warmer if scene is warm, cooler if scene is cool)
- If appropriate, add a very faint specular highlight on the plaque's top edge catching the scene's key light
- Adjust the plaque's perspective VERY subtly to match the diorama base's perspective if needed`,

    `ABSOLUTE CONSTRAINTS — DO NOT VIOLATE:
1. DO NOT REWRITE, RESTYLE, OR MODIFY THE PLAQUE TEXT. Every letter must remain exactly as shown, in the same font, same size, same position. The engraved text is correct and final — you are harmonizing lighting around it, not changing it.
2. DO NOT CHANGE THE PLAQUE SHAPE. If the plaque is rectangular, keep it rectangular. If curved-top, keep curved-top. If victorian-scalloped, keep the exact scallop pattern. Do not redesign the plaque.
3. DO NOT REDESIGN OR REPOSITION THE PLAQUE. It stays in the same location, same size, same shape, same text. Your work is LIGHTING ONLY.
4. DO NOT ALTER ANY OTHER PART OF THE IMAGE. The diorama, the base, the background — all must remain identical. Only the plaque region and its immediate shadow zone on the base beneath it may change.

This is a lighting and shadow harmonization pass, not a creative pass. Treat the plaque as a real printed bronze object you are re-photographing with the correct light. Anything else is a failure.`,
  ].join('\n\n')

  const imgBuf = Buffer.from(input.compositedImageB64, 'base64')
  const file = await toFile(imgBuf, 'plaqued.png', { type: 'image/png' })
  const res = await openai.images.edit({
    model: 'gpt-image-1',
    image: file,
    prompt,
    size:  '1024x1024',
  })
  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('plaque_integration_failed')
  return b64
}

// ── UNIFIED PLAQUE APPLICATION ────────────────────────────────
// Composites the plaque and optionally runs the AI integration pass.
// If integration fails, falls back gracefully to the code-composited version.

export async function applyPlaque(input: {
  imageB64:     string
  text:         string
  shape?:       PlaqueShape
  integrate?:   boolean          // run AI harmonization pass after composite
  openaiApiKey?: string
}): Promise<string> {
  const text = (input.text || '').trim()
  if (!text) return input.imageB64

  // Step 1 — code composite (always)
  const composited = await compositePlaque({
    imageB64: input.imageB64,
    text,
    shape:    input.shape,
  })

  // Step 2 — optional AI integration
  if (!input.integrate || !input.openaiApiKey) return composited

  try {
    return await integratePlaque({
      compositedImageB64: composited,
      openaiApiKey:       input.openaiApiKey,
    })
  } catch (e: any) {
    console.warn('[plaque] integration pass failed, using composited fallback:', e.message)
    return composited
  }
}
