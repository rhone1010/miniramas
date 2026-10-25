// scripts/mug-experiment/lib.ts
//
// The Groups ceramic-mug composition experiment: wrap builders, previews and checks. EXPERIMENT ONLY: nothing here is wired into the live Gift Shop. Geometry facts and their sources:
//   Prodigi GLOBAL-MUG-W print area 2670 x 1110 (prodigi_api); handle seam at the file's two edges (prodigi_template); template face centres 598 and 2069 (prodigi_template);
//   the 38 px top and bottom design margins (liten_policy, MUG.fullWrap). The VIEWING windows below are OUR cylindrical preview renderer's geometry (tools/product-scenes), NOT a Prodigi specification:
//   Prodigi publishes no handle-clearance or edge-loss figure for this SKU (MUG.unverified).

import sharp from 'sharp'
import { MUG } from '../../lib/v1/print/production-profiles'
import { realSceneRenderer } from '../../lib/v1/gift/mockup-real'

export const WRAP = { w: MUG.wrap.w, h: MUG.wrap.h }                       // 2670 x 1110
export const BAND = { y: MUG.fullWrap.printable.y, h: MUG.fullWrap.printable.h }   // y = 38, h = 1034 (38 px margin top and bottom)
export const FACES = { front: MUG.faceCentersX[1], back: MUG.faceCentersX[0] }       // 2069 (handle on the right, what the preview photograph shows) and 598 (the other face)

export async function rawOf(png: Buffer) { const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height } }

const smooth = (t: number) => t * t * (3 - 2 * t)

/**
 * The band (2670 x 1034): the SAME composition placed whole at each requested face centre (width `panelW`, its own proportions), the rest of the band continued from the composition's own edge colours:
 *   - between two panels (and around the handle seam, which is circular) each row fades from the colour at the previous panel's edge to the colour at the next panel's edge (no people are repeated or invented);
 *   - above and below the panels each column continues from the panel's edge row, softened horizontally.
 * The composition is never regenerated, mirrored or cropped. Returns the band and the panel rectangles used.
 */
export async function buildBand(comp: Buffer, centers: number[], panelW: number): Promise<{ band: Buffer; panels: Array<{ x: number; y: number; w: number; h: number }> }> {
  const cm = await sharp(comp).metadata(); const aspect = cm.width! / cm.height!
  const pw = Math.min(panelW, Math.round(BAND.h * aspect)), ph = Math.round(pw / aspect)
  const panel = await rawOf(await sharp(comp).removeAlpha().resize(pw, ph, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer())
  const W = WRAP.w, H = BAND.h, y0 = Math.floor((H - ph) / 2)
  const sorted = [...centers].sort((a, b) => a - b).map(c => Math.round(c - pw / 2))
  const buf = new Float32Array(W * H * 3)
  const at = (x: number, y: number) => (y * W + ((x % W) + W) % W) * 3
  // 1. panel rows
  const edge = 6
  const rowColour = (side: 'L' | 'R', y: number) => { const o: number[] = [0, 0, 0]; for (let k = 0; k < edge; k++) { const x = side === 'L' ? k : pw - 1 - k, i = (Math.min(ph - 1, Math.max(0, y)) * pw + x) * 3; o[0] += panel.data[i]; o[1] += panel.data[i + 1]; o[2] += panel.data[i + 2] } return o.map(v => v / edge) }
  const rowsL: number[][] = [], rowsR: number[][] = []
  for (let y = 0; y < ph; y++) { rowsL.push(rowColour('L', y)); rowsR.push(rowColour('R', y)) }
  // soften the edge colours along y so a single noisy row cannot streak
  const soften = (rows: number[][]) => rows.map((_, y) => { const a = [0, 0, 0]; let n = 0; for (let d = -10; d <= 10; d++) { const r = rows[Math.min(ph - 1, Math.max(0, y + d))]; a[0] += r[0]; a[1] += r[1]; a[2] += r[2]; n++ } return a.map(v => v / n) })
  const boxY = (rows: number[][], r: number) => rows.map((_, y) => { const a = [0, 0, 0]; let n = 0; for (let d = -r; d <= r; d++) { const q = rows[Math.min(ph - 1, Math.max(0, y + d))]; a[0] += q[0]; a[1] += q[1]; a[2] += q[2]; n++ } return a.map(v => v / n) })
  const smoothRows = (rows: number[][]) => boxY(boxY(boxY(soften(rows), 45), 45), 45)          // a gentle, low-frequency continuation of the edge colours: no streaks
  const sL = smoothRows(rowsL), sR = smoothRows(rowsR)
  const F = 40                                                          // the panel's outer 40 px blend into the continuation so no frame edge shows (the picture itself is untouched inside)
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) for (const x0 of sorted) {
    const dEdge = Math.min(x, pw - 1 - x), k = dEdge >= F ? 1 : smooth(dEdge / F), fill = x < pw / 2 ? sL[y] : sR[y]
    for (let c = 0; c < 3; c++) buf[at(x0 + x, y0 + y) + c] = panel.data[(y * pw + x) * 3 + c] * k + fill[c] * (1 - k)
  }
  // 2. gaps (circular): from each panel's right edge to the next panel's left edge
  for (let k = 0; k < sorted.length; k++) {
    const xr = sorted[k] + pw, xl = sorted[(k + 1) % sorted.length] + (k + 1 === sorted.length ? W : 0), gap = xl - xr
    if (gap <= 0) continue
    for (let g = 0; g < gap; g++) { const t = smooth((g + 0.5) / gap); for (let y = 0; y < ph; y++) { const a = sR[y], b = sL[y], o = at(xr + g, y0 + y); for (let c = 0; c < 3; c++) buf[o + c] = a[c] + (b[c] - a[c]) * t } }
  }
  // 3. above and below: continue the first and last band rows of the panel rows, softened horizontally
  const blurRow = (y: number) => { const out = new Float32Array(W * 3), r = 28; for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) { let s = 0, n = 0; for (let d = -r; d <= r; d += 4) { s += buf[at(x + d, y) + c]; n++ } out[x * 3 + c] = s / n } return out }
  const top = blurRow(y0), bottom = blurRow(y0 + ph - 1)
  for (let y = 0; y < y0; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) buf[(y * W + x) * 3 + c] = top[x * 3 + c]
  for (let y = y0 + ph; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) buf[(y * W + x) * 3 + c] = bottom[x * 3 + c]
  // 4. a short vertical feather where the continued bands meet the panel rows (the panels themselves are left exactly as they are)
  const out = Buffer.alloc(W * H * 3); for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(buf[i])))
  return { band: await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer(), panels: sorted.map(x => ({ x, y: BAND.y + y0, w: pw, h: ph })) }
}

/** The final lab file: the band between the 38 px unprinted margins on white. */
export async function toWrap(band: Buffer): Promise<Buffer> {
  return sharp({ create: { width: WRAP.w, height: WRAP.h, channels: 3, background: '#ffffff' } }).composite([{ input: band, left: 0, top: BAND.y }]).png().toBuffer()
}

/** The wrap rolled (a circle) so file column `centerX` is in the middle, at preview scale: what the cylindrical preview renderer is given (2670:1110, half size). */
export async function previewInput(wrap: Buffer, centerX: number, scale = MUG.mockupScale): Promise<Buffer> {
  const W = Math.round(WRAP.w * scale), H = Math.round(WRAP.h * scale)
  const half = await sharp(wrap).resize(W, H, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer()
  const shift = ((Math.round(W / 2 - centerX * scale) % W) + W) % W
  if (!shift) return half
  const tail = await sharp(half).extract({ left: W - shift, top: 0, width: shift, height: H }).png().toBuffer()
  const head = await sharp(half).extract({ left: 0, top: 0, width: W - shift, height: H }).png().toBuffer()
  return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite([{ input: tail, left: 0, top: 0 }, { input: head, left: shift, top: 0 }]).png().toBuffer()
}

/** One mug preview through OUR cylindrical renderer (the ceramic-mug scene), from the one final wrap file. */
export async function renderMug(wrap: Buffer, centerX: number, id: string): Promise<Buffer> {
  const input = await previewInput(wrap, centerX)
  const out = await realSceneRenderer.render({ sceneId: 'ceramic-mug', productFamily: 'mug', artworkId: id, artwork: input })
  return out.png
}

/** A numbered calibration grid in the exact 2670 x 1110 layout: a column number every 100 px, ticks every 50, the 38 px margins hatched, the template faces and the seam marked. */
export async function calibrationGrid(): Promise<Buffer> {
  const W = WRAP.w, H = WRAP.h
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#f4f1ea"/>`
  s += `<rect x="0" y="0" width="${W}" height="${BAND.y}" fill="#bbb"/><rect x="0" y="${BAND.y + BAND.h}" width="${W}" height="${H - BAND.y - BAND.h}" fill="#bbb"/>`
  for (let x = 0; x <= W; x += 50) s += `<line x1="${x}" y1="${BAND.y}" x2="${x}" y2="${BAND.y + BAND.h}" stroke="${x % 100 === 0 ? '#222' : '#999'}" stroke-width="${x % 100 === 0 ? 3 : 1}"/>`
  for (let x = 0; x < W; x += 100) s += `<rect x="${x + 4}" y="${BAND.y + 10}" width="${String(x).length * 26 + 8}" height="42" fill="#fff"/><text x="${x + 8}" y="${BAND.y + 44}" font-family="Arial" font-weight="bold" font-size="36" fill="${[0, 2600].includes(x) ? '#c00' : '#003'}">${x}</text>`
  for (let x = 0; x < W; x += 100) s += `<text x="${x + 8}" y="${BAND.y + BAND.h - 14}" font-family="Arial" font-size="30" fill="#003">${x}</text>`
  s += `<line x1="2" y1="0" x2="2" y2="${H}" stroke="#c00" stroke-width="6"/><line x1="${W - 2}" y1="0" x2="${W - 2}" y2="${H}" stroke="#c00" stroke-width="6"/>`
  for (const [x, label, col] of [[FACES.back, 'FACE 598', '#0a0'], [FACES.front, 'FACE 2069', '#00c'], [1334.5, 'OPPOSITE HANDLE', '#a0a']] as const) s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${col}" stroke-width="5"/><text x="${x + 10}" y="${H / 2}" font-family="Arial" font-weight="bold" font-size="40" fill="${col}">${label}</text>`
  for (let y = BAND.y; y <= BAND.y + BAND.h; y += 100) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#bbb" stroke-width="1"/>`
  s += `</svg>`
  return sharp(Buffer.from(s)).png().toBuffer()
}

/**
 * DIAGNOSTIC, not a renderer: the half of the wrap a viewer sees (+-90 degrees about `centerX`) projected orthographically onto a cylinder (screen x = R sin(theta)), shaded by cos(theta). It shows how much
 * the picture compresses toward the silhouette, to judge whether anything important disappears around the curvature. The real previews are the renderer's.
 */
export async function curvatureDiagnostic(wrap: Buffer, centerX: number, label: string): Promise<Buffer> {
  const src = await rawOf(wrap), Wd = 560, Hd = 730          // the true cylinder: circumference 2670 px, radius 425, silhouette 850 wide x 1110 high, scaled by 0.66
  const out = Buffer.alloc(Wd * Hd * 3, 255)
  for (let oy = 0; oy < Hd; oy++) for (let ox = 0; ox < Wd; ox++) {
    const s = (ox + 0.5) / Wd * 2 - 1, th = Math.asin(Math.max(-1, Math.min(1, s))), sx = (((centerX + th / Math.PI * (WRAP.w / 2)) % WRAP.w) + WRAP.w) % WRAP.w, sy = Math.min(src.h - 1, Math.floor((oy + 0.5) / Hd * src.h))
    const x0 = Math.floor(sx), x1 = (x0 + 1) % WRAP.w, f = sx - x0, shade = 0.5 + 0.5 * Math.cos(th)
    for (let c = 0; c < 3; c++) out[(oy * Wd + ox) * 3 + c] = Math.round((src.data[(sy * src.w + x0) * 3 + c] * (1 - f) + src.data[(sy * src.w + x1) * 3 + c] * f) * shade + 255 * (1 - shade) * 0.35)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${Hd + 30}"><text x="8" y="${Hd + 22}" font-family="Arial" font-size="18" fill="#222">${label}</text></svg>`
  return sharp({ create: { width: Wd, height: Hd + 30, channels: 3, background: '#fff' } }).composite([{ input: await sharp(out, { raw: { width: Wd, height: Hd, channels: 3 } }).png().toBuffer(), left: 0, top: 0 }, { input: Buffer.from(svg), left: 0, top: 0 }]).png().toBuffer()
}
