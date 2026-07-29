# INTERACTION MODEL — s58

**2026-07-28 · CUI V22.** Read from
`public/litenco-stage-2026-07-28-s58.html` this day.

A screenshot shows the workshop at rest. Most of what was decided is only
legible in motion — the flip, the density tiers, the offer rewriting itself,
the letter changing. This document is that half.

**Read the JavaScript.** The interaction model is about two hundred lines at the
foot of the file. The CSS describes appearance; the behaviour is in
`turn`, `openSilo`, `renderQueue`, `upsellCard` and `curatorState`.

---

## 1 · THREE INDEPENDENT STATE MACHINES

They share the page and touch each other in exactly three places.

```
   THE FLOOR              THE CURATOR              THE QUEUE
   silos ⇄ effects        empty → photo →          empty ⇄ has-items
                          room → back                (density tiers)
        │                       │                        │
        └───── opening a room sets the Curator's line ───┘
        └───── picking a card writes to the queue ───────┘
        └───── the queue moving rewrites the offer ──────┘
```

Nothing else is coupled. That was deliberate: each can be rebuilt without
disturbing the others.

---

## 2 · THE FLOOR

### State
Held on `#workshop` as `workshop-view--silos` or `workshop-view--effects`.
The deck holds two faces; only one is visible.

### `turn(from, to, after)`
The floor **turns over**; it does not swap.

1. `from` gets `is-turning`. Each card rotates 90° on its own axis. Cards are
   staggered by 38ms via `:nth-child` transition delays, so the row reads as a
   hand turning cards rather than a panel flipping.
2. After `420ms + 38ms × (cards − 1)`, the callback runs — this is where the
   new contents are written.
3. `to` gets `is-arriving` (rotated −90°, zero duration), then on the next two
   animation frames `has-arrived`, which returns it to 0° over the full
   duration. Two frames, not one: one frame is not always enough for the
   browser to register the starting transform, and the animation is skipped.

Reduced-motion users get a straight swap.

### `openSilo(card)`
Reads `data-silo`, looks the room up in `SILO_EFFECTS`, truncates to `CAP = 7`,
turns the floor, then:
- builds an effect card per name, marking `is-selected` if it is already queued
- appends the upsell as the eighth
- sets `data-count` so the grid picks the right shape
- writes the room name into the breadcrumb
- **speaks the room's line through the Curator**

### `backToSilos()`
Turns back and, if a photograph is loaded, returns the Curator to the question.

### Layout by count
`data-count` on `.floor` chooses the shape. Cards never resize; **placement**
changes. Eight columns, each card spanning two, because eight is the smallest
number that lets a row of one, two or three sit centred against a row of four.

| count | shape |
|---|---|
| 3 | 3 centred |
| 5 | 3 + 2 |
| 6 | 3 + 3 |
| 7 | 4 + 3 |
| 8 | 4 + 4 |

A full row of four reaches both edges; partial rows are centred by offsetting
where the row's first card starts.

---

## 3 · THE CURATOR

### State
`data-state` on `#cur`: `empty` · `photo`. The room and back states are not
separate states — they are the **letter changing** while `data-state` stays
`photo`.

### `say(html)`
Adds `is-changing` (letter to opacity 0), waits 380ms, writes, removes the
class. The letter should read as a page being turned, not text being replaced.

### `curatorState(name, html)`
Sets `data-state`, says the line, and **pushes the current photograph into the
intake modals** so a fault is illustrated with the customer's own image rather
than a stock example.

### What is said, and when
| Moment | Source |
|---|---|
| load | `SAY.empty` — bring me a portrait |
| photo added | `SAY.photo` — reacts, then asks what kind of effect |
| room opened | `SILO_LINE[silo]` |
| back out | `SAY.photo` again |
| photo removed | `SAY.empty` |

`SAY.reject` exists and **is never called** — the rejection path is unwired.

---

## 4 · THE QUEUE

### State
`QUEUE` is an array of `{silo, room, effect}`. Global across every Series: a
Portrait finish and a Pets finish sit in the same queue and crossing rooms
never empties it. Identity is `silo::effect`.

### `renderQueue()`
Rewrites the rail, then:
- `data-n` on the list drives the **density tiers**
- `has-items` on `.tbc` reveals the craft block
- the total is `n × 10` credits, **no percentage and no dollars** — the ladder
  belongs to the credit purchase, and quoting it here charged once and credited
  twice
- **repaints the upsell**, because the offer depends on the queue

### Density
The rail tightens rather than scrolling, so the craft action never leaves the
screen.

| count | row |
|---|---|
| 1–4 | full — thumbnail, name, room |
| 5–7 | medium — smaller thumbnail, room dropped |
| 8–10 | compact — small thumbnail, name only |

The room label goes first: by eight pieces the customer chose each one and does
not need reminding where from.

### The cap
`QUEUE_CAP = 10`. `addToQueue` returns false at the cap and opens the modal, and
the caller **does not tick the card** — a refused pick must not leave the floor
and the rail disagreeing.

Ten is where the ladder stops. Past it the customer gains nothing but a longer
wait and a worse failure story.

---

## 5 · THE UPSELL — slot eight

`upsellCard(silo, list)` reads **the queue, not just the room**.

```
have  = QUEUE.length
left  = effects in this room not already queued and not unavailable
addN  = min(left, 10 - have)
total = have + addN
tier  = total >= 10 ? 3 : total >= 6 ? 2 : 1
```

So a room of six offered to an empty queue is tier 2; the same room offered to a
queue of four completes the ten and is tier 3. The register rises with the
stakes rather than switching character at the last moment.

At `addN === 0` it stops selling and says the payload is full.

Clicking adds every remaining finish, ticks them on the floor, and repaints
itself.

`repaintUpsell` is called from `renderQueue`, so removing a piece re-opens the
offer.

---

## 6 · SELECTION

The **whole card** is the target. The `+` badge is `pointer-events:none` — an
affordance, not the only place a click lands.

```
is-upsell      → its own action, never ticks
is-unavailable → nothing to craft, ignored
otherwise      → toggle is-selected, write to the queue
```

The tick is CSS (`::before` content), not JavaScript writing text — one less
thing to keep in step.

---

## 7 · MODALS

Two dialogs share `.m-scrim`.

**Intake** — eight states behind `window.__openIntake(1..8)`. All pre-craft.
Their classes were renamed on the way in (`.mcur`, `.mc-mark`, `.mcur-say`)
because r81's modal used the same names as the Curator panel.

**Queue full** — opens at the eleventh pick. *Craft these ten* fires the craft;
*Keep looking* closes.

Both close on the ×, the scrim, or Escape.

---

## 8 · WHAT IS DELIBERATELY ABSENT

- **No route calls.** Zero. The file is glass.
- **No persistence.** Reload and the queue is gone.
- **No upload.** Clicking the photo slot advances the state; nothing is read.
- **No craft.** The button is inert.
- **`SAY.reject` is never reached.**

---

## 9 · WHERE TO LOOK

| For | Read |
|---|---|
| the flip | `turn()` |
| entering a room | `openSilo()` |
| the queue | `renderQueue()`, `addToQueue()`, `removeFromQueue()` |
| the offer | `upsellCard()`, `repaintUpsell()` |
| the Curator | `say()`, `curatorState()`, `SAY`, `SILO_LINE` |
| what cannot render | `window.NO_ENGINE` |
| shapes by count | `.floor[data-count="n"]` in the stylesheet |
| density | `.tbc-list[data-n="n"]` |

**Then walk it.** Open a silo, pick five, cross to another room, remove one,
reach ten. Half of what was decided is only legible in motion.
