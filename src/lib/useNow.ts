"use client";

// The device's current time for screens, kept fresh: it updates every minute
// and as soon as you come back to the app (a phone keeps apps open in the
// background for hours), so "Now", today's lists and the greeting never go
// stale. Test mode (Settings > Testing) still swaps in a pretend day.

import { useEffect, useMemo, useState } from "react";
import { today } from "./clock";
import { useStore } from "./store";

export function useNow() {
  const { settings } = useStore();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    const id = setInterval(bump, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", bump);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", bump);
    };
  }, []);

  return useMemo(() => {
    void tick; // re-read the clock on every tick
    return today(settings.testDate);
  }, [tick, settings.testDate]);
}
