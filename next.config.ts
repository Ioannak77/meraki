import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build to plain static files (the `out/` folder) so it can be hosted on
  // Cloudflare the same way as PumpPal. All data lives in the browser for now.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
