# Pets Discovery port record

Date: 2026-09-22. Source: accepted live Discovery; destination: Pets. No Portraits file changed.

Source `public\discovery-consolidated-draft.html`: 10265 lines. Destination `public\pets.html`: 9754 lines.

## Unchanged port blocks

| Source lines | Destination lines | Lines in / out |
|---|---|---|
| 1–3005 | 1–3005 | 3005 / 3005 |
| 3007–3295 | 3007–3295 | 289 / 289 |
| 3298–3298 | 3298–3298 | 1 / 1 |
| 3305–3305 | 3303–3303 | 1 / 1 |
| 3308–3308 | 3305–3305 | 1 / 1 |
| 3315–3315 | 3310–3310 | 1 / 1 |
| 3320–3321 | 3349–3350 | 2 / 2 |
| 3325–3326 | 3355–3356 | 2 / 2 |
| 3330–3331 | 3361–3362 | 2 / 2 |
| 3335–3336 | 3367–3368 | 2 / 2 |
| 3340–3341 | 3373–3374 | 2 / 2 |
| 3360–3365 | 3379–3384 | 6 / 6 |
| 3372–3375 | 3555–3558 | 4 / 4 |
| 3392–3395 | 3561–3564 | 4 / 4 |
| 3402–3403 | 3567–3568 | 2 / 2 |
| 3412–3413 | 3573–3574 | 2 / 2 |
| 3422–3423 | 3579–3580 | 2 / 2 |
| 3432–3433 | 3585–3586 | 2 / 2 |
| 3606–3609 | 3591–3594 | 4 / 4 |
| 4041–4041 | 3597–3597 | 1 / 1 |
| 4043–4044 | 3600–3601 | 2 / 2 |
| 4045–4054 | 3609–3618 | 10 / 10 |
| 4075–4076 | 3628–3629 | 2 / 2 |
| 4086–4087 | 3639–3640 | 2 / 2 |
| 4109–4126 | 3645–3662 | 18 / 18 |
| 4127–4127 | 3669–3669 | 1 / 1 |
| 4129–4235 | 3671–3777 | 107 / 107 |
| 4237–4262 | 3779–3804 | 26 / 26 |
| 4268–4271 | 3806–3809 | 4 / 4 |
| 4278–4369 | 3811–3902 | 92 / 92 |
| 4371–4372 | 3904–3905 | 2 / 2 |
| 4374–4453 | 3907–3986 | 80 / 80 |
| 4456–4458 | 3989–3991 | 3 / 3 |
| 4459–4476 | 3999–4016 | 18 / 18 |
| 4501–4572 | 4020–4091 | 72 / 72 |
| 4574–4725 | 4093–4244 | 152 / 152 |
| 4746–4821 | 4246–4321 | 76 / 76 |
| 4834–4862 | 4323–4351 | 29 / 29 |
| 4864–5156 | 4353–4645 | 293 / 293 |
| 5158–6200 | 4647–5689 | 1043 / 1043 |
| 6202–6911 | 5691–6400 | 710 / 710 |
| 6913–7790 | 6402–7279 | 878 / 878 |
| 7792–7918 | 7281–7407 | 127 / 127 |
| 7920–8240 | 7409–7729 | 321 / 321 |
| 8242–9474 | 7731–8963 | 1233 / 1233 |
| 9476–10265 | 8965–9754 | 790 / 790 |

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
