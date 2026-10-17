import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/d/:slug.md", destination: "/api/documents/:slug" }];
  },
};

export default nextConfig;
