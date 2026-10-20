import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build to plain static files (the `out/` folder) so it can be hosted on
  // Cloudflare the same way as PumpPal. All data lives in the browser for now.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Lets a phone or iPad on the same Wi-Fi use the dev server (npm run dev).
  allowedDevOrigins: ["192.168.*.*"],
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
