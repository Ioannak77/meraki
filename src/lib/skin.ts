// Self care: skincare steps and repeating reminders (waxing, nails, hair…).

import { today } from "./clock";
import { dayKey } from "./store";

// am/pm: skincare at your morning and evening times. day: daily self care (vitamins, water…), any time.
export type Slot = "am" | "pm" | "day";

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
};

export const DEFAULT_SKIN_SETTINGS: SkinSettings = { amTime: "08:00", pmTime: "21:30" };

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

/**
 * Which slot is "now": evening from 3 hours before your evening time (18:30
 * for a 21:30 routine), morning before that, so the middle of the day still
 * shows the morning list.
 */
export function currentSlot(d = today(), pmTime = DEFAULT_SKIN_SETTINGS.pmTime): Slot {
  const mins = d.getHours() * 60 + d.getMinutes();
  return mins >= minutesOf(pmTime) - 180 ? "pm" : "am";
}

/**
 * The skincare that's "now" and the day it belongs to. Until 3am it's still last night's evening
 * (home late from a night out); from 3 to 5am it's resting (nothing shown as due); morning from 5am.
 */
export function skinNow(d = today(), pmTime = DEFAULT_SKIN_SETTINGS.pmTime): { slot: Slot; date: Date; resting: boolean } {
  const h = d.getHours();
  if (h < 3) return { slot: "pm", date: new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 23, 59), resting: false };
  if (h < 5) return { slot: "am", date: d, resting: true };
  return { slot: currentSlot(d, pmTime), date: d, resting: false };
}


// ---------- Repeating self-care reminders (waxing, nails, hair…) ----------

export type CareItem = {
  id: string;
  name: string; // e.g. "Waxing"
  everyDays: number; // how often
  lastDone: string | null; // "YYYY-MM-DD"; null until you say when you last did it
  showBefore: number; // days early it shows on Today (to book an appointment)
  note?: string;
};

/** Suggestions to start with; delete or change any of them. */
export function starterCareItems(): CareItem[] {
  return [
    { id: "care-waxing", name: "Waxing", everyDays: 28, lastDone: null, showBefore: 7 },
    { id: "care-nails", name: "Nails", everyDays: 21, lastDone: null, showBefore: 3 },
    { id: "care-hair", name: "Haircut", everyDays: 56, lastDone: null, showBefore: 7 },
    { id: "care-brows", name: "Eyebrows", everyDays: 28, lastDone: null, showBefore: 3 },
  ];
}

export const CARE_EVERY = [
  { days: 7, label: "Every week" },
  { days: 14, label: "2 weeks" },
  { days: 21, label: "3 weeks" },
  { days: 28, label: "4 weeks" },
  { days: 42, label: "6 weeks" },
  { days: 56, label: "8 weeks" },
  { days: 84, label: "12 weeks" },
];

export function everyLabel(days: number) {
  if (days % 7 === 0) return days === 7 ? "Every week" : `Every ${days / 7} weeks`;
  return `Every ${days} days`;
}

/** When it's next due ("YYYY-MM-DD"), or null if we don't know when it was last done. */
export function careNextDue(item: CareItem) {
  if (!item.lastDone) return null;
  const [y, m, d] = item.lastDone.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + item.everyDays));
}

/** Days until it's due (negative = overdue), or null if not set up yet. */
export function careDaysLeft(item: CareItem, d = today()) {
  const next = careNextDue(item);
  if (!next) return null;
  return daysBetween(dayKey(d), new Date(next + "T12:00:00"));
}

/** Should it show on Today? From `showBefore` days ahead, and while overdue. */
export function careIsDueSoon(item: CareItem, d = today()) {
  const left = careDaysLeft(item, d);
  return left !== null && left <= item.showBefore;
}

export function careStatus(item: CareItem, d = today()) {
  const left = careDaysLeft(item, d);
  if (left === null) return "When did you last do it?";
  if (left < 0) return `${-left} ${left === -1 ? "day" : "days"} overdue`;
  if (left === 0) return "Due today";
  if (left === 1) return "Due tomorrow";
  const next = new Date(careNextDue(item)! + "T12:00:00");
  return `Due ${next.toLocaleDateString(undefined, { day: "numeric", month: "short" })} · in ${left} days`;
}
