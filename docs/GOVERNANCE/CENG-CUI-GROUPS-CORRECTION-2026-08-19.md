# CENG -> CUI · GROUPS · CORRECTION · 19 August 2026

`docs/GOVERNANCE/`

**Supersedes §2 and the "no Groups analyze route" line in
`CENG-CUI-GROUPS-2026-08-19.md`. Everything else in that document stands.**

---

## WHAT CHANGED

That document said there is no Groups analyze route and none is needed. It
also said the price is not knowable before the render starts, and that
showing a price up front would need a two-step flow.

**Both are now wrong.** `app/api/v1/groups/analyze/route.ts` exists,
installed and committed. It returns the count, the price and the quality
advisories in one call, before checkout.

The reasoning in that section was sound when counting was the only job. It
stopped being sound once Rich ruled that quality has to be judged on intake
too — refusing a photograph the customer has already paid to craft is the
wrong order of events, and the count sets the price, so both had to move
ahead of the gate.

This is the "one gate at analyze" fix noted as the permanent answer in
`portraits.html` and never built. Groups has it first.

---

## THE CALL

```
POST /api/v1/groups/analyze
{
  source_images_b64: string[]      // one, or one per person
}
```

The older shape — `source_image_b64` plus `additional_images_b64` — is
accepted and folded into one list, same as generate.

Response:

```json
{
  "ok": true,
  "subject_count": 5,
  "credit_cost": 15,
  "verdict": "yellow",
  "advisories": [
    { "kind": "faces_smallish", "detail": "smallest face about 96px" },
    { "kind": "soft_focus", "detail": "photo 3" }
  ],
  "smallest_face_min_dim_px": 96,
  "face_thresholds": { "red": 80, "yellow": 140 },
  "per_photo": [ ... ],
  "photo_count": 5,
  "nothing_to_craft": false
}
```

**The flow is: analyze -> show price and advisories -> gate -> generate.**

---

## 1 · QUALITY IS ADVISORY. IT DOES NOT DECLINE.

This is the part to get right, and it is a reversal of what an earlier
resolution gate did.

Rich's ruling, carried from Portraits: **a sharp 600px photo renders better
than a blurry 2000px one**, so pixel dimensions are the wrong thing to
refuse on. The hard resolution banner in Portraits was retired for exactly
that reason and is not coming back here.

The real safety net is downstream and already built — four attempts, a
per-figure likeness gate, and a refund offered when it still misses. That
catches the photographs a px threshold would only have guessed at, and it
costs a render rather than a sale.

**So the glass warns and lets them proceed.** Every `advisory` is something
to say, never a reason to disable the button.

### The one exception

`nothing_to_craft: true` means no usable face was found in any photograph.
That is not a quality verdict, it is an absence — there is nothing to craft
and no render can fix it. `ok` comes back false with it.

**That is the only state the glass should treat as a stop.**

---

## 2 · THE THRESHOLDS LIVE IN THE RESPONSE

Two sets existed in the repo and disagreed:

```
RESOLUTION-GATE-NOTES.md   face red under 50px, yellow 50-79
portraits.html             face red under 80px, yellow under 140
```

Portraits was deliberately stricter so its warning fired before its generate
gate would decline. Groups does not need that margin, because Groups never
hard-declines on face size.

The route uses the Portraits numbers, because those are the ones tuned
against real renders. They are stated once, in the route, and echoed in
`face_thresholds` on every response.

**Do not restate them in the glass.** Read them from the response, so the
day they move there is one place to change.

---

## 3 · ADVISORY KINDS

```
faces_small        smallest face under 80px  — likeness will probably soften
faces_smallish     under 140px               — likeness may soften
soft_focus         a named photo is out of focus
poor_light         a named photo is badly lit
```

`detail` names the photo by its position — "photo 3" — because *one of your
five is soft* is actionable and *your photos are soft* is not.

**These are not messages.** They say what is true so the Concierge can say
something true. The wording is Rich's.

---

## 4 · THE PRICE

`credit_cost` is computed from the count by `groupsCreditCost()` in
`groups-shared.ts`. It is the same function the credit gate needs to call.

```
2-3 subjects    10 credits
4-6             15
7-9             25
10+             40
```

The generator re-counts during its own pre-flight and logs any
disagreement. Both use the same vision pass, so they should not differ — if
they ever do, that log line is where it will show.

**The gate still refuses anything that is not 10.** Analyze existing does
not change that; it is still the single thing between a finished engine and
a sellable craft.

---

## 5 · WHAT STILL DOES NOT NEED TO BE SENT

`subject_count` on the generate call remains a hint and remains ignored
unless detection errors outright. The glass does not need to pass the number
analyze returned — the engine will count again. Passing it is harmless and
gives a useful log line if the two disagree.

---

*CENG · 19 August 2026*
