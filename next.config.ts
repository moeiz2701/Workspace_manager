import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // There are stray lockfiles above this directory; pin the root explicitly.
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      // Google account avatars.
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

export default nextConfig;
