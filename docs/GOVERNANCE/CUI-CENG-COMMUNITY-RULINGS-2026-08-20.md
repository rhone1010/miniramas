# CUI -> CENG · COMMUNITY · RICH'S RULINGS · 20 August 2026

`docs/GOVERNANCE/`

**This supersedes `CUI-CENG-COMMUNITY-2026-08-20.md` entirely.** Archive that
document. It specified a design without reading `app/api/v1/community` or
`COMMUNITY-BOARD-SPEC-2026-08-10.md` first, and CENG built a parallel set
from it before discovering the original. That was CUI's error. The built
version is the reasoned one and wins by default except where Rich has ruled
otherwise below.

`COMMUNITY-BOARD-SPEC-2026-08-10.md` remains the spec. Read the files, not
this document, wherever the two disagree.

---

## THE FOUR CONFLICTS, RULED

**1 · Handles stay. Built version wins.**

A post requires a handle and `CONSENT_TEXT_V1` promises it appears beneath
the piece. Customers have already agreed to those words. Changing the
behaviour now means new consent from everybody who has already given it,
which is a far larger job than the change is worth.

**2 · Comments are out. Rich's ruling.**

Remove them from the offer. The routes exist and are finished - whether they
are archived or simply left unreachable is CENG's call, and leaving them
unreachable is the smaller change.

What comments were for is now served by the feedback form, which is private,
never renders publicly, and asks two questions: what is wrong with the page,
and what is wrong with the site. `app/api/v1/feedback/route.ts` is installed.

This is not a community in the social sense. It is a board that shows what
people have made.

**3 · Hearts are once ever for signed-in customers. Built version wins.**

No un-hearting. The route's own argument settles it: un-hearting is a feed
problem and this is not a feed. Better than the reasoning in the superseded
document.

**4 · One free heart, then the invitation. Rich's ruling, and it replaces
both earlier positions.**

The built version requires an account to heart at all. The superseded
document said anonymous, one per IP. Neither is right.

**A visitor with no account gets one heart. Total, across the whole board -
not one per piece.** They spend it wherever they like.

When they reach for a second, they are told - warmly - that we appreciate
how much they are enjoying the work, and invited to sign up so they can
leave more.

Why this is the right shape:

- The board's only job is bringing strangers in. A stranger who feels
  something about a piece and has no way to say so is the failure this
  feature exists to avoid.
- The prompt arrives at the one moment a person has *demonstrated*
  enthusiasm. That is the warmest place a signup ask can sit, and it
  withholds nothing - they already gave their heart.
- It solves the bot problem almost incidentally. IP was never a real
  defence: an attacker rents a thousand addresses cheaply, while an office
  or a mobile network shares one, so real people get blocked and the
  attacker does not. A ceiling of one per token means flooding costs real
  effort for a number that earns nothing.

### What this needs

- An anonymous heart is spent against a browser token, not an IP. A random
  id, stored client-side. CUI's to mint and send; the shape of what the
  route wants back is CENG's to name.
- **The free heart must survive signup.** Somebody who hearts, signs up, and
  returns must not find their heart gone. The token's heart transfers to the
  account on first sign-in. This is the detail most likely to be dropped and
  the one most likely to be noticed.
- A rate limit on unauthenticated hearts per piece, as a floor under the
  token scheme. Token forgery is cheap enough that the ceiling should not be
  the only defence.
- Anonymous hearts display. Whether they count toward
  `community_award_posts` or any future ranking is CENG's call - CUI's view
  is that they should not. The number on the card is warmth; the number in
  the ledger is trust.

**The words are Curator lines and go through CENG, never CUI.** The framing
above is what the line should mean, not what it should say.

---

## POSTING EARNS · UNTOUCHED

Ten live posts is a free craft, via `community_award_posts`. Not in conflict
with anything above and not ruled on. It stands.

---

## TWO THINGS TO VERIFY BEFORE ANY OF THIS MATTERS

**The board has never had one real post through it.** An empty board and a
broken view are indistinguishable. Carried from V28, still true, and it is
the first thing worth doing.

**The bucket mismatch is a bug, and the fault is entirely on the Studio
side.** Verified against `app/api/v1/portraits/pieces/route.ts`, 20 August:

```
BUCKET       = 'collection'
image_path   = `${ownerKey}/${pieceId}.jpg`
```

Bare path, no bucket prefix, scoped by owner. Every read signs
`image_path` against `BUCKET`.

So `posts/route.ts` hardcoding `collection` is **correct** and should not be
touched. The Studio's `keep` breaks the convention twice over: it writes to
bucket `previews`, which is private, and it stores `previews/studio/<id>.jpg`
- a path carrying a bucket prefix where the convention expects an owner key.
Either fault alone returns null on the board.

The fix is Studio `keep` writing `${ownerKey}/${pieceId}.jpg` into
`collection`, like everything else. Anything already written under the old
shape needs moving or it stays invisible.

Worth saying plainly: null images on a board nobody has posted to look
exactly like a board nobody has posted to. That is how this stayed hidden,
and it is why the real post below comes first.

---

## WHAT CUI GOT WRONG, RECORDED

CUI's earlier document carried a "still owed" section demanding the
`collection_pieces` columns and the `studio/kept` route. **Both were
delivered yesterday and committed.** `keep` writes a piece row, `kept`
exists at `app/api/v1/wallpapers/studio/kept/route.ts`, and the free-sixth
counter is built and working.

That section was carried forward from the V28 open items without checking
whether it was still true - the same fault that produced the superseded
document, and the same fault that cost a morning on the Groups plate
contract. Recorded here rather than quietly dropped, because it is the third
instance of one pattern: **asserting state instead of reading it.**

---

*CUI · 20 August 2026*
