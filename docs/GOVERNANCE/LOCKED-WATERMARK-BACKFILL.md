# Locked-preview watermark — existing pieces

Proposal only. **Nothing here has been executed**, and this change does not
mutate or rebake a single existing object.

Opened 2026-09-19, branch `feat/discovery-curator-pass2`.

## What changed, and what it did not

`bakeWatermark()` now encodes JPEG at `LOCKED_PREVIEW_QUALITY`, and the
portfolio render path uses it for the locked derivative instead of
`makeLockedPreview()`. **New renders only.** Every locked object already in
storage is still the clean 512px derivative it was written as.

So there is a window of pieces that are locked but unmarked.

## The window

`dfa4f99`, **2026-09-09** — the bake left the portfolio path.
This change, **2026-09-19** — it returns.

Anything rendered between those dates has a clean `locked/{series}/{previewId}.jpg`.
Before 2026-09-09 the bake was in force, so those pieces already carry the
mark at `watermarked/{series}/{previewId}.png` — the fallback the status route
still reads second.

## Counting them — CC has no database access

This is the query, not a result. It needs running by someone with access:

```sql
select count(*) as unmarked_locked_pieces
from portfolio_items i
join portfolios p on p.id = i.portfolio_id
where i.status = 'done'
  and i.preview_id is not null
  and i.created_at >= '2026-09-09'
  and p.delivery = 'preview';          -- purchased pieces are born unlocked
```

Narrow it to those still actually locked — a piece whose unlock was spent is
served the clean master anyway and needs nothing:

```sql
select count(*)
from portfolio_items i
join portfolios p on p.id = i.portfolio_id
join preview_ledger l on l.id = i.preview_id
where i.status = 'done'
  and i.created_at >= '2026-09-09'
  and p.delivery = 'preview'
  and l.unlocked_at is null;           -- never unlocked, so still shown locked
```

The second number is the one that matters: it is how many customers can
currently see an unmarked locked piece.

## Proposed mechanism — bounded, resumable, not written

A one-off script, not a route and not a cron. It must be interruptible and
must never touch a clean master.

1. **Select** the rows from the second query above, ordered by `created_at`,
   in pages.
2. For each: download `{series}/{previewId}.png` (the clean master) from the
   `previews` bucket.
3. `bakeWatermark()` it — the same function the render path now uses, so a
   backfilled piece and a fresh one are identical by construction rather than
   by inspection.
4. **Upload to `locked/{series}/{previewId}.jpg` with `upsert: true`.**
   That path is the only object written. The master is read, never written.
5. Record the `previewId` in a simple ledger file so a re-run resumes rather
   than repeating.

**Safety properties to hold it to:**

- Idempotent — re-running produces the same bytes, so a partial run is
  recoverable by running it again.
- Never writes `{series}/{previewId}.png`. A bug that overwrote a master with
  a watermarked copy would destroy the thing the customer paid for, and there
  is no undo: the master is the only copy and NB2 is stochastic.
- Skips any piece whose ledger row has `unlocked_at` set, re-checked at the
  moment of writing rather than only at selection — an unlock landing
  mid-migration must not be handed a marked file.
- Dry-run first, reporting counts and total bytes, writing nothing.
- Rate-limited. This reads and writes storage for every piece in the window.

**What it costs:** one read and one write per piece, and the new object is
~156 KB against the ~52 KB it replaces, so storage for that window roughly
triples.

## Decisions that are Rich's, not the script's

- **Whether to backfill at all.** A piece from that window is visible only to
  the customer who bought its portfolio, and only until they unlock it.
- **Whether to keep the pre-2026-09-09 PNG bakes** under
  `watermarked/{series}/` or re-cut them as JPEG at the same time. They are
  the heavy ones; they are also already correct.
