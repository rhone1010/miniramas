// lib/structure/floodFill.ts
//
// Removes white background from a diorama image using flood fill.
// Starts from all four corners, walks inward removing connected white pixels.
// Stops at any non-white pixel — the diorama edge.
// Safe for any diorama content — base, grass, stone, wood are never near white.

import sharp from 'sharp'

const WHITE_TOLERANCE = 35   // RGB distance from 255,255,255 to treat as background
const FEATHER_PX      = 3    // px of soft edge feathering at boundary

function isWhite(r: number, g: number, b: number): boolean {
  return (
    Math.abs(r - 255) <= WHITE_TOLERANCE &&
    Math.abs(g - 255) <= WHITE_TOLERANCE &&
    Math.abs(b - 255) <= WHITE_TOLERANCE
  )
}

export async function removeWhiteBackground(imageB64: string): Promise<Buffer> {
  const inputBuffer = Buffer.from(imageB64, 'base64')

  // Get raw RGBA pixels
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width: w, height: h } = info
  const pixels  = new Uint8Array(data.buffer)
  const visited = new Uint8Array(w * h)   // 0=unvisited, 1=background, 2=foreground

  // ── FLOOD FILL ─────────────────────────────────────────────────────────────
  // BFS from all four corners simultaneously
  const queue: number[] = []

  function enqueue(x: number, y: number) {
    if (x < 0 || x >= w || y < 0 || y >= h) return
    const idx = y * w + x
    if (visited[idx]) return
    const px = idx * 4
    if (isWhite(pixels[px], pixels[px+1], pixels[px+2])) {
      visited[idx] = 1   // background
      queue.push(x, y)
    } else {
      visited[idx] = 2   // foreground — stop here
    }
  }

  // Seed from all four corners and all edges
  for (let x = 0; x < w; x++) {
    enqueue(x, 0)
    enqueue(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    enqueue(0, y)
    enqueue(w - 1, y)
  }

  // BFS
  let qi = 0
  while (qi < queue.length) {
    const x = queue[qi++]
    const y = queue[qi++]
    enqueue(x - 1, y)
    enqueue(x + 1, y)
    enqueue(x,     y - 1)
    enqueue(x,     y + 1)
  }

  // ── APPLY TRANSPARENCY ─────────────────────────────────────────────────────
  // Background pixels → transparent
  // Boundary pixels → feathered (partial transparency based on distance from edge)

  // First pass: mark background pixels transparent
  for (let i = 0; i < w * h; i++) {
    if (visited[i] === 1) {
      pixels[i * 4 + 3] = 0
    }
  }

  // Second pass: feather boundary — any foreground pixel adjacent to background
  // gets softened proportionally to how many of its neighbours are background
  for (let y = FEATHER_PX; y < h - FEATHER_PX; y++) {
    for (let x = FEATHER_PX; x < w - FEATHER_PX; x++) {
      const idx = y * w + x
      if (visited[idx] !== 2) continue   // only process foreground pixels

      // Count background neighbours in a FEATHER_PX radius
      let bgCount = 0
      let total   = 0
      for (let dy = -FEATHER_PX; dy <= FEATHER_PX; dy++) {
        for (let dx = -FEATHER_PX; dx <= FEATHER_PX; dx++) {
          const ni = (y + dy) * w + (x + dx)
          total++
          if (visited[ni] === 1) bgCount++
        }
      }

      if (bgCount > 0) {
        // Feather: more background neighbours = more transparent
        const ratio = bgCount / total
        const existingAlpha = pixels[idx * 4 + 3]
        pixels[idx * 4 + 3] = Math.round(existingAlpha * (1 - ratio * 0.85))
      }
    }
  }

  // Return RGBA PNG
  return sharp(Buffer.from(pixels.buffer), {
    raw: { width: w, height: h, channels: 4 },
  }).png().toBuffer()
}
