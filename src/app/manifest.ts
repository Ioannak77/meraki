import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Meraki",
    short_name: "Meraki",
    description: "Routines, tasks and gentle progress, one manageable day at a time.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1ea",
    theme_color: "#f6f1ea",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
