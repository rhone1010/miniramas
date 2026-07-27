// lib/v1/pets/pets-experimental.ts
//
// Pets Curiosities layer. Twenty "out there" effects surfaced as buttons
// in the Curator section — a lightweight, additive path that deliberately
// does NOT route through PetsPresetId. Mirrors the STRUCTURE of
// portraits-experimental.ts, not its effect set: the Portraits list is
// bust/costume thinking; Pets has its own register (memorial/keepsake,
// animal-art traditions like glass menagerie, topiary, garden statuary)
// the Portraits set never reaches.
//
// Why separate (same rationale as Portraits): making these first-class
// presets would force an entry in every exhaustive Record<PetsPresetId,…>
// (MATERIAL_PHRASE, PRESET_TIER, PRESET_LABELS, STYLE_MATERIALS) plus a
// preview render each — a lot of surface for effects still under test.
// They live here behind their own PetExperimentalEffectId union and reuse
// the same identity primitive (petIdentityCore) so a render still leads
// with the animal's exact likeness before the transformation is applied.
//
// FOUR RENDER MODES — the Pets set spans further than Portraits' two.
// Each mode changes ONLY the framing sentence around the shared identity
// core; the identity checklist (petIdentityCore) is preserved in ALL modes:
//   'sculpture_material' — 3D sculpture; the animal BECOMES a substance.
//                          Markings expressed as tonal variation. Monolithic
//                          single-substance effects receive PET_HUE_LOCK.
//   'real_animal'        — 3D; the animal keeps its REAL coat, fur, and
//                          markings, with elements added (regalia, horn,
//                          wings). No material transform, no hue-lock.
//   '2d_art'             — 2D artwork (painting / print) OF the animal in an
//                          art-movement style. Not a sculpture. Likeness held.
//   '2d_photo'           — 2D photograph of the animal in a photographic era
//                          / treatment. Not a sculpture. Likeness held.
//
// NO PLAQUE. Per Rich (2026-07): the plaque is retired. Curiosities emits
// no plaque clause in any mode. (Core Pets prompt/shared/generator plaque
// wiring is a separate product-wide decision — see the flag in chat.)
//
// CONTRACT FOR THE UI (Curator buttons):
//   petExperimentalButtons() → [{ id, label }]  (ordered; one button each)
//   On tap, POST { experimental_effect: <id>, count? } to the pets generate
//   route. The route detects experimental_effect and calls
//   buildPetExperimentalPrompt instead of buildPetsPrompt; no preset_id /
//   material / environment / action is sent for an experimental render —
//   each effect carries its own setting and staging in its body.
//
// SHIPS DARK: keep behind the same Phase 2 dev flag as the Portraits
// experimental section (July 2 UI spec 4g — removed from customer view).

import { petIdentityCore } from './pets-prompt'

export type PetExperimentalEffectId =
  // sculpture_material
  | 'amber_inclusion'
  | 'garden_statue'
  | 'blown_glass'
  | 'enchanted_crystal'
  | 'topiary'
  // real_animal
  | 'regal'
  | 'elizabethan_ruff'
  | 'sailor'
  // 2d_art
  | 'ukiyo_e'
  | 'art_nouveau'
  | 'cubism'
  // 2d_photo
  | 'daguerreotype'
  | 'film_noir'

type PetExperimentalMode =
  | 'sculpture_material'
  | 'real_animal'
  | '2d_art'
  | '2d_photo'

interface PetExperimentalEffect {
  id:         PetExperimentalEffectId
  label:      string
  mode:       PetExperimentalMode
  monolithic: boolean   // sculpture_material single-substance → gets PET_HUE_LOCK
  body:       string    // transformation + presentation + setting (NB2-facing)
  avoid:      string    // negative constraints
}

// ── PET HUE LOCK ────────────────────────────────────────────────
// Monolithic single-substance effects (amber, crystal) read as one
// material's tonal family. Markings survive AS TONAL VARIATION within
// that family — the same resolution the core Pets materials use, so a
// monolithic experimental render stays consistent with the pipeline.
const PET_HUE_LOCK =
  `The ENTIRE animal — coat, ears, muzzle, body, legs, tail, and paws — is rendered in this one single material and its natural color family, with no other material and no photorealistic fur anywhere. The animal's markings survive as TONAL VARIATION within that single material: lighter and darker regions of the same substance follow the exact pattern of the source coat's facial markings, blazes, spots, patches, and socks, so the marking pattern stays clearly readable while the whole piece remains one coherent material.`

// ── EFFECTS ─────────────────────────────────────────────────────
// Ordered — the UI renders one Curator button per entry in this order.
export const PET_EXPERIMENTAL_EFFECTS: PetExperimentalEffect[] = [

  // ---- sculpture_material ------------------------------------------------
  {
    id: 'amber_inclusion',
    label: 'Amber Inclusion',
    mode: 'sculpture_material',
    monolithic: true,
    body:
      `Render the animal as a sculpture of golden translucent amber, glowing warm honey-gold as if lit from behind, the whole creature preserved in time like life caught in ancient fossil resin. Suspended within the amber are tiny natural inclusions — small bubbles, a fern frond, a leaf, flecks of ancient debris — caught mid-float around the form. The surface is smooth and polished, and the depth of the amber gives the piece a deep inner glow. Staged on a dark museum surface under a single warm gallery light so the resin blazes from within.`,
    avoid:
      `Avoid an opaque or dark surface — the translucent honey glow is essential. Avoid any color outside the amber range (gold, honey, warm brown). Avoid so many inclusions that the animal's face or markings are obscured. Avoid photorealistic fur; the whole animal is amber.`,
  },
  {
    id: 'garden_statue',
    label: 'Garden Statue',
    mode: 'sculpture_material',
    monolithic: false,
    body:
      `Render the animal as a weathered bronze garden statue long reclaimed by nature — a beloved memorial standing quietly in an old garden. The metal is deep verdigris, green-blue patina over warm bronze, and across it grows a living layer of soft moss, pale lichen, and a few small ferns sprouting from crevices at the shoulders, back, and base. Some bronze still gleams where rain has worn it smooth; elsewhere nature has gently taken hold. Dappled daylight through leaves, a soft green garden blurred behind. A romantic image of time passing, memory, and beauty in gentle decay.`,
    avoid:
      `Avoid a clean, polished, growth-free statue — the moss and lichen are essential to the reclaimed feeling. Avoid burying the animal's face or markings in foliage; the bronze likeness stays clear. Avoid bright artificial greens; keep the moss and patina natural and muted. Avoid an indoor gallery plinth — this belongs in a garden. Avoid any plaque, sign, engraved base text, lettering, or inscription of any kind — no words anywhere in the image.`,
  },
  {
    id: 'blown_glass',
    label: 'Blown Art Glass',
    mode: 'sculpture_material',
    monolithic: false,
    body:
      `Render the animal as a single breathtaking piece of hand-blown art glass in the Murano and Chihuly master tradition — a museum-grade studio-glass animal, never a cheap molded trinket. The form is seamless, deeply translucent, and alive with motion: bold ribbons and veils of molten color — amber, cobalt, crimson, gold, teal — swirl and twist through the glass in dramatic organic currents, with internal bubbles, lenses, and optical depth bending the light. The entire animal is this swirled translucent glass, its markings carried by where the colored ribbons pool and flow, and it glows from within. Shot from a dynamic three-quarter angle under raking gallery light so the color and translucency blaze.`,
    avoid:
      `Avoid faceted or leaded stained-glass cells — this is seamless blown glass, not a window. Avoid photorealistic fur; the whole animal is swirled glass. Avoid a flat, static, mold-made look; this is dynamic, virtuoso studio glass. Avoid an opaque or painted surface; the glass is translucent and light-filled.`,
  },
  {
    id: 'enchanted_crystal',
    label: 'Enchanted Crystal',
    mode: 'sculpture_material',
    monolithic: true,
    body:
      `Render the animal as a sculpture of luminous enchanted crystal — a magical gemstone material carved into the creature's exact likeness. The coat, ears, and body are faceted, translucent crystal that glows softly from within, shifting through amethyst, aquamarine, rose, and gold as light passes through. Deeper, richer color pools in the mass of the body and haunches; the thin edges and facets at the ears, muzzle, and paws catch and refract light into tiny rainbows. A faint magical aura and a few floating crystal shards drift around the piece. Enchanted, luminous, and jewel-like.`,
    avoid:
      `Avoid photorealistic fur — the whole animal is faceted glowing crystal. Avoid an opaque or dull surface; the crystal is translucent and lit from within. Avoid a single flat color; the enchanted crystal shifts hue and refracts light. Avoid a cheap plastic look — this reads as precious magical gemstone.`,
  },
  {
    id: 'topiary',
    label: 'Topiary',
    mode: 'sculpture_material',
    monolithic: false,
    body:
      `Render the animal as a living topiary — a hedge sculpture of the exact creature, clipped and grown from dense green boxwood foliage in the grand garden tradition. The whole form is small, tightly-packed leaves and fine twigs, meticulously shaped to the animal's precise anatomy, posture, and proportions, with the denser and sparser leaf regions and subtle darker-and-lighter greens placed to echo the pattern of the coat's markings so the pet stays recognizable in the greenery. A few tiny new shoots and leaves catch the light at the edges. Standing on a trimmed lawn in a formal garden, soft daylight, a hedge or garden wall blurred behind.`,
    avoid:
      `Avoid a stone or bronze statue with ivy on it — the ENTIRE animal is grown from clipped living foliage. Avoid a rough, shapeless bush; the topiary is precisely and recognizably this animal. Avoid photorealistic fur or any non-plant material. Avoid flowers or bright colors; this is green garden foliage.`,
  },

  // ---- real_animal -------------------------------------------------------
  {
    id: 'regal',
    label: 'Regal',
    mode: '2d_art',
    monolithic: false,
    body:
      `Render a High Renaissance portrait PAINTING of the pet in the manner of Raphael — a true oil painting with visible brushwork and soft painterly modeling, NOT a photograph and NOT photorealistic. The pet's exact likeness, markings, and character stay clearly recognizable but PAINTED, never a photo of the animal: soft sfumato transitions, luminous idealized warmth, a serene dignified bearing, and rich Renaissance finery — a jewel-toned velvet mantle, a hint of gold, perhaps a slim circlet. Set against a calm Umbrian landscape or quiet architectural interior with the balanced, harmonious composition and gentle idealized light Raphael is known for. Unmistakably a Renaissance oil painting of this pet as a noble sitter.`,
    avoid:
      `Avoid any photographic or photorealistic rendering — this is a PAINTING with visible brushwork, never a photo of the animal composited into a painting. Avoid a modern, flat, or cartoon style; use soft Raphael-like painterly modeling and a restrained classical palette. Avoid the stiff, flat, decorative Tudor-panel look — this is soft, luminous High-Renaissance painting, distinct from the Elizabethan piece. Avoid losing the animal's markings and likeness.`,
  },
  {
    id: 'elizabethan_ruff',
    label: 'Elizabethan Ruff',
    mode: '2d_art',
    monolithic: false,
    body:
      `Render a Tudor-era Elizabethan court portrait PAINTING of the pet — a true panel painting, visibly painted in the flat, formal, decorative style of 16th-century English court painters, NOT a photograph and NOT photorealistic. The pet's exact likeness and markings stay clearly recognizable but PAINTED in that period manner: flatter modeling, crisp linear detail, and a stiff iconic dignity, never a photo of the animal. A large, elaborately pleated white starched lace ruff encircles the neck; below it a dark embroidered doublet stiff with pearls, gold thread, and fine blackwork. The background is dark and flat with heraldic restraint. Unmistakably an Elizabethan panel painting of this pet, jewel-encrusted and formal.`,
    avoid:
      `Avoid any photographic or photorealistic rendering — this is a PAINTING, never a photo of the animal composited onto a painted body. Avoid soft modern depth-of-field or dramatic lighting; keep the flat, formal, linear Tudor-panel style. Avoid the soft luminous sfumato of High-Renaissance painting — this is stiffer, flatter, and more decorative, distinct from the Regal piece. Avoid a small or flat collar — the ruff is large, deep, and elaborately pleated. Avoid losing the animal's markings and likeness.`,
  },
  {
    id: 'sailor',
    label: 'Sailor',
    mode: '2d_art',
    monolithic: false,
    body:
      `Render a 1940s American Navy recruitment poster of the pet — the pet's exact likeness and markings kept clearly recognizable, rendered as a bold mid-century illustration (not a photograph, not a sculpture): confident brushy gouache-style painting, strong flat areas of color, dramatic patriotic lighting, and the heroic, upward-looking composition of WWII-era poster art. The pet wears a crisp white sailor's uniform with a navy middy collar and a round white sailor cap, set against a stylized sky, ship silhouette, or bold graphic banner shapes in red, white, and navy. Spirited, nostalgic, and graphic — the pet as a wartime navy mascot.`,
    avoid:
      `Avoid a photograph or 3D sculpture — this is a 2D illustrated poster. Avoid muddy photorealism or fine rendered detail; use bold illustrated brushwork and flat poster color. Avoid losing the animal's markings and likeness. Avoid a muted or modern look; the palette is bold patriotic red, white, and navy.`,
  },

  // ---- 2d_art ------------------------------------------------------------
  {
    id: 'ukiyo_e',
    label: 'Ukiyo-e',
    mode: '2d_art',
    monolithic: false,
    body:
      `Render a traditional Japanese ukiyo-e woodblock print of the animal in the Edo-period style of Hokusai and Hiroshige — the pet's exact likeness, posture, and markings kept clearly recognizable, rendered with clean confident black outlines, flat areas of muted natural pigment, subtle woodgrain texture, and the gentle tonal gradations (bokashi) of hand-printed ink. Compose it as a classic print: the animal set against a simple stylized landscape with rolling waves, a distant mountain, or blossoming branches, with a small decorative border and the soft aged paper tone of an antique print.`,
    avoid:
      `Avoid a photorealistic or 3D-sculpted render — this is a flat 2D woodblock print. Avoid heavy realistic shading or Western perspective; use flat color areas and stylized composition. Avoid losing the animal's recognizable shape and markings. Avoid modern or garish colors; keep the muted traditional pigment palette.`,
  },
  {
    id: 'art_nouveau',
    label: 'Art Nouveau',
    mode: '2d_art',
    monolithic: false,
    body:
      `Render an elegant Art Nouveau poster of the animal in the Alphonse Mucha tradition — the pet's exact likeness, posture, and markings kept clearly recognizable, framed within a decorative arch of flowing organic lines, sinuous whiplash curves, stylized flowers, vines, and a soft halo or mosaic disc behind the head. Muted jewel tones — sage, rose, gold, cream — with fine ornamental linework and a refined, decorative flatness. Composed as a beautiful turn-of-the-century commissioned art print of this animal, graceful and ornamental.`,
    avoid:
      `Avoid a photorealistic or 3D-sculpted render — this is a flat 2D decorative print. Avoid harsh modern color; use soft muted jewel tones. Avoid losing the animal's recognizable shape and markings under the ornament. Avoid a plain background; the decorative Art Nouveau framing is essential.`,
  },
  {
    id: 'cubism',
    label: 'Cubism',
    mode: '2d_art',
    monolithic: false,
    body:
      `Render an analytical Cubist painting of the animal in the Picasso and Braque tradition — the pet fractured into interlocking geometric planes and facets, viewed from several angles at once, yet with its exact likeness, distinctive features, and markings still readable across the fragmented forms. Muted ochres, greys, greens, and warm browns with visible brushwork and angular shifting planes. The animal's key traits — the eyes, ears, muzzle, coat pattern — anchor the composition so it stays unmistakably this pet reassembled as a modern art painting.`,
    avoid:
      `Avoid a photorealistic or 3D-sculpted render — this is a flat 2D Cubist painting. Avoid fragmenting so heavily that the animal becomes unrecognizable; the key features and markings must still read. Avoid bright cartoonish color; keep the muted analytical-cubist palette. Avoid smooth realistic modeling; use angular faceted planes.`,
  },

  // ---- 2d_photo ----------------------------------------------------------
  {
    id: 'daguerreotype',
    label: 'Daguerreotype',
    mode: '2d_photo',
    monolithic: false,
    body:
      `Render a striking antique 1840s daguerreotype of the animal — the pet's exact likeness and markings kept clearly recognizable, captured on a mirror-like silver plate with the format's haunting, luminous quality. Compose it dynamically: a dramatic three-quarter turn of the head, strong directional period light modeling the face, and the plate's characteristic iridescent sheen shifting from silver to warm gold to cool blue across the surface as it catches the light. Delicate hand-tinting warms the cheeks and eyes; fine detail falls into atmospheric haze toward the edges. Add the authentic character of the process — subtle tarnish, tiny scratches, a soft vignette, and the ornate embossed case border. Arresting, characterful, and precious — a haunting early-photographic treasure of this animal.`,
    avoid:
      `Avoid a modern, sharp, full-color photo — this is a monochrome antique daguerreotype with an iridescent silver-plate sheen. Avoid a flat, static, straight-on snapshot; the composition is dynamic and the light dramatic. Avoid a 3D-sculpted or painted look; this is a photographic plate. Avoid losing the animal's features in the haze. Avoid clean digital perfection; the period tarnish, sheen, vignette, and embossed case border are essential.`,
  },
  {
    id: 'film_noir',
    label: 'Film Noir',
    mode: '2d_photo',
    monolithic: false,
    body:
      `Render a knockout 1940s film-noir movie still of the animal — the pet's exact likeness and markings kept clearly recognizable as the brooding star of a mid-century detective film. Build a full cinematic scene: the animal in a shadowy office or beside a rain-streaked window at night, a single hard key light and the graphic slatted shadow of venetian blinds slicing across the frame, curling cigarette smoke drifting through the beam, wet reflective surfaces catching glints, and a fedora, telephone, or desk lamp hinting at the story. Dramatic low camera angle, rich inky blacks, blown-out highlights, deep atmospheric haze, and fine cinematic film grain. Composed like an iconic movie poster — mysterious, dangerous, glamorous, and unmistakably collectible.`,
    avoid:
      `Avoid color or flat even lighting — this is high-contrast black-and-white with dramatic shadow. Avoid a plain empty backdrop or a simple head-shot; this is a full cinematic scene with atmosphere and story. Avoid a 3D-sculpted or painted look; this is a photographic film still. Avoid losing the animal's features in the shadow. Avoid a bright, cheerful mood.`,
  },
]

// ── LOOKUPS + UI CONTRACT ───────────────────────────────────────

const BY_ID: Record<PetExperimentalEffectId, PetExperimentalEffect> =
  PET_EXPERIMENTAL_EFFECTS.reduce((m, e) => {
    m[e.id] = e
    return m
  }, {} as Record<PetExperimentalEffectId, PetExperimentalEffect>)

export function isPetExperimentalEffect(id: string): id is PetExperimentalEffectId {
  return Object.prototype.hasOwnProperty.call(BY_ID, id)
}

// What the Curator UI renders its buttons from.
export function petExperimentalButtons(): { id: PetExperimentalEffectId; label: string }[] {
  return PET_EXPERIMENTAL_EFFECTS.map(e => ({ id: e.id, label: e.label }))
}

// ── IDENTITY LEAD (mode-aware) ──────────────────────────────────
// Reuses Rich's verbatim identity checklist (petIdentityCore) but supplies
// a mode-appropriate framing sentence and closing — so the "material
// treatment last" language of the core builders (wrong for costume / 2D
// modes) is not inherited. Expression is always preserved in Curiosities
// v1 (no action re-staging path).

function identityLead(mode: PetExperimentalMode, count: number): string {
  const many = count >= 2
  const subject = many
    ? `all ${count} specific pets in the source photograph`
    : `the specific pet in the source photograph`

  let opener: string
  let closer: string

  switch (mode) {
    case 'sculpture_material':
      opener = many
        ? `Create a complete full-body sculpture of ${subject} as a single group piece — every animal rendered in full from nose to tail to paws, no animal omitted, simplified, or cropped, in the same arrangement, relative sizes, and posture shown in the source. `
        : `Create a complete full-body sculpture of ${subject} — the entire animal from nose to tail to paws, in the same posture, stance, and body language shown in the source. `
      closer = many
        ? `Lock every animal's anatomy, arrangement, and markings first; apply the transformation last, uniformly across the whole group.`
        : `Lock the animal's anatomy, pose, and markings first; then apply the transformation.`
      break
    case 'real_animal':
      opener = many
        ? `Depict ${subject} together as a single group — every animal rendered in full from nose to tail to paws, no animal omitted or cropped, in the same arrangement, relative sizes, and posture shown in the source. Every animal keeps its OWN real coat, fur, and markings, lifelike and unchanged. `
        : `Depict ${subject} — the entire animal from nose to tail to paws, in the same posture and body language shown in the source, keeping its OWN real coat, fur, and markings, lifelike and unchanged. `
      closer = many
        ? `Lock every animal's real anatomy, coat, and markings first; add the described elements and setting last.`
        : `Lock the animal's real anatomy, coat, and markings first; add the described elements and setting last.`
      break
    case '2d_art':
      opener = many
        ? `Create a two-dimensional artwork depicting ${subject} together — every animal clearly present and recognizable, in the same arrangement and relative sizes shown in the source. This is a flat 2D artwork, not a sculpture and not a photograph. `
        : `Create a two-dimensional artwork depicting ${subject} — clearly recognizable as this exact animal, in the posture shown in the source. This is a flat 2D artwork, not a sculpture and not a photograph. `
      closer = many
        ? `Preserve each animal's exact likeness and markings within the art style; render every animal in the same style uniformly.`
        : `Preserve the animal's exact likeness and markings within the art style.`
      break
    case '2d_photo':
      opener = many
        ? `Create a photograph of ${subject} together — every animal clearly present and recognizable, in the same arrangement and relative sizes shown in the source. This is a 2D photograph, not a sculpture and not a painting. `
        : `Create a photograph of ${subject} — clearly recognizable as this exact animal, in the posture shown in the source. This is a 2D photograph, not a sculpture and not a painting. `
      closer = many
        ? `Preserve each animal's exact likeness and markings within the photographic treatment; render every animal consistently.`
        : `Preserve the animal's exact likeness and markings within the photographic treatment.`
      break
  }

  const preservePrefix = many
    ? `For EACH animal individually, preserve its exact identity: `
    : `Preserve the animal's exact identity: `

  return `${opener}${preservePrefix}${petIdentityCore(true)} ${closer}`
}

// ── PROMPT BUILDER ──────────────────────────────────────────────
// Assembles an experimental render prompt: identity lead (mode-aware) →
// hue lock (monolithic sculpture_material only) → effect body + avoid.
// No environment/location and no plaque — each effect carries its own
// setting in its body.
export function buildPetExperimentalPrompt(input: {
  effectId: PetExperimentalEffectId
  count?:   number
}): string {
  const fx = BY_ID[input.effectId]
  if (!fx) throw new Error(`unknown pet experimental effect: ${input.effectId}`)

  const count = input.count && input.count > 0 ? input.count : 1
  const useHueLock = fx.mode === 'sculpture_material' && fx.monolithic

  return [
    identityLead(fx.mode, count),
    useHueLock ? PET_HUE_LOCK : '',
    fx.body,
    fx.avoid,
  ]
    .filter(Boolean)
    .join('\n\n')
}
