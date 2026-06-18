import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const isLocalDev = process.env.NODE_ENV === "development";
    const defaultGateway = isLocalDev ? "http://localhost:8080" : "http://api-gateway:8080";
    const gatewayUrl = process.env.GATEWAY_URL || defaultGateway;
    return [
      {
        source: "/api/v1/:path*",
        destination: `${gatewayUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
