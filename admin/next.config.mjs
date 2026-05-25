/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Health check at /api/health → backend /health (not under /api)
      {
        source: "/api/health",
        destination: "http://127.0.0.1:5000/health",
      },
      // All other /api/* → backend /api/* on WSL
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:5000/api/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
