import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@promospot/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazon.com' },
      { protocol: 'https', hostname: '**.amazon.com.br' },
      { protocol: 'https', hostname: '**.shopee.com.br' },
      { protocol: 'https', hostname: '**.magazineluiza.com.br' },
      { protocol: 'https', hostname: '**.mercadolivre.com.br' },
      { protocol: 'https', hostname: '**.aliexpress.com' },
    ],
  },
};

export default nextConfig;
