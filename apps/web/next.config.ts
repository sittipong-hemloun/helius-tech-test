import type { NextConfig } from 'next';

// /api/* is proxied to NestJS on the same origin so cookies stay first-party (PRD §7.2).
// Rewrites are resolved at build time: staging images are built with API_INTERNAL_URL=http://api:3001.
// /internal/* is never rewritten — worker endpoints stay on the Docker network.
const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiInternalUrl}/api/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
