// Skincare: the steps Ioanna sets up, when each is due, and skin check-ins.

import { today } from "./clock";
import { dayKey } from "./store";

export type Slot = "am" | "pm";

export type SkinSchedule =
  | { kind: "daily" }
  | { kind: "weekdays"; days: number[] } // 0 = Monday … 6 = Sunday
  | { kind: "every"; days: number; from: string }; // every N days, counting from a date

export type SkinStep = {
  id: string;
  name: string; // e.g. "Vitamin C serum"
  slot: Slot;
  schedule: SkinSchedule;
  note?: string; // e.g. "pea-sized, wait 20 min"
};

export type SkinSettings = {
  amTime: string; // "08:00"
  pmTime: string; // "21:30"
  remind: boolean;
  photoEvery: number; // days between check-in photos
};

export type SkinPhoto = { id: string; date: string; note?: string };

export const DEFAULT_SKIN_SETTINGS: SkinSettings = { amTime: "08:00", pmTime: "21:30", remind: true, photoEvery: 14 };

/** A starter routine to edit, so the screen isn't empty on day one. */
export function starterSteps(): SkinStep[] {
  const d = { kind: "daily" } as const;
  return [
    { id: "am-cleanse", name: "Cleanser", slot: "am", schedule: d },
    { id: "am-moist", name: "Moisturiser", slot: "am", schedule: d },
    { id: "am-spf", name: "Sunscreen", slot: "am", schedule: d },
    { id: "pm-cleanse", name: "Cleanser", slot: "pm", schedule: d },
    { id: "pm-exfoliate", name: "Exfoliate", slot: "pm", schedule: { kind: "weekdays", days: [1, 4] } },
    { id: "pm-moist", name: "Moisturiser", slot: "pm", schedule: d },
    { id: "pm-mask", name: "Face mask", slot: "pm", schedule: { kind: "every", days: 7, from: dayKey() } },
  ];
}

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function weekday(d: Date) {
  return (d.getDay() + 6) % 7;
}

function daysBetween(fromKey: string, d: Date) {
  const [y, m, dd] = fromKey.split("-").map(Number);
  const a = new Date(y, m - 1, dd).getTime();
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

export function isStepDue(s: SkinStep, d = today()) {
  switch (s.schedule.kind) {
    case "daily":
      return true;
    case "weekdays":
      return s.schedule.days.includes(weekday(d));
    case "every": {
      const n = daysBetween(s.schedule.from, d);
      return n >= 0 && n % s.schedule.days === 0;
    }
  }
}

export function scheduleLabel(s: SkinSchedule) {
  switch (s.kind) {
    case "daily":
      return "Every day";
    case "weekdays":
      return s.days.length === 7 ? "Every day" : s.days.map((d) => WEEKDAY_SHORT[d]).join(", ");
    case "every":
      return s.days === 1 ? "Every day" : `Every ${s.days} days`;
  }
}

export function slotKey(slot: Slot, d = today()) {
  return `${slot}@${dayKey(d)}`;
}

/** "08:00" → minutes after midnight. */
export function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Which slot to show first right now: morning until noon, evening after. */
export function currentSlot(d = today()): Slot {
  return d.getHours() < 12 ? "am" : "pm";
}

export function nextPhotoDue(photos: SkinPhoto[], every: number) {
  const last = [...photos].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!last) return null; // no photo yet: due now
  const [y, m, d] = last.date.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + every));
}
