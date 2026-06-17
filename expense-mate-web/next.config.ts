import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/auth/:path*",
        destination: "http://localhost:8080/api/v1/auth/:path*",
      },
    ];
  },
};

export default nextConfig;

