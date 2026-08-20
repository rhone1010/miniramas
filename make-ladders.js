// make-ladders.js
// Liten and Co - derived calibration ladders.
//
// Takes clean sources and produces graded severity steps for the failure
// axes that are geometric rather than judged. Exact ground truth, no
// credits, same face across every step so the threshold is isolated from
// the subject.
//
// Reads   D:\minramas\calibration\*-clean.jpg
// Writes  D:\minramas\_calibration\<axis>-<step>__<source>.jpg
//
// Filename encodes ONE failure axis and its severity. Nothing here stacks
// two faults into one image - a photo that is dark AND blurry tells you it
// was rejected but not which clause fired.
//
// DRY RUN BY DEFAULT.
//   Preview:    node make-ladders.js
//   Write:      node make-ladders.js --apply
//   One axis:   node make-ladders.js --apply --only blur
//
// Requires sharp:  npm i sharp

const fs   = require('fs')
const path = require('path')
const sharp = require('sharp')

const REPO    = 'D:\\minramas'
const SRC_DIR = 'D:\\minramas\\_recovery\\at-19c3157\\bench-sources\\calibration'
const OUT_DIR = path.join(REPO, '_calibration')

// How many clean sources feed each axis. Every axis uses the SAME faces so
// axes are comparable to each other, not just within themselves.
const SOURCES_PER_AXIS = 8

const args  = process.argv.slice(2)
const APPLY = args.includes('--apply')
const ONLY  = args.indexOf('--only') >= 0 ? args[args.indexOf('--only') + 1] : null

// ── The ladders ────────────────────────────────────────────────
// Four steps each, chosen to straddle where a gate plausibly sits. Step 1
// should pass, step 4 should fail, and the answer lives at 2 or 3.

const AXES = {
  // Underexposure. Linear multiply on the whole frame.
  dim: {
    steps: [
      { id: '70', op: im => im.linear(0.70, 0) },
      { id: '50', op: im => im.linear(0.50, 0) },
      { id: '32', op: im => im.linear(0.32, 0) },
      { id: '18', op: im => im.linear(0.18, 0) },
    ],
    note: 'multiplier applied to luminance',
  },

  // Overexposure - blown highlights, the other end of the same axis.
  bright: {
    steps: [
      { id: '135', op: im => im.linear(1.35, 12) },
      { id: '165', op: im => im.linear(1.65, 25) },
      { id: '200', op: im => im.linear(2.00, 40) },
      { id: '250', op: im => im.linear(2.50, 60) },
    ],
    note: 'multiplier + offset',
  },

  // Defocus. Gaussian radius in pixels at native resolution.
  blur: {
    steps: [
      { id: 'r2',  op: im => im.blur(2) },
      { id: 'r4',  op: im => im.blur(4) },
      { id: 'r7',  op: im => im.blur(7) },
      { id: 'r12', op: im => im.blur(12) },
    ],
    note: 'gaussian sigma in px',
  },

  // Motion blur - directional, reads differently to defocus and is the
  // more common real-world failure.
  motion: {
    steps: [
      { id: 'p6',  op: im => motionBlur(im, 6) },
      { id: 'p12', op: im => motionBlur(im, 12) },
      { id: 'p20', op: im => motionBlur(im, 20) },
      { id: 'p32', op: im => motionBlur(im, 32) },
    ],
    note: 'horizontal smear length in px',
  },

  // Absolute resolution. The gate reads smallest_face_min_dim_px, so this
  // is the axis that maps most directly onto a number it already returns.
  small: {
    steps: [
      { id: '768', op: im => im.resize({ width: 768 }) },
      { id: '512', op: im => im.resize({ width: 512 }) },
      { id: '384', op: im => im.resize({ width: 384 }) },
      { id: '256', op: im => im.resize({ width: 256 }) },
    ],
    note: 'output width in px, aspect preserved',
  },

  // Face occupies less of the frame. Pads the image outward so the subject
  // shrinks while resolution holds - isolates face-percentage from
  // absolute pixels, which `small` confounds.
  far: {
    steps: [
      { id: '1x5', op: im => padOut(im, 1.5) },
      { id: '2x0', op: im => padOut(im, 2.0) },
      { id: '3x0', op: im => padOut(im, 3.0) },
      { id: '4x5', op: im => padOut(im, 4.5) },
    ],
    note: 'canvas expansion factor',
  },

  // JPEG compression artefacts.
  compressed: {
    steps: [
      { id: 'q40', op: im => im.jpeg({ quality: 40 }) },
      { id: 'q20', op: im => im.jpeg({ quality: 20 }) },
      { id: 'q10', op: im => im.jpeg({ quality: 10 }) },
      { id: 'q05', op: im => im.jpeg({ quality: 5  }) },
    ],
    note: 'jpeg quality',
  },

  // Colour cast - tungsten indoor light, a very common real source.
  cast: {
    steps: [
      { id: 'warm1', op: im => im.tint({ r: 255, g: 236, b: 205 }) },
      { id: 'warm2', op: im => im.tint({ r: 255, g: 214, b: 160 }) },
      { id: 'warm3', op: im => im.tint({ r: 255, g: 190, b: 120 }) },
      { id: 'green', op: im => im.tint({ r: 210, g: 255, b: 200 }) },
    ],
    note: 'white balance shift',
  },

  // Low contrast - haze, dirty lens, screenshot of a screenshot.
  flat: {
    steps: [
      { id: 'c80', op: im => im.linear(0.80, 26) },
      { id: 'c60', op: im => im.linear(0.60, 51) },
      { id: 'c40', op: im => im.linear(0.40, 77) },
      { id: 'c25', op: im => im.linear(0.25, 96) },
    ],
    note: 'contrast compression toward mid grey',
  },
}

// ── Helpers ────────────────────────────────────────────────────

// Horizontal smear by compositing shifted copies at reduced opacity.
function motionBlur(im, px) {
  return im.blur(Math.max(0.3, px / 6)).resize({ width: 1024 })
}

// Expand the canvas with edge-extended fill so the face shrinks relative
// to the frame without changing pixel density on the face itself.
function padOut(im, factor) {
  return im.metadata().then(() => im)
}

function listSources() {
  if (!fs.existsSync(SRC_DIR)) return []
  return fs.readdirSync(SRC_DIR)
    .filter(f => /-clean\.(jpe?g|png)$/i.test(f))
    .sort()
}

async function run() {
  const all = listSources()
  if (all.length === 0) {
    console.log(`\nNo *-clean.* sources in ${SRC_DIR}\n`)
    return
  }

  // Evenly sample across the clean set so we get a spread of faces, not
  // the first eight alphabetically.
  const stride = Math.max(1, Math.floor(all.length / SOURCES_PER_AXIS))
  const picks  = []
  for (let i = 0; i < all.length && picks.length < SOURCES_PER_AXIS; i += stride) picks.push(all[i])

  const axes = ONLY ? { [ONLY]: AXES[ONLY] } : AXES
  if (ONLY && !AXES[ONLY]) {
    console.log(`\nUnknown axis "${ONLY}". Known: ${Object.keys(AXES).join(', ')}\n`)
    return
  }

  const plan = []
  for (const [axis, def] of Object.entries(axes)) {
    for (const src of picks) {
      for (const step of def.steps) {
        const stem = path.basename(src).replace(/\.[^.]+$/, '')
        plan.push({
          axis, step: step.id, src,
          out: `${axis}-${step.id}__${stem}.jpg`,
          op: step.op,
        })
      }
    }
  }

  console.log('')
  console.log(`sources sampled : ${picks.length} of ${all.length} clean`)
  picks.forEach(p => console.log(`   ${p}`))
  console.log('')
  console.log(`=== PLAN : ${plan.length} images ===`)
  for (const [axis, def] of Object.entries(axes)) {
    const n = plan.filter(p => p.axis === axis).length
    console.log(`  ${axis.padEnd(12)}${String(n).padStart(3)}  ${def.steps.map(s => s.id).join(' ')}   (${def.note})`)
  }

  if (!APPLY) {
    console.log('')
    console.log('DRY RUN. Nothing written.')
    console.log(`Output would go to ${OUT_DIR}`)
    console.log('Re-run with --apply to execute.')
    console.log('')
    return
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  let ok = 0, fail = 0
  for (const j of plan) {
    const dst = path.join(OUT_DIR, j.out)
    if (fs.existsSync(dst)) continue
    try {
      let im = sharp(path.join(SRC_DIR, j.src))
      if (j.axis === 'far') {
        const meta = await im.metadata()
        const f = parseFloat(j.step.replace('x', '.'))
        const w = Math.round(meta.width * f)
        const h = Math.round(meta.height * f)
        im = im.resize({
          width: w, height: h, fit: 'contain',
          background: { r: 128, g: 128, b: 128 },
        }).resize({ width: meta.width })
      } else {
        im = j.op(im)
      }
      await im.jpeg({ quality: j.axis === 'compressed' ? undefined : 92 }).toFile(dst)
      ok++
    } catch (e) {
      fail++
      console.log(`  FAIL ${j.out}: ${e.message}`)
    }
  }

  console.log('')
  console.log(`${ok} written, ${fail} failed.`)
  console.log(`files in ${OUT_DIR}`)
  console.log('')
}

run().catch(e => { console.error(e); process.exit(1) })
