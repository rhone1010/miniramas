# Foyer category asset contract — staged, 2026-09-21

Production is unchanged. These manifests are asset-slot inventories, not activated
customer routes. No artwork, source upload, generated result or successful intake
is simulated. Rich supplies every new image and its approved effect/caption mapping.

## Reference

Measured from the working tree on 2026-09-21:

- `public/foyer.html`: 1,219 newline-terminated lines; existing Portraits engine.
- `public/foyer-DATA.js`: 36 newline-terminated lines; 26 active transformation IDs.
- `public/foyer-handoff.js`: 125 newline-terminated lines; one-photo Portraits handoff.

The current Portraits default plates are all 800 × 1192 JPEG (100:149).
The male plates are all 848 × 1264 JPEG (53:79). Neither set is changed.
The reference card uses `--ar: .69` with existing cover positioning, so the image
file ratio and displayed card ratio are deliberately not identical.

## New slots

Each new category has 26 transformation slots matching the current reference
deck, plus one reference-source slot: 27 files for one complete example set.
The source slot records the common original used to prepare the transformations;
it is not a replacement for a customer's upload and is not a generated result.
If only the current animation's artwork is supplied, the 26 transformation files
are the runtime artwork requirement; no additional fan/grid images are needed.

Use 800 × 1192 JPEG for this initial set, matching the reference default plates.
Keep the same source identity across transformations. Do not crop away group
members or pet features to imitate a single-person portrait. Reference-source
photos may retain their original dimensions; they are not forced into this ratio.

| Category | Directory | Staged manifest |
| --- | --- | --- |
| Pets | `public/foyers/pets/` | `manifest.next.json` |
| Groups | `public/foyers/groups/` | `manifest.next.json` |
| Halloween | `public/foyers/halloween/` | `manifest.next.json` |

Each directory reserves:

- `source.jpg` — reference source only.
- `flip_01.jpg` through `flip_17.jpg`, then `flip_19.jpg` through `flip_27.jpg`.

There is intentionally no `flip_18`: retaining the reference's existing IDs avoids
renumbering its timing/order/fan mapping. The fan reuses 23, 26, 24, 13, 06 and 16;
the mobile extra slots reuse 17 and 11. These are positions, not chosen effects.
Rich determines the artwork/effect occupying each position.

## Manifest contract

`schemaVersion`, `category`, `status`, `reference` and `workflow` identify the set.
`referenceSource` is explicitly reference-only. `imageSpec` describes transformation
files. Each `transformations` entry records `id`, relative `path`, `available`,
`effectId` and `caption`. `fan` and `mobileExtra` reference those same IDs.

All new slots currently have `available: false`; effect IDs and captions are null.
A path is an expected delivery location, not a claim the asset exists. No loader
may fall back to Portraits artwork or interpret a missing asset as a real reveal.

## Intake and handoff boundary to resolve before activation

Portraits currently uploads one photo, calls the Portraits-specific Foyer intake
and reveal APIs, and passes the validated photo to Discovery using `LitenHandoff`.
The new categories do not currently consume this handoff.

- Pets uses its existing pet-specific analysis/generation path.
- Groups accepts up to 14 uploaded photographs and uses `source_images_b64`;
  a single-photo Portraits adapter must not silently replace that contract.
- Halloween uses its existing human-photo analysis and Halloween generation path.

No new adapter, API change, synthetic intake verdict or generated result is part
of these manifests. Route activation and demo-only versus real-reveal behavior
remain pending Rich's scope clarification.

## Re-entry

No remembered-view redirect was found in the current Portraits Foyer or middleware.
Category links currently target the existing workflows directly. Future entry
routing must always load the Foyer independently of cookies/localStorage, while
keeping workflow continuation distinct so it does not loop back into the Foyer.
Existing authentication/resume/checkout return behavior must remain untouched.
