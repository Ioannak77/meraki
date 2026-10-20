"use client";

// Meraki's data. For Milestone 1 everything is kept in this browser's
// localStorage. The shapes match supabase/schema.sql so syncing can be added
// later without changing the screens.

import { setTestDate, today } from "./clock";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Energy = "low" | "normal" | "high";
export type Mood = "great" | "okay" | "low";

export type Area = { id: string; name: string; icon: AreaIcon; tone: Tone };
export type AreaIcon = "heart" | "home" | "wallet" | "briefcase" | "leaf" | "paw";
export type Tone = "rose" | "peach" | "sage" | "sky" | "sun";

export type Task = {
  id: string;
  title: string;
  areaId: string | null;
  dueDate: string | null; // "YYYY-MM-DD"; for a whole-month task, the month's last day
  wholeMonth?: boolean; // "sometime this month / by the end of the month"
  minutes: number | null;
  energy: Energy;
  isEssential: boolean; // shows under "Your priorities today"
  completedAt: string | null; // ISO timestamp
  createdAt: string;
};

type Data = {
  areas: Area[];
  tasks: Task[];
  moods: Record<string, Mood>; // by day
  // Ticked routine steps, by occurrence ("evening@2026-10-20", "monthly@2026-10").
  routineDone: Record<string, string[]>;
  // How long a timed run took, in seconds, by occurrence.
  routineTimes: Record<string, number>;
  settings: Settings;
};

export type Settings = {
  officeDays: number[]; // 0 = Monday … 6 = Sunday
  testDate?: string | null; // "YYYY-MM-DD" to pretend it is another day (testing only)
};

const DEFAULT_SETTINGS: Settings = { officeDays: [2, 3] }; // Wednesday and Thursday

const STORAGE_KEY = "meraki.v1";

export function dayKey(d = today()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(days: number) {
  const d = today();
  d.setDate(d.getDate() + days);
  return dayKey(d);
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
  const now = today().toISOString();
  const areas = DEFAULT_AREAS;
  const t = (title: string, areaId: string, extra: Partial<Task> = {}): Task => ({
    id: newId(),
    title,
    areaId,
    dueDate: dayKey(),
    minutes: 5,
    energy: "low",
    isEssential: false,
    completedAt: null,
    createdAt: now,
    ...extra,
  });
  return {
    areas,
    tasks: [
      t("Evening skincare", "care", { isEssential: true }),
      t("Kitchen reset", "home", { isEssential: true, minutes: 10, energy: "normal" }),
      t("Review spending", "finance", { isEssential: true, minutes: 5 }),
      t("Book vet appointment", "life", { minutes: 5 }),
      t("Deep clean bathroom", "home", { dueDate: addDays(5), minutes: 45, energy: "high" }),
      t("Order pet food", "pari", { minutes: 5 }),
      t("Plan next week", "life", { dueDate: addDays(6), minutes: 15, energy: "normal" }),
      t("Update CV", "life", { dueDate: null, minutes: 30, energy: "high" }),
    ],
    moods: {},
    routineDone: {},
    routineTimes: {},
    settings: DEFAULT_SETTINGS,
  };
}

function load(): Data {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Data>;
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
  setMood: (mood: Mood) => void;
  toggleStep: (occurrence: string, stepId: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Tick the given steps (never unticks) and save the time a timed run took. */
  finishTimedRun: (occurrence: string, stepIds: string[], seconds: number) => void;
  areaById: (id: string | null) => Area | undefined;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>({ areas: [], tasks: [], moods: {}, routineDone: {}, routineTimes: {}, settings: DEFAULT_SETTINGS });
  const [ready, setReady] = useState(false);

  // Testing: make every screen see the chosen day as "today".
  setTestDate(data.settings.testDate ?? null);

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
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) =>
        t.id === id ? { ...t, completedAt: t.completedAt ? null : today().toISOString() } : t,
      ),
    }));
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

  const value = useMemo<Store>(
    () => ({
      ...data,
      ready,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      setMood,
      toggleStep,
      updateSettings,
      finishTimedRun,
      areaById: (id) => data.areas.find((a) => a.id === id),
    }),
    [data, ready, addTask, updateTask, toggleTask, deleteTask, setMood, toggleStep, updateSettings, finishTimedRun],
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

/**
 * Should this open task show up as "to do now"? Dated tasks from their day;
 * whole-month tasks in the last week of their month (so they don't crowd the
 * rest of the month), and both once they're late.
 */
export function isDueNow(t: Task) {
  if (t.completedAt || t.dueDate === null) return false;
  const now = dayKey();
  if (t.dueDate <= now) return true;
  if (!t.wholeMonth) return false;
  const d = today();
  const weekAhead = dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6));
  return t.dueDate <= weekAhead;
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
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
