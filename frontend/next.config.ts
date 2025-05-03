import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'is1-ssl.mzstatic.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'is2-ssl.mzstatic.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'is3-ssl.mzstatic.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'is4-ssl.mzstatic.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'is5-ssl.mzstatic.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'mzstatic.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'api.music.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-001.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-002.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-003.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-004.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-005.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-006.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-007.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-008.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-009.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-010.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-011.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-012.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-033.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-035.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'store-064.blobstore.apple.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'blobstore.apple.com',
        pathname: '**',
      },
    ],
  },
};

export default nextConfig;
