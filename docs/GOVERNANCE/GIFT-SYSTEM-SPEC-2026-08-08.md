# GIFT SYSTEM · SPEC v1 · 2026-08-08

`docs/GOVERNANCE/`

Worked out with Rich, 8 August 2026. This is the process. Costs, pricing and
marketing are out of scope. Anything not decided here is marked **OPEN** and
must come from Rich before it is built.

---

## WHAT THIS IS

A separate, self-contained system. It is not part of Portraits and does not
live in `portraits.html`. Gifts and Groups are one engine with their own
pages, their own navigation and their own front end.

The product sold is a framed print. The craft comes with it. The customer
buys before anything has been made, then crafts until they are happy, then
accepts one — and that acceptance is what sends the order to Prodigi.

---

## THE SPINE

1. Account first. The catalogue is browsable signed out; the buy press
   requires an account. We want to know who they are before we take money.
2. Catalogue. They choose an effect shown in a frame.
3. Number of people.
4. Payment. Grants an entitlement, not credits.
5. Upload.
6. The Wall. Craft, adjust, craft again — up to fifteen.
7. Accept. Confirmed, then released to Prodigi.

---

## 1 · THE CATALOGUE

A vertical scrolling page, not the workshop.

**They choose the effect and the frame together** — the page shows effects
presented in frames, and picking one sets both.

**Then they choose the number of people.** The frame carries the aspect
ratio, and the aspect ratio is also the render shape. Subject count is what
they shop on, because "a gift for three" is easier to buy than an aspect
ratio.

Some effects cap the number of people. Stained glass cannot hold more than
about five. Once an effect is chosen, the people step offers only what that
effect can take.

**OPEN:** every effect's maximum. Stained glass is the only known limit.
The rest come out of testing.

**Aspect ratios are bands, not exact fits.** Small groups get the tighter
shapes, four to eight get the wider ones. NB2 adjusts within a shape. The
frames and ratios need setting so that four to eight people sit comfortably.
Triptych and the five-panel pieces are the exceptions — fixed shape.

---

## 2 · SKUs

One catalogue, one SKU table, two views. A flag on each SKU says which
surface it appears on.

Portraits sees squares only. That stays deliberately narrow — we want people
through and buying, not choosing between fifteen sizes.

Gifts see the wider set, including the upright and landscape ratios.

Same prices, same Prodigi products, same fulfilment. Read at a different
point in the journey: Portraits reads the catalogue after a piece exists,
Gifts read it before.

---

## 3 · PAYMENT AND THE ENTITLEMENT

Same Stripe setup as today. **Separate product IDs.** The webhook reads
which product was bought and writes either credits or an entitlement.

**An entitlement is one row that says: this person paid for this specific
thing, and here is what they may still do with it.**

It holds:

- the product
- size and frame (locked at purchase)
- the print SKU
- crafts allowed (15) and crafts used
- the chosen piece
- state

The craft loop spends from this row, not from the credit balance. A gift
buyer cannot spend gift crafts elsewhere, and cannot end up paying for a
print they were already owed.

**One purchase is always one print.** A triptych is three images inside one
artwork — still one print.

**States:** paid → crafting → accepted → sent. Plus refunded and escalated.

---

## 4 · WHAT IS LOCKED AND WHAT IS FREE

Locked at purchase: **size and frame.**

Free after purchase, at no cost and no count:

- the effect — they may change their mind
- the composition
- the photographs — uploading a new set costs nothing

**Only pressing craft spends one of the fifteen.**

Margins are good enough that micro-managing this would only create friction.

**Frame changes mid-flow are later, not Rev 1.** The intended behaviour when
built: if they buy a three-person frame and want five, they move to a
different frame and pay the difference.

---

## 5 · UPLOAD

Uses the current intake gate as it stands.

**Slots are limited to the number of people the frame was bought for.** A
three-person product offers three uploads.

**Children:** no individual photographs of children. A family photograph
containing children is fine.

---

## 6 · THE WALL

A working surface inside the gift flow. **It is not the collection.** It
exists only between the first craft and the accept.

**Mobile.** Full-screen images stacked, newest on top, swipe vertically
through them — down for older, up back to newest. An X in the top corner
switches to a grid, three across, five down. Tap a tile and it goes back to
full screen. X again returns to the grid.

**Desktop.** Same surface, the adjustment controls always on screen rather
than in a slide-up.

**Under the image, two buttons:**

- **Adjust** — brass
- **Accept** — oxblood

**While a craft runs:** the existing spinner from `portraits.html`. When it
lands it becomes the new full-size image and the previous one goes behind.

**Fifteen is the ceiling.** The count is not shown. When they run out, a
prompt offers to request more renders and brings the Curator in to ask how
we can help.

---

## 7 · ADJUST

**Never expose prompting to the customer.** One instruction per render. No
sliders, no multi-select, no cockpit. "Tell us what's wrong," not "tell the
AI what to do."

The word is **Adjust**, not Edit. Edit implies Photoshop.

**First panel — six large buttons:**

Person · Composition · Style · Color · Lighting · Background

with **Try Again** sitting separately (same recipe, fresh interpretation).

**The second panel depends on the first.** For example:

- Person → pick the subject → make them closer to the photograph
- Color → richer / softer / warmer / cooler
- Composition → more balanced / closer together / more breathing room

**Person is not available on unified group compositions in Rev 1.** Fixing
one person in a single group image means asking NB2 to leave the others
untouched, and until that is proven it must not be offered. A button that
lies is worse than a button that is absent. The other five work everywhere.

**Slide-up from the bottom navigation on mobile. Always visible on desktop.**

---

## 8 · THE CURATOR ON THE WALL

**Not Rev 1.** Recorded here because it is the intended direction.

When they run out of renders, the Curator picks it up. She has access to the
knowledge base and the prompt bodies, and can vary or compose a prompt
rather than only picking from the 63.

**She sends it herself — no approval step.** They have already told her what
is wrong in plain words; asking them to approve a prompt they cannot read
adds a decision they cannot make. And nothing costs them anything until
accept.

**What she shows is what she changed, in her own words** — "warmer, and I've
held your mother's face harder" — never the prompt.

She needs real guardrails. That is why she is not in Rev 1.

---

## 9 · ACCEPT

**Accept is confirmed before it fires.** Too much money on the line. The
confirm says plainly: this is the one we print, the others go, no changes
after.

On confirm:

- the entitlement flips to accepted and the order releases to Prodigi
- the chosen image lands in My Collection
- the unchosen renders leave the customer's view
- unused crafts die with the acceptance
- the wall collapses

**Upscale only if the print size needs it.** The hope is 4K native out of NB2
carries the standard sizes without it.

**All sales are final at accept.** They may say they are unhappy at the
render stage. Once the print is received, only print quality is in play —
and that is a Prodigi matter, a different system.

---

## 10 · NAVIGATION

**They are not locked in.** A hard lock turns the back button into a bug
report, and someone who wants to look at their collection mid-craft should
be able to.

Instead: the wall persists, and every route back into the gift entitlement
returns them to it. While they are in the gift flow it keeps its own
navigation — no Workshop, no upload — so there is nothing pulling them
sideways.

---

## 11 · ABANDONMENT

Someone pays and never comes back. The entitlement sits paid.

**Three emails, then stop.** These people have paid, so the cadence is
slower and warmer than cart abandonment: **day 2, day 7, day 21.**

---

## 12 · REFUNDS AND STORAGE

**If every render is wrong, we refund.** That is the policy. The craft cost
is what we absorb when it goes wrong.

**The concierge handles refunds up to $50 on its own.** Above that it comes
to Rich, with the wall and the scores attached.

**Storage:** an entitlement that ends without an accept keeps every render,
its likeness score and its gate result, retrievable in the admin panel
against that entitlement. Once accepted, the sale is closed and the rest can
go.

---

## 13 · WHAT IT REUSES

Payment · the print catalogue and prices · Prodigi · the upscaler · the
collection · the account · the fulfilment webhook.

## WHAT IS NEW

A purchase that grants an entitlement rather than credits · a craft loop
that spends from it · the wall · the adjust panel · the accept-and-release
step · the catalogue page · the whole gift front end.

---

## OPEN · GET FROM RICH BEFORE BUILDING

- The hit rate on multi-person group renders. Five likenesses in one
  composition, and a group where one person is wrong is a refund, not a
  retry. If it is four in five, fifteen renders cover it. If it is one in
  five, no amount of wiring fixes what is being sold.
- Each effect's maximum subject count. Stained glass is the only known one.
- The frames and aspect ratios themselves — which sizes, which ratios, and
  which subject counts sit on each.
- Whether NB2 can hold the other subjects steady while fixing one. Decides
  whether Person adjustment ever reaches unified groups.

---

*CUI · 8 August 2026*
