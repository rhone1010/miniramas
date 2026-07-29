# COMMERCE AND IDENTITY

**2026-07-28 · CUI V22 · ruled by Rich in session.**

This document exists because the credit model contained a contradiction that
reached the glass: the volume ladder was being applied twice, once when credits
were bought and again when images were queued. It also settles the four points
at which Liten & Co holds a customer's information.

Corrects `PORTRAITS-SPEC-2026-07-27-v2.md` §5 and §11. Where the two disagree,
this document is right and the spec is amended.

---

## 1 · THE CONTRADICTION, NAMED

An image costs **10 credits**. Five images cost **50 credits**. There is no room
in that for a percentage — the arithmetic is flat by construction.

The craft button was nonetheless reading

> 50 credits · 25% saved · $18.71

which double-counts. The customer already paid the discounted rate when they
bought the credits. Telling them they are saving again at craft time is a claim
that isn't true twice.

**It is also unjustified on cost.** Ten renders cost the same whether they are
one batch or ten separate ones. Nothing about batching saves the studio money,
so nothing about batching should discount. What *does* deserve a discount is
commitment — paying for three hundred credits up front.

---

## 2 · THE LADDER BELONGS TO THE PURCHASE — RULED

| Where | What happens |
|---|---|
| **Buying credits** | the volume ladder lives here, and only here |
| **Crafting** | always 10 credits an image. No percentage, no dollars |
| **The eighth card** | sells completeness, not a discount |

### Credit blocks

| Credits | Images | Discount | Price | Per image |
|---|---|---|---|---|
| 10 | 1 | — | $4.99 | $4.99 |
| 20 | 2 | 10% | $8.98 | $4.49 |
| 30 | 3 | 15% | $12.72 | $4.24 |
| 50 | 5 | 25% | $18.71 | $3.74 |
| 100 | 10 | 30% | $34.93 | $3.49 |
| 200 | 20 | 38% | $61.88 | $3.09 |
| 300 | 30 | **45%** | **$82.34** | $2.74 |

Tiers: **THE SERIES** up to nine images' worth · **THE STUDIO** at ten and above.
Credits do not expire.

At 300 credits the studio's cost is roughly $7.40 all in — thirty renders at
$0.15, an allowance for recraft, and card fees. The margin holds at every step.

### What the craft button says now

> **Craft all 5** · 50 credits

Nothing else. No dollar figure, no percentage. The saving happened at purchase.

### What the eighth card says now

It stops selling a discount and sells the room:

> **Take the room entire** — all seven finishes, side by side.

True, no pricing claim, and it still points at a full payload of ten.

---

## 3 · PAYLOADS OF TEN — RULED

The queue caps at **ten**. That is a rendering constraint, not a pricing one:
thirty renders is thirteen minutes of waiting and a failure story thirty times
more complicated than the one designed.

Someone wanting thirty images buys 300 credits at 45% and crafts three payloads.
The queue never holds thirty; the discount never cared how they spend it.

The eleventh pick opens a modal with the Curator explaining the cap.

---

## 4 · IDENTITY — the four points of contact

### 4.1 Entry gate — email, and email only
- **Magic link. The email is the identity.** No password.
- Required, because `/api/v1/credits/gate` refuses without an `owner_key`.
  Guest was removed; there is no anonymous path.
- **No first name on the gate.** Every extra field costs conversion, and the
  gate asks someone to commit before they have seen anything.
- **Marketing consent: an unticked checkbox**, separate from the terms, never
  pre-ticked and never bundled. Store the timestamp and the exact wording
  agreed to. California is CCPA; the EU bar is explicit consent, and meeting the
  higher one now costs nothing.

**OPEN:** does sign-in come before uploading, or after choosing and before
crafting? Before crafting is the better funnel. Before uploading is simpler to
build.

### 4.2 The Curator asks the name — RULED
Not a field on a form. Once the customer is in, the Curator asks:

> Before we begin — what should I call you?

One line in a conversation rather than a required field, skippable without
friction. It fits the character, it converts better than a gate field, and the
data is better than an optional one would give.

### 4.3 Studio code
Optional, at sign-up or any time after. A credit grant, not an entry ticket —
it redeems into the same ledger a card will later fund.
`TESTER-AMBER` = 500 credits · `RHONE3166` = admin.

### 4.4 Print Shop
Name, shipping address, and a phone number if Prodigi requires it. **Collected
only when a print is ordered**, never before.

### 4.5 Payment
Stripe holds the card. Liten & Co never sees or stores it.

### What is held

| | |
|---|---|
| email | the identity |
| first name | if given to the Curator |
| marketing consent | boolean, timestamp, wording |
| credit balance and ledger | |
| pieces owned | |
| account class | admin · tester · customer |
| fulfilment flag | testers false, customers true |
| shipping details | only for those who have ordered a print |

---

## 5 · RETENTION — RULED

| State | Policy |
|---|---|
| Crafted and downloaded | keep **12 months**, then archive |
| Crafted, never downloaded | email the link at 30 days, again at 60, delete at **12 months** |
| Signed up, never crafted | delete the account at **90 days** |
| Print ordered | keep indefinitely — it is an order record |

Ninety days is right for an abandoned account. It is wrong for anything paid
for: deleting a customer's purchase three months on invites complaints and
chargebacks, and there is no cost argument for it. Ten renders is roughly 20MB,
so a thousand customers is 20GB — pennies.

**All of this must be written into the terms before anyone buys.** A retention
policy only protects the studio if the customer agreed to it beforehand.

---

## 6 · WHAT THIS CHANGES IN THE BUILD

**Glass**
1. Craft button drops the percentage and the dollar figure.
2. The eighth card stops quoting a discount.
3. The credit purchase screen gains the 200 and 300 blocks. **Unbuilt.**
4. The Curator gains the name question. **Unbuilt.**
5. The entry gate gains the consent checkbox. **Unbuilt.**

**Route and schema**
6. `/api/v1/credits/gate` must spend `count × cost_per`, not `count`.
   Today it spends the image count, so a five-image craft costs 5 credits
   instead of 50. Blocked on reading `009_credits_and_codes.sql` — the fix
   depends on whether `spend_credits(p_n)` counts credits or images.
7. `redeem_code` writes no redemption row on the admin path, so `RHONE3166`
   cannot authorise a craft.
8. `resolveOwner` still carries a guest path. Guest was removed.
9. The route header cites spec v3. v4 is locked.
10. The per-account fulfilment flag does not exist. Without it a tester places
    a real, billable Prodigi order.
11. Consent, name, and retention timestamps need columns.

---

## 7 · STILL OPEN

1. Sign-in before upload, or before craft?
2. Does the Curator's name question happen once, or can it be revisited?
3. Who runs the retention job, and does deletion notify?
4. Print Shop payment behind a password **and** the fulfilment flag — the
   password keeps others out, the flag stops Rich placing a live order by
   accident while testing. Both, not either.
