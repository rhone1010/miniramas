// lib/v1/pets/pets-prompt.ts
//
// Prompt builder for the Pets silo. Mirrors portraits-prompt.ts
// structurally — anatomy first, material second — with the human bust
// architecture replaced by the Pets identity system (Rich's 2026-06-05
// spec). Conflicts resolved in favor of the Pets spec:
//
//   • BUST_UNIVERSAL (shoulders, mid-bicep, 60/40, garments) → replaced
//     by PET_UNIVERSAL: complete full-body animal, identity + markings +
//     coat + age + expression + pose preservation.
//   • The Portraits uniform-material directive ("do not retain source
//     hair/clothing color") conflicts with "preserve all markings
//     exactly." Resolution: markings are preserved AS TONAL VARIATION
//     WITHIN the material — patina shifts on bronze, deeper cloudy
//     veining on alabaster, mineral ribboning on quartzite, grain
//     shifts on the woods. The material stays unified; the marking
//     pattern stays readable. Ceramic and plushy keep true coat colors
//     (painted / fabric registers carry color natively).
//   • LOCATION_PHRASE → ENVIRONMENT_PHRASE: the four Rich-authored
//     environments. Each carries its own lighting, so the universal
//     "soft directional studio lighting" cue from Portraits is DROPPED —
//     one concern per block; environment owns lighting. The Advanced
//     Lighting bundle still layers on top when the user reaches for it.
//
// Negative directives: per validated NB2 principles, feature-level
// negatives from the spec ("do not add…") are converted to positive
// framing; register/behavior-level negatives are kept where they target
// behaviors ("not a generic example of its breed"), matching the proven
// "no gears, no clockwork" precedent.

import type { PetsPresetId, EnvironmentId, Scale, ActionId } from './pets-shared'
import { DEFAULT_PLAQUE_TEXT } from './pets-shared'

// ── Universal pet identity block ────────────────────────────────
//
// The Pets equivalent of BUST_UNIVERSAL. Runs FIRST in every prompt:
// lock the animal's anatomy, markings, coat, age, expression, and pose
// BEFORE the material register is applied. Content assembled from
// Rich's PET IDENTITY / EXPRESSION / COAT / AGE / POSE spec blocks
// (2026-06-05) — do not edit without him.
//
// Count-aware (2026-06-05): up to MAX_PETS hero animals render as one
// group piece. The shared identity checklist is identical; the group
// variant adds spatial arrangement, relative size, and physical-contact
// preservation, and applies every preservation rule PER ANIMAL.

// Identity core — the per-animal preservation checklist. Expression
// preservation is toggleable: an active action replaces pose AND
// expression direction, so the expression sentences must drop (one
// concern per block — the action phrase owns expression then).
export function petIdentityCore(preserveExpression: boolean): string {
  const eyeClause = preserveExpression
    ? 'eye shape, size, color, spacing, and expression'
    : 'eye shape, size, color, and spacing'
  let core =
    `head shape and skull proportions, muzzle length, width, and profile, nose shape, size, texture, and color, ${eyeClause}, ear shape, size, placement, angle, and posture, neck thickness and proportions, body proportions and silhouette, tail shape and length, paw size and proportions, and every distinctive physical characteristic. ` +
    `Preserve all markings exactly as patterned in the source — facial markings, blaze patterns, spots, patches, socks, chest markings, color transitions, and pigmentation variations. ` +
    `Preserve the coat exactly as shown in the photograph: the same fur length, the same volume, the same density and texture, the same direction of growth, and the same whiskers — the coat of this individual animal, not a breed-typical or stylized coat. ` +
    `Preserve each animal's apparent age exactly as shown — grey muzzle, white facial hairs, coat maturity, eye clarity, body condition, senior or juvenile characteristics. `
  if (preserveExpression) {
    core +=
      `Preserve the emotional expression and personality visible in the source: eye expression, ear posture, mouth position, head angle, and each animal's own alertness, curiosity, confidence, playfulness, calmness, or affection. `
  }
  core += `Preserve the small imperfections and asymmetries that make each animal recognizable.`
  return core
}

function petUniversalSingle(action: ActionId): string {
  const restaged = action !== 'as_photographed'

  const lead = restaged
    ? `Create a complete full-body animal sculpture of the specific pet in the source photograph — the entire animal from nose to tail to paws, re-staged ${ACTION_PHRASE[action as Exclude<ActionId, 'as_photographed'>]}. Invent the new posture naturally for this animal's exact anatomy, proportions, and build. `
    : `Create a complete full-body animal sculpture of the specific pet in the source photograph — the entire animal from nose to tail to paws, in the same posture, weight distribution, stance, and body language shown in the source: same head tilt, same tail position and carriage, same paw placement, same body lean, same sitting, standing, or resting posture. `

  const closing = restaged
    ? `Give the animal a natural expression suited to the action while keeping its own recognizable personality. ` +
      `Render the specific animal in the photograph, not a generic or idealized example of its breed — a recognizable rendering of this exact pet is the goal. ` +
      `Render EXACTLY ONE animal — a single subject only; never duplicate the animal and never add a second animal, twin, or companion. Lock the animal's anatomy and markings first; stage the action second; apply the material treatment last.`
    : `Render the specific animal in the photograph, not a generic or idealized example of its breed — a recognizable rendering of this exact pet, with this exact expression, is the goal. ` +
      `Render EXACTLY ONE animal — a single subject only; never duplicate the animal and never add a second animal, twin, or companion. Lock the animal's anatomy, pose, markings, and expression first; then apply the material treatment.`

  return `${lead}Preserve the animal's exact identity: ${petIdentityCore(!restaged)} ${closing}`
}

function petUniversalGroup(count: number, action: ActionId): string {
  const restaged = action !== 'as_photographed'

  const lead = restaged
    ? `Create a complete full-body sculpture of all ${count} specific pets in the source photograph as a single group piece — every animal rendered in full from nose to tail to paws, no animal omitted, simplified, or cropped, the whole group re-staged together ${ACTION_PHRASE[action as Exclude<ActionId, 'as_photographed'>]}. Arrange the animals naturally as a group within the action, keeping their relative sizes true to the source, and invent each new posture naturally for each animal's exact anatomy and build. `
    : `Create a complete full-body sculpture of all ${count} specific pets in the source photograph as a single group piece — every animal rendered in full from nose to tail to paws, no animal omitted, simplified, or cropped. ` +
      `Preserve the group exactly as photographed: the same spatial arrangement, the same relative sizes between the animals, the same physical contact or spacing between them, and each animal's own posture, weight distribution, stance, head tilt, tail carriage, paw placement, and body language. `

  const closing = restaged
    ? `Give each animal a natural expression suited to the action while keeping its own recognizable personality. Each animal must remain immediately distinguishable from the others and recognizable as the specific individual in the photograph, not a generic or idealized example of its breed. ` +
      `Lock every animal's anatomy and markings first; stage the action second; apply the material treatment last, uniformly across the whole group.`
    : `Each animal must remain immediately distinguishable from the others and recognizable as the specific individual in the photograph, not a generic or idealized example of its breed. ` +
      `Lock every animal's anatomy, the group arrangement, the markings, and the expressions first; then apply the material treatment uniformly across the whole group.`

  return `${lead}For EACH animal individually, preserve its exact identity: ${petIdentityCore(!restaged)} ${closing}`
}

// ── Material phrases — pet-adapted ──────────────────────────────
//
// Lifted from portraits-prompt.ts MATERIAL_PHRASE with the human bust
// vocabulary (hair / collar / sweater / torso) replaced by animal
// anatomy (coat / ears / muzzle / tail / paws), and the uniform-
// material directives rewritten to express markings as tonal variation
// within the material rather than dropping them.
const MATERIAL_PHRASE: Record<PetsPresetId, string> = {
  bronze:
    'cast bronze sculpture — the ENTIRE animal molded from a single solid bronze, with NO original coat colors anywhere: no black fur, no tan fur, no white fur, only patinated bronze metal itself. The animal\'s markings are expressed purely as patina variation — darker and lighter bronze tones following the exact pattern of the coat\'s facial markings, blazes, spots, patches, and socks, so the marking pattern stays clearly readable in the metal, never as painted color. Dignified fine-art cast bronze with subtle surface patina throughout, unmistakably one solid molded metal piece',
  alabaster:
    'carved translucent alabaster sculpture with warm subsurface scattering, milky stone depth, soft glowing edges, faint amber veining, polished and semi-translucent high points, and deeper cloudy opacity in thicker areas. The ENTIRE animal including coat, ears, muzzle, tail, and paws is rendered in this same translucent alabaster; the animal\'s markings are expressed as deeper cloudy veining and tonal shifts within the stone, following the exact pattern of the source coat so the markings remain readable while the whole sculpture stays alabaster',
  mixed_metals:
    'hand-forged mixed-metal sculpture combining warm patinated brass, polished steel, and rich copper — visible rivet plates, welded seams, hammered surfaces, and natural metal patina across the head, ears, muzzle, body, legs, and tail with equal craftsmanship density. The animal\'s markings are expressed through the metal choices themselves: contrasting metals follow the exact pattern of the coat\'s blazes, patches, and socks so the marking pattern reads clearly. The complete animal is rendered head to tail. No gears, no clockwork, no springs, no escapements, no horological mechanisms — this is metalcraft sculpture, not antique clockwork',
  ceramic:
    'glossy glazed porcelain figurine — smooth glass-like fired finish with luminous reflective glaze highlights, softly rounded forms, subtle glaze pooling in the recesses and faint kiln marks that show the hand of the maker. The animal\'s true coat colors, facial markings, blazes, spots, patches, socks, and color transitions are hand-painted under the clear glaze faithfully and precisely as shown in the source photograph',
  plushy:
    'handmade plush toy — a soft, plump, huggable stuffed animal with full, rounded, chunky forms and a simple cuddly toy-like character. Keep it simple and soft rather than finely detailed: gently rounded features, a stitched fabric nose, simple sewn or soft button eyes, and gentle seams — not intricate, not hyper-detailed. The fabric colors follow the animal\'s true coat colors and marking pattern (facial markings, blazes, patches, and socks as soft blocks of colored fabric) so the specific animal stays instantly recognizable, and the plush clearly captures the animal\'s own personality and expression. Unmistakably a plump, soft, sewn plush toy',
  stone:
    'polished Taj Mahal quartzite sculpture with characteristic creamy-beige base tones, warm gold and amber veining, smoky brown ribbons, and occasional charcoal-gray mineral threads — the stone pattern flows organically across the entire animal. The ENTIRE animal including coat, ears, muzzle, tail, and paws is rendered in this same quartzite; the animal\'s markings are expressed through the placement of the stone\'s natural veining and mineral tones, with darker smoky-brown and charcoal threads following the exact pattern of the coat\'s markings so the pattern remains readable. The mineral palette is cream, gold, brown, and charcoal only',
  walnut:
    'carved walnut wood sculpture — the ENTIRE animal carved from a single piece of solid walnut hardwood, with NO original coat colors anywhere: no black fur, no tan fur, no white fur, only the natural color range of walnut wood itself (warm honey-amber through chestnut to deep chocolate-walnut). Pronounced flowing wood grain runs across the whole form, and the lighter and darker grain tones follow the exact pattern of the animal\'s coat markings so the blazes, patches, and socks remain readable AS GRAIN and tonal shifts in the wood, never as painted color. Occasional figured knots, burls, and ribbon-grain in the body and haunches. Finished in soft satin lacquer with subtle specular highlights — semi-gloss, not wet-shine. Unmistakably one solid piece of carved characterful hardwood',
  legacy_edition:
    'sculpture carved from one block of flawless white statuary marble — the flagship, highest-tier piece. The ENTIRE animal including coat, ears, muzzle, tail, and paws carved in the round from cool luminous Carrara/Statuario stone, softly polished with a gentle sheen and a few honest hand-tooled passages beside the polished planes. Cool white throughout, never cream, ivory, tan, or warm; NO original coat colors as pigment — the animal\'s markings are expressed as subtle cool-grey veining following the exact pattern of the coat\'s facial markings, blazes, patches, and socks so the pattern stays readable in the stone. Master, confident composition; the absolute ceiling of realism, refined texture, and rich depth; restraint over spectacle — nothing exaggerated or flashy, no added ornament. Timeless, the specific animal instantly recognizable, it should feel impossible to improve',
}

// ── Environment phrases — Rich-authored (2026-06-05) ────────────
//
// Replaces the Portraits LOCATION_PHRASE map. Each environment owns
// its own lighting; no universal lighting cue is appended. Text is
// Rich's spec joined into prompt-flow sentences — do not edit the
// substance without him.
const ENVIRONMENT_PHRASE: Record<EnvironmentId, string> = {
  gallery:
    'on a deep, rich, saturated backdrop with subtle tonal variation, localized pool lighting illuminating the sculpture while the surrounding areas fall gently into darkness, the background elegant, uncluttered, and cinematic, the sculpture the brightest and most important element in the frame, premium fine-art photography aesthetic',
  natural:
    'resting naturally on real grass illuminated by warm directional sunlight, the surrounding vegetation softly blurred through shallow depth of field, the light creating realistic highlights across the sculpture while maintaining a natural outdoor atmosphere — the environment authentic, inviting, and alive',
  atmospheric:
    'within a softly atmospheric environment composed of layered depth, distant haze, gentle light falloff, and subtle environmental suggestion — cinematic, timeless, and emotionally resonant, the background forms indistinct and atmospheric rather than literal, the sculpture sharply rendered while the environment dissolves into soft depth and mood',
  home:
    'resting naturally on a premium textured rug within a softly lit interior, warm window light creating gentle illumination and natural shadow transitions — the environment comfortable, lived-in, and welcoming, the background elements subtle and out of focus to preserve emphasis on the sculpture',
}

// ── Action phrases — pose re-staging (2026-06-06) ───────────────
//
// Written count-neutral ("the animal(s)" is supplied by the universal
// block) so single and group prompts share the same phrases. The
// playing ball is sculpted in the same material — the piece stays one
// unified object.
const ACTION_PHRASE: Record<Exclude<ActionId, 'as_photographed'>, string> = {
  sleeping:
    'curled up asleep — eyes gently closed, body fully relaxed, settled into a natural sleeping position',
  jumping:
    'caught mid-jump — all paws off the ground, body stretched in a joyful athletic leap',
  running:
    'at a full run — mid-stride, legs extended in a natural gallop, ears and coat reacting to the motion',
  playing:
    'in a playful pose with a ball — front lowered in a play bow or a paw resting on the ball, the ball sculpted in the same material as part of the piece',
  sitting_proud:
    'in a proud upright sitting pose — chest forward, head held high, the classic dignified show stance',
  funny:
    'in a comically exaggerated playful pose natural to this animal — a dramatic head tilt, sprawled belly-up, or frozen mid-zoomies',
}

// ─── ADVANCED LIGHTING TAIL ──────────────────────────────────────
// Lifted verbatim from portraits-prompt.ts — same advanced lighting
// bundle on the frontend, same backend behaviour. Layers on top of
// the environment's own lighting only when the user opts in.
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
 * Build the prompt sent to NB2 for a Pets render.
 *
 * Scale handling (back-compat with Portraits/Groups, code values
 * inverted from UI labels — intentional, do not "fix"):
 *   - `'fill'`     (UI "Filled")      — append ", tight composition"
 *   - `'close_up'` (UI "With Margin") — no prompt directive; margins
 *      are handled by Stability outpaint post-process (pets-expand.ts).
 *      NB2 ignores prompt-based margin language.
 *
 * Plaque handling: undefined/empty → DEFAULT_PLAQUE_TEXT, string
 * verbatim, null → "clean unmarked base".
 */
export function buildPetsPrompt(input: {
  presetId:      PetsPresetId
  environmentId: EnvironmentId
  scale:         Scale
  plaqueText?:   string | null
  advanced?:     AdvancedLighting
  // Detected hero-animal count from Stage 0 (clamped 1..MAX_PETS by the
  // generator). 1 → single-subject block; 2+ → group block.
  subjectCount?: number
  // Pose re-staging — 'as_photographed' (default) preserves source pose.
  actionId?:     ActionId
  // Per-render coat descriptor built by the generator from the Stage 0
  // detect call's coat profile (pets-generator.ts buildCoatNote). The
  // photograph-specific positive description that keeps NB2 off the
  // flowing-fur genre prior. Omitted when detection is unavailable.
  coatNote?:     string
  // Per-render distinctive-features note (pets-generator.ts
  // buildFeatureNote): clouded eye, notched ear, missing limb, etc. —
  // the traits NB2's beautification prior erases unless named.
  featureNote?:  string
}): string {

  const count       = Math.max(1, input.subjectCount || 1)
  const action      = input.actionId || 'as_photographed'
  const restaged    = action !== 'as_photographed'
  const material    = MATERIAL_PHRASE[input.presetId]
  const environment = ENVIRONMENT_PHRASE[input.environmentId]
  const composition = input.scale === 'fill' ? ', tight composition' : ''
  const tail        = buildAdvancedTail(input.advanced)

  let plaqueClause: string
  if (input.plaqueText === null) {
    plaqueClause = ', with a clean unmarked base'
  } else {
    const text = (input.plaqueText && input.plaqueText.trim()) || DEFAULT_PLAQUE_TEXT
    plaqueClause = `, with a small plaque at the sculpture's base reading "${text}"`
  }

  // Anatomy first, material second — universal block leads, then the
  // material + environment sentence, then the likeness tail. The tail
  // has an action variant: pose/expression direction moves to the
  // action, identity stays exact.
  const universal = count >= 2
    ? petUniversalGroup(count, action)
    : petUniversalSingle(action)

  const lead = count >= 2
    ? `Group of ${count} pets rendered together as a single 3D ${material}`
    : `Pet rendered as 3D ${material}`

  let likenessTail: string
  if (restaged) {
    likenessTail = count >= 2
      ? `Likeness must be exact for every animal — each animal's head shape, muzzle, nose, eyes, ears, markings, coat character, and relative size must match the source photograph precisely. The poses follow the selected action, not the source photograph.`
      : `Likeness must be exact — the animal's head shape, muzzle, nose, eyes, ears, markings, and coat character must match the source photograph precisely. The pose follows the selected action, not the source photograph.`
  } else {
    likenessTail = count >= 2
      ? `Likeness must be exact for every animal — each animal's head shape, muzzle, nose, eyes, ears, markings, coat character, posture, tail carriage, and expression must match the source photograph precisely, and the group's arrangement and relative sizes must match the source. Render only what the source shows.`
      : `Likeness must be exact — the animal's head shape, muzzle, nose, eyes, ears, markings, coat character, posture, tail carriage, and expression must match the source photograph precisely. Render only what the source shows.`
  }

  const realisticSentence =
    `${lead}, ${environment}${composition}${tail}${plaqueClause}. ${likenessTail}`

  // Subject notes sit between identity and material — close enough to
  // the identity block to read as subject description, ahead of the
  // material sentence so fur length and distinctive features are settled
  // before the register is applied. Features come FIRST: they're the
  // highest-stakes identity content in the prompt.
  const featureBlock = input.featureNote ? `${input.featureNote}\n\n` : ''
  const coatBlock    = input.coatNote    ? `${input.coatNote}\n\n`    : ''

  return `${universal}\n\n${featureBlock}${coatBlock}${realisticSentence}`
}
