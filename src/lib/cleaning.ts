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
  months?: number[]; // month-end lists: only in these months (1-12), e.g. the mattress protector every 2 months
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

type StepInput = [title: string, minutes: number, room: Room, extra?: Pick<Step, "optional" | "hint" | "weekdays" | "every" | "wash" | "afterWash" | "startFirst" | "everyOtherWeek" | "phase" | "months">];

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
      step("tue-0", "Vacuum the floors", 15, "Floors"),
      step("tue-mop", "Mop the floors", 15, "Floors", { hint: "every other week", everyOtherWeek: "odd" }),
      step("tue-1", "Shake the entrance mat", 2, "Floors"),
      step("tue-whites", "Wash the whites", 3, "Laundry", { optional: true, wash: true, hint: "if there's enough for a load" }),
    ],
  },
  {
    id: "wed",
    name: "Kitchen",
    group: "weekly",
    when: { kind: "weekly", weekday: 2 },
    steps: [
      // Fronts and backsplash take turns, one each week.
      step("wed-0", "Wipe cupboard fronts", 5, "Kitchen", { hint: "every other week", everyOtherWeek: "odd" }),
      step("wed-1", "Wipe the backsplash", 3, "Kitchen", { hint: "every other week", everyOtherWeek: "even" }),
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
      // Dusting and the sofa take turns, one each week.
      step("fri-0", "Dust the living room", 10, "Living room", { hint: "every other week", everyOtherWeek: "odd" }),
      step("fri-1", "Wipe the tables", 3, "Living room"),
      step("fri-2", "Vacuum and spray the sofa", 10, "Living room", { hint: "every other week", everyOtherWeek: "even" }),
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
      step("sat-sheets", "Strip the bed and wash the sheets", 5, "Laundry", { hint: "the day's load", wash: true, phase: "start" }),
      step("sat-0", "Make the bed with fresh sheets", 5, "Bedroom", { hint: "and pillowcases", phase: "bed" }),
      step("sat-2", "Dust the bedroom", 5, "Bedroom", { hint: "every other week", everyOtherWeek: "even", phase: "high" }),
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
      step("monthly-protectors", "Wash the pillow protectors", 3, "Bedroom", { hint: "in with the sheets", wash: true, phase: "start" }),
      step("monthly-mattress-protector", "Wash the mattress protector", 5, "Bedroom", {
        hint: "in with the sheets · every 2 months",
        wash: true,
        phase: "start",
        months: [1, 3, 5, 7, 9, 11],
      }),
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
      step("half-1", "Wash the duvet and comforter", 5, "Bedroom", { hint: "its own load, after the sheets", wash: true, phase: "close" }),
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
const PROTECTORS = "2026-11-01e";
const BEDROOM = "2026-11-01f";
const LIGHTER = "2026-11-06";
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
  // Pillow protectors every month, the mattress protector every 2 months (from November).
  { list: "monthly", update: "monthly-protectors", patch: { title: "Wash the pillow protectors", minutes: 3 }, since: PROTECTORS },
  { list: "monthly", step: "monthly-mattress-protector", since: PROTECTORS },
  // The bedroom jobs moved to the bedroom day, which isn't always a Saturday or Sunday.
  { list: "sat", update: "sat-sheets", patch: { hint: "the day's load" }, since: BEDROOM },
  { list: "half", update: "half-1", patch: { hint: "its own load, after the sheets" }, since: BEDROOM },
  // A lighter week: these take turns every other week, spread so each week gets about half.
  { list: "tue", update: "tue-0", patch: { title: "Vacuum the floors", minutes: 15 }, since: LIGHTER },
  { list: "tue", step: "tue-mop", since: LIGHTER },
  ...(
    [
      ["wed", "wed-0"],
      ["wed", "wed-1"],
      ["fri", "fri-0"],
      ["fri", "fri-2"],
      ["sat", "sat-2"],
    ] as const
  ).map(([list, id]) => {
    const st = defaultStep(list, id);
    return { list, update: id, patch: { hint: st.hint, everyOtherWeek: st.everyOtherWeek }, since: LIGHTER };
  }),
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

/**
 * On the month-end weekend the Morning and Evening lists join the Big clean (After meals stays on its own:
 * it's ticked after every meal). Where their steps go, and the ones the Big clean already covers.
 */
const DAILY_PHASE: Record<string, Phase> = {
  "morning-0": "start", "morning-1": "start", "morning-2": "start", "morning-laundry": "start",
  "morning-3": "clear",
  "morning-plants": "close", "evening-0": "close", "evening-1": "close", "evening-2": "close", "evening-3": "close",
  "evening-4": "close", "evening-rubbish": "close", "evening-makeup": "close", "evening-hairbrush": "close",
  // The weekly list that joins the Big clean on its matching month (see monthEndSwap).
  "wed-colours": "start", "wed-0": "clear", "wed-3": "clear", "wed-1": "high", "wed-5": "close",
  "thu-pari-wash": "start", "thu-pari-bed": "floors",
  "fri-black": "start", "fri-1": "clear", "fri-0": "high", "fri-2": "floors",
};
const COVERED_BY: Record<string, string> = {
  "wed-2": "monthly-1", // the fridge is emptied and cleaned anyway
  "morning-0": "sat-0", // Saturday's bed is made with fresh sheets later on
  "evening-3": "monthly-floors", // every floor is vacuumed and mopped
};

/** Daily lists that join the Big clean on the month-end weekend: all but the ones done again after each meal. */
export function joinsBigClean(r: Routine) {
  return r.when.kind !== "daily" || !r.repeat;
}

/** A step left out of the Big clean because another step in it does the job. */
export function coveredInBigClean(s: Step, ids: Set<string>) {
  const by = COVERED_BY[s.id];
  return !!by && ids.has(by);
}

/** Within a phase, the order to do things in (steps not listed come after, in list order). */
const PHASE_ORDER = [
  "morning-1", "morning-2", "morning-laundry", "morning-0",
  "sat-sheets", "monthly-protectors", "monthly-mattress-protector", "q-pari-3", "q-living-1", "q-kitchen-0", "q-pari-1", "q-pari-2", "monthly-drain",
  "morning-3", "monthly-5", "monthly-1", "q-kitchen-2", "q-pari-4",
  "q-living-4", "q-kitchen-4", "q-kitchen-1", "q-living-2", "sat-2",
  "monthly-mattress", "half-0", "sat-0", "q-kitchen-oven",
  "q-kitchen-3", "q-living-3", "q-living-0", "monthly-0", "half-2", "monthly-floors",
  "monthly-3", "q-pari-0", "half-1", "sun-1", "sun-2", "sun-3", "morning-plants",
  "evening-0", "evening-2", "evening-1", "evening-makeup", "evening-hairbrush", "monthly-bin", "evening-rubbish", "monthly-4", "monthly-2", "evening-4",
];

/** Which part of the Big clean a step belongs to. Steps from before phases: "start first" ones go first. */
export function phaseOf(s: Step): Phase {
  return s.phase ?? DAILY_PHASE[s.id] ?? ((s.startFirst ?? !!s.wash) ? "start" : "clear");
}

/** Sorts steps into Big clean order: by phase, then the usual order within it. */
export function bigCleanOrder<T>(items: T[], stepOf: (x: T) => Step) {
  const rank = (st: Step) => {
    const i = PHASE_ORDER.indexOf(st.id);
    return PHASES.findIndex((p) => p.id === phaseOf(st)) * 1000 + (i < 0 ? 999 : i);
  };
  return items.map((x, i) => ({ x, i })).sort((a, b) => rank(stepOf(a.x)) - rank(stepOf(b.x)) || a.i - b.i).map((e) => e.x);
}

/**
 * Everything in the Big clean on a month-end day, in cleaning order: the given lists, plus the weekly list that
 * matches the month's deep clean (saved under the Saturday), without steps it already covers or the bedroom jobs.
 */
export function bigCleanItems(routines: Routine[], date: Date) {
  const swap = monthEndSwap(date);
  const lists: { r: Routine; on: Date }[] = [
    ...routines.map((r) => ({ r, on: date })),
    ...(swap && !routines.some((r) => r.id === swap.weekly.id) ? [{ r: swap.weekly, on: swap.saturday }] : []),
  ];
  const all = lists.flatMap(({ r, on }) => stepsOn(r, on).map((step) => ({ step, occurrence: occurrenceKey(r, on), listName: r.name })));
  const ids = new Set(all.map((it) => it.step.id));
  return bigCleanOrder(
    all.filter((it) => !coveredInBigClean(it.step, ids) && !(swap && BEDROOM_DAY.includes(it.step.id))),
    (it) => it.step,
  );
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

// Every tick, by step: the days ("YYYY-MM-DD") and month-ends ("YYYY-MM") it was done. Rebuilt when ticks change.
let tickIndex: { from: Record<string, string[]>; days: Map<string, string[]>; months: Map<string, string[]> } | null = null;
function ticksOf(stepId: string) {
  if (!tickIndex || tickIndex.from !== ticks) {
    const days = new Map<string, string[]>();
    const months = new Map<string, string[]>();
    for (const [key, ids] of Object.entries(ticks)) {
      const when = key.split("@")[1]?.split("#")[0] ?? "";
      const into = when.length === 10 ? days : when.length === 7 ? months : null;
      if (!into) continue;
      for (const id of ids) if (id !== SKIPPED) into.set(id, [...(into.get(id) ?? []), when]);
    }
    tickIndex = { from: ticks, days, months };
  }
  return { days: tickIndex.days.get(stepId) ?? [], months: tickIndex.months.get(stepId) ?? [] };
}

const toDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDaysKey = (key: string, n: number) => {
  const d = toDate(key);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
const shortDay = (key: string) => toDate(key).toLocaleDateString(undefined, { weekday: "long" });

/**
 * Steps that stay due until they're done, because skipping them has a cost (the rubbish, the plants,
 * hanging the washing). The next turn counts from the day you actually did it.
 */
const CARRY = ["evening-rubbish", "morning-plants", "morning-laundry"];

/** For an "every N days" step that carries over: due today, and since when if it's late. */
function carriedEvery(s: Step, d: Date): { due: boolean; since?: string } {
  const key = dayKey(d);
  const done = ticksOf(s.id).days;
  if (done.includes(key)) return { due: true };
  const last = done.filter((k) => k < key).sort().at(-1);
  let next: string;
  if (last) next = addDaysKey(last, s.every!.days);
  else {
    // Never done: its last turn on or before today.
    const gap = Math.round((toDate(key).getTime() - toDate(s.every!.from).getTime()) / 86_400_000);
    if (gap < 0) return { due: false };
    next = addDaysKey(s.every!.from, gap - (gap % Math.max(1, s.every!.days)));
  }
  return next <= key ? { due: true, since: next < key ? next : undefined } : { due: false };
}

/** Hanging the washing: due from the day after a load, until it's hung (looking back 10 days). */
function carriedHang(s: Step, d: Date): { due: boolean; since?: string } {
  const key = dayKey(d);
  const hung = ticksOf(s.id).days;
  const washes = active.flatMap((r) => r.steps.filter((st) => st.wash).map((st) => st.id));
  // Loads on a month-end weekend are saved by month: count them on its Saturday.
  const washDays = washes
    .flatMap((id) => [...ticksOf(id).days, ...ticksOf(id).months.map((m) => dayKey(monthEndSaturday(toDate(`${m}-01`))))])
    .filter((k) => k < key && k >= addDaysKey(key, -10))
    .sort();
  const lastWash = washDays.at(-1);
  if (hung.includes(key)) return { due: true };
  if (!lastWash || hung.some((h) => h > lastWash && h < key)) return { due: false };
  const since = addDaysKey(lastWash, 1);
  return { due: true, since: since < key ? since : undefined };
}

/** Steps of a list that apply on this day (e.g. Pari's bowls only Tue/Thu/Sat). */
export function stepsOn(r: Routine, d = today()) {
  const day = weekdayIndex(d);
  const owner = monthEndOwner(d) ?? d;
  const month = owner.getMonth() + 1;
  // Month-end lists: what the queue picked for this month (see monthEndPlan); bedroom jobs keep their months.
  const picked = r.when.kind === "monthly" ? monthEndPlan(monthIndex(owner)).stepIds : null;
  const out: Step[] = [];
  for (const s of r.steps) {
    if (r.when.kind === "monthly") {
      if (BEDROOM_DAY.includes(s.id)) {
        if (!r.when.months.includes(month) || (s.months && !s.months.includes(month))) continue;
      } else if (!picked!.has(s.id)) continue;
    }
    if (s.weekdays && !s.weekdays.includes(day)) continue;
    if (s.everyOtherWeek && weekParity(d) !== s.everyOtherWeek) continue;
    // Steps that carry over until done; they say since when if they're late.
    if (CARRY.includes(s.id) && (s.every || s.afterWash)) {
      const c = s.afterWash ? carriedHang(s, d) : carriedEvery(s, d);
      if (!c.due) continue;
      out.push(c.since ? { ...s, hint: `still to do, since ${shortDay(c.since)}` } : s);
      continue;
    }
    if (s.every && !onEvery(s.every, d)) continue;
    if (s.afterWash && !carriedHang(s, d).due) continue;
    out.push(s);
  }
  return out;
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

// ---------- The month-end queue ----------
// Each month-end job (the oven, the windows, the fridge…) keeps its rhythm, from its list's months
// (4 a year = every 3 months), and remembers when it was last done. At each month-end the Big clean gets
// the jobs that are due, most overdue first, up to a time limit. A job that isn't done stays due and is
// first in line next month; the next turn counts from the month it was actually done. The bedroom jobs
// aren't in the queue: they're done on the bedroom day (see bedroomDay).

/** The time limit for a month-end Big clean's own jobs (minutes). */
export const BIG_CLEAN_BUDGET = 120;
const QUEUE_START = 2026 * 12 + 10; // November 2026: the first month-end planned by the queue
/** In every Big clean whatever else is due: the floors, the machine and the loads that go with it. */
const ALWAYS = ["monthly-floors", "monthly-2", "monthly-drain", "monthly-3"];
/** Steps that are one job (spraying the oven and wiping it out). */
const DONE_WITH: Record<string, string> = { "q-kitchen-oven": "q-kitchen-0" };

export function monthIndex(d: Date) {
  return d.getFullYear() * 12 + d.getMonth();
}

export type QueueJob = { id: string; list: Routine; steps: Step[]; minutes: number; every: number; always: boolean };

function queueJobs(): QueueJob[] {
  const jobs = new Map<string, QueueJob>();
  for (const r of active) {
    if (r.when.kind !== "monthly") continue;
    const every = Math.max(1, Math.round(12 / Math.max(1, r.when.months.length)));
    for (const s of r.steps) {
      if (BEDROOM_DAY.includes(s.id)) continue;
      const id = DONE_WITH[s.id] ?? s.id;
      const job = jobs.get(id) ?? { id, list: r, steps: [], minutes: 0, every, always: ALWAYS.includes(id) };
      job.steps.push(s);
      if (!s.optional) job.minutes += s.minutes;
      jobs.set(id, job);
    }
  }
  return [...jobs.values()];
}

const monthOfKey = (k: string) => Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7)) - 1;

/** The month a job was last done before month `mi`: from the ticks, else its last old planned month up to September 2026. */
function lastDoneBefore(job: QueueJob, mi: number) {
  let last = -1;
  for (const s of job.steps) for (const k of ticksOf(s.id).months) if (monthOfKey(k) < mi) last = Math.max(last, monthOfKey(k));
  if (last >= 0) return last;
  const months = job.list.when.kind === "monthly" ? job.list.when.months : ALL_MONTHS;
  for (let m = QUEUE_START - 2; m > QUEUE_START - 26; m--) if (months.includes((m % 12) + 1)) return m;
  return QUEUE_START - 2;
}

function pick(jobs: QueueJob[], last: Map<string, number>, mi: number) {
  const late = (j: QueueJob) => mi - last.get(j.id)! - j.every;
  const due = jobs.filter((j) => j.always || late(j) >= 0);
  // Twice-a-year jobs keep their month (the balcony in March and September) instead of queueing.
  const fixed = (j: QueueJob) => j.always || j.every >= 6;
  // The fixed ones, then the most overdue, then the rarer jobs (a missed oven matters more than a missed fridge).
  due.sort((a, b) => Number(fixed(b)) - Number(fixed(a)) || late(b) - late(a) || b.every - a.every);
  const picked: QueueJob[] = [];
  let minutes = 0;
  for (const j of due) {
    if (!fixed(j) && minutes + j.minutes > BIG_CLEAN_BUDGET) continue;
    picked.push(j);
    minutes += j.minutes;
  }
  return { picked, waiting: due.filter((j) => !picked.includes(j)), minutes };
}

export type MonthEndPlan = { picked: QueueJob[]; waiting: QueueJob[]; minutes: number; stepIds: Set<string> };
let planCache: { ticks: Record<string, string[]>; lists: Routine[]; day: string; plans: Map<number, MonthEndPlan> } | null = null;

/**
 * The jobs in month `mi`'s Big clean. Past and current months use what was really done before them;
 * later months are an estimate, assuming each Big clean gets done (or, once its weekend is over, what was).
 */
export function monthEndPlan(mi: number): MonthEndPlan {
  const day = dayKey(today());
  if (!planCache || planCache.ticks !== ticks || planCache.lists !== active || planCache.day !== day) {
    planCache = { ticks, lists: active, day, plans: new Map() };
  }
  const cached = planCache.plans.get(mi);
  if (cached) return cached;
  const jobs = queueJobs();
  let result: Omit<MonthEndPlan, "stepIds">;
  if (mi < QUEUE_START) {
    // Before the queue: the old fixed months.
    const picked = jobs.filter((j) => j.list.when.kind === "monthly" && j.list.when.months.includes((mi % 12) + 1));
    result = { picked, waiting: [], minutes: picked.reduce((t, j) => t + j.minutes, 0) };
  } else {
    const now = Math.max(QUEUE_START, monthIndex(monthEndOwner(today()) ?? today()));
    const last = new Map(jobs.map((j) => [j.id, lastDoneBefore(j, Math.min(mi, now))]));
    const nowOver = today() > new Date(monthEndSaturday(new Date(Math.floor(now / 12), now % 12, 1)).getTime() + 2 * 86_400_000);
    for (let k = now; k < mi; k++) {
      for (const j of pick(jobs, last, k).picked) {
        const reallyDone = j.steps.some((s) => ticksOf(s.id).months.some((m) => monthOfKey(m) === k));
        if (k > now || !nowOver || reallyDone) last.set(j.id, k);
      }
    }
    result = pick(jobs, last, mi);
  }
  const plan = { ...result, stepIds: new Set(result.picked.flatMap((j) => j.steps.map((s) => s.id))) };
  planCache.plans.set(mi, plan);
  return plan;
}

/** Which big lists belong to `d`'s month (or to the month-end weekend it's on): the ones the queue picked from, and the bedroom jobs'. */
export function routinesForMonth(d = today()) {
  const owner = monthEndOwner(d) ?? d;
  const month = owner.getMonth() + 1;
  const plan = monthEndPlan(monthIndex(owner));
  return active.filter(
    (r) =>
      r.when.kind === "monthly" &&
      (r.steps.some((s) => plan.stepIds.has(s.id)) || (r.when.months.includes(month) && r.steps.some((s) => BEDROOM_DAY.includes(s.id)))),
  );
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

// ---------- The month-end swap ----------
// The weekly list that matches the month's deep clean (Kitchen, Pari, Living room) is done inside that
// weekend's Big clean, in the Saturday's place. The Bedroom list goes to that list's own day nearest the
// weekend, with the month's bedroom jobs (see bedroomDay).

const MATCHING_WEEKLY: Record<string, string> = { "q-kitchen": "wed", "q-pari": "thu", "q-living": "fri" };

// The office days, kept in sync by StoreProvider (like the schedule), for the screens that don't pass them.
let officeDaysNow: number[] = [];
export function setOfficeDays(days: number[]) {
  officeDaysNow = days;
}

export type MonthEndSwap = { saturday: Date; weekly: Routine; bedroom: Routine; day: Date };

function swapForSaturday(sat: Date, officeDays: number[]): MonthEndSwap | null {
  // The deep clean with the most of its jobs in this month's Big clean decides the swap.
  const plan = monthEndPlan(monthIndex(sat));
  const minutesOf = (id: string) => plan.picked.filter((j) => j.list.id === id).reduce((t, j) => t + j.minutes, 0);
  const deep = active.filter((r) => MATCHING_WEEKLY[r.id] && minutesOf(r.id) > 0).sort((a, b) => minutesOf(b.id) - minutesOf(a.id))[0];
  if (!deep) return null;
  const week = weeklyPlan(officeDays);
  const k = week.findIndex((slot) => slot.routine.id === MATCHING_WEEKLY[deep.id]);
  if (k < 0 || k >= 5) return null;
  // The list's day in the weekend's own week, or the week after: whichever is closer to the Saturday.
  const before = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() - 5 + k);
  const after = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + 2 + k);
  const day = 5 - k <= k + 2 ? before : after;
  return { saturday: sat, weekly: week[k].routine, bedroom: week[5].routine, day };
}

/** The swap whose weekend `d` is on, or whose swapped day `d` is. */
export function monthEndSwap(d = today(), officeDays = officeDaysNow): MonthEndSwap | null {
  const key = dayKey(d);
  const owner = monthEndOwner(d);
  if (owner) return swapForSaturday(owner, officeDays);
  for (const sat of [monthEndSaturday(d), monthEndSaturday(new Date(d.getFullYear(), d.getMonth() - 1, 1))]) {
    const sw = swapForSaturday(sat, officeDays);
    if (sw && dayKey(sw.day) === key) return sw;
  }
  return null;
}

/** The weekly list for a day: the usual one, or the Bedroom on a swapped day. */
export function weeklyListOn(d = today(), officeDays = officeDaysNow) {
  const sw = monthEndSwap(d, officeDays);
  if (sw && !monthEndOwner(d)) return sw.bedroom;
  if (sw && dayKey(d) === dayKey(sw.saturday)) return sw.weekly;
  return weeklyPlan(officeDays)[weekdayIndex(d)].routine;
}

/**
 * The month-end lists' bedroom jobs (protectors, mattress, under the bed, pillows, duvet) are done with the
 * Bedroom list on the swapped day, when the bed is stripped anyway, not in the Big clean. In this order.
 */
export const BEDROOM_DAY = [
  "monthly-protectors", "monthly-mattress-protector", "q-pari-3", "monthly-mattress", "half-0", "monthly-0", "half-1",
];

/** The bedroom day around a month-end weekend: the weekly Bedroom list plus the month's bedroom jobs. */
export function bedroomDay(d = today(), officeDays = officeDaysNow) {
  const sw = monthEndSwap(d, officeDays);
  if (!sw || monthEndOwner(d) || dayKey(sw.day) !== dayKey(d)) return null;
  const weekly = stepsOn(sw.bedroom, d).map((step) => ({ step, occurrence: occurrenceKey(sw.bedroom, d), list: sw.bedroom.name }));
  const monthly = routinesForMonth(sw.saturday).flatMap((r) =>
    stepsOn(r, sw.saturday)
      .filter((st) => BEDROOM_DAY.includes(st.id))
      .map((step) => ({ step, occurrence: occurrenceKey(r, sw.saturday), list: r.name })),
  );
  // Sheets first, then the month's jobs while the bed is bare, then dusting and making the bed.
  const rank = (id: string) => {
    if (id === "sat-sheets") return -1;
    const i = BEDROOM_DAY.indexOf(id);
    if (i >= 0) return i;
    return id === "sat-0" ? 100 : 50;
  };
  const items = [...weekly, ...monthly].sort((a, b) => rank(a.step.id) - rank(b.step.id));
  return { swap: sw, items };
}

// ---------- What happens when something isn't done ----------
// Daily lists: let go. Steps with a cost (rubbish, plants, the washing): carry over until done (see CARRY).
// Weekly lists: catch up until Sunday, then let go; missed machine loads carry on until done.
// The bedroom day: carries over until done. The Big clean: its leftovers show the next two weekends,
// and whatever is still undone is first in line at the next month-end (see monthEndPlan).

export type CheckItem = { step: Step; occurrence: string; list: string; note?: string };

const isDoneTick = (it: { step: Step; occurrence: string }) => (ticks[it.occurrence] ?? []).includes(it.step.id);

/** A day's step that was done that day or any later day on the same list (e.g. the sheets, changed on Saturday after a missed Monday). */
function doneSince(it: { step: Step; occurrence: string }) {
  const [listId, when = ""] = it.occurrence.split("@");
  if (when.length !== 10) return isDoneTick(it);
  return Object.entries(ticks).some(([key, ids]) => {
    const [id, w = ""] = key.split("@");
    const day = w.split("#")[0];
    return id === listId && day.length === 10 && day >= when && ids.includes(it.step.id);
  });
}

/** Step ids already on today's own lists, so catching up never shows a step twice. */
function todaysStepIds(d: Date, officeDays: number[]) {
  return new Set(dueToday(d, officeDays).flatMap((r) => stepsOn(r, d).map((s) => s.id)));
}

/** Weekly steps missed earlier this week, and missed machine loads from the last two weeks. */
export function catchUp(d = today(), officeDays = officeDaysNow): CheckItem[] {
  const out: CheckItem[] = [];
  const todays = todaysStepIds(d, officeDays);
  // Steps an unfinished bedroom day still shows aren't repeated here.
  const seen = new Set<string>(bedroomCatchUp(d, officeDays)?.items.map((it) => it.step.id) ?? []);
  for (let back = 13; back >= 1; back--) {
    const p = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
    const thisWeek = back <= weekdayIndex(d);
    if (monthEndOwner(p)) continue; // the Big clean has its own leftovers
    const sw = monthEndSwap(p, officeDays);
    if (sw && dayKey(sw.day) === dayKey(p)) continue; // so has the bedroom day
    const r = weeklyListOn(p, officeDays);
    const occurrence = occurrenceKey(r, p);
    if ((ticks[occurrence] ?? []).includes(SKIPPED)) continue;
    for (const step of stepsOn(r, p)) {
      // Not if it's on today's lists, was done since, or a later missed turn of it is already listed.
      if (step.optional || todays.has(step.id) || seen.has(step.id) || doneSince({ step, occurrence })) continue;
      if (!(thisWeek || (step.wash && step.everyOtherWeek))) continue;
      out.push({ step, occurrence, list: r.name, note: `${WEEKDAYS[weekdayIndex(p)]} · ${r.name}` });
      seen.add(step.id);
    }
  }
  return out;
}

/** A bedroom day in the last three weeks that isn't finished yet. */
export function bedroomCatchUp(d = today(), officeDays = officeDaysNow) {
  for (let back = 1; back <= 21; back++) {
    const p = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back);
    const day = bedroomDay(p, officeDays);
    if (!day) continue;
    // The weekly part (sheets, making the bed) is left out once it's on today's list or done since.
    const todays = todaysStepIds(d, officeDays);
    const items = day.items.filter((it) => !it.step.optional && !todays.has(it.step.id) && !doneSince(it));
    return items.length ? { day: p, swap: day.swap, items } : null;
  }
  return null;
}

/** The last Big clean's undone jobs, on the two weekends after it. */
export function bigCleanLeftovers(d = today(), officeDays = officeDaysNow) {
  if (monthEndOwner(d) || weekdayIndex(d) < 5) return null;
  const sat = new Date(d.getFullYear(), d.getMonth(), d.getDate() - weekdayIndex(d) + 5);
  for (const weeksAfter of [1, 2]) {
    const s = new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() - 7 * weeksAfter);
    if (!monthEndOwner(s)) continue;
    const seen = new Set<string>();
    const items: CheckItem[] = [];
    for (const day of [s, new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1)]) {
      for (const it of bigCleanItems(dueToday(day, officeDays).filter((r) => r.when.kind === "monthly"), day)) {
        const key = it.occurrence + "|" + it.step.id;
        // Only the month's own jobs (saved by month): the weekly list that joined in is let go like any week's.
        if (seen.has(key) || it.step.optional || isDoneTick(it) || (it.occurrence.split("@")[1] ?? "").length !== 7) continue;
        seen.add(key);
        items.push({ step: it.step, occurrence: it.occurrence, list: it.listName });
      }
    }
    return items.length ? { saturday: s, until: new Date(s.getFullYear(), s.getMonth(), s.getDate() + 15), items } : null;
  }
  return null;
}

export function isDueOn(r: Routine, d = today(), officeDays: number[] = []) {
  switch (r.when.kind) {
    case "daily":
      return true;
    case "weekly":
      return weeklyListOn(d, officeDays).id === r.id;
    case "monthly": {
      const owner = monthEndOwner(d);
      return owner !== null && routinesForMonth(owner).includes(r);
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
