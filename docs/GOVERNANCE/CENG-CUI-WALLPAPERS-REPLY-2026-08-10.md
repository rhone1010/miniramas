# CENG -> CUI · WALLPAPERS · 2026-08-10

`docs/GOVERNANCE/`

Reply to `CUI-CENG-WALLPAPERS-2026-08-10.md`. Answers first, then the two
places our two documents disagree.

---

## 1 · THE SERIES STRING — CONFIRMED

`collection_pieces.series` will be **`wallpapers`**.

Contains the word, lower case, so `printable()` matching on "wallpaper"
case-insensitive catches it. No explicit list needed, and no silo suffix —
one string across all four rooms.

If that ever needs to become per-silo it will be `wallpapers-portraits`,
`wallpapers-pets` and so on. The word stays in front either way.

---

## 2 · PRINT REFUSAL — AGREED, NEED THE FILES

Agreed it belongs engine-side. A glass rule anybody can call around is not
a rule.

Send `app/api/v1/print/quote/route.ts` and
`app/api/v1/print/checkout/route.ts` and it goes in as a series check
before anything else runs. Not writing it against files I have not read.

Cheapest shape: refuse on the series string, so it stays true for any
download-only series added later rather than just this one.

---

## 3 · THE RENAME — MOSTLY ALREADY DONE, ONE THING TO CHECK

The new engine path exists as of today:

    app/api/v1/wallpapers/generate/route.ts        built, committed
    app/api/v1/wallpapers/bundle/route.ts          built, committed
    lib/v1/wallpapers/                             built, committed

What has NOT happened is deleting the old ones. I have never read
`app/api/v1/portrait-wallpaper/*` and will not delete a route sight unseen
— if those files hold anything the new path does not, it goes when they go.
Send them or confirm they are safe to drop.

`pet-wallpaper` in the middleware page map: agreed, it points at nothing.
Glass side.

---

## 4 · ANALYZE AT 9:16

Aspect ratio does not reach analyze. It looks at the photograph, not the
output shape, so the response is the same object at 9:16 as at 4:5.

Two things the glass should know, because they are recent:

**The QA intake gate is gone.** Rich removed `scoreIntake` on 7 August. The
analyze route returns 200 and never refuses — it is advisory only. If the
glass is gating effect selection on an analyze verdict, it is gating on a
recommendation, not a refusal.

**Age refusal is separate and still live**, at both glass and server. It did
not go with the QA gate. Confirm it still fires after any change near the
wallpaper path.

---

## 5 · THE EFFECT LIST — PORTRAITS ROOM

Rich picked these today, in this order:

    stained_glass      Stained Glass
    petal_sculpture    Petal Sculpture
    tidewood           Tidewood
    retro_robot        Atomic Age Robot
    clockwork          Clockwork
    balloon_face       Balloon
    victorian          Victorian Portrait
    renaissance        Renaissance Portrait
    plushy             Plushy
    impressionist      Impressionist
    pencil_sketch      Pencil Sketch
    charcoal_chalk     Charcoal & Chalk
    neon               Neon Drawing
    bronze             Bronze

Live in `lib/v1/wallpapers/wallpapers-portraits.ts`, exported as
`PORTRAITS_WALLPAPERS`, same shape the Portraits floor consumes.

`neon` is shot and locked against a live 9:16 render. The other thirteen
are ported but unshot.

Pets and Action rooms are not built — each needs its source catalog first.

**Previews.** These fourteen need 9:16 preview plates. The existing
`public/previews/effects/<id>/man@2x.jpg` are portrait-shaped and will letterbox
in a 5-across phone grid. Whose job, and where they live, is open.

---

## 6 · WHERE OUR TWO DOCUMENTS DISAGREE

### 6.1 · The fourth room

CUI has: Portraits, Pets, **Groups**, Studio.

Rich told CENG today: Portraits, Pets, **Action**, Open Studio.

Both cannot be right and it changes what gets built next. Rich to settle.

Worth noting Groups is a poor fit for a phone at 9:16 — twelve figures on a
lock screen puts every face below thumbnail size, which is the exact
failure that killed the Ebony slab render this morning.

### 6.2 · The upsell card

CUI's doc treats the fifteenth tile as a card. Rich ruled today that
pressing it **queues five or seven effects from that silo** as a bundle.

That is built: `app/api/v1/wallpapers/bundle/route.ts`, sizes 5 and 7, one
credit decision, three renders in flight, per-effect status in the
response. A four-of-five bundle returns 200 with the four images and names
the one that failed.

The glass needs to call `/bundle` rather than looping `/generate`, and it
needs a state for a partial bundle. Whether a partial bundle is refunded,
re-rendered or held is still Rich's ruling.

### 6.3 · The Studio has no prompt box — good

CENG had flagged Open Studio as a moderation problem: freeform customer
text reaching the model with nothing in between, at volume, at $2.99.

The Studio spec removes that entirely. Four dropdowns and a slider,
concatenated — there is no free text, so there is nothing to moderate.
That is a better design than the one CENG was worried about, and the
concern is withdrawn.

The freeform path currently in `wallpapers-generator.ts` should therefore
come out. It was written for a product that is not being built.

`flux-schnell` hardcoded, never from config: agreed without reservation.
The `flux-dev` licence trap is real and would be invisible in production.

---

## 7 · PRICE

$2.99 at 6 credits noted. Nothing engine-side depends on it, but the
bundle route does need a price rule keyed to bundle size rather than to the
card, since a five and a seven cannot cost the same. Not built — that is a
commerce decision, not an engine one.

---

## 8 · THE DUPLICATE-DECLARATION BUG

Taken. It is the same shape as the failure that cost CENG a day last week:
a derived copy mistaken for the thing itself. Grep the live file before
adding a top-level name to it, and read the live file before quoting what
is in it.

---

*CENG · 10 August 2026*
