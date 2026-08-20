// lib/v1/wallpapers/liten-mark.ts
//
// THE LITEN & CO MARK, AS PATH DATA.
//
// Regenerated from public/liten-and-co.svg on 2026-08-19. Eight paths,
// viewBox 1821.36 x 1528.47.
//
// ── ONE PATH IS DELIBERATELY MISSING ───────────────────────────────────
//
// The source SVG carries NINE paths. The first has class="cls-1" with
// fill:#fff and is a white underlay sitting inside the L's counter — in
// the two-tone original it is invisible, doing nothing but backing the
// outline.
//
// Forced to white for a single-colour watermark it FILLS THE COUNTER, and
// the L comes back as a solid blob instead of a stroke. The first version
// of this file included it and that is exactly what happened.
//
// So: eight paths, not nine. If this is ever regenerated from the SVG,
// drop any path carrying cls-1 and check the L before shipping it.
//
// ── WHY IT IS HERE AND NOT READ FROM public/ ───────────────────────────
//
// public/ is served by the CDN. It is not guaranteed to be on the disk a
// serverless function runs from, so fs.readFile('public/liten-and-co.svg')
// works in local dev and can throw in production. The watermark is the
// only thing protecting the file being sold, so it cannot depend on a read
// that might not happen.
//
// The source file remains the source of truth for the mark. If it is
// redrawn, regenerate this constant from it — do not edit the coordinates
// by hand.
//
// The lettering is paths too, so no font has to be present on the runtime
// for "LITEN CO" to appear. One less thing that can differ silently
// between local and production.

export const LITEN_MARK_VIEWBOX = { width: 1821.36, height: 1528.47 }

export const LITEN_MARK_PATHS: string[] = [
  'M172.56,1026.32c59.81,48.06,167.33,108.29,234.49,43.34,7.51-7.31,14.09-15.71,19.67-24.61,14.26-22.72,27.44-46.14,40.28-69.82,83.98-157.75,157.81-319.91,244.49-476.7C801.63,337.72,965.34,47.14,1154.78,4.06c88.2-19.98,141.96,35.8,143.68,122.23,1.12,95.19-39.97,192.18-84.39,273.81-93.21,165.69-234.35,310.02-411.93,383.69-5.71,2.42-21.1,8.7-27.03,11.13-178.31,73.57-367.14,118.04-552.95,166.23-11.79,3.35-23.39,6.86-34.14,10.6-9.16,3.31-17.04,6.06-24.62,10.66-.25.17-.32.22,0-.08.14-.14.41-.4.72-.77,7.93-8.72,8.56-25.97.32-35.04,14.34,10.4,36.07,17.08,55.77,20.74,34.75,6.27,69.19,6.14,105.17,4.33,176.62-12.72,347.97-58.86,523.64-86.29,130.65-20.98,263.65-37.6,396.19-24.79,49.45,5.65,103.1,14.17,152.36,21.46,97.36,15.3,195.97,32.36,291.93,54.87,24.85,5.93,49.69,12.09,74.04,19.77-12.49-2.61-25.05-4.79-37.62-6.84-50.29-8.14-100.85-14.43-151.47-20.13-62.17-7.05-127.74-13.25-190-18.63-43.03-3.55-89.66-7.6-132.88-10.53-31.08-1.82-62.18-1.67-93.37-.24-151.37,7.7-299.78,41.98-447.26,75.18-99.09,22.36-201.57,47.15-301.96,62.43-86.59,12.25-198.26,24.95-278.16-18.32-12.4-6.79-25.28-16.07-33.28-29.59-10.83-17.98-9.36-40.69,2.8-57.12,7.02-10.09,18.48-18.14,28.49-23.56,10.25-5.6,21.37-10.08,31.7-13.92,57.8-20.47,128.2-36.9,187.44-53.11,139.82-37.08,278.41-79.27,411.88-134.93,163.21-65.41,293.58-197.81,380.71-348.59,34.61-61.51,64.82-128.9,75.25-198.55,2.93-23.14,4.66-49.37-4.84-69.61-3.72-7.21-8.08-10.62-16.07-12.07-12.64-2.13-26.56,1.43-38.98,4.9-88.91,27.75-170.29,121.13-227.41,192.8-155.4,200.75-270.39,428.27-400.72,645.65-30.08,49.42-59.98,99.34-95.82,144.97-74.38,87.72-191.88,22.29-259.39-40.51h0Z',
  'M0,1316.29h23.54v186.85h117.41v21.75H0v-208.6Z',
  'M244.95,1316.29h23.54v208.6h-23.54v-208.6Z',
  'M443.42,1338.04h-70.33v-21.75h164.2v21.75h-70.33v186.85h-23.54v-186.85Z',
  'M639.79,1316.29h150.79v21.46h-127.25v71.22h113.84v21.46h-113.84v73.01h128.74v21.46h-152.28v-208.6Z',
  'M899.05,1316.29h22.05l131.42,167.18v-167.18h22.95v208.6h-18.77l-134.7-171.05v171.05h-22.95v-208.6Z',
  'M1333.83,1421.18v-.6c0-59,44.4-107.88,105.49-107.88,37.85,0,60.79,13.11,81.36,33.08l-16.09,17.28c-17.88-16.69-36.95-28.61-65.56-28.61-46.19,0-80.76,37.55-80.76,85.53v.6c0,48.28,34.57,86.12,80.76,86.12,28.61,0,47.38-11.03,67.35-30.1l15.5,15.2c-21.46,22.05-45.89,36.65-83.44,36.65-60.2,0-104.6-47.38-104.6-107.28Z',
  'M1608.59,1421.18v-.6c0-57.51,43.21-107.88,106.69-107.88s106.09,49.77,106.09,107.28v.6c0,57.51-43.21,107.88-106.69,107.88s-106.09-49.77-106.09-107.28ZM1796.92,1421.18v-.6c0-47.38-34.57-86.12-82.25-86.12s-81.65,38.14-81.65,85.53v.6c0,47.38,34.57,86.12,82.25,86.12s81.65-38.14,81.65-85.53Z',
]

/**
 * The mark as a single-colour <g>, sized to fit a box.
 *
 * Returned as a fragment rather than a whole SVG so the caller owns the
 * outer element, the rotation and the opacity.
 */
export function litenMarkGroup(opts: {
  x:      number
  y:      number
  width:  number
  fill:   string
}): string {
  const scale = opts.width / LITEN_MARK_VIEWBOX.width
  const paths = LITEN_MARK_PATHS
    .map(d => `<path d="${d}"/>`)
    .join('')
  return (
    `<g transform="translate(${opts.x} ${opts.y}) scale(${scale})" ` +
       `fill="${opts.fill}" stroke="none">${paths}</g>`
  )
}

export const LITEN_MARK_ASPECT =
  LITEN_MARK_VIEWBOX.height / LITEN_MARK_VIEWBOX.width
