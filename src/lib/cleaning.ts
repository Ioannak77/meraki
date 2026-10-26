// Ioanna's cleaning plan and the rules for when each list is due.
//
// Daily lists every day, weekly lists on their weekday (moved around office
// days), and the bigger lists on the last weekend of the month they belong
// to, so they can be done in one focused go. Nothing piles up: a missed list
// simply isn't shown again until its next turn.
//
// Every step has a time estimate (for the timer) and a room (so the big
// month-end weekends can be shown room by room).

import { today } from "./clock";
import { dayKey } from "./store";

export type DayPart = "morning" | "meals" | "evening";

export type RoutineWhen =
  | { kind: "daily"; part: DayPart }
  | { kind: "weekly"; weekday: number } // 0 = Monday … 6 = Sunday
  | { kind: "monthly"; months: number[] }; // 1-12, done on the month's last weekend

export type RoutineGroup = "daily" | "weekly" | "monthly" | "quarterly" | "twice-a-year";

export const ROOMS = [
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Living room",
  "Floors",
  "Laundry",
  "Pari",
  "Balcony and windows",
  "Whole home",
] as const;
export type Room = (typeof ROOMS)[number];

export type Step = {
  id: string;
  title: string;
  minutes: number;
  room: Room;
  optional?: boolean;
  hint?: string;
  weekdays?: number[]; // only on these days (0 = Monday); every day if left out
  every?: { days: number; from: string }; // only every N days, counting from "YYYY-MM-DD" (e.g. watering plants)
};

export type Routine = {
  id: string;
  name: string;
  group: RoutineGroup;
  when: RoutineWhen;
  note?: string;
  repeat?: boolean; // can be done several times a day (After meals)
  steps: Step[];
};

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

type StepInput = [title: string, minutes: number, room: Room, extra?: Pick<Step, "optional" | "hint" | "weekdays" | "every">];

function steps(prefix: string, list: StepInput[]): Step[] {
  return list.map(([title, minutes, room, extra], i) => ({ id: `${prefix}-${i}`, title, minutes, room, ...extra }));
}

// Step ids are "<list>-<position>", so ticks are saved by position. When a list
// changes, give moved or new steps a fresh, unused id (see "sat" and "monthly").
function step(id: string, title: string, minutes: number, room: Room, extra?: StepInput[3]): Step {
  return { id, title, minutes, room, ...extra };
}

/** The starting schedule. Edits in the app are saved as a copy of this (see setCleaning). */
export const DEFAULT_CLEANING: Routine[] = [
  // ---------- Daily ----------
  {
    id: "morning",
    name: "Morning",
    group: "daily",
    when: { kind: "daily", part: "morning" },
    steps: [
      ...steps("morning", [
        ["Make the bed", 2, "Bedroom"],
        ["Open the windows", 1, "Whole home", { hint: "leave 10–15 min" }],
        ["Dirty clothes into the laundry", 1, "Laundry"],
        ["Put away anything left from last night", 3, "Living room"],
      ]),
      step("morning-plants", "Water the plants", 5, "Whole home", { every: { days: 3, from: "2026-10-26" }, hint: "every 3 days" }),
    ],
  },
  {
    id: "meals",
    name: "After meals",
    group: "daily",
    when: { kind: "daily", part: "meals" },
    note: "After each meal",
    repeat: true,
    steps: [
      ...steps("meals", [
        ["Wash the dishes", 10, "Kitchen"],
        ["Wipe counters and hob", 3, "Kitchen"],
        ["Put everything back", 2, "Kitchen"],
      ]),
      // Every 2–3 days, on days that never clash with the weekly deep clean.
      step("meals-bowls", "Rinse Pari's bowls", 2, "Pari", { weekdays: [1, 3, 5], hint: "Tue, Thu, Sat" }),
    ],
  },
  {
    id: "evening",
    name: "Evening",
    group: "daily",
    when: { kind: "daily", part: "evening" },
    steps: steps("evening", [
      ["Living room reset", 5, "Living room"],
      ["Empty small bins", 2, "Whole home", { optional: true, hint: "if full" }],
      ["Wipe bathroom sink and kitchen", 3, "Whole home"],
      ["Vacuum", 10, "Floors", { optional: true, hint: "if needed" }],
      ["Set up for tomorrow", 3, "Whole home"],
    ]),
  },

  // ---------- Weekly ----------
  {
    id: "mon",
    name: "Bathroom",
    group: "weekly",
    when: { kind: "weekly", weekday: 0 },
    steps: steps("mon", [
      ["Toilet, sink and mirror", 10, "Bathroom"],
      ["Wipe the shower", 5, "Bathroom"],
      ["Wash the rug", 2, "Bathroom", { hint: "into the machine" }],
    ]),
  },
  {
    id: "tue",
    name: "Floors",
    group: "weekly",
    when: { kind: "weekly", weekday: 1 },
    steps: steps("tue", [
      ["Vacuum and mop", 30, "Floors"],
      ["Shake the entrance mat", 2, "Floors"],
      ["Vacuum Pari's bed", 3, "Pari"],
    ]),
  },
  {
    id: "wed",
    name: "Kitchen",
    group: "weekly",
    when: { kind: "weekly", weekday: 2 },
    steps: [
      step("wed-0", "Wipe cupboard fronts", 5, "Kitchen"),
      step("wed-1", "Wipe the backsplash", 3, "Kitchen"),
      step("wed-2", "Check the fridge for expired food", 5, "Kitchen"),
      step("wed-3", "Deep clean the sink", 5, "Kitchen", { hint: "hot water + baking soda" }),
      step("wed-5", "Deep clean Pari's bowls", 5, "Pari"),
    ],
  },
  {
    id: "thu",
    name: "Laundry",
    group: "weekly",
    when: { kind: "weekly", weekday: 3 },
    steps: steps("thu", [
      ["Wash clothes", 5, "Laundry", { hint: "load the machine" }],
      ["Dust bedroom furniture", 5, "Bedroom"],
    ]),
  },
  {
    id: "fri",
    name: "Living room",
    group: "weekly",
    when: { kind: "weekly", weekday: 4 },
    steps: steps("fri", [
      ["Dust all surfaces", 10, "Living room"],
      ["Wipe the tables", 3, "Living room"],
      ["Vacuum and spray the sofa", 10, "Living room"],
    ]),
  },
  {
    id: "sat",
    name: "Bedroom",
    group: "weekly",
    when: { kind: "weekly", weekday: 5 },
    steps: [
      step("sat-0", "Change the sheets", 10, "Bedroom", { hint: "and pillowcases" }),
      step("sat-towels", "Wash the towels", 3, "Bedroom", { hint: "with the sheets" }),
      step("sat-2", "Dust", 5, "Bedroom"),
      step("sat-3", "Wash Pari's bed cover and blanket", 3, "Pari", { hint: "into the machine" }),
    ],
  },
  {
    id: "sun",
    name: "Reset",
    group: "weekly",
    when: { kind: "weekly", weekday: 6 },
    steps: steps("sun", [
      ["Take the rubbish out", 3, "Whole home"],
      ["Restock toiletries", 5, "Bathroom"],
      ["Plan groceries", 10, "Kitchen"],
      ["Quick tidy up", 10, "Whole home"],
    ]),
  },

  // ---------- Last weekend of every month ----------
  {
    id: "monthly",
    name: "Monthly reset",
    group: "monthly",
    when: { kind: "monthly", months: ALL_MONTHS },
    steps: [
      ...steps("monthly", [
        ["Vacuum under the bed", 10, "Bedroom"],
        ["Deep clean the fridge", 20, "Kitchen"],
        ["Sanitize the washing machine", 5, "Laundry", { hint: "start the cycle" }],
        ["Wash the couch throws", 3, "Living room", { hint: "into the machine" }],
        ["Clean the vacuums", 10, "Whole home"],
        ["Declutter 1 drawer", 10, "Whole home"],
      ]),
      step("monthly-mattress", "Vacuum the mattress", 5, "Bedroom"),
      step("monthly-protectors", "Wash the mattress and pillow protectors", 5, "Bedroom", { hint: "into the machine" }),
      step("monthly-drain", "Drain cleaner", 2, "Kitchen"),
      step("monthly-bin", "Wash the kitchen bin", 10, "Kitchen"),
    ],
  },

  // ---------- Every 3 months, spread so each month gets one set ----------
  {
    id: "q-kitchen",
    name: "Kitchen deep clean",
    group: "quarterly",
    when: { kind: "monthly", months: [1, 4, 7, 10] },
    steps: steps("q-kitchen", [
      ["Clean the oven", 30, "Kitchen"],
      ["Clean the extractor fans", 15, "Kitchen"],
      ["Wipe inside the kitchen cabinets", 20, "Kitchen"],
      ["Clean behind the fridge and oven", 15, "Kitchen"],
      ["Clean on top of the cabinets and fridge", 10, "Kitchen"],
    ]),
  },
  {
    id: "q-living",
    name: "Living room and windows",
    group: "quarterly",
    when: { kind: "monthly", months: [2, 5, 8, 11] },
    steps: steps("q-living", [
      ["Vacuum under the furniture", 15, "Living room"],
      ["Vacuum and wash the couch cushions", 15, "Living room"],
      ["Clean the windows and balcony door", 30, "Balcony and windows"],
      ["Wipe the skirting boards", 15, "Whole home"],
      ["Dust the lights", 10, "Whole home"],
    ]),
  },
  {
    id: "q-pari",
    name: "Pari wash day + bedroom",
    group: "quarterly",
    when: { kind: "monthly", months: [3, 6, 9, 12] },
    note: "All of Pari's washing in one go",
    steps: steps("q-pari", [
      ["Wash Pari's inner bed", 5, "Pari", { hint: "into the machine" }],
      ["Wash Pari's collars, harness and leash", 5, "Pari"],
      ["Wash Pari's toys", 5, "Pari"],
      ["Wash the pillows", 5, "Bedroom", { hint: "into the machine" }],
      ["Clean inside the bathroom cabinets", 15, "Bathroom"],
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
      ["Rotate the mattress", 10, "Bedroom"],
      ["Wash the duvet and comforter", 5, "Bedroom", { hint: "into the machine" }],
      ["Deep clean the balcony", 30, "Balcony and windows"],
    ]),
  },
];

// Steps added to the default schedule after it could be edited. An edited copy gets them too
// (once: if you delete one after that, it stays deleted).
const ADDED_STEPS: { list: string; step: string; since: string }[] = [
  { list: "monthly", step: "monthly-protectors", since: "2026-10-25" },
  { list: "morning", step: "morning-plants", since: "2026-10-26" },
];

/** An edited schedule plus any default steps added since it was saved. */
export function withAddedSteps(lists: Routine[], seen: string[]) {
  const missing = ADDED_STEPS.filter((a) => !seen.includes(a.step));
  if (!missing.length) return { lists, seen };
  const next = lists.map((r) => {
    const add = missing.filter((a) => a.list === r.id && !r.steps.some((st) => st.id === a.step));
    if (!add.length) return r;
    const steps = add.map((a) => DEFAULT_CLEANING.find((d) => d.id === a.list)!.steps.find((st) => st.id === a.step)!);
    return { ...r, steps: [...r.steps, ...steps] };
  });
  return { lists: next, seen: [...seen, ...missing.map((a) => a.step)] };
}

// The schedule in use: the default, or the edited copy saved in the store (set by StoreProvider).
let active: Routine[] = DEFAULT_CLEANING;
export function setCleaning(lists: Routine[] | null | undefined) {
  active = lists ?? DEFAULT_CLEANING;
}
export function cleaningLists() {
  return active;
}

/** Which kind of list a set of months makes (for its colour and label). */
export function groupForMonths(months: number[]): RoutineGroup {
  return months.length >= 12 ? "monthly" : months.length >= 3 ? "quarterly" : "twice-a-year";
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function weekdayIndex(d: Date) {
  return (d.getDay() + 6) % 7;
}

/** Saved among a turn's ticks when you skip it ("Skip today"): not done, but not missed either. */
export const SKIPPED = "__skipped";

export function isSkipped(done: Record<string, string[]>, r: Routine, d = today()) {
  return (done[occurrenceKey(r, d)] ?? []).includes(SKIPPED);
}

/** Steps of a list that apply on this day (e.g. Pari's bowls only Tue/Thu/Sat). */
export function stepsOn(r: Routine, d = today()) {
  const day = weekdayIndex(d);
  return r.steps.filter((s) => (!s.weekdays || s.weekdays.includes(day)) && (!s.every || onEvery(s.every, d)));
}

/** Is `d` one of the "every N days" days (counting from `from`)? */
function onEvery(every: { days: number; from: string }, d: Date) {
  const [y, m, dd] = every.from.split("-").map(Number);
  const gap = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(y, m - 1, dd).getTime()) / 86_400_000);
  return gap >= 0 && gap % Math.max(1, every.days) === 0;
}

// ---------- Month-end weekend ----------

/** The last Saturday of the month `d` is in. Its weekend is the month-end weekend. */
export function monthEndSaturday(d = today()) {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  last.setDate(last.getDate() - ((last.getDay() + 1) % 7)); // back to Saturday
  return last;
}

/**
 * If `d` is on a month-end weekend, the Saturday that starts it, else null.
 * The Sunday can fall in the next month (Sat 31 Oct, Sun 1 Nov): it still
 * belongs to October's lists.
 */
export function monthEndOwner(d = today()) {
  const sat = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (weekdayIndex(d) === 6 ? 1 : 0));
  if (weekdayIndex(sat) !== 5) return null;
  return dayKey(monthEndSaturday(sat)) === dayKey(sat) ? sat : null;
}

export function inEndOfMonthWindow(d = today()) {
  return monthEndOwner(d) !== null;
}

/** "Saturday 31 October": when this month's big lists are due. */
export function monthEndLabel(d = today()) {
  const sat = monthEndSaturday(d);
  return `Saturday ${sat.getDate()} ${MONTHS[sat.getMonth()]}`;
}

/** Which big lists belong to `d`'s month (or to the month-end weekend it's on). */
export function routinesForMonth(d = today()) {
  const month = (monthEndOwner(d) ?? d).getMonth() + 1;
  return active.filter((r) => r.when.kind === "monthly" && r.when.months.includes(month));
}

/** Planned minutes for the steps that count (optional "if needed" steps left out). */
export function plannedMinutes(r: Routine, d = today()) {
  return stepsOn(r, d)
    .filter((s) => !s.optional)
    .reduce((sum, s) => sum + s.minutes, 0);
}

// ---------- Weekly plan around office days ----------

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
  const weekly = active.filter((r) => r.when.kind === "weekly");
  const slots: WeekSlot[] = Array.from({ length: 7 }, (_, day) => ({
    routine: weekly.find((r) => r.when.kind === "weekly" && r.when.weekday === day) ?? {
      id: `free-${day}`,
      name: "Free day",
      group: "weekly",
      when: { kind: "weekly", weekday: day },
      steps: [],
    },
  }));
  const office = new Set(officeDays);
  const swapped = new Set<number>();
  const cost = (day: number) => slots[day].routine.steps.filter((s) => !s.optional).reduce((t, s) => t + s.minutes, 0);

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
    case "monthly": {
      const owner = monthEndOwner(d);
      return owner !== null && r.when.months.includes(owner.getMonth() + 1);
    }
  }
}

/** Key for one turn of a routine: a day for daily/weekly lists, a month for the rest. */
export function occurrenceKey(r: Routine, d = today()) {
  if (r.when.kind === "monthly") return `${r.id}@${dayKey(monthEndOwner(d) ?? d).slice(0, 7)}`;
  return `${r.id}@${dayKey(d)}`;
}

export function dueToday(d = today(), officeDays: number[] = []) {
  return active.filter((r) => isDueOn(r, d, officeDays));
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
