// lib/v1/portraits/portraits-prompt.ts
//
// Minimal prompt builder for the Portraits silo. Mirrors groups-prompt.ts.
//
// NB2 understands "portrait photo rendered as 3D bronze sculpture" natively —
// it produces a clean, recognizable single-subject bust without any of the
// 700+ lines of prompt machinery the silo used to ship with. The whole
// assembled prompt sits at 11–17 words. NB2 figures out:
//   - which person in the source is the hero subject (when multiple faces visible)
//   - bust framing (head + shoulders)
//   - plinth shape and material
//   - surrounding setting / lighting / props from the location phrase
//
// Two intentional design differences from groups-prompt:
//   1. Lead-in is "Portrait of a person rendered as 3D ..." instead of
//      "Group photo rendered as 3D ...". This biases NB2 toward a single-
//      subject bust rather than a multi-figure ensemble.
//   2. Location phrases are otherwise identical — Portraits inherits the
//      same staging vocabulary as Groups for now. As the silo's location set
//      evolves (writing desk, library shelf, display niche per the carryover
//      doc), this map is where they'll plug in.

import type { PortraitsPresetId, LocationId, Scale, Framing } from './portraits-shared'
import { DEFAULT_FRAMING } from './portraits-shared'

const MATERIAL_PHRASE: Record<PortraitsPresetId, string> = {
  bronze:
    'polished bronze sculpture in classic patinated bronze — face, hair, and clothing all rendered in the same patinated bronze, the surface dignified and tasteful, not costume-like',
  alabaster:
    'carved translucent alabaster sculpture with warm subsurface scattering, milky stone depth, soft glowing edges, faint amber veining, polished and semi-translucent high points, and deeper cloudy opacity in thicker areas',
  iron:
    'hand-forged iron sculpture in deep charcoal-black metal with a soft gunmetal sheen — visible hammer-work texture across every surface, burnished highlights on raised features (brow, cheekbones, nose bridge, hair ridges), and darker oxide patina settling into recesses and undercuts. Do not crop to head. Do not create a helmet, mask, or faceplate-only sculpture. No orange rust anywhere on the bust; the palette is charcoal, graphite, and warm gunmetal only',
  plushy:        'soft plushy figure',
  stone:
    'polished Taj Mahal quartzite sculpture with characteristic creamy-beige base tones, warm gold and amber veining, smoky brown ribbons, and occasional charcoal-gray mineral threads — the stone pattern flows organically across face, hair, clothing, shoulders, and arms. Avoid pink, peach, rose, salmon, or flesh-toned veining anywhere on the bust; the mineral palette is cream, gold, brown, and charcoal only',
  ebony:         'carved ebony wood sculpture in deep black-brown, visible wood grain with subtle natural color variation, burls and whorls placed in the base and shoulders, fine smooth grain on the face',
  walnut:
    'carved walnut wood sculpture with rich grain variation visible across the entire bust — pronounced flowing wood grain patterns, natural color shifts ranging from warm honey-amber through chestnut to deep chocolate-walnut, occasional figured-grain knots, burls, and ribbon-grain character in the shoulders and torso. Finished in soft satin lacquer that catches studio lighting in subtle specular highlights — semi-gloss only, not varnish, not high-gloss wet-shine. The grain reads as living, characterful hardwood with depth and warmth — not flat or uniformly stained',
  pewter:
    'cast pewter sculpture in soft satin-grey alloy with a gentle low-luster sheen — smooth flowing surfaces, muted highlights pooling on raised features (brow, cheekbones, nose bridge), and slightly darker tarnish settling into recesses and undercuts. A refined, understated metal with a soft pewter glow, never mirror-bright. No paint, no flesh tones; the palette is cool silver-grey throughout',
  chocolate:
    'sculpted from rich tempered chocolate in deep cocoa-brown with a smooth satin chocolate sheen — flowing glossy surfaces, soft warm highlights on raised features, and deeper bittersweet-brown tones settling into recesses, as if molded by a master chocolatier. Decorative confectioner\'s detailing is welcome and expected: fine gold-leaf gilding, dustings of cocoa powder, and delicately piped scrollwork. Keep every tone within a warm café palette — dark and milk chocolate, cocoa, caramel, mocha, and latte-cream, with warm gold-leaf accents. No stark icing-white, no pastel frosting, and no color outside the warm chocolate-and-cream range anywhere on the bust',
  // Artists Gallery — these materials use full custom prompts (see
  // ARTISTS_BLOCKS below). The standard MATERIAL_PHRASE entry is
  // a placeholder kept only to satisfy the Record<PortraitsPresetId, …>
  // type — buildPortraitsPrompt routes these to buildArtistsPrompt before
  // MATERIAL_PHRASE is ever read.
  impressionist:  '__custom_artists_prompt__',
  torn_paper:     '__custom_artists_prompt__',
  folded_book:    '__custom_artists_prompt__',
  charcoal_chalk: '__custom_artists_prompt__',
  pencil_sketch:  '__custom_artists_prompt__',
  sheet_music:    '__custom_artists_prompt__',
  stained_glass:   '__custom_artists_prompt__',
  driftwood_resin: '__custom_artists_prompt__',
}

// Location phrases lifted from groups-prompt.ts. Same staging register,
// same proven NB2 cues. Diverge here when Portraits-specific locations
// (writing desk, library shelf, display niche) come in.
const LOCATION_PHRASE: Record<LocationId, string> = {
  mantel:       'as the focal subject on an elegant marble mantel in an upscale sun-lit great room with skylights and ornate window trim, the room softly blurred behind the sculpture',
  tea_house:    'on a small Japanese-style display base inside a traditional tea house, scaled like a tabletop model, cherry blossom trees visible through shoji screen doors',
  pedestal:     'on a round marble pedestal in a museum gallery, illuminated by a volumetric beam of natural light streaming from a skylight above',
  gradient:     'against a seamless studio gradient backdrop that falls softly from light into deep shadow, gentle atmospheric haze separating the sculpture cleanly from the surround',
  plushy_shelf: "on a child's plush-toy shelf",
  wall_mount:   'mounted on a gallery wall',
}

// ─── ADVANCED LIGHTING TAIL ──────────────────────────────────────
// Lifted verbatim from groups-prompt.ts — same advanced lighting bundle on
// the frontend, same backend behaviour.
interface AdvancedLighting {
  beam?:       'off' | 'on'
  threePoint?: 'off' | 'on'
  brightness?: '0' | '5' | '10' | '15'
  enhanced?:   'off' | 'on'
}

function buildAdvancedTail(adv?: AdvancedLighting): string {
  if (!adv) return ''
  const parts: string[] = []
  if (adv.beam       === 'on') parts.push('with a volumetric beam of light from above')
  if (adv.threePoint === 'on') parts.push('three-point studio lighting')
  if (adv.brightness && adv.brightness !== '0') {
    parts.push(`brightness boosted by ${adv.brightness}%`)
  }
  if (adv.enhanced   === 'on') parts.push('enhanced contrast and microcontrast')
  if (parts.length === 0) return ''
  return `, ${parts.join(', ')}`
}

/**
 * Build the prompt sent to NB2 for a Portraits render.
 *
 * Scale handling (back-compat with Groups, code values are inverted from
 * UI labels — intentional, do not "fix"):
 *   - `'fill'`     (UI "Close Up") — append ", tight composition"
 *   - `'close_up'` (UI "Margins")  — append a wide-framing directive that
 *      asks NB2 to leave ~15% margin on each side of the bust. Per prior
 *      testing, NB2 responds well to concrete numeric framing directives
 *      ('central 70% of frame width') vs abstract ones ('breathing room').
 *      A baseline soft-lighting cue is also included here — without it,
 *      NB2's default lighting varies wildly across renders. The Advanced
 *      Lighting bundle (three-point, beam, brightness) still layers on top.
 *
 * Plaque/inscription: CUT product-wide (2026-07-08). Every piece renders a
 * clean unmarked base regardless of the (now inert) plaqueText input.
 */
// ── ARTISTS GALLERY PROMPTS ────────────────────────────────────
// These materials produce fundamentally different artworks than the
// standard sculpture register. Each gets a full custom prompt that
// bakes in its own composition, location, lighting, and DoF. They
// bypass MATERIAL_PHRASE / LOCATION_PHRASE / composition / advanced
// tail entirely. NB2 still receives the source image as identity
// conditioning.

const ARTISTS_PRESETS = [
  'impressionist', 'torn_paper', 'folded_book', 'charcoal_chalk',
  'pencil_sketch', 'sheet_music',
  'stained_glass', 'driftwood_resin',
] as const
type ArtistsPresetId = (typeof ARTISTS_PRESETS)[number]

function isArtistsPreset(p: PortraitsPresetId): p is ArtistsPresetId {
  return (ARTISTS_PRESETS as readonly string[]).includes(p)
}


// ═══════════════════════════════════════════════════════════════════════
// ARTISTS GALLERY — STRUCTURED PROMPT ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════
//
// Final prompt is composed of universal blocks (shared across all artists
// presets) + per-preset blocks (transformation language + avoid list +
// gallery tail). Subject wardrobe block (from the Curator) slots in
// between universal and per-preset.
//
// Composition order (joined with double newlines for paragraph separation):
//   1. ARTISTS_BUST_EXTENT     — universal — defines bust extent + cut-line
//   2. ARTISTS_EVEN_DISTRIBUTION — universal — 60/40 effect distribution rule
//   3. Subject wardrobe         — Curator-provided (omitted if no concept)
//   4. Transformation           — per-preset
//   5. ARTISTS_IDENTITY         — universal — facial identity preservation
//   6. Avoid list               — per-preset
//   7. Gallery tail + plaque    — per-preset (tail) + universal (plaque)
//
// History: face-dominant renders kept compressing the artistic effect onto
// the face plane, breaking likeness. Fix: explicitly demand substantial
// torso surface area AND a 60/40 effect distribution rule that forces NB2
// to allocate transformation craftsmanship across hair/shoulders/chest/
// garment/arms — not just the face.

// ── Universal bust block (shared by Realistic AND Artists builders) ──
//
// Rich's "anatomy first, material second" principle (2026-06): NB2 keeps
// choosing "cool head sculpture" instead of "complete bust" when the
// material register is established before the bust silhouette is locked.
// This block runs FIRST in every prompt — Realistic and Artists alike —
// to lock bust anatomy, posture, crop, and identity BEFORE the material
// transformation is applied. The 60% / 40% distribution rule keeps the
// artistic material from compressing onto the face plane.
const BUST_UNIVERSAL =
  `Create a substantial portrait bust, not a floating head. The sculpture must include the full head, hair, neck, both shoulders, upper chest, visible garment structure, and both upper arms ending at mid-bicep. The bust must fill the composition from head to mid-bicep. The shoulders, chest, clothing, and arms must occupy at least as much visual importance as the face — ideally hair, shoulders, chest, clothing, and arms carry 60% or more of the visual transformation, and the face carries no more than 40%. Pose has character: slight forward lean, relaxed shoulders, natural asymmetry, believable human posture. Lock the bust anatomy, posture, and crop first; then apply likeness and material treatment. Preserve facial identity, eye spacing, nose, mouth, jawline, age, and expression.`

// ── Framing composition blocks (S1.1) ───────────────────────────
// Framing is now a selectable LEAD block — the composition every
// material renders through — chosen before the material register is
// applied. Same "framing first, material second" discipline as the
// universal bust. The selected block leads both the Realistic and the
// Artists builders (skipUniversal presets opt out of all framing).
//
// VERBATIM TEXT IS RICH'S (lane rule). Signature Pose is locked
// (seam tracker S1.2, 2026-06-13) and slotted below as authored. Bust
// uses the existing BUST_UNIVERSAL. Statuesque is PENDING Rich — until
// his block lands it falls back to BUST_UNIVERSAL so the 3:4 frame still
// renders a real piece rather than a placeholder; do NOT invent its text.

// Signature Pose — LOCKED 2026-06-13 (Rich, verbatim). The new default.
const SIGNATURE_UNIVERSAL =
  `A finished portrait sculpture — settled, unhurried, in the implied prior attention of a figure just turning back to meet the viewer.\n\n` +
  `Shoulders turned slightly from camera; head returns to a three-quarter view, eyes meeting the viewer. Arms descend naturally with continuous sculptural form from shoulder through elbow, wrist, and fingers — every connective element fully resolved. Both hands resolved at plinth level — on the base or each other. Hands and arms must never disconnect, fade, dissolve, or terminate in unsupported space.\n\n` +
  `Soft directional museum light; the rotated shoulder takes quiet shadow.\n\n` +
  `Square 1:1 frame. The base is clean and unmarked.`

// Statuesque — full-figure sculpture, head to feet on the plinth.
// 3:4 aspect gives vertical room for the complete standing figure.
const STATUESQUE_UNIVERSAL =
  `Create a complete full-figure portrait sculpture from head to feet, standing on a plinth. The sculpture must include the full head, hair, neck, both shoulders, complete torso, both arms with resolved hands, hips, both legs, and feet — nothing cropped, nothing terminated mid-limb. The figure occupies the full height of the 3:4 frame from crown to plinth base. Weight shifted naturally to one leg, relaxed shoulders, natural asymmetry, believable human posture. Hands resolved naturally — at the sides, loosely clasped, or resting on a surface — never fading into undefined form. The torso, clothing, legs, and feet carry equal sculptural detail and material treatment as the face and shoulders; the full body is the composition, not an afterthought below a bust. Lock the full-figure anatomy, posture, and crop first; then apply likeness and material treatment. Preserve facial identity, eye spacing, nose, mouth, jawline, age, and expression. The plinth base is clean and unmarked.`

const FRAMING_BLOCK: Record<Framing, string> = {
  bust:       BUST_UNIVERSAL,
  signature:  SIGNATURE_UNIVERSAL,
  statuesque: STATUESQUE_UNIVERSAL,
}

// ── Multi-subject (2–3 person) path — ADDITIVE, solo untouched ───
// subjectMode: 'multi' selects a plural composition block + appends the
// per-face fidelity lock. Gated entirely on the flag — when 'solo' (default)
// nothing below is reached and the single-subject prompt is byte-for-byte
// unchanged.
//
// FIGURE FIDELITY is borrowed VERBATIM from the Groups engine
// (groups-blocks.ts · MULTI_SUBJECT_FIGURE_FIDELITY) — Rich's proven
// per-face likeness lock, not new authorship.
export type SubjectMode = 'solo' | 'multi'

const MULTI_SUBJECT_FIGURE_FIDELITY = `
FIGURE FIDELITY (PRIMARY REQUIREMENT — APPLIES TO EVERY SUBJECT):
Every face in this piece must be recognizably the specific person from the source photograph. The MOST IMPORTANT requirement is that each individual subject's likeness is preserved.

Per-subject anchor features to lock per face:
- Eye spacing, eye shape, eyelid character
- Nose bridge geometry, nostril shape, nose tip
- Mouth corners, lip thickness, philtrum
- Jawline, chin shape, cheekbone structure
- Ear position and size relative to skull
- Hairline shape, hair color, hair texture
- Apparent age, ethnic features, distinguishing marks

Each subject's individual features must be preserved AS THEMSELVES — never blend two subjects' features together, never average toward a "typical" face for the group. Every subject is fully clothed in a sculpted rendition of their source-photo clothing; never bare-chested.
`.trim()

// Signature Multi — forked from SIGNATURE_UNIVERSAL for 2–3 subjects.
// Plaque line removed (inscription cut product-wide, 2026-07-08). Composition
// pluralized to a close, intimate cluster — NOT a full-figure group tableau —
// so faces stay large in frame for likeness.
const SIGNATURE_MULTI =
  `A finished multi-subject portrait sculpture of 2–3 people — settled, unhurried, an intimate cluster in the implied prior attention of figures just turning back to meet the viewer.\n\n` +
  `The subjects are close together, shoulder-to-shoulder or slightly overlapping, sharing one continuous sculptural base. Each figure's shoulders turn slightly from camera; each head returns to a three-quarter view, eyes meeting the viewer. Every face is read clearly and frontally — no subject blocked by another's shoulder. Arms descend naturally with continuous sculptural form from shoulder through elbow, wrist, and fingers — every connective element fully resolved. Hands resolved at base level; hands and arms must never disconnect, fade, dissolve, or terminate in unsupported space.\n\n` +
  `Preserve each subject's apparent age and scale from the source — if the source shows adults and children, the sculpture shows that difference; do not render every figure at uniform adult proportions.\n\n` +
  `Soft directional museum light; rotated shoulders take quiet shadow. Framed close on the cluster so every face reads large — heads and shoulders dominate the frame, not a distant full-figure group. Square 1:1 frame. Clean unmarked base.`

// Multi framing blocks. Only Signature-Multi is authored (the tested path).
// Bust-Multi and Statuesque-Multi are PENDING Rich — until authored they fall
// back to Signature-Multi so the flag always yields a real multi composition.
const MULTI_FRAMING_BLOCK: Record<Framing, string> = {
  bust:       SIGNATURE_MULTI,
  signature:  SIGNATURE_MULTI,
  statuesque: SIGNATURE_MULTI,
}

function framingBlock(framing?: Framing, subjectMode?: SubjectMode): string {
  if (subjectMode === 'multi') return MULTI_FRAMING_BLOCK[framing ?? DEFAULT_FRAMING]
  return FRAMING_BLOCK[framing ?? DEFAULT_FRAMING]
}

// ── Craft Personality — universal creative direction ───────────
// Runs after the framing block and before the material register.
// Skipped for skipUniversal presets (e.g. pencil_sketch) whose
// locked compositions would conflict.
//
// PROMPT MAINTENANCE (Rich, 2026-06-13): Do not continually append
// new instructions. Consolidate and optimize existing guidance rather
// than accumulating rules. Preserve successful behaviors whenever
// possible. If instructions conflict, stop and request clarification
// rather than guessing. Favor controlled variation over unrestricted
// randomness while maintaining a consistent Liten visual identity.
const CRAFT_PERSONALITY =
  `Create a compelling collectible portrait sculpture that feels extraordinary, emotionally engaging, and worthy of display. The viewer's immediate reaction should be admiration for both the subject and the craftsmanship.\n\n` +
  `Reveal personality rather than pose. Capture the subject in a moment that feels authentic, characteristic, and emotionally truthful. Favor natural posture, genuine expression, subtle human behavior, and believable gesture over formal posing.\n\n` +
  `The sculpture should feel like the most recognizable and admirable version of the subject without idealization, beautification, caricature, or stylization.\n\n` +
  `Identity preservation is a primary objective. Preserve the subject's unique facial geometry, proportions, expression, and distinctive asymmetries. The face should remain the primary focal point and strongest carrier of likeness.\n\n` +
  `Use composition, camera placement, perspective, gesture, lighting, scale, and environment creatively to create beauty, presence, visual interest, and emotional connection. The camera should actively participate in the composition rather than merely document it.\n\n` +
  `Favor editorial-quality photography over catalog photography. Seek the visual impact of premium portrait, gallery, design-magazine, and fine-art photography. Avoid repetitive compositions, rigid symmetry, static presentation, or showroom-style documentation.\n\n` +
  `The sculpture should occupy meaningful visual prominence within the frame and feel physically present within the space. Close viewpoints, perspective, depth, foreground elements, and atmospheric lighting may be used when they strengthen the portrait.\n\n` +
  `Establish clear visual hierarchy. The viewer's attention should naturally arrive at the face first, with pose, materials, and environment supporting rather than competing with the portrait.\n\n` +
  `Favor bust and three-quarter figure compositions. Avoid full-body compositions unless they create a substantially stronger artistic result.\n\n` +
  `Every craft should contain at least one memorable visual decision through gesture, composition, perspective, silhouette, expression, or material interaction.`

// ── UNIVERSAL STUDIO DIRECTIVES (TIER 1) ─────────────────────────
// Rules that apply to EVERY render — realistic, artists, AND experimental.
// Emitted right after the framing + personality blocks, before any material
// language. Added 2026-06 from the first market-readiness render pass:
//   (1) the studio keeps subjects CLOTHED — the classical bare-shouldered
//       bust convention was leaking nudity into material-as-surface effects
//       (deep-sea, mercury, blown glass, geode all came back undressed);
//   (2) hands appear only with their arms — no free-floating hands;
//   (3) a calm source must read as content, not stern/sad/angry;
//   (4) dynamic staging (angle, lighting, background, head turn) around a
//       FIXED likeness — no aging, no idealizing, and no flat snapshot copy.
const STUDIO_DIRECTIVES =
  `CLOTHING — ALWAYS KEEP IT ON: The subject stays fully clothed in the same garment as the source photograph (t-shirt, sweater, hoodie, jacket, collar), rendered in the piece's material. NO REMOVING CLOTHING. Do not open, drop, thin, undress, or omit the clothing. Never depict the subject nude, shirtless, bare-chested, or with bare skin across the torso or shoulders. The classical bare-shouldered bust convention does NOT apply here — this studio keeps people dressed.

FACE — IN-MATERIAL, NEVER SKIN: The face is rendered in the piece's own material exactly like the rest of the sculpture — clearly defined and unmistakably this person, but never photorealistic skin and never flesh tones. Whatever the body is made of, the face is made of the same.

ARMS & HANDS — A BUST HAS NO HANDS: A bust composition ends at the chest and upper arms. Do NOT render hands, fingers, forearms, or arms folded or resting on the base or plinth anywhere on a bust — no hands at all. Only a full-figure (statuesque) piece resolves hands, and only with their complete arms. No detached or floating hands ever.

EXPRESSION: Give the face a touch of warmth and quiet contentment — a faint, natural ease, the hint of a settled smile. A calm or neutral source must NOT be rendered as stern, severe, angry, or sad. Lifelike and content, never grim.

STAGING — A DRAMATICALLY-LIT GALLERY ARTWORK, NOT A PHOTOCOPY: Hold the subject's identity, facial features, and age EXACTLY — same person, same age, never aged forward, never idealized. But everything AROUND that fixed likeness must be reinterpreted, never copied from the snapshot. CAMERA — REQUIRED: choose a dynamic gallery angle — a three-quarter view, a slightly low or raking viewpoint, the head naturally turned. Never a flat, straight-on, passport-style copy of the source framing. LIGHTING — REQUIRED: do NOT carry over the source photo's lighting; the snapshot's lighting is NOT the source of truth. Relight the piece from scratch as a museum sculpture under strong, directional, studio-quality gallery lighting — a clear key light, deep modeling shadows, and highlight-and-falloff that sculpt the form. BACKGROUND: real depth and atmosphere, not a flat wall.`

// ── COSTUME DIRECTIVES (TIER 1, realistic-portrait variant) ──────
// For "costume" effects (Armor, Elizabethan, Victorian): the subject is
// a REAL person dressed in costume, NOT transformed into a material.
// Swaps two rules vs STUDIO_DIRECTIVES — the face stays real skin (not
// in-material) and the clothing is replaced by the costume (not the
// source garment). Hands, expression, and dynamic staging carry over.
const COSTUME_DIRECTIVES =
  `FACE & LIKENESS — KEEP IT REAL: Render the subject's own real face, skin, and features — accurate, lifelike, and unmistakably this exact person, same age, never idealized. This is a realistic portrait of the person in costume; the face is NOT stylized into a material, NOT metallic, NOT rendered in any surface other than real skin. Hair and makeup may be adapted to suit the period or theme.

CLOTHING — IN COSTUME: Dress the subject in the costume described below, replacing their everyday clothing. Fully clothed and period-appropriate. Never nude, shirtless, or bare-chested.

ARMS & HANDS — A BUST HAS NO HANDS: A bust composition ends at the chest and upper arms. Do NOT render hands, fingers, forearms, or arms folded or resting on the base anywhere on a bust — no hands at all. Only a full-figure piece resolves hands, with their complete arms.

EXPRESSION: A touch of warmth and quiet contentment — a faint, natural ease, the hint of a settled smile. Never stern, severe, angry, or sad.

STAGING — A DRAMATICALLY-LIT GALLERY PORTRAIT, NOT A PHOTOCOPY: Reinterpret camera and lighting; do not copy the snapshot. CAMERA: a dynamic three-quarter or slightly low angle, the head naturally turned — never a flat, straight-on copy of the source framing. LIGHTING: do NOT carry over the source photo's lighting; relight from scratch as a museum portrait under strong, directional, studio-quality gallery lighting with a clear key light, modeling shadows, and falloff. BACKGROUND: real depth and atmosphere.`

// ── TIER 2 — MATERIAL-FAMILY HUE LOCK ────────────────────────────
// The middle tier between Universal (anatomy, every material) and
// Per-preset (the material's own language). Some rules apply to a
// FAMILY of materials — not all, not one. They have nowhere clean to
// live in a two-tier system, so they get stuffed into the universal
// block (too broad) or copy-pasted into individual materials (where
// they drift). The hue-uniformity rule is the first family rule.
//
// Monolithic materials — one substance, one hue family — render the
// whole bust in that single material and never import a foreign hue.
// Polychrome materials (impressionist, and the incoming stained glass /
// driftwood-resin / mixed-metals family) are EXEMPT: they are MEANT to
// be multi-hued, and a blanket universal hue rule would wreck them.
// That is precisely why this is a family tier, not a universal one.
//
// Centralizes a rule that previously drifted: alabaster, iron, and stone
// carried it inline; bronze, ebony, walnut, and folded book did not.
// Now it lives in exactly one place and is applied by family membership.
const HUE_LOCK =
  `Render the entire bust — face, hair, garment, shoulders, arms, and base — in this single material. Do not retain the source subject's original hair or clothing color; every surface takes the material's own hue. Shading, tonal depth, and texture variation within the material are encouraged. Introducing a color foreign to the material is not.`

// Monolithic-family membership. Members receive HUE_LOCK in assembly
// order, between the universal/framing tier and the per-preset tier.
// NON-members (polychrome / multi-hue) MUST be omitted here.
//   Locked:  bronze, alabaster, iron, stone, ebony, walnut,
//            folded_book, charcoal_chalk, pewter, chocolate
//   Exempt:  plushy (fabric can keep multiple felt colors),
//            impressionist (polychrome paint), torn_paper, sheet_music,
//            pencil_sketch (skipUniversal, bespoke composition),
//            stained_glass + driftwood_resin (polychrome by design)
const MONOLITHIC_PRESETS: ReadonlySet<PortraitsPresetId> = new Set<PortraitsPresetId>([
  'bronze', 'alabaster', 'iron', 'stone', 'ebony', 'walnut',
  'folded_book', 'charcoal_chalk',
  'pewter', 'chocolate',
])

// Returns the family-lock block for a preset, or '' if exempt. The empty
// string assembles cleanly via .filter(Boolean) — no stray separators.
function familyLockBlock(presetId: PortraitsPresetId): string {
  return MONOLITHIC_PRESETS.has(presetId) ? HUE_LOCK : ''
}

// ── Per-preset blocks: transformation + avoid + tail ──
interface ArtistsBlocks {
  transformation: string
  avoid:          string
  tail:           string
  // When true, the BUST_UNIVERSAL block is skipped for this preset.
  // Used for presets whose composition fundamentally conflicts with
  // the universal "front-facing bust, both arms at mid-bicep" framing
  // — e.g. Pencil Sketch, where the asymmetric 3D-emerging-from-2D
  // composition IS the artistic identity of the style.
  skipUniversal?: boolean
}

const ARTISTS_BLOCKS: Record<ArtistsPresetId, ArtistsBlocks> = {
  // Folded Book — Rich's "limited / use with upper-body reference only"
  // refinement: face must remain restrained; paper motion belongs in
  // periphery (hair, garment, shoulders, background curls), not across
  // the face plane where it destabilizes likeness.
  //
  // 2026-06 follow-up (post wild-curls failure): hair MUST follow the
  // source subject's actual hairstyle. Paper ribbons interpret hair —
  // they do not invent generic wild curls, paper spirals, or fantasy
  // hairstyles. Likeness in the hair is as important as likeness in
  // the face; if flowing-paper aesthetics conflict with the source's
  // real hair, the source wins.
  folded_book: {
    transformation:
      `Transform the entire bust — face included — into a fine-art sculpture assembled from folded and layered book pages, emerging from an open book. Every surface is paper: the face, hair, neck, shoulders, chest, garment, and arms are all built from curled paper ribbons, folded pages, and layered printed sheets. The paper layers across the face follow the person's real facial structure — overlapping pages shape the planes of the forehead, brow, nose, cheeks, and lips so the likeness stays clearly recognizable, while the surface reads unmistakably as layered paper rather than skin. Hair is formed from paper ribbons that follow the source subject's actual hairstyle exactly — same length, direction, volume, and character; the paper interprets the real hair and never invents wild curls, paper spirals, or fantasy hair shapes. Broad sweeping ribbons define the major forms; individual printed pages stay visible throughout. The construction continues uninterrupted across the whole bust. The sculpture feels assembled from pages rather than carved into pages.`,
    avoid:
      `Avoid a photo-realistic or smooth lifelike face — the face is built from layered paper like the rest of the bust, not left as skin. Avoid carved relief, engraved surfaces, stacked page-edge carving, paper-cut or woodcut techniques, and topographic page slicing. Avoid chaotic paper strips that destroy the likeness, and avoid generic wild paper curls or spirals replacing the real hairstyle — the paper must follow the person's true facial structure and real hair so they remain recognizable.`,
    tail:
      `Contemporary gallery presentation. Museum-quality craftsmanship. Extraordinary dimensionality. Flowing organic forms. Visible printed text. Elegant paper architecture. Emotionally expressive. Fine-art collectible sculpture.`,
  },

  // Impressionist — Rich's note: working. Just enforce impasto across
  // clothing and shoulders, not just face.
  impressionist: {
    transformation:
      `Transform the entire bust into an impressionist paint sculpture rendered in thick impasto strokes carrying real visible texture and dimensional thickness. The complete sculpture—including head, hair, shoulders, chest, garment fabric, and arms—is built from layered impasto paint applied with sculptural mass. Maintain strong impasto across clothing and shoulders, not just face. Each brushstroke has physical depth. Thick visible paint covers the head, hair, neck, shoulders, garment, chest, and arms equally. The paint also runs down onto a round plinth the sculpture sits on. Use tones natural to this person's complexion and clothing throughout.`,
    avoid:
      `Avoid smooth painted surfaces, flat color application, photo-realistic finishing, 2D painted treatment, or thin paint layers. The paint must carry physical mass and dimensional depth.`,
    tail:
      `Sculpture on a base in a contemporary museum, center focused. Skylights cast luminous volumetric light down and around the sculpture. Strong depth of field blurring the background. Museum-quality craftsmanship. Fine-art collectible sculpture.`,
  },

  torn_paper: {
    transformation:
      `Transform the entire bust into a sculpture constructed from thousands of torn and layered paper contours. The complete sculpture—including head, hair, shoulders, chest, garment fabric, and arms—emerges from stacked topographic layers similar to a terrain map. Every contour follows the underlying form, creating depth through elevation rather than shading. Different paper tones create highlights and shadows naturally through layering. Paper edges remain visible and handcrafted, revealing fiber texture and subtle imperfections. Hair, shoulders, garment folds, chest contours, and arm structure are all built from the same torn paper contours with equal layering density.`,
    avoid:
      `Avoid smooth painted finishes, carved relief, engraved surfaces, 2D paper-cut techniques, or paper that lays flat without elevation. The construction must read as topographic layers with depth.`,
    tail:
      `Contemporary gallery presentation. Museum-quality craftsmanship. Soft directional lighting emphasizing depth and edge detail. Fine-art paper sculpture. Architectural precision. Highly detailed, tactile, and dimensional. Professional studio photography.`,
  },

  // Charcoal & Chalk — Rich's note: working. Just enforce material density
  // extension through sweater, shoulders, arms, and base fragments.
  charcoal_chalk: {
    transformation:
      `Transform the entire bust into a fine-art sculpture constructed from compressed charcoal, broken charcoal sticks, charcoal dust, and white Conté chalk. The complete sculpture—including head, hair, shoulders, chest, garment fabric, and arms—is physically built from charcoal materials with sculptural mass; the sculpture is not drawn. Material density must extend through sweater, shoulders, arms, and base fragments — equal carving complexity across every part of the bust. All planes—face, hair, shoulders, clothing folds, chest, and arms—are carved from dense charcoal masses with visible chisel marks, fractured edges, and layered charcoal fragments. White Conté chalk forms raised highlights and structural details across the entire bust, creating dimensional contrast against deep black charcoal surfaces. Floating charcoal dust, chalk powder, and broken fragments drift in the surrounding air as if the sculpture is still emerging from the material. Hair forms from sweeping charcoal ribbons, fractured charcoal splines, and layered charcoal shards.`,
    avoid:
      `Avoid drawn charcoal portraits, 2D charcoal renderings, smooth surfaces, blended shading, or paper-as-substrate aesthetics. The charcoal must carry true sculptural depth and physical mass everywhere on the bust.`,
    tail:
      `Contemporary museum gallery lighting reveals the texture of compressed charcoal, chalk buildup, carved surfaces, and airborne particles. Fine-art contemporary sculpture. Dramatic craftsmanship. Highly dimensional, tactile, expressive.`,
  },

  // Pencil Sketch — Rich's locked composition (2026-06): side-angle
  // camera, asymmetric emergence. The head, far hand, far arm, and far
  // shoulder are fully three-dimensional graphite sculpture; the near
  // arm, shoulder, and torso remain hand-drawn pencil sketch on the
  // page. This composition is INTENTIONAL and defines the style.
  //
  // 2026-06 follow-up (kinetic refinement): closer camera + dramatic
  // foreshortening on the reaching hand/arm to give the figure a sense
  // of active forward motion. The reach now thrusts toward the viewer
  // with the hand appearing larger than the head behind it. The face
  // expression stays calm/serene from the source — only the COMPOSITION
  // gets kinetic, not the face.
  //
  // skipUniversal: true — the BUST_UNIVERSAL block describes a
  // front-facing symmetric bust. That conflicts with the asymmetric
  // emergence here. Per Rich's instruction: delete the conflicting
  // constraints for THIS piece only. The pencil_sketch transformation
  // block includes its own likeness preservation language.
  pencil_sketch: {
    skipUniversal: true,
    transformation:
      `Close-up side-angle three-quarter camera composition showing a portrait actively emerging from a vertical sheet of drawing paper. The figure fills the frame. DRAMATIC FORESHORTENING: the reaching hand and arm thrust forward toward the viewer, appearing larger in the frame than the head behind them — conveying kinetic energy and the intent of active emergence. The page is visible behind and beside the figure, its edges and corners showing. The composition is INTENTIONALLY ASYMMETRIC — split into two states:

ONE SIDE — fully three-dimensional graphite sculpture thrusting forward: the subject's head, far hand, far arm, and far shoulder are physical graphite sculpture with real sculptural mass, dimensional depth, and palpable forward motion. The reaching hand and arm are foreshortened toward the viewer, larger in the frame than they would appear in flat side-view, conveying urgency and the moment of becoming. This side has fully escaped the page with kinetic energy.

OTHER SIDE — still hand-drawn pencil sketch on the flat page: the near arm, near shoulder, and torso (including garment on that side) remain as pencil drawing — visible construction lines, expressive crosshatching, unfinished contours, eraser marks. Two-dimensional drawing only. No sculptural depth on this side.

THE TRANSITION — graphite peeling from the page: between the drawn side and the sculpted side, pencil lines lift off the paper and become physical graphite ribbons. Broken pencil fragments, eraser dust, and stray sketch marks suspend in the air. Graphite dust drifts. The exact moment imagination becomes reality.

The face must preserve identity with high accuracy — eye spacing, nose, mouth, jawline, age, and expression all read as the source subject. The expression stays calm and as-source; the kinetic energy lives in the composition and the foreshortened reach, NOT in the face. Hair follows the source's actual hairstyle. The asymmetric pose (one side dimensional, one side flat) defines this style; both arms, both shoulders, and the torso are present in the composition but in different material states.

Museum-quality gallery lighting catches the dimensional side and casts subtle shadows from sketched details on the flat side.`,
    avoid:
      `Avoid fully-formed photorealistic surfaces with no sketch element visible. Avoid pure 2D pencil drawings on flat paper with no dimensional emergence. Avoid symmetric front-facing busts where both arms are equally three-dimensional. Avoid distant framing where the foreshortening reads as flat — the reaching hand must appear noticeably larger than the head. The asymmetric emergence — one side sculpture, one side drawing on the visible page — is REQUIRED for this style. The page must be visible behind the figure with its edges showing.`,
    tail:
      `Museum-quality lighting. Extraordinary dimensionality. Fine-art installation. Impossible transformation. Emotional impact. Highly detailed graphite textures. Visible construction process. Masterpiece-level craftsmanship.`,
  },

  sheet_music: {
    transformation:
      `Transform the entire bust into a museum-quality sculpture constructed from sheet music, musical notation, manuscript pages, and flowing musical scores. The complete sculpture—including head, hair, shoulders, chest, garment fabric, and arms—emerges from thousands of folded, curled, layered, and suspended pages. No conventional human surfaces remain anywhere on the form. Musical staffs sweep across the face, neck, shoulders, chest, garment, and arms like topographic contours. Notes, rests, clefs, and dynamic markings become structural elements that define the nose, lips, cheeks, hair, collar, shoulder line, and arm contours. Hair is formed from cascading ribbons of sheet music twisting through space like melodies frozen in motion. Portions of the sculpture appear to unravel into floating pages and drifting notes, creating a sense of music escaping the form.`,
    avoid:
      `Avoid flat printed surfaces, 2D sheet music collage, or pages without dimensional architecture. The construction must read as sculptural music with physical mass.`,
    tail:
      `Museum gallery lighting reveals paper texture, page edges, layered depth, and extraordinary craftsmanship. Fine-art paper sculpture. Highly dimensional, emotional, elegant.`,
  },

  // Stained Glass — polychrome (hue-lock EXEMPT). Leaded cathedral glass in
  // jewel tones with TRUE backlit translucency. The dark leading/came lines
  // and the glow-from-within are the two non-negotiables that separate this
  // from a flat mosaic. Couples read as figures in adjacent leaded panels.
  stained_glass: {
    transformation:
      `Transform the entire bust into a luminous stained-glass sculpture — a dimensional portrait assembled from leaded cathedral glass. The complete form (head, hair, shoulders, chest, garment, and arms) is built from individual cut-glass cells in rich jewel tones — sapphire, ruby, amber, emerald, cobalt, and gold — each piece separated by dark leading (came lines) that trace the contours of the face, hair, and garment like a master glazier's drawing. The glass is genuinely translucent: light passes through from behind and within, so the piece glows from the inside rather than reading as a flat colored surface. Deeper, more saturated glass sits in the shadows; paler, brighter glass catches the backlight at the high points. The leading defines the structure and the likeness; the glowing glass carries the color and life. For couples or two subjects, render them as two figures in adjacent leaded panels.`,
    avoid:
      `Avoid a flat opaque mosaic, painted-on color, or a 2D stained-glass window with no dimensional form. Avoid glass without visible leading/came lines between the cells. Avoid a uniformly lit surface with no backlit glow — the inner luminosity and the dark leading are both required. Avoid muddy or desaturated glass; the cathedral-glass jewel tones must read as vivid and lit.`,
    tail:
      `Backlit gallery presentation with light streaming through the glass. Museum-quality leaded-glass craftsmanship. Jewel-tone luminosity. Dark came lines. Extraordinary translucent dimensionality. Fine-art stained-glass sculpture.`,
  },

  // Driftwood + Resin — polychrome (hue-lock EXEMPT). Live-edge resin-river:
  // weathered driftwood carries the likeness, translucent epoxy carries the
  // color. High-gloss finish baked in. Multi-material by design.
  driftwood_resin: {
    transformation:
      `Transform the entire bust into a contemporary sculpture combining weathered driftwood and glossy colored epoxy resin — the live-edge resin-river aesthetic. The driftwood preserves the form and the likeness: the face and the structural planes of the head, shoulders, and major contours are carved from pale, silvery, weathered driftwood with visible grain, knots, cracks, and organic live edges, keeping the subject clearly recognizable. Flowing rivers and pools of translucent colored epoxy resin run through and between the wood — deep teal, ocean blue, amber, or emerald — filling the live-edge gaps, the cracks, and the negative spaces, catching and refracting light. The resin is where the color and translucency live; the wood is where the likeness lives. The whole piece is finished in a high-gloss polish so the resin reads as liquid-clear and the wood as satin-smooth.`,
    avoid:
      `Avoid an all-wood sculpture with no resin, or an all-resin sculpture with no wood — both materials must be present and distinct. Avoid a matte or unfinished surface; the glossy high-polish finish is required. Avoid resin that looks opaque or painted — it must read as translucent, light-catching epoxy. Avoid driftwood so abstract the face stops being recognizable; the wood carries the likeness.`,
    tail:
      `Contemporary gallery presentation. High-gloss finish catching the light. Translucent resin rivers. Weathered live-edge driftwood. Museum-quality craftsmanship. Highly tactile and dimensional. Fine-art mixed-media sculpture.`,
  },
}

function buildArtistsPrompt(input: {
  presetId:          ArtistsPresetId
  framing?:          Framing
  locationId?:       LocationId
  plaqueText?:       string | null
  upperBodyConcept?: string | null
  subjectMode?:      SubjectMode
  subjectCount?:     number
}): string {
  const blocks = ARTISTS_BLOCKS[input.presetId]
  const parts: string[] = []
  const isMulti = input.subjectMode === 'multi'

  // 1. Framing composition block — anatomy + pose + identity, chosen by
  //    framing (Bust / Signature / Statuesque). Runs FIRST: lock the
  //    composition before the material register is applied.
  //    EXCEPTION: presets that opt out via skipUniversal handle their own
  //    composition entirely within the transformation block (e.g. Pencil
  //    Sketch's side-angle asymmetric emergence) — they take no framing.
  if (!blocks.skipUniversal) {
    parts.push(framingBlock(input.framing, input.subjectMode))
    parts.push(CRAFT_PERSONALITY)
  }

  // Universal studio directives — clothing/hands/expression/dynamic staging.
  // Pushed for ALL artists presets, including skipUniversal ones: the
  // clothing lock and content-expression rules must never be skipped.
  parts.push(STUDIO_DIRECTIVES)

  // Multi path — per-face likeness lock (borrowed from Groups). Solo: skipped.
  if (isMulti) parts.push(MULTI_SUBJECT_FIGURE_FIDELITY)

  // 2. Subject wardrobe (Curator-provided — omitted entirely when no concept).
  //    Legacy flow input; the new Curator workflow no longer populates this.
  if (input.upperBodyConcept && input.upperBodyConcept.trim()) {
    parts.push(`Subject wardrobe: ${input.upperBodyConcept.trim()}`)
  }

  // 2b. TIER 2 — material-family lock. Monolithic artists materials
  //     (folded_book, charcoal_chalk) take the hue lock; polychrome
  //     artists (impressionist, torn_paper, sheet_music) and the
  //     skipUniversal pencil_sketch are exempt and receive '' (not pushed).
  const familyLock = familyLockBlock(input.presetId)
  if (familyLock) parts.push(familyLock)

  // 3. Material transformation (per-preset) — runs AFTER bust anatomy.
  parts.push(blocks.transformation)

  // 4. Avoid list (per-preset).
  parts.push(blocks.avoid)

  // 5. Location override — artists tails bake in a default gallery/museum
  //    setting; when the user picks a different location, prepend it so
  //    NB2 gets a concrete placement cue before the generic tail.
  if (input.locationId && input.locationId !== 'pedestal') {
    const locPhrase = LOCATION_PHRASE[input.locationId]
    if (locPhrase) parts.push(`Presented ${locPhrase}.`)
  }

  // 6. Gallery tail (per-preset). Plaque/inscription cut product-wide
  //    (2026-07-08) — no base plaque on any piece.
  parts.push(blocks.tail)

  return parts.join('\n\n')
}


export function buildPortraitsPrompt(input: {
  presetId:          PortraitsPresetId
  locationId:        LocationId
  scale:             Scale
  framing?:          Framing
  plaqueText?:       string | null
  advanced?:         AdvancedLighting
  upperBodyConcept?: string | null
  subjectMode?:      SubjectMode   // ADDITIVE — 'multi' renders 2–3 subjects; default 'solo'
  subjectCount?:     number        // 2 or 3 (informational, pluralizes the lead sentence)
}): string {

  const isMulti = input.subjectMode === 'multi'

  // Route Artists Gallery presets to their custom prompt builder.
  // location/scale/advanced are intentionally ignored — the artist
  // prompt is fully self-contained — but framing still leads.
  if (isArtistsPreset(input.presetId)) {
    return buildArtistsPrompt({
      presetId:         input.presetId,
      framing:          input.framing,
      locationId:       input.locationId,
      plaqueText:       input.plaqueText,
      upperBodyConcept: input.upperBodyConcept,
      subjectMode:      input.subjectMode,
      subjectCount:     input.subjectCount,
    })
  }

  const material    = MATERIAL_PHRASE[input.presetId]
  const location    = LOCATION_PHRASE[input.locationId]
  const composition = input.scale === 'fill' ? ', tight composition' : ''
  const lighting    = ', lit by soft directional studio lighting that brings out facial detail'
  const tail        = buildAdvancedTail(input.advanced)

  // Upper-body concept — woven inline before the lighting cue when set.
  let bodyClause = ''
  if (input.upperBodyConcept && input.upperBodyConcept.trim()) {
    bodyClause = `, with the subject's upper body rendered as: ${input.upperBodyConcept.trim()}`
  }

  // Margins are handled by the local canvas-pad post-process (see
  // portraits-expand.ts), not by prompt language. NB2 ignored the
  // prompt directive across multiple wording attempts — its prior to
  // fill the frame is too strong. The expand step adds real canvas
  // padding around the rendered bust.

  // Base is always clean & unmarked — inscription/plaque cut product-wide
  // (2026-07-08). Solo and multi both render an unmarked base; the old
  // plaqueText branch is gone. plaqueText remains as inert plumbing (never
  // affects output) so the route request shape is unchanged.
  const plaqueClause = ', with a clean unmarked base'

  // Realistic prompt leads with the selected framing composition block,
  // then the material register — framing first, material second (same
  // discipline that fixed head-only bronze/alabaster renders).
  const familyLock = familyLockBlock(input.presetId)   // TIER 2 — monolithic only

  const subjectPhrase = isMulti
    ? `${input.subjectCount && input.subjectCount >= 2 ? input.subjectCount : 2} people`
    : 'a person'
  const realisticSentence =
    `Portrait of ${subjectPhrase} rendered as 3D ${material}, ${location}${composition}${bodyClause}${lighting}${tail}${plaqueClause}.`

  // Assembly order: TIER 1 universal (framing + personality + studio
  // directives) → TIER 2 family lock (monolithic only; '' when exempt) →
  // TIER 3 per-preset material. Identity, clothing, expression, and dynamic
  // staging now live in STUDIO_DIRECTIVES — the old "match the photo exactly,
  // same head angle and gaze" line was removed because it forced flat,
  // frontal replication and fought the dynamic-staging directive.
  return [
    framingBlock(input.framing, input.subjectMode),
    CRAFT_PERSONALITY,
    STUDIO_DIRECTIVES,
    isMulti ? MULTI_SUBJECT_FIGURE_FIDELITY : '',
    familyLock,
    realisticSentence,
  ]
    .filter(Boolean)
    .join('\n\n')
}

// Re-exported for the experimental-effects addon (portraits-experimental.ts),
// which reuses these tier primitives rather than duplicating them.
export { framingBlock, CRAFT_PERSONALITY, HUE_LOCK, STUDIO_DIRECTIVES, COSTUME_DIRECTIVES }
