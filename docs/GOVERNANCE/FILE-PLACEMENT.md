# FILE PLACEMENT — IMPERATIVE

`docs/GOVERNANCE/FILE-PLACEMENT.md` · 19 August 2026

**This governs every Claude instance working on this project. CUI, CENG,
CMARK, CHK, Claude Code, batch sessions. There are no exceptions and no
lane in which it does not apply.**

---

## 0 · THE LAW

**NOTHING IS EVER DELETED. NOTHING IS EVER OVERWRITTEN IN PLACE.**

Every file that leaves its position in the repo — replaced or removed —
goes to the H: archive first, under a sequential `_001` name. The two
scripts below are the only sanctioned way to move a file into or out of
`D:\minramas`.

Claude does not write `Remove-Item`. Claude does not write `del`. Claude
does not suggest `git checkout` to discard working changes. Claude does not
write a file directly over another with `Copy-Item` or `cat >`.

If a task appears to require deleting something, that is a signal to stop
and say so, not to find a way around this document.

---

## 1 · INSTALL-FILE — PUTTING A FILE IN

`scripts/Install-File.ps1` places a downloaded file into the repo and
archives whatever it displaced.

**Name in Downloads matches the target filename:**

```
powershell -ExecutionPolicy Bypass -File .\scripts\Install-File.ps1 lib\v1\groups\groups-effects.ts
```

**Name in Downloads differs from the target.** Always the case for
`route.ts`, since a dozen of them would collide in one Downloads folder:

```
powershell -ExecutionPolicy Bypass -File .\scripts\Install-File.ps1 app\api\v1\groups\generate\route.ts -From "$HOME\Downloads\groups-generate-route.ts"
```

**Dry run:**

```
powershell -ExecutionPolicy Bypass -File .\scripts\Install-File.ps1 lib\v1\groups\groups-effects.ts -DryRun
```

### Claude's obligation

**Every file delivery ends with its Install-File call, ready to paste.** One
per file, one command at a time, no placeholders, no shifting names. If the
delivered filename differs from the target, the `-From` form is mandatory —
never ask Rich to rename a download.

---

## 2 · ARCHIVE-FILE — TAKING A FILE OUT

`scripts/Archive-File.ps1` moves a file out of the repo to the same
archive. For dead modules, stale mockups, superseded snapshots. Nothing is
deleted.

```
powershell -ExecutionPolicy Bypass -File .\scripts\Archive-File.ps1 lib\v1\groups\groups-blocks.ts -DryRun
powershell -ExecutionPolicy Bypass -File .\scripts\Archive-File.ps1 lib\v1\groups\groups-blocks.ts
```

**Several at once:**

```
'groups-blocks','groups-prompt','groups-presets' | ForEach-Object {
  powershell -ExecutionPolicy Bypass -File .\scripts\Archive-File.ps1 "lib\v1\groups\$_.ts"
}
```

Same H: root, same `_001` numbering, same `DryRun` and `ArchiveRoot`
parameter names as Install-File. The path is relative to the repo root,
which the script derives from its own location — so it works from any
working directory.

### What it does that an inline `Move-Item` does not

**It refuses if H: is not mounted.** Moving a file to a path that does not
exist is a delete wearing a different word.

**It reads the file back off the filesystem after moving** and fails loudly
if it is not at the destination, or if it is somehow still in the repo.

**The archive number is read from the archive, not counted.** A count is
wrong the moment anything is removed by hand.

---

## 3 · WHY `-ExecutionPolicy Bypass` IS ON EVERY COMMAND

The machine is set to `AllSigned`, so an unsigned `.ps1` will not run from
the prompt. The prefix spawns a child process with the policy relaxed for
that one run; nothing on the machine changes.

`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` also
works, but if `AllSigned` comes from a policy rather than a choice it will
be overridden — so the prefix is the permanent answer. **Claude includes it
on every invocation.**

---

## 4 · PROVE IT LANDED

**After every install, before building anything on top of it:**

```
findstr /C:"<a string that exists only in the new version>" <path>
```

Not from the install output. Not from a commit message. Not from the file
appearing in a directory listing. Not from its absence in an untracked list
— committed files do not appear there.

**Two deployments were lost to files believed to be on disk that were not.**
The build error named line 42 of a file that had never changed, and three
rounds of copy commands were issued against a download that had never
happened. A download on this machine can open in an editor rather than
save.

**Claude's obligation:** when a build error does not match the file Claude
believes it is reading, the first move is to have Rich grep — not to
diagnose the code. If a path does not exist, stop issuing variations of the
same command and find out what actually happened.

---

## 5 · ARCHIVING AND COMMITTING ARE ONE ACT

**A file archived out of the repo must be staged in the SAME commit as
whatever replaced it.**

Split across two commits, `main` has a moment where it does not build, and
Vercel deploys from `main`.

Commit `c5a95a1` got this right: seven orphaned Groups modules left the
repo in the same commit that landed the new engine. That is the standard.

The same applies to any set of files with a shared contract. When the
wallpapers registry stopped accepting `freeformPrompt`, the registry and
its two callers had to go up together — either all three or none.

**Claude's obligation:** when a delivery spans files that depend on each
other, say so explicitly and list them as one commit.

---

## 6 · THE `[int]` CAST

Both scripts read the next archive number like this:

```powershell
$n = [int]($used | Measure-Object -Maximum).Maximum + 1
```

`Measure-Object` returns a **Double**, and the `D3` format specifier throws
on a Double. Without the cast the script works perfectly the first time a
file is archived and fails the second time — so it survives any test that
installs something once.

If either script is ever rewritten, this cast must survive.

---

## 7 · POWERSHELL CONSTRAINTS

**Pure ASCII.** Em dashes in UTF-8 break PowerShell 5.1. Claude checks
before delivering any `.ps1`.

**Dry run by default** on anything Claude writes that moves or edits files.

**`ConvertTo-Json` silently unwraps single-element arrays.** Build JSON by
hand for API calls.

**`npm run dev` is NEVER run.** It corrupts Windows logging and makes normal
computer usage untrackable. To check a build, use:

```
npx tsc --noEmit
```

That reads files, prints errors, writes nothing, and exits. Claude does not
suggest `npm run dev` under any framing.

---

## 8 · WHAT CLAUDE DELIVERS

**Whole files, never fragments.** Never ask Rich to insert, splice or edit
by hand.

**One command at a time**, ready to paste, no placeholders.

**File edits are anchor-replace patch scripts** with dry-run default and
pre-write assertions — and the anchor is matched against the live file read
in that same message, never from a project-knowledge copy or from memory.

**Line endings matter.** This repo is CRLF. An anchor written with `\n` will
not match a file saved with `\r\n`, and the assertion is what catches it.

---

## 9 · THE RULE BEHIND ALL OF THIS

Every incident that produced a line in this document has the same shape:
**something believed to be true about the filesystem that was not.**

A file believed placed. A count believed current. A prompt believed
canonical. A commit believed to contain what its message said.

The archive exists so that being wrong is recoverable. The grep exists so
that being wrong is discoverable. Neither works if Claude skips them for
speed.
