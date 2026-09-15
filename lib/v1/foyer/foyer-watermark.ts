// lib/v1/foyer/foyer-watermark.ts
//
// THE FOYER'S OWN BAKED WATERMARK (Rich, 2026-09-14: "modified B").
//
// The free foyer reveal is given away to someone who has bought nothing, so
// its protection is in the pixels -- but not the tiled Liten & Co pattern
// (lib/store/preview.ts bakeWatermark), which stays exactly as it is for the
// Portraits free preview. The foyer instead carries ONE large Liten & Co
// lockup (the mark and the LITEN CO wordmark), across the portrait itself:
//
//   width    LOCKUP_WIDTH of the image width (62%), centred left to right
//   height   the lockup's own proportion (1528.47 / 1821.36 of its width)
//   centre   LOCKUP_CENTER_Y of the image height (58%) -- the lower face,
//            the neck and the upper chest in the foyer's framing (head ~30%
//            of the height, eyes in the upper third), so cropping it away
//            takes the portrait with it
//   ink      white at LOCKUP_OPACITY (.42), over a dark copy of the same
//            lockup at SHADOW_OPACITY (.22) offset down-right by
//            SHADOW_OFFSET of the width -- the white carries it on dark
//            artwork, the dark edge on light artwork
//
// UNDER the lockup, the diagonal lines of the foyer's earlier PREVIEW
// treatment (the glass's .wm overlay, repeating-linear-gradient(45deg,
// 3px line every 22px on the 442px desktop card) -- the same geometry, in
// white, without the word PREVIEW (Rich, 2026-09-14):
//
//   direction  45 degrees, running top-left to bottom-right, as the CSS drew it
//   period     LINES_PERIOD of the image width (22/442 = 4.98%: 42px at 848)
//   thickness  LINES_WIDTH of the image width  (3/442 = 0.68%: 6px at 848)
//   ink        white at LINES_OPACITY (.18)
//
// No tiled Liten marks. Everything is a fraction of the image, so it lands
// in the same place at whatever size NB2 returns; the image's own
// dimensions are kept. FAIL CLOSED, as bakeWatermark does: any failure
// throws, and the caller treats it as a failed reveal -- never a clean image.
//
// The lockup is embedded here, not read from disk, so it is always in the
// serverless bundle: the paths of the approved masthead mark
// (public/discovery-consolidated-draft.html, .mh-mark), unchanged.

import sharp from 'sharp'

export const LOCKUP_WIDTH    = 0.62
export const LOCKUP_CENTER_Y = 0.58
export const LOCKUP_OPACITY  = 0.42
export const SHADOW_OPACITY  = 0.22
export const SHADOW_OFFSET   = 0.0035   // of the image width (3px at 848)
export const LINES_PERIOD    = 22 / 442 // of the image width -- the glass .wm's 22px on its 442px card
export const LINES_WIDTH     = 3 / 442  // of the image width -- its 3px line
export const LINES_OPACITY   = 0.18
export const LINES_ANGLE     = -45      // SVG rotate of vertical stripes: top-left to bottom-right, as CSS 45deg draws
const LOCKUP_VIEWBOX = '0 0 1821.36 1528.47'
const LOCKUP_PATHS = `<g><path d="M172.56,1026.32c59.81,48.06,167.33,108.29,234.49,43.34,7.51-7.31,14.09-15.71,19.67-24.61,14.26-22.72,27.44-46.14,40.28-69.82,83.98-157.75,157.81-319.91,244.49-476.7C801.63,337.72,965.34,47.14,1154.78,4.06c88.2-19.98,141.96,35.8,143.68,122.23,1.12,95.19-39.97,192.18-84.39,273.81-93.21,165.69-234.35,310.02-411.93,383.69-5.71,2.42-21.1,8.7-27.03,11.13-178.31,73.57-367.14,118.04-552.95,166.23-11.79,3.35-23.39,6.86-34.14,10.6-9.16,3.31-17.04,6.06-24.62,10.66-.25.17-.32.22,0-.08.14-.14.41-.4.72-.77,7.93-8.72,8.56-25.97.32-35.04,14.34,10.4,36.07,17.08,55.77,20.74,34.75,6.27,69.19,6.14,105.17,4.33,176.62-12.72,347.97-58.86,523.64-86.29,130.65-20.98,263.65-37.6,396.19-24.79,49.45,5.65,103.1,14.17,152.36,21.46,97.36,15.3,195.97,32.36,291.93,54.87,24.85,5.93,49.69,12.09,74.04,19.77-12.49-2.61-25.05-4.79-37.62-6.84-50.29-8.14-100.85-14.43-151.47-20.13-62.17-7.05-127.74-13.25-190-18.63-43.03-3.55-89.66-7.6-132.88-10.53-31.08-1.82-62.18-1.67-93.37-.24-151.37,7.7-299.78,41.98-447.26,75.18-99.09,22.36-201.57,47.15-301.96,62.43-86.59,12.25-198.26,24.95-278.16-18.32-12.4-6.79-25.28-16.07-33.28-29.59-10.83-17.98-9.36-40.69,2.8-57.12,7.02-10.09,18.48-18.14,28.49-23.56,10.25-5.6,21.37-10.08,31.7-13.92,57.8-20.47,128.2-36.9,187.44-53.11,139.82-37.08,278.41-79.27,411.88-134.93,163.21-65.41,293.58-197.81,380.71-348.59,34.61-61.51,64.82-128.9,75.25-198.55,2.93-23.14,4.66-49.37-4.84-69.61-3.72-7.21-8.08-10.62-16.07-12.07-12.64-2.13-26.56,1.43-38.98,4.9-88.91,27.75-170.29,121.13-227.41,192.8-155.4,200.75-270.39,428.27-400.72,645.65-30.08,49.42-59.98,99.34-95.82,144.97-74.38,87.72-191.88,22.29-259.39-40.51h0Z"/></g><g><path d="M0,1316.29h23.54v186.85h117.41v21.75H0v-208.6Z"/><path d="M244.95,1316.29h23.54v208.6h-23.54v-208.6Z"/><path d="M443.42,1338.04h-70.33v-21.75h164.2v21.75h-70.33v186.85h-23.54v-186.85Z"/><path d="M639.79,1316.29h150.79v21.46h-127.25v71.22h113.84v21.46h-113.84v73.01h128.74v21.46h-152.28v-208.6Z"/><path d="M899.05,1316.29h22.05l131.42,167.18v-167.18h22.95v208.6h-18.77l-134.7-171.05v171.05h-22.95v-208.6Z"/><path d="M1333.83,1421.18v-.6c0-59,44.4-107.88,105.49-107.88,37.85,0,60.79,13.11,81.36,33.08l-16.09,17.28c-17.88-16.69-36.95-28.61-65.56-28.61-46.19,0-80.76,37.55-80.76,85.53v.6c0,48.28,34.57,86.12,80.76,86.12,28.61,0,47.38-11.03,67.35-30.1l15.5,15.2c-21.46,22.05-45.89,36.65-83.44,36.65-60.2,0-104.6-47.38-104.6-107.28Z"/><path d="M1608.59,1421.18v-.6c0-57.51,43.21-107.88,106.69-107.88s106.09,49.77,106.09,107.28v.6c0,57.51-43.21,107.88-106.69,107.88s-106.09-49.77-106.09-107.28ZM1796.92,1421.18v-.6c0-47.38-34.57-86.12-82.25-86.12s-81.65,38.14-81.65,85.53v.6c0,47.38,34.57,86.12,82.25,86.12s81.65-38.14,81.65-85.53Z"/></g>`

function lockupSvg(fill: string, opacity: number): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOCKUP_VIEWBOX}"><g fill="${fill}" fill-opacity="${opacity}">${LOCKUP_PATHS}</g></svg>`,
  )
}

export interface FoyerWatermarkPlacement { width: number; height: number; left: number; top: number; shadow: number }

/* Where the lockup goes on an image of this size. */
export function foyerWatermarkPlacement(imageWidth: number, imageHeight: number): FoyerWatermarkPlacement {
  const [, , vbW, vbH] = LOCKUP_VIEWBOX.split(/\s+/).map(Number)
  const width  = Math.round(imageWidth * LOCKUP_WIDTH)
  const height = Math.round(width * vbH / vbW)
  return {
    width, height,
    left:   Math.round((imageWidth - width) / 2),
    top:    Math.round(imageHeight * LOCKUP_CENTER_Y - height / 2),
    shadow: Math.max(2, Math.round(imageWidth * SHADOW_OFFSET)),
  }
}

/* The diagonal lines, one full-size layer. */
export function foyerLinesGeometry(imageWidth: number): { period: number; width: number } {
  return { period: imageWidth * LINES_PERIOD, width: imageWidth * LINES_WIDTH }
}
function linesSvg(imageWidth: number, imageHeight: number): Buffer {
  const g = foyerLinesGeometry(imageWidth)
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${imageHeight}">` +
      `<defs><pattern id="l" patternUnits="userSpaceOnUse" width="${g.period}" height="${g.period}" patternTransform="rotate(${LINES_ANGLE})">` +
        `<rect x="0" y="0" width="${g.width}" height="${g.period}" fill="#ffffff" fill-opacity="${LINES_OPACITY}"/>` +
      `</pattern></defs>` +
      `<rect x="0" y="0" width="${imageWidth}" height="${imageHeight}" fill="url(#l)"/>` +
    `</svg>`,
  )
}

async function renderLockup(width: number, height: number, fill: string, opacity: number): Promise<Buffer> {
  return sharp(lockupSvg(fill, opacity), { density: 300 })
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer()
}

/** The foyer reveal's watermark, baked in. Returns PNG base64 (as
 *  bakeWatermark does). Throws on any failure -- fail closed. */
export async function bakeFoyerWatermark(imageB64: string): Promise<string> {
  const src = Buffer.from(imageB64, 'base64')
  const { width, height } = await sharp(src).metadata()
  if (!width || !height) throw new Error('foyer watermark: image has no dimensions')
  const p = foyerWatermarkPlacement(width, height)
  const [lines, shadow, mark] = await Promise.all([
    sharp(linesSvg(width, height)).png().toBuffer(),
    renderLockup(p.width, p.height, '#1a120c', SHADOW_OPACITY),
    renderLockup(p.width, p.height, '#ffffff', LOCKUP_OPACITY),
  ])
  const out = await sharp(src)
    .composite([
      { input: lines,  left: 0, top: 0 },
      { input: shadow, left: p.left + p.shadow, top: p.top + p.shadow },
      { input: mark,   left: p.left,            top: p.top },
    ])
    .png()
    .toBuffer()
  const check = await sharp(out).metadata()
  if (check.width !== width || check.height !== height) throw new Error('foyer watermark: dimensions changed')
  return out.toString('base64')
}
