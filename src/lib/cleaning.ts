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
  wash?: boolean; // a machine load: ticking it brings up the "afterWash" steps the next day
  afterWash?: boolean; // only the day after a wash step was ticked (hang and put away)
  startFirst?: boolean; // older edits: "start first" (now phase "start"); machine loads count too unless set to false
  phase?: Phase; // where it goes in the month-end Big clean (see PHASES)
  how?: string; // your own instructions (Edit); else the built-in ones in cleaningHow.ts
  everyOtherWeek?: WeekParity; // weekly lists: only every other week (see weekParity), whichever day the list lands on
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

type StepInput = [title: string, minutes: number, room: Room, extra?: Pick<Step, "optional" | "hint" | "weekdays" | "every" | "wash" | "afterWash" | "startFirst" | "everyOtherWeek" | "phase">];

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
      step("morning-laundry", "Hang and put away the laundry", 10, "Laundry", { afterWash: true, hint: "from yesterday's washing" }),
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
    steps: [
      ...steps("evening", [
        ["Living room reset", 5, "Living room"],
        ["Empty small bins", 2, "Whole home", { optional: true, hint: "if full" }],
        // The kitchen is wiped after each meal, so only the bathroom here.
        ["Wipe the bathroom sink", 2, "Bathroom"],
        ["Vacuum", 10, "Floors", { optional: true, hint: "if needed" }],
        ["Set up for tomorrow", 3, "Whole home"],
      ]),
      step("evening-rubbish", "Take the rubbish out", 3, "Whole home", { every: { days: 3, from: "2026-10-26" }, hint: "every 3 days" }),
      // Sunday evenings (counted in days, so they stay on Sunday even if the weekly lists move).
      step("evening-makeup", "Clean the makeup brushes", 10, "Bathroom", { every: { days: 7, from: "2026-11-01" }, hint: "every Sunday" }),
      step("evening-hairbrush", "Clean the hairbrush", 5, "Bathroom", { every: { days: 14, from: "2026-11-01" }, hint: "every 2 weeks" }),
    ],
  },

  // ---------- Weekly ----------
  {
    id: "mon",
    name: "Bathroom",
    group: "weekly",
    when: { kind: "weekly", weekday: 0 },
    steps: [
      ...steps("mon", [
        ["Toilet, sink and mirror", 10, "Bathroom"],
        ["Wipe the shower", 5, "Bathroom"],
      ]),
      step("mon-towels", "Wash the towels and the bath rug", 3, "Laundry", { hint: "every other week", wash: true, everyOtherWeek: "odd" }),
    ],
  },
  {
    id: "tue",
    name: "Floors",
    group: "weekly",
    when: { kind: "weekly", weekday: 1 },
    steps: [
      ...steps("tue", [
        ["Vacuum and mop", 30, "Floors"],
        ["Shake the entrance mat", 2, "Floors"],
      ]),
      step("tue-whites", "Wash the whites", 3, "Laundry", { optional: true, wash: true, hint: "if there's enough for a load" }),
    ],
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
      step("wed-colours", "Wash the coloured clothes", 3, "Laundry", { optional: true, wash: true, hint: "if there's enough for a load" }),
    ],
  },
  {
    id: "thu",
    name: "Pari",
    group: "weekly",
    when: { kind: "weekly", weekday: 3 },
    steps: [
      step("thu-pari-bed", "Vacuum Pari's bed", 3, "Pari"),
      step("thu-pari-wash", "Wash Pari's bed cover and blanket", 3, "Laundry", { hint: "every other week", wash: true, everyOtherWeek: "even" }),
    ],
  },
  {
    id: "fri",
    name: "Living room",
    group: "weekly",
    when: { kind: "weekly", weekday: 4 },
    steps: [
      step("fri-0", "Dust the living room", 10, "Living room"),
      step("fri-1", "Wipe the tables", 3, "Living room"),
      step("fri-2", "Vacuum and spray the sofa", 10, "Living room"),
      step("fri-black", "Wash the black clothes", 3, "Laundry", { optional: true, wash: true, hint: "if there's enough for a load" }),
    ],
  },
  {
    id: "sat",
    name: "Bedroom",
    group: "weekly",
    when: { kind: "weekly", weekday: 5 },
    // On a month-end Saturday these join the Big clean: the sheets go in first, the bed is made after the mattress.
    steps: [
      step("sat-sheets", "Strip the bed and wash the sheets", 5, "Laundry", { hint: "Saturday's load", wash: true, phase: "start" }),
      step("sat-0", "Make the bed with fresh sheets", 5, "Bedroom", { hint: "and pillowcases", phase: "bed" }),
      step("sat-2", "Dust the bedroom", 5, "Bedroom", { phase: "high" }),
    ],
  },
  {
    id: "sun",
    name: "Reset",
    group: "weekly",
    when: { kind: "weekly", weekday: 6 },
    // The rubbish is in Evening now (every 3 days); the other ids stay as they were.
    steps: [
      step("sun-1", "Restock toiletries", 5, "Bathroom", { phase: "close" }),
      step("sun-2", "Plan groceries", 10, "Kitchen", { phase: "close" }),
      step("sun-3", "Quick tidy up", 10, "Whole home", { phase: "close" }),
    ],
  },

  // ---------- Last weekend of every month: the Big clean, in the order you clean (see PHASES) ----------
  {
    id: "monthly",
    name: "Monthly reset",
    group: "monthly",
    when: { kind: "monthly", months: ALL_MONTHS },
    steps: [
      step("monthly-protectors", "Wash the mattress and pillow protectors", 5, "Bedroom", { hint: "in with the sheets", wash: true, phase: "start" }),
      step("monthly-drain", "Drain cleaner", 2, "Kitchen", { hint: "let it work", phase: "start" }),
      step("monthly-5", "Declutter 1 drawer", 10, "Whole home", { phase: "clear" }),
      step("monthly-1", "Empty and deep clean the fridge", 20, "Kitchen", { phase: "clear" }),
      step("monthly-mattress", "Vacuum the mattress", 5, "Bedroom", { phase: "bed" }),
      step("monthly-0", "Vacuum under the bed", 10, "Bedroom", { phase: "floors" }),
      step("monthly-floors", "Vacuum and mop all the floors", 30, "Floors", { hint: "last, after everything else", phase: "floors" }),
      step("monthly-3", "Wash the couch throws", 3, "Living room", { hint: "Sunday's load", wash: true, phase: "close" }),
      step("monthly-bin", "Wash the kitchen bin", 10, "Kitchen", { phase: "close" }),
      step("monthly-4", "Clean the vacuums", 10, "Whole home", { hint: "after all the vacuuming", phase: "close" }),
      step("monthly-2", "Sanitize the washing machine", 15, "Laundry", { hint: "last, once the loads are done", phase: "close" }),
    ],
  },

  // ---------- Every 3 months, one set each month ----------
  {
    id: "q-kitchen",
    name: "Kitchen deep clean",
    group: "quarterly",
    when: { kind: "monthly", months: [1, 4, 7, 10] },
    steps: [
      step("q-kitchen-0", "Spray the oven and let it soak", 5, "Kitchen", { phase: "start" }),
      step("q-kitchen-2", "Wipe inside the kitchen cabinets", 20, "Kitchen", { phase: "clear" }),
      step("q-kitchen-4", "Clean on top of the cabinets and fridge", 10, "Kitchen", { phase: "high" }),
      step("q-kitchen-1", "Clean the extractor fans", 15, "Kitchen", { phase: "high" }),
      step("q-kitchen-oven", "Wipe out the oven and wash the racks", 25, "Kitchen", { phase: "bed" }),
      step("q-kitchen-3", "Clean behind the fridge and oven", 15, "Kitchen", { phase: "floors" }),
    ],
  },
  {
    id: "q-living",
    name: "Living room deep clean",
    group: "quarterly",
    when: { kind: "monthly", months: [3, 6, 9, 12] },
    steps: [
      step("q-living-1", "Wash the couch cushion covers", 10, "Living room", { hint: "load 2: they need the day to dry", wash: true, phase: "start" }),
      step("q-living-4", "Dust the lights", 10, "Whole home", { phase: "high" }),
      step("q-living-3", "Wipe the skirting boards", 15, "Whole home", { phase: "floors" }),
      step("q-living-0", "Vacuum under the furniture", 15, "Living room", { phase: "floors" }),
    ],
  },
  {
    id: "q-pari",
    name: "Pari's things + bathroom cabinets",
    group: "quarterly",
    when: { kind: "monthly", months: [2, 5, 8, 11] },
    steps: [
      step("q-pari-1", "Soak Pari's collars, harness and leash", 5, "Pari", { hint: "they need time to dry", phase: "start" }),
      step("q-pari-2", "Wash Pari's toys", 5, "Pari", { hint: "they need time to dry", phase: "start" }),
      step("q-pari-4", "Clean inside the bathroom cabinets", 15, "Bathroom", { phase: "clear" }),
      step("q-pari-0", "Wash Pari's inner bed", 5, "Pari", { hint: "in with the couch throws", wash: true, phase: "close" }),
    ],
  },

  // ---------- Twice a year ----------
  {
    id: "half",
    name: "Bedding",
    group: "twice-a-year",
    when: { kind: "monthly", months: [4, 11] },
    steps: [
      step("q-pari-3", "Wash the pillows", 5, "Bedroom", { hint: "in with the sheets", wash: true, phase: "start" }),
      step("half-0", "Rotate the mattress", 10, "Bedroom", { phase: "bed" }),
      step("half-1", "Wash the duvet and comforter", 5, "Bedroom", { hint: "its own load on Sunday", wash: true, phase: "close" }),
    ],
  },
  {
    id: "balcony",
    name: "Balcony and windows",
    group: "twice-a-year",
    when: { kind: "monthly", months: [3, 9] },
    note: "Spring and end of summer: the balcony and all the windows in one go",
    steps: [
      step("q-living-2", "Clean the windows and balcony door", 30, "Balcony and windows", { phase: "high" }),
      step("half-2", "Deep clean the balcony", 30, "Balcony and windows", { hint: "its floor dries overnight", phase: "floors" }),
    ],
  },
];

// Changes to the default schedule after it could be edited. An edited copy gets them too,
// once each: if you change it back after that, it stays the way you made it.
type Change = { list: string; since: string } & (
  | { step: string } // a new step, placed after the step before it in the default
  | { remove: string }
  | { update: string; patch: Partial<Step> }
  | { rename: Partial<Pick<Routine, "name" | "note">> }
  | { months: number[] } // moved to other months
  | { addList: true } // a whole new list from the default
);

const LOADS = "2026-10-27";
const YEAR = "2026-10-31";
const WINDOWS = "2026-11-01";
const FIRST = "2026-11-01b";
const FORTNIGHT = "2026-11-01c";
const PHASED = "2026-11-01d";
const CHANGES: Change[] = [
  { list: "monthly", step: "monthly-protectors", since: "2026-10-25" },
  { list: "morning", step: "morning-plants", since: "2026-10-26" },
  { list: "morning", step: "morning-laundry", since: "2026-10-26" },
  { list: "evening", step: "evening-rubbish", since: "2026-10-26" },
  { list: "evening", step: "evening-makeup", since: "2026-10-27" },
  { list: "evening", step: "evening-hairbrush", since: "2026-10-27" },
  // One machine load a day, so each has a day to dry (Thursday's four loads spread over the week).
  { list: "mon", remove: "mon-2", since: LOADS },
  { list: "mon", step: "mon-towels", since: LOADS },
  { list: "tue", remove: "tue-2", since: LOADS },
  { list: "tue", step: "tue-whites", since: LOADS },
  { list: "wed", step: "wed-colours", since: LOADS },
  ...["thu-sort", "thu-whites", "thu-colours", "thu-black", "thu-towels"].map((id) => ({ list: "thu", remove: id, since: LOADS })),
  { list: "thu", rename: { name: "Pari", note: undefined }, since: LOADS },
  { list: "thu", step: "thu-pari-bed", since: LOADS },
  { list: "thu", step: "thu-pari-wash", since: LOADS },
  { list: "fri", step: "fri-black", since: LOADS },
  { list: "sat", remove: "sat-3", since: LOADS },
  ...[
    ["sat", "sat-sheets"],
    ["monthly", "monthly-3"],
    ["monthly", "monthly-protectors"],
    ["q-pari", "q-pari-0"],
    ["q-pari", "q-pari-3"],
    ["half", "half-1"],
  ].map(([list, id]) => ({ list, update: id, patch: { hint: defaultStep(list, id).hint }, since: LOADS })),
  // The year plan one month earlier; the balcony gets its own list in March and September.
  ...(
    [
      ["q-kitchen", [3, 6, 9, 12]],
      ["q-living", [1, 4, 7, 10]],
      ["q-pari", [2, 5, 8, 11]],
      ["half", [4, 11]],
    ] as const
  ).map(([list, months]) => ({ list, months: [...months], since: YEAR })),
  { list: "half", remove: "half-2", since: YEAR },
  { list: "half", rename: { note: undefined }, since: YEAR },
  { list: "balcony", addList: true, since: YEAR },
  // The windows go with the balcony, twice a year, instead of with the living room four times.
  { list: "q-living", remove: "q-living-2", since: WINDOWS },
  { list: "q-living", rename: { name: "Living room" }, since: WINDOWS },
  { list: "balcony", step: "q-living-2", since: WINDOWS },
  { list: "balcony", rename: { name: "Balcony and windows", note: "Spring and end of summer: the balcony and all the windows in one go" }, since: WINDOWS },
  // Things that need to dry, soak or run go first on the month-end weekend.
  ...[
    ["monthly", "monthly-2"],
    ["monthly", "monthly-drain"],
    ["q-kitchen", "q-kitchen-0"],
    ["q-living", "q-living-1"],
    ["q-pari", "q-pari-1"],
    ["q-pari", "q-pari-2"],
    ["balcony", "half-2"],
  ].map(([list, id]) => {
    const st = defaultStep(list, id);
    return { list, update: id, patch: { hint: st.hint, startFirst: true }, since: FIRST };
  }),
  // Towels and Pari's bed cover every other week, on alternate weeks.
  ...[
    ["mon", "mon-towels"],
    ["thu", "thu-pari-wash"],
  ].map(([list, id]) => {
    const st = defaultStep(list, id);
    return { list, update: id, patch: { hint: st.hint, everyOtherWeek: st.everyOtherWeek }, since: FORTNIGHT };
  }),
  // The Big clean in phases (1 Nov 2026): clearer names, kitchen and living room swap months, pillows to Bedding,
  // the oven in two parts, the floors at the end, the washing machine last.
  { list: "q-kitchen", months: [1, 4, 7, 10], since: PHASED },
  { list: "q-living", months: [3, 6, 9, 12], since: PHASED },
  { list: "q-living", rename: { name: "Living room deep clean" }, since: PHASED },
  { list: "q-pari", rename: { name: "Pari's things + bathroom cabinets", note: undefined }, since: PHASED },
  { list: "half", rename: { name: "Bedding" }, since: PHASED },
  { list: "q-pari", remove: "q-pari-3", since: PHASED },
  { list: "half", step: "q-pari-3", since: PHASED },
  { list: "monthly", step: "monthly-floors", since: PHASED },
  { list: "q-kitchen", step: "q-kitchen-oven", since: PHASED },
  ...(
    [
      ["fri", ["fri-0"]],
      ["sat", ["sat-sheets", "sat-0", "sat-2"]],
      ["sun", ["sun-1", "sun-2", "sun-3"]],
      ["monthly", ["monthly-protectors", "monthly-drain", "monthly-5", "monthly-1", "monthly-mattress", "monthly-0", "monthly-3", "monthly-bin", "monthly-4", "monthly-2"]],
      ["q-kitchen", ["q-kitchen-0", "q-kitchen-2", "q-kitchen-4", "q-kitchen-1", "q-kitchen-3"]],
      ["q-living", ["q-living-1", "q-living-4", "q-living-3", "q-living-0"]],
      ["q-pari", ["q-pari-1", "q-pari-2", "q-pari-4", "q-pari-0"]],
      ["half", ["half-0", "half-1"]],
      ["balcony", ["q-living-2", "half-2"]],
    ] as const
  ).flatMap(([list, ids]) =>
    ids.map((id) => {
      const st = defaultStep(list, id);
      return { list, update: id, patch: { title: st.title, minutes: st.minutes, hint: st.hint, wash: st.wash, phase: st.phase, startFirst: undefined }, since: PHASED };
    }),
  ),
];

// ---------- The Big clean, in the order you clean ----------

export type Phase = "start" | "clear" | "high" | "bed" | "floors" | "close";

export const PHASES: { id: Phase; label: string; when: string; note: string }[] = [
  { id: "start", label: "Get things going", when: "Saturday morning", note: "Machines, soaks and drying first, so they work while you do the rest" },
  { id: "clear", label: "Clear out", when: "Saturday", note: "Empty, bin, wipe, put back" },
  { id: "high", label: "High up", when: "Saturday", note: "Dust falls down, so start at the top" },
  { id: "bed", label: "Bed and appliances", when: "Saturday", note: "The bed while it's stripped, the oven once it has soaked" },
  { id: "floors", label: "Low and floors", when: "Saturday afternoon", note: "Last, so you clean up everything that fell" },
  { id: "close", label: "Second load and close down", when: "Sunday", note: "The last loads, then put everything away; the washing machine is sanitized last" },
];

/** Within a phase, the order to do things in (steps not listed come after, in list order). */
const PHASE_ORDER = [
  "sat-sheets", "monthly-protectors", "q-pari-3", "q-living-1", "q-kitchen-0", "q-pari-1", "q-pari-2", "monthly-drain",
  "monthly-5", "monthly-1", "q-kitchen-2", "q-pari-4",
  "q-living-4", "q-kitchen-4", "q-kitchen-1", "q-living-2", "sat-2",
  "monthly-mattress", "half-0", "sat-0", "q-kitchen-oven",
  "q-kitchen-3", "q-living-3", "q-living-0", "monthly-0", "half-2", "monthly-floors",
  "monthly-3", "q-pari-0", "half-1", "sun-1", "sun-2", "sun-3", "monthly-bin", "monthly-4", "monthly-2",
];

/** Which part of the Big clean a step belongs to. Steps from before phases: "start first" ones go first. */
export function phaseOf(s: Step): Phase {
  return s.phase ?? ((s.startFirst ?? !!s.wash) ? "start" : "clear");
}

/** Sorts steps into Big clean order: by phase, then the usual order within it. */
export function bigCleanOrder<T>(items: T[], stepOf: (x: T) => Step) {
  const rank = (st: Step) => {
    const i = PHASE_ORDER.indexOf(st.id);
    return PHASES.findIndex((p) => p.id === phaseOf(st)) * 1000 + (i < 0 ? 999 : i);
  };
  return items.map((x, i) => ({ x, i })).sort((a, b) => rank(stepOf(a.x)) - rank(stepOf(b.x)) || a.i - b.i).map((e) => e.x);
}

/** Goes first on the month-end weekend. */
export function isStartFirst(s: Step) {
  return phaseOf(s) === "start";
}

function defaultStep(list: string, id: string) {
  // A step that later moved to another list is still found (the pillows went from Pari's list to Bedding).
  return (
    DEFAULT_CLEANING.find((d) => d.id === list)?.steps.find((st) => st.id === id) ??
    DEFAULT_CLEANING.flatMap((d) => d.steps).find((st) => st.id === id)!
  );
}

function changeKey(c: Change) {
  if ("step" in c) return c.step;
  if ("remove" in c) return `-${c.remove}`;
  if ("update" in c) return `~${c.update}@${c.since}`;
  if ("months" in c) return `${c.list}@months@${c.since}`;
  if ("addList" in c) return `+${c.list}`;
  return `${c.list}@${c.since}`;
}

function applyChange(r: Routine, c: Change): Routine {
  if ("remove" in c) return { ...r, steps: r.steps.filter((st) => st.id !== c.remove) };
  if ("update" in c) return { ...r, steps: r.steps.map((st) => (st.id === c.update ? { ...st, ...c.patch } : st)) };
  if ("rename" in c) return { ...r, ...c.rename };
  if ("months" in c) return r.when.kind === "monthly" ? { ...r, when: { kind: "monthly", months: c.months } } : r;
  if ("addList" in c) return r;
  if (r.steps.some((st) => st.id === c.step)) return r;
  const def = DEFAULT_CLEANING.find((d) => d.id === c.list)!.steps;
  const before = def[def.findIndex((st) => st.id === c.step) - 1];
  const at = before ? r.steps.findIndex((st) => st.id === before.id) : -1;
  const steps = [...r.steps];
  steps.splice(at < 0 ? steps.length : at + 1, 0, defaultStep(c.list, c.step));
  return { ...r, steps };
}

/** An edited schedule plus any changes to the default made since it was saved. */
export function withAddedSteps(lists: Routine[], seen: string[]) {
  const missing = CHANGES.filter((c) => !seen.includes(changeKey(c)));
  if (!missing.length) return { lists, seen };
  const next = lists.map((r) => missing.filter((c) => c.list === r.id).reduce(applyChange, r));
  // New lists go in where the default has them (after the list before them).
  for (const c of missing) {
    if (!("addList" in c) || next.some((r) => r.id === c.list)) continue;
    const i = DEFAULT_CLEANING.findIndex((d) => d.id === c.list);
    const after = next.findIndex((r) => r.id === DEFAULT_CLEANING[i - 1]?.id);
    next.splice(after < 0 ? next.length : after + 1, 0, DEFAULT_CLEANING[i]);
  }
  return { lists: next, seen: [...seen, ...missing.map(changeKey)] };
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

// The ticks so far (set by StoreProvider), for the steps that follow a wash.
let ticks: Record<string, string[]> = {};
export function setCleaningDone(done: Record<string, string[]>) {
  ticks = done;
}

/** Was a machine load ticked the day before `d`? (Loads on the month-end weekend count too.) */
function washedDayBefore(d: Date) {
  const y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  const yKey = dayKey(y);
  const owner = monthEndOwner(y);
  const monthKey = owner ? dayKey(owner).slice(0, 7) : null;
  const washes = new Set(active.flatMap((r) => r.steps.filter((s) => s.wash).map((s) => s.id)));
  return Object.entries(ticks).some(([key, ids]) => {
    const when = key.split("@")[1]?.split("#")[0] ?? "";
    // Month-end lists are saved by month: count them only on their weekend.
    const matches = when === yKey || (monthKey !== null && when === monthKey);
    return matches && ids.some((id) => washes.has(id));
  });
}

/** Steps of a list that apply on this day (e.g. Pari's bowls only Tue/Thu/Sat). */
export function stepsOn(r: Routine, d = today()) {
  const day = weekdayIndex(d);
  return r.steps.filter(
    (s) =>
      (!s.weekdays || s.weekdays.includes(day)) &&
      (!s.every || onEvery(s.every, d)) &&
      (!s.everyOtherWeek || weekParity(d) === s.everyOtherWeek) &&
      (!s.afterWash || washedDayBefore(d)),
  );
}

export type WeekParity = "odd" | "even";

/** Weeks (Monday to Sunday) alternate odd and even, counted from Monday 5 January 2026 (even). */
export function weekParity(d = today()): WeekParity {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - weekdayIndex(d));
  const weeks = Math.round((monday.getTime() - new Date(2026, 0, 5).getTime()) / (7 * 86_400_000));
  return ((weeks % 2) + 2) % 2 === 0 ? "even" : "odd";
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
      // Never onto the weekend: Saturday's sheets and Sunday's reset carry the month-end Big clean.
      .filter((d) => d < 5 && !office.has(d) && !swapped.has(d) && cost(d) < cost(day))
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
/** The daily list for this time of day; none from midnight to 5am (nobody should be cleaning then). */
export function currentDayPart(d = today()): DayPart | null {
  const h = d.getHours();
  if (h < 5) return null;
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
