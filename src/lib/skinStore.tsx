"use client";

// Self-care data (skincare steps and repeating reminders), kept in this
// browser's localStorage.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SKIN_SETTINGS,
  starterCareItems,
  starterSteps,
  type CareItem,
  type SkinSettings,
  type SkinStep,
} from "./skin";
import { dayKey } from "./store";
import { markSaved } from "./sync";

type SkinData = {
  steps: SkinStep[];
  done: Record<string, string[]>; // slotKey ("pm@2026-10-20") -> ticked step ids
  settings: SkinSettings;
  items: CareItem[]; // repeating reminders: waxing, nails, hair…
};

const STORAGE_KEY = "meraki.skin.v1";

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function load(): SkinData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<SkinData>;
      return {
        steps: saved.steps ?? [],
        done: saved.done ?? {},
        items: saved.items ?? starterCareItems(), // moved into Reminders once (see CareMove)
        settings: { ...DEFAULT_SKIN_SETTINGS, ...saved.settings },
      };
    }
  } catch {}
  return { steps: starterSteps(), done: {}, settings: DEFAULT_SKIN_SETTINGS, items: [] };
}

type SkinStore = SkinData & {
  ready: boolean;
  saveStep: (s: Omit<SkinStep, "id"> & { id?: string }) => void;
  deleteStep: (id: string) => void;
  moveStep: (id: string, dir: -1 | 1) => void;
  /** A slot's steps in a new order (from dragging). */
  reorderSteps: (ids: string[]) => void;
  toggle: (slot: string, stepId: string) => void;
  updateSettings: (patch: Partial<SkinSettings>) => void;
  saveItem: (i: Omit<CareItem, "id"> & { id?: string }) => void;
  deleteItem: (id: string) => void;
  markDone: (id: string, date: string) => void;
  /** Empties the old self-care reminders once they've moved into Reminders. */
  clearItems: () => void;
};

const SkinContext = createContext<SkinStore | null>(null);

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SkinData>({ steps: [], done: {}, settings: DEFAULT_SKIN_SETTINGS, items: [] });
  const [ready, setReady] = useState(false);

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

  const saveStep = useCallback((s: Omit<SkinStep, "id"> & { id?: string }) => {
    setData((d) => {
      if (s.id) return { ...d, steps: d.steps.map((x) => (x.id === s.id ? ({ ...s, id: x.id } as SkinStep) : x)) };
      return { ...d, steps: [...d.steps, { ...s, id: newId() }] };
    });
  }, []);

  const deleteStep = useCallback((id: string) => setData((d) => ({ ...d, steps: d.steps.filter((s) => s.id !== id) })), []);

  // Reorder within the same slot (morning steps only swap with morning steps).
  const moveStep = useCallback((id: string, dir: -1 | 1) => {
    setData((d) => {
      const steps = [...d.steps];
      const i = steps.findIndex((s) => s.id === id);
      if (i < 0) return d;
      let j = i + dir;
      while (j >= 0 && j < steps.length && steps[j].slot !== steps[i].slot) j += dir;
      if (j < 0 || j >= steps.length) return d;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    });
  }, []);

  const reorderSteps = useCallback((ids: string[]) => {
    setData((d) => {
      // The slot's steps keep their places in the list, filled in the new order.
      const queue = ids.map((id) => d.steps.find((s) => s.id === id)).filter((s): s is SkinStep => !!s);
      const moving = new Set(ids);
      return { ...d, steps: d.steps.map((s) => (moving.has(s.id) ? queue.shift()! : s)) };
    });
  }, []);

  const toggle = useCallback((slot: string, stepId: string) => {
    setData((d) => {
      const cur = d.done[slot] ?? [];
      const next = cur.includes(stepId) ? cur.filter((x) => x !== stepId) : [...cur, stepId];
      // Keep about three months of ticks.
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const cut = dayKey(cutoff);
      const done = Object.fromEntries(Object.entries({ ...d.done, [slot]: next }).filter(([k]) => (k.split("@")[1] ?? "") >= cut));
      return { ...d, done };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<SkinSettings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  }, []);


  const saveItem = useCallback((i: Omit<CareItem, "id"> & { id?: string }) => {
    setData((d) => {
      if (i.id) return { ...d, items: d.items.map((x) => (x.id === i.id ? ({ ...i, id: x.id } as CareItem) : x)) };
      return { ...d, items: [...d.items, { ...i, id: newId() }] };
    });
  }, []);

  const deleteItem = useCallback((id: string) => setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== id) })), []);

  const markDone = useCallback((id: string, date: string) => {
    setData((d) => ({ ...d, items: d.items.map((x) => (x.id === id ? { ...x, lastDone: date } : x)) }));
  }, []);

  const clearItems = useCallback(() => setData((d) => ({ ...d, items: [] })), []);

  const value = useMemo<SkinStore>(
    () => ({ ...data, ready, saveStep, deleteStep, moveStep, reorderSteps, toggle, updateSettings, saveItem, deleteItem, markDone, clearItems }),
    [data, ready, saveStep, deleteStep, moveStep, reorderSteps, toggle, updateSettings, saveItem, deleteItem, markDone, clearItems],
  );

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

export function useSkin() {
  const s = useContext(SkinContext);
  if (!s) throw new Error("useSkin must be used inside <SkinProvider>");
  return s;
}
