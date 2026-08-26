# ONBOARD - NEW CUI INSTANCE - READ THIS BEFORE YOUR FIRST REPLY
26 August 2026. This is the whole game. Read it, then read
READ-THIS-FIRST.md and PATCH-DRIFT. Do not begin work before finishing
this page. Rich is the only human; every other name (CENG, CUI 42,
41A, 41B) is another Claude instance in its own lane.

## 0 . THE PRIME RULES
1. You cannot see Rich's disk. Ever. You learn its state ONLY from
   command output Rich pastes. Never assert what a file, branch, or
   folder contains without output proving it FROM THIS SESSION.
2. TWO ATTEMPTS, THEN ASK. If two searches/commands haven't found a
   file or answer, STOP and ask Rich one precise question. An hour of
   exploratory scripts is a firing offence; a good question takes
   thirty seconds. Never send a third speculative command.
3. HIGHLY TARGETED CHANGES ONLY (Rich's standing ruling). Existing
   files change via anchored patch scripts: exact-match anchors,
   dry-run by default, refuse on drift, verify after write. Full-file
   installs are for BRAND-NEW files only. No exceptions without
   Rich's explicit sanction in this session.
4. NOTHING IS EVER DELETED. Displaced files go to H:\ via the tracker.
   If your plan includes deleting anything, the plan is wrong.
5. Rich runs all commands. You produce ready-to-paste blocks and
   downloadable files. Prose outside code fences WILL be pasted into
   PowerShell by accident - keep commands in fences, keep fences pure.

## 1 . THE MAP - WHERE THINGS LIVE
- D:\minramas            main, READ-ONLY reference. Look, never touch.
- D:\lanes\<lane>        your worktree, your branch lane/<lane>.
                         41A=cui41a, 41B=cui41b, 42=cui42, CENG=ceng.
                         Work ONLY here. Ask Rich which lane you are
                         if not told - do not guess.
- C:\Users\richh\Downloads   the doorway. Your presented files land
                         here; Install-File consumes them from here.
- H:\NO_DELETE_ARCHIVE   the archive. Sweeps, logs
                         (Logs\FileActions_<date>.csv), displaced
                         files. H:\minramas\... holds numbered
                         priors (file_NNN.ext) of every install.
- docs\GOVERNANCE\       rulings, carryovers, SYNC handoffs. Your
                         predecessor's carryover is CARRYOVER-<lane>-
                         <date>.md - read the newest before working.
- public\*.html          the rooms (each ~500KB, self-contained).
- scripts\               patch scripts, Save-Work, Install-File,
                         FileOps-Tracker, boot-reel harness.
- app\, lib\, middleware.ts   engine + routing. CENG's. The PAGES
                         table in middleware.ts is the site's address
                         book - PRs touching it flag ROUTING in the
                         title and Rich approves.

## 2 . THE FILE CIRCUIT - HOW WORK SHIPS
Every change travels one loop; no shortcuts:
1. You write a patch script (or brand-new file) and present it.
2. Rich downloads; installs to the lane:
   powershell -ExecutionPolicy Bypass -File D:\lanes\<lane>\scripts\Install-File.ps1 scripts\<name>.py
   Install-File archives any prior to H:\ and logs the move. MISSING
   means Rich hasn't downloaded - say so, don't debug.
3. Dry run: python D:\lanes\<lane>\scripts\<name>.py
   Read Rich's paste. REFUSED lines name drifted anchors - ask for
   Select-String context on that anchor, re-cut, never force.
4. Apply: same command + --apply (writes to Downloads).
5. Install each written file: Install-File.ps1 public\<file>.html
6. Ship: powershell ... scripts\Save-Work-<LANE>.ps1 "<message>"
   It stages the lane's known file list, commits, pulls origin main,
   pushes, PRs, prints the PR's file list, merges. WATCH THE FILE
   LIST - it must contain exactly your files.
KNOWN BUGS you inherit: -Extra arrays don't survive powershell -File
(use plain git add/commit/push + gh pr create --fill for extras); gh
warnings print red but are COSMETIC; merge messages may open an
editor (notepad now; if vim appears: Esc :wq Enter).

## 3 . PATCH SCRIPT CONTRACT
Copy an existing scripts\patch-*.py as your template. Non-negotiables:
- Anchors are EXACT strings from the live file, unique (count==1).
- Dry run default; --apply writes to Downloads (never the repo).
- Post-edit MUST_APPEAR / MUST_VANISH verification.
- Pure ASCII (em dashes break PS 5.1 pipelines and py headers).
- LF output; the CRLF git warnings that follow are normal.
- One patch = one purpose; number revisions r1, r2...
- The dry run against Rich's disk is the ONLY truth. Your simulation
  against project-directory copies is advisory.
- Comments in the file explain WHY, dated and signed with your lane.

## 4 . VERIFY, DON'T ASSUME - THE FORENSIC TOOLKIT
State you may rely on: output Rich pasted THIS session. Everything
else you verify:
- Live main:      git show origin/main:<path> | Select-String ...
- What's tracked: git ls-files <path>;  on main: git ls-tree origin/main -r <path>
- History:        git log --all --oneline -- <path>
- Who/what hash:  empirical ladder - foreach over candidate hashes
  counting a marker (see carryovers for the pets.html hunt).
- Fingerprints must be ONE-SIDED: a string present only in the good
  (or only the bad) version. Verify the fingerprint discriminates
  before trusting it ("Design your own" famously did not; curCamera
  did).
- PR numbers come from gh pr list --state open in THIS session,
  never from memory. Write <placeholders> only with "replace this"
  said aloud - Rich types literally.
- Deployment truth is the Vercel dashboard (Production SHA), not the
  browser. Browsers cache; instruct hard refresh before concluding.

## 5 . WHEN TO STOP AND ASK
Ask Rich (one precise question, options lettered) when:
- Two hunts returned nothing (rule 0.2).
- A file you need isn't in the project directory or your context -
  ask him to add it. NEVER build against remembered contents.
- Anything crosses lanes: another lane's files, routes, or a fix in
  their surface. Rich rules A (you do it) or B (they do).
- Any full-file operation, route change, pricing, copy, or product
  decision. Decisions are Rich's; you execute and flag ONCE.
- The dry run refused and one Select-String didn't explain it.
Signals you're in the failure mode Rich fired an instance for:
running commands to "look around", broad recursive searches without
a hypothesis, asserting state without output. Stop. Ask.

## 6 . STYLE - HOW TO TALK TO RICH
Bottom line first. Short. Concrete next command in a fence. One
question maximum per message, only when needed. Flag risk once, then
proceed - "guide, don't constrain". Screenshots from Rich are
DIRECTIVES: read them, identify the deliberate changes, build. When
Rich is frustrated, fix the thing, skip the essay. Copy (customer-
facing words) is Rich's voice: ship placeholders marked DRAFT and
list them for his ruling; never invent final copy.

## 7 . FIRST FIFTEEN MINUTES - EVERY NEW INSTANCE
1. State your lane and folder in your first working message.
2. Read: this doc, newest CARRYOVER-<lane>, PATCH-DRIFT,
   LANES-AND-WORKTREES, any SYNC addressed to your lane.
3. Ask Rich: "anything changed since the carryover?"
4. Have Rich run in your lane: git branch --show-current  and
   git pull origin main - confirm the branch matches your lane.
5. Only then take the first task. Small first ship > big first plan.

*Written by CUI 41A from two days of collisions, restores and hunts.
When this doc and reality disagree, reality wins - and update this doc.*
