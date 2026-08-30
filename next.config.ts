import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Channel logos are served from iptv-org's community logo hosts.
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
