# THE COMMUNITY BOARD · SPEC v1 · 2026-08-10

`docs/GOVERNANCE/`

Worked out with Rich, 10 August 2026. Not built yet. Read before wiring.

Written against the live schema as it stood this morning — `collection_pieces`,
`identity_map`, `credit_balances` — not against a document.

---

## WHAT IT IS

A single public board of Crafted Images that customers chose to show, and a
separate board of ideas for effects they wish existed.

It is not a feed and it is not a profile system. There are no followers, no
threads, no direct messages. One wall, newest first, with a heart and a
comment under each piece. Everything past that is a moderation surface Rich
would have to staff.

**The point of it is the last line of the page**, not the first: someone sees
a finish they like, presses one button, and lands in the workshop with that
effect already lit. A board that does not do that is a screensaver.

---

## THE FIVE THINGS SOMEBODY CAN DO

1. **Post** a piece from My Collection, with consent given at the moment of
   posting.
2. **Heart** somebody else's piece. Once, ever, per piece.
3. **Comment** on a piece.
4. **Craft it** — land in Portraits with that effect selected and pulsing.
5. **Leave an idea** on *What are your ideas?* — a separate board for effects
   they would like to see, with no image attached.

Nothing else. Not in v1.

---

## POSTING, AND CONSENT

The **Favourite** control lives on each piece in My Collection. Pressing it
opens a short modal — not a checkbox buried in the terms.

> **Show this on the community board?**
>
> It will be visible to anyone who visits Liten & Co, with your handle
> beneath it.
>
> ☐ This is my own photograph, or I have the permission of the person in it.
>
> You can take it down at any time, and it goes immediately.
>
> [ Not now ]  [ Post it ]

**The tick is required and is never pre-checked.** The button stays inert
until it is ticked. `consented_at` and the exact wording version are written
to the row, so what somebody agreed to can be reconstructed a year later.

### Why a modal and not the terms

The industry standard is to push this into the terms of service and disclaim
responsibility — Photographe.ai's terms say the user must have obtained all
necessary rights and that they are not responsible for improper use. It is
cheap and it is thin. Midjourney goes further the other way: every generation
is public in the community feed by default, and hiding it is a paid add-on on
higher tiers, which is exactly why it gets named as the least private of the
major tools.

We are a portrait studio. **A customer's face is the product**, and the
photograph they uploaded is very often of somebody who is not them — a
partner, a parent, a child. Consent given once at signup does not cover a
photograph of somebody's sister uploaded four months later. It is asked per
post because it is a different question every time.

### Taking it down

One control on the post and one in My Collection. It disappears from the
board immediately — no review, no "are you sure" beyond a single confirm. The
row is soft-deleted rather than dropped, so the hearts and comments do not
become orphans, but nothing renders.

**Withdrawal is never negotiated.** A customer who wants their face off a
public page gets it off the page.

---

## HANDLES

`identity_map` has `owner_key`, `user_id` and `email`. It has no handle, and a
UUID under somebody's portrait reads as machine output.

**Chosen at first post, not at signup.** Somebody who never posts is never
asked to invent a name for themselves.

- Suggested default: the part of their email before the `@` (rich1hone).
- They can type whatever they like within the guidelines below.
- Unique, case-insensitive, 3–20 characters, letters, numbers, hyphen,
  underscore.
- Changeable from Account. Old handle released after 30 days, so a
  well-known name cannot be grabbed the moment somebody edits it.
- Never the email address, and the email never appears on the board.

Handles are subject to the same guidelines as comments. A handle that is a
slur is a moderation problem that appears on every post at once.

---

## MODERATION

**Classify on submit, hold the flagged, publish the rest.** A queue that holds
everything means an empty board on a Sunday; publishing everything means the
first bad comment is public for as long as it takes Rich to notice.

Applied to comments, ideas and handles — the text surfaces. Images are already
gated at craft time and are not re-classified here.

Held for: hate speech, sexual content, vulgarity, bullying or targeted abuse,
and anything naming a real private person.

### The digest

**Twice a day, by email, to Rich.** Morning and evening. It carries every held
item with its text, its handle, the reason it was held, and a one-click
approve or reject link.

An empty digest is still sent. A digest that only arrives when something is
wrong is a digest whose absence means nothing.

### The Admin tab

An eighth tab, **Community**. Held items, published items, reports, and the
ability to remove anything. Removal by Rich is silent — the poster is not
told, because a note explaining why a comment was removed is an invitation to
argue about it.

### Reporting

A quiet **Report** on every post and comment. No public count, no visible
outcome. Three reports on one item pulls it from the board pending Rich, which
means a small number of people can hide something briefly — acceptable, since
the alternative is that abuse stays up until the next digest.

---

## HEARTS

One per person per piece, permanent, no un-hearting. Uniqueness on
`(post_id, owner_key)`.

Un-hearting exists to let people manage how they look to others, which is a
feed problem, and we are not building a feed. It also makes the count a
stable number rather than something that can be farmed by toggling.

The count is visible. The identities of who hearted are not, ever.

---

## COMMENTS

Plain text, 500 characters, no images, no links, no replies. Newest last.

**No threading.** A thread is where a board turns into an argument, and an
argument is a moderation queue Rich has to read.

The poster can delete any comment on their own piece without giving a reason.
That is the single most effective moderation tool there is and it costs
nothing.

---

## WHAT ARE YOUR IDEAS?

A separate board. No images, no crafting, just text: effects people wish
existed. Same classifier, same digest, same handles. Hearts, so Rich can see
what is actually wanted rather than what is loudest.

**Rich can mark an idea `built`.** It gets a small mark and moves nothing —
but somebody who suggested Origami in September and sees it marked built in
November is a customer for life.

---

## CRAFT IT — THE DEEP LINK

The button that makes the board worth having.

**From the board:** `/portraits?effect=<effect_id>`

**Portraits must, on arrival with that parameter:**

1. Open the room the effect belongs to, resolved from the effect registry —
   never from a silo id in the URL, which would rot the first time an effect
   moved room.
2. Scroll the tile into view.
3. Pulse it. The gold ring from `concierge.js` already does exactly this and
   is already loaded on the page — reuse it rather than writing a second
   pulse that drifts from the first.
4. **Not select it.** Arriving with something already on the rail is the
   page making a purchase decision on somebody's behalf. Show them where it
   is; let them press it.

An unknown or retired effect id lands on the silo floor with no pulse and no
error. A dead link from a six-month-old post should look like a normal
arrival, not a fault.

The same mechanism serves the gallery, which has wanted it since it was
built and currently just drops people on `/portraits`.

---

## THE SCHEMA

`018_community.sql` — note **016 is already taken by `error_log`**, and
`016_support_messages.sql` is sitting untracked and needs renumbering too.

```
community_handles
  owner_key      text primary key       -- joins identity_map
  handle         text unique not null   -- case-insensitive unique
  created_at     timestamptz
  changed_at     timestamptz

community_posts
  id             uuid primary key
  piece_id       uuid not null          -- collection_pieces.id
  owner_key      text not null
  effect_id      text not null          -- denormalised from the piece: the
                                        -- board must survive a piece being
                                        -- archived, and the deep link needs
                                        -- it without a join
  series         text not null
  image_path     text not null          -- likewise denormalised
  consented_at   timestamptz not null
  consent_text   text not null          -- the exact wording they agreed to
  state          text not null          -- live | withdrawn | removed
  heart_count    integer not null       -- kept on the row; a count(*) on
                                        -- every card is the query that kills
                                        -- the page at a thousand posts
  created_at     timestamptz

community_hearts
  post_id        uuid
  owner_key      text
  created_at     timestamptz
  primary key (post_id, owner_key)      -- once, ever, enforced by the key
                                        -- rather than by the glass

community_comments
  id             uuid primary key
  post_id        uuid                   -- null for an idea
  owner_key      text not null
  body           text not null
  kind           text not null          -- comment | idea
  state          text not null          -- held | live | removed
  held_reason    text
  built          boolean                -- ideas only
  created_at     timestamptz

community_reports
  id             uuid primary key
  target_kind    text                   -- post | comment
  target_id      uuid
  owner_key      text
  created_at     timestamptz
  unique (target_kind, target_id, owner_key)
```

**Everything is keyed on `owner_key`**, matching every other table in the
build. `user_id` is nullable throughout the schema and posting requires an
account anyway, but consistency beats correctness-in-isolation here.

---

## THE ROUTES

```
GET    /api/v1/community/posts          page of live posts, newest first
POST   /api/v1/community/posts          post a piece; requires consent + handle
DELETE /api/v1/community/posts/:id      withdraw; poster only
POST   /api/v1/community/hearts/:id     once; second call is a no-op, not error
GET    /api/v1/community/comments/:id   comments on a post
POST   /api/v1/community/comments       comment or idea; classified on write
DELETE /api/v1/community/comments/:id   poster or comment author
POST   /api/v1/community/reports        quiet
GET    /api/v1/community/handle         mine
PUT    /api/v1/community/handle         set or change
```

Admin sits under `/api/admin/community/`, behind the existing admin auth.

---

## WHERE IT LIVES

**A page, `/community`** — not a panel. My Collection and Print Shop are
panels because they are the customer's own things and belong over the work.
The board is somewhere you go and spend time, it wants a URL somebody can
send to a friend, and it needs to be crawlable if it is ever to bring anybody
in.

In the masthead nav, between Gallery and Print Shop.

---

## SETTLED SINCE, 10 AUGUST

**Signed-out visitors can see the board.** Hearting and commenting need an
account. It is the only page on the site that could bring somebody in from
outside, which makes it a marketing surface before it is a community one, and
a marketing surface behind a sign-in wall is a locked shop window.

**Withdrawn posts do not keep their hearts.** Re-posting is a fresh piece.

**The classifier is `omni-moderation-latest`**, escalating only ambiguous
cases to 4o-mini. Confirmed against OpenAI's own documentation on 10 August:
the moderation endpoint is free to use, takes text and images up to 20MB, and
does not count against usage limits. It can therefore check the posted image
as well as the words under it, which was not the plan and is worth having.

### Rate limits

**No monthly cap on posts.** Posting already costs a craft, so the ceiling is
economic and the customer already paid it. A customer who crafted thirty
pieces and wants to show fifteen of them is the best marketing we will ever
get, and *"you have posted enough this month"* is a strange sentence for a
studio to say to somebody spending money.

- **3 posts an hour.** A burst brake, not a ration.
- **10 comments an hour.** This is where the ceiling actually belongs — a
  comment is free, which makes it the only surface a bored person can flood.
- **One post per piece, ever.** Enforced by uniqueness on `piece_id`.

### Nobody posts into a void

At forty accounts the risk is not abuse, it is an empty wall. **Seed it with
twenty to thirty studio pieces under a `Liten & Co` handle before it opens**,
and put the first genuine customer post at the top of the board rather than
in date order for its first week.

An empty community board is worse than no community board: it is public
evidence that nobody is here.

### Hearts buy nothing. Posting does.

**Hearts earn no credit, ever.** The moment twenty hearts is worth a free
craft, twenty hearts is a thing to manufacture, and the board fills with
whatever is cheapest to heart. Nothing stops that, because hearting costs the
person doing it nothing at all.

**Ten posts earns one free craft.** This one holds where hearts do not,
because a post requires a craft and a craft costs credits: ten posts is
roughly a hundred credits already spent. It is a ten per cent rebate on work
the customer chose to show in public, which is precisely the behaviour worth
paying for. The gate is economic, so there is nothing to game — the only way
to reach ten is to buy ten.

Two guards, without which it is farmable:

- **A piece counts once, ever.** Withdrawing and re-posting does not earn a
  second time. Counted against `piece_id`, not against post rows.
- **Only live posts count.** Held, withdrawn and removed posts do not, or the
  cheapest route to a free craft is ten posts nobody was ever meant to see.

The credit lands with reason `community_ten` in `credit_ledger`, so it can be
counted separately from purchases when the numbers are read.

**Curator's Choice sits on top of this**, weekly, picked by Rich by hand.
Unspammable because it is not a rule at all — no threshold, no number, only
somebody's judgement — and a better story than a leaderboard.

---

## OPEN

- Rate-limit copy. What the third post in an hour is told, in the Concierge's
  register rather than an error's.
- Whether the seeded studio pieces are marked as ours on the card. Leaning
  yes — passing off house work as a customer's is the kind of small lie that
  is expensive when somebody notices.
- Handle squatting at launch. Forty accounts, no real pressure yet, but the
  first hundred people will take the good names.
- Whether an idea marked `built` links to the effect it became.

---

*CUI · 10 August 2026*
