// face-refine.ts
// lib/v1/face-refine.ts
//
// Orchestrator for per-face hero refinement.
//
// Architecture (Path A):
//   1. Group generator produces a composition we like — bodies, poses, gear,
//      base, arrangement — with passable but not ship-quality faces (because
//      each face only gets ~150-200px of pixel budget in a group of 3-4).
//   2. This module runs face detection on both source + generated, matches
//      faces left-to-right, and for each face:
//        a. Crops the face region from the source photo (with margin)
//        b. Calls face-refine-generator with that crop + the person's identity
//           profile, getting back a hero-portrait sculpt of just that person
//           at full pixel budget.
//        c. Detects where the face is in the hero output.
//        d. Composites the refined face back into the group image at the
//           original position, with feathered blend + color match.
//   3. The group image now has hero-quality faces from per-face generation
//      plus group-quality composition from the group pass.
//
// Failure modes and how they're handled:
//   - Face count mismatch: if detected face counts don't match between source
//     and generated, OR don't match analysis.num_people, we skip refinement
//     entirely and return the unrefined group image with a warning. This is
//     safer than blending the wrong face onto the wrong person.
//   - Refine generation failure on a single face: we skip that face but still
//     blend the others.
//   - Face not detected in refined output: skip that face, log a warning.

import { detectFaces, FaceBox }      from './face-detect'
import { refineFace }                from './face-refine-generator'
import { blendFace }                 from './face-blend'
import { GroupAnalysis }             from './group-analyzer'
import sharp                         from 'sharp'

export interface FaceRefineResult {
  imageB64:        string                          // group image with refined faces
  facesRefined:    number                          // how many faces successfully refined
  facesSkipped:    number                          // how many we couldn't refine
  warning?:        string                          // mismatch / detection warning, if any
  perFaceLog:      Array<{
    index:          number
    targetBox:      FaceBox | null
    refinedBox:     FaceBox | null
    refined:        boolean
    skipReason?:    string
  }>
}

export async function refineFacesInGroup(input: {
  sourceImageB64:    string
  groupImageB64:     string
  analysis:          GroupAnalysis | null
  openaiApiKey:      string
  replicateApiKey:   string
  /** Skip refinement entirely if true. For debugging. */
  disabled?:         boolean
}): Promise<FaceRefineResult> {
  if (input.disabled) {
    return {
      imageB64:     input.groupImageB64,
      facesRefined: 0,
      facesSkipped: 0,
      perFaceLog:   [],
    }
  }

  const expectedCount = input.analysis?.num_people ?? undefined

  // ── 1. DETECT FACES IN BOTH IMAGES ────────────────────────
  const [sourceFaces, groupFaces] = await Promise.all([
    detectFaces({
      imageB64:        input.sourceImageB64,
      replicateApiKey: input.replicateApiKey,
      expectedCount,
    }).catch(e => { console.warn('[face-refine] source detect failed:', e.message); return [] as FaceBox[] }),
    detectFaces({
      imageB64:        input.groupImageB64,
      replicateApiKey: input.replicateApiKey,
      expectedCount,
    }).catch(e => { console.warn('[face-refine] group detect failed:', e.message); return [] as FaceBox[] }),
  ])

  console.log(
    `[face-refine] detected ${sourceFaces.length} source faces, ` +
    `${groupFaces.length} group faces, expected ${expectedCount ?? '?'}`
  )

  // ── 2. VALIDATE COUNTS ────────────────────────────────────
  if (sourceFaces.length === 0 || groupFaces.length === 0) {
    return {
      imageB64:     input.groupImageB64,
      facesRefined: 0,
      facesSkipped: Math.max(sourceFaces.length, groupFaces.length),
      warning:      'face_detection_returned_no_faces',
      perFaceLog:   [],
    }
  }
  if (sourceFaces.length !== groupFaces.length) {
    return {
      imageB64:     input.groupImageB64,
      facesRefined: 0,
      facesSkipped: groupFaces.length,
      warning:      `face_count_mismatch_source_${sourceFaces.length}_group_${groupFaces.length}`,
      perFaceLog:   [],
    }
  }
  if (expectedCount && sourceFaces.length !== expectedCount) {
    console.warn(
      `[face-refine] face count (${sourceFaces.length}) doesn't match analysis (${expectedCount}) — proceeding anyway`
    )
  }

  // ── 3. PROCESS FACES IN ORDER ──────────────────────────────
  const sourceMeta = await sharp(Buffer.from(input.sourceImageB64, 'base64')).metadata()
  const SW = sourceMeta.width  || 1024
  const SH = sourceMeta.height || 1024

  let workingImageB64 = input.groupImageB64
  let facesRefined = 0
  let facesSkipped = 0
  const perFaceLog: FaceRefineResult['perFaceLog'] = []

  for (let i = 0; i < sourceFaces.length; i++) {
    const sourceBox = sourceFaces[i]
    const targetBox = groupFaces[i]
    const identity  = input.analysis?.people?.[i] ?? null

    try {
      // 3a. Crop face from source with 30% margin
      const sourceCropBox = expandBoxClamp(sourceBox, 0.30, SW, SH)
      const sourceCropBuf = await sharp(Buffer.from(input.sourceImageB64, 'base64'))
        .extract({
          left:   sourceCropBox.x,
          top:    sourceCropBox.y,
          width:  sourceCropBox.width,
          height: sourceCropBox.height,
        })
        .jpeg({ quality: 95 })
        .toBuffer()
      const sourceCropB64 = sourceCropBuf.toString('base64')

      // 3b. Generate hero portrait
      console.log(`[face-refine] refining face ${i + 1}/${sourceFaces.length}`)
      const refined = await refineFace({
        faceCropB64:  sourceCropB64,
        identity,
        openaiApiKey: input.openaiApiKey,
      })

      // 3c. Detect face within the refined hero output
      const refinedFaces = await detectFaces({
        imageB64:        refined.imageB64,
        replicateApiKey: input.replicateApiKey,
        expectedCount:   1,
      })
      if (refinedFaces.length === 0) {
        perFaceLog.push({
          index:      i,
          targetBox,
          refinedBox: null,
          refined:    false,
          skipReason: 'no_face_detected_in_refined_output',
        })
        facesSkipped++
        continue
      }
      const refinedFaceBox = refinedFaces[0]

      // 3d. Blend
      const blended = await blendFace({
        groupImageB64:  workingImageB64,
        refinedFaceB64: refined.imageB64,
        targetBox,
        refinedFaceBox,
      })
      workingImageB64 = blended.imageB64

      perFaceLog.push({
        index:      i,
        targetBox,
        refinedBox: refinedFaceBox,
        refined:    true,
      })
      facesRefined++

    } catch (e: any) {
      console.warn(`[face-refine] face ${i + 1} failed:`, e.message)
      perFaceLog.push({
        index:      i,
        targetBox,
        refinedBox: null,
        refined:    false,
        skipReason: e.message || String(e),
      })
      facesSkipped++
    }
  }

  console.log(`[face-refine] complete: ${facesRefined} refined, ${facesSkipped} skipped`)

  return {
    imageB64:     workingImageB64,
    facesRefined,
    facesSkipped,
    perFaceLog,
  }
}

function expandBoxClamp(b: FaceBox, marginFrac: number, maxW: number, maxH: number): FaceBox {
  const dx = Math.round(b.width  * marginFrac)
  const dy = Math.round(b.height * marginFrac)
  const x  = Math.max(0, b.x - dx)
  const y  = Math.max(0, b.y - dy)
  const x2 = Math.min(maxW, b.x + b.width  + dx)
  const y2 = Math.min(maxH, b.y + b.height + dy)
  return { x, y, width: x2 - x, height: y2 - y, score: b.score }
}
