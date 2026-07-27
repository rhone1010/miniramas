# CLAW-STATUS.md
**Liten & Co — Drive to Launch** · updated Jul 24
Single source of truth. Paste to CLAW at session start; save the returned version back to `D:\minramas\`.

---

## 1. Milestones
- **Aug 1 — Test release.** 5 series. Path: homepage → gate → upload → craft → My Collection (in Account) → download **+ Print Shop (UI only)**. **Days left: 8.**
- **Aug 15 — Commerce release.** Stripe on, Prodigi fulfillment live.

## 2. Scope — LOCKED
**IN (5 series):** Portraits · Pets · Groups · Action · Mobile Wallpapers.
**OUT of Aug 1:** Houses · Landscapes · For Fun · Artist Series · Sets · workshop tiers/quality · per-piece user naming (silent auto-name instead).
**Money:** credits ledger + codes LIVE. Stripe present but bypassed by codes for the test (config flip Aug 15). Print Shop UI in, **Prodigi fulfillment OFF**. Rich sends own test prints via `RHONE3166`.
**Credits:** 1 Crafted Image = **10 credits**. Tester codes 500 credits (=50 images). `RHONE3166` unlimited.
**Nav (all surfaces, 6 items):** Crafted Portraits · Workshop · Gallery · Print Shop · My Collection · Help. Gallery = preview-image library, easy build, first to drop if a lane slips.
**Responsive:** desktop floor **1280**, overflow released. Mobile is a separate build.

## 3. THE UI BOUNDARY (enforced)
**CC does contract + plumbing only. CC never opens an HTML file.** CUI owns all markup + CSS and publishes hook contracts. CC writes separate JS against published hooks; needs a hook that doesn't exist → requests it. **Verified by HTML diff — if markup changed, boundary broken.**
**Root cause of prior UI failures found + fixed:** the fidelity law was never in a file CC reads — root `CLAUDE.md` → `@AGENTS.md`, and `AGENTS.md` held only Next.js boilerplate. Full law now prepended into `AGENTS.md` (155 lines, clean encoding). CC reads it every session.

## 4. LIVE FILE LEDGER (canonical — see `directives/LIVE-FILE-LEDGER.md`)
Reference files as **path + role + date**, never name alone.
| Surface | Canonical | Role |
|---|---|---|
| Portraits | `public/portraits.html` | wiring TARGET (CC lands result here) |
| Portraits UI base | `public/litenco-portraits-2026-07-24-r80d.html` | approved UI, hook contract written against it |
| Portraits behavior ref | `public/portraits.next.html` | credits swap/boot fix/redirect/retry/consent solved here — port FROM, not merge |
| Print Shop | `public/litenco-printshop-2026-07-24-r28.html` | canonical (v2 tokens). `printshop.html` archived (stale --lime) |
| Masthead | `public/litenco-masthead-2026-07-24-r2.html` | shared component, espresso, ready to drop |
| Account | `public/litenco-account-2026-07-24-r7.html` | rebased onto canonical tokens (was r6) |
| Homepage | `app/page.tsx` | live, cut applied |

## 5. Foundation — DONE
- Auth built + deployed (magic-link, callback, `/auth/me`, RLS `collection_pieces`).
- Persistence live (guest token survives reload; sign-in = cross-device).
- Backends render E2E: Portraits · Pets · Groups · Action.
- Migrations applied: `007_craft_events` · `008_collection_label_seq` · `009_credits_and_codes`.
- Boot bug fixed (`PREVIEW_BASE` TDZ) — engine was unbootable since restore. `scripts/boot-test.js` now a mandatory DoD gate.

## 6. Money architecture (spec: `CREDITS-AND-CODES-SPEC-v4`)
Credits = currency. Codes = payment method inside commerce, terminate in same ledger. `runAll` swapped: checkout divert → credits gate → reaches untouched `craftPending()` (solved in `.next`). Refund model: studio failure → 3 parallel choices **Recraft · Credit · Refund** (soft adds Accept-as-is); source-aware copy ("credit returned" not "refunded to card"). Referral: 3 friends → credits, cap 10/account, Aug 15 flow.

## 7. IN FLIGHT NOW
- **CUI:** masthead r2 built ✅ · Account rebase r7 ✅ (brass #9a7644→#75623a accepted, badge→oxblood). **Masthead DROP still open** — 3 distinct pastes (Portraits/Print Shop/Account), NOT done by the rebase. All three now token-ready so the drop is unblocked.
- **CC:** portraits wiring in flight — r80d base, port behavior from `.next`, land as `portraits.html`, credits per v4.
- **CENG:** prompt revisions (Rich). Queued: source-aware failure copy + per-series redirect strings.

## 8. Queue / dated
- Masthead drop → 3 surfaces (CUI, unblocked now).
- Account credits-display copy pass — AFTER schema back-update, sequenced separately from rebase (do not fold in).
- Print Shop wiring — after masthead drop (cart badge depends on it).
- Stale shared `gotoSeries` map → fix at source before series attach (Jul 31).
- Groups map drift → CENG authoritative map before Jul 31, CC applies.
- `/credits/refund` endpoint + QA-panel Credit/Refund wiring.
- `focal_x`/`focal_y` on piece payload (`CC-TICKET-FOCAL-POINT`) — CC delivers numbers, CUI crops.

## 9. Payload (CC instruction set — current)
`CC-CONTRACTS-COVER-2026-07-24.md` (rev2) · `PORTRAITS-HOOK-CONTRACT-v1.md` · `PRINTSHOP-HOOK-CONTRACT-v3.md` · `MASTHEAD-DIRECTIVE-v1.md` (§0 ruled espresso) · `CREDITS-AND-CODES-SPEC-v4.md` · `CC-TICKET-FOCAL-POINT-2026-07-24.md`. Reference/output docs live in `directives/`; superseded in `archive/`.

## 10. Open — Rich
1. Account credits-display copy — trigger after schema back-update lands.
2. Print Shop `printshop.html` archived; confirm no route still points to it.
3. Tester walk pending CC portraits wiring complete.

## 11. Timeline (Jul 24 → Aug 1)
- **Jul 24 ✅:** AGENTS.md fixed · payload cleaned · masthead r2 · account r7 · credits v4 · contracts issued · portraits wiring started.
- **Jul 25:** masthead drop ×3 (CUI) · portraits wiring lands + Rich browser-walk · Gallery if quick.
- **Jul 26–27:** Print Shop wiring (post-masthead) · Account credits-display pass · CAQ re-walk on canonical files.
- **Jul 28–29:** Wallpapers.
- **Jul 30–31:** series attach (Pets/Groups/Action) · gotoSeries + Groups drift fixes · buffer.
- **Aug 1:** Ship.
**Constraint: CC throughput + masthead drop sequencing. Buffer thin.**

## 12. Daily log
- **Jul 22:** Scope locked. Auth confirmed. Flow audit sorted. Tiers/Sets cut, digital-only, consent/sign-in decided.
- **Jul 23:** Print reversed IN (UI only). Credits locked (v3→v4). Refund model. Account specced. Drift solved (`public/` canonical). Credits gate wired end-to-end + boot bug found/fixed + boot harness. Fidelity law authored. Silent auto-naming. UI boundary ruling. Masthead→Print Shop order + cart ruling + hook contracts issued.
- **Jul 24:** Credits 10/image + tester 500. Masthead ruled espresso, built r2. Account rebased r7 (canonical tokens, floor released 1849, rem type). Print Shop r28 confirmed canonical, printshop.html archived. **AGENTS.md fix — fidelity law finally in a file CC reads.** Payload cleaned to 6. Cover note rev2 (v4, espresso, portraits behavior-source). Live File Ledger created. Masthead drop flagged open (3 surfaces, not done by rebase).

## 13. QA LIST (build as surfaces land)
**Batch C craft seam — split by who can catch what:**
- **CAQ (programmatic):** craft seam wired · credits debit exactly once per image (10) · balance blocks at <10 · failure remedies fire (Recraft/Credit/Refund) · piece persists with correct auto-name label · `craft_events`↔`credit_ledger` reconcile.
- **TESTER TEAM (visual, cannot be automated):** **every effect renders the effect selected** — Bronze→Bronze, not Ebony. A wrong `bag`→`generate` preset mapping passes the boot-gate and every programmatic check; only human eyes detect it. Build a reference sheet (effect name → expected look) as ground truth before the walk.
**Also queued for CAQ once wired:** redirect CTA routes correctly (in-scope only) · consent blocks continue · retry re-queues · download end state 3 CTAs · masthead cart count agrees across surfaces · intake modal hard-block vs soft-warn branches correctly.
