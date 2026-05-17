/** @type {import('next').NextConfig} */
const apiTarget = process.env.NEXT_PRIVATE_API_TARGET || 'http://localhost:5001';
const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || 'localhost,127.0.0.1,192.168.100.119')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/:path*`
      }
    ];
  }
};

module.exports = nextConfig;
