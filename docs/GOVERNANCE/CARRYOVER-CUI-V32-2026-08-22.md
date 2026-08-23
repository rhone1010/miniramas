# CARRYOVER — CUI V32 — 22 August 2026

For CUI 41A.

**Read `docs/GOVERNANCE/READ-THIS-FIRST.md`, then read this folder.** Not
the newest file — the folder.

---

## WHAT SHIPPED TODAY

Two PRs to `main` (#25, #26). The credit shop opened everywhere, and the
community board took its first post after weeks of not working.

**The shop is open in all six rooms.** `SOFT_LAUNCH` flipped to `false` in
`portraits`, `pets`, `halloween`, `pets-halloween` and `pets-chooser`.
Groups never had the flag — it has been selling since it shipped, which is
how we know an open shop causes no harm. Ruled by Rich: a customer who
wants credits may buy them, grant or no grant.

**Post to Community works end to end.** Handle, post, board, hearts. The
first two pieces are on the wall.

---

## THE FOUR BUGS BEHIND ONE BROKEN FEATURE

The board had never taken a post. It was not one fault, it was four in a
line, each hidden by the one in front of it. Recorded in full because the
shape of the chase matters more than the fixes.

**1 · `community_handles` did not exist.** Named in V31, never applied.
Migration written and applied today.

**2 · `service_role` had no DML on any community table.** SELECT, INSERT,
UPDATE and DELETE were all absent on all four tables — only REFERENCES,
TRIGGER and TRUNCATE. A table typed into the Supabase SQL editor does not
get the default grants a table created through Supabase's own tooling
gets. `community_posts` was equally broken and nobody knew, because the
handle failed first.

**3 · THE `begin`/`commit` WRAPPER MADE THE GRANTS SILENTLY NO-OP.** The
grant file reported "Success. No rows returned" and
`has_table_privilege` came back false for all sixteen combinations. The
same file's `create table` DID commit. So DDL committed and GRANT did not,
in one wrapped script, with no error either way.

**NEVER WRAP A MIGRATION IN `begin`/`commit` FOR THE SUPABASE EDITOR.** The
editor manages its own transaction. This was already in memory as a rule
and it was written into the file anyway.

**4 · The glass sent a client id as the piece id.** `PIECE.id` is `q3`
while a piece is crafting and `srv_<uuid>` once read back — neither is
ever a database id. The route looked it up in `collection_pieces`, found
nothing, and correctly answered `no_piece`. The customer read "I cannot
find that piece any more" over a piece sitting on the screen.

Fixed to `PIECE.serverId`, in six files, plus a guard that refuses to open
the dialog for a piece with no `serverId` — a tile still crafting has no
row to post.

**5 · `community_board` did not exist**, so the board read empty even with
live rows in the table. View created today. `comment_count` is a literal
`0::integer` on ruling; comments are not built.

---

## WHAT ACTUALLY FOUND EACH ONE

Every single one was found by reading the Vercel runtime log and nothing
else. Four separate error messages, four different causes, each one a
click away.

```
Could not find the table 'public.community_handles' in the schema cache
permission denied for table community_handles
{piece_id: "q3", consent: true}          <- Network tab, not the log
Could not find the table 'public.community_board' in the schema cache
```

V31 spent six rounds theorising about this same feature. This session the
rule was followed from the first message and the whole chain fell in one
sitting. **Read the log. Then form a theory.**

The one that was NOT in the log was found in the browser's Network tab —
F12, press the button, click the failed request, read the Payload. When a
route answers 404 on a lookup, look at what it was asked to look up.

---

## WHAT V31 GOT WRONG, CORRECTED

**Suggest seven is not stubbed.** It is fully implemented in all six
rooms — `showSeven()` shuffles every tile across every room, deals seven,
repaints the floor, sets the crumb to "Chosen for You" and flips the
button label. V31's note came from a misread. The button is `#curSeven`,
which is why a search for `suggestSeven` finds nothing.

**The credits pill was never unwired.** `#mhCreditsBtn` has a listener in
every room and calls `__openPaywall`. It did nothing on click only because
`SOFT_LAUNCH` shut the shop for anyone with a positive balance — correct
behaviour hiding behind a button that looked broken. Now moot; the shop is
open.

**`_ledger.csv` is dead and has been since 19 August.** It holds one row.
`Install-File.ps1` has no reference to it and never wrote to it. The real
record is `H:\NO_DELETE_ARCHIVE\Logs\FileActions_<date>.csv`, one file per
day, written by `Invoke-TrackedMove` on every move — today's is 33KB and
the 21st is 124KB. Nothing was ever lost. **Rename `_ledger.csv` so nobody
reads it as current again.**

---

## THE RUNNING LIST

### CUI's, not started

- **The copy patch.** Carried from V31 untouched:
  - five Pets room lines (Cast & Carved / Made by Hand / Painted /
    Another Time / Make Believe)
  - three room paragraphs, Pets / Halloween / Pets Halloween, given by
    Rich. All three open with "Upload", which is on the banned list.
    **Ship as given; Rich judges it in place.**
  - four Pets Halloween room lines and two chooser lines, drafted by CUI
    and awaiting Rich's eye
  - six intake strings — still reading "Add portrait photo" and "clear,
    face-forward image" in rooms about animals
- **"Rooms" as the masthead label** on community and gallery.
  `scripts/patch-rooms-masthead.py` is **written, simulated clean, and
  never installed.** Two edits: community's label word, and gallery's
  label plus a new 1320px media query (gallery had no breakpoint above
  900px, so without it the two mastheads disagree). Ruled by Rich: the
  label collapses — "Crafted Rooms" wide, "Rooms" narrow.
- **The board rebuild**, ruled today. Four parts:
  1. images to 400px — `.wall-cols{ columns:4 260px }` becomes a 400px
     column at `community.html:337`, plus the two breakpoints at 606 and
     612
  2. **sections with dividers and titles**, not a filter — Portraits,
     Groups, Pets, Halloween, Pets Halloween. Sticky pill menu under the
     masthead **in gallery's pattern**: `.jump` at `gallery.html:214`,
     `position:sticky; top:var(--mh-h)`, pills are serif italic 1.5rem on
     coffee-700, `pointer-events:none` on the bar and `auto` on the
     inner. Its scrollspy at line ~596 marks the current section by
     testing which heading has passed 170px. **Ports directly.**
  3. metadata as a rollover panel, tooltip-ish. Everything needed is
     already on the card object.
  4. **double-click opens full size.** `.pc` already acts on single
     click — that action has to move or be delayed first. **Rich has not
     said what single click should do afterwards. Ask before building.**
  - **This depends on CENG paging by series.** See the sync document. A
    section list built on the client only sorts the 24 posts already
    loaded, so Pets can look empty until "more" is pressed twice.
- **The card title falls back to the Series name** when the effect id is
  not in the label map. Found on the live board tonight: one card reads
  "Porcelain" and the next reads "Groups". `titleFor(p)` in
  `community.html`. Carried from V31's list as "card title fallback bug".
- **The six mobile notes**, still parked. From
  `Liten_C0_mobile_screens.pptx`: overflow on many screens (Next and Add
  to your order both collide with the fixed bottom nav); no Series
  navigation on mobile at all; no share or post-to-community from My
  Collection; My Collection should default to View All on both mobile and
  desktop; the source-image screen needs the Curator mark and an opening
  line; the masthead should drop the name and keep the credit balance.
- **The golden bug** — a feedback device at the top of every page.
  `/api/v1/feedback` already exists.
- **The wallpaper store**, replacing the Studio. Two-card chooser;
  `pets-chooser.html` is the pattern and is already built.

### Handed to CENG

See `SYNC-CENG-2026-08-22.md`, written today. Short version: the award
RPC, the rewards table, the share routes, series paging on the board, the
Halloween location warning, and the Storage upload path that would retire
the browser downscale.

---

## THINGS LEARNED ABOUT THE CODE

**`PIECES[].id` is never a database id.** Two shapes — `q<n>` from the
queue, `srv_<uuid>` from the server. The real one is `serverId`, written
back by `savePiece()` when a craft lands. `p.art && p.serverId` is the
established test for "is this piece real yet" — it already guards printing
(~line 9927) and archiving (~9432). **Anything sending an id to a route
wants `serverId`.**

**The post dialog exists in six files, including `pets-chooser.html`,**
which has no collection on it and cannot open the dialog. It is patched
alongside the others anyway. The six copies have drifted apart once
already; leaving one behind is how the next clone reintroduces a fixed
bug.

**A route that discards its error makes a permissions failure look like a
missing row.** `const { data: piece } = await db...` with no `error`
binding turns "you have no privileges" into "that piece is not yours".
Both answer 404. When a lookup returns nothing, check the grant before
believing the lookup.

**`community_board` is the privacy boundary, not the route.**
`owner_key` is absent from the view rather than merely unselected. A route
can be refactored into leaking a column; a view cannot leak one it does
not have.

**The handle table's unique index is partial** — `unique (lower(handle))
where released_at is null`. Case-insensitive because the route looks up
with `.ilike()`. Partial because the route's own thirty-day-hold branch
decides a released name is free, and a plain index would 23505 it anyway,
making that branch dead code.

---

## DELIVERY, UNCHANGED

- Every file starts life in `%USERPROFILE%\Downloads`. Scripts write their
  output there. `Install-File.ps1` moves it into the repo and archives
  what it replaces to `H:`. It defaults `-From` to Downloads by the
  target's leaf name, so `-From` is only needed when the names differ.
- Every script: anchor-replace, dry run by default, pre-write assertions
  that refuse to write, post-write verification that refuses to write.
- **Simulate against real copies before delivering.** Every patch this
  session was run against the actual files first, and two defects were
  caught that way — an LF/CRLF mismatch in an inserted comment, and an
  assertion that refused a legitimate shrink because "Rooms" is shorter
  than "Portraits". Both would have reached Rich.
- HTML has no `tsc`. Verification is `findstr` for the new string plus a
  `findstr` count on the anchor that should now be absent.
- Every edit ships with its install command, its dry run and its apply in
  the same message.
- **Say "download this, then run".** A batch whose first line is an
  install of a file still sitting in the browser fails, and the eight
  commands after it run into nothing. This happened again today.
- Nothing is built on a file until Rich confirms it landed. **"Ran" is not
  confirmation — the output is.**
- **NO DELETIONS.** `Install-File.ps1` uses `Move-Item` only and refuses
  outright if `H:` is not mounted.
- **The Python gap is still open.** `scripts/make-cui-session-log.py`
  reconstructs a tracker row for Python patches. **It was not run for this
  session either.**

---

*CUI V32 · 22 August 2026*
