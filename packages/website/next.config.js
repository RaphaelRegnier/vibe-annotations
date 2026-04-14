/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // COOP Header (addresses Lighthouse COOP issue)
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          // HSTS Header (addresses Lighthouse HSTS issue)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Simple CSP Header (addresses Lighthouse CSP issue)
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://code.iconify.design; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.iconify.design; frame-src https://streamable.com; object-src 'none'; base-uri 'self'; form-action 'self';",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig