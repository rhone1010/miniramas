# Groups ceramic-mug composition experiment, 2026-10-24: review notes

Dataset root: `E:\Dev\_recovery-staging\mug-experiment\`: `dataset-index.json` (machine-readable, all 24 cases), `cases/<count>_<effect>/` (source, raw-nb21.png, wrap-2670x1110.png, preview-front.png, preview-back.png, curvature-front.png, curvature-back.png, meta.json), `calibration/` (numbered grid and its renders), `gallery-sheets/` (contact sheets), `source-counts.json` (analyzer counts of every candidate source photograph).

## Effects used (resolved from the Groups registry, prompts untouched; `effectBodySha256` in each meta.json)
Impressionism = `impressionist` (label "Impressionist"); Mosaic = `mosaic_faces` (registry label exactly "Mosaic", a one-portrait-per-person panel effect); Action Figures = `action_figures`. NOT used: `impressionist_faces` ("Impressionist Portraits") and `family_mosaic` ("Family Mosaic"): different effects.

## Sources (genuine photographs from the project libraries; counts checked by eye and by the analyzer)
1: LitenBench portrait_2 | 2: **GAP, no two-person photograph exists** | 4: groups__02 (4 people + a dog) | 6: source_groups_12 | 8: source_groups_8 | 10: groups__08 (10 people + dogs, 506 px wide, low resolution) | 12: source_groups_6 (12 by eye, the analyzer says 11) | 16: **GAP, the largest genuine single photograph has 14 people**. Nothing was assembled or cropped to manufacture a count.

## Geometry: our preview renderer vs Prodigi
- Lab file: GLOBAL-MUG-W print area 2670 x 1110, the 38 px top and bottom design margins kept (white, verified in every file). Template faces at file columns 2069 (the face the preview photograph shows, handle right) and 598 (the other face). Seam at the file edges.
- **Our server cylindrical preview renderer** (the `ceramic-mug` scene, a mug photographed hanging from its handle, so the artwork appears turned 90 degrees on screen): measured with the numbered grid (calibration/preview-front.png and preview-back.png): each face shows file columns about **[centre-465, centre+465]: [1604, 2534] front and [133, 1063] back, a 930 px window (about 125 degrees) on a roughly linear scale**. Panels are 880 px wide so a whole composition sits inside the window with about 25 px to spare each side.
- The new display-only beauty mug (browser) uses the cylindrical mapping in its manifest (centerX 0.5, radiusX 0.5): +-90 degrees = 1335 px with cos compression; it is not rendered server-side. `curvature-*.png` is a DIAGNOSTIC of that geometry (orthographic cylinder), not a renderer.
- **Not Prodigi specifications**: Prodigi publishes no handle-clearance or edge-loss figure for GLOBAL-MUG-W; none was assumed. The windows above are ours.

## Strategies as built
- 1-5 people, two-sided: one 1:1 composition (880 px square), the SAME pixels placed on both faces (2069 and 598); between them and around the seam each row fades smoothly from the previous panel's edge colour to the next panel's (deterministic, nothing regenerated or repeated); above and below, each column continues from the panel's edge row. Panel edges blend over 40 px.
- 6-16 people, full wrap: one composition in the primary face (2069): 1:1 for 6 and 8 (allowed by the Groups formats), 4:3 for 10 and 12 (the Groups route allows only 4:3, 3:2, 16:9 at 10+). The rest of the wrap is the same edge-colour continuation: no person is duplicated.

## Case notes (visual review; nothing discarded; `analyzer` = vision count of the raw composition, `scored` = figures the route's own quality gate scored)
| Case | Result |
|---|---|
| 1 impressionist | passed; one person, recognisable; two identical faces; good |
| 1 action_figures | below the quality bar (one top-tier score under 9, retained); one figure, likeness fine |
| 1 mosaic | **not generated: the route refuses "Faces effects require 2-9 subjects" (HTTP 500, 3 attempts, no model call)** |
| 2 (all three) | **GAP, no source** |
| 4 impressionist / action_figures / mosaic | 4 people each (plus the dog in the first two); analyzer 4/4; mosaic is a 2x2 portrait grid; action_figures and mosaic below the bar (retained); faces recognisable; two-sided reads well |
| 6 impressionist / mosaic | passed, 6/6; mosaic is a 3x2 portrait grid |
| 6 action_figures | 6/6, below the bar (retained): six figures on one base, readable on the face |
| 8 action_figures / mosaic | passed, 8/8 (the mosaic is 4x2) |
| 8 impressionist | **analyzer 7/8 and the route scored 7: the rightmost woman is cut by the frame**; below the bar, retained |
| 10 impressionist | analyzer 9 (the route scored 10); below the bar; dense, faces small |
| 10 action_figures | **analyzer 8/10, the route scored 8: two people missing**, plus two dogs; below the bar |
| 10 mosaic | **9 panels (3x3) for 10 people: one missing**; it ran only because the detector counted 9; below the bar |
| 12 action_figures | analyzer 12 but the route scored 10; below the bar (3 top-tier under 9); small figures on stairs |
| 12 impressionist | **analyzer 11/12**; below the bar |
| 12 mosaic | **not generated: "Faces effects require 2-9 subjects"** |
| 16 (all three) | **GAP, no source** |

## Findings
1. Counts up to 8 are reliable (the analyzer matches in 8 of the 9 generated cases up to 8). From 10 up every effect lost or merged at least one person (9/10, 8/10, 9/10, 11/12), and the Mosaic panel effect cannot do more than 9 at all.
2. Square compositions (1:1) fill the roughly square primary window well. The 4:3 compositions forced by the Groups formats at 10+ leave about 180 px above and below that must be continued, and the continuation shows vertical streaks (visible in the 10 and 12 cases). A paid outpaint or a taller composition would be needed; not tried.
3. The continuation between faces and around the seam is smooth but is only a colour gradient, not scenery: clean but featureless. Whether that is acceptable is a design call.
4. The back preview of a full-wrap case shows only scenery (by design: no duplicated people); for the two-sided cases the back shows the second copy.
5. Every final wrap keeps the 38 px white margins, and both previews are built from the one wrap file (`wrapSha256` in meta.json). The raw composition is never altered after generation.
6. Cost: 16 route calls, 27 internal NB2.1 attempts, about 226 cents by the application's own cost model (NB2 5c + score 1c per attempt + about 4c gates per call). No invoice or Replicate price exists in this codebase, so this is an estimate, not the actual charge. The two Mosaic refusals made no model call.
