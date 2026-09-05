# CENG -> CUI - OPEN DOORS - 25 August 2026

The entry model changes. Rich's ruling, this morning:

> "I want the site browseable by anyone. so someone CAN skip using the
> passcode and have an account, they just start paying immediately for
> crafting."

**Browse free. Account at the moment of intent. Passcode is a coupon, not a
wall - optional, worth 50 credits.**

This supersedes the site-wide passcode gate. The engine work and the glass
work are separable; sequencing at the bottom matters.

---

## THE MODEL

| person | what they see | what they pay |
|---|---|---|
| anyone with the URL | the whole site, browsable | nothing until they act |
| acts without invite code | sign-in card at craft/buy | pays from the first craft |
| acts with invite code | same card, code entered | 50 credits waiting after sign-in |

Two account types, one flow, one card.

---

## GLASS (yours)

**1. The welcome screen replaces the gate as first contact.**
A screen, not a wall: dismissed by a single click, no fields. Copy is
Rich's to write. After dismissal, the visitor is on the site, browsing.
(Whether it shows once per browser or every visit is Rich's call - state it
in your build note either way.)

**2. The sign-in card moves to the moment of intent.**
Triggers: any craft attempt, any credit purchase, while unsigned. The
engine already answers `not_signed_in` (401) on every gated route - that
answer IS the trigger; nothing needs pre-checking.

**3. The card gains an OPTIONAL invite-code field.**
- Email: required, as now
- Invite code: optional, framed as the gift it is - "Have an invite code?
  50 credits on us" (Rich's copy, final wording his)
- Code present -> POST `/api/v1/invite` with `{ email, code }` - NOTE THE
  NEW `code` FIELD, see engine below - then the normal signin path
- Code absent -> straight to the signin path, no invite POST
- Wrong code -> the route answers `{ ok:false, reason:'bad_code' }`;
  show it plainly, let them fix or clear the field, do not block signin

**4. Copy corrections riding along** (from the 24 August list):
- Anywhere saying "80 complimentary credits" / "eight images" -> **50 / five**
- Activity feed: `launch_grant` ledger rows need a label - "Welcome
  credits" or Rich's wording
- The family message should say "check spam" - Yahoo defers our mail ~5
  minutes

---

## ENGINE (mine, sequenced)

**A. `/api/v1/invite` checks the passcode itself.** Today it trusts the
middleware to have checked - with the wall gone, a bare POST would hand 50
credits to anyone who finds the endpoint. It gains a `code` field checked
against `LITEN_ACCESS_CODE` server-side; wrong or missing code answers
`bad_code` and records nothing. **This lands BEFORE the wall drops.**

**B. The middleware wall comes off.** Page requests stop being gated.
`?access=` links keep working (they become a courtesy that pre-fills
nothing but still records+mails if valid - exact behaviour in the build
note when I write it).

**C. Nothing else moves.** Claim, grant, magic links, ledger - all as
shipped and tested this morning.

---

## SEQUENCING - THE ONE RULE

**A ships before B.** Between the wall dropping and the code check
existing, the invite endpoint is a free-credits tap. I will ship them in
one PR so there is no between.

Glass can build in parallel against this spec today; nothing above blocks
on engine timing except that the welcome screen replacing the gate assumes
B is live.

---

*CENG 41 - 25 August 2026*
