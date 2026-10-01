import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// Next.js only reads .env files inside apps/web, but the repo keeps one root .env. Take only
// API_INTERNAL_URL from it (the web server needs no other secret); real env vars always win.
const rootEnv = resolve(process.cwd(), '../../.env');
if (!process.env.API_INTERNAL_URL && existsSync(rootEnv)) {
  const line = readFileSync(rootEnv, 'utf8').match(/^API_INTERNAL_URL=(.*)$/m);
  if (line?.[1]?.trim()) process.env.API_INTERNAL_URL = line[1].trim();
}

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
