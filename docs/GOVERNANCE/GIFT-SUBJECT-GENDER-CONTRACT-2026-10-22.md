# Gift session: `source.subjectGender` (for Codex 1, Portraits male/female preview selection), 2026-10-22

Field: `SessionView.source.subjectGender` (same value in `POST /sessions`, `GET /sessions/{id}` and `GET /sessions/restore` -> `current.source`).

| Value | When | UI handling |
|---|---|---|
| `'female'` | Portraits; the existing photo-analysis pass reported `f` for a single subject | show the female Portrait previews |
| `'male'` | Portraits; the pass reported `m` for a single subject | show the male Portrait previews |
| `'unknown'` | Portraits; no gender reported, more than one subject seen (mixed), the check could not run (it fails open, as before), or the session predates this field | show the ORIGINAL neutral Portraits previews; do not pick a gendered set |
| `null` | pets and groups (not applicable) | ignore |

Source: the same `detectFaceVisibility` call that already enforces the age policy (`analyzeSource`, `lib/v1/gift/real.ts`). No extra AI call; no new cost. The value is stored in `gift_sessions.analysis` (existing jsonb; no migration) and read back with the session, so refresh and restoration return it unchanged. Old sessions read as `'unknown'`. The model reports a best visual estimate, so `'female'`/`'male'` is an appearance estimate, not a fact; nothing in the original Portraits series, effects or prompts changes. Owner-only like the rest of the session.
