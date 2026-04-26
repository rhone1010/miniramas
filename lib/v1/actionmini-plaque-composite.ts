// plaqueComposite.ts
// lib/v1/actionmini-plaque-composite.ts
//
// Renders legible plaque text into the detected brass-plaque region of a
// generated Action Mini image. Uses SVG text compositing with Garamond-style
// serif typography and an engraved-dark appearance on the brass.
//
// Safe-area: we inset the text bbox 15% from the plaque perimeter so the brass
// rim and existing ornamental border remain visible around the text.

import sharp from 'sharp'

// ── TYPOGRAPHY ────────────────────────────────────────────────
// EB Garamond is a free open-source Garamond. We embed Google Fonts via
// a CSS import in the SVG so sharp can render it. Falls back to serif if
// the environment doesn't resolve the font (still renders legibly).
const FONT_IMPORT = `
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500;700&display=swap');
`.trim()

// Engraved-dark color — deep sepia/umber, not pure black. Reads as ink-in-brass.
const TEXT_COLOR   = '#2a1f0e'
const SHADOW_COLOR = 'rgba(0,0,0,0.35)'

// ── TEXT LAYOUT HELPER ────────────────────────────────────────
// Splits input text into up to 2 lines. First line gets heavier weight
// and larger size; second line is smaller (date/subtitle style).
function layoutLines(text: string): { line1: string; line2: string | null } {
  const trimmed = text.trim()
  if (!trimmed) return { line1: '', line2: null }

  // Explicit newline → use it
  if (trimmed.includes('\n')) {
    const [l1, ...rest] = trimmed.split('\n').map(s => s.trim()).filter(Boolean)
    return { line1: l1 || '', line2: rest.join(' — ') || null }
  }

  // Short single line → one line only
  if (trimmed.length <= 28) return { line1: trimmed, line2: null }

  // Long — split at a dash, comma, or middle whitespace
  const dashSplit = trimmed.match(/^(.+?)\s*[—–-]\s*(.+)$/)
  if (dashSplit) return { line1: dashSplit[1].trim(), line2: dashSplit[2].trim() }

  const commaSplit = trimmed.match(/^(.+?),\s*(.+)$/)
  if (commaSplit) return { line1: commaSplit[1].trim(), line2: commaSplit[2].trim() }

  // Fallback — split at nearest space past midpoint
  const mid = Math.floor(trimmed.length / 2)
  let splitAt = trimmed.indexOf(' ', mid)
  if (splitAt < 0) splitAt = mid
  return {
    line1: trimmed.slice(0, splitAt).trim(),
    line2: trimmed.slice(splitAt).trim() || null,
  }
}

// ── FONT SIZING ───────────────────────────────────────────────
// Scale font size to fit inside bbox width at given character count.
// Rough heuristic: Garamond average char width ≈ 0.5 × font size.
function fitFontSize(text: string, bboxW: number, maxSize: number): number {
  if (!text) return maxSize
  const est = (bboxW * 0.92) / (text.length * 0.50)
  return Math.min(maxSize, Math.max(10, Math.floor(est)))
}

// ── MAIN ──────────────────────────────────────────────────────
export async function plaqueComposite(input: {
  imageB64:    string
  plaque_bbox: { x: number; y: number; w: number; h: number } | null
  plaqueText:  string | undefined
}): Promise<{ imageB64: string; success: boolean }> {

  if (!input.plaque_bbox || !input.plaqueText?.trim()) {
    return { imageB64: input.imageB64, success: false }
  }

  try {
    const { x: bx, y: by, w: bw, h: bh } = input.plaque_bbox
    const { line1, line2 } = layoutLines(input.plaqueText)

    // Text safe-area inside the plaque (inset to preserve brass border/ornament)
    const inset = 0.15
    const safeX = Math.round(bx + bw * inset)
    const safeY = Math.round(by + bh * inset)
    const safeW = Math.round(bw * (1 - inset * 2))
    const safeH = Math.round(bh * (1 - inset * 2))

    // Font sizing — line 1 larger, line 2 smaller
    const line1Size = fitFontSize(line1, safeW, Math.floor(safeH * 0.55))
    const line2Size = line2 ? fitFontSize(line2, safeW, Math.floor(safeH * 0.32)) : 0

    // Vertical placement
    let line1Y: number, line2Y: number | null = null
    if (line2) {
      const totalH = line1Size + line2Size + Math.round(line1Size * 0.15)
      const startY = safeY + Math.round((safeH - totalH) / 2)
      line1Y = startY + line1Size
      line2Y = line1Y + Math.round(line1Size * 0.15) + line2Size
    } else {
      line1Y = safeY + Math.round((safeH + line1Size) / 2) - Math.round(line1Size * 0.15)
    }

    const centerX = safeX + Math.round(safeW / 2)

    // Ornamental divider between line1 and line2 (only if both present)
    const dividerEl = line2 ? (() => {
      const dividerY = Math.round(line1Y + (line2Y! - line1Size - line1Y) / 2) - 2
      const dividerW = Math.round(safeW * 0.30)
      const dividerX = centerX - Math.round(dividerW / 2)
      return `<line x1="${dividerX}" y1="${dividerY}" x2="${dividerX + dividerW}" y2="${dividerY}" stroke="${TEXT_COLOR}" stroke-width="0.8" opacity="0.6"/>`
    })() : ''

    // Build the SVG overlay sized to the full plaque bbox
    const svg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${bw}" height="${bh}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bw} ${bh}">
  <defs>
    <style>${FONT_IMPORT}
      .engraved {
        font-family: 'EB Garamond', 'Garamond', 'Times New Roman', serif;
        fill: ${TEXT_COLOR};
        text-anchor: middle;
        dominant-baseline: alphabetic;
      }
      .line1 { font-weight: 700; letter-spacing: 0.06em; }
      .line2 { font-weight: 500; letter-spacing: 0.10em; font-style: italic; }
    </style>
    <filter id="engrave" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" result="blur"/>
      <feOffset in="blur" dx="0.6" dy="0.6" result="shadow"/>
      <feFlood flood-color="${SHADOW_COLOR}" result="shadowColor"/>
      <feComposite in="shadowColor" in2="shadow" operator="in" result="coloredShadow"/>
      <feMerge>
        <feMergeNode in="coloredShadow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <g filter="url(#engrave)">
    <text class="engraved line1" x="${centerX - bx}" y="${line1Y - by}" font-size="${line1Size}">${escapeXml(line1.toUpperCase())}</text>
    ${dividerEl ? `<g transform="translate(${-bx}, ${-by})">${dividerEl}</g>` : ''}
    ${line2 ? `<text class="engraved line2" x="${centerX - bx}" y="${line2Y! - by}" font-size="${line2Size}">${escapeXml(line2)}</text>` : ''}
  </g>
</svg>`)

    // Render SVG to raster, composite over original image at the plaque bbox
    const textLayer = await sharp(svg).png().toBuffer()

    const srcBuf = Buffer.from(input.imageB64, 'base64')
    const result = await sharp(srcBuf)
      .composite([{ input: textLayer, left: bx, top: by, blend: 'over' }])
      .jpeg({ quality: 97 })
      .toBuffer()

    console.log(`[plaque-composite] rendered "${line1}"${line2 ? ` / "${line2}"` : ''} at (${bx}, ${by}) ${bw}×${bh}`)
    return { imageB64: result.toString('base64'), success: true }

  } catch (e: any) {
    console.error('[plaque-composite] Error:', e.message)
    return { imageB64: input.imageB64, success: false }
  }
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[c]!))
}
