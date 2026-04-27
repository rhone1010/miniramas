// face-tier.ts
// lib/v1/face-tier.ts
//
// PERMISSIVE MODE — TEMPORARY.
//
// Currently passes everything through as `tier: 'figurine'` except photos
// where face detection returns zero faces. The full gatekeeper logic
// (bust detection, crowd contamination, body-visibility classification)
// is preserved as commented-out code for later re-enabling once we have
// real data on what photos should fail.
//
// This unblocks generation while we collect samples. Re-enable the full
// classifier by removing PERMISSIVE_MODE.

import { detectFaces, FaceBox } from './face-detect'

const PERMISSIVE_MODE = true

// ── PUBLIC TYPES (unchanged so callers don't break) ──────────────

export type Tier = 'figurine' | 'bust' | 'hard' | 'reject'

export type BodyVisibility = 'head_only' | 'shoulders' | 'waist_up' | 'full_body'

export interface SubjectFace extends FaceBox {
  index:          number
  bodyVisibility: BodyVisibility
  bodyHeights:    number
}

export interface PhotoTierAnalysis {
  imageWidth:      number
  imageHeight:     number
  totalFaces:      number
  subjects:        SubjectFace[]
  backgroundFaces: number
  tier:            Tier
  message:         string
  warnings:        string[]
}

// ── TUNING (kept for when we re-enable full classifier) ──────────

const SUBJECT_AREA_RATIO         = 0.25
const CROWD_FACE_COUNT_HARD      = 6
const CROWD_FACE_COUNT_WARN      = 2
const FULL_BODY_HEIGHTS          = 4.0
const WAIST_UP_HEIGHTS           = 2.0
const SHOULDERS_HEIGHTS          = 0.5
const CLOSEUP_FACE_HEIGHT_RATIO  = 0.35
const LARGE_GROUP_WARN_THRESHOLD = 5

function classifyBody(heights: number): BodyVisibility {
  if (heights >= FULL_BODY_HEIGHTS) return 'full_body'
  if (heights >= WAIST_UP_HEIGHTS)  return 'waist_up'
  if (heights >= SHOULDERS_HEIGHTS) return 'shoulders'
  return 'head_only'
}

// ── MAIN ─────────────────────────────────────────────────────────

export async function analyzeTier(input: {
  imageB64:        string
  replicateApiKey: string
  imageWidth?:     number
  imageHeight?:    number
}): Promise<PhotoTierAnalysis> {
  const faces = await detectFaces({
    imageB64:        input.imageB64,
    replicateApiKey: input.replicateApiKey,
    threshold:       0.30,
  })

  // Get dims if not provided
  let W = input.imageWidth  ?? 0
  let H = input.imageHeight ?? 0
  if (!W || !H) {
    const sharp = (await import('sharp')).default
    const meta = await sharp(Buffer.from(input.imageB64, 'base64')).metadata()
    W = meta.width  ?? 1024
    H = meta.height ?? 1024
  }

  // Build subjects from all detected faces (no foreground/background filter
  // in permissive mode — every face is a subject, ordered left-to-right)
  const subjects: SubjectFace[] = faces.map((f, i) => {
    const faceBottomY     = f.y + f.height
    const pixelsBelowFace = H - faceBottomY
    const bodyHeights     = pixelsBelowFace / f.height
    return {
      ...f,
      index:          i,
      bodyVisibility: classifyBody(bodyHeights),
      bodyHeights,
    }
  })

  // ── ZERO-FACE REJECT (only hard rejection in permissive mode) ────
  if (faces.length === 0) {
    return {
      imageWidth:      W,
      imageHeight:     H,
      totalFaces:      0,
      subjects:        [],
      backgroundFaces: 0,
      tier:            'reject',
      message:         "We couldn't find any people in this photo. Try a clearer photo with the people you'd like as figurines visible from at least the knees up.",
      warnings:        [],
    }
  }

  // ── PERMISSIVE PATH: PASS EVERYTHING ─────────────────────────────
  if (PERMISSIVE_MODE) {
    console.log(
      `[face-tier:permissive] tier=figurine subjects=${subjects.length} ` +
      `bodies=${subjects.map(s => s.bodyVisibility).join(',')}`
    )
    return {
      imageWidth:      W,
      imageHeight:     H,
      totalFaces:      faces.length,
      subjects,
      backgroundFaces: 0,
      tier:            'figurine',
      message:         `${subjects.length} ${subjects.length === 1 ? 'subject' : 'subjects'} ready for sculpting.`,
      warnings:        [],
    }
  }

  // ── FULL CLASSIFIER (disabled while PERMISSIVE_MODE is true) ─────
  // Kept here for future re-enable. To restore, set PERMISSIVE_MODE = false.
  /*
  const maxArea = Math.max(...faces.map(f => f.width * f.height))
  let subjectIndex = 0
  const allFaces = faces.map(f => {
    const area      = f.width * f.height
    const isSubject = (area / maxArea) >= SUBJECT_AREA_RATIO
    const faceBottomY     = f.y + f.height
    const pixelsBelowFace = H - faceBottomY
    const bodyHeights     = pixelsBelowFace / f.height
    return {
      ...f,
      isSubject,
      index: isSubject ? subjectIndex++ : -1,
      bodyVisibility: classifyBody(bodyHeights),
      bodyHeights,
    }
  })
  const subj = allFaces.filter(f => f.isSubject)
  const backgroundFaces = allFaces.length - subj.length

  const hasCloseup = subj.some(s => (s.height / H) > CLOSEUP_FACE_HEIGHT_RATIO)
  const worst: BodyVisibility = subj.reduce((w, f) => {
    const order: BodyVisibility[] = ['head_only', 'shoulders', 'waist_up', 'full_body']
    return order.indexOf(f.bodyVisibility) < order.indexOf(w) ? f.bodyVisibility : w
  }, 'full_body' as BodyVisibility)

  if (hasCloseup || worst === 'head_only' || worst === 'shoulders') {
    return { tier: 'bust', ... }
  }
  if (backgroundFaces >= CROWD_FACE_COUNT_HARD) {
    return { tier: 'hard', ... }
  }
  // ...
  */
}
