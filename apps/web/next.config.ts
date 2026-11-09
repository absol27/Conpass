import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the container image (apps/web/Dockerfile).
  output: "standalone",
  serverExternalPackages: ["node-ical", "@elastic/elasticsearch"],
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
