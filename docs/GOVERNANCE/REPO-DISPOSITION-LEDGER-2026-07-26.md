# REPO DISPOSITION LEDGER — 2026-07-26

Every folder in `D:\minramas` classified. 237 folders, 1,600 files, 831.3 MB.
Source: `_INDEX.txt` / `Minramas_Direcory_FIles.xlsx`, 2026-07-26.

**Shared ledger.** Rich and the other Claude both work from this file. Anything moved
gets ticked here. Two agents moving files with no shared record is how drift starts.

**Scope rule (Rich, #2):** in scope = Portraits · Pets · Groups · Action · Mobile Wallpapers.
Everything else archives.

**Destinations**
- `D:\_minramas-archive-2026-07-26\` — out of scope, may return
- `D:\_minramas-assets\` — large source/test material, belongs outside a code repo
- `D:\_minramas-marketing\` — preview matrix
- deleted outright — junk only

---

## 0 · TWO CORRECTIONS TO MY EARLIER ADVICE

**0.1 — `lib\bench\` is NOT archivable. I was wrong.**
Rule #4 said archive anything labelled Bench. But `portraits-generate-route.ts` imports
`@/lib/bench/bench-gates`. Archiving `lib\bench\` breaks the portraits generate route at
build time. Everything *else* bench-named is archivable — `bench-sources\`, `bench-configs\`,
`bench-reports\`, `LitenBench\`. Only `lib\bench\` stays.

**0.2 — `public\actionmini - Copy.html` comes off the delete list.**
I called it junk on filename alone. You then sent it as a working reference. Status unknown
until you say. Not moving.

---

## 1 · MOVE OUT OF REPO — SOURCE & TEST MATERIAL · 649 MB

None of this is product. It's generator input and bench fixtures. → `D:\_minramas-assets\`

| Folder | Files | MB |
|---|---:|---:|
| `bench-sources\calibration` | 108 | 262.78 |
| `source-pool` | 105 | 147.46 |
| `portrait-batch` | 61 | 99.16 |
| `pet-source-pool` | 41 | 60.75 |
| `preview-sources` | 25 | 33.29 |
| `preview-sources\picked` | 12 | 16.67 |
| `source-pool-multiface` | 11 | 16.48 |
| `bench-sources\smoke` | 12 | 7.14 |
| `multiface-pilot-out` | 44 | 5.27 |
| `LitenBench\sources` | 20 | 3.78 |
| `LitenBench\jobs` + root | 8 | 0.33 |
| `bench-configs`, `bench-reports` | 8 | 0.01 |

**649.1 MB — 78% of the repo.** The scripts that generated these live in `scripts\`;
keep those, they can rebuild any of it.

## 2 · MOVE OUT — MARKETING · 19.0 MB (Rich #11)

`preview-matrix\` + 13 effect subfolders (alabaster, bronze, charcoal_chalk, ebony,
folded_book, impressionist, iron, pencil_sketch, plushy, sheet_music, stone, torn_paper,
walnut) — 12 files each, 2026-06-13. → `D:\_minramas-marketing\`

## 3 · DELETE · ~40 MB

| Path | MB | Why |
|---|---:|---|
| `stripe.exe` | 26.9 | → `D:\tools\`, not deleted. Needed Aug 15. |
| `_scratch\` (5 files) | 8.60 | filelistasd.txt 7.36 MB, structure.txt 1.39 MB |
| `.html` (root) | 2.38 | malformed redirect, same minute as `build_printshop_r17.py` |
| `tsconfig.tsbuildinfo` | 1.42 | build artifact → gitignore |
| `lib_dump\` (10 files) | 0.06 | March 2026 txt dumps (Rich #5) |
| `_route_upload\` (38) | 0.18 | stale route copies — 321 vs live 603 lines (Rich #6) |
| `_route-collection\` (9) | 0.06 | near-miss copies — 611 vs live 603 |
| `supabase\.temp\` (9) | 0.00 | CLI cache → gitignore |
| `_INVENTORY.csv`, `_IGNORED.txt`, `_UNTRACKED.txt`, `_DEAD-REFS.csv` | — | session scratch |

## 4 · ARCHIVE — OUT OF SCOPE SERIES (Rich #2)

Order matters. Surfaces first, then routes, then lib. Reversing it breaks the build.

**Step 1 — surfaces (safe, nothing imports them):**
`public\houses.html` · `public\landscapes.html` · `public\interiors.html` ·
`public\sportsmem.html` · `public\print-config.html` · `public\test.html` ·
`public\groups-testbench.html` · `public\liten-prompt-bench-v3.html` ·
`public\portraits-proto.html` · `public\index.html` · `homepage-light.html`

**Step 2 — routes:**
`app\api\v1\houses\*` (3) · `landscapes\*` (3) · `sportsmem\*` (2) · `stadium\generate` ·
`interior\generate` · `moments\analyze` · `structures\generate` · `global\analyze`

**Step 3 — lib (only after steps 1–2):**
`lib\v1\houses` (11) · `lib\v1\landscapes` (8) · `lib\v1\sportsmem` (2) ·
`lib\v1\stadium` (1) · `lib\v1\interior` (1) · `lib\v1\action\Old` (3)

Verified: none of these are imported by any portraits / pets / groups / actionmini route.
They import each other and their own routes only.

**`lib\v1\generators\` (11 files, 2026-05-07)** — abandoned/alien/explosion/fall/fire/
flood/haunted/spring/summer/winter/base. No importers found in the copies I can read.
**Confirm against the live repo before moving** — see §7.

## 5 · KEEP — LOAD-BEARING

**In-scope series lib:** `lib\v1\portraits` (12) · `lib\v1\pets` (6) · `lib\v1\groups` (12) ·
`lib\v1\action` (6, not `Old\`)

**Shared, imported by in-scope routes:** `lib\v1\_core` (7) · `lib\shared` (3) ·
**`lib\bench` (8 — see §0.1)**

**Commerce, needed Aug 15:** `lib\store` (9) · `lib\bundles` (2) · `lib\v1\print` (5) ·
`components\print` (6) · `app\api\v1\print\*` · `app\api\v1\checkout\*` ·
`app\api\v1\webhooks\stripe` · `supabase\migrations` (9)

**In-scope routes:** portraits (9) · pets (2) · groups (4) · actionmini (2) ·
portrait-wallpaper (2) · credits (4) · auth (2) · qa\settings

**Product assets:** `public\Icons` (27) · `public\textures` (12) · `public\backgrounds` (10) ·
`public\homepage` + `hero` (47) · `public\print` (11) · `public\rewards-insets` (8) ·
`public\style-refs\portraits\*` (13 folders) · `public\assets\*` · `public\js`

**Governance:** `AGENTS.md` · `CLAUDE.md` · `CLAW-STATUS.md` ·
`litenco-asset-manifest-2026-07-07.md` · `scripts\` (19) · toolchain configs

## 6 · PREVIEWS — DO NOT TOUCH YET (Rich #12) ⚠️

`previews\_flat` and `public\previews\_flat` are byte-identical: 96 files, same names,
same sizes, all 2026-07-06.

But the trees diverge above that:

| | portraits | pets |
|---|---|---|
| `previews\` (root) | 24 effects × 4 | **21 effects × 1** |
| `public\previews\` | 24 effects × 4 | **absent** |

Root `previews\` 404s in Next — only `public\previews\` is served. **Every pet preview is
currently unservable, and Pets ships Aug 1.** Answer to "which is accurate": root is the
master, `public\` is the deploy copy, and the deploy copy is incomplete. Keep both, sync
pets across, then revisit.

Also in `public\previews\` root: 11 files named `printshop-images-_0000_Layer 3.jpg` …
`_0010_Layer 13.jpg`. Photoshop layer exports, Print Shop assets, wrong folder, and they
violate the taxonomy-ID naming rule.

## 7 · FLAGGED — NEEDS A DECISION

1. **`payload\` (6) · `directives\` (3) · `Prototype Files\` (6)** — Rich #3, preference is
   throw out. Hard condition: `AGENTS.md` §4 reads *"Canonical map lives in
   `directives/LIVE-FILE-LEDGER.md`. Read it before touching any file."* If `directives\`
   goes, §4 must be rewritten in the same commit or the one governance file that finally
   loads points at nothing.
2. **`components\print` (6, May 15)** — React: AddressForm, PriceSummary, PrintOrderCard,
   PrintSheet, SizePicker, types. But canonical Print Shop is
   `litenco-printshop-2026-07-24-r28.html`, standalone. Is Print Shop React or HTML?
3. **`lib\v1\generators\`** — no importers in readable copies. Verify live:
   `Select-String -Path app,lib,components -Include *.ts,*.tsx -Recurse -Pattern "v1/generators"`
4. **`public\face-api-models\`** (3 files, 5.38 MB) — is face-api still in the pipeline?
5. **`app\admin\`** (4) + **`app\store\`** (7) — all 2026-05-06, predate credits architecture.
6. **`_flat` duplicate** — 13.52 MB twice. Check what references `_flat` before dropping either.
7. **`public\actionmini - Copy.html`** — see §0.2.
8. **`archive\`** (25 files, 3.08 MB) — already correct, left alone.

## 8 · RESULT

| | MB |
|---|---:|
| Now | 831.3 |
| Out to `_minramas-assets` | −649.1 |
| Out to `_minramas-marketing` | −19.0 |
| Deleted / relocated junk | −39.4 |
| **Repo after** | **~124** |

Of which roughly 60 MB is product imagery and ~5 MB is code.
