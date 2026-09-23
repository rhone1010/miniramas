# Pets Discovery port record

Date: 2026-09-22. Source: accepted live Discovery; destination: Pets. No Portraits file changed.

Source `public\discovery-consolidated-draft.html`: 10265 lines. Destination `public\pets.html`: 9754 lines.

## Unchanged port blocks

| Source lines | Destination lines | Lines in / out |
|---|---|---|
| 1–2991 | 1–2991 | 2991 / 2991 |
| 2992–3005 | 2998–3011 | 14 / 14 |
| 3007–3295 | 3013–3301 | 289 / 289 |
| 3298–3298 | 3304–3304 | 1 / 1 |
| 3305–3305 | 3309–3309 | 1 / 1 |
| 3308–3308 | 3311–3311 | 1 / 1 |
| 3315–3315 | 3316–3316 | 1 / 1 |
| 3320–3321 | 3355–3356 | 2 / 2 |
| 3325–3326 | 3361–3362 | 2 / 2 |
| 3330–3331 | 3367–3368 | 2 / 2 |
| 3335–3336 | 3373–3374 | 2 / 2 |
| 3340–3341 | 3379–3380 | 2 / 2 |
| 3360–3365 | 3385–3390 | 6 / 6 |
| 3372–3375 | 3561–3564 | 4 / 4 |
| 3392–3395 | 3567–3570 | 4 / 4 |
| 3402–3403 | 3573–3574 | 2 / 2 |
| 3412–3413 | 3579–3580 | 2 / 2 |
| 3422–3423 | 3585–3586 | 2 / 2 |
| 3432–3433 | 3591–3592 | 2 / 2 |
| 3606–3609 | 3597–3600 | 4 / 4 |
| 4041–4041 | 3603–3603 | 1 / 1 |
| 4043–4044 | 3606–3607 | 2 / 2 |
| 4045–4054 | 3615–3624 | 10 / 10 |
| 4075–4076 | 3634–3635 | 2 / 2 |
| 4086–4087 | 3645–3646 | 2 / 2 |
| 4109–4126 | 3651–3668 | 18 / 18 |
| 4127–4127 | 3675–3675 | 1 / 1 |
| 4129–4235 | 3677–3783 | 107 / 107 |
| 4237–4262 | 3785–3810 | 26 / 26 |
| 4268–4271 | 3812–3815 | 4 / 4 |
| 4278–4369 | 3817–3908 | 92 / 92 |
| 4371–4372 | 3910–3911 | 2 / 2 |
| 4374–4453 | 3913–3992 | 80 / 80 |
| 4456–4458 | 3995–3997 | 3 / 3 |
| 4459–4476 | 4005–4022 | 18 / 18 |
| 4501–4572 | 4026–4097 | 72 / 72 |
| 4574–4725 | 4099–4250 | 152 / 152 |
| 4746–4821 | 4252–4327 | 76 / 76 |
| 4834–4862 | 4329–4357 | 29 / 29 |
| 4864–4999 | 4359–4494 | 136 / 136 |
| 5006–5068 | 4496–4558 | 63 / 63 |
| 5071–5156 | 4560–4645 | 86 / 86 |
| 5158–5484 | 4647–4973 | 327 / 327 |
| 5485–6200 | 4978–5693 | 716 / 716 |
| 6202–6911 | 5695–6404 | 710 / 710 |
| 6913–7790 | 6406–7283 | 878 / 878 |
| 7792–7918 | 7285–7411 | 127 / 127 |
| 7920–8240 | 7413–7733 | 321 / 321 |
| 8242–9474 | 7735–8967 | 1233 / 1233 |
| 9476–10265 | 8969–9758 | 790 / 790 |

## Authorized category adaptations

- Pets catalog/registry and all 36 approved Pets preview URLs replace Portraits data; obsolete forest_guardian is absent. Prompts remain unchanged.
- Pets category identity, catalog request, session identity and checkout payload replace Portraits identity.
- Pets upload calls the existing Pets analyzer; its existing 401 sign-in guard is copied from the prior Pets implementation. Guest human face/age intake is removed from the Pets port, per explicit approval.
- Pets has no human gender variants or human age-result interpretation.
- Pets resume/photo storage is isolated; Portraits Foyer handoff is not activated for Pets.
- Existing icon assets are reused for the existing Pets rooms. No CSS or visual controls are redesigned.
- Shared portfolio dispatch/render/poll admits Pets and calls the existing Pets generator. The original Portraits request body is retained.
- Stage, Review, Shape, checkout, Collection and selection logic are otherwise retained from the source.

## Assets

All 36 JPEGs retain the SHA-256 values recorded in `lib/store/tests/fixtures/pets-approved-preview-hashes.json`. No image transformation was performed.

## Staging

The seven .next page/registry/API/render files were promoted byte-for-byte. The authoritative Pets catalog replacement remains byte-identical to the supplied revised catalog.

## Wallpapers compatibility snapshot (2026-09-22)

The authoritative replacement Pets catalog no longer contains the legacy print-tail marker required by Wallpapers. Per Rich's approval, Wallpapers alone now imports `lib/v1/wallpapers/pets-catalog-compat.ts`, an unchanged byte copy of `lib/v1/pets/pets-catalog-35.ts` from commit cd40c7651f19b6d778352eeea4f5fd8fc9e30c3e.

Source lines 1–296 → snapshot lines 1–296; identical line count and bytes. Snapshot SHA-256: 5e3fc51b9d562c62422b774b941f7b1723b903c516e6ccfac9c45d73f4585dfc. The only deviation in Wallpapers is the import path at line 48. The marker, PHONE_TAIL, derivation, labels, ordering and avoid prompts are unchanged. A regression test compares the complete derived catalog hash with the historical output (ab7b6fb00e5deb5de8a277cad3bd9dd69365998d9b4df74fe42dd3e910f074a8). This snapshot is not the active Discovery Pets catalog and must not receive the revised Pets prompts.

## Rendered acceptance corrections (2026-09-22)

Curated preview resolution now uses the same approved Pets registry URL as ordinary cards. Its candidate universe reads all 36 Pets registry IDs, instead of the inherited Portraits subset. No source JPEG or prompt changed.

Browser inspection found that two Pets rooms contain eight effects plus a title plate, while the inherited desktop two-row container holds only eight cells. Only those rooms now allocate the actual row count; row height is derived from the original two-row viewport calculation. Curated stays 4×2, existing card sizing is retained, and the correction is desktop-only. The original stylesheet remains otherwise byte-identical.
