
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

  // Dev server only: localhost:3000/ (outside /meraki) opens Meraki instead of a 404.
  // Static export can't redirect, so builds leave it out.
  ...(process.env.NODE_ENV === "development"
    ? { redirects: async () => [{ source: "/", destination: "/meraki/", basePath: false as const, permanent: false }] }
    : {}),

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
