"use client";

// Skincare reminders while Meraki is open: once your morning or evening time
// has passed and steps are still to do, a banner shows at the top of every
// screen (and a notification, once per slot, where the device allows it).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { today } from "@/lib/clock";
import { minutesOf, slotKey, type Slot } from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { useStore } from "@/lib/store";
import { SLOT_LABEL, dueSteps } from "./SlotCard";

const NOTIFIED_KEY = "meraki.skin.notified"; // slot keys already notified / dismissed

function readFlags(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function writeFlags(f: Record<string, boolean>) {
  try {
    // Only keep the last couple of days.
    const keep = Object.fromEntries(Object.entries(f).slice(-8));
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(keep));
  } catch {}
}

function notify(title: string, body: string) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body, icon: "/icon.svg" });
  } catch {
    // Some phones only allow notifications from an installed app; the banner still shows.
  }
}

export function SkinReminder() {
  const { settings: appSettings } = useStore();
  const { ready, steps, done, settings } = useSkin();
  const pathname = usePathname();
  const [pending, setPending] = useState<{ slot: Slot; count: number; key: string } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !settings.remind) return;
    function check() {
      const now = today(appSettings.testDate);
      const mins = now.getHours() * 60 + now.getMinutes();
      // The latest slot whose time has passed (evening wins once it's evening).
      const slot: Slot | null = mins >= minutesOf(settings.pmTime) ? "pm" : mins >= minutesOf(settings.amTime) ? "am" : null;
      if (!slot) return setPending(null);
      const key = slotKey(slot, now);
      const left = dueSteps(steps, slot, now).filter((s) => !(done[key] ?? []).includes(s.id)).length;
      if (left === 0) return setPending(null);
      setPending({ slot, count: left, key });
      const flags = readFlags();
      if (!flags[key]) {
        notify(`${SLOT_LABEL[slot]} skincare`, `${left} ${left === 1 ? "step" : "steps"} to do`);
        writeFlags({ ...flags, [key]: true });
      }
    }
    const first = setTimeout(check, 0);
    const id = setInterval(check, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [ready, steps, done, settings, appSettings.testDate]);

  if (!pending || dismissed === pending.key || pathname.startsWith("/skincare")) return null;

  return (
    <div className="mx-auto mb-4 flex max-w-5xl items-center gap-3 rounded-2xl bg-rose-soft px-4 py-2.5 text-sm text-ink">
      <span className="text-lg">{pending.slot === "am" ? "☀️" : "🌙"}</span>
      <span className="flex-1">
        <strong>{SLOT_LABEL[pending.slot]} skincare</strong> · {pending.count} {pending.count === 1 ? "step" : "steps"} to do
      </span>
      <Link href="/skincare/" className="shrink-0 rounded-full bg-rose px-3 py-1.5 font-bold text-white">
        Open
      </Link>
      <button type="button" onClick={() => setDismissed(pending.key)} aria-label="Hide for now" className="shrink-0 px-1 text-muted">
        ✕
      </button>
    </div>
  );
}
