import sharp from 'sharp'

// ── BACKGROUND REMOVAL ────────────────────────────────────────
// Flood fills inward from all 4 image edges, detecting background
// pixels by color similarity to the corner samples.
// The diorama is always central — edge-connected pixels = background.

const THRESHOLD = 55   // color distance to treat as background
const FEATHER   = 3    // blur radius on mask edge for smooth composite

export async function removeBg(input: {
  imageB64: string
}): Promise<{ imageB64: string; success: boolean; error?: string }> {
  try {
    const buf = Buffer.from(input.imageB64, 'base64')

    // Get raw RGBA
    const { data, info } = await sharp(buf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const w  = info.width
    const h  = info.height
    const px = new Uint8Array(data.buffer)

    // ── Sample background color from each corner (10×10 patch) ──
    const sampleCorner = (x0: number, y0: number): [number, number, number] => {
      let r = 0, g = 0, b = 0
      for (let dy = 0; dy < 10; dy++) {
        for (let dx = 0; dx < 10; dx++) {
          const i = ((y0 + dy) * w + (x0 + dx)) * 4
          r += px[i]; g += px[i + 1]; b += px[i + 2]
        }
      }
      return [r / 100, g / 100, b / 100]
    }

    const corners = [
      sampleCorner(0,     0    ),
      sampleCorner(w - 10, 0    ),
      sampleCorner(0,     h - 10),
      sampleCorner(w - 10, h - 10),
    ]
    const bgR = corners.reduce((s, c) => s + c[0], 0) / 4
    const bgG = corners.reduce((s, c) => s + c[1], 0) / 4
    const bgB = corners.reduce((s, c) => s + c[2], 0) / 4

    console.log(`[removeBg] bg sample: rgb(${Math.round(bgR)},${Math.round(bgG)},${Math.round(bgB)})`)

    const colorDist = (idx: number) => {
      const dr = px[idx]     - bgR
      const dg = px[idx + 1] - bgG
      const db = px[idx + 2] - bgB
      return Math.sqrt(dr * dr + dg * dg + db * db)
    }

    // ── BFS flood fill from all 4 edges ──────────────────────
    const visited = new Uint8Array(w * h)
    const bgMask  = new Uint8Array(w * h)   // 1 = background
    const queue: number[] = []

    const seed = (x: number, y: number) => {
      const i = y * w + x
      if (visited[i]) return
      visited[i] = 1
      if (colorDist(i * 4) < THRESHOLD) {
        bgMask[i] = 1
        queue.push(x, y)
      }
    }

    for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1) }
    for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y) }

    let qi = 0
    while (qi < queue.length) {
      const x = queue[qi++]
      const y = queue[qi++]
      for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        const ni = ny * w + nx
        if (visited[ni]) continue
        visited[ni] = 1
        if (colorDist(ni * 4) < THRESHOLD) {
          bgMask[ni] = 1
          queue.push(nx, ny)
        }
      }
    }

    // ── Apply mask — set background pixels to alpha 0 ────────
    const out = Buffer.from(data)
    for (let i = 0; i < w * h; i++) {
      if (bgMask[i]) out[i * 4 + 3] = 0
    }

    // ── Output PNG with alpha ─────────────────────────────────
    const pngBuf = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
      .png()
      .toBuffer()

    const bgPixels = bgMask.reduce((s, v) => s + v, 0)
    const pct      = Math.round(bgPixels / (w * h) * 100)
    console.log(`[removeBg] Done — ${pct}% pixels removed as background`)

    return { imageB64: pngBuf.toString('base64'), success: true }

  } catch (e: any) {
    console.error('[removeBg] Error:', e.message)
    return { imageB64: input.imageB64, success: false, error: e.message }
  }
}
