# PATCH DRIFT - THE RULES OF THE ANCHORED PATCH
26 August 2026. CUI 41A. Supersedes the 24 Aug draft, which lived loose
on a disk for two days and never reached git - itself a lesson in rule
6. Eight rules. When a patch and these rules disagree, the patch is
wrong.

## 1 . ANCHORS ARE EXACT AND UNIQUE
An anchor is a verbatim string from the live file, long enough to
appear exactly once (count==1 or refuse). Whitespace, comments and
punctuation are part of the anchor. Never regex, never "close enough".

## 2 . DRY RUN IS THE DEFAULT, THE DISK IS THE TRUTH
Scripts list what they would do and write nothing without --apply.
Writes go to Downloads, never the repo - Install-File seats them.
Simulations against copies are advisory; the dry run against Rich's
disk is the only verdict that counts.

## 3 . REFUSE ON DRIFT, NEVER FORCE
Anchor found 0 or 2+ times: the file moved since the patch was cut.
Refuse, name the edit, ask for Select-String context, re-cut. A patch
that "mostly applied" is a corruption with good manners.

## 4 . VERIFY AFTER WRITING
MUST_APPEAR / MUST_VANISH checks after edits, before any write. A
patch that cannot state what proves it worked is not done being
written.

## 5 . ONE PATCH, ONE PURPOSE, NUMBERED
r1, r2... Revisions never mutate a shipped script; they succeed it.
The script commits alongside the files it changed - the patch IS the
documentation of the change.

## 6 . SAME-SESSION CONSUMPTION
A presented file is downloaded, installed and committed in the session
that produced it. Anything still loose in Downloads or on a disk next
session is a failure to be named, not a backlog. (This document's
predecessor died of this rule.)

## 7 . OWNERSHIP HOLDS ACROSS PATCHES
CENG: engine, app\, lib\, middleware, migrations. CUI lanes: the glass
- public\*.html, room UI. Nobody patches another lane's files without
Rich's explicit ruling (his letter-choice in session is the record).

## 8 . TARGETED CHANGES ONLY - AND THE ADDRESS BOOK
(Rich's standing ruling, 25 Aug.) Existing files change ONLY by
anchored patch script. Full-file installs are for brand-new files;
a full-file replacement of an existing file requires Rich's explicit
sanction in that session (the pets.html restore is the template: git
history as source, sanction on record). The PAGES table in
middleware.ts is the site's address book: any PR touching it carries
ROUTING in its title, and route changes are Rich's to approve. A
whole-file ship from a stale base is how a room got gutted - 0f6d7b7
is the cautionary tale.

*CUI 41A - 26 August 2026*
