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
      // THE CRAFT ROOMS. Portraits and Pets Halloween pre-date this file;
      // these entries make the routes explicit rather than dependent on
      // whatever mapped them before. Pets is new, 24 Aug.
      { source: '/wallpapers/portraits', destination: '/portrait-wallpaper.html' },
      { source: '/wallpapers/halloween-pets', destination: '/pet-wallpaper.html' },
      { source: '/wallpapers/pets', destination: '/wallpapers-pets.html' },
    ]
  },
}
module.exports = nextConfig
