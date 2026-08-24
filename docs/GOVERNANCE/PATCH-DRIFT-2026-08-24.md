# PATCH DRIFT -- HOW IT HAPPENS AND HOW TO STOP IT
24 August 2026. Written by CUI 41A.

This document exists because three lanes spent hours today shipping patches
that refused to apply, applied to the wrong state, or quietly undid each
other's work. Every one of those failures had the same root cause.

---

## THE ROOT CAUSE

**A patch is built against a copy of the file. If the file changes before
the patch runs, the anchor no longer matches and the patch refuses.**

The file changes every time any lane ships something. On a three-lane repo
this happens constantly. The gap between "Claude reads the file" and "you
run the patch" is almost always nonzero, and on a busy day it is hours.

---

## THE THREE WAYS IT GOES WRONG

### 1 . The file in chat is not the file in the repo

Claude cannot read `D:\minramas\public\portraits.html`. It reads whatever
you uploaded to the chat. Those two things are identical for about thirty
seconds after you upload -- after that, the repo file may have changed.

**Every patch built against an uploaded copy is built against a snapshot
that is already aging.**

The symptom: `REFUSED: anchor found 0 times`. The anchor text Claude wrote
was correct when it wrote it. By the time you ran the script, a different
lane had already changed that line.

### 2 . Patches are applied out of order

Claude produces r13, r14, r15, r16 in sequence. Each one anchors against
the output of the one before it. If r15 goes in before r14, or r16 is run
against the repo before r13 landed, the anchor is wrong.

The symptom: same as above, or worse -- the patch applies but produces
broken output because it rewrote a block that had already been rewritten.

### 3 . The same file is patched by two lanes at once

Lane A builds a patch against portraits.html at state X. Lane B ships
portraits.html at state Y while A's patch is still in Downloads. A's patch
runs against Y, finds an anchor that only existed in X, and refuses.

Or worse: A's patch runs fine against Y, but overwrites B's changes because
A never knew they were there.

---

## THE RULES THAT PREVENT IT

### Rule 1 -- Upload the file the same session you build the patch

If Claude built a patch yesterday, the anchor may already be stale. Upload
the current file before asking Claude to build anything that touches it.
One upload at the start of a session is not enough if other lanes have
shipped since then.

**Before every patch session: upload the live file.**

### Rule 2 -- Apply patches in the same session they are built

A patch script sitting in Downloads for more than an hour is a liability.
Run it the same session. If you cannot, upload the file again when you
return and have Claude verify the anchors before running.

### Rule 3 -- Use sentinels, not line text, as anchors

Line text breaks the moment any lane adds a comment or reformats a block.
Sentinel comments are permanent markers that no patch should ever touch:

```javascript
/* ---- the triptych ------------------------------------------------- */
// ... everything in between can change ...
/* ---- the proof wall ------------------------------------------------ */
```

A patch that replaces everything between two sentinels never drifts,
because the sentinels themselves never move. Every patch Claude writes
should use this pattern for any block larger than three lines.

**If a patch refuses with "anchor found 0 times", the first question is:
did another lane change the text between the write and the run?**

### Rule 4 -- Check what is in the repo before staging

```powershell
Select-String -Path D:\minramas\public\portraits.html -Pattern 'something that should be there' | Select-Object LineNumber
```

This takes five seconds and tells you whether the patch actually landed.
Do it after every install. Not after the commit -- after the install, while
the file is still in `public\` and you can see it.

### Rule 5 -- Say which file you are holding

Before any lane touches a shared file, it states this in the chat. If two
lanes are both holding `index.html`, the second one to install wins and the
first one's work is gone. Coordination is a conversation, not a git feature.

Current ownership (24 August):

| File | Lane |
|---|---|
| `public\index.html` | CUI 41A |
| `public\gallery.html` | 41B |
| `public\community.html` | 41B |
| `public\wallpapers.html` | 41B |
| `public\portraits.html` | CUI 41A |
| `public\pets.html` | CUI 41A |
| `public\groups.html` | CUI 41A |
| `public\halloween.html` | CUI 41A |
| `public\pets-halloween.html` | CUI 41A |
| `public\pets-chooser.html` | CUI 41A |
| `lib\v1\**` | CENG |
| `app\api\**` | CENG |
| `supabase\migrations\**` | CENG |

### Rule 6 -- Never chain patches in one batch

```powershell
python patch-r1.py --apply
python patch-r2.py --apply   # DO NOT DO THIS
```

r2 may anchor against the output of r1. If r1 fails, r2 runs against the
wrong state and the error is invisible. Run one patch, verify it landed,
then run the next.

### Rule 7 -- When a patch refuses, stop

Do not try `--src=`, do not re-run with different arguments, do not apply
by hand. Stop, upload the current file, and report the refusal. The anchor
text that caused it is the diagnostic. Do not discard it by running around it.

---

## THE SHORT VERSION

```
Upload the file at the start of every session that touches it.
Apply patches the same session they are built.
One patch at a time, verified before the next.
State which files you are holding.
When it refuses, stop and report -- do not work around it.
```

*CUI 41A - 24 August 2026*
