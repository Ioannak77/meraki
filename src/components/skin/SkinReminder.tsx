"use client";

// Self-care reminders while Meraki is open: once your morning or evening
// skincare time has passed with steps still to do, or a repeating reminder
// (waxing, nails…) is due, a banner shows at the top of every screen, plus a
// notification (once per slot / once a day) where the device allows it.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { today } from "@/lib/clock";
import { careDaysLeft, minutesOf, slotKey, type Slot } from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { dayKey, useStore } from "@/lib/store";
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

type Pending = { icon: string; title: string; detail: string; key: string };

export function SkinReminder() {
  const { settings: appSettings } = useStore();
  const { ready, steps, done, settings, items } = useSkin();
  const pathname = usePathname();
  const [pending, setPending] = useState<Pending | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !settings.remind) return;
    function check() {
      const now = today(appSettings.testDate);
      const mins = now.getHours() * 60 + now.getMinutes();
      // The latest slot whose time has passed (evening wins once it's evening).
      const slot: Slot | null = mins >= minutesOf(settings.pmTime) ? "pm" : mins >= minutesOf(settings.amTime) ? "am" : null;
      const key = slot ? slotKey(slot, now) : "";
      const left = slot ? dueSteps(steps, slot, now).filter((s) => !(done[key] ?? []).includes(s.id)).length : 0;
      // Repeating reminders that are due today or overdue.
      const careDue = items.filter((i) => (careDaysLeft(i, now) ?? 1) <= 0);
      let next: Pending | null = null;
      if (slot && left > 0) {
        next = {
          icon: slot === "am" ? "☀️" : "🌙",
          title: `${SLOT_LABEL[slot]} skincare`,
          detail: `${left} ${left === 1 ? "step" : "steps"} to do`,
          key,
        };
      } else if (careDue.length > 0) {
        next = {
          icon: "💅",
          title: careDue.map((i) => i.name).join(", "),
          detail: careDue.length === 1 ? "is due" : "are due",
          key: `care@${dayKey(now)}`,
        };
      }
      setPending(next);
      if (!next) return;
      const flags = readFlags();
      if (!flags[next.key]) {
        notify(next.title, next.detail);
        writeFlags({ ...flags, [next.key]: true });
      }
    }
    const first = setTimeout(check, 0);
    const id = setInterval(check, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [ready, steps, done, settings, items, appSettings.testDate]);

  if (!pending || dismissed === pending.key || pathname.startsWith("/self-care")) return null;

  return (
    <div className="mx-auto mb-4 flex max-w-5xl items-center gap-3 rounded-2xl bg-rose-soft px-4 py-2.5 text-sm text-ink">
      <span className="text-lg">{pending.icon}</span>
      <span className="flex-1">
        <strong>{pending.title}</strong> · {pending.detail}
      </span>
      <Link href="/self-care/" className="shrink-0 rounded-full bg-rose px-3 py-1.5 font-bold text-white">
        Open
      </Link>
      <button type="button" onClick={() => setDismissed(pending.key)} aria-label="Hide for now" className="shrink-0 px-1 text-muted">
        ✕
      </button>
    </div>
  );
}
