// Ensure Node.js runtime trusts all TLS certs (set before any module loads)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@supabase/supabase-js',
      'puppeteer-core',
      '@sparticuz/chromium',
    ],
  },
};

export default nextConfig;
