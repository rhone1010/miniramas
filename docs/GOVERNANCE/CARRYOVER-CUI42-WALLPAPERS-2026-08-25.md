# CARRYOVER - CUI 42 - WALLPAPERS - 25 August 2026

The section went from decorative to functional in two days: 24-25 Aug.
This is the closing state, written the evening of the 25th. Read this
before touching anything wallpapers. Trust nothing else - not project
knowledge, not memory, not an older carryover. Verify against live
files; this document tells you where they are.

---

## 1 - WHAT IS LIVE AND PROVEN

**The landing** - `public/wallpapers.html`, route `/wallpapers`.
Vellum/coffee grounds from portraits.html's recipe, continuous through
the title, headings and card rows on shared grid rows (cannot
misalign), five cards all clicking through. Store card counts are
HARDCODED 527/502 - fine until the bucket grows.

**The stores** - `public/wallpaper-store.html`, routes
`/wallpapers/store` and `/wallpapers/store/halloween` (one file, reads
its section off the path). 1,029 watermarked previews from
`wallpapers/studio/<section>/preview/` in the bucket. World filter,
recency-ordered (pressed pill's pieces paint first, view snaps to
top). Coffee cart rail; mobile: scrolling filter strip with peek, cart
as collapsible bottom bar. Buy -> `/api/v1/wallpapers/purchase`
(CENG's, live) with ref_id idempotency, items_rejected auto-set-aside.
Pricing: 3 credits one, five for 10; 6+ PROVISIONAL at
floor(n/5)*10+(n%5)*3 - Rich has not ruled 6+.
**A real purchase completed, delivered, and renders in My Collection.**

**Three craft rooms, all the true workshop shape** (derived from the
live main rooms, NOT the July prototypes):
- `/wallpapers/portraits` -> `public/wallpapers-portraits.html` -
  CRAFTS END TO END on `/api/v1/portrait-wallpaper/generate` (route
  keys on `effect` + `framing`; payload sends both). 9:16 verified
  with a real bronze craft. 15 of 56 effects have wallpaper plates;
  the other 41 fall back to the main room's plate (1:1 cropped).
- `/wallpapers/pets` -> `public/wallpapers-pets.html` - CRAFTS END TO
  END on `/api/v1/wallpapers/pets/generate` (CENG, keys on
  `effect_id`). Gate on series `pets`, flat 10. Piece stores series
  `pets-wallpaper` so print stays excluded.
- `/wallpapers/halloween-pets` -> `public/wallpapers-halloween-pets.html`
  - fully wired to `/api/v1/wallpapers/halloween-pets/generate`,
  WAITING ON THAT ROUTE (see open items). Gate series `pets_halloween`
  pending CENG confirming the id with the route.

**Navigation** - middleware.ts route table is the real router (NOT
next.config rewrites - middleware wins; config entries exist as
belt-and-braces). Breadcrumbs in all three rooms:
Wallpapers > Room > Silo; the Wallpapers pill is a BUTTON (an anchor
would not navigate). Series dropdown carries no wallpaper sub-entries
anywhere - CUI 41A stripped their six rooms, this lane its five.

**My Collection** - `app/api/v1/portraits/pieces/route.ts` GET
resolves `studio/`-prefixed image_paths against the PUBLIC wallpapers
bucket (getPublicUrl); everything else signs against the private
collection bucket as always. This healed purchased wallpapers with no
backfill - the null was the reader, not the data.

**Even floor gaps at every viewport** - `.floor` is
width:fit-content, margin-inline:auto in all three wallpaper rooms
PLUS main pets.html and portraits.html (patched on Rich's direction -
41A owns those two; flagged). The count-based centring rules survive
untouched. Two failed approaches preceded this (flex broke the top
level; repeat(4,auto) would have broken partial-row centring) - do not
retry them.

## 2 - THE ONE OPEN ITEM

**CENG: `/api/v1/wallpapers/halloween-pets/generate`** - identical
contract to their pets route, halloween catalogue. The room waits on
nothing else. Asked twice in synced docs
(SYNC-CUI42-WALLPAPER-PURCHASE, SYNC-CUI42-IMAGE-URL r02).

## 3 - PARKED, EXPLICITLY

- 6+ pricing ruling (SPEC section 6 says ask Rich)
- Wallpaper room mastheads still read "Crafted Pets" / "Crafted
  Portraits" (inherited labels; one anchored patch if ruled)
- 41-effect portrait wallpaper shoot list = the 56 catalogue ids minus:
  balloon_face, bronze, charcoal_chalk, clockwork, ebony,
  impressionist, neon, persian_court, petal_sculpture, plushy,
  renaissance, retro_robot, stained_glass, tidewood, victorian.
  Plate naming: man_<id>.jpeg / woman_<id>.jpeg, FLAT in
  `public/previews/wallpapers/portraits/`. Alias: catalogue `plushy`
  = plate stem `plushie`.
- Homepage wallpapers fold (SPEC section 7)
- Landing store-card counts -> live counts when the bucket grows
- Desktop store filter-pill sizing (Rich flagged "too large" on
  mobile; desktop unruled)

## 4 - THE RULES THIS SECTION WAS PAID FOR
(each of these cost real hours - they are law, not advice)

1. **Anchored patch scripts for every change to an existing file.**
   Dry-run default, refuse on drift, post-write verification. Full-file
   installs ONLY for brand-new files. (Ruled 25 Aug; in memory.)
2. **Lanes work in worktrees.** This lane: `D:\lanes\cui42`, branch
   `lane/cui42`, PRs to main. Nobody runs git checkout. D:\minramas is
   read-only reference.
3. **Nothing is done until seen on the live build.** The single most
   repeated failure both days: judging a fix against a stale deploy.
   Verify with a build marker in the console before diagnosing
   anything. Commit != merged != built != what the browser shows.
4. **No numbers, no placeholders in commands.** `gh pr merge --merge
   --delete-branch=false` finds the branch's PR itself. `<n>` broke
   the flow three separate times.
5. **Downloads is a doorway.** Stale files there WILL be grabbed by
   Install-File's newest-match ("found ... (1).html" = the alarm).
   Rename leftovers to _STALE.bak. Check every install's byte count
   against the stated one.
6. **Ask for the live file before building against anything.** The
   pets room got built in a dead prototype's shape because a
   month-old file was treated as truth. Rooms are the workshop:
   Curator rail / effect floor with silos / queue rail.
7. **Read the actual route before wiring a payload.** Three routes,
   three different key names (effect, effect_id, framing). The file
   answers in one read; guessing costs a deploy cycle each miss.
8. **The API's field names are not the table's columns** (image_url
   on the wire, image_path in collection_pieces) and the serializer
   is where they meet - look there first for "data exists but renders
   null".

## 5 - WHERE THINGS LIVE

- Rooms + landing + store: `public/wallpapers*.html`,
  `public/wallpaper-store.html`
- Registry (all 1,029 parsed, vocab, URLs): `public/wallpaper-registry.js`
  - regenerate if the bucket changes; previews at
  `studio/<section>/preview/<same filename>`
- Router: `middleware.ts` (the table near the top)
- This lane's patch scripts: `D:\lanes\cui42\scripts\patch-*.py`
- Preview upload tool: `scripts/upload-wallpaper-previews.mjs`
  (idempotent, reads .env.local)
- Save-Work: `scripts/Save-Work-CUI42.ps1` - staging guard, main-branch
  refusal, no-number PR flow. Known gap: -Extra silently failed twice;
  prefer explicit git add for extras until fixed.

*CUI 42 - written at the close, 25 August 2026*
