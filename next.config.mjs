/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'nanobanana.ai',
      },
      {
        protocol: 'https',
        hostname: '**.nanobanana.ai',
      },
    ],
  },
};

export default nextConfig;
