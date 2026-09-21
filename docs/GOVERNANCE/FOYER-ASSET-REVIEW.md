# Foyer asset review — 2026-09-21

## Open on Vercel Preview only

`/api/v1/foyer/asset-preview?category=pets`

The same isolated reviewer accepts `groups` and `halloween`. It returns 404 unless
`VERCEL_ENV` is exactly `preview`; no category customer route is changed.

Drop Rich's finished files into `public/foyers/pets/`, retaining the reserved
filenames in `manifest.next.json`, and include them in the next Preview checkpoint.
Vercel deployments are immutable: copying files locally does not update an already
deployed Preview. No local application server/build is needed or authorized.

The existing manifests and `FOYER-CATEGORY-ASSETS.md` remain byte-for-byte unchanged.
The reviewer probes actual files, not the staged `available: false` metadata.
It requires readable `source.jpg` and all 26 readable 800×1192 transformation files.
Missing, undecodable, timed-out or incorrectly sized slots are listed by filename;
inspection remains blocked. No placeholder artwork or fallback image is supplied.

Once all 27 files pass:

1. Select a supplied transformation filename for the reveal card.
2. Click **Inspect Foyer**.
3. Use the reference's photo control. It displays `source.jpg`; it does not open
   customer intake or upload a file.
4. The reference riffles all 26 frames once, then flips to the selected asset,
   holds it and opens the desktop fan/mobile grid.
5. **Come Inside & Explore** returns to review controls, not a customer workflow.
   **Reload assets / restart** resets the review; it does not remember completion.

The explicit result selection is reviewer tooling, not a new customer behavior.
Result arrival is scheduled after one deck pass (600 + 26×300 = 8400ms). Actual
Portraits generation still supplies its own result timing; it is not changed.
The review never requests a generation, writes an intake verdict, alters an
allowance or writes a customer handoff. Its CSP blocks fetch/XHR connections.

## Reference fidelity report

Measured 2026-09-21. Source: `public/foyer.html`, 1219 newline-terminated lines.
Destination: the Pets HTML response assembled by `lib/foyer/asset-preview.ts`
at the route above (891 lines as generated in this checkpoint).

| Source lines | Response lines | Lines in / out | Content |
| --- | --- | --- | --- |
| 1–420 | 1–420 | 420 / 420 | Entire reference head, CSS and body markup before scripts |
| 424–508 | 492–576 | 85 / 85 | Reference initialization, fan and extra-slot definitions |
| 517–674 | 578–735 | 158 / 158 | Timing, opening, source, riffle and reveal seam |
| 975–1113 | 737–875 | 139 / 139 | Flip, hold, desktop fan and mobile grid |

All four blocks are copied byte-for-byte at response assembly, not recreated.
The image resolver (source 509–516, 8 lines) becomes one line pointing only to the
selected category's reserved files. This is the authorized category asset wiring.
Customer intake/reveal/status, cookie, fitting/upload and handoff scripts are not
included. Review controls and the supplied-source/result adapter replace those
connections only, as authorized for asset-slot inspection. No customer route,
reference stylesheet, animation function or timing constant is edited.

## Verification

Automated tests cover the Production/development 404 gate, category allowlist,
no API/handoff execution, exact reference blocks, exact 26-slot ordering,
missing-file refusal and category-only asset requests. DOM/timer tests execute
the desktop fan and mobile grid through the selected supplied result.
Those synthetic image-load tests validate wiring, not real Pets artwork.
Rendered Pets animation acceptance awaits Rich's actual files.
