"use client";

// Skincare data, kept in this browser's localStorage (photos themselves are in
// IndexedDB, see photos.ts).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { removePhoto, savePhoto } from "./photos";
import {
  DEFAULT_SKIN_SETTINGS,
  starterSteps,
  type SkinPhoto,
  type SkinSettings,
  type SkinStep,
} from "./skin";
import { dayKey } from "./store";

type SkinData = {
  steps: SkinStep[];
  done: Record<string, string[]>; // slotKey ("pm@2026-10-20") -> ticked step ids
  settings: SkinSettings;
  photos: SkinPhoto[];
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
        photos: saved.photos ?? [],
        settings: { ...DEFAULT_SKIN_SETTINGS, ...saved.settings },
      };
    }
  } catch {}
  return { steps: starterSteps(), done: {}, settings: DEFAULT_SKIN_SETTINGS, photos: [] };
}

type SkinStore = SkinData & {
  ready: boolean;
  saveStep: (s: Omit<SkinStep, "id"> & { id?: string }) => void;
  deleteStep: (id: string) => void;
  moveStep: (id: string, dir: -1 | 1) => void;
  toggle: (slot: string, stepId: string) => void;
  updateSettings: (patch: Partial<SkinSettings>) => void;
  addPhoto: (blob: Blob, date: string, note?: string) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
};

const SkinContext = createContext<SkinStore | null>(null);

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SkinData>({ steps: [], done: {}, settings: DEFAULT_SKIN_SETTINGS, photos: [] });
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

  const addPhoto = useCallback(async (blob: Blob, date: string, note?: string) => {
    const id = newId();
    await savePhoto(id, blob);
    setData((d) => ({ ...d, photos: [...d.photos, { id, date, note: note?.trim() || undefined }] }));
  }, []);

  const deletePhoto = useCallback(async (id: string) => {
    await removePhoto(id);
    setData((d) => ({ ...d, photos: d.photos.filter((p) => p.id !== id) }));
  }, []);

  const value = useMemo<SkinStore>(
    () => ({ ...data, ready, saveStep, deleteStep, moveStep, toggle, updateSettings, addPhoto, deletePhoto }),
    [data, ready, saveStep, deleteStep, moveStep, toggle, updateSettings, addPhoto, deletePhoto],
  );

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

export function useSkin() {
  const s = useContext(SkinContext);
  if (!s) throw new Error("useSkin must be used inside <SkinProvider>");
  return s;
}
