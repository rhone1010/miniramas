# Feedback panel ("Something off?") — handover spec
Date: 2026-09-05 · Author: CUI · File: `public/litenco-feedback-modal.html` (standalone, r01)
Owners: **CENG** — endpoint, schema, GitHub issue, reporting · **CC** — integration into the three glass files

The panel is built and behaves. It has no server. This document is the contract between the glass and the bench, and the checklist to seat it.

---

## 1. What it is (30 seconds)

A gold scarab in the masthead. Tap → a panel from the right (full width on phones). The page tells the panel what it knows (screen, count, tier, photo, last three actions); the person taps a kind, sets how bad, confirms where, and writes what happened. Screenshot on by default. Send → one POST. Her line, then it closes.

No email (signed in). No priority (that's Rich's). No steps-to-reproduce (they won't). Every Curator sentence in the panel is placeholder for Rich.

---

## 2. CENG — API

### `POST /api/v1/feedback`
Auth: session cookie (`credentials:'include'`). 401 if none — the glass shows *Try again*; do not accept anonymous in the test release.

Request (JSON):
```json
{
  "kinds":     ["broken","visual","confusing","slow","idea"],   // 1..5 of these
  "severity":  0,                                               // 0 annoying · 1 blocked me · 2 lost my work
  "where":     "discovery",                                     // discovery | review | mycoll
  "what":      "Tapped Review at 8 and only four cards showed.",
  "expected":  "",                                              // optional
  "context": {
    "screen":"discovery", "series":"Portraits", "count":8, "tier":4, "slotsOpen":0,
    "hasPhoto":true, "lastActions":["select Stained Glass","open Review","back"],
    "userId":"rich1hone",
    "url":"https://…/litenco-discovery-checkpoint-04.html", "viewport":"1920×917", "dpr":1,
    "userAgent":"…", "language":"en-US", "ts":"2026-09-05T18:22:10.123Z"
  },
  "screenshot": "data:image/jpeg;base64,…"                     // or null
}
```
Response: `200 { "id": "<uuid>", "issue": 123 }`. Anything else → glass shows *Try again* and keeps the form filled.

Limits: `what` ≤ 4000 chars, `expected` ≤ 2000, screenshot ≤ 2 MB (reject larger with 413; glass will retry without the image — CC, see §4). Rate: 10/user/hour.

### Screenshot storage
Decode the data URL → Supabase Storage bucket `feedback-shots/<id>.jpg` (private). Store the path, not the base64, in the row.

---

## 3. CENG — Database

```sql
create table feedback (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  user_id       uuid references auth.users(id),
  handle        text,                         -- context.userId as sent, for the eye
  kinds         text[] not null,              -- broken|visual|confusing|slow|idea
  severity      smallint not null check (severity between 0 and 2),
  "where"       text not null check ("where" in ('discovery','review','mycoll')),
  what          text not null,
  expected      text,
  context       jsonb not null,               -- verbatim from the glass
  screenshot    text,                         -- storage path or null
  url           text,                         -- context.url, lifted for filtering
  viewport      text,                         -- context.viewport, lifted
  release       text not null default 'test', -- test | prod
  github_issue  integer,                      -- issue number once opened
  status        text not null default 'new'   -- new | seen | fixed | wontfix | dup
);
create index feedback_created_idx  on feedback (created_at desc);
create index feedback_where_idx    on feedback ("where", severity);
create index feedback_status_idx   on feedback (status);
```
RLS: users insert their own; only service role reads. Never delete — set `status`.

---

## 4. CENG — GitHub issue

On insert, open an issue in `rhone1010/miniramas`:
- **Title:** `[test] <where> · <kinds joined> · sev<severity> — <first 60 chars of what>`
- **Labels:** `test-release`, `from-feedback`, `where:<where>`, `sev:<severity>`
- **Body:** what / expected / context as a table / screenshot as an attached image (upload to the issue, or link the signed storage URL, 7-day expiry)
- Write `github_issue` back to the row. If GitHub fails, the row still saves; retry from a queue. The glass never waits on GitHub.

---

## 5. CENG — Reporting

One view, one query, nothing fancy for the test release:
```sql
create view feedback_digest as
select date_trunc('day', created_at) as day, "where", severity, count(*) as n,
       count(*) filter (where status='new') as open
from feedback group by 1,2,3 order by 1 desc, 3 desc;
```
Daily: severity-2 rows as a Slack/email line to Rich (`what`, `where`, issue link). Weekly: the digest. That's it until volume says otherwise.

Signals worth watching from day one: `where` × `kinds='confusing'` (UX debt by screen); `context.tier` on `broken` (the slot model under load); `hasPhoto=false` with anything but `idea` (the gate isn't landing).

---

## 6. CC — Integration into the glass

Three files: `litenco-discovery-checkpoint-04.html`, `mobile-discovery-mock.html`, `tablet-discovery-mock.html`. Same steps each.

1. **Copy in** from `litenco-feedback-modal.html`: `<style id="lc-feedback-css">`, `<div id="lcFeedback">…</div>`, `<script id="lc-feedback-js">`. Drop the demo masthead and demo styles (marked `demo` in the file).
2. **Scarab in the masthead.** Desktop: between the chat button and the account pill, `class="lcf-scarab" id="mhScarab"`, the inline SVG from the file. Mobile/tablet: same button left of `≡`.
3. **Last-actions ring buffer.** Add once, near the top of the page script:
   ```js
   var LAST_ACTIONS = [];
   function act(s){ LAST_ACTIONS.push(s); if (LAST_ACTIONS.length > 3) LAST_ACTIONS.shift(); }
   ```
   Call `act()` at: card select/deselect (`act('select '+name)` / `'deselect '+name`), remove in Review, Pick/Help/Describe opens, size chosen, Review/Create/Back, My Collection open, unlock. Ten call sites; names are for humans.
4. **Mount** at the end of the page script:
   ```js
   LCFeedback.mount({
     trigger: '#mhScarab',
     endpoint: '/api/v1/feedback',
     context: function(){ return {
       screen: currentScreenKey(),                 // exists in checkpoint; mocks: document.querySelector('.screen.active').id
       series: 'Portraits',                        // from the Series switcher once wired
       count: SELECTED.length, tier: TIER, slotsOpen: openSlots(),
       hasPhoto: !!uploadedPhotoDataUrl,           // mocks: HAS_PHOTO
       lastActions: LAST_ACTIONS, userId: CUSTOMER  // → auth/me displayName once wired
     }; },
     capture: function(){ return html2canvas(document.body, { useCORS:true, scale:0.5 }).then(function(c){ return c.toDataURL('image/jpeg', 0.7); }); }
   });
   ```
   html2canvas from cdnjs, loaded lazily on first open if you'd rather not ship it in the page.
5. **413 retry.** If the POST returns 413, resend with `screenshot:null`. (Panel currently shows *Try again*; add the one-line retry in the send handler.)
6. **Z-order.** Panel is z 400/401 — above the lightbox (230), the tour (260) and the how-to slides (270). Leave it.
7. **Verify** (browser, not jsdom): open from each screen → chips show that screen's state; send with endpoint stubbed → 200 → her line → closes → form is clean on reopen. Phone: panel is full width, keyboard doesn't hide Send.

---

## 7. Not in this release
Attach a file · edit after send · status back to the user · "how was it?" rating after Create (different form, different moment).

## 8. Open for Rich
Every sentence in the panel: title, subtitle, chip labels, severity labels, placeholders, the sent line. And whether the scarab appears for customers or only while `release='test'`.
