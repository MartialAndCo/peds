import type { NextConfig } from "next";

const nextConfig = {
  env: {
    // Force bake build-time env vars into the runtime for Amplify
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    WAHA_ENDPOINT: process.env.WAHA_ENDPOINT,
    WAHA_API_KEY: process.env.WAHA_API_KEY,
    WAHA_SESSION: process.env.WAHA_SESSION,
    VENICE_API_KEY: process.env.VENICE_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https: blob: https://89-167-94-105.nip.io http://localhost:8000; media-src 'self' data: blob: https://*.supabase.co https://*.nip.io https://cfpcmrecikujyjammjck.supabase.co https://github.com https://raw.githubusercontent.com https://89-167-94-105.nip.io http://localhost:8000; worker-src 'self' blob:; connect-src 'self' https: https://89-167-94-105.nip.io http://localhost:8000;",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/supabase-proxy/:path*',
        destination: 'https://89-167-94-105.nip.io/:path*',
      },
    ]
  },
  // output: 'standalone',
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  // Increase Limits for API Routes (App Router uses native Request limits mostly, but this might help if migrating)
};

export default nextConfig;
