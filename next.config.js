/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ]
  },
}
module.exports = nextConfig
