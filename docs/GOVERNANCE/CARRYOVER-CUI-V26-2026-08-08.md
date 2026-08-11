# CARRYOVER · CUI V26 · 2026-08-08

**Read this before touching anything.** Every line was true when it was
written; nothing here is remembered from earlier sessions. Where a line
number appears, re-read the live file before relying on it.

---

## THE STATE, IN ONE PARAGRAPH

`litenco.com` is live behind an invitation gate. The whole money path is
proven on the domain: pay → webhook → credits → craft → piece saved → print
order placed at Prodigi (`ord_1166504`, sandbox). Portraits is the only
Series that works. The mobile experience was built today, end to end, as a
step flow. Intake gating was rebuilt to three outcomes and is currently
loose by design. The next thing on the table is a gift catalogue that sells
framed prints with the craft included — scoped below, not started.

---

## 1 · WHAT WENT LIVE TODAY

**The domain.** `litenco.com` and `www` attached to the `miniramas` project
on the `litenco` team. Vercel is the registrar and the nameservers, so DNS
was automatic. Production deploys from `main`; `feature/store-commerce` is
kept in sync and everything is fast-forwarded.

**The access gate.** `middleware.ts` at the repo root. One passcode
(`LITEN_ACCESS_CODE`), a session cookie that dies with the browser and after
an hour of inactivity, and `/logout`. The card is Rich's design, injected as
an overlay over the real page.

`/api/*` is **excluded from the matcher and must stay excluded.** Stripe
cannot type a passcode; gating it means credits never land.

**Routing without next.config.** The middleware maps `/` → `portraits.html`,
`/portraits`, `/wallpapers`, `/home` → the old homepage. The masthead links
to eleven paths and only these resolve; the rest 404 honestly.

**The receipt.** `/api/v1/print/order` reads an order back, scoped to the
session id **and** the caller's owner_key, because the session id travels in
a URL and the order carries a shipping address. Images are signed fresh from
`collection_pieces` rather than reusing the stored `renderUrl`, which
expires. The panel is functional and **unstyled — Rich's to design.**

**Previews renamed.** 110 files across `public/previews/effects/` went to
flat `man.jpg` / `woman.jpg`. Thirteen effects had the genders swapped;
`iron`, `jade` and `victorian` were numbered oddly. `petrified_wood` and
`plushy` have no man's plate and now carry an empty slot rather than showing
a woman on a man's card — CENG's to fill.

---

## 2 · THE THREE THINGS THAT COST THE MOST TIME

Each of these looked like a code fault and was not. Worth reading before
diagnosing anything similar.

**Stripe webhook secrets.** `whsec_` in `.env.local` was the CLI listener's,
which is meaningless once deployed. Every destination in the Stripe
dashboard has its own. Wrong secret gives `Invalid signature` and a 400 —
which reads exactly like broken code. There are now two destinations:
`Credits` → `/api/v1/webhooks/stripe`, `Print` → `/api/v1/print/webhook`,
reading `STRIPE_WEBHOOK_SECRET` and `STRIPE_PRINT_WEBHOOK_SECRET`.

**The withheld print order.** `paid_at` filled, `prodigi_order_id` null,
`error_message` null. Not an error — the fulfilment gate in the print
webhook, working as designed. `account_flags.fulfilment` per owner_key.
Note the enum `print_order_status` has **no `withheld` value**, so a held
order cannot be written as such; it stays `paid`. The receipt panel handles
a `withheld` case that can never arrive.

**Renders failing at 30–48 seconds.** `render_strictness 8` derives a
fidelity threshold of **9**. Pieces scoring 7 and 8 failed and silently
retried, which is where the time went. The reasons said the work was good:
*"facial structure and expression are well-preserved, but the texture and
material lead to slight deviations."* That is a material finish behaving
like a material finish. **Now at 6.** Anything at or above 8 will keep
refusing good work.

---

## 3 · INTAKE GATING · REBUILT, AND CURRENTLY LOOSE

Rich's spec, implemented literally in `lib/bench/bench-gates.ts`.

**Six hard faults refuse**, and nothing else: no face, more than one primary
subject, face too small, severe blur, face largely hidden, facial detail
lost to exposure. Everything else is advisory. The score is informational
and cannot refuse anyone. `IntakeResult` gained `verdict: 'pass' | 'advisory'
| 'fail'`; `passed` stays true for an advisory.

**The model now sees the real photograph.** `detail: 'low'` downsampled to
about 512px and the model was being asked whether the photo was sharp and
well lit — answering about a thumbnail. Intake is `'high'`; the aesthetic
scorer on finished renders stays `'low'`, where it reads fine.

**The refusals Rich hit were never the gate.** `localPhotoCheck` in
`portraits.html` averages luminance and variance in a canvas, and
`faultState` refused on those numbers alone — overruling a model that had
scored the same photograph 9/10 and written *"Subject is well-lit and
clearly visible."* Because it happened in the browser, **no row was ever
written to `qa_log`**, which is why the log looked untouched while cards
kept appearing. The flags now advise; the server decides.

**Live settings:** `qa_settings` for portraits is `source_strictness 1`,
`render_strictness 6`, `qa_enabled true`. Read per request — no deploy
needed to change them.

**The finding worth keeping:** a very dark photograph the gate had refused
twice produced a good linocut. The generator recovers likeness from far less
than the thresholds assumed. Anyone retuning intake should start from that.

---

## 4 · THE MOBILE BUILD

One file, one wiring — `portraits.html` made responsive rather than a second
front end. Everything is inside `@media (max-width:767px)`. Desktop is
untouched and was verified after every stage.

**The shape.** A step flow, not a long scroll. The Curator card is step one
and has the screen to itself; the worlds, the effects and the pose are steps
two to four using the swapping the build already had. Driven by
`.rooms.phone-step--upload` / `--work`, set only below 767.

**The advance is a press.** A photograph landing used to change the screen
by itself. Removed, not delayed — a delayed jump is still a jump. **Choose
effects →** sits beside **Use a different photograph**, and it will not fire
while the intake modal is up.

**The band.** Fixed at the bottom: Workshop / Collection / Print Shop /
Account. The Curator's line was in it and **was removed 2026-08-08** — Rich:
taking the height, not yet paying it back. Her card keeps her on the
photograph step. Her line, the fold and the tuck all went with her.

**The tray.** Rises when an effect is chosen, says how many and what they
cost, and **presses the To Be Crafted rail's own button** rather than
implementing a craft. It reads its count from the rail too, so the two
cannot drift. Seated on the band's measured height, not a constant.

**My Collection.** A grid, three across, scrolling. A tile opens the
existing lightbox — which has the arrows and the actions — via
`window.__openPiece`. Head compressed to one line, Series pills on one
scrolling row, the describing sentence gone.

**Gone on mobile:** the "Design your own" spine (gone everywhere, it opened
nothing), the footer bays, the three upsell panels, the bulk bar, the
metrics readout (`?metrics=1` brings it back).

---

## 5 · THE FIVE FAULTS I CAUSED, AND WHAT THEY TEACH

Every one of these cost a round trip. They are the same three mistakes.

**Removing markup and leaving what writes to it.** The silo count came out
of the card and two lines still called `.querySelector('.silo-card__count')
.textContent`. Null, throw, and **no cards built at any width.** Always grep
for the class before deleting the element.

**Anchoring a rule above the rule it overrides.** Twice. The phone surface
rules went in at line 648 and the definitions they override are at 2213,
2250, 2887 — same specificity, later wins. And `.mc-latest` is a grid with a
500px first column declared further down, so on a 390px screen the
collection grid sat *outside* the viewport, not hidden. **Phone rules go
last in the file now.** There is a block at the end for exactly this.

**Putting a default inside a media query.** `.phone-back` was drawn in
script on every width with its `display:none` inside the 767 block, so above
767 there was no rule and a button with no rule is a visible button — a
black arrow in the middle of the workshop. Defaults go outside.

**Two things opening at once.** A full-view layer was added on top of a
lightbox that already existed. Closing the lightbox revealed mine and read
as a close that did nothing. Check what the build already does before
building the same thing.

**Hiding something a script un-hides.** `.mc-onward{display:none}` lost to
`wrap.hidden = false`, because `[hidden]` is a default and any rule outranks
it. The builder now returns early on a phone.

---

## 6 · STILL OPEN

**Needs a decision**

- The soft-launch grant. Rich's plan: 100 credits on first sign-in, cap at
  40 accounts, buy button hidden, a form for people wanting more. **Not
  built.** The form questions are unwritten. Note the passcode is shared, so
  nothing stops one person making several accounts.
- `PRODIGI_ENV` is `sandbox`. Nothing manufactures until it changes.
- The fulfilment flag guards against real prints while sandbox already
  does — so every tester's order stops until a row is flipped by hand.
  Suggested to CENG: make it follow `PRODIGI_ENV`. Rich's call.

**Needs building**

- The Print Shop needs a strip of the person's other pieces, so a second
  can be added without leaving.
- The receipt panel is unstyled.
- Pose → Expression in customer copy. `pose` stays in code. The card labels
  are built somewhere I never found; `POSES`, `POSE_LABEL` and `keepPose`
  all returned nothing.
- The magic-link tab still abandons the tab you started in. The fix is to
  poll `/api/v1/auth/me` in the original tab.
- Wallpapers, Pets, Groups, Action: named in scope, not built.

**Known and living with**

- `portraits.html` is 9,700 lines. It ships fine; the cost is entirely in
  changing it. Splitting the CSS and JS out is real work and not urgent.
- Cold starts are five to ten seconds on the first request to an idle
  function. Heavy traffic fixes it; quiet periods are slow.
- A craft is synchronous with a 60-second ceiling and no retry queue.

---

## 7 · THE GIFT CATALOGUE · scoped, not started

Rich's direction, 2026-08-08, and the conversation was cut short by context.
**Get the rest from him before building.**

**The idea.** Sell the framed print as the gift; the craft comes with it.
Flips the economics — a $99 object with a few dollars of compute inside,
rather than $4.99 of compute. The Groups prompts have been reworked for
this: five source photographs into one composition. Family portrait,
triptych, treasured memory, and a "me, myself and I" with three ages of the
same person on a park bench.

**The flow.** A vertical scrolling catalogue page, not the workshop. Buy
first, then craft — up to fifteen times — then choose one, and *that press*
releases the order to the lab. The multiple renders are not generosity: they
are what makes taking money before anyone has seen anything defensible.

**Numbers.** 4K native on NB2 is the floor, since the upscaler works from
1K and a 1K preview cannot be re-rendered faithfully at 4K. Google's
standard API is **$0.151 at 4K**, $0.101 at 2K, batch halves it but means
waiting. Replicate carries a markup — check the real bill. Fifteen renders
is **about $2.30 in generation, call it $3 with the scoring calls.** Fine on
$99, uncomfortable on $29. At 300dpi, 4096px is a clean 13″ square: 8×8
through 12×12 native, 16×16 a mild upscale, 20×20 straining. No posters.

**What it reuses:** payment, the print catalogue and prices, Prodigi, the
upscaler, the collection, the account, the fulfilment webhook.

**What is new:** a purchase that grants an entitlement rather than credits;
a craft loop that spends from it; the choosing step that releases the order;
the catalogue page.

**The thing to settle first.** Five photographs into one composition has
five likenesses to hold, and the current gate scores one face. A group
where one person is wrong is a refund, not a retry. **Ask Rich for the hit
rate on those group renders before any commerce is wired.** If it is four
in five, fifteen renders cover it. If it is one in five, no amount of
wiring fixes what is being sold.

---

## 8 · HOW RICH WORKS · read this

Taken from a session where I got it wrong repeatedly.

**One command, one line, ready to paste.** No placeholders that change name
between messages. If something must be filled in, say once what to replace
and stop.

**The ask first, then the reason — if a reason is needed at all.** Long
explanations do not get read, and saying what I am about to do instead of
doing it wastes his time. He does not need to be told a patch is coming.

**Do not announce and wait.** He should not have to say "go".

**A screenshot or a mockup is a directive.** Read it, decide, build. Not a
prompt for clarifying questions.

**Full files, not "insert this at line 176."**

**PowerShell:** pure ASCII in scripts — em dashes in UTF-8 break PS 5.1.
`Select-String` has no `-Recurse`; that belongs to `Get-ChildItem`.

**Every patch is a Python script in `scripts/`** with anchor-replace edits
and assertions that fail loudly rather than writing an unchanged file. Every
file in the repo is **CRLF** — a pattern written with bare newlines matches
nothing, so try both. Gate with brace balance, a jsdom boot, function and
fetch counts before and after.

**Never overwrite a prompt body without an explicit green light.** A commit
once replaced working prompt bodies and destroyed significant work. Prompt
text is Rich's.

**Do not report a diagnosis as fact when it is a guess.** I twice said the
same photograph was used when it was two different people, and once called a
finish that had not been run. He notices, and it costs trust that the rest
of the diagnosis needs.

---

*CUI · 8 August 2026*
