# FILE TRACKING — STANDING INSTRUCTION FOR EVERY CLAUDE

`docs/GOVERNANCE/FILE-TRACKING.md` · 20 August 2026

**Every lane. Every session. CUI, CENG, CHK, CMARK, QA, Claude Code, and
whatever comes after them.**

---

## THE RULE

**Any script you write that creates, moves, copies or renames a file must
record what it did.**

Not most of them. Not the important ones. Every one. A record with holes in
it is worse than no record, because it looks complete.

Everything lands in one place:

```
H:\NO_DELETE_ARCHIVE\Logs\FileActions_<YYYY-MM-DD>.csv
```

One file per day, every script appending to the same one. That IS the master
record — nothing needs collecting or merging later.

---

## HOW, IN POWERSHELL

Two things. A loader after the `param()` block:

```powershell
$TrackerPath = Join-Path $PSScriptRoot 'FileOps-Tracker.ps1'
if (Test-Path -LiteralPath $TrackerPath) {
  . $TrackerPath
} else {
  Write-Host "FileOps-Tracker.ps1 not found - operations will be UNTRACKED." -ForegroundColor Red
}
```

Dot-sourced, not imported, so the functions land in the calling scope.

Then use the tracked calls instead of the raw ones:

```powershell
Move-Item   -> Invoke-TrackedMove   -Source X -Destination Y -Note "why"
Copy-Item   -> Invoke-TrackedCopy   -Source X -Destination Y -Note "why"
Rename-Item -> Invoke-TrackedRename -Path X -NewName Y -Note "why"
```

A file the script GENERATES — a render, a resize, a build output — is not a
move. Register it after it exists on disk:

```powershell
Register-GeneratedFile -Path $out -BatchId $BatchId -Note "what this is"
```

Anything that produces files in a loop gets markers, so a run of six hundred
plates reads as one job rather than six hundred unrelated events:

```powershell
$BatchId = "myjob-{0}" -f (Get-Date -Format "yyyyMMdd-HHmmss")
Start-TrackedBatch -BatchId $BatchId -Description "what this run is"
# ... the loop ...
End-TrackedBatch -BatchId $BatchId -Description "ok=$ok failed=$failed"
```

**Put `End-TrackedBatch` in a `finally`.** A run that is interrupted must
still close its batch rather than leaving a `BATCH_START` with no end.

---

## WHAT IS ALREADY DONE

```
scripts/FileOps-Tracker.ps1        the library
scripts/Install-File.ps1           two tracked moves
scripts/Archive-File.ps1           one tracked move
scripts/Archive-LegacyPlates.ps1   batch markers; the moves are Archive-File's
scripts/Resize-Plates.ps1          registers each resized plate, batch markers
scripts/batch-wallpapers.ps1       registers both plates per row, batch markers
scripts/diag-flux.ps1              no file operations, nothing to do
```

**Do not re-instrument these.** Read them before assuming they need it.

---

## WHAT IS NOT COVERED, AND WHY IT MATTERS

The tracker is PowerShell. About a hundred and thirty Python scripts under
`scripts/` write source files, and `batch-1to1.ts` wrote a hundred and one
images through Node in a single afternoon. **None of that is in the record.**

That is a known gap, accepted deliberately, from 20 August forward. It is
recorded here so nobody reads the CSV a month from now and concludes the
Python patches never ran.

**If you write a new file-producing script in Python or Node, say so
explicitly rather than letting it join the gap quietly.**

---

## FIVE THINGS THE TRACKER DOES THAT YOU SHOULD NOT UNDO

Each of these was a real fault, found on 20 August. If you edit
`FileOps-Tracker.ps1`, keep them.

**The call stack is read at depth two.** At depth one every row recorded
`FileOps-Tracker.ps1 / Invoke-TrackedMove` — the tracker naming itself as the
actor, never the script that did the work. That is the one column the log
exists to provide.

**The CSV append retries, then shouts and gives up.** `Export-Csv -Append`
without `-ErrorAction Stop` writes a non-terminating error that a script
sails past, losing the row silently. And batches run in parallel windows, so
a second writer holding the file handle is the ordinary case, not the rare
one.

**A logging failure never aborts the file operation.** An untracked move is a
gap in a record; a move that did not happen is lost work.

**`Get-SafeHash` returns `NO_FILE` and `HASH_ERROR` as distinct answers.**
Returning `""` for both made an unreadable file indistinguishable from an
absent one — silence, inside a tool whose purpose is not being silent. And
`Test-RealHash` exists so two sentinels can never compare equal and report
`VERIFIED`.

**H: being absent does not stop a script loading.** The tracker announces
itself unavailable, once, in red, and the work proceeds untracked.

---

## WHAT NEVER HAPPENS

**No deletion. No cleanup. No rotation.** Not of files, not of logs.

**No log is truncated, overwritten or replaced.** Ever, by anything.

**Anything being replaced goes to `H:\NO_DELETE_ARCHIVE` first.** That is the
preservation workflow, and `Install-File.ps1` and `Archive-File.ps1` are how
it is done — not by hand, and not with `Move-Item`.

**No `Remove-Item`, `del`, `rm`, or `git checkout` to discard changes.** If a
task appears to need a deletion, say so and stop.

See `docs/GOVERNANCE/FILE-PLACEMENT.md` for the full placement rules.

---

## THE POINT OF ALL THIS

A contemporaneous record of what this machine did, and when, that can be
correlated against the Windows USN Journal later.

Windows and application temp churn does not need capturing — the USN Journal
already has it. What the journal cannot say is WHY a file moved, or WHICH
script moved it, or whether the copy verified. That is what this adds.

Which is also why the `-Note` argument matters. A row that says a file moved
is worth something. A row that says why is worth considerably more.

---

*Liten & Co · 20 August 2026*
