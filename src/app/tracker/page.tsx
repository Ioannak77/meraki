"use client";

// Tracker now lives in Money. This page stays so old links and home screen shortcuts still work.

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function TrackerPage() {
  const router = useRouter();
  useEffect(() => router.replace("/finances/#tracker"), [router]);
  return null;
}
