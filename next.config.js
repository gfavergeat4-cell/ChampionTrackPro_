/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/presentation.html',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com https://api.anthropic.com https://api.champtrackpro.com;",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig