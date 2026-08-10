# CARRYOVER · CUI V27 · 2026-08-09

**Read this before touching anything.** Every line was true when it was
written. Where a line number or a file's contents appear, re-read the live
file before relying on it.

If you are a fresh Claude opening this cold, read section 0 first. The last
one lost an hour to not knowing what Liten & Co was, and asked Rich
questions the answers to which were already written down.

---

## 0 · WHAT THIS IS, AND WHO YOU ARE TALKING TO

**Liten & Co turns a customer's photograph into a crafted portrait.** They
upload one picture, choose a finish, and the studio makes a new image from
it — the same face in bronze, in stained glass, in oil, or in another
century. It is not a filter over the photograph; it is a new work made from
it, and the whole product rests on the likeness surviving the material.

The output is a digital file the customer owns outright, and it can be sent
to print — framed, glazed, delivered — through Prodigi. **The print is where
the money is.** A craft is a few cents of compute; a framed twelve-inch
print sells at $94 and lands about 50% over landed cost. That asymmetry is
the reason the gift catalogue exists and the reason the homepage spends its
second fold proving the likeness rather than explaining the technology.

**Rich Hone is the whole company.** Solo founder, creative director,
non-technical operator, about thirty years in marketing and media
production. He has been building this for roughly five to six months, almost
entirely alongside Claude, and he writes no code himself — every file you
produce must be complete and every commit command must arrive in the same
message as the files it commits. He is the sole visual judge; his sign-off
overrides any quality opinion you hold, permanently.

**Where it stands on 9 August 2026.** `litenco.com` is live behind an
invitation gate. Portraits is the only Series that works and the only one
launching. Fifty-six finishes across eight silos. The money path is proven
end to end — pay, webhook, credits, craft, piece saved, print order placed
at Prodigi in sandbox. Nobody has been charged real money yet, and the plan
is a soft launch to family and friends with 80 free credits each, holding
paid credits back roughly two weeks.

**Where it is going.** Two more Series inside a month, each with its own
workshop — Pets and Groups are named and partly built. A gift catalogue that
sells the framed print with the craft included, scoped in
`GIFT-SYSTEM-SPEC-2026-08-08.md` and not started. A Q4 Christmas campaign
built on TikTok organic and YouTube bumpers. The strategic bet is that
people will pay object prices for an object and file prices for a file, and
that the object is what makes this a business.

**The vocabulary matters and Rich enforces it.** Crafted Images, capital C
capital I. *Craft* is the verb. *Effects*, not finishes, in customer UI —
though "finish" survives in the gallery's own copy where it reads better.
Never *sculpt*, *sculpture*, *render* as a customer-facing verb, *queue*,
*off*, *save*, or *discount*. **Nav is by Series, never by stage** — the
workshop is where you are once you are inside a Series, so "Workshop" is not
a destination and was removed from the mobile bar on 9 August.

---

## 1 · WHAT WENT LIVE TODAY

A long session. In rough order.

**The gallery** at `/gallery`. Every live finish, drawn from
`effect-registry.js` and the preview manifest — nothing about the catalogue
is restated in the page, so a finish added to `effect-registry.ts` appears
after the emit with no edit. Men and women run in two columns side by side
rather than behind a toggle, which is the page's whole idea: nobody presses
anything to find out whether a finish was made for them. It draws 56 tiles,
not 63, because Another Age's seven `_woman` ids are craft routes rather
than separate finishes and printing them would draw that room twice.

**900px gallery plates.** The previews were 390px and a tile draws at 430
CSS pixels, which on the 2× displays most people use is 860 real ones.
`scripts/build-gallery-plates.py` rebuilds them from the 1024px style-refs
in `lib/v1/portraits/style-refs/` and writes `man@2x.jpg` / `woman@2x.jpg`
alongside the small ones. 106 of 112 built; `petrified_wood` and `plushy`
have no man's plate, and four sources were about 630px so they were copied
rather than upscaled. The gallery asks for `@2x` and falls back on error, so
the manifest never had to learn about it.

**The homepage** at `/`, rebuilt from Rich's v6 mockup. Desktop is a
triptych hero — three full-height panels each turning over on its own clock,
staggered, because three panels changing together reads as a slideshow and
three on their own reads as a room with work in it. Fold two is the likeness
wall: twelve cards turning between the photograph we were given and the
piece made from it, each on its own timer. The finish is held 6.8 seconds
against the photograph's 4 — the photograph is the setup, the finish is the
point.

**Mobile landing.** A full-bleed cross-faded reel, 24 slides at three
seconds, one headline per slide with a blank line carrying the previous one
forward. Then the same likeness wall at six pairs. A bottom bar of Series ·
Gallery · Collection · Help, and a sticky ask that holds back until the reel
is off screen.

**Outpainted plates.** `scripts/outpaint-splash.mjs` sends the near-square
splash images through Stability's outpaint endpoint, padding up and down
only, to reach 9:16. Thirty-six built for about $1.44. Creativity is 0.35
rather than the 0.5 the app pipeline uses — that pipeline extends a
generated scene, this extends a portrait somebody will recognise themselves
in, and a creative outpaint invents shoulders. Output lands in
`splash/tall/` and both the reel and the triptych fall back to the square
plate for anything missing, so a bad result is deleted rather than recovered.

**The help page** at `/help`. Ten questions, terms, privacy, and the
Concierge. Trust questions first — what happens to my photograph, will it
look like the person, what if I don't like it — because a visitor who does
not believe us never reads the how-to.

**Terms and privacy**, drafted and in `docs/GOVERNANCE/`. **Not reviewed by
a lawyer.** They are honest and readable and neither of those is the same as
sufficient.

**The soft-launch grant.** Gate takes an email, `/api/v1/invite` records it
and holds 80 credits as a promise, and `/api/v1/invite/claim` pays it into a
real balance on first sign-in. Capped at 40. Idempotent twice over.

**A real sign-out**, the effect-selection lock, the Curator's pulse, the
Concierge as a shared panel, and `hello@litenco.com` through Resend. All
below.

---

## 2 · THE GRANT CHAIN · read this before touching credits

Four pieces, and the order matters.

1. **The gate** (`middleware.ts`) asks for an email beside the passcode. It
   fires that address at `/api/v1/invite` and forgets. **Middleware does not
   touch the database** — it runs on the edge on the path of every request
   on the site and must stay that way. A failure to record never stops
   somebody getting through a door they have the key to.

2. **`/api/v1/invite`** writes a `launch_invites` row holding 80 credits.
   **The row is a promise, not a balance.** At that moment there is no
   account, so paying credits would mean paying nobody.

3. **`/api/v1/invite/claim`** pays it. Called by the workshop on every
   arrival and does nothing in the common case. `grant_credits(p_owner, p_n,
   p_reason, p_ref)` is idempotent on the ref, and the ref is the email, so
   two tabs racing can only land one grant.

4. **The Curator says so** on the card they are already looking at, rather
   than a modal. Good news should not put a door in front of somebody who
   just arrived wanting to make something.

**THE DESIGN FAULT THAT WAS CORRECTED, AND WHY IT MATTERS.** The grant was
originally keyed to the address typed at the gate. But the gate is
per-browser: somebody through it once is through it for good, so the next
person to sign in on that machine never types an address at the door. Rich
signed in with a fresh email on desktop and got nothing. **The grant belongs
to whoever signs in.** A first sign-in with no invite row now writes its own
and pays immediately, under the same cap. The address at the door is a
record of who accepted the invitation; it is not the thing being paid.

Over the cap, they still get in and are still recorded, just with no grant.
Turning away somebody who typed a passcode a friend gave them is worse than
letting them look around.

**Not built:** the buy button is still visible. Rich's plan is that it turns
on when the free credits are exhausted, and that the Concierge asks *why*
before showing a price — the only chance to hear why somebody stopped.

---

## 3 · THE THINGS THAT COST TIME, AND WHAT THEY TEACH

Every one of these looked like something else.

**A colour token that was never defined.** The gallery's jump pills used
`var(--coffee-700)` for their background and the token did not exist in that
file. No background, near-white text on a near-white bar: seven invisible
pills, and only the gold current one showed. Rich saw one room in a bar that
should have held eight. **A CSS variable that is not defined does not fall
back — it produces no value at all**, and the rule silently does nothing.

**A class name that already existed.** The new homepage fold was called
`.proof`, and `.proof` was already a two-column grid inside the gift fold of
Rich's mockup. The new section inherited its rules and collapsed to the left
third of the page. Renamed `.likeness`. **Grep for a class name before
introducing it into a file you did not write.**

**`overflow-x:hidden` on the body kills every `position:sticky` on the
page.** In Chrome it makes the body a scroll container, and a sticky element
inside a scroll container sticks to nothing. This is why the masthead was
not sticking on the gallery and help pages. `overflow-x:clip` does the same
job without the side effect. This is in the older carryover too and it bit
again.

**`hidden` loses to `display:flex`.** The mobile Series picker was styled
`.m-sheet{display:flex}` and the file had no `[hidden]{display:none}` rule
of its own, so the sheet sat over the reel from first paint. Rich saw a
dimmed homepage with a "Choose a Series" panel over it. **If a component
relies on the `hidden` attribute, write the rule for it in the same block.**

**`app/favicon.ico` beats `public/favicon.ico`.** Next's App Router
convention wins, and the file sitting there was Vercel's default triangle.
The correct favicon had been in `public/` the whole time and was never
serving.

**Files on disk are not files in git.** Twice: the 17 homepage images sat in
`public/previews/home/` uncommitted, and `middleware.ts` was saved to
`public/` instead of the root. Both times the symptom was "it didn't work"
and the cause was a commit that never named the file. **This is on Claude,
not Rich** — every file handed over must arrive with the command that
commits it, in the same message, naming the path.

**A blank cell in a spreadsheet means whatever the legend says it means.**
The reel sheet's legend said a blank keeps what is there; Rich meant drop
it. Also: Excel checkboxes live in a `featurePropertyBag` and read back as
boolean cells in columns a values-only read never touches. If a sheet looks
emptier than the person describes, unzip it and look at `sheet1.xml`.

---

## 4 · THE EFFECT LOCK, THE PULSE AND THE NUDGE

All three in `portraits.html`, all three about the same problem: nothing on
that page can happen without a photograph.

**The lock.** Selecting an effect with no source put a craft in hand with
nothing to craft, which failed at the engine and *still opened My
Collection* — so the customer ended up somewhere new looking at nothing,
which reads as the site losing their work rather than refusing an impossible
request. `hasSource()` now gates the tile handler. **Browsing stays open:**
rooms open, every tile is readable, only adding one to be crafted is held.

**The pulse.** There was none in the file — not disabled, never built,
despite Rich asking more than once. It breathes rather than blinks, because
a hard flash on a page that calm reads as an error and browsing is not an
error. **It runs from first paint.** It originally waited 25 seconds or a
room-opening on the reasoning that pulsing immediately is nagging; that was
wrong here, because the slot is not nagging, it is saying where to begin.

**The nudge.** A tooltip on the tile that was pressed, positioned above it
or below when the tile is near the top of the window. Not a modal — a modal
for this is a door slammed in front of somebody who was only browsing. A
refused click also gives the Curator's slot a harder beat than the resting
pulse, so the answer to "why did nothing happen" is visible in one glance.

**Mixed sitters.** `SUBJECT` is null until a face is seen and the old plate
fallback took `f[0]` every time — the man's plate on all eight silo cards. A
wall of men tells half the people who land there that this was not made for
them. Now four and four, shuffled once per load and cached so a card cannot
change sitter between two paints. The moment their own photograph lands,
their sitter wins.

---

## 5 · THE CONCIERGE

**One implementation, `public/concierge.js`, loaded by the workshop, the
gallery and the help page.** The help page gave up its own copy: two panels
would be two things to keep in step, and the first time they drifted the
customer would meet two different people. Any element with `data-concierge`
opens her. She injects her own styles, scoped under `.cx-`, because she
drops into a 10,000-line workshop with its own `:root` and its own
box-sizing.

**She is knowledge-only.** No account access, no tools, no writes. This is
deliberate and it is what makes her safe to ship. When the guardrails are
built, **every limit must be enforced in the tool, not the prompt** — a
model with an unbounded refund tool eventually meets a conversation that
talks it past a rule written in prose.

**She is not the Curator.** The Curator lives inside the work — finishes,
the first-run tour, what a photograph will become. The Concierge handles
everything around it: accounts, credits, money, complaints. One line holds
it: **the Curator inside the work, the Concierge outside it.**

**The handoff.** After she has actually answered something, a "Leave a
message instead" button appears. It turns the input into a message box and
posts to `/api/v1/support`, carrying the last eight turns so nobody has to
explain twice. It appears only after she has spoken — a message button
sitting there from first paint tells somebody with a simple question that
she is not going to answer it.

**A prompt fix worth remembering.** Asked "how do I sign out", she said it
was off-topic and referred the customer to "the help section of the platform
you are using" — which *is* this platform. Her prompt now says explicitly
that using the site is her subject, and carries the site's own geography:
where the gallery is, what signing in involves, and that nothing crafts
until a photograph is uploaded. **Being told to stay on topic makes a model
push away things that are plainly on topic.** Say what counts as on topic,
not just what does not.

Guidance: `docs/GOVERNANCE/CONCIERGE-GUIDANCE-2026-08-08.md`. Three rulings
worth knowing without opening it: **she never quotes a score** — a number
invites an argument about the number, and a public threshold becomes a
target. **Three complaints and she stops trying to satisfy**, using the same
words whether the customer is honest or working us, because she cannot tell
which. **She never says the studio is one person** — it tells an angry
customer there is nobody above the desk and everybody else there is nobody
to catch a mistake.

---

## 6 · MAIL

Resend, set up tonight from a fresh account. `litenco.com` verified in three
minutes because Vercel holds the zone and Resend auto-configured it.

**`hello@litenco.com` is the address.** In the help page footer, in the
Concierge's instructions, and as the sender on the auth emails. `support@`
was rejected as reading corporate for a studio.

**Nothing receives at it.** Resend only sends. A reply currently vanishes.
Forwarding to Gmail, or Google Workspace, closes that and should happen
before real customers arrive.

**`/api/v1/support`** takes a message and emails it. **The row is written
before the mail is sent** — mail bounces and APIs have bad days, and what a
customer typed must survive both. The row is the record; the email is the
notification. Reply-to is the customer, from is our domain, because a
message claiming to be from their address fails SPF.

**Auth emails are branded.** Templates in
`docs/GOVERNANCE/email-templates/`, pasted into Supabase → Authentication →
Emails → Templates. Table markup with inline styles, because email clients
are not browsers: Outlook renders through Word and Gmail strips `<style>`.
Garamond will not load, so the sizes are set for Georgia. The bare URL sits
under the button for clients that will not render it.

**SMTP:** Authentication → Emails → SMTP Settings. `smtp.resend.com`, port
465, username `resend`, password the Resend key. **Not Project Settings** —
Claude sent Rich there first and it is not there.

---

## 7 · PRICING, AND THE THING TO GET RIGHT

**Prodigi's shipping is the whole story.** Framed and stretched goods ship
at **$24.80**; paper ships at **$6.85**. A 12″ framed print costs $38 from
Prodigi and $62.80 landed. Fifty per cent on $38 is $57 and loses money.

**Ruled: the shipping is inside the price and delivery is free.** Never
quote a number that does not already have it in. The catalogue prices are
landed cost plus 50%:

Classic frame $94 / $105 / $115 · framed canvas $97 / $115 / $142 · matted
$103 / $112 / $125 · canvas $73 / $85 / $99 · fine-art paper $29 / $31 / $34.

The paper prices look cheap beside the framed ones. They are not — same
margin, different freight.

**The cards are named for the finish, not the product.** Alabaster, Bronze,
Folded Book, Plushy, Mosaic. The object is the kicker line above.

**"Me, Myself and I" needs three photographs**, one from each age. The copy
originally said one was enough and we would find the other two. It was
wrong, and it is the kind of wrong that becomes a refund.

---

## 8 · HOW RICH WORKS · read this before the first message

Carried forward and added to. Every line here was earned.

**Full files, always. Never a line-number insertion, never a placeholder,
never "insert here".** He writes no code.

**The commit command arrives in the same message as the files**, naming
every path, including the branch move to `main`. Production deploys from
`main`; `feature/store-commerce` is the working branch and is fast-forwarded.
Twice tonight a file was handed over without its commit and the time was
lost to finding out why nothing had changed.

**Answer first.** Two or three sentences. No tables, no headers, no long
bullet lists in chat. If he asks for a list, give the list — not the list
plus commentary, and not the same list three times in three formats.

**A screenshot or a mockup is a directive.** Read it, decide, build. It is
not a prompt for clarifying questions.

**Do not diagnose without evidence.** Read the live file in the same message
you make a claim about it. Never say a file contains something you have not
just looked at.

**"Go" / "confirmed" / "locked" are green lights.** Execute; do not re-open.

**Prompt text belongs to Rich.** Never overwrite a prompt body without an
explicit green light — a silent commit once destroyed working prompts.

**PowerShell:** pure ASCII in scripts; em dashes break PS 5.1.
`Select-String` has no `-Recurse`. Every file in the repo is **CRLF**, and
that includes the inside of template literals in `.ts` files — a pattern
written with bare newlines matches nothing. Assert the anchor count before
replacing and let it fail loudly rather than writing an unchanged file.

**Gates on every glass change:** brace balance against the original count,
`new Function()` on each inline script, a jsdom boot, and a count of the
thing you just changed.

**He notices when Claude stalls.** If he asks for something three times,
stop explaining and give it to him.

---

## 9 · STILL OPEN

**Needs Rich**

- A mailbox behind `hello@litenco.com`. Nothing receives today.
- A postal address for the footer. His home address is in the terms draft
  and should not be published — a PO box or registered agent is about $100 a
  year and he will need one for the LLC anyway.
- The LLC. Liability sits with him personally until it exists.
- A lawyer on the terms and privacy drafts.
- Whether the reel headlines Claude tidied are right: "Become a dragon Kin"
  became "Become dragon kin", and "impossible creations" became "impossible
  things".

**Needs building**

- The buy button turning on at zero credits, and the Concierge asking why
  before showing a price.
- The Curator's first-run tour. Ruled hers, not the Concierge's, and
  skippable — Kristen found her way through with no instruction at all,
  which is evidence the tour should be short.
- Feedback capture. Named, not specified.
- The Concierge's account access, with limits enforced in the tools.
- The gift catalogue. Spec written, not started.
- Pose → Expression in customer copy.
- The magic-link tab still abandons the tab you started in. A six-digit
  code in the same email would fix the worst case; Supabase sends both.

**Known and living with**

- `portraits.html` is past 10,000 lines. It ships fine; the cost is entirely
  in changing it.
- Cold starts are five to ten seconds on the first request to an idle
  function.
- A craft is synchronous with a 60-second ceiling and no retry queue.
- `PRODIGI_ENV` is `sandbox`. Nothing manufactures until it changes.

---

*CUI · 9 August 2026*
