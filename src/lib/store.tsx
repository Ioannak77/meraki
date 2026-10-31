"use client";

// Meraki's data. For Milestone 1 everything is kept in this browser's
// localStorage. The shapes match supabase/schema.sql so syncing can be added
// later without changing the screens.

import { today } from "./clock";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { markSaved } from "./sync";
import { setCleaning, setCleaningDone, setOfficeDays, withAddedSteps, type Routine } from "./cleaning";

export type Energy = "low" | "normal" | "high";
export type Mood = "great" | "okay" | "low";

export type Area = { id: string; name: string; icon: AreaIcon; tone: Tone };
export type AreaIcon = "heart" | "home" | "wallet" | "briefcase" | "leaf" | "paw" | "car";
export type Tone = "rose" | "peach" | "sage" | "sky" | "sun" | "lilac";

export type Task = {
  id: string;
  title: string;
  areaId: string | null;
  dueDate: string | null; // "YYYY-MM-DD"; for a whole-month task, the month's last day
  wholeMonth?: boolean; // "sometime this month / by the end of the month"
  showBefore?: number; // days before the due date it appears on Today (see LEAD_CHOICES)
  minutes: number | null;
  energy: Energy;
  isEssential: boolean; // shows under "Your priorities today"
  completedAt: string | null; // ISO timestamp
  createdAt: string;
  repeat?: Repeat | null; // ticking it off makes the next one
  repeatFromDone?: boolean; // the next one counts from the day you tick it (waxing every 4 weeks), not from the due date
  nextId?: string; // the next one made from this repeating task (so unticking can take it back)
  steps?: TaskStep[]; // small steps inside the task
  remindAt?: string | null; // "YYYY-MM-DDTHH:MM": a phone notification then
};

export type Repeat = { every: number; unit: "day" | "week" | "month" | "year" };
export type TaskStep = { id: string; title: string; done: boolean };

export const REPEAT_CHOICES: { label: string; repeat: Repeat | null }[] = [
  { label: "Doesn't repeat", repeat: null },
  { label: "Every week", repeat: { every: 1, unit: "week" } },
  { label: "Every 2 weeks", repeat: { every: 2, unit: "week" } },
  { label: "Every month", repeat: { every: 1, unit: "month" } },
  { label: "Every 3 months", repeat: { every: 3, unit: "month" } },
  { label: "Every 6 months", repeat: { every: 6, unit: "month" } },
  { label: "Every year", repeat: { every: 1, unit: "year" } },
  // Check-ups and documents (a gynaecologist visit, a passport or ID card).
  { label: "Every 2 years", repeat: { every: 2, unit: "year" } },
  { label: "Every 3 years", repeat: { every: 3, unit: "year" } },
  { label: "Every 5 years", repeat: { every: 5, unit: "year" } },
  { label: "Every 10 years", repeat: { every: 10, unit: "year" } },
];

export function repeatLabel(r: Repeat) {
  const unit = r.every === 1 ? r.unit : `${r.unit}s`;
  return r.every === 1 ? `Every ${unit}` : `Every ${r.every} ${unit}`;
}

/** The date a repeat lands on after `from` ("YYYY-MM-DD"). Months keep the day, or the month's last day. */
export function advanceDate(from: string, r: Repeat, wholeMonth = false) {
  const [y, m, d] = from.split("-").map(Number);
  if (r.unit === "day" || r.unit === "week") return dayKey(new Date(y, m - 1, d + r.every * (r.unit === "week" ? 7 : 1)));
  const months = r.unit === "year" ? 12 * r.every : r.every;
  const last = new Date(y, m - 1 + months + 1, 0).getDate();
  return dayKey(new Date(y, m - 1 + months, wholeMonth ? last : Math.min(d, last)));
}

type Data = {
  areas: Area[];
  tasks: Task[];
  moods: Record<string, Mood>; // by day
  // Ticked routine steps, by occurrence ("evening@2026-10-20", "monthly@2026-10").
  routineDone: Record<string, string[]>;
  // How long a timed run took, in seconds, by occurrence.
  routineTimes: Record<string, number>;
  settings: Settings;
  // The cleaning schedule as edited in the app; missing = the default in cleaning.ts.
  cleaning?: Routine[] | null;
  cleaningSeen?: string[]; // default steps already added to the edited copy (see withAddedSteps)
};

export type Settings = {
  officeDays: number[]; // 0 = Monday … 6 = Sunday
  todayHidden?: TodayCard[]; // cards switched off on the Today screen
  starterTasksRemoved?: boolean; // the first-day example tasks have been cleared
  push?: PushPrefs; // phone notifications (synced, so every device plans the same reminders)
  kindWords?: string[]; // your own kind words, mixed into the daily ones
  theme?: "light" | "dark" | "system"; // missing = light
};

export type PushPrefs = {
  on: boolean; // set once a device has turned notifications on
  morning: boolean;
  morningTime: string; // "08:00"
  skincare: boolean;
  care: boolean;
  bills: boolean;
  kind: boolean;
  weekly?: boolean; // Sunday evening week summary (on unless switched off)
};

export const DEFAULT_PUSH: PushPrefs = {
  on: false,
  morning: true,
  morningTime: "08:00",
  skincare: true,
  care: true,
  bills: true,
  kind: true,
  weekly: true,
};

/** Cards on the Today screen that can be switched off in Settings. */
export const TODAY_CARDS = [
  { id: "weather", label: "Weather" },
  { id: "priorities", label: "Your priorities today" },
  { id: "selfcare", label: "Self care (skincare)" },
  { id: "comingup", label: "Coming up" },
  { id: "bills", label: "Bills due today or tomorrow (in Coming up)" },
  { id: "shopping", label: "Shopping list reminder" },
  { id: "cleaning", label: "Cleaning now" },
  { id: "tomorrow", label: "Tomorrow, in the evening" },
  { id: "week", label: "This week" },
] as const;
export type TodayCard = (typeof TODAY_CARDS)[number]["id"];

// The example tasks the very first version came with; removed once from saved data.
const STARTER_TITLES = [
  "Evening skincare",
  "Take vitamins",
  "Kitchen reset",
  "Review spending",
  "Book vet appointment",
  "Deep clean bathroom",
  "Order pet food",
  "Plan next week",
  "Update CV",
];

const DEFAULT_SETTINGS: Settings = { officeDays: [2, 3] }; // Wednesday and Thursday

const STORAGE_KEY = "meraki.v1";

export function dayKey(d = today()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const DEFAULT_AREAS: Area[] = [
  { id: "care", name: "Personal care", icon: "heart", tone: "rose" },
  { id: "home", name: "Home", icon: "home", tone: "peach" },
  { id: "pari", name: "Pari", icon: "paw", tone: "sun" },
  { id: "car", name: "Car", icon: "car", tone: "lilac" },
  { id: "finance", name: "Finance", icon: "wallet", tone: "sage" },
  { id: "life", name: "Life admin", icon: "briefcase", tone: "sky" },
];

/** Areas added in later versions are slotted in for people who already have data. */
function withNewAreas(saved: Area[]) {
  const out = [...saved];
  DEFAULT_AREAS.forEach((a, i) => {
    if (!out.some((s) => s.id === a.id)) out.splice(Math.min(i, out.length), 0, a);
  });
  return out;
}

function seed(): Data {
  return {
    areas: DEFAULT_AREAS,
    tasks: [],
    moods: {},
    routineDone: {},
    routineTimes: {},
    settings: { ...DEFAULT_SETTINGS, starterTasksRemoved: true },
  };
}

function load(): Data {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Data>;
      // One-time clean-up: drop the untouched example tasks from the first version.
      if (!saved.settings?.starterTasksRemoved) {
        saved.tasks = (saved.tasks ?? []).filter((t) => t.completedAt || !STARTER_TITLES.includes(t.title));
        saved.settings = { ...DEFAULT_SETTINGS, ...saved.settings, starterTasksRemoved: true };
      }
      // An edited cleaning schedule also gets steps added to the default since.
      if (saved.cleaning) {
        const updated = withAddedSteps(saved.cleaning, saved.cleaningSeen ?? []);
        saved.cleaning = updated.lists;
        saved.cleaningSeen = updated.seen;
      }
      return {
        routineDone: {},
        routineTimes: {},
        ...saved,
        areas: withNewAreas(saved.areas ?? []),
        settings: { ...DEFAULT_SETTINGS, ...saved.settings },
      } as Data;
    }
  } catch {}
  return seed();
}

/** Drop routine ticks older than ~13 months so storage doesn't grow forever. */
function pruneRoutineDone(done: Data["routineDone"]) {
  const cutoff = today();
  cutoff.setMonth(cutoff.getMonth() - 13);
  const cut = dayKey(cutoff);
  return Object.fromEntries(
    Object.entries(done).filter(([key, ids]) => {
      const when = key.split("@")[1] ?? ""; // "YYYY-MM-DD" or "YYYY-MM"
      return ids.length > 0 && when >= cut.slice(0, when.length);
    }),
  );
}

export type TaskInput = Omit<Task, "id" | "createdAt" | "completedAt">;

type Store = Data & {
  ready: boolean;
  addTask: (input: TaskInput) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  /** Adds tasks made elsewhere (the old Self care reminders), skipping ids already here. */
  importTasks: (tasks: Task[]) => void;
  setMood: (mood: Mood) => void;
  toggleStep: (occurrence: string, stepId: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  saveCleaning: (lists: Routine[] | null) => void;
  /** Makes a new task area (or returns the existing one with that name). */
  addArea: (name: string) => string;
  /** Tick the given steps (never unticks) and save the time a timed run took. */
  finishTimedRun: (occurrence: string, stepIds: string[], seconds: number) => void;
  areaById: (id: string | null) => Area | undefined;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>({ areas: [], tasks: [], moods: {}, routineDone: {}, routineTimes: {}, settings: DEFAULT_SETTINGS });
  const [ready, setReady] = useState(false);

  // Every screen reads the cleaning schedule through cleaningLists().
  setCleaning(data.cleaning);
  setCleaningDone(data.routineDone);
  setOfficeDays(data.settings.officeDays);

  // localStorage only exists in the browser, so read it after the first render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from localStorage
    setData(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      markSaved(STORAGE_KEY);
    } catch {}
  }, [data, ready]);

  const addTask = useCallback((input: TaskInput) => {
    setData((d) => ({
      ...d,
      tasks: [...d.tasks, { ...input, id: newId(), createdAt: today().toISOString(), completedAt: null }],
    }));
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setData((d) => {
      const t = d.tasks.find((x) => x.id === id);
      if (!t) return d;
      let tasks = d.tasks;
      if (!t.completedAt) {
        // Done. A repeating task makes its next one.
        let nextId = t.nextId;
        if (t.repeat && !nextId) {
          nextId = newId();
          const from = t.repeatFromDone || !t.dueDate ? dayKey() : t.dueDate;
          const due = advanceDate(from, t.repeat, t.wholeMonth);
          const next: Task = {
            ...t,
            id: nextId,
            dueDate: due,
            isEssential: false,
            completedAt: null,
            createdAt: today().toISOString(),
            nextId: undefined,
            steps: t.steps?.map((st) => ({ ...st, done: false })),
            remindAt: t.remindAt ? `${due}T${t.remindAt.slice(11, 16)}` : t.remindAt,
          };
          tasks = [...tasks, next];
        }
        tasks = tasks.map((x) => (x.id === id ? { ...x, completedAt: today().toISOString(), nextId } : x));
      } else {
        // Undone. Take back the next one, if you haven't touched it yet.
        const next = t.nextId ? tasks.find((x) => x.id === t.nextId) : undefined;
        const untouched = next && !next.completedAt && next.title === t.title;
        tasks = tasks
          .filter((x) => !(untouched && x.id === next!.id))
          .map((x) => (x.id === id ? { ...x, completedAt: null, nextId: untouched ? undefined : x.nextId } : x));
      }
      return { ...d, tasks };
    });
  }, []);

  const importTasks = useCallback((list: Task[]) => {
    setData((d) => ({ ...d, tasks: [...d.tasks, ...list.filter((t) => !d.tasks.some((x) => x.id === t.id))] }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  }, []);

  const setMood = useCallback((mood: Mood) => {
    setData((d) => ({ ...d, moods: { ...d.moods, [dayKey()]: mood } }));
  }, []);

  const toggleStep = useCallback((occurrence: string, stepId: string) => {
    setData((d) => {
      const current = d.routineDone[occurrence] ?? [];
      const next = current.includes(stepId) ? current.filter((s) => s !== stepId) : [...current, stepId];
      return { ...d, routineDone: pruneRoutineDone({ ...d.routineDone, [occurrence]: next }) };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);

  const saveCleaning = useCallback((lists: Routine[] | null) => {
    // A fresh copy of the default already has every added step.
    setData((d) => ({ ...d, cleaning: lists, cleaningSeen: lists ? withAddedSteps(lists, []).seen : [] }));
  }, []);

  const finishTimedRun = useCallback((occurrence: string, stepIds: string[], seconds: number) => {
    setData((d) => {
      const current = d.routineDone[occurrence] ?? [];
      return {
        ...d,
        routineDone: { ...d.routineDone, [occurrence]: [...new Set([...current, ...stepIds])] },
        routineTimes: { ...d.routineTimes, [occurrence]: (d.routineTimes[occurrence] ?? 0) + seconds },
      };
    });
  }, []);

  const addArea = useCallback(
    (name: string) => {
      const clean = name.trim();
      const existing = data.areas.find((a) => a.name.toLowerCase() === clean.toLowerCase());
      if (existing) return existing.id;
      const id = `area-${newId()}`;
      const tones: Tone[] = ["sky", "sage", "peach", "rose", "sun", "lilac"];
      const area: Area = { id, name: clean, icon: "leaf", tone: tones[data.areas.length % tones.length] };
      setData((d) => ({ ...d, areas: [...d.areas, area] }));
      return id;
    },
    [data.areas],
  );

  const value = useMemo<Store>(
    () => ({
      ...data,
      ready,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      importTasks,
      setMood,
      toggleStep,
      updateSettings,
      saveCleaning,
      addArea,
      finishTimedRun,
      areaById: (id) => data.areas.find((a) => a.id === id),
    }),
    [data, ready, addTask, updateTask, toggleTask, deleteTask, importTasks, setMood, toggleStep, updateSettings, saveCleaning, addArea, finishTimedRun],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside <StoreProvider>");
  return store;
}

// ---------- Derived views ----------

export function isDoneToday(t: Task) {
  return !!t.completedAt && dayKey(new Date(t.completedAt)) === dayKey();
}

/** "YYYY-MM-DD" of the last day of a month, `offset` months from today. */
export function monthEndKey(offset = 0) {
  const d = today();
  return dayKey(new Date(d.getFullYear(), d.getMonth() + offset + 1, 0));
}

/** How early a task appears on Today, before its due date. */
export const LEAD_CHOICES = [
  { days: 0, label: "On the day" },
  { days: 3, label: "3 days before" },
  { days: 7, label: "1 week before" },
  { days: 14, label: "2 weeks before" },
  { days: 30, label: "1 month before" },
  // Things that need booking or paperwork well ahead (a new passport).
  { days: 61, label: "2 months before" },
  { days: 91, label: "3 months before" },
  { days: 182, label: "6 months before" },
];

/** Whole-month tasks default to showing in the month's last week; dated ones on the day. */
export function leadDays(t: Pick<Task, "showBefore" | "wholeMonth">) {
  return t.showBefore ?? (t.wholeMonth ? 7 : 0);
}

/** Whole days from today until the due date (negative when late). */
export function daysUntil(t: Task) {
  if (!t.dueDate) return null;
  const [y, m, d] = t.dueDate.split("-").map(Number);
  const n = today();
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) / 86400000);
}

/**
 * Should this open task show up as "to do now"? From `leadDays` before its
 * due date (e.g. an MOT two weeks early, so there's time to book), and
 * always once it's late.
 */
export function isDueNow(t: Task) {
  if (t.completedAt || t.dueDate === null) return false;
  return (daysUntil(t) ?? 0) <= leadDays(t);
}

/** Open tasks due now (see isDueNow), plus anything finished today. */
export function todaysTasks(tasks: Task[]) {
  return tasks.filter((t) => isDueNow(t) || isDoneToday(t));
}

export function dueLabel(t: Task) {
  if (!t.dueDate) return "No date";
  const now = dayKey();
  if (t.dueDate < now) return "Overdue";
  const d = new Date(t.dueDate + "T12:00:00");
  if (t.wholeMonth) {
    if (t.dueDate === monthEndKey(0)) return "This month";
    if (t.dueDate === monthEndKey(1)) return "Next month";
    return `By end of ${d.toLocaleDateString(undefined, { month: "short" })}`;
  }
  if (t.dueDate === now) return "Today";
  // Another year (a passport in 2031): say the year.
  const otherYear = d.getFullYear() !== new Date(now + "T12:00:00").getFullYear();
  const date = otherYear
    ? d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  // Showing early (e.g. "book the MOT"): say how long is left.
  const left = daysUntil(t) ?? 0;
  if (leadDays(t) > 0 && left <= leadDays(t)) {
    const short = d.toLocaleDateString(undefined, otherYear ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" });
    const months = Math.round(left / 30.4);
    return `by ${short} · ${left > 60 ? `${months} months` : left === 1 ? "1 day" : `${left} days`} left`;
  }
  return date;
}
