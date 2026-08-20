# CUI -> CENG · COMMUNITY · POSTING, LIKES, FEEDBACK · 20 August 2026

`docs/GOVERNANCE/`

Rich's ruling, 20 August. This is a framing document, not a contract. The
shape and the constraints are settled; the tables, the routes and the
column names are CENG's to design and CENG's to own.

Written by CUI because the glass has to know what to draw. **Do not build to
this document where it disagrees with the code.** That is the mistake that
cost a morning on the Groups plate contract - a handoff asserted twenty-eight
filenames and the directory disagreed on twenty-three of them. Read the
files.

---

## THE SHAPE, IN ONE PARAGRAPH

A customer opens a piece in My Collection and posts it to Community. Anybody
can look at the board and like what is on it, signed in or not, once per
image. There are no comments. There are no captions. Bug reports and site
feedback go somewhere else entirely - a private form that Rich reads, which
never renders on the site.

---

## THE DECISION THAT MAKES THE REST EASY

**No user-generated text is ever public on litenco.com.**

Comments were considered and dropped. Captions were considered and dropped.
A caption is free text wearing a hat, and it carries the same moderation
burden as a comment for a fraction of the value - people come to Community
to look at pieces, not to read each other.

A post is therefore: the image, the effect name, and a first name. Any words
around it are the Curator's, and **Curator lines are prompt text and go
through CENG, never CUI**.

The practical worth of this is that it is one sentence to a lawyer and one
sentence to a customer. It also means the text-moderation endpoint is not in
this feature at all.

---

## 1 · POSTING

From My Collection only. A piece must exist and belong to the person posting
it; nothing is uploaded to Community directly, ever. Every posted image has
already been through the craft pipeline from a photograph the customer
supplied, which is a materially lower risk surface than arbitrary upload and
should inform how heavy the gate needs to be.

### The gate is synchronous

Post -> moderate -> live, or post -> refused, in one round trip. The customer
finds out now.

**Do not hold a post for review.** A queue was considered and rejected: it is
the worst of both outcomes, because the customer waits and a bad image can
still land at the end of the wait. Either the system can decide or it cannot,
and for image moderation it can.

A refusal says plainly that the piece will not go on the board. It does not
say which classifier fired, it does not offer an appeal path, and it does not
tell the customer what to change - that last one is a instruction manual for
getting round the gate.

The piece stays in My Collection. Refusing a post is not confiscation.

### Repeated attempts are rate limited, not punished

Three refusals in an hour and posting is off for that account for twenty-four
hours. No email, no warning escalation, no human in the loop.

An email to the customer was considered and dropped. It converts a quiet
refusal into a correspondence, and the only person it reaches reliably is the
one who was trying.

### Withdrawing

The person who posted a piece can take it off the board. Their piece, their
call. What happens to the likes it accrued is CENG's to decide - CUI has no
opinion beyond that the number must not resurrect if the same piece is
posted again.

---

## 2 · LIKES

Anonymous. Signed in or not. **One per IP per image.**

Rich's words, and the constraint that shapes the storage: whatever is kept
must not be a log of who looked at what. A salted hash of IP and post id, and
nothing that reverses to an address, is the shape CUI would expect - but this
is CENG's call and CENG's table.

**A like is reversible.** Somebody who taps by accident can tap again. A
one-way counter turns a misclick into a permanent one, and irreversibility
here buys nothing.

The count is the only thing the glass renders. No list of who liked, no
ordering by liker, no notification to the person who posted.

### What CUI needs back

A count, and whether this viewer has already liked it. Both on the board
payload, so the floor paints in one pass rather than a request per card.

---

## 3 · FEEDBACK AND BUG REPORTS

**Private. Never public. Not part of Community.**

A structured form: a category, and one free text field. It goes to Rich. It
does not render anywhere on the site, which is precisely why it needs no
moderation gate - there is no audience to protect.

Categories are Rich's to name. CUI's guess, for something to argue with:
something is broken, something looks wrong, an idea, everything else.

Where it lives is a glass decision and CUI will make it. The reason it is in
this document at all is that it is the thing comments were going to be for,
and it is worth CENG knowing that the interactive surface of the site is
these two features and nothing more.

---

## 4 · WHAT THE GLASS WILL ASK FOR

Stated as need, not as contract. Name these whatever fits the schema.

**The board.** A page of posts. Each carries the image, the effect name, a
first name, a like count, and whether this viewer has liked it. Paged - the
board is expected to grow and the floor should not fetch all of it.

**Post a piece.** Takes a piece id. Returns live, or refused. Nothing else.

**Like and unlike.** Takes a post id. Returns the new count.

**Send feedback.** Takes a category and a body. Returns received.

---

## 5 · WHAT CUI IS NOT ASKING FOR, DELIBERATELY

- Comments, replies, threads.
- Captions or any customer-written text on a post.
- Following, profiles, or any way to see everything one person posted.
- Notifications of any kind.
- Sorting by popularity. Ranking by likes turns a board into a leaderboard
  and starts rewarding the wrong thing on a page whose only job is to show
  that real people make these.

If any of these arrive later they arrive as a decision, not as a default.

---

## 6 · THE OPEN QUESTION CUI CANNOT ANSWER

**The board has never had a real post through it.** Carried from V28 and
still true. An empty board and a broken view are indistinguishable, so the
first thing worth doing after this exists is putting one piece through it and
looking at the result.

---

## 7 · STILL OWED, SEPARATELY

`collection_pieces` columns, which CENG has flagged as the only thing the
engine is blocked on. Studio `keep` cannot write a piece row and
`app/api/v1/wallpapers/studio/kept` cannot be built without them - and that
route has now been missing across two carryovers, with `readUnlock()` calling
it on every load and the unlock counter reading zero for every customer.

It fails soft, which is why it has survived. It is also the free-sixth
counter, which is a conversion mechanism sitting at zero.

Not part of Community. Named here because it is the same conversation.

---

*CUI · 20 August 2026*
