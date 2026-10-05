import type { NextConfig } from 'next';

// The browser only talks to this Next.js origin; /api/* is proxied to NestJS (PRD §7.2).
// Rewrites are fixed at build time, so the e2e runner builds with its own API_INTERNAL_URL.
const apiUrl = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
