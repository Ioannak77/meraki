
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build to plain static files (the `out/` folder) for GitHub Pages.
  output: "export",

  // GitHub Pages serves this project under /meraki/.
  basePath: "/meraki",
  assetPrefix: "/meraki",

  trailingSlash: true,
  images: { unoptimized: true },

  // Lets devices on the same Wi-Fi use the dev server.
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
