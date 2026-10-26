"use client";

// Keeps the next week's phone reminders up to date: rebuilt whenever something in the app changes
// (and each time it opens), then saved to Supabase for the meraki worker to send.

import { useEffect, useSyncExternalStore } from "react";
import { today } from "@/lib/clock";
import { useFinance } from "@/lib/financeStore";
import { uploadQueue } from "@/lib/push";
import { buildQueue } from "@/lib/pushSchedule";
import { useSkin } from "@/lib/skinStore";
import { DEFAULT_PUSH, useStore } from "@/lib/store";
import { getServerSyncState, getSyncState, subscribeSync } from "@/lib/sync";

let lastUploaded = "";

export function PushScheduler() {
  const store = useStore();
  const finance = useFinance();
  const skin = useSkin();
  const sync = useSyncExternalStore(subscribeSync, getSyncState, getServerSyncState);
  const prefs = { ...DEFAULT_PUSH, ...store.settings.push };
  const ready = store.ready && finance.ready && skin.ready && sync.status === "on";

  const items = ready
    ? buildQueue({
        now: today(),
        prefs: prefs.on ? prefs : { ...prefs, morning: false, skincare: false, care: false, bills: false, kind: false, weekly: false },
        tasks: store.tasks,
        officeDays: store.settings.officeDays,
        bills: finance.bills,
        paid: finance.paid,
        skin: { amTime: skin.settings.amTime, pmTime: skin.settings.pmTime, done: skin.done, items: skin.items },
        routineDone: store.routineDone,
        kindWords: store.settings.kindWords,
      })
    : null;
  const json = items ? JSON.stringify(items) : null;

  useEffect(() => {
    if (!json || json === lastUploaded) return;
    // Wait for a quiet moment so a burst of ticks becomes one upload.
    const t = setTimeout(async () => {
      if (await uploadQueue(JSON.parse(json))) lastUploaded = json;
    }, 3000);
    return () => clearTimeout(t);
  }, [json]);

  return null;
}
