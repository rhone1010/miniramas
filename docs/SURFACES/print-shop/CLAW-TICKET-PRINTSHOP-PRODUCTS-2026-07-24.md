# CLAW TICKET — Print Shop product catalog

Raised by: CUI V21 · 2026-07-24
Blocks: CC wiring of `#finGrid`, `#sizeGrid`, `#styleGrid`, `#stPrice`
UI state: `litenco-printshop-2026-07-24-r19.html` — complete, hook contract published
Decision owner: Rich

The UI sells a catalog the engine cannot quote. Four gaps. CC is idle until 1 and 2 are ruled.

---

## 1 · Gallery Canvas has no SKU — DECISION NEEDED

Canvas is one of three cards on the primary finish screen and does not exist in
`lib/v1/print/sku-map.ts`. It does exist at Prodigi, three ways:

| Product | SKU prefix | Wholesale from | Notes |
|---|---|---|---|
| Stretched canvas | `GLOBAL-CAN` | £14 | 400gsm, 38mm pine, **4 edge finishes** |
| Framed canvas (floater) | `GLOBAL-FRA-CAN` | £20 | 6 frame colours |
| Classic framed canvas | `GLOBAL-FRA-SLIMCAN` | £18 | 8 frame colours |

Gallery Canvas maps to `GLOBAL-CAN`. My earlier recommendation to cut Canvas is
withdrawn — it was based on the assumption the product didn't exist.

**Ruling needed:** add `GLOBAL-CAN` for Aug 1, or ship two finishes and defer
Canvas to Aug 15.

## 2 · Retail prices do not reconcile — DECISION NEEDED

| | UI (r19) | `sku-map.ts` |
|---|---|---|
| Fine Art Print | from $99 | $28 / $48 / $68 |
| Gallery Canvas | from $149 | does not exist |
| Framed Print | from $189 | $118 |

The UI numbers are roughly 3x the locked map. One set is wrong and the Print
Shop cannot ship until it's the same set in both places.

Note the locked map also predates the declining-multiplier formula (3.0x under
$20 cost tapering to 2.0x over $80, nearest $5). That formula **cannot be
applied today** — see gap 4.

**Ruling needed:** which price set is real.

## 3 · Style grid is three options short

Spec calls for nine style options. The build ships six: two canvas edge
finishes (Gallery Wrap, Float Framed Canvas) and four frame colours.

Prodigi offers four canvas edge finishes, and `mirror_wrap.png` and
`museum_wrap.png` are already sitting unused in `public/print/`. Adding both
takes the count to eight at zero asset cost.

**Ruling needed:** add the two wrap options, or accept six for Aug 1.

## 4 · No persisted cost matrix — CC scope, no ruling needed

Wholesale cost is live-only via `prodigi-client.getQuote()` per quote. There is
no stored SKU→cost table and no scheduled catalog pull; `scripts/test-prodigi.ts`
is a manual probe. Retail is therefore static, not formula-derived.

This is what blocks the declining multiplier. It is real work and it lands on
the Aug 1 critical path if gap 2 resolves toward formula pricing.

---

## Routing once ruled

**CC:**
- Pull the Prodigi catalog; persist SKU → cost. Confirm exact size suffixes
  from the catalog endpoint — **do not derive them from the prefix.**
- Extend `SKU_MAP` per the ruling on 1 and 3.
- Wire `#finGrid` / `#sizeGrid` / `#styleGrid` / `#stPrice` against the
  published hook contract. Markup is CUI's; CC attaches behavior only.

**CUI:**
- No UI change required for 1 or 2 — the finish and size grids render from
  whatever the SKU map returns.
- Ruling on 3 costs one style-grid entry per option added.

**CAQ:**
- Nothing until CC wires. Then: quote round-trip, AR mismatch notice, and the
  order-confirmation terminus with `data-prodigi-submit="off"`.
