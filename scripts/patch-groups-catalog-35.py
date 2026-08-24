#!/usr/bin/env python3
"""
patch-groups-catalog-35.py

Rebuilds the Groups catalogue in lib/v1/groups/groups-effects.ts.

    28 today
   - 6 removed   victorian, elizabethan, renaissance, persian_court,
                 wild_west, folded_book
   +12 added     quilted, petal_sculpture, sand_form, watercolour,
                 impressionist, driftwood_resin, chocolate, linocut,
                 lichen_granite, polished_gold, wax, silver
   ----
    34

`stained_glass` is the thirty-fifth and is NOT here. Its body still
produces glass cutouts staged in a lamp shop and Rich has it for rewrite.
It stays in scripts/groups-candidates.ts until then.

── WHY THE FIVE COSTUME EFFECTS GO ────────────────────────────────────

All five contained "appropriate to their apparent sex and age", which
hands the sex of every figure to NB2 with nothing telling it who is who.
Groups analyze returns a headcount and nothing else - no per-person sex
exists anywhere in the pipeline. On a 1970s photograph with long-haired
men it guesses wrong, and it guessed wrong every time it was tested.

The other twenty-three never had the problem: material effects keep each
person's own clothing, so there is no sex to infer. Rich, 23 August:
material preserves, costume reinvents.

`samurai` is period costume and STAYS - it does not contain the "apparent
sex" instruction and was not on Rich's list. Watch it; it may have the
same fault in a quieter form.

`folded_book` removed on Rich's call, separately.

── WHERE THE TWELVE CAME FROM ─────────────────────────────────────────

Ten are Portraits bodies adapted for multiple people by a transform learned
off Rich's own Portraits `bronze` against Groups `bronze`. Rendered against
his family photograph on 23 August; his verdict was "all good except
stainedglass".

`wax` and `silver` existed in neither library. Written from Rich's
direction on 23 August and approved after two revisions each - silver's
sheen was corrected to burnish where a piece is handled rather than pool,
and wax was locked to a single honey-cream colour with difference carried
as density rather than hue.

── THIS BREAKS THINGS DOWNSTREAM. SAY SO TO CUI. ──────────────────────

Removing six ids means:
  - any registry or room page listing them needs regenerating
  - any piece already crafted with one of those six keeps an effect_id
    that is no longer in the catalogue. Nothing here migrates those rows.
    A collection tile reading its label off the catalogue will find
    nothing. THAT IS NOT HANDLED AND IT IS REAL.

── DISCIPLINE ─────────────────────────────────────────────────────────
  Dry run by default. --write to write.
  Every anchor must match exactly once.
  Line ending read off the file, never assumed - groups-effects.ts is CRLF
  and groups-generator.ts in the same directory is LF.

USAGE
  python scripts/patch-groups-catalog-35.py
  python scripts/patch-groups-catalog-35.py --write
"""

import re
import sys
import os

PATH = os.path.join('lib', 'v1', 'groups', 'groups-effects.ts')

REMOVE = ['victorian', 'elizabethan', 'renaissance', 'persian_court',
          'wild_west', 'folded_book']

ADD_IDS = ['quilted', 'petal_sculpture', 'sand_form', 'watercolour', 'impressionist', 'driftwood_resin', 'chocolate', 'linocut', 'lichen_granite', 'polished_gold', 'wax', 'silver']

NEW_ENTRIES = "  quilted: {\r\n    id: 'quilted',\r\n    label: 'Quilted',\r\n    intake: 'group_photo',\r\n    body: `The group is sewn from quilted fabric — panels of patterned cotton pieced together and stitched, with visible seams, running stitch lines and the soft puff of batting between the layers. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Every face is quilted cloth throughout: pieced panels shaped to the brow, cheeks and jaw, the stitching following the planes rather than the features. Every set of eyes and mouth is embroidered in thread. Each person's hair is cut and layered fabric in their real style and length. A folk palette of faded indigo, madder red, ochre and cream, prints small and repeating, the cloth softly worn. Each person's own garment carries through in pieced quilt. Likeness is critical. Idealized and beautiful. Photographic — a real object photographed in real light, not an illustration. Background: a quilter's room — a frame, folded bolts, a window with soft daylight, heavily out of focus. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,\r\n    avoid: `Avoid real skin or hair. Avoid a flat printed quilt or wall hanging — this is dimensional and sewn. Avoid a rag doll or novelty toy. Avoid stitching that traces the wrinkles of the face.`,\r\n  },\r\n  petal_sculpture: {\r\n    id: 'petal_sculpture',\r\n    label: 'Petal Sculpture',\r\n    intake: 'group_photo',\r\n    body: `The group is sculpted entirely from thousands of densely layered flower petals, creating a seamless floral sculpture with no visible skin. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. The likeness emerges through flowing planes of overlapping petals rather than individual flowers, while only occasional blossoms appear to reveal the material. Rich gradients of crimson, scarlet, coral, tangerine, peach, magenta, fuchsia, violet, lavender, and deep burgundy flow naturally across the sculpture like a living oil painting. Each person's hair transforms into sweeping masses of layered petals that preserve their original hairstyle, blending seamlessly into the figure. Dramatic spring sunlight with warm rim light. Avoid bouquets, floral crowns, flower garlands, makeup effects, visible skin, individual flowers covering the face, decorative arrangements, or flowers attached to a person. The petals themselves are the sculptural material. The sculpture stands on a polished dark wood plinth, blurred green foliage behind, warm sunlight from the left. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,\r\n  },\r\n  sand_form: {\r\n    id: 'sand_form',\r\n    label: 'Sand Form',\r\n    intake: 'group_photo',\r\n    body: `The group is formed entirely from desert sand — a face and figure held for a moment in drifting dune, the whole mass loose grain all the way through with no skin, teeth or real hair anywhere. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Every set of lips, eyes and mouth is sand like everything else. The windward side is sharp and fully resolved; on the leeward side the wind has scooped a shallow cavity out of the cheek and temple, the edge crumbling and streaming off into the air in fine ribbons, the shoulder dissolving into the dune it rises from. Warm ochre, bone and pale gold, the low sun raking across and throwing the ripple texture into relief. Each face is clearly that person while it lasts — brow, cheek and jaw carved by wind rather than hand. Each person's hair keeps its real length and silhouette, streaming back as blown sand. Likeness is critical. Photographic and highly idealized — beautiful, quiet, already going. Background: windblown dunes at low sun, a sky bleached pale, heavily out of focus. Preserve each person's natural facial character, asymmetry, lines and scars. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,\r\n    avoid: `Avoid sand dusted over a real person. Avoid real skin, lips, teeth, eyes or hair. Avoid a solid sandstone carving — this is loose grain, mid-collapse. Avoid a symmetrical or fully intact face.`,\r\n  },\r\n  watercolour: {\r\n    id: 'watercolour',\r\n    label: 'Watercolour',\r\n    intake: 'group_photo',\r\n    body: `Rebuild the group as one three-dimensional sculpture painted in watercolour — a solid object with real volume, not a picture on paper. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. rotate the group 20 degrees left. The whole form is soft transparent washes: the face, hair, shoulders and garment modelled in light and shade, with hard edges where a wash dried against itself and the white of the surface left bare at the brightest points. The paint is still wet. Colour runs down the shoulders and the front of the garment in fine coloured rivulets and drips, gathering in bright pools of red, ochre and violet on the round white board the group stands on. Colours natural to each person's complexion and clothing, transparent and luminous, granulating in the low spots. Likeness is critical. Keep permanent structure: lines, scars and the natural asymmetry of each face. Never reshape, enlarge eyes, correct asymmetry or de-age. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,\r\n    avoid: `Avoid a flat painting or anything on paper — this is a solid object standing on a board. Avoid opaque or body colour. Avoid a photographic face. Avoid a bright white modern gallery; the room is an old cluttered atelier.`,\r\n  },\r\n  impressionist: {\r\n    id: 'impressionist',\r\n    label: 'Impressionist',\r\n    intake: 'group_photo',\r\n    body: `Rebuild the group as **one three-dimensional sculptural work made entirely from thick Impressionist oil paint**, standing physically in the room. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Faces, hair, necks, clothing and shoulders are formed from heavy palette-knife impasto: broad slabs, ridges and lifted strokes with real depth, hard edges and tiny cast shadows. **Preserve every person's likeness, face shape, skin tone, distinctive features, and exact hairstyle, length and colour.** Every face remains clearly recognizable despite the expressive construction. Hair is especially sculptural, formed from bold ropes, sweeps and ridges of paint following each person's original hair direction and volume. Use broken natural color, with violet, blue and green worked into shadows instead of grey or black. The work stands on a round base, with excess paint running over the shoulders and pooling naturally around the base. Place it in a romantic, generations-old artist's atelier: aged timber, worn plaster, antique easels, stacked canvases, portfolios, drawing tools and pinned studies. A huge ribbed iron-and-glass industrial skylight fills the studio with soft directional daylight, atmospheric dust and long shadows. Shallow depth of field. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,\r\n    avoid: `**Avoid:** flat paintings, canvas portraits, smooth or photorealistic skin, thin or blended paint, uniform brushwork, grey or black shadows. The subject must read unmistakably as a **solid sculptural object physically built from thick oil paint**.`,\r\n  },\r\n  driftwood_resin: {\r\n    id: 'driftwood_resin',\r\n    label: 'Driftwood & Resin',\r\n    intake: 'group_photo',\r\n    body: `Transform the whole group into a contemporary sculpture combining weathered driftwood and glossy colored epoxy resin — the live-edge resin-river aesthetic. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. The driftwood preserves the form and the likeness: each face and the structural planes of every head, shoulders, and major contours are carved from pale, silvery, weathered driftwood with visible grain, knots, cracks, and organic live edges, keeping every person clearly recognizable. Flowing rivers and pools of translucent colored epoxy resin run through and between the wood — deep teal, ocean blue, amber, or emerald — filling the live-edge gaps, the cracks, and the negative spaces, catching and refracting light. The resin is where the color and translucency live; the wood is where the likeness lives. The whole piece is finished in a high-gloss polish so the resin reads as liquid-clear and the wood as satin-smooth. No human skin anywhere — every face, neck, forehead, ears and every visible surface are weathered driftwood, not skin. The wood grain, cracks and live edges continue across every face. This is the most common failure. Avoid an all-wood sculpture with no resin, or an all-resin sculpture with no wood — both materials must be present and distinct. Avoid a matte or unfinished surface; the glossy high-polish finish is required. Avoid resin that looks opaque or painted — it must read as translucent, light-catching epoxy. Avoid driftwood so abstract the faces stop being recognizable; the wood carries the likeness. Sculpture on a base in a coastal woodworker's studio — a wide window onto grey sea and sky, live-edge slabs leaning against the walls, clamps and resin buckets, sawdust light. Strong depth of field heavily blurring the background. Contemporary gallery presentation. High-gloss finish catching the light. Translucent resin rivers. Weathered live-edge driftwood. Museum-quality craftsmanship. Highly tactile and dimensional. Fine-art mixed-media sculpture. No plaque. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,\r\n  },\r\n  chocolate: {\r\n    id: 'chocolate',\r\n    label: 'Chocolate',\r\n    intake: 'group_photo',\r\n    body: `convert the group into a rich chocolate sculpture. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. smooth brown milk chocolate with highly detailed features. Background should be a chocolate shop (blurred). no visible letters. satin sheen on entire sculpture Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,\r\n  },\r\n  linocut: {\r\n    id: 'linocut',\r\n    label: 'Linocut',\r\n    intake: 'group_photo',\r\n    body: `Redraw the group as a hand-cut linocut print — bold black ink on cream paper, the image built entirely from carved marks. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Broad cleared areas of pure white, dense black masses, and the form described by parallel gouge strokes that swell and taper. Visible slips of the blade and small imperfect edges where the lino chipped. Each head of hair is a solid black shape cut with a few sweeping white gouges. One second colour, a flat overprinted ochre or red, slightly out of register. Likeness is critical. No lettering. The print lies on a bench, its edges curling. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,\r\n    avoid: `Avoid grey tones or shading — the image is black, white and one flat colour. Avoid photographic rendering. Avoid a sculpture.`,\r\n  },\r\n  lichen_granite: {\r\n    id: 'lichen_granite',\r\n    label: 'Lichen Granite',\r\n    intake: 'group_photo',\r\n    body: `The group is carved directly from a massive ancient granite monolith rising from the forest floor, preserving every person's likeness while remaining unmistakably part of the original boulder. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. The stone surface is weathered by centuries of moss, colorful lichens, delicate ferns, creeping vines, and tiny woodland plants that naturally reclaim cracks and ledges, while each person's existing hair becomes moss, roots, and woodland growth that preserve its original silhouette. Warm shafts of sunlight filter through towering trees, illuminating damp stone and drifting forest particles. Preserve each person's existing clothing naturally carved into the stone, no human skin. Existing clothing remains, carved from the same weathered granite and integrated seamlessly into the monolith. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,\r\n  },\r\n  polished_gold: {\r\n    id: 'polished_gold',\r\n    label: 'Polished Gold',\r\n    intake: 'group_photo',\r\n    body: `Transform the whole group into a contemporary polished gold sculpture — mirror-bright warm yellow gold with a high specular finish, the surface smooth and flowing with no visible tool marks. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. hair is poured liguid gold that matches each person's with deep carved separations catching bright highlights. No human skin anywhere — every face is polished gold like the rest. Each person's own garment carries through in the same material. the background is an expensively appointed conservatory with many windows with warm lighting streaming through inside potted trees and plants. Make the creation match age. Mainting each person's hair style, hairline, face shape. micro gestures. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,\r\n  },\r\n  wax: {\r\n    id: 'wax',\r\n    label: 'Wax',\r\n    intake: 'group_photo',\r\n    body: `Transform the group into a single sculpture cast in fine wax. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. No human skin, hair, nails, teeth. Everything is wax. The entire sculpture is cast from ONE wax in a single colour - warm honey-cream, the colour of a beeswax candle. Garments, hair, skin and every surface are that same wax. Differences between people and between clothes appear only as shifts in density and translucency, never as different hues: a dark jacket is deeper, more opaque wax and never brown; a red shirt is denser wax and never red. Any pattern in the clothing - checks, stripes, knitwear - is carried as relief and texture pressed into the wax surface, never as printed colour. Do not add, remove, duplicate, replace, or reposition any person. Create one unified sculptural artwork - it must read as one cohesive piece rather than separate statues or busts, with real depth and overlap between figures. The wax has deep subsurface scattering: light enters the surface and glows out from within, warmest where the material is thinnest. Translucency is artistically placed - the outer edge of an ear, the bridge of a nose, the rim of a shoulder, the trailing edge of a sleeve - while the mass of each figure stays dense and softly opaque. Strong backlighting drives that glow through the edges of the group. Faces, hair and garments are all the same wax: eyes are wax with no wet gleam, lips and mouths are wax, and hair is wax formed into each person's real style and length, never real hair. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. The sculpture stands on a rich aged oak plank table in a 300-year-old candle shop at night, dark wood throughout. Every light in the room is a large burning candle, casting a warm yellow-orange glow with deep shadow beyond. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,\r\n  },\r\n  silver: {\r\n    id: 'silver',\r\n    label: 'Silver',\r\n    intake: 'group_photo',\r\n    body: `Transform the group into a single sculpture cast in solid silver. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified sculptural artwork - it must read as one cohesive piece rather than separate statues or busts, with real depth and overlap between figures. The silver carries a slightly dull satin sheen across most of its surface - rich, dense, unmistakably heavy metal. Polish appears the way silver actually wears, burnished where a piece would be handled and rubbed: shoulders, elbows, hands, the tops of heads, the crest of a chest. The brightness rises and falls gradually out of the satin, never a hard-edged pool of mirror against dull ground. The face stays satin throughout, with no polished patches on cheeks, brows or noses. Faces, hair and garments are all the same silver: eyes are satin silver with no wet gleam, lips and mouths are silver, and hair is silver worked into each person's real style and length, never real hair. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. The sculpture stands on a rich walnut table. Behind it and slightly to one side, secondary to the piece, an open walnut presentation box lined in deep red-purple velvet, with the shape of the sculpture clearly pressed into the velvet where it sits. Full-height divided windows further back are thrown far out of focus, glowing with an evening sunset. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets.`,\r\n  },"


def detect_eol(text):
    crlf = text.count('\r\n')
    return '\r\n' if crlf and crlf >= text.count('\n') - crlf else '\n'


def main():
    write = '--write' in sys.argv

    if not os.path.exists(PATH):
        raise SystemExit('REFUSED: %s not found. Run from the repo root.' % PATH)

    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()

    EOL = detect_eol(src)
    before_len = len(src)
    before_keys = re.findall(r'^  ([a-z_0-9]+): \{', src, re.M)

    print('  %s' % PATH)
    print('  %d effects, %d bytes, %s' % (
        len(before_keys), before_len, 'CRLF' if EOL == '\r\n' else 'LF'))
    print('')

    # ── PRE-WRITE ────────────────────────────────────────────────────
    for k in REMOVE:
        if k not in before_keys:
            raise SystemExit('REFUSED: "%s" not in the catalogue. Nothing written.' % k)
        if src.count("  | '%s'" % k) != 1:
            raise SystemExit('REFUSED: union entry for "%s" not found exactly once.' % k)
    for k in ADD_IDS:
        if k in before_keys:
            raise SystemExit('REFUSED: "%s" is ALREADY in the catalogue. Nothing written.' % k)

    out = src

    # ── REMOVE: object entries ───────────────────────────────────────
    for k in REMOVE:
        pat = re.compile(r'^  ' + k + r': \{.*?^  \},' + re.escape(EOL), re.M | re.S)
        m = pat.search(out)
        if not m:
            raise SystemExit('REFUSED: could not isolate the "%s" entry. Nothing written.' % k)
        out = out[:m.start()] + out[m.end():]
        print('  removed   %s' % k)

    # ── REMOVE: union members ────────────────────────────────────────
    for k in REMOVE:
        line = "  | '%s'%s" % (k, EOL)
        if out.count(line) != 1:
            raise SystemExit('REFUSED: union line for "%s" not unique. Nothing written.' % k)
        out = out.replace(line, '', 1)

    print('')

    # ── ADD: union members, after the last existing one ──────────────
    anchor = "  | 'carved_family'" + EOL
    if out.count(anchor) != 1:
        raise SystemExit('REFUSED: union anchor carved_family not found once. Nothing written.')
    union_add = EOL.join(
        ['  // material effects added 2026-08-23, replacing the costume five'] +
        ["  | '%s'" % k for k in ADD_IDS]
    ) + EOL
    out = out.replace(anchor, anchor + union_add, 1)

    # ── ADD: object entries, after the last one ──────────────────────
    m = re.search(r'^  carved_family: \{.*?^  \},' + re.escape(EOL), out, re.M | re.S)
    if not m:
        raise SystemExit('REFUSED: object anchor carved_family not found. Nothing written.')
    block = NEW_ENTRIES.replace('\r\n', EOL) + EOL
    out = out[:m.end()] + block + out[m.end():]
    for k in ADD_IDS:
        print('  added     %s' % k)

    # ── POST-WRITE ───────────────────────────────────────────────────
    after_keys = re.findall(r'^  ([a-z_0-9]+): \{', out, re.M)
    expected = len(before_keys) - len(REMOVE) + len(ADD_IDS)
    if len(after_keys) != expected:
        raise SystemExit('REFUSED: %d effects, expected %d. Nothing written.' % (
            len(after_keys), expected))
    if len(set(after_keys)) != len(after_keys):
        raise SystemExit('REFUSED: duplicate effect key. Nothing written.')
    for k in REMOVE:
        if k in after_keys or ("  | '%s'" % k) in out:
            raise SystemExit('REFUSED: "%s" survived removal. Nothing written.' % k)
    for k in ADD_IDS:
        if k not in after_keys or out.count("  | '%s'" % k) != 1:
            raise SystemExit('REFUSED: "%s" not added cleanly. Nothing written.' % k)
    if EOL == '\r\n' and re.search(r'(?<!\r)\n', out):
        raise SystemExit('REFUSED: bare LF introduced into a CRLF file. Nothing written.')

    print('')
    print('  %d effects -> %d, %+d bytes' % (
        len(before_keys), len(after_keys), len(out) - before_len))

    if not write:
        print('')
        print('  DRY RUN. Nothing written. Re-run with --write.')
        return

    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)

    print('')
    print('  WRITTEN. %s is now %d bytes.' % (PATH, len(out)))
    print('  Run: npx tsc --noEmit 2>&1 | findstr /C:"groups"')


if __name__ == '__main__':
    main()
