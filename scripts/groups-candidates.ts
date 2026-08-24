// scripts/groups-candidates.ts
//
// CANDIDATE GROUPS BODIES - NOT IN THE LIVE CATALOG.
//
// Eleven Portraits bodies adapted for multiple people, for testing only.
// Deliberately kept OUT of lib/v1/groups/groups-effects.ts so that nothing
// here can reach a customer before Rich has judged it. Once approved, the
// bodies move into the catalog and this file is archived.
//
// ── HOW THESE WERE MADE, SO THE EDIT IS TRACEABLE ─────────────────────
//
// Mechanically, from a transform learned off Rich's OWN paired example -
// Portraits `bronze` against Groups `bronze`, which he wrote himself. No
// wording was invented. What the transform does, and only this:
//
//   REMOVED  single-subject framing ("Framed from mid-chest to the top of
//            the head", "Face should occupy 30% of the image"). The Groups
//            pipeline appends its own framing clause based on the subject
//            count, so a body carrying one fights it.
//   REMOVED  "Flattering soft key light, shadow separating jaw from neck"
//            and "Clear the skin" - the two Rich cut from Groups on
//            23 August. They describe one head at one distance.
//   REMOVED  "No held objects" - a single-subject rule. In a family photo
//            somebody is holding a baby.
//   ADDED    Rich's preservation sentence and cohesion sentence, verbatim
//            from Groups bronze.
//   ADDED    Rich's holding line, verbatim from Groups bronze.
//   CHANGED  singular to plural where it referred to the subject: "the
//            subject" -> "the group", "the face" -> "each face", "The
//            subject's own garment" -> "Each person's own garment".
//
// ── WHAT IS NOT HERE ──────────────────────────────────────────────────
//
// `wax` and `silver` exist in neither library. Rich writes those.
// `pencil_sketch` is already in the Groups catalog and is not duplicated.
//
// ── READ THIS BEFORE TRUSTING ANY OF IT ───────────────────────────────
//
// A mechanical transform produces mechanical prose. Several bodies still
// carry oddities that were in the Portraits original and were deliberately
// NOT corrected, because correcting them would be rewriting Rich's text:
// "rortate" in stained_glass, "liguid" and "Mainting" in polished_gold,
// "Frame from" removed but the sentence around it left as found. Rich is
// the judge of every line here.

export interface CandidateBody {
  id:    string
  label: string
  body:  string
  avoid: string | null
}

export const CANDIDATES: CandidateBody[] = [
  {
    id:    'quilted',
    label: 'Quilted',
    body:  `The group is sewn from quilted fabric — panels of patterned cotton pieced together and stitched, with visible seams, running stitch lines and the soft puff of batting between the layers. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Every face is quilted cloth throughout: pieced panels shaped to the brow, cheeks and jaw, the stitching following the planes rather than the features. Every set of eyes and mouth is embroidered in thread. Each person's hair is cut and layered fabric in their real style and length. A folk palette of faded indigo, madder red, ochre and cream, prints small and repeating, the cloth softly worn. Each person's own garment carries through in pieced quilt. Likeness is critical. Idealized and beautiful. Photographic — a real object photographed in real light, not an illustration. Background: a quilter's room — a frame, folded bolts, a window with soft daylight, heavily out of focus. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid real skin or hair. Avoid a flat printed quilt or wall hanging — this is dimensional and sewn. Avoid a rag doll or novelty toy. Avoid stitching that traces the wrinkles of the face.`,
  },
  {
    id:    'petal_sculpture',
    label: 'Petal Sculpture',
    body:  `The group is sculpted entirely from thousands of densely layered flower petals, creating a seamless floral sculpture with no visible skin. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. The likeness emerges through flowing planes of overlapping petals rather than individual flowers, while only occasional blossoms appear to reveal the material. Rich gradients of crimson, scarlet, coral, tangerine, peach, magenta, fuchsia, violet, lavender, and deep burgundy flow naturally across the sculpture like a living oil painting. Each person's hair transforms into sweeping masses of layered petals that preserve their original hairstyle, blending seamlessly into the figure. Dramatic spring sunlight with warm rim light. Avoid bouquets, floral crowns, flower garlands, makeup effects, visible skin, individual flowers covering the face, decorative arrangements, or flowers attached to a person. The petals themselves are the sculptural material. The sculpture stands on a polished dark wood plinth, blurred green foliage behind, warm sunlight from the left. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: null,
  },
  {
    id:    'sand_form',
    label: 'Sand Form',
    body:  `The group is formed entirely from desert sand — a face and figure held for a moment in drifting dune, the whole mass loose grain all the way through with no skin, teeth or real hair anywhere. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Every set of lips, eyes and mouth is sand like everything else. The windward side is sharp and fully resolved; on the leeward side the wind has scooped a shallow cavity out of the cheek and temple, the edge crumbling and streaming off into the air in fine ribbons, the shoulder dissolving into the dune it rises from. Warm ochre, bone and pale gold, the low sun raking across and throwing the ripple texture into relief. Each face is clearly that person while it lasts — brow, cheek and jaw carved by wind rather than hand. Each person's hair keeps its real length and silhouette, streaming back as blown sand. Likeness is critical. Photographic and highly idealized — beautiful, quiet, already going. Background: windblown dunes at low sun, a sky bleached pale, heavily out of focus. Preserve each person's natural facial character, asymmetry, lines and scars. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid sand dusted over a real person. Avoid real skin, lips, teeth, eyes or hair. Avoid a solid sandstone carving — this is loose grain, mid-collapse. Avoid a symmetrical or fully intact face.`,
  },
  {
    id:    'watercolour',
    label: 'Watercolour',
    body:  `Rebuild the group as one three-dimensional sculpture painted in watercolour — a solid object with real volume, not a picture on paper. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. rotate the group 20 degrees left. The whole form is soft transparent washes: the face, hair, shoulders and garment modelled in light and shade, with hard edges where a wash dried against itself and the white of the surface left bare at the brightest points. The paint is still wet. Colour runs down the shoulders and the front of the garment in fine coloured rivulets and drips, gathering in bright pools of red, ochre and violet on the round white board the group stands on. Colours natural to each person's complexion and clothing, transparent and luminous, granulating in the low spots. Likeness is critical. Keep permanent structure: lines, scars and the natural asymmetry of each face. Never reshape, enlarge eyes, correct asymmetry or de-age. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid a flat painting or anything on paper — this is a solid object standing on a board. Avoid opaque or body colour. Avoid a photographic face. Avoid a bright white modern gallery; the room is an old cluttered atelier.`,
  },
  {
    id:    'impressionist',
    label: 'Impressionist',
    body:  `Rebuild the group as **one three-dimensional sculptural work made entirely from thick Impressionist oil paint**, standing physically in the room. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Faces, hair, necks, clothing and shoulders are formed from heavy palette-knife impasto: broad slabs, ridges and lifted strokes with real depth, hard edges and tiny cast shadows.
**Preserve every person's likeness, face shape, skin tone, distinctive features, and exact hairstyle, length and colour.** Every face remains clearly recognizable despite the expressive construction. Hair is especially sculptural, formed from bold ropes, sweeps and ridges of paint following each person's original hair direction and volume. Use broken natural color, with violet, blue and green worked into shadows instead of grey or black.
The work stands on a round base, with excess paint running over the shoulders and pooling naturally around the base.
Place it in a romantic, generations-old artist's atelier: aged timber, worn plaster, antique easels, stacked canvases, portfolios, drawing tools and pinned studies. A huge ribbed iron-and-glass industrial skylight fills the studio with soft directional daylight, atmospheric dust and long shadows. Shallow depth of field. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `**Avoid:** flat paintings, canvas portraits, smooth or photorealistic skin, thin or blended paint, uniform brushwork, grey or black shadows. The subject must read unmistakably as a **solid sculptural object physically built from thick oil paint**.`,
  },
  {
    id:    'driftwood_resin',
    label: 'Driftwood & Resin',
    body:  `Transform the whole group into a contemporary sculpture combining weathered driftwood and glossy colored epoxy resin — the live-edge resin-river aesthetic. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. The driftwood preserves the form and the likeness: each face and the structural planes of every head, shoulders, and major contours are carved from pale, silvery, weathered driftwood with visible grain, knots, cracks, and organic live edges, keeping every person clearly recognizable. Flowing rivers and pools of translucent colored epoxy resin run through and between the wood — deep teal, ocean blue, amber, or emerald — filling the live-edge gaps, the cracks, and the negative spaces, catching and refracting light. The resin is where the color and translucency live; the wood is where the likeness lives. The whole piece is finished in a high-gloss polish so the resin reads as liquid-clear and the wood as satin-smooth. No human skin anywhere — every face, neck, forehead, ears and every visible surface are weathered driftwood, not skin. The wood grain, cracks and live edges continue across every face. This is the most common failure. Avoid an all-wood sculpture with no resin, or an all-resin sculpture with no wood — both materials must be present and distinct. Avoid a matte or unfinished surface; the glossy high-polish finish is required. Avoid resin that looks opaque or painted — it must read as translucent, light-catching epoxy. Avoid driftwood so abstract the faces stop being recognizable; the wood carries the likeness. Sculpture on a base in a coastal woodworker's studio — a wide window onto grey sea and sky, live-edge slabs leaning against the walls, clamps and resin buckets, sawdust light. Strong depth of field heavily blurring the background. Contemporary gallery presentation. High-gloss finish catching the light. Translucent resin rivers. Weathered live-edge driftwood. Museum-quality craftsmanship. Highly tactile and dimensional. Fine-art mixed-media sculpture. No plaque. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: null,
  },
  {
    id:    'chocolate',
    label: 'Chocolate',
    body:  `convert the group into a rich chocolate sculpture. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. smooth brown milk chocolate with highly detailed features. Background should be a chocolate shop (blurred). no visible letters. satin sheen on entire sculpture Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: null,
  },
  {
    id:    'linocut',
    label: 'Linocut',
    body:  `Redraw the group as a hand-cut linocut print — bold black ink on cream paper, the image built entirely from carved marks. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Broad cleared areas of pure white, dense black masses, and the form described by parallel gouge strokes that swell and taper. Visible slips of the blade and small imperfect edges where the lino chipped. Each head of hair is a solid black shape cut with a few sweeping white gouges. One second colour, a flat overprinted ochre or red, slightly out of register. Likeness is critical. No lettering. The print lies on a bench, its edges curling. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid grey tones or shading — the image is black, white and one flat colour. Avoid photographic rendering. Avoid a sculpture.`,
  },
  {
    id:    'stained_glass',
    label: 'Stained Glass',
    body:  `make the group one fully 3d stained glass sculpture. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Tiffany meets Bronze Sculpture. Internally lit with nice falloffs for character. likeness is important. No human skin, hair, nails or teeth. rortate the statue 10 degrees left. the background is a beautiful tiffany lamp style shop. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid a flat opaque mosaic, painted-on color, or a 2D stained-glass window with no dimensional form. Avoid glass without visible leading/came lines between the cells. Avoid a uniformly lit surface with no backlit glow — the inner luminosity and the dark leading are both required. Avoid muddy or desaturated glass; the cathedral-glass jewel tones must read as vivid and lit.`,
  },
  {
    id:    'lichen_granite',
    label: 'Lichen Granite',
    body:  `The group is carved directly from a massive ancient granite monolith rising from the forest floor, preserving every person's likeness while remaining unmistakably part of the original boulder. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. The stone surface is weathered by centuries of moss, colorful lichens, delicate ferns, creeping vines, and tiny woodland plants that naturally reclaim cracks and ledges, while each person's existing hair becomes moss, roots, and woodland growth that preserve its original silhouette. Warm shafts of sunlight filter through towering trees, illuminating damp stone and drifting forest particles. Preserve each person's existing clothing naturally carved into the stone, no human skin. Existing clothing remains, carved from the same weathered granite and integrated seamlessly into the monolith. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: null,
  },
  {
    id:    'polished_gold',
    label: 'Polished Gold',
    body:  `Transform the whole group into a contemporary polished gold sculpture — mirror-bright warm yellow gold with a high specular finish, the surface smooth and flowing with no visible tool marks. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. hair is poured liguid gold that matches each person's with deep carved separations catching bright highlights. No human skin anywhere — every face is polished gold like the rest. Each person's own garment carries through in the same material. the background is an expensively appointed conservatory with many windows with warm lighting streaming through inside potted trees and plants. Make the creation match age.
Mainting each person's hair style, hairline, face shape. micro gestures. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: null,
  },
]
