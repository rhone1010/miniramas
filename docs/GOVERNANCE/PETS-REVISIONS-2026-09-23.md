# Pets revisions — 2026-09-23

Authority: `lib/v1/pets/pets-catalog-35.ts`, imported directly by Pets generator, generate route and Foyer renderer. The supplied `pets-catalog-35-revised-2026-09-23.ts` was copied verbatim. No new catalog/staging variant was created.

Seven body/avoid definitions changed: mosaic_portrait, oil_impasto, pencil_sketch, plushy, porcelain, quilted, watercolour. Stained Glass prompt unchanged by explicit approval. Other 28 definitions unchanged. IDs, labels and ordering unchanged.

| Approved source | Canonical destination | Dimensions | SHA-256 |
|---|---|---|---|
| H:/pets_september_revisions/pets_impasto_revised.jpeg | public/previews/pets/pets_oil_impasto.jpg | 848×1264 | 307b0edb5296e771a9fadf4ebbb65f553f4327cb8a5a39931e682e5cf1f4bff0 |
| H:/pets_september_revisions/pets_mosaic_revised.jpeg | public/previews/pets/pets_mosaic_portrait.jpg | 848×1264 | eab85ec70d62d247d1ccc5e3de507c653f9154386da7957460b1d6a76f1c057a |
| H:/pets_september_revisions/pets_pencil_revised.jpeg | public/previews/pets/pets_pencil_sketch.jpg | 848×1264 | 834b93b100a6d20049c36fedc90927e53885b4db1ad3bb394c924152a951f435 |
| H:/pets_september_revisions/pets_plushy_revised.jpeg | public/previews/pets/pets_plushy.jpg | 848×1264 | 692bec72599ce39298427ab9cca6d5bf61c06d6f3d784d1517b7657499d8a5ab |
| H:/pets_september_revisions/pets_porcelain_revised.jpeg | public/previews/pets/pets_porcelain.jpg | 848×1264 | 16144ab865a868efdaab54772bd86d5cf5108bbff3a16475fda2432ff3f1f7e9 |
| H:/pets_september_revisions/pets_quilted_revised.jpeg | public/previews/pets/pets_quilted.jpg | 848×1264 | 79bb0f38c0b92e1f022e6d5918515d5f5c8092814193d33f8e002bd3d1e918a8 |
| H:/pets_september_revisions/pets_stained_glas_revised.jpeg | public/previews/pets/pets_stained_glass.jpg | 848×1264 | 12cbcc875d1958267e67eb19d6ee50f173019261e03175fa17d0e84a1281e240 |
| H:/pets_september_revisions/pets_watercolor_revised.jpeg | public/previews/pets/pets_watercolour.jpg | 848×1264 | b8c81719753d3f0146e6fc2adff9b9bada082ce57c9ed3e49a4e7bb805bed71f |

JPEG files copied byte-for-byte; no re-encoding or generation. All eight fully decoded.

## Consumers

- Foyer `pets-foyer-DATA.js` IMG resolves the shared canonical asset. Revised assigned slots: flip_12 Mosaic, flip_14 Impasto Oil, flip_15 Pencil Sketch, flip_17 Plushy, flip_19 Porcelain, flip_20 Quilted, flip_27 Stained Glass. Watercolour is not assigned to the approved 26 slots.
- Foyer desktop fan remains sea_glass/origami/sheet_music/neon/designer_vinyl/persian_court: none is part of this replacement. Mobile extra slot flip_17 now uses revised Plushy. No assignments changed.
- Real reveal uses customer source + authoritative prompt, not a canned preview JPEG. No new generations submitted for this revision test.
- Curated, Discovery rooms, expanded map and Review use previewUrlFor → Pets registry plateFor → same canonical asset. No independent replacement copies or _revised runtime URLs.
- Made by Hand contains Plushy, Mosaic, Stained Glass, Porcelain, Quilted. Painted contains Pencil Sketch, Impasto Oil, Watercolour.

## Existing separate copies (unchanged)

- `lib/v1/pets/pets-catalog-35.next.ts`: old non-runtime staging copy, no imports found. Not synchronized; runtime authority remains the plain filename.
- `lib/v1/wallpapers/pets-catalog-compat.ts`: intentional isolated compatibility snapshot; untouched.
- `public/previews/wallpapers/pets/`: existing separate seven artwork filenames (all revised IDs except Mosaic); untouched outside Pets workflow.
- `public/previews/home/splash/pets/pets_quilted.jpg` and `public/previews/home/splash/tall/pets/pets_quilted.jpg`: older home-splash copies; not used by current Pets Foyer/Discovery.
- Another checkout is not edited or synchronized.

## Verification

191 targeted Pets/Foyer/Portraits/Wallpapers tests passed. Exact source/destination JPEG hashes verified; all dimensions 848×1264. All eight actual Foyer prompt resolutions match the authoritative body + optional newline + avoid; the production Pets generator imports that same catalog and uses the same expression. No changes to Portraits, Wallpapers, Foyer presentation, Discovery workflow or source photographs. Preview build and browser verification follow the commit.
