/** @type {import('next').NextConfig} */
const nextConfig = {
  // GIFT WIZARD PRODUCT MOCKUP BRIDGE. The renderer (tools/product-mockup) reads its calibrated templates with fs at request time, which Next
  // does not trace. These are EXACTLY the 35 files the six purchasable templates read (tools/product-mockup/renderer-manifest.json lists
  // them with hashes; lib/v1/gift/renderer-bundle.test.ts keeps this list, the manifest and the files identical). Scoped to the one route:
  // no other function carries them, and no development reports, screenshots, fixtures or mug/card templates are bundled.
  outputFileTracingIncludes: {
    '/api/v1/gift/sessions/[id]/lines/[lineId]/mockup': [
      './tools/product-mockup/compositor.next.cjs',
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
module.exports = nextConfig
