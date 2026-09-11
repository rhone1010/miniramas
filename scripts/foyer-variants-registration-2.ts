// scripts/foyer-variants-registration-2.ts
//
// FOYER-ONLY PROMPT VARIANTS, SECOND BATCH (registration). Rich, 2026-09-10.
//
// NOT PRODUCTION. Nothing here is imported by the app, and portraits-bodies.ts
// is untouched. Each variant is a list of exact edits applied at run time to
// the production prompt - buildEffectPrompt(id), body plus avoid - so every
// word outside an edit is the live production text of that day.
//
// Each `find` must occur EXACTLY ONCE in the production prompt, or the run
// refuses. If a body is rewritten in production, the variant stops matching
// and says so, rather than editing the wrong sentence.
//
// Replacement text is Rich's, verbatim from the brief. Where a replaced
// sentence also carried non-composition words (material, lighting,
// expression), those words are kept in their original wording, only
// re-capitalised where a clause now starts a sentence - each case is noted.

export interface Edit { find: string; replace: string }
export interface Variant { id: string; edits: Edit[]; note?: string }

const REMOVE = ''

export const VARIANTS: Variant[] = [
  {
    id: 'reclaimed_bronze',
    edits: [{
      find: 'Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered.',
      replace: 'Frame her from the upper chest to the top of the head, facing us naturally with her head upright and both eyes clearly visible. Her head occupies roughly 30% of the image height, with her eyes around the upper third of the image.',
    }],
  },
  {
    id: 'retro_robot',
    edits: [{
      find: 'Zoom out to frame from stomach to top of head. face should be 15% of the image',
      replace: 'Frame her as a close upper-body portrait, facing us naturally with both eyes clearly visible. Her head occupies roughly 30% of the image height, with enough shoulders and upper body visible to show the construction of the robot.',
    }],
  },
  {
    id: 'stained_glass',
    edits: [
      {
        find: 'make the subject a fully 3d stained glass sculpture. Tiffany meets Bronze Sculpture. Internally lit with nice falloffs for character.',
        replace: 'Make the subject a fully 3D stained-glass sculpture, Tiffany glass meeting bronze sculpture. She faces us directly, her head upright and both eyes clearly visible. Frame her from the upper chest to the top of the head, with her head occupying roughly 30% of the image height and her eyes around the upper third. Internally lit with beautiful falloff that reveals the character of the face.',
      },
      { find: ' Frame from chest to top of head. rortate the statue 10 degrees left.', replace: REMOVE },
    ],
  },
  {
    id: 'plushy',
    edits: [{
      find:
        'Frame tightly from mid-chest to head, with the subject filling most of the image. Nestle and gently squish them into a cozy pile of well-loved teddy bears, stuffed animals and pillows, with plush toys affectionately pressing against their shoulders and entering the edges of frame.\n' +
        'Set the scene on a rumpled bed at night with a warm bedside lamp and generous soft fill. Golden light keeps the face bright and flattering, with creamy bedding, soft open shadows and rich tactile detail. Lovable, cuddly, safe and deeply comforting, like a treasured childhood plush tucked into bed with all its friends.',
      replace:
        'Make her the unmistakable center of the portrait, facing us naturally with her head upright and both eyes clearly visible. Frame her closely from the upper chest to the top of the head, with her head occupying roughly 30% of the image height. Place only one or two smaller companion plushies beside her, close enough to create the feeling of plush friends without competing with her or making her small in the scene.\n\n' +
        'Keep the setting cozy and simple, with warm bedside light, soft creamy bedding and generous soft fill. Lovable, cuddly and deeply comforting, like a treasured handmade plush with one or two favorite companions.',
    }],
  },
  {
    id: 'ice',
    edits: [{
      find: 'Frame from the top of the head to the stomach.',
      replace: 'Frame her from the upper chest to the top of the head, facing us naturally with her head upright and both eyes clearly visible. Her head occupies roughly 30% of the image height.',
    }],
  },
  {
    id: 'impressionist',
    note: 'The base sentence also carried material language - "excess paint running over the shoulders" - kept in its own words; the round base and the pooling around it went as base emphasis.',
    edits: [{
      find: 'Frame mid-chest to top of head. The bust stands on a round base, with excess paint running over the shoulders and pooling naturally around the base.',
      replace: 'Frame the sculptural bust closely from the upper chest to the top of the head. She faces us naturally with her head upright and both eyes clearly visible, her head occupying roughly 30% of the image height. The sculpture is the dominant subject; only enough of its base is visible to establish that it physically exists in the atelier. Excess paint running over the shoulders.',
    }],
  },
  {
    id: 'art_deco',
    edits: [{
      find: 'Frame from the stomach to the top of the head.',
      replace: 'Frame her as a close upper-body portrait, facing us directly, with her head roughly 30% of the image height and the eyes around the upper third.',
    }],
  },
  {
    id: 'stone',
    edits: [
      {
        find: 'Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered.',
        replace: 'Frame the sculpture closely from the upper chest to the top of the head, facing us naturally with both eyes clearly visible. Her head occupies roughly 30% of the image height. The raw quarry stone remains visible along the lower and right edge of the sculpture without pulling the camera away from the face.',
      },
      { find: ' The sculpture stands on a cast-iron plant stand.', replace: REMOVE },
    ],
  },
  {
    id: 'petal_sculpture',
    note: 'The plinth sentence also carried the environment - foliage and sunlight - kept in its own words; only the plinth clause went.',
    edits: [
      {
        find: 'The sculpture stands on a polished dark wood plinth, blurred green foliage behind, warm sunlight from the left.',
        replace: 'Blurred green foliage behind, warm sunlight from the left.',
      },
      {
        find: 'Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered.',
        replace: 'Frame her closely from the upper chest to the top of the head, facing us naturally with both eyes clearly visible. Her head occupies roughly 30% of the image height. A hint of the dark wood plinth may remain below the portrait, but she fills the image.',
      },
    ],
  },
  {
    id: 'renaissance_woman',
    note: 'The shared tail repeats a framing instruction ("Framed from mid-chest ... upper arms fully rendered"); removed as part of the scale instructions being replaced.',
    edits: [
      {
        find: 'woman facing front, three-quarter turn of the shoulders. zoom in for torso and headshot. face should be 20% of image.',
        replace: 'Woman facing forward, head upright and both eyes clearly visible, with the shoulders only gently relaxed rather than strongly turned. Zoom in for an upper-torso portrait. Her head should occupy roughly 30% of the image height.',
      },
      { find: ' Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered.', replace: REMOVE },
    ],
  },
  {
    id: 'victorian_woman',
    edits: [{
      find: 'Pose her in graceful three-quarter profile, chin slightly raised, looking serenely into the distance with a soft, composed expression.',
      replace: 'She faces us in a graceful formal portrait, head upright and both eyes clearly visible, with a soft, composed expression. Frame generously enough to preserve the extraordinary hat and feathers while keeping her face large and dominant in the image, her head and hat together filling the upper portion of the composition.',
    }],
  },
  {
    id: 'wild_west_woman',
    note: 'The shared tail repeats a framing instruction ("Framed from mid-chest ... upper arms fully rendered"); removed as part of the scale/framing being replaced.',
    edits: [
      {
        find: 'woman facing front, three-quarter turn of the shoulders. framed from mid-chest to the top of the head. face should be 20% of image.',
        replace: 'Woman facing front, head upright and both eyes clearly visible, with only a gentle three-quarter turn of the shoulders. Frame from the upper chest to the top of the head, with her head occupying roughly 30% of the image height.',
      },
      { find: ' Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered.', replace: REMOVE },
    ],
  },
  {
    id: 'neon',
    edits: [{
      find: 'Framed from stomach to the top of the head, both shoulders and upper arms fully rendered.',
      replace: 'Frame her from the upper chest to the top of the head, facing us naturally with both eyes clearly visible. Her head occupies roughly 30% of the image height.',
    }],
  },
  {
    id: 'oil_impasto',
    note: 'The easel sentence also carried the lighting - "raking light across the surface so the paint\'s thickness casts its own small shadows" - kept in its own words.',
    edits: [{
      find: 'Frame from mid-chest to the top of the head. A flat canvas standing on a wooden easel, raking light across the surface',
      replace: 'The painting itself fills almost the entire image, seen nearly straight-on. Within the painting, she faces us with her head upright and both eyes clearly visible, framed from upper chest to top of head, her head roughly 30% of the painting height. Only a narrow suggestion of the canvas edge and easel remains visible. Raking light across the surface',
    }],
  },
  {
    id: 'balloon_face',
    edits: [
      {
        find: 'Frame stomach to top of head. Real physical sculpture',
        replace: 'Frame her from the upper chest to the top of the head, facing us naturally, with her head roughly 30% of the image height and both eyes clearly visible. Real physical sculpture',
      },
      { find: '\nFrame from thighs to top of head\n', replace: '\n' },
    ],
  },
  {
    id: 'sheet_music',
    note: 'Inserted after the symphony-hall description in place of its "Heavily out of focus.", which the replacement restates.',
    edits: [{
      find: ' Heavily out of focus.',
      replace: ' Keep her large and dominant in the image, facing us naturally with both eyes clearly visible. Frame from the upper chest to the top of the head, with her head roughly 30% of the image height. The symphony hall remains atmospheric and heavily out of focus behind her.',
    }],
  },
  {
    id: 'origami',
    edits: [{
      find: 'Face should occupy 30% of the image.',
      replace: 'Face should occupy 30% of the image. She faces us naturally with her head upright and both eyes clearly visible.',
    }],
  },
  {
    id: 'linocut',
    note: '"Allow only a soft suggestion of the atelier beyond the paper." is included verbatim from the brief; the atelier paragraph itself is unchanged.',
    edits: [{
      find: 'Frame from mid-chest to the top of the head. No lettering. The print lies on a bench, its edges curling.',
      replace: 'No lettering. The finished linocut print fills almost the entire image and is viewed nearly straight-on, with only a narrow irregular paper edge visible. Within the print, she faces us directly with both eyes clearly visible, framed from upper chest to top of head, her head roughly 30% of the print height. Allow only a soft suggestion of the atelier beyond the paper.',
    }],
  },
  {
    id: 'art_nouveau',
    edits: [{
      find: 'Frame from the stomach to the top of the head.',
      replace: 'Frame her from the upper chest to the top of the head, facing us directly with her head upright and both eyes clearly visible. Her head occupies roughly 30% of the image height.',
    }],
  },
  {
    id: 'crystallized',
    edits: [
      {
        find: 'Frame from stomach to the top of the head.',
        replace: 'Frame her from the upper chest to the top of the head, facing us naturally with both eyes clearly visible. Her head occupies roughly 30% of the image height.',
      },
      { find: '\nframe from stomach to top of head.\n', replace: '\n' },
    ],
  },
  {
    id: 'deco_twenties_woman',
    note: 'The sentence also carried the expression - "a calm, self-possessed expression and faint smile" - kept in its own words.',
    edits: [{
      find: 'Frame from mid-chest to head, shoulders three-quarter turned, facing camera with a calm, self-possessed expression and faint smile.',
      replace: 'Frame her from the upper chest to the top of the head. She faces us naturally with her head upright and both eyes clearly visible; her shoulders may relax slightly away from square. Her head occupies roughly 30% of the image height. A calm, self-possessed expression and faint smile.',
    }],
  },
  {
    id: 'elizabethan_woman',
    note: 'The pose sentence also carried the expression - "the serene, self-possessed expression of a royal court portrait" - kept in its own words. Both conflicting framing sentences removed.',
    edits: [
      {
        find: 'Pose her in graceful three-quarter view, chin slightly raised, with the serene, self-possessed expression of a royal court portrait. Looking to the side.',
        replace: 'Pose her facing us in a stately, reserved court portrait, head upright and both eyes clearly visible. Frame her closely while keeping the complete sculptural ruff and jeweled headdress visible. Her face remains large and central rather than being diminished by the costume. With the serene, self-possessed expression of a royal court portrait.',
      },
      { find: ' Zoom to frame subject from chest to top of head.', replace: REMOVE },
      { find: ' Frame generously from the upper torso through the entire headdress, with the full ruff and headdress visible.', replace: REMOVE },
    ],
  },
  {
    id: 'iron',
    note: 'The opening also placed the sculpture on the walnut plinth; that clause went as plinth composition - the replacement keeps a suggestion of it.',
    edits: [
      {
        find: 'Rebuild the subject as a **hand-forged iron sculpture**, physically standing on a beautifully turned walnut plinth.',
        replace: 'Rebuild the subject as a **hand-forged iron sculpture**.',
      },
      {
        find: 'Frame **stomach to top of head**, with both shoulders and upper arms fully present.',
        replace: 'Frame closely from the upper chest to the top of the head, facing us naturally with both eyes clearly visible. Her head occupies roughly 30% of the image height. Only a suggestion of the walnut plinth is visible below; the sculpture, not the room, dominates the photograph.',
      },
    ],
  },
  {
    id: 'cast_glass',
    edits: [{
      find: 'Frame from mid-chest to the top of the head.',
      replace: 'Frame her from the upper chest to the top of the head, facing us naturally with her head upright and both eyes clearly visible. Her head occupies roughly 30% of the image height.',
    }],
  },
  {
    id: 'ebony',
    edits: [{
      find: 'Face should occupy 30% of the image.',
      replace: 'Face should occupy 30% of the image. She faces us naturally, head upright, with both eyes clearly visible.',
    }],
  },
  {
    id: 'quilted',
    edits: [{
      find: 'Face should occupy 30% of the image.',
      replace: 'Face should occupy 30% of the image. She faces us naturally, head upright, with both eyes clearly visible.',
    }],
  },
  {
    id: 'porcelain',
    edits: [{
      find: 'Face should occupy 30% of the image.',
      replace: 'Face should occupy 30% of the image. She faces us naturally, head upright, with both eyes clearly visible.',
    }],
  },
  {
    id: 'fire_face',
    edits: [{
      find: 'Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered.',
      replace: 'Frame her from the upper chest to the top of the head, facing us naturally with both eyes clearly visible, her head occupying roughly 30% of the image height.',
    }],
  },
  {
    id: 'sand_form',
    edits: [{
      find: 'Face should occupy 30% of the image.',
      replace: 'Face should occupy 30% of the image. She faces us naturally with her head upright and both eyes clearly visible.',
    }],
  },
  {
    id: 'mercury',
    edits: [
      {
        find: 'Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered.',
        replace: 'Frame her closely from the upper chest to the top of the head, facing us naturally with both eyes clearly visible and her head roughly 30% of the image height. Let the mercury ribbons, droplets and tendrils break outward around this close portrait rather than pulling the camera away to show the entire sculpture. A suggestion of the brushed-steel base may remain below.',
      },
      { find: ' The piece stands on a brushed steel base.', replace: REMOVE },
    ],
  },
]

/** The production prompt with this variant's edits, each matched exactly once. */
export function applyVariant(production: string, v: Variant): string {
  let p = production
  for (const e of v.edits) {
    const n = p.split(e.find).length - 1
    if (n !== 1) {
      throw new Error(`${v.id}: expected the production text to contain this exactly once, found ${n}:\n    "${e.find}"`)
    }
    p = p.replace(e.find, () => e.replace)
  }
  return p
}
