// Ioanna's cleaning plan and the rules for when each list is due.
//
// Daily lists every day, weekly lists on their weekday, and the bigger lists in
// the last week of the month they belong to. Nothing piles up: a missed list
// simply isn't shown again until its next turn.

import { dayKey } from "./store";

export type DayPart = "morning" | "meals" | "evening";

export type RoutineWhen =
  | { kind: "daily"; part: DayPart }
  | { kind: "weekly"; weekday: number } // 0 = Monday … 6 = Sunday
  | { kind: "monthly"; months: number[] }; // 1-12, done in the month's last week

export type RoutineGroup = "daily" | "weekly" | "monthly" | "quarterly" | "twice-a-year";

export type Step = { id: string; title: string; optional?: boolean; hint?: string };

export type Routine = {
  id: string;
  name: string;
  group: RoutineGroup;
  when: RoutineWhen;
  note?: string;
  steps: Step[];
};

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const END_OF_MONTH_DAYS = 7;

function steps(prefix: string, list: (string | Omit<Step, "id">)[]): Step[] {
  return list.map((s, i) => (typeof s === "string" ? { id: `${prefix}-${i}`, title: s } : { id: `${prefix}-${i}`, ...s }));
}

export const CLEANING: Routine[] = [
  // ---------- Daily ----------
  {
    id: "morning",
    name: "Morning",
    group: "daily",
    when: { kind: "daily", part: "morning" },
    steps: steps("morning", [
      "Make the bed",
      { title: "Open the windows", hint: "10–15 min" },
      "Dirty clothes into the laundry",
      "Put away anything left from last night",
    ]),
  },
  {
    id: "meals",
    name: "After meals",
    group: "daily",
    when: { kind: "daily", part: "meals" },
    note: "After each meal",
    steps: steps("meals", ["Wash the dishes", "Wipe counters and hob", "Put everything back"]),
  },
  {
    id: "evening",
    name: "Evening",
    group: "daily",
    when: { kind: "daily", part: "evening" },
    steps: steps("evening", [
      { title: "Living room reset", hint: "5 min" },
      { title: "Empty small bins", hint: "if full", optional: true },
      "Wipe bathroom sink and kitchen",
      { title: "Vacuum", hint: "if needed", optional: true },
      "Set up for tomorrow",
    ]),
  },

  // ---------- Weekly ----------
  {
    id: "mon",
    name: "Bathroom",
    group: "weekly",
    when: { kind: "weekly", weekday: 0 },
    steps: steps("mon", ["Toilet, sink and mirror", "Wipe the shower", "Wash the rug"]),
  },
  {
    id: "tue",
    name: "Floors",
    group: "weekly",
    when: { kind: "weekly", weekday: 1 },
    steps: steps("tue", ["Vacuum and mop", "Shake the entrance mat", "Vacuum Pari's bed"]),
  },
  {
    id: "wed",
    name: "Kitchen",
    group: "weekly",
    when: { kind: "weekly", weekday: 2 },
    steps: steps("wed", [
      "Wipe cupboard fronts",
      "Wipe the backsplash",
      "Check the fridge for expired food",
      "Deep clean the sink",
      "Drain cleaner",
      "Deep clean Pari's bowls",
    ]),
  },
  {
    id: "thu",
    name: "Laundry",
    group: "weekly",
    when: { kind: "weekly", weekday: 3 },
    steps: steps("thu", ["Wash clothes", "Dust bedroom furniture"]),
  },
  {
    id: "fri",
    name: "Living room",
    group: "weekly",
    when: { kind: "weekly", weekday: 4 },
    steps: steps("fri", ["Dust all surfaces", "Wipe the tables", "Vacuum and spray the sofa"]),
  },
  {
    id: "sat",
    name: "Bedroom",
    group: "weekly",
    when: { kind: "weekly", weekday: 5 },
    steps: steps("sat", ["Change the sheets", "Vacuum the mattress", "Dust", "Wash Pari's bed cover and blanket"]),
  },
  {
    id: "sun",
    name: "Reset",
    group: "weekly",
    when: { kind: "weekly", weekday: 6 },
    steps: steps("sun", ["Take the rubbish out", "Restock toiletries", "Plan groceries", "Quick tidy up"]),
  },

  // ---------- End of every month ----------
  {
    id: "monthly",
    name: "Monthly reset",
    group: "monthly",
    when: { kind: "monthly", months: ALL_MONTHS },
    steps: steps("monthly", [
      "Vacuum under the bed",
      "Deep clean the fridge",
      "Sanitize the washing machine",
      "Wash the couch throws",
      "Clean the vacuums",
      "Declutter 1 drawer",
    ]),
  },

  // ---------- Every 3 months, spread so each month gets one set ----------
  {
    id: "q-kitchen",
    name: "Kitchen deep clean",
    group: "quarterly",
    when: { kind: "monthly", months: [1, 4, 7, 10] },
    steps: steps("q-kitchen", [
      "Clean the oven",
      "Clean the extractor fans",
      "Wipe inside the kitchen cabinets",
      "Clean behind the fridge and oven",
      "Clean on top of the cabinets and fridge",
    ]),
  },
  {
    id: "q-living",
    name: "Living room and windows",
    group: "quarterly",
    when: { kind: "monthly", months: [2, 5, 8, 11] },
    steps: steps("q-living", [
      "Vacuum under the furniture",
      "Vacuum and wash the couch cushions",
      "Clean the windows and balcony door",
      "Wipe the skirting boards",
      "Dust the lights",
    ]),
  },
  {
    id: "q-pari",
    name: "Pari wash day + bedroom",
    group: "quarterly",
    when: { kind: "monthly", months: [3, 6, 9, 12] },
    note: "All of Pari's washing in one go",
    steps: steps("q-pari", [
      "Wash Pari's inner bed",
      "Wash Pari's collars, harness and leash",
      "Wash Pari's toys",
      "Wash the pillows",
      "Clean inside the bathroom cabinets",
    ]),
  },

  // ---------- Every 6 months ----------
  {
    id: "half",
    name: "Twice a year",
    group: "twice-a-year",
    when: { kind: "monthly", months: [5, 11] },
    note: "Same month as the windows, so the balcony gets done in one go",
    steps: steps("half", ["Rotate the mattress", "Wash the duvet and comforter", "Deep clean the balcony"]),
  },
];

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function weekdayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** First day of the "end of month" window, e.g. the 25th in October. */
export function endOfMonthStart(d = new Date()) {
  return daysInMonth(d) - END_OF_MONTH_DAYS + 1;
}

export function inEndOfMonthWindow(d = new Date()) {
  return d.getDate() >= endOfMonthStart(d);
}

/** Which lists belong to the month of `d` (whether or not the window is open yet). */
export function routinesForMonth(d = new Date()) {
  const month = d.getMonth() + 1;
  return CLEANING.filter((r) => r.when.kind === "monthly" && r.when.months.includes(month));
}

export function isDueOn(r: Routine, d = new Date()) {
  switch (r.when.kind) {
    case "daily":
      return true;
    case "weekly":
      return r.when.weekday === weekdayIndex(d);
    case "monthly":
      return r.when.months.includes(d.getMonth() + 1) && inEndOfMonthWindow(d);
  }
}

/** Key for one turn of a routine: a day for daily/weekly lists, a month for the rest. */
export function occurrenceKey(r: Routine, d = new Date()) {
  if (r.when.kind === "monthly") return `${r.id}@${dayKey(d).slice(0, 7)}`;
  return `${r.id}@${dayKey(d)}`;
}

export function dueToday(d = new Date()) {
  return CLEANING.filter((r) => isDueOn(r, d));
}

/** Daily list to put first right now: morning before 12, evening from 18. */
export function currentDayPart(d = new Date()): DayPart {
  const h = d.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "meals";
  return "evening";
}
