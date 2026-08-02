# CURATOR STATE INVENTORY

**2026-07-31 · CUI V24 · read from `public/litenco-stage-2026-07-31-s74.html`
and `public/effect-registry.js` that day.**

Every place the studio speaks to a customer, what makes it speak, and what it
says right now. Read with `CURATOR-VOICE-BIBLE-2026-07-31.md`.

**Status means:** **LIVE** accepted and in the product · **DRAFT** written by
a build lane, never ratified · **PLACEHOLDER** knowingly temporary, the file
says so · **EMPTY** the surface exists and says nothing · **UNBUILT** the
moment exists in the flow, the surface does not.

**Provenance matters.** Anything marked DRAFT was written by CUI. Board 3.7
already flags that as out of lane. Those are the lines most worth rewriting
first — not because they are bad, but because nobody with authority over the
voice has ever looked at them.

---

## A · THE CURATOR'S LETTER

The panel on the left. One paragraph, signed, fades out and back when it
changes. `#curSay`, written only by `say()`.

| # | state | trigger | today | status |
|---|---|---|---|---|
| A1 | empty | no photograph yet, and on "Use a different photograph" | *Bring me a portrait and I'll choose the finishes myself. A clear, face-forward photograph gives me the most to work with.* | PLACEHOLDER |
| A2 | photo accepted | a file lands and analyze does not raise a fault | *The light across her hair is doing something lovely — that will carry into almost anything. So: what kind of effect are you thinking about today?* | **PLACEHOLDER — breaks §3** |
| A3 | fault | any of the four photograph faults | *That one is a little soft for me. Something sharper, and closer to the face, and I can do considerably better by you.* | **PLACEHOLDER — breaks §4** |
| A4 | room opened | a silo card is clicked | eight lines, one per room, from the registry | LIVE |
| A5 | room closed | a room with nothing live is clicked | *That room is still in the studio — I have nothing finished to show you in there yet.* | DRAFT |
| A6 | pose floor | Next is pressed | *One last thing before I begin. Your photograph gives me a pose already — but I needn't keep it…* | DRAFT |
| A7 | pose chosen | any of six pose cards | six lines, one per pose | DRAFT |

**A2 is the highest-value rewrite in this document.** It is said over every
photograph a customer ever uploads and it asserts an observation the machine
has not made. See the bible §3.

**A3 needs four lines or none.** Today one line covers face-small, soft, dim
and unusable, and contradicts the card beside it in three of the four cases.

**A4 is the only fully-accepted set here** and is a good model for tone:
nine words, one claim, no promise.

---

## B · THE INTAKE MODAL — eight states

One dialog, eight states, `data-s="1"` to `"8"`. Opened by
`window.__openIntake(n)`. States 5–8 show the customer's own photograph
behind the message.

**States 1–4 are post-craft.** Something went wrong after money moved.
**States 5–8 are pre-craft.** The photograph is a problem before anything is
spent. `BUILD-INVENTORY §2.7` has this backwards and is wrong.

| # | state | trigger | today | status |
|---|---|---|---|---|
| B1 | 1 · interrupted | craft failed, re-crafting | *The studio stumbled on this one. I'm crafting it again now — nothing is lost.* + *Your payment is safe. A re-craft is never charged.* | LIVE |
| B2 | 2 · didn't hold | craft completed below the likeness gate | *This photograph is fighting me — the face sits a little small to keep a true likeness. A clearer, closer one will craft beautifully.* + *No charge to try again with a new photograph.* | LIVE |
| B3 | 3 · at capacity | timeout, piece will follow by email | *The studio's at capacity just now. I'll craft your piece the moment there's room and write to you the instant it's ready.* | LIVE |
| B4 | 4 · refunded | craft abandoned, money returned | *I couldn't make this one the way it deserves — so I won't send it. It's refunded…* + *Refunds settle in 5–10 days, on the card you used.* | **LIVE but WRONG** |
| B5 | 5 · face small | gate reasons match `/face\|small\|close\|crop\|distance\|far/`, or face px below threshold | *The face here sits small in the frame. Try one taken closer — head and shoulders, where the face fills more of the picture.* | LIVE |
| B6 | 6 · soft | gate matches `/blur\|sharp\|focus\|soft/`, or local Laplacian below 45 | *This photograph is a little soft. A sharper one makes a stronger finished piece — the studio has more to hold onto.* | LIVE |
| B7 | 7 · dim | gate matches `/dim\|dark\|light\|expos\|bright/`, or mean luma below 62 | *This photograph is dim. A brighter, evenly lit one gives the studio more detail to work with.* | LIVE |
| B8 | 8 · can't use | quality verdict red, undecodable file, or no rule matched | *I can't craft from this photograph. A clear, close photo of a face works best — try another.* | LIVE |

**B4 must be rewritten before Aug 9.** It says "It's refunded" and
"Refunds settle in 5–10 days, on the card you used" — card language, written
before credits governed. Under the credit model nothing goes back to a card;
credits return to the balance. As written it promises a customer a card
refund that will not arrive.

**B1's "A re-craft is never charged"** must be checked against the ruling of
7/29: one gate-triggered re-craft per piece, two customer-requested per
account, then the action disappears. "Never" is broader than the rule. Board
3.2 has this contradiction open.

**Buttons.** States 5–8 carry a filled button (choose another photograph) and
sometimes a ghost (*Use this one anyway*). As of s74 they are wired: filled
reopens the picker, ghost accepts the fault and remembers it. States 1–4 have
no buttons wired — they are post-craft and belong to lane 3.

---

## C · THE RAIL

Right-hand column. The button label has exactly one writer, `labelGo()`.

| # | state | trigger | today | status |
|---|---|---|---|---|
| C1 | browsing | on the silo or effect floor | *Add as many finishes as you like — the pose comes last.* | PLACEHOLDER |
| C2 | posing | on the pose floor | *Go back to the finishes any time to add more.* | PLACEHOLDER |
| C3 | full | ten pieces chosen | *Ten is the most I can craft in one go.* | PLACEHOLDER |
| C4 | button, step 1 | not on the pose floor | **Next** · *choose a pose* · *Step 1 of 2 · N credits* | DRAFT |
| C5 | button, step 2 | on the pose floor | **Craft** · *this piece* / *all N* · *Step 2 of 2 · N credits* | DRAFT |
| C6 | empty rail | nothing chosen | *To Be Crafted*, no items | LIVE |

The file marks C1–C3 as "Draft copy, mine to be replaced."

---

## D · THE CAP MODAL

| # | trigger | today | status |
|---|---|---|---|
| D1 | an eleventh piece is added | *Ten pieces will keep the studio busy for a good while. Let me craft these first — then we'll start another queue, and you won't be left waiting on the whole lot at once.* | DRAFT |

**Contains a banned word.** "another queue" — queue is production language and
must not reach the customer. The build gate does not currently catch it
because the gate reads markup and this is inside a modal that predates the
check. Flagged.

---

## E · MY COLLECTION

| # | state | trigger | today | status |
|---|---|---|---|---|
| E1 | empty | no pieces | *(nothing)* | EMPTY |
| E2 | some crafting | at least one piece still on the bench | *The rest are still on the bench. They will appear here as they land.* | DRAFT |
| E3 | all landed | nothing crafting | *Yours to keep. Download any of them, or send one to the Print Shop.* | DRAFT |
| E4 | count | always | *N pieces · M on the way* | LIVE |

**E1 is empty and should not be.** A customer who opens My Collection before
crafting anything sees a blank panel. That is the one state where the Curator
has something useful to say and says nothing.

---

## F · THE ONWARD CARDS

Three cards at the foot of My Collection, added in s72.

| # | card | today | status |
|---|---|---|---|
| F1 | Recommends | headline only; picks three live effects, one per room, excluding owned | DRAFT |
| F2 | Print Shop | headline only | DRAFT |
| F3 | Wallpapers | headline only | DRAFT |

All three have a title and no body. Each needs one line saying why the
customer would want it.

---

## G · UNBUILT — the moments that exist with no surface

These will need voice as each lane lands. Naming them now so the writing can
happen once rather than under deadline.

| # | moment | lane | needs |
|---|---|---|---|
| G1 | **Not enough credits** | build 1.3 | the shortfall reveal — the hardest line in the product. Money, in the second register, without a sales pitch |
| G2 | **Buying credits** | build 1.3 | the five blocks, the ladder, why 60 is recommended. **No "save"/"off"/"discount"** |
| G3 | **Crafting in progress** | build 1 lane 3 | ~26 seconds, per piece. One line, possibly several that rotate |
| G4 | **A piece lands** | lane 3 | the moment the first Crafted Image appears |
| G5 | **Sign in at craft** | 1.2 | magic link, no password. Why an email is being asked for at that moment |
| G6 | **First login → Account** | 1.2 | first thing a new customer ever reads |
| G7 | **Print Shop** | 1.10 | four SKUs, sizes, framing |
| G8 | **Concierge** | blocked on 3.1–3.3 | disputes, re-crafts, refunds. Its own register — see bible §10 |
| G9 | **Account page** | 1.11 | balance, history, tester state |
| G10 | **Wallpapers** | — | 9:16, download only |

---

## H · WHAT THE MACHINE ACTUALLY KNOWS

For anyone writing A2 and the fault lines. This is the whole of it — the
analyze response as of 2026-07-31. **Nothing outside this list may be
observed in copy.**

| field | what it is |
|---|---|
| `quality_verdict` | green · yellow · red |
| `smallest_face_min_dim_px` | smallest detected face, in pixels. Red below 80, yellow below 140 |
| `body_coverage` | `face_only` or more |
| `subject_count_estimate` | how many people |
| `faces[]` | bounding boxes |
| `recommendation` | a sentence from the engine. **Received and not shown** — engine copy is not Curator copy |
| `likeness_distinctness` | sometimes present |
| local sharpness | Laplacian variance. Soft below 110, very soft below 45 |
| local brightness | mean luma. Dim below 62 |

There is **no** signal for: expression, mood, hair, clothing, age, gender in
any form worth speaking about, relationship, occasion, or who the person is.

The likeness score is computed at craft and **not stored** — so nothing can be
said about it after the fact until the column lands. Board 3.5.

---

## I · ORDER OF WORK

If only some of this gets written before Aug 9:

1. **A2** — said over every photograph, and currently claims something untrue
2. **A3 → four lines** — or silence, so the letter stops contradicting the card
3. **B4** — promises a card refund that credits will not deliver
4. **G1 and G2** — the money moments, unbuilt and unwritten
5. **E1** — an empty panel where a line belongs
6. **D1** — remove "queue"
7. **C1–C3, A5–A7** — draft copy nobody with authority has read
8. **F1–F3** — three bodies, one line each

Everything below 4 is polish. The first three are wrong rather than merely
provisional.
