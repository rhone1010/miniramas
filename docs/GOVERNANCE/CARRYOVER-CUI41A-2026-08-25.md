# CARRYOVER - CUI 41A - 25 August 2026, end of session
For the next 41A instance. Read READ-THIS-FIRST, FILE-PLACEMENT,
LANES-AND-WORKTREES first. Lane: D:\lanes\cui41a on lane/cui41a.
Save-Work-CUI41A.ps1 runs the whole ship chain; gh warnings are
cosmetic; vim on merge messages until Rich runs:
  git config --global core.editor "notepad"

## THE DAY IN ONE PARAGRAPH
Open doors shipped on the glass: browse free, sign-in at intent, the
passcode is an optional coupon worth 50 credits. The invite field is
live in ALL SIX rooms (portraits PR 88, the five others PR 98): filled
code POSTs /api/v1/invite {email, code} BEFORE the magic link, bad_code
says so plainly and halts, empty never blocks; the grant announcement
counts from the server (pieces = floor(credits/10), worded); AC_REASON
gained launch_grant:'Welcome credits' (DRAFT). Same day: pets.html was
found gutted - commit 0f6d7b7 ("Floors hug their cards", 42's) replaced
the room wholesale with a studio build; restored from 9d964bf (commit
3fad7c9, on main, live-confirmed). Wallpapers submenu removed from the
Series menu in all six rooms (PR 93) per Rich's screenshot ruling; 42
did their pages in PR 94. Statsig declined - admin panel suffices.

## RULINGS MADE TODAY (RICH)
- Open doors model (CENG spec in docs/GOVERNANCE): browse free, account
  at intent, code = coupon. CENG owns engine; landed overnight+today.
- Buy panels open everywhere (SOFT_LAUNCH=false was deliberate, e9f5571).
- Welcome screen: ONCE PER BROWSER. Copy LOCKED, verbatim below.
- Wallpapers submenu: gone. One line, one door.
- HIGHLY TARGETED CHANGES ONLY: anchored patches for existing files,
  full-file installs for brand-new files only. Codify as PATCH-DRIFT
  rule 8 (NOT YET WRITTEN) with: middleware.ts PAGES table is the
  address book - PRs touching it flag ROUTING in the title, Rich
  approves route changes.

## WELCOME SCREEN - BLOCKED, COPY LOCKED
Blocked on index.html reaching the project directory (uploads broken,
project dir lost index+portraits copies today). Build: full overlay on
index only, house style, one-click dismissal writing localStorage
liten_welcome_v1, shows once per browser. Button word DRAFT
("Enter the studio" suggested). Copy verbatim, signed Rich not C.:

  Welcome to Liten & Co.
  We're officially open.
  Turn the people and pets you love into something wonderfully
  unexpected. Explore handcrafted transformations for portraits, pets,
  groups, and Halloween, each designed to turn an ordinary photo into a
  one-of-a-kind piece of impossible portraiture.
  A little grand-opening note: We're still fine-tuning a few corners of
  the site, though everything available for purchase is ready to go.
  Please send us anything you spot that could be better, and we'd love
  to hear your ideas for new effects you'd like to see.
  Enjoy creating.
  Best, Rich

## OPEN - MINE, IN ORDER
1. Welcome screen (above) once index.html is readable.
2. SYNC-OPEN-DOORS-GLASS-2026-08-25.md - written, presented, STILL IN
   DOWNLOADS, never installed/committed. Install to docs\GOVERNANCE.
3. PATCH-DRIFT rule 8 (wording above) - next docs commit.
4. Save-Work -Extra bug: arrays do not survive powershell -File; use
   plain git for extras until fixed.
5. boot-reel.js desktop assertions (desktop broke twice on 24 Aug with
   zero coverage; harness expects 'serving from tall/' now).
6. QA-BEFORE-LAUNCH revision: add - Health tab open on launch night,
   fulfilment flags default OFF and FLIP TEST ACCOUNT ON before the
   Prodigi test (or prints silently never send), QA sliders at launch
   values per Series. Admin panel: app/admin/panel.tsx, seven tabs,
   NO credit/code writes - entitlements are CENG routes only.
7. Two scripts untracked in the lane: patch-nav-wallpapers-r1.py,
   patch-signin-invite-r2.py - commit with this carryover.
8. Parked: createImageBitmap intake hardening (12MP camera memory),
   golden bug, source-image Curator line, tall-small regeneration
   (Rich's; reintroduction = 3 lines in index reversed, VERIFY ON MAIN
   via git ls-tree first).

## OPEN - RICH
- DRAFT copy set: invite label ("Have an invite code? 50 credits on
  us"), bad-code line, ledger "Welcome credits", welcome button, ten
  reel taglines in index.html, Groups fold copy, 5 desktop headlines.
- index.html (and rooms as needed) into the project directory.
- Note to 42: re-cut floor patch 0f6d7b7 against RESTORED pets.html;
  check halloween.html for the same wrong-base fault (diff showed only
  2 lines, probably clean - confirm).
- QA pass per QA-BEFORE-LAUNCH once CENG confirms entitlements done;
  then code word, LITEN_ACCESS_CODES in Vercel prod, guest list.

## FAILURE PATTERNS THAT BIT US - DO NOT REPEAT
- Whole-file installs from stale bases (0f6d7b7 gutted pets). Rule 8.
- Asserting file/branch state from memory: lane paste of middleware was
  behind main; "Design your own" was a USELESS fingerprint (it appears
  innocently in the room) - curCamera was the discriminator. Verify
  claims against origin/main (git show origin/main:<path>), pick
  fingerprints that exist only on one side.
- Empirical ladders win: foreach over candidate hashes with a counted
  marker found the gutting commit in one paste.
- Angle-bracket placeholders (<n>, <room>) get typed literally - write
  commands with the real value or say "replace this" explicitly.
- Prose lines pasted into PowerShell parse as commands - only code
  blocks are for the terminal.
- grep -c returning 0 exits 1 and kills && chains (container side).
- Tracker is -Source/-Destination/-Note. Never -From/-To/-Reason.

## WHERE THINGS LIVE
Restored pets forensics: git log --all -- public/pets.html; good=9d964bf,
gutted=0f6d7b7, restore=3fad7c9. Archives: H:\minramas\public\*_NNN.html
(pets_028 = pre-invite-field state). Invite patches: scripts/
patch-signin-invite-r1.py (portraits, the template), r2 (five rooms).
Nav: patch-nav-wallpapers-r1.py. CENG's overnight chain: invite code
check, wall off (cf30098, one PR), magic link from gate, token-hash
sessions (app/auth/confirm), claim-grant lib, analyze signin-guard
across seven routes. 42's split: wallpapers-{portraits,pets,
halloween-pets}.html + routes; their collection-null issue is with CENG.

*CUI 41A - 25 August 2026*
