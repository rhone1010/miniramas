# CENG -> CUI · GROUPS · 19 August 2026

`docs/GOVERNANCE/`

The engine is finished. This is the contract for the glass.

> **SUPERSEDED IN PART.** Section 2 below, and the line saying there is no
> Groups analyze route, are both out of date as of the same day. That route
> now exists and returns the count, the price and the quality advisories in
> one call before checkout. Read
> `CENG-CUI-GROUPS-CORRECTION-2026-08-19.md` alongside this. Everything
> else here stands.

---

## SOURCE OF RECORD

`lib/v1/groups/groups-effects.ts` — in the repo, committed. Ids, labels,
intake, bodies, avoid clauses. **Do not read bodies from anywhere else.**
Project-knowledge copies of `.ts` files drift; ask for the live file.

**Twenty-eight effects.** Iron was cut 19 August to make the grid lay out
(three bronzes was one too many, and it is the effect that produced the
bouquet failure). Dragon Skin was shot and cut earlier the same day.

---

## THE TWENTY-EIGHT

Plate for every one is `public/previews/groups/groups_<id>.jpg` — all
lowercase, all `.jpg`, all verified present. The id IS the filename, so
the path derives and no lookup table is needed.

### Group photo — one photograph containing everybody (24)

| id | label |
|---|---|
| `bronze` | Bronze |
| `ebony` | Ebony |
| `stone` | Stone |
| `reclaimed_bronze` | Reclaimed Bronze |
| `plushy` | Plushy |
| `folded_book` | Folded Book |
| `cubism` | Cubism |
| `art_nouveau` | Art Nouveau |
| `ukiyo_e` | Ukiyo-e |
| `victorian` | Victorian |
| `elizabethan` | Elizabethan |
| `renaissance` | Renaissance |
| `persian_court` | Persian Court |
| `samurai` | Samurai |
| `wild_west` | Wild West |
| `ice` | Frost & Ice |
| `pencil_sketch` | Pencil Sketch |
| `balloon_face` | Balloon |
| `origami` | Origami |
| `porcelain` | Porcelain |
| `clockwork` | Clockwork |
| `retro_robot` | Atomic-Age Robot |
| `neon` | Neon |
| `sea_glass` | Sea Glass |

### Multi-photo composites — one photograph per person (4)

| id | label | photographs |
|---|---|---|
| `family_impressionism` | Family Impressionism | 5 |
| `family_mosaic` | The Family Mosaic | variable |
| `layered_paper` | Layered Paper | 5 |
| `carved_family` | Carved Family | variable |

`intake` is on every row in the file. It changes what the uploader asks
for: one photo, or one per person. **Family Impressionism and Layered
Paper expect five.** Sending a single group shot to a multi_photo effect
produces a piece with one face repeated.

---

## WHO OWNS WHAT

**CENG owns, and these are done:**

```
lib/v1/groups/groups-effects.ts      the catalog
lib/v1/groups/groups-shared.ts       types, scoring rule, price bands
lib/v1/groups/groups-refine.ts       vision calls
lib/v1/groups/groups-generator.ts    the pipeline
app/api/v1/groups/generate/route.ts  the endpoint
```

**CUI owns:**

```
public/groups.html                   the page. Zero fetch calls today.
app/api/v1/credits/gate/route.ts     the money path — see below
```

There is **no Groups analyze route** and none is needed. See below.

---

## 1 · THE GATE BLOCKS EVERYTHING

`app/api/v1/credits/gate/route.ts` validates `cost_per` against a flat
`CREDITS_PER_IMAGE` of 10 and refuses anything else. **Groups is banded by
subject count**, so every craft above the first band is refused today:

```
2-3 subjects    10 credits
4-6             15
7-9             25
10+             40
```

`groupsCreditCost(subjectCount)` in `groups-shared.ts` is the function.
The gate should call it rather than restating the numbers.

**This is the only thing between a finished engine and a sellable craft.**

---

## 2 · THE PAGE DOES NOT SEND THE SUBJECT COUNT

It cannot. The count drives the framing clause, the scoring bar AND the
price band, so a client that could set it could pick its own price.

The engine counts hero subjects itself, in the pre-flight vision pass that
also checks whether a face is visible at all. It excludes bystanders,
crowds and photobombers. **That number is authoritative.**

`subject_count` in the request body is a HINT. It is passed through, the
generator logs any disagreement, and it is used only if the detection call
errors outright.

**So the price is not knowable before the render starts.** If the glass
needs to show a price first, it has to call the engine to get a count and
then gate — which is a two-step flow, not one. Worth ruling with Rich
before building either.

---

## 3 · THE REQUEST

```
POST /api/v1/groups/generate
{
  source_images_b64: string[],   // one, or one per person
  effect_id:         string,
  subject_count?:    number      // hint only, see above
}
```

The older shape — `source_image_b64` plus `additional_images_b64` — is
still accepted and folded into one list.

More than 14 images is **refused, not sliced**. The old ceiling truncated
silently and the customer paid for five faces and got four.

---

## 4 · FAILING THE LIKENESS GATE IS NOT AN ERROR

**This is the part most likely to be got wrong in the glass.**

Four attempts, per-figure likeness scored on each, stop at the first pass.
If all four miss the bar, the response is **HTTP 200** with:

```
{ result: { ok: true, passed: false, image_b64: <best of four>, failure: {...} } }
```

The piece is offered alongside a refund. It is not thrown away and it is
not presented as if it passed.

**A 4xx or 5xx means the render never happened.** Do not conflate them:
one is a craft the customer may still want, the other is one they never
got.

`failure.kind` is one of `some_figures`, `most_figures`, `face_not_visible`,
`no_figures`, `render_failed`, with `failed_figures` and `reasons`. It is
**not a message** — it says what is true so the Concierge can say
something true. `some_figures` usually means a better photograph;
`most_figures` means a different effect.

`face_not_visible` fires **before any render**, so it costs nothing.

---

## 5 · TIMING

`maxDuration` is 300 seconds. Worst case is four NB2 calls, four vision
calls and one Stability outpaint. A twelve-person craft can approach it.

The glass needs to survive a two-to-four minute wait without looking
broken. There is no progress channel — the route returns once.

---

## 6 · OPEN, FOR RICH

**The age rule.** Refuse a lone minor or all minors; allow when an adult
is present. Agreed and PARKED pending legal review. Needs per-face age,
which the pre-flight pass could return but does not. **Do not build it.**

**The two-step price flow** in §2.

---

*CENG · 19 August 2026*