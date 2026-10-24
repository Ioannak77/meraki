"use client";

// Starts syncing with the other devices (if signed in) when the app opens.

import { useEffect } from "react";
import { startSync } from "@/lib/sync";

export function SyncStart() {
  useEffect(() => startSync(), []);
  return null;
}
