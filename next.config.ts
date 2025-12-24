import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https: blob:; worker-src 'self' blob:; connect-src 'self' https:;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
