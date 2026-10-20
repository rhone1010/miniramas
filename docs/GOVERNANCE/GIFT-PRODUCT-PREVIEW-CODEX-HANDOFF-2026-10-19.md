# Pre-checkout personalized product preview and cart contract (2026-10-19)

From CC to Codex. Backend only; nothing pushed or deployed.

## 1. Cart: `PUT /api/v1/gift/sessions/{id}/lines` is the only cart
Body `{ lines: [{ lineId, productId: "family:size", copies }] }` replaces the whole list. The server stores only `lineId`, `productId`, `size` (the catalog's) and `copies`. SKU, picture and file geometry are returned in `SessionView.geometries[]` (`sku`, `requiredPx`, `picturePx`, ...); **price is never stored or accepted**: a client `retailCents`/`price`/`sku` is ignored, and checkout totals come from the catalog (`orders.ts`). Rejected with the cart left unchanged: unknown or non-launch product (`product_not_available`), `invalid_quantity` (1 to 20), `duplicate_line`, `lines_locked` (an order exists), another customer's session (`session_not_found`).
Every later read returns the saved cart: `GET /sessions/{id}`, `GET /sessions` (restore), the batch polls. The favorite is `artworkPreviewId` (set by `POST /artwork`). Tests: `product-preview.test.ts` ("the cart is the server's").
Your `saveLines` (persist, then rebuild from the answer) is the intended client.

## 2. `GET /api/v1/gift/sessions/{id}/product-preview?productId=canvas:8x8`
Authenticated, owner only. Selected favorite plus a catalog `productId` gives an explicit `ProductPreviewView` (`lib/v1/gift/types.ts`):

| status | meaning | what to show |
|---|---|---|
| `ready` | a WATERMARKED mockup: `url` (signed, 15 min), `width`/`height`, `renderer` (`scene` = approved photograph incl. its fixed detail inset, `calibrated` = template renderer), `sceneId`, `fit`, `cached` | the one large personalized mockup |
| `adaptation_required` | the favorite's shape is more than 2% from the product's picture shape (`favoriteAspect`, `pictureAspect`, `extension`, `method`); an accurate picture needs the real composition step (a bounded extension or a new generation: paid, approved by the customer). Nothing was rendered. | the product's own state with a plain note; NEVER a sample or the bare favorite as if it were the product |
| `not_available` | not purchasable or no template (`reason`) | the existing disabled state |

Errors: 404 `session_not_found`; 409 `artwork_not_selected` (choose a favorite first), `order_refunded`, `refund_pending`; 502 `mockup_failed`; 503 `mockup_renderer_unavailable`. While rendering (first call per product and favorite, a few seconds) show your loading state; repeats are cached (`cached: true`).

Guarantees: no composition, line, order, approval, correction or entitlement is created or changed (the session view is byte-identical before and after); the clean master never leaves the server; no unwatermarked image is ever returned or stored; the picture is shaped only by mirror-extension inside the free 2% band (no outpaint, no generation, no crop, no stretch); the scene is chosen only when a photograph truthfully shows the configuration (family, finish, SKU, orientation), otherwise the calibrated renderer, never a substitute product. Stored files live under `gift/{session}/product-previews/` and are removed with the session. `GIFT_SCENE_MOCKUPS=0` switches scenes off.

**Expect `adaptation_required` often.** Today it is `ready` only where the favorite's shape is already the product's (square favorite: the square canvas, framed, fine art and premium squares). A portrait product with a square favorite needs a composition. The purchased-line mockup after "Add to Cart" is unchanged and still exact, because the real composition exists by then.
Mug, card, matted and framed canvas are not launched, so they answer `not_available`; a preview never enables a product.

## 3. Six-preview concurrency
All six renders start together (`GIFT_PARALLEL_RENDERS` 1 to 6 can lower it); claims, the 3-attempt cap and idempotency are unchanged; a 429 gets one gentle second pass. Poll the session to show each preview as it completes.
