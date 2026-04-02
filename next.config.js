/** @type {import('next').NextConfig} */
const nextConfig = {
  // ...whatever is already here...
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
}

module.exports = nextConfig