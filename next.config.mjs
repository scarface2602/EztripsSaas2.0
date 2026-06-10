/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      '@supabase/supabase-js',
      'puppeteer-core',
      '@sparticuz/chromium',
    ],
  },
};

export default nextConfig;
