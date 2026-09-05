# CENG -> CUI 42 - WALLPAPER STORE, THE TILL IS OPEN - 24 August 2026 (r02)

Supersedes r01 on one point: **do not call the credit gate for wallpapers.**
One route now does everything, and it is live.

---

## THE CALL

```
POST /api/v1/wallpapers/purchase
{
  "items": [
    { "section": "general",   "filename": "0000_cosmos_dream_stillness_aurora.jpg" },
    { "section": "halloween", "filename": "0113_nightmare_manor_dusk_ember.jpg" }
  ],
  "ref_id": "optional-your-idempotency-key"
}
```

`section` is `general` or `halloween`. `filename` exactly as the registry
carries it. No count field - the basket is the items array. No price field -
the server prices it and ignores anything else.

Success:

```json
{
  "ok": true,
  "ref_id": "wp_<uuid>",
  "spent": 10,
  "balance_after": 37,
  "granted": 5,
  "pieces": [ { "id": "<uuid>", "image_path": "studio/general/0000_....jpg", "label": "Cosmos - Dream" } ],
  "admin": false
}
```

`pieces` are the My Collection rows just written - one per wallpaper, ready
to render as tiles without a refetch.

---

## WHY ONE CALL

Validate, deliver, charge - in that order, one request. Splitting them
leaves a gap where credits are gone and files are not, and with wallpapers
deliberately invisible to the refund route, that gap has no way back.

**Charge is LAST.** Rows are written first; if the spend fails they are
archived back and the customer has lost nothing. The glass cannot get a
charge without a delivery.

---

## FAILURES

All `{ ok:false, reason }`:

| reason | status | notes |
|---|---|---|
| `not_signed_in` | 401 | |
| `items_required` | 400 | empty, or an item missing section/filename |
| `items_rejected` | 400 | carries `rejected: [{filename, reason}]` - see below |
| `items_rejected` | 503 | when the reason is `bucket_unavailable` - retryable |
| `insufficient_credits` | 200 | carries `balance` and `needed` |
| `delivery_failed` / `spend_failed` | 500 | |

Per-item rejection reasons: `bad_section`, `bad_filename`, `duplicate`
(same file twice in one basket - dedupe before sending), `not_found`
(no such file in the bucket).

**A basket with one bad item refuses whole.** Nothing is charged, nothing
is delivered, and `rejected` names the culprits. Partially fulfilling and
charging for the part that worked is a support ticket with arithmetic in it.

---

## RETRIES

Send `ref_id` and reuse it on retry. A ref that already purchased answers
`{ ok:true, duplicate:true, spent:0 }` with the pieces from the first
attempt - the basket is never bought twice. Without a ref, a retry is a
second purchase.

---

## PRICE, UNCHANGED FROM r01

`floor(n/5)*10 + (n%5)*3`. 1=3, 5=10, 6=13, 10=20. No cap. No refund.
Server-side; your UI arithmetic already matches.

---

## WHAT LANDED IN MY COLLECTION

One `collection_pieces` row per wallpaper:

| column | value |
|---|---|
| `series` | `'wallpapers'` - your filter |
| `preset` | the world token (`cosmos`, `nightmare`) - filterable |
| `label` | best-effort from the filename ("Cosmos - Dream") |
| `image_path` | `studio/<section>/<filename>` - the clean file |
| `meta` | `{ kind, section, filename, index, tokens[], purchase_ref }` |

The bucket is public, so tiles can serve `image_path` directly.

---

## FILES (CENG, committed)

- `lib/v1/wallpapers/store.ts` - price, filename grammar, bucket-listing
  validation with a 10-minute cache and a forced re-list on miss, so a
  wallpaper uploaded five minutes ago is purchasable without a deploy
- `app/api/v1/wallpapers/purchase/route.ts` - the route above

The gate's wallpapers branch still exists and still prices correctly, but
the glass should never call it - it charges without delivering.

---

## STILL YOURS

- Point the Buy button at the route and retire "The till opens shortly"
- Dedupe the basket before sending (or surface `duplicate` rejections)
- The Pets wallpaper room pricing question is with Rich - Retina upcharge
  is OUT by his ruling today; the credits-vs-dollars call is still open

*CENG 41 - 24 August 2026*
