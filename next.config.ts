import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
