# LIVE-FILE-LEDGER.md
**Canonical file map. CC reads this before touching any file** (per `AGENTS.md` §4).
Updated 2026-07-24. Reference files as **path + role + date** — never by name alone.

**Rule:** versioned filenames may be references, not live. When line counts disagree between sources, stop and reconcile before acting.

---

## Portraits
| File | Role |
|---|---|
| `public/portraits.html` | **Live engine** (13 fetch calls). The wiring TARGET — CC lands the wired result here. Currently pre-merge/boot-broken; replaced by the r80d wiring pass. |
| `public/litenco-portraits-2026-07-24-r80d.html` | **UI base.** Approved design. Hook contract written against it. Fetchless. |
| `public/portraits.next.html` | **Behavior reference.** Credits-gate swap, boot fix, redirect CTA, retry, consent, download end state solved here. Port FROM, not a merge source. |
| `archive/litenco-portraits-2026-07-21-r77.html` | Superseded UI proto. Do not use. |
| `public/portraits-proto.html` | Old proto. Do not use. |

## Print Shop
| File | Role |
|---|---|
| `public/litenco-printshop-2026-07-24-r28.html` | **Canonical.** Title `[r28]`, v2 locked tokens. Hook contract v3 written against it. |
| `public/printshop.html` | **STALE** (`--lime` palette). Archive — do not wire. |

## Masthead
| File | Role |
|---|---|
| `litenco-masthead-2026-07-24-r2.html` | Reference build for `MASTHEAD-DIRECTIVE-v1`. Espresso, ruled. Component drops into all three surfaces unchanged. |

## Account
| File | Role |
|---|---|
| `public/litenco-account-2026-07-24-r7.html` | **Canonical.** Rebased onto v2 tokens, floor released at 1849, rem type. Was r6. Masthead not yet dropped. Credits-display copy pass queued (after schema back-update). |

## Homepage
| File | Role |
|---|---|
| `app/page.tsx` | **Canonical, live.** Homepage cut applied here. |
| `public/homepage-light.html` | Design reference only. Not the live route. |

## Extracted modules (workshop)
`public/portraits.css` · `public/portraits.ui.js` (0 backend calls) · `public/portraits.wizard.js` · `public/litenco-tokens.css` (workshop vellum/coffee palette — NOT the limestone system; do not reconcile pre-launch except the shared masthead).

## Supabase migrations (applied)
`007_craft_events.sql` · `008_collection_label_seq.sql` · `009_credits_and_codes.sql`

## Scripts
`scripts/boot-test.js` — mandatory boot gate. Run before any "done."

---

## Other live series (not Aug-1 wiring targets yet)
`public/pets.html` · `public/groups.html` · `public/actionmini.html` · `public/portrait-wallpaper.html` · `public/pet-wallpaper.html` — attach to proven path after portraits (≈Jul 31). Out of Aug 1: `houses.html` · `landscapes.html` · `interiors.html` · `sportsmem.html`.
