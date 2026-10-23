Gift Shop approved square preview mapping — 2026-10-22

Ownership boundary
All new images live under public/gift-wizard/effect-previews/ exclusively.
No existing Portraits, Pets, or Groups assets, registries, switching code,
shared Product Studio components, or backend files are changed.
Codex 1 owns the wizard.next.ts/js consumer integration separately.

Interface
Fetch /gift-wizard/effect-previews/index.next.json.
Shape: {version:1, portraits:{base,effects}, pets:{base,effects}}.
Retains existing manifest entries: effects[id].man, .woman, .neutral, .all.
Resolve the existing selection rule's filename with base + id + '/' + filename.
Portraits: 59 effects, both man/woman; seven existing female-ID aliases.
Pets: 36 effects, neutral filename per effect.
Groups is deliberately absent: retain the existing Groups resolver unchanged.
Never replace /previews/effects-manifest.json or /previews/pets/ mappings.

Provenance and checks
Portrait source: staging/portrait-square-2026-10-22 (7ffe79ee).
Pets source: staging/pets-square-2026-10-22 (d1588ff6).
node tools/gift-preview-assets/stage.cjs copies approved bytes unchanged.
node tools/gift-preview-assets/verify.cjs verifies all 161 files by SHA-256,
native 1024x1024 dimensions, and zero original-series diff against e804892.
No crop, resize, generation, or customer UI markup was authored or ported.

Actual browser verification before commit
Original series served from this isolated worktree at localhost:4321.
Integrated Gift consumer served from Codex 1's checkout at localhost:4231,
using a copy of this namespace and its separately owned wizard changes.
Gift layout-review fixture only; no upload, generation, payment, or order.
- Portraits Gift fixtureSubject=man and woman loaded respective new square
  images through /gift-wizard/effect-previews/portraits/.
- Pets Gift fixture loaded new square images through the separate Pets base.
- Gift Groups fixture retained /previews/groups/ and original 500px images.
- Original Portrait Discovery toggled Men to Women at desktop and 390px;
  rendered URLs stayed /previews/effects/<id>/man.jpg and woman.jpg.
- Original Pets rendered existing photographs through /previews/pets/ at
  desktop and 390px; no Gift asset references were introduced.
- Gift Portraits/Pets checked at 390px; loaded native 1024px images.
  Gift mobile document width 375px within the 390px viewport.
Screenshots: artifacts/gift-only-preview-mappings/ (local browser evidence).

Remaining integration limit
Codex 1 reports live Gift SourceView lacks the analyzed subject field.
Both variants are verified using existing review-mode fixtureSubject data.
This does not establish automatic subject selection for a live upload.
Backend/source contract changes remain with their owner; no guessing from
photographs and no second selection system is introduced here.
No deployment performed.
