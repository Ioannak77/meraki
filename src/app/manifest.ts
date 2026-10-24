import type { MetadataRoute } from "next";
import { BASE } from "@/lib/base";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${BASE}/`,
    name: "Meraki",
    short_name: "Meraki",
    description: "Cleaning, tasks, money and gentle progress, one manageable day at a time.",
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    display: "standalone",
    background_color: "#f6f1ea",
    theme_color: "#f6f1ea",
    icons: [
      { src: `${BASE}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${BASE}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${BASE}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: `${BASE}/icon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
