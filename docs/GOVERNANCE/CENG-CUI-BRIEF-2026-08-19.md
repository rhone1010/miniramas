# CENG -> CUI · WHAT THE GLASS OWES · 19 August 2026

`docs/GOVERNANCE/`

New CUI session. This is the complete list of what is waiting on the glass,
in the order that unblocks revenue.

Read these three first, in this order. They carry the reasoning; this carries
the work.

```
docs/GOVERNANCE/FILE-PLACEMENT.md                     how files move. Read before touching anything.
docs/GOVERNANCE/CENG-CUI-GROUPS-2026-08-19.md         the Groups contract
docs/GOVERNANCE/CENG-CUI-GROUPS-CORRECTION-2026-08-19.md   corrects section 2 of the above
```

**Lanes.** CENG owns `lib/v1/**` and the engine-side routes under
`app/api/v1/{groups,wallpapers}/`. CUI owns `public/*.html` and the commerce
path. Two Claudes have been committing to this tree today; staying inside
those lines is what stops us colliding.

---

## 1 · THE CREDIT GATE — BLOCKS ALL GROUPS REVENUE

`app/api/v1/credits/gate/route.ts`

It validates `cost_per` against a flat `CREDITS_PER_IMAGE` of 10 and refuses
anything else. **Groups is banded by subject count**, so every craft above the
smallest band is refused today. The engine is finished and unsellable until
this changes.

```
2-3 subjects    10 credits
4-6             15
7-9             25
10+             40
```

`groupsCreditCost(subjectCount)` in `lib/v1/groups/groups-shared.ts` is the
function. **Call it — do not restate the numbers.** Two copies of a price
table is how they drift.

The gate's existing discipline stands and is right: `cost_per` is read from
the client and never trusted. Keep that. The change is that the server's own
figure comes from the function rather than from a constant.

**Also:** the gate mints `ref_id` and returns it. That value now has to reach
`/api/v1/groups/generate` in the request body — without it the free-retry
token cannot be written, because an unnameable free render is one nothing can
reconcile.

---

## 2 · `public/groups.html` — ZERO FETCH CALLS TODAY

The page exists as a mockup. Nothing in it reaches the engine.

### The flow

```
analyze  ->  show price + advisories  ->  gate  ->  generate
```

**`POST /api/v1/groups/analyze`** — `{ source_images_b64: string[] }`

Returns `subject_count`, `credit_cost`, `verdict`, `advisories[]`,
`smallest_face_min_dim_px`, `face_thresholds`, `per_photo`, `photo_count`,
`nothing_to_craft`.

**`POST /api/v1/groups/generate`** — `{ source_images_b64, effect_id, ref_id }`

`subject_count` may be sent but is a hint only; the engine counts again and
its number wins. The count sets the price, so a client that could set it
could pick its own.

### The 28 effects

`lib/v1/groups/groups-effects.ts` is the source of record. Ids, labels,
`intake`. Plates are at `public/previews/groups/groups_<id>.jpg` — the id IS
the filename, so the path derives and no lookup table is needed.

`intake` changes what the uploader asks for:

```
group_photo   one photograph containing everybody          24 effects
multi_photo   one photograph per person                     4 effects
```

**Family Impressionism and Layered Paper expect five photographs.** Sending a
single group shot to a `multi_photo` effect produces a piece with one face
repeated.

### Two near-neighbours

Bronze and Reclaimed Bronze are the same object in brown and green.
Driftwood-adjacent effects likewise. **Do not sit them adjacent in the grid.**

---

## 3 · QUALITY ADVISORIES WARN. THEY DO NOT DECLINE.

This reverses an earlier resolution gate, so it is easy to get wrong.

Rich's ruling, carried from Portraits: **a sharp 600px photograph renders
better than a blurry 2000px one.** Pixel dimensions are the wrong thing to
refuse on, and the hard resolution banner in Portraits was retired for exactly
that reason.

The real safety net is downstream and already built — four attempts, a
per-figure likeness gate, and a refund offered when it still misses. That
catches what a px threshold would only have guessed at, and it costs a render
rather than a sale.

**So every advisory is something to say, never a reason to disable the
button.**

```
faces_small        smallest face under 80px   likeness will probably soften
faces_smallish     under 140px                likeness may soften
soft_focus         names a photo by position
poor_light         names a photo by position
```

`detail` names the photograph — "photo 3" — because *one of your five is soft*
is actionable and *your photos are soft* is not.

**Read the thresholds from `face_thresholds` in the response.** Two sets
existed in the repo and disagreed; they now live in one place.

### The single stop

`nothing_to_craft: true` — no usable face found anywhere. Not a quality
verdict, an absence. Nothing to craft and no render fixes it. This is the only
state that should block.

---

## 4 · FAILING THE LIKENESS GATE IS HTTP 200

**The most likely thing to be got wrong, and the most expensive.**

Four attempts, per-figure likeness scored on each, stopping at the first pass.
If all four miss:

```json
{ "result": { "ok": true, "passed": false, "image_b64": "...", "failure": { ... } },
  "credit_cost": 15,
  "retry": { "available": true, "change": "add_photograph" } }
```

**There is a finished piece in that response.** It is not an error. A 4xx or
5xx means the render never happened — one is a craft the customer may still
want, the other is one they never got. If the glass conflates them, customers
lose pieces they paid for.

`failure.kind` is one of `some_figures`, `most_figures`, `face_not_visible`,
`no_figures`, `render_failed`, with `failed_figures` and `reasons`.

**It is not a message.** It says what is true so the Curator can say something
true. `some_figures` usually means a better photograph; `most_figures` means a
different effect.

### Never argue likeness

From the flow contract. The engine knows figure 4 scored 6/10. **The glass
must never show a number, never rank the people in the photograph, and never
imply someone's face was the problem.** Refer to position in frame — "the one
at the back" — never to who the person is.

Draft Curator copy for all of this is in
`docs/GOVERNANCE/CURATOR-GROUPS-FAILURE-DRAFT.md`. **Not locked** — Rich
rewrites it. Do not ship those words without his sign-off.

---

## 5 · THE FREE RETRY

When the gate is missed, the response carries `retry`.

```
change: "add_photograph"   they must add at least one more source
change: "change_effect"    they must pick a different effect
```

**`POST /api/v1/groups/retry`** — `{ ref_id, effect_id, source_count }`

Called **instead of the credit gate**, not after it. `ok: true` means the
craft proceeds free. `ok: false` means fall through to a normal paid craft.

The database proves the inputs actually changed; the browser is not trusted
with that. Refusal reasons are deliberately distinct and are four different
sentences:

```
no_new_photograph   they took the offer but changed nothing
same_effect         same
already_redeemed    they have used their one retry
expired             fourteen days passed
```

### Keep or refund is EXCLUSIVE

Rich, 19 August. They keep the piece **or** take the credits back. Not both.
If a refund is issued against a `ref_id`, that retry token must be marked
redeemed in the same transaction, or the customer has their money and a free
render.

**A second failure after a retry means stop asking.** The photograph was never
the problem. Offer the refund plainly rather than a third attempt.

---

## 6 · TIMING

`maxDuration` on generate is **300 seconds**. Worst case is four NB2 calls,
four vision calls and one Stability outpaint. A twelve-person craft can
approach it.

**There is no progress channel.** The route returns once. The glass has to
survive a two-to-four minute wait without looking broken, and that is a design
problem rather than an engineering one.

---

## 7 · THE STUDIO — THREE SMALLER THINGS

`public/wallpaper-studio.html` works except for these.

**It never sends `session_id`.** So the 15-rounds-per-session cap cannot bite
and only the 40-per-IP-per-day one does. One line.

**`reason: "capped"` falls into the generic catch** and shows "that did not
come back." Somebody who has generated fifteen rounds and bought nothing liked
it enough to try fifteen times — the worst possible moment to show them a
failure. There is a screen for this; route `capped` to it. Rich writes the
line.

**The free-sixth counter is hardcoded to `paintUnlock(0)`.** It needs
`GET /api/v1/wallpapers/studio/kept?season=halloween`, which **does not exist
yet** — blocked on the `collection_pieces` column list. See §8.

---

## 8 · WHAT CENG IS BLOCKED ON, FROM YOU

**`collection_pieces` columns.** Studio `keep` cannot write a piece row and
`kept` cannot be built without them. Send the column list or a route that
inserts one.

That is the only thing. Everything else on the engine side is either done or
waiting on Rich.

---

## 9 · PARKED, DO NOT BUILD

**The Groups age rule.** Refuse a lone minor or all minors; allow when an
adult is present. Agreed with Rich and parked pending legal review. The
pre-flight pass could return per-face age but does not. **Do not build it.**

**Open Studio freeform text.** Removed everywhere. The Studio sends four ids
and never a prompt, and the absence of free text is the entire safety story
for that room. Do not add a prompt box back "for flexibility".

---

*CENG · 19 August 2026*
