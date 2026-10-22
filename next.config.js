/** @type {import('next').NextConfig} */
const nextConfig = {
  // GIFT WIZARD PRODUCT MOCKUP BRIDGE. The renderer (tools/product-mockup) reads its calibrated templates with fs at request time, which Next
  // does not trace. These are the files the installed templates and disabled derived candidates read (tools/product-mockup/renderer-manifest.json lists
  // them with hashes; lib/v1/gift/renderer-bundle.test.ts keeps this list, the manifest and the files identical). Scoped to the one route:
  // no other function carries them, and no development reports, screenshots or fixtures are bundled.
  outputFileTracingIncludes: {
    '/api/v1/gift/sessions/*/lines/*/mockup': [
      './tools/product-mockup/compositor.next.cjs',
      './public/gift-wizard/mockup-scenes/ceramic-mug/Mug - art bw.png',
      './public/gift-wizard/mockup-scenes/ceramic-mug/Mug - background bw.png',
      './public/gift-wizard/mockup-scenes/ceramic-mug/Mug.png',
      './public/gift-wizard/mockup-scenes/ceramic-mug/scene.next.json',
      './public/gift-wizard/mockup-scenes/classic-framed-portrait/class framed print portrait art bw.png',
      './public/gift-wizard/mockup-scenes/classic-framed-portrait/class framed print portrait background bw.png',
      './public/gift-wizard/mockup-scenes/classic-framed-portrait/class framed print portrait frame bw.png',
      './public/gift-wizard/mockup-scenes/classic-framed-portrait/class framed print portrait.png',
      './public/gift-wizard/mockup-scenes/classic-framed-portrait/scene.next.json',
      './public/gift-wizard/mockup-scenes/classic-framed-square/classic framed print square art bw.png',
      './public/gift-wizard/mockup-scenes/classic-framed-square/classic framed print square background bw.png',
      './public/gift-wizard/mockup-scenes/classic-framed-square/classic framed print square frame bw.png',
      './public/gift-wizard/mockup-scenes/classic-framed-square/classic framed print square.png',
      './public/gift-wizard/mockup-scenes/classic-framed-square/scene.next.json',
      './public/gift-wizard/mockup-scenes/classic-framed/Classic Framed Print  landscape- background bw.png',
      './public/gift-wizard/mockup-scenes/classic-framed/Classic Framed Print  landscape.png',
      './public/gift-wizard/mockup-scenes/classic-framed/Classic Framed Print - art bw.png',
      './public/gift-wizard/mockup-scenes/classic-framed/Classic Framed Print - background bw.png',
      './public/gift-wizard/mockup-scenes/classic-framed/Classic Framed Print - frame bw.png',
      './public/gift-wizard/mockup-scenes/classic-framed/Classic Framed Print landscape - art bw.png',
      './public/gift-wizard/mockup-scenes/classic-framed/Classic Framed Print landscape - frame bw.png',
      './public/gift-wizard/mockup-scenes/classic-framed/Classic Framed Print.png',
      './public/gift-wizard/mockup-scenes/classic-framed/scene.next.json',
      './public/gift-wizard/mockup-scenes/fine-art-landscape/fine art print landscape art bw.png',
      './public/gift-wizard/mockup-scenes/fine-art-landscape/fine art print landscape background bw.png',
      './public/gift-wizard/mockup-scenes/fine-art-landscape/fine art print landscape.png',
      './public/gift-wizard/mockup-scenes/fine-art-landscape/scene.next.json',
      './public/gift-wizard/mockup-scenes/fine-art-portrait/fine art print portrait art bw.png',
      './public/gift-wizard/mockup-scenes/fine-art-portrait/fine art print portrait background bw.png',
      './public/gift-wizard/mockup-scenes/fine-art-portrait/fine art print portrait.png',
      './public/gift-wizard/mockup-scenes/fine-art-portrait/scene.next.json',
      './public/gift-wizard/mockup-scenes/fine-art-square/fine art print square - art bw.png',
      './public/gift-wizard/mockup-scenes/fine-art-square/fine art print square - background bw.png',
      './public/gift-wizard/mockup-scenes/fine-art-square/fine art print square.png',
      './public/gift-wizard/mockup-scenes/fine-art-square/scene.next.json',
      './public/gift-wizard/mockup-scenes/framed-canvas-portrait/framed canvas portrait art bw.png',
      './public/gift-wizard/mockup-scenes/framed-canvas-portrait/framed canvas portrait background bw.png',
      './public/gift-wizard/mockup-scenes/framed-canvas-portrait/framed canvas portrait frame bw.png',
      './public/gift-wizard/mockup-scenes/framed-canvas-portrait/framed canvas portrait.png',
      './public/gift-wizard/mockup-scenes/framed-canvas-portrait/scene.next.json',
      './public/gift-wizard/mockup-scenes/framed-canvas/framed canvas - art bw.png',
      './public/gift-wizard/mockup-scenes/framed-canvas/framed canvas - background bw.png',
      './public/gift-wizard/mockup-scenes/framed-canvas/framed canvas - frame bw.png',
      './public/gift-wizard/mockup-scenes/framed-canvas/framed canvas.png',
      './public/gift-wizard/mockup-scenes/framed-canvas/scene.next.json',
      './public/gift-wizard/mockup-scenes/gallery-canvas-landscape/scene.next.json',
      './public/gift-wizard/mockup-scenes/gallery-canvas-landscape/wrapped canvas landscape - artwork bw.png',
      './public/gift-wizard/mockup-scenes/gallery-canvas-landscape/wrapped canvas landscape- background bw.png',
      './public/gift-wizard/mockup-scenes/gallery-canvas-landscape/wrapped canvas landscape.png',
      './public/gift-wizard/mockup-scenes/gallery-canvas-portrait/scene.next.json',
      './public/gift-wizard/mockup-scenes/gallery-canvas-portrait/wrapped canvas portrait art.png',
      './public/gift-wizard/mockup-scenes/gallery-canvas-portrait/wrapped canvas portrait background bw.png',
      './public/gift-wizard/mockup-scenes/gallery-canvas-portrait/wrapped canvas portrait.png',
      './public/gift-wizard/mockup-scenes/gallery-canvas-square/scene.next.json',
      './public/gift-wizard/mockup-scenes/gallery-canvas-square/wrapped canvas square - art bw.png',
      './public/gift-wizard/mockup-scenes/gallery-canvas-square/wrapped canvas square - background bw.png',
      './public/gift-wizard/mockup-scenes/gallery-canvas-square/wrapped canvas square.png',
      './public/gift-wizard/mockup-scenes/greeting-card/greeting card - ar bw.png',
      './public/gift-wizard/mockup-scenes/greeting-card/greeting card - background bw.png',
      './public/gift-wizard/mockup-scenes/greeting-card/greeting card.png',
      './public/gift-wizard/mockup-scenes/greeting-card/scene.next.json',
      './public/gift-wizard/mockup-scenes/inventory.next.json',
      './public/gift-wizard/mockup-scenes/matted-frame-landscape/matted frame landscape - art bw.png',
      './public/gift-wizard/mockup-scenes/matted-frame-landscape/matted frame landscape - background bw.png',
      './public/gift-wizard/mockup-scenes/matted-frame-landscape/matted frame landscape.png',
      './public/gift-wizard/mockup-scenes/matted-frame-landscape/scene.next.json',
      './public/gift-wizard/mockup-scenes/matted-frame-portrait/matted frame portrait art bw.png',
      './public/gift-wizard/mockup-scenes/matted-frame-portrait/matted frame portrait background.png',
      './public/gift-wizard/mockup-scenes/matted-frame-portrait/matted frame portrait frame bw.png',
      './public/gift-wizard/mockup-scenes/matted-frame-portrait/matted frame portrait matte bw.png',
      './public/gift-wizard/mockup-scenes/matted-frame-portrait/matted frame portrait.png',
      './public/gift-wizard/mockup-scenes/matted-frame-portrait/scene.next.json',
      './public/gift-wizard/mockup-scenes/matted-frame-square/matted frame square - art bw.png',
      './public/gift-wizard/mockup-scenes/matted-frame-square/matted frame square - bagrkound bw.png',
      './public/gift-wizard/mockup-scenes/matted-frame-square/matted frame square - frame bw .png',
      './public/gift-wizard/mockup-scenes/matted-frame-square/matted frame square - matte bw.png',
      './public/gift-wizard/mockup-scenes/matted-frame-square/matted frame square.png',
      './public/gift-wizard/mockup-scenes/matted-frame-square/scene.next.json',
      './public/gift-wizard/mockup-scenes/premium-fine-art/premium fine art print - art bw.png',
      './public/gift-wizard/mockup-scenes/premium-fine-art/premium fine art print - background bw.png',
      './public/gift-wizard/mockup-scenes/premium-fine-art/premium fine art print.png',
      './public/gift-wizard/mockup-scenes/premium-fine-art/scene.next.json',
      './public/gift-wizard/mockup-scenes/premium-landscape/premium fine art print landscape art.png',
      './public/gift-wizard/mockup-scenes/premium-landscape/premium fine art print landscape background.png',
      './public/gift-wizard/mockup-scenes/premium-landscape/premium fine art print landscape.png',
      './public/gift-wizard/mockup-scenes/premium-landscape/scene.next.json',
      './public/gift-wizard/mockup-scenes/premium-square/premium fine art print square art bw.png',
      './public/gift-wizard/mockup-scenes/premium-square/premium fine art print square background bw.png',
      './public/gift-wizard/mockup-scenes/premium-square/premium fine art print square.png',
      './public/gift-wizard/mockup-scenes/premium-square/scene.next.json',
      './tools/catalog-samples/scene-replacement-review.next.cjs',
      './tools/product-scenes/adapter.next.cjs',
      './tools/product-mockup/derived-frame.next.cjs',
      './tools/product-mockup/frame-finish.next.cjs',
      './tools/product-mockup/gift-visualization-adapter.next.cjs',
      './tools/product-mockup/review/frame-finishes/references/finishes.next.json',
      './public/gift-wizard/catalog.next.json',
      './public/gift-wizard/mockup-templates/classic-framed/*',
      './public/gift-wizard/mockup-templates/fine-art/*',
      './public/gift-wizard/mockup-templates/gallery-canvas/*',
      './public/gift-wizard/mockup-templates/gallery-canvas-square/*',
      './public/gift-wizard/mockup-templates/premium-fine-art/*',
      './public/gift-wizard/mockup-templates/square-framed/*',
      './public/gift-wizard/mockup-templates/ceramic-mug/*',
      './public/gift-wizard/mockup-templates/matted-frame/*',
      './public/gift-wizard/mockup-templates/matted-frame-square/*',
      './public/gift-wizard/mockup-templates/framed-canvas/*',
      './public/gift-wizard/mockup-templates/framed-canvas-square/*',
      './public/gift-wizard/mockup-templates/greeting-card/*',
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      // THE WALLPAPER STORE - both catalogues, one file. The page reads
      // location.pathname to decide which; the browser URL is untouched.
      { source: '/wallpapers/store', destination: '/wallpaper-store.html' },
      { source: '/wallpapers/store/halloween', destination: '/wallpaper-store.html' },
      // THE CRAFT ROOMS. Portraits and Pets Halloween pre-date this file;
      // these entries make the routes explicit rather than dependent on
      // whatever mapped them before. Pets is new, 24 Aug.
      { source: '/wallpapers/portraits', destination: '/wallpapers-portraits.html' },
      { source: '/wallpapers/halloween-pets', destination: '/wallpapers-halloween-pets.html' },
      { source: '/wallpapers/pets', destination: '/wallpapers-pets.html' },
    ]
  },
}
// The pre-checkout product preview renders with the same scene and calibrated renderers, so it carries the same files (one list, two routes).
nextConfig.outputFileTracingIncludes['/api/v1/gift/sessions/*/product-preview'] = nextConfig.outputFileTracingIncludes['/api/v1/gift/sessions/*/lines/*/mockup']
// The server-side sale gate (lib/v1/gift/presentation.ts, ON by default) asks the scene manifests which configurations have an approved photograph, when a gift is added to the cart and at checkout.
// Those two routes read ONLY the manifests (no pictures): without these files every product would look unavailable. lib/v1/gift/scene-gate-trace.test.ts runs the gate against a copy holding exactly
// this list.
const sceneGateFiles = [
  './tools/product-scenes/adapter.next.cjs',
  './tools/catalog-samples/scene-replacement-review.next.cjs',
  './tools/product-mockup/compositor.next.cjs',
  './public/gift-wizard/mockup-scenes/inventory.next.json',
  './public/gift-wizard/mockup-scenes/*/scene.next.json',
]
nextConfig.outputFileTracingIncludes['/api/v1/gift/sessions/*/lines'] = sceneGateFiles
nextConfig.outputFileTracingIncludes['/api/v1/gift/sessions/*/checkout'] = sceneGateFiles
nextConfig.outputFileTracingIncludes['/api/v1/gift/sessions/*/availability'] = sceneGateFiles          // reads the scene manifests to say which products have an approved scene
module.exports = nextConfig
