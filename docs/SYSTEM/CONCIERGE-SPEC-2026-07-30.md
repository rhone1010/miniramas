# CONCIERGE — the help surface

**2026-07-30 · ruled by Rich in session · drafted CUI V23**
**Status: SPEC. Nothing built.**

Supersedes every reference to "Help" as a masthead link. The surface is called
**Concierge** and it is a chat AI, not a page of articles.

---

## 1 · WHAT IT REPLACES

`litenco-failure-recovery-2026-07-21-r02.html` carries this note under state 4:

> *Likeness dispute (post-delivery): a customer who says a delivered piece
> doesn't look like them lands on this modal from My Collection → Help. Offer
> re-craft (free) first, refund second. Never argue likeness.*

That is a service policy sitting in a comment in a prototype. It moves here.

**⚠ It also conflicts with a later ruling and the conflict is unresolved.**
Ruled 2026-07-29: a customer gets **two re-renders per account**, then the
action disappears. The note above says re-craft is offered free on a
post-delivery dispute. If someone has spent both and then says a delivered
piece does not look like them, the two rules disagree.

Concierge has to know which wins before it can answer anybody. **Open.**

---

## 2 · WHERE IT IS ENTERED

A link at the foot of three surfaces:

- My Collection
- Print Shop
- Account

Reading **"Having a problem?"** — launches Concierge.

Not the masthead. The masthead link is how someone browses to help; this is
how someone in trouble reaches it from where the trouble is.

---

## 3 · THE THREE OPENERS

The chat opens with three prepopulated choices. They lead the conversation
rather than waiting for a customer to phrase their own problem.

| Opener | Leads to |
|---|---|
| **Unhappy With Image** | §4 disputes |
| **Other Items** | orders, prints, delivery, account |
| **Something Else** | §5 general, §6 escalation |

---

## 4 · DISPUTES

**Concierge may refund up to $50** on its own authority. The amount depends on
what is being asked and the conditions of the piece. Above $50 it escalates.

### 4.1 The score decides the first offer

If a piece **barely passed** the likeness gate — Rich's example, 81 on an
80–100 scale — Concierge opens with a choice rather than an argument:

> credits toward other images **or** a refund

A piece that passed comfortably gets the ordinary flow. A piece that barely
passed is one the studio nearly rejected itself, and the customer is right.

**⚠ BLOCKING: nothing stores this score.** See `QUALITY-GATE-DATA-2026-07-30.md`
§4. `likeness_score` has to be persisted on the piece record before any of §4.1
can be built, and it belongs in the same migration as `focal_x` / `focal_y` /
`subject_regions` rather than a second one afterwards.

**⚠ Also: the scale is 0–10, not 0–100.** `PASS_SINGLE = 8`,
`PASS_RELAXED = 7`. Rich's 81 is an 8.1. Either the engine's scale changes or
Concierge's thresholds are stated in tenths. One or the other, not both.

### 4.2 Persistence

A customer who keeps pushing gets refunded. Standard dispute-tree behaviour:
concede rather than win. The cost of a refund is smaller than the cost of an
argument, and the studio's whole position is that no piece reaches anyone
unless it is right.

**Never argue likeness.** Carried from the r02 note and worth keeping in those
words.

---

## 5 · GENERAL HELP

- guidance toward other Series
- how the system works
- how to reach a person

**The target is 99% handled by the AI.** A human is reached only for a
meaningful reason, and Concierge decides what qualifies.

---

## 6 · ESCALATION — what reaches Rich

Three categories only:

- **legal** — anything genuinely legal
- **business opportunity** — buyout, collaboration, partnership, anything an
  entity is offering *to* Liten & Co
- **PR**

### 6.1 Concierge vets before forwarding

It does a first-round pass and gathers enough to tell a real approach from
noise:

- who is the contact
- who do they work for
- what is the inquiry, in substance
- a quick dive on the source and the subject matter

Filtering out spam, nuisance, malware and phishing is Concierge's job, not
Rich's. Only what survives that pass is forwarded.

**Forwarded with the research attached**, not just the message. The point of
the vetting is that Rich reads a briefed inquiry rather than a raw one.

---

## 7 · WHAT IS NOT DECIDED

1. **The conflict in §1.** Post-delivery dispute versus the two-per-account
   re-render cap. Blocks the dispute tree.
2. **The scale.** 0–10 or 0–100. Blocks §4.1.
3. Which model runs Concierge, and whether it reads the customer's account,
   ledger and pieces or is told about them per conversation.
4. Whether a refund it authorises moves money or credits. Everything else in
   the system returns credits; §4 says "$50", which is money.
5. Retention and review of Concierge transcripts. A dispute log is a business
   record.
6. What Concierge says when it cannot help and will not escalate. The hardest
   copy in the product and the easiest to leave until it is being written live.
