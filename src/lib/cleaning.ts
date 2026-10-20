// Ioanna's cleaning plan and the rules for when each list is due.
//
// Daily lists every day, weekly lists on their weekday (moved around office
// days), and the bigger lists in the last week of the month they belong to.
// Nothing piles up: a missed list simply isn't shown again until its next turn.
//
// Every step has a time estimate. The timer uses it, and it shows how small
// most jobs really are.

import { today } from "./clock";
import { dayKey } from "./store";

export type DayPart = "morning" | "meals" | "evening";

export type RoutineWhen =
  | { kind: "daily"; part: DayPart }
  | { kind: "weekly"; weekday: number } // 0 = Monday … 6 = Sunday
  | { kind: "monthly"; months: number[] }; // 1-12, done in the month's last week

export type RoutineGroup = "daily" | "weekly" | "monthly" | "quarterly" | "twice-a-year";

export type Step = { id: string; title: string; minutes: number; optional?: boolean; hint?: string };

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

type StepInput = [title: string, minutes: number, extra?: { optional?: boolean; hint?: string }];

function steps(prefix: string, list: StepInput[]): Step[] {
  return list.map(([title, minutes, extra], i) => ({ id: `${prefix}-${i}`, title, minutes, ...extra }));
}

export const CLEANING: Routine[] = [
  // ---------- Daily ----------
  {
    id: "morning",
    name: "Morning",
    group: "daily",
    when: { kind: "daily", part: "morning" },
    steps: steps("morning", [
      ["Make the bed", 2],
      ["Open the windows", 1, { hint: "leave 10–15 min" }],
      ["Dirty clothes into the laundry", 1],
      ["Put away anything left from last night", 3],
    ]),
  },
  {
    id: "meals",
    name: "After meals",
    group: "daily",
    when: { kind: "daily", part: "meals" },
    note: "After each meal",
    steps: steps("meals", [
      ["Wash the dishes", 10],
      ["Wipe counters and hob", 3],
      ["Put everything back", 2],
    ]),
  },
  {
    id: "evening",
    name: "Evening",
    group: "daily",
    when: { kind: "daily", part: "evening" },
    steps: steps("evening", [
      ["Living room reset", 5],
      ["Empty small bins", 2, { optional: true, hint: "if full" }],
      ["Wipe bathroom sink and kitchen", 3],
      ["Vacuum", 10, { optional: true, hint: "if needed" }],
      ["Set up for tomorrow", 3],
    ]),
  },

  // ---------- Weekly ----------
  {
    id: "mon",
    name: "Bathroom",
    group: "weekly",
    when: { kind: "weekly", weekday: 0 },
    steps: steps("mon", [
      ["Toilet, sink and mirror", 10],
      ["Wipe the shower", 5],
      ["Wash the rug", 2, { hint: "into the machine" }],
    ]),
  },
  {
    id: "tue",
    name: "Floors",
    group: "weekly",
    when: { kind: "weekly", weekday: 1 },
    steps: steps("tue", [
      ["Vacuum and mop", 30],
      ["Shake the entrance mat", 2],
      ["Vacuum Pari's bed", 3],
    ]),
  },
  {
    id: "wed",
    name: "Kitchen",
    group: "weekly",
    when: { kind: "weekly", weekday: 2 },
    steps: steps("wed", [
      ["Wipe cupboard fronts", 5],
      ["Wipe the backsplash", 3],
      ["Check the fridge for expired food", 5],
      ["Deep clean the sink", 5],
      ["Drain cleaner", 2],
      ["Deep clean Pari's bowls", 5],
    ]),
  },
  {
    id: "thu",
    name: "Laundry",
    group: "weekly",
    when: { kind: "weekly", weekday: 3 },
    steps: steps("thu", [
      ["Wash clothes", 5, { hint: "load the machine" }],
      ["Dust bedroom furniture", 5],
    ]),
  },
  {
    id: "fri",
    name: "Living room",
    group: "weekly",
    when: { kind: "weekly", weekday: 4 },
    steps: steps("fri", [
      ["Dust all surfaces", 10],
      ["Wipe the tables", 3],
      ["Vacuum and spray the sofa", 10],
    ]),
  },
  {
    id: "sat",
    name: "Bedroom",
    group: "weekly",
    when: { kind: "weekly", weekday: 5 },
    steps: steps("sat", [
      ["Change the sheets", 10],
      ["Vacuum the mattress", 5],
      ["Dust", 5],
      ["Wash Pari's bed cover and blanket", 3, { hint: "into the machine" }],
    ]),
  },
  {
    id: "sun",
    name: "Reset",
    group: "weekly",
    when: { kind: "weekly", weekday: 6 },
    steps: steps("sun", [
      ["Take the rubbish out", 3],
      ["Restock toiletries", 5],
      ["Plan groceries", 10],
      ["Quick tidy up", 10],
    ]),
  },

  // ---------- End of every month ----------
  {
    id: "monthly",
    name: "Monthly reset",
    group: "monthly",
    when: { kind: "monthly", months: ALL_MONTHS },
    steps: steps("monthly", [
      ["Vacuum under the bed", 10],
      ["Deep clean the fridge", 20],
      ["Sanitize the washing machine", 5, { hint: "start the cycle" }],
      ["Wash the couch throws", 3, { hint: "into the machine" }],
      ["Clean the vacuums", 10],
      ["Declutter 1 drawer", 10],
    ]),
  },

  // ---------- Every 3 months, spread so each month gets one set ----------
  {
    id: "q-kitchen",
    name: "Kitchen deep clean",
    group: "quarterly",
    when: { kind: "monthly", months: [1, 4, 7, 10] },
    steps: steps("q-kitchen", [
      ["Clean the oven", 30],
      ["Clean the extractor fans", 15],
      ["Wipe inside the kitchen cabinets", 20],
      ["Clean behind the fridge and oven", 15],
      ["Clean on top of the cabinets and fridge", 10],
    ]),
  },
  {
    id: "q-living",
    name: "Living room and windows",
    group: "quarterly",
    when: { kind: "monthly", months: [2, 5, 8, 11] },
    steps: steps("q-living", [
      ["Vacuum under the furniture", 15],
      ["Vacuum and wash the couch cushions", 15],
      ["Clean the windows and balcony door", 30],
      ["Wipe the skirting boards", 15],
      ["Dust the lights", 10],
    ]),
  },
  {
    id: "q-pari",
    name: "Pari wash day + bedroom",
    group: "quarterly",
    when: { kind: "monthly", months: [3, 6, 9, 12] },
    note: "All of Pari's washing in one go",
    steps: steps("q-pari", [
      ["Wash Pari's inner bed", 5, { hint: "into the machine" }],
      ["Wash Pari's collars, harness and leash", 5],
      ["Wash Pari's toys", 5],
      ["Wash the pillows", 5, { hint: "into the machine" }],
      ["Clean inside the bathroom cabinets", 15],
    ]),
  },

  // ---------- Every 6 months ----------
  {
    id: "half",
    name: "Twice a year",
    group: "twice-a-year",
    when: { kind: "monthly", months: [5, 11] },
    note: "Same month as the windows, so the balcony gets done in one go",
    steps: steps("half", [
      ["Rotate the mattress", 10],
      ["Wash the duvet and comforter", 5, { hint: "into the machine" }],
      ["Deep clean the balcony", 30],
    ]),
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
export function endOfMonthStart(d = today()) {
  return daysInMonth(d) - END_OF_MONTH_DAYS + 1;
}

export function inEndOfMonthWindow(d = today()) {
  return d.getDate() >= endOfMonthStart(d);
}

/** Which lists belong to the month of `d` (whether or not the window is open yet). */
export function routinesForMonth(d = today()) {
  const month = d.getMonth() + 1;
  return CLEANING.filter((r) => r.when.kind === "monthly" && r.when.months.includes(month));
}

/** Planned minutes for the steps that count (optional "if needed" steps left out). */
export function plannedMinutes(r: Routine) {
  return r.steps.filter((s) => !s.optional).reduce((sum, s) => sum + s.minutes, 0);
}

export type WeekSlot = { routine: Routine; movedFrom?: number };

/**
 * Which weekly list happens on each weekday, given the office days.
 *
 * Each office day's list is swapped with the shortest list on a home day, as
 * long as that one really is shorter, so office days get the easy jobs. Ties go
 * to the closest day, so the week keeps roughly its usual rhythm. The longest
 * office day picks first.
 */
export function weeklyPlan(officeDays: number[]): WeekSlot[] {
  const weekly = CLEANING.filter((r) => r.when.kind === "weekly");
  const slots: WeekSlot[] = Array.from({ length: 7 }, (_, day) => ({
    routine: weekly.find((r) => r.when.kind === "weekly" && r.when.weekday === day)!,
  }));
  const office = new Set(officeDays);
  const swapped = new Set<number>();
  const cost = (day: number) => plannedMinutes(slots[day].routine);

  const longestFirst = [...office].sort((a, b) => cost(b) - cost(a));
  for (const day of longestFirst) {
    const other = slots
      .map((_, d) => d)
      .filter((d) => !office.has(d) && !swapped.has(d) && cost(d) < cost(day))
      .sort((a, b) => cost(a) - cost(b) || Math.abs(a - day) - Math.abs(b - day))[0];
    if (other === undefined) continue;
    const mine = slots[day].routine;
    slots[day] = { routine: slots[other].routine, movedFrom: other };
    slots[other] = { routine: mine, movedFrom: day };
    swapped.add(other);
  }
  return slots;
}

export function isDueOn(r: Routine, d = today(), officeDays: number[] = []) {
  switch (r.when.kind) {
    case "daily":
      return true;
    case "weekly":
      return weeklyPlan(officeDays)[weekdayIndex(d)].routine.id === r.id;
    case "monthly":
      return r.when.months.includes(d.getMonth() + 1) && inEndOfMonthWindow(d);
  }
}

/** Key for one turn of a routine: a day for daily/weekly lists, a month for the rest. */
export function occurrenceKey(r: Routine, d = today()) {
  if (r.when.kind === "monthly") return `${r.id}@${dayKey(d).slice(0, 7)}`;
  return `${r.id}@${dayKey(d)}`;
}

export function dueToday(d = today(), officeDays: number[] = []) {
  return CLEANING.filter((r) => isDueOn(r, d, officeDays));
}

/** Daily list to put first right now: morning before 12, evening from 18. */
export function currentDayPart(d = today()): DayPart {
  const h = d.getHours();
  if (h < 12) return "morning";
  if (h < 18) return "meals";
  return "evening";
}

export function formatMinutes(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
