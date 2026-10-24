"use client";

// Groceries data (receipts and the receipt-reader connection), kept in this
// browser's localStorage. The photo itself is not kept, only what was read.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReaderSettings, Receipt } from "./groceries";
import { markSaved } from "./sync";

type Data = { receipts: Receipt[]; reader: ReaderSettings };

const STORAGE_KEY = "meraki.groceries.v1";
const EMPTY: Data = { receipts: [], reader: { url: "", passcode: "" } };

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

type Store = Data & {
  ready: boolean;
  saveReceipt: (r: Omit<Receipt, "id"> & { id?: string }) => string;
  deleteReceipt: (id: string) => void;
  setReader: (r: ReaderSettings) => void;
};

const Ctx = createContext<Store | null>(null);

export function GroceriesProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from localStorage
      if (raw) setData({ ...EMPTY, ...(JSON.parse(raw) as Partial<Data>) });
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
  const setReader = useCallback((reader: ReaderSettings) => setData((d) => ({ ...d, reader })), []);

  const value = useMemo<Store>(
    () => ({ ...data, ready, saveReceipt, deleteReceipt, setReader }),
    [data, ready, saveReceipt, deleteReceipt, setReader],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGroceries() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useGroceries must be used inside <GroceriesProvider>");
  return s;
}
