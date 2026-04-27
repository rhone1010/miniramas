// face-similarity.ts
// lib/v1/face-similarity.ts
//
// Quality gate for generated group images. Compares face embeddings between
// source and generated to detect identity drift.
//
// Pipeline:
//   1. Detect faces in source (already done in tier analysis — pass them in)
//   2. Detect faces in generated image
//   3. Match generated faces to source faces by spatial position (left-to-right)
//   4. Get embeddings for each matched pair
//   5. Cosine similarity → per-person score 0..1
//   6. Worst score = the gating score for retry decisions
//
// MODEL CHOICE — see getFaceEmbedding() below.
// We don't pin a specific Replicate face-embedding model here because the
// landscape changes. Tested options as of writing:
//   - cjwbw/insightface     — solid, returns 512-dim embeddings
//   - lucataco/insightface  — fork, similar shape
//   - Replicate face-comparison models — accept 2 images directly, skip embeddings
// Pick one, slot the call into getFaceEmbedding(), tune COSINE_PASS threshold.

import Replicate           from 'replicate'
import sharp               from 'sharp'
import { detectFaces, FaceBox } from './face-detect'
import { SubjectFace }      from './face-tier'

// ── PUBLIC TYPES ─────────────────────────────────────────────────

export interface PersonScore {
  /** Subject index from source (left-to-right) */
  sourceIndex:    number
  /** Matched generated face index, or null if no match found */
  generatedIndex: number | null
  /** Cosine similarity 0..1, null if scoring failed */
  similarity:     number | null
  /** Did this person pass the threshold? */
  passed:         boolean
  /** Why scoring failed (if it did) */
  error?:         string
}

export interface SimilarityResult {
  /** Per-subject scores, in source order */
  scores:        PersonScore[]
  /** The worst (lowest) similarity across all subjects — gating score */
  worstScore:    number | null
  /** True if all subjects met threshold */
  allPassed:     boolean
  /** True if scoring couldn't run cleanly (network error, model issue) */
  scoringFailed: boolean
  /** Human-readable summary for logs / debug output */
  summary:       string
}

// ── TUNING ────────────────────────────────────────────────────────

/** Cosine similarity threshold for "good enough." Tune on real data. */
const COSINE_PASS_THRESHOLD = 0.55

// ── PUBLIC API ───────────────────────────────────────────────────

export async function scoreSimilarity(input: {
  sourceImageB64:    string
  generatedImageB64: string
  sourceSubjects:    SubjectFace[]   // from tier analysis, already detected
  replicateApiKey:   string
}): Promise<SimilarityResult> {
  // If no source subjects, nothing to compare
  if (input.sourceSubjects.length === 0) {
    return {
      scores:        [],
      worstScore:    null,
      allPassed:     true,
      scoringFailed: false,
      summary:       'no source subjects to score',
    }
  }

  // Detect faces in the generated image
  let generatedFaces: FaceBox[]
  try {
    generatedFaces = await detectFaces({
      imageB64:        input.generatedImageB64,
      replicateApiKey: input.replicateApiKey,
      expectedCount:   input.sourceSubjects.length,
      threshold:       0.25,
    })
  } catch (e: any) {
    return scoringFailedResult(input.sourceSubjects, `face detect on generated failed: ${e.message}`)
  }

  // Match by spatial position (both lists are left-to-right sorted by detectFaces)
  // If counts don't match, take what we can — flag the rest as missing
  const scores: PersonScore[] = []
  let scoringErrors = 0

  for (const subject of input.sourceSubjects) {
    const genFace = generatedFaces[subject.index] ?? null

    if (!genFace) {
      scores.push({
        sourceIndex:    subject.index,
        generatedIndex: null,
        similarity:     null,
        passed:         false,
        error:          'no matching face found in generated image',
      })
      scoringErrors++
      continue
    }

    // Crop both face regions and embed them
    let srcEmb: Float32Array | null = null
    let genEmb: Float32Array | null = null
    try {
      const [srcCropB64, genCropB64] = await Promise.all([
        cropFace(input.sourceImageB64, subject),
        cropFace(input.generatedImageB64, genFace),
      ])
      ;[srcEmb, genEmb] = await Promise.all([
        getFaceEmbedding(srcCropB64, input.replicateApiKey),
        getFaceEmbedding(genCropB64, input.replicateApiKey),
      ])
    } catch (e: any) {
      scores.push({
        sourceIndex:    subject.index,
        generatedIndex: subject.index,
        similarity:     null,
        passed:         false,
        error:          `embedding failed: ${e.message}`,
      })
      scoringErrors++
      continue
    }

    if (!srcEmb || !genEmb) {
      scores.push({
        sourceIndex:    subject.index,
        generatedIndex: subject.index,
        similarity:     null,
        passed:         false,
        error:          'embedding returned null',
      })
      scoringErrors++
      continue
    }

    const sim    = cosineSimilarity(srcEmb, genEmb)
    const passed = sim >= COSINE_PASS_THRESHOLD
    scores.push({
      sourceIndex:    subject.index,
      generatedIndex: subject.index,
      similarity:     sim,
      passed,
    })
  }

  // If every score errored, treat as scoring failure (let the orchestrator
  // ship with a quality_warning rather than block)
  const validScores = scores.filter(s => s.similarity !== null)
  const scoringFailed = validScores.length === 0

  if (scoringFailed) {
    return {
      scores,
      worstScore:    null,
      allPassed:     true,    // can't fail what we can't measure
      scoringFailed: true,
      summary:       `scoring failed for all ${scores.length} subjects`,
    }
  }

  const worstScore = Math.min(...validScores.map(s => s.similarity as number))
  const allPassed  = scores.every(s => s.passed)
  const passLabel  = allPassed ? 'PASS' : 'FAIL'

  console.log(
    `[face-similarity] ${passLabel} worst=${worstScore.toFixed(3)} ` +
    `n=${scores.length} threshold=${COSINE_PASS_THRESHOLD}`
  )

  return {
    scores,
    worstScore,
    allPassed,
    scoringFailed: false,
    summary:       `worst=${worstScore.toFixed(3)} threshold=${COSINE_PASS_THRESHOLD}`,
  }
}

// ── HELPERS ──────────────────────────────────────────────────────

function scoringFailedResult(
  subjects: SubjectFace[],
  reason: string,
): SimilarityResult {
  console.warn(`[face-similarity] scoring failed: ${reason}`)
  return {
    scores: subjects.map(s => ({
      sourceIndex:    s.index,
      generatedIndex: null,
      similarity:     null,
      passed:         false,
      error:          reason,
    })),
    worstScore:    null,
    allPassed:     true, // can't fail what we can't measure
    scoringFailed: true,
    summary:       reason,
  }
}

async function cropFace(imageB64: string, box: FaceBox): Promise<string> {
  // 20% margin around the face for embedding context
  const margin = 0.20
  const dx = Math.round(box.width  * margin)
  const dy = Math.round(box.height * margin)
  const buf = Buffer.from(imageB64, 'base64')
  const meta = await sharp(buf).metadata()
  const W = meta.width  ?? 1024
  const H = meta.height ?? 1024
  const x  = Math.max(0, box.x - dx)
  const y  = Math.max(0, box.y - dy)
  const x2 = Math.min(W, box.x + box.width  + dx)
  const y2 = Math.min(H, box.y + box.height + dy)
  const cropBuf = await sharp(buf)
    .extract({ left: x, top: y, width: x2 - x, height: y2 - y })
    .jpeg({ quality: 92 })
    .toBuffer()
  return cropBuf.toString('base64')
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error('descriptor_length_mismatch')
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

// ── EMBEDDING MODEL CALL ─────────────────────────────────────────
// TODO: Pin a specific Replicate face-embedding model and update the call
// below. The function contract: take a face crop, return a Float32Array
// embedding (any dimension — cosineSimilarity works on any length).
//
// SUGGESTED OPTIONS:
//   1. cjwbw/insightface
//      - Returns 512-dim embeddings
//      - Input: image URL or data URI
//      - Output shape: { embedding: number[] } or similar
//
//   2. Skip embeddings entirely — use a face-comparison model that takes
//      two images and returns similarity directly. Simpler but less efficient
//      when comparing one source against multiple retry generations.
//
// REPLACE the body of getFaceEmbedding() with the actual call once you've
// picked a model. The rest of this file works regardless of which you pick.

async function getFaceEmbedding(
  faceCropB64: string,
  replicateApiKey: string,
): Promise<Float32Array> {
  const replicate = new Replicate({ auth: replicateApiKey })
  const dataUri   = `data:image/jpeg;base64,${faceCropB64}`

  // ─── REPLACE THIS BLOCK WITH YOUR CHOSEN MODEL ──────────────
  // Placeholder shape that documents what we expect:
  //
  //   const output = await replicate.run('OWNER/MODEL', {
  //     input: { image: dataUri, ...other_params }
  //   }) as { embedding: number[] }
  //
  //   return new Float32Array(output.embedding)
  //
  // For now, throw so failures are loud and obvious:
  throw new Error(
    'getFaceEmbedding not yet wired to a Replicate model. ' +
    'See lib/v1/face-similarity.ts header notes to pick a model.'
  )
  // ─────────────────────────────────────────────────────────────
}
