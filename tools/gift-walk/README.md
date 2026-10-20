# Gift Wizard walk harness (local, no network)

A real browser (Chrome via playwright-core) driving the REAL Wizard files from `public/` against the REAL Gift route handlers on an in-memory store.
Faked: sign-in, database, storage, generation (a sample painting, 2.5 to 7.5 s per preview), Stripe (checkout answers 503). The real scene and calibrated renderers run.

    sh tools/gift-walk/restart.sh                 # starts http://localhost:3777 (restart resets the in-memory free-preview and upload limits)
    node tools/gift-walk/w4.cjs                   # upload -> effects -> craft: screen vs server state every few seconds
    node tools/gift-walk/w11.cjs                  # leave mid-generation via the Gifts menu, return by Back and by URL
    node tools/gift-walk/w8.cjs                   # Add to Cart, wait, refresh: does the cart survive
    node tools/gift-walk/w15.cjs laptop|mobile    # every screen: is the primary button in view, nested scrollers, horizontal overflow
    node tools/gift-walk/w16.cjs                  # product-preview status for every product with the current favorite

Screenshots go to E:/Dev/_recovery-staging/frontend-deploy-review/walk-20261019/. Set WALK_ARTWORK to use a different sample painting. Not part of the build.
