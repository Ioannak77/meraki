"use client";

// Groceries data (receipts and the shopping list), kept in this browser's
// localStorage and synced. The photo itself is not kept, only what was read.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ListItem, Receipt } from "./groceries";
import { markSaved } from "./sync";

type Data = { receipts: Receipt[]; list: ListItem[] };

const STORAGE_KEY = "meraki.groceries.v1";
const EMPTY: Data = { receipts: [], list: [] };

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type Store = Data & {
  ready: boolean;
  saveReceipt: (r: Omit<Receipt, "id"> & { id?: string }) => string;
  deleteReceipt: (id: string) => void;
  addToList: (name: string) => void;
  updateListItem: (id: string, patch: Partial<ListItem>) => void;
  removeFromList: (id: string) => void;
  clearTicked: () => void;
};

const Ctx = createContext<Store | null>(null);

export function GroceriesProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        // The old receipt-reader address and passcode aren't used any more: drop them.
        const saved = JSON.parse(raw) as Partial<Data> & { reader?: unknown };
        delete saved.reader;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from localStorage
        setData({ ...EMPTY, ...saved });
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      markSaved(STORAGE_KEY);
    } catch {}
  }, [data, ready]);

  const saveReceipt = useCallback((r: Omit<Receipt, "id"> & { id?: string }) => {
    const id = r.id ?? newId();
    setData((d) => ({
      ...d,
      receipts: r.id ? d.receipts.map((x) => (x.id === r.id ? { ...r, id } : x)) : [...d.receipts, { ...r, id }],
    }));
    return id;
  }, []);

  const deleteReceipt = useCallback((id: string) => setData((d) => ({ ...d, receipts: d.receipts.filter((r) => r.id !== id) })), []);

  const addToList = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setData((d) =>
      // Already on the list: bring it back instead of adding it twice.
      d.list.some((i) => i.name.toLowerCase() === clean.toLowerCase())
        ? { ...d, list: d.list.map((i) => (i.name.toLowerCase() === clean.toLowerCase() ? { ...i, done: false } : i)) }
        : { ...d, list: [...d.list, { id: newId(), name: clean, done: false }] },
    );
  }, []);
  const updateListItem = useCallback(
    (id: string, patch: Partial<ListItem>) => setData((d) => ({ ...d, list: d.list.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
    [],
  );
  const removeFromList = useCallback((id: string) => setData((d) => ({ ...d, list: d.list.filter((i) => i.id !== id) })), []);
  const clearTicked = useCallback(() => setData((d) => ({ ...d, list: d.list.filter((i) => !i.done) })), []);

  const value = useMemo<Store>(
    () => ({ ...data, ready, saveReceipt, deleteReceipt, addToList, updateListItem, removeFromList, clearTicked }),
    [data, ready, saveReceipt, deleteReceipt, addToList, updateListItem, removeFromList, clearTicked],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGroceries() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useGroceries must be used inside <GroceriesProvider>");
  return s;
}
