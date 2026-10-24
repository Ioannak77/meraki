"use client";

// Registers the service worker so Meraki opens without internet (built app only; the dev server stays uncached).

import { useEffect } from "react";
import { BASE } from "@/lib/base";

export function OfflineSupport() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => {});
  }, []);
  return null;
}
