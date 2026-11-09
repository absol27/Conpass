import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the container image (apps/web/Dockerfile).
  output: "standalone",
  serverExternalPackages: ["node-ical", "@elastic/elasticsearch"],
  outputFileTracingRoot: process.cwd(),
  // Hide the Next.js "N" dev badge (bottom-left) so the demo looks clean.
  devIndicators: false,
};

export default nextConfig;
