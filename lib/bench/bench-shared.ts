// lib/bench/bench-shared.ts
//
// Test Bench — shared types and constants.
//
// One engine, eight Series. The bench never duplicates pipeline logic:
// each Series exposes an adapter (bench-adapters.ts) that maps a
// BatchItem to its existing generator and normalizes the result. The
// bench owns intake gating, aesthetic scoring, triage, persistence,
// and the worker loop — nothing render-specific.
//
// Tuning model: everything a human would want to turn into a knob in
// the UI lives in BenchRunConfig and is re-read between items, so
// sensitivity changes apply mid-run without restart.

// ─── SERIES ──────────────────────────────────────────────────────

export type SeriesId =
  | 'portraits' | 'groups' | 'actionmini' | 'pets'        // subject-IS-the-piece
  | 'houses'    | 'landscapes'                            // environment-IS-the-piece
  | 'forfun'    | 'artist'

// ─── RUN CONFIG (the knobs) ──────────────────────────────────────

export interface BenchRunConfig {
  series:            SeriesId
  sourceDir:         string            // directory of source photos (local path or storage prefix)
  sourceLimit?:      number            // cap items pulled from dir (sampling)
  shuffle:           boolean           // randomize source order (default true — avoids dir-order bias)

  // Matrix: which preset/location/scale cells each source runs through.
  // One source × N cells = N batch_items. Keep cells small for sweeps.
  matrix: {
    presetIds:   string[]
    styleIds?:   string[]              // portraits-style silos only
    locationIds: string[]
    scales:      string[]
  }

  // Gate 0 — subject classification + Series redirect
  classifyEnabled:   boolean           // run subject classifier before intake (default true)
  mismatchBehavior:  'redirect' | 'tag_and_render'
  // 'redirect'        = production behavior: mismatched item gets status
  //                     'redirected', user-facing copy captured, NO generation.
  // 'tag_and_render'  = tag the mismatch but generate anyway — measures what
  //                     a wrong-Series render actually looks like (useful for
  //                     deciding how hard the production gate should be).

  // Gate 1 — intake sensitivity
  intakeThreshold:   number            // 1-10; source below this is intake_rejected. Default 6.
  intakeEnabled:     boolean           // false = pass everything through (measures raw funnel)

  // Gate 2 — output sensitivity
  fidelityThreshold:  number           // 1-10; default mirrors series gate (7)
  aestheticThreshold: number           // 1-10; default 7
  aestheticFloor:     number           // hard-fail floor regardless of fidelity; default 5

  // Pipeline behavior
  maxAttempts:       number            // override series MAX_ATTEMPTS for the run (default 2)
  triageEnabled:     boolean           // gpt-4o failure analysis on fails (default true)

  // Throughput + spend
  concurrency:       number            // parallel items; default 2. NB2 429 backoff already in generators.
  itemDelayMs:       number            // politeness gap between item starts; default 500
  costCeilingCents:  number            // runner pauses the run when run.spent_cents >= this
}

export const DEFAULT_RUN_CONFIG: Omit<BenchRunConfig, 'series' | 'sourceDir' | 'matrix'> = {
  shuffle:            true,
  classifyEnabled:    true,
  mismatchBehavior:   'redirect',
  intakeThreshold:    6,
  intakeEnabled:      true,
  fidelityThreshold:  7,
  aestheticThreshold: 7,
  aestheticFloor:     5,
  maxAttempts:        2,
  triageEnabled:      true,
  concurrency:        2,
  itemDelayMs:        500,
  costCeilingCents:   10000,           // $100 default ceiling
}

// ─── FAILURE TAXONOMY ────────────────────────────────────────────
// Fixed vocabulary. The triage model must choose from this list —
// free-text categories destroy the roll-ups. Add categories here
// deliberately; never let the model invent them.

export const FAIL_CATEGORIES = [
  'face_drift',            // likeness lost — features shifted toward generic
  'photo_paste',           // photorealistic face on sculptural body (composite look)
  'material_drift',        // sculpture material went photorealistic / wrong register
  'framing_margin',        // crop too tight, subject clipped, or margin missing
  'staging_conflict',      // environment/staging contradicts the location block
  'anatomy_error',         // extra/missing limbs, fused figures, broken hands
  'subject_count',         // wrong number of figures vs source
  'background_bleed',      // source background leaked into sculpture context
  'lighting_flat',         // lost the dramatic-luminance register; flat or muddy
  'style_generic',         // technically fine but reads as generic AI art, not Liten
  'other',
] as const

export type FailCategory = typeof FAIL_CATEGORIES[number]

// ─── INTAKE GATE RESULT ──────────────────────────────────────────

export interface IntakeResult {
  score:    number              // 1-10 composite usability, informational only
  passed:   boolean             // may the craft proceed. true for an advisory.
  /* Three outcomes, Rich's spec 2026-08-07. `passed` answers "may this go
     ahead"; `verdict` says on what terms. An advisory is usable and is
     shown to the customer as a choice, never as a refusal. */
  verdict:  'pass' | 'advisory' | 'fail'
  reasons:  string[]            // human-readable notes, pass or fail
  signals: {
    face_visible:    boolean    // subject Series only; true default for place Series
    face_size_ok:    boolean    // face large enough for likeness work
    sharpness_ok:    boolean
    lighting_ok:     boolean
    occlusion_ok:    boolean
    subject_count:   number     // estimated hero subjects
    resolution_ok:   boolean    // computed locally, not by the model
  }
}

// ─── NORMALIZED GENERATOR RESULT ─────────────────────────────────
// What every Series adapter must return, regardless of the silo's
// native result shape. Keeps the runner series-agnostic.

export interface AdapterResult {
  imageB64:        string
  fidelityScore:   number | null
  fidelityReason:  string | null
  attempts:        number
  firstPass:       boolean
  attemptLog:      unknown            // silo's attempts[] verbatim, stored as jsonb
  costCents:       number             // adapter's best estimate for this item
  durationMs:      number
}

export interface SeriesAdapter {
  series: SeriesId
  // Whether intake should run face checks (subject Series) or
  // composition-only checks (place Series).
  intakeMode: 'subject' | 'place'
  generate(input: {
    sourceImageB64:    string
    presetId:          string
    styleId?:          string
    locationId?:       string
    scale?:            string
    maxAttempts:       number
    fidelityThreshold: number
    keys: {
      replicateApiToken: string
      openaiApiKey:      string
      stabilityApiKey?:  string
    }
  }): Promise<AdapterResult>
}

// ─── COST MODEL (cents) ──────────────────────────────────────────
// Per-stage estimates for spend tracking. Tune as Replicate/OpenAI
// pricing moves; these only need to be right within ~20% for the
// ceiling to do its job.

export const COST_CENTS = {
  nb2_generation:     5,      // NB2 image-to-image, per call
  gpt_image_1:        8,      // refine / primary gen where used
  stability_outpaint: 4,
  face_swap:          1,
  gpt4o_mini_score:   1,      // intake, detection, fidelity each ≈ $0.001 → round to 1¢ min
  gpt4o_triage:       3,      // full-detail failure analysis
  upscale:            2,
} as const

// ─── RUN / ITEM STATUS ───────────────────────────────────────────

export type RunStatus  = 'draft' | 'running' | 'paused' | 'stopped' | 'complete'
export type ItemStatus =
  | 'pending' | 'running' | 'redirected' | 'intake_rejected'
  | 'passed' | 'failed' | 'errored' | 'skipped'

// Reclaim 'running' items whose worker died (crash mid-item).
export const STALE_RUNNING_MS = 10 * 60 * 1000   // 10 minutes
