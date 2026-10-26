"use client";

// Settings > Appearance: puts the chosen theme on <html> (the colours swap in globals.css) and
// matches the phone's status bar to it. The script in layout.tsx does the same before the first paint.

import { useEffect } from "react";
import { useStore } from "@/lib/store";

export function ThemeApply() {
  const { settings } = useStore();
  const theme = settings.theme ?? "light";
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme = theme;
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1b1916" : "#f6f1ea");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return null;
}
