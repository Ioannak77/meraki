"use client";

// Money data, kept in this browser's localStorage (separate from tasks and the
// cleaning schedule). Nothing here is ever sent to a server.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  CUSTOM_COLORS,
  allCategories,
  setCustomCategories,
  type Category,
  billKeyword,
  dueDates,
  paidKey,
  txnHash,
  type Bill,
  type CategoryId,
  type ColumnMap,
  type Goal,
  type Income,
  type ModuleId,
  type ParsedLine,
  type Rule,
  type Txn,
} from "./finance";
import { today } from "./clock";
import { markSaved } from "./sync";
import type { Advice } from "./advice";

type FinanceData = {
  setupDone: boolean;
  modules: ModuleId[];
  income: Income | null;
  bills: Bill[];
  paid: Record<string, string>; // paidKey -> when it was marked paid (ISO)
  billActuals: Record<string, number>; // paidKey -> amount actually paid, seen on a statement
  txns: Txn[];
  rules: Rule[]; // learned from "always use this category"
  importProfiles: Record<string, ColumnMap>; // remembered column choices per bank layout
  budgets: Partial<Record<CategoryId, number>>; // per month
  weeklyAllowance: number | null;
  goals: Goal[];
  customCategories: Category[]; // your own, e.g. "Car maintenance", "Limassol"
  trackers: Tracker[];
  advice?: SavedAdvice | null; // the latest money check-in from Claude (Money > Advice)
};

export type SavedAdvice = { at: string; question: string; result: Advice };

/** A Tracker tab: easy access to the money in a few categories (and bills). */
export type Tracker = { id: string; name: string; categories: CategoryId[]; billIds: string[] };

const STORAGE_KEY = "meraki.finance.v1";

const EMPTY: FinanceData = {
  setupDone: false,
  modules: [],
  income: null,
  bills: [],
  paid: {},
  billActuals: {},
  txns: [],
  rules: [],
  importProfiles: {},
  budgets: {},
  weeklyAllowance: null,
  goals: [],
  customCategories: [],
  trackers: [],
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function load(): FinanceData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<FinanceData>) };
  } catch {}
  return EMPTY;
}

export type ImportResult = { added: number; duplicates: number; billsMarkedPaid: number };

type FinanceStore = FinanceData & {
  ready: boolean;
  saveAdvice: (a: SavedAdvice | null) => void;
  has: (m: ModuleId) => boolean;
  saveSetup: (modules: ModuleId[]) => void;
  setIncome: (income: Income | null) => void;
  saveBill: (bill: Omit<Bill, "id"> & { id?: string }) => void;
  deleteBill: (id: string) => void;
  togglePaid: (key: string) => void;
  addTxn: (t: Omit<Txn, "id" | "hash" | "source">) => void;
  /** Lines arrive already categorised (and reviewed); `newRules` are the "always" mappings chosen during review. */
  importLines: (
    lines: (ParsedLine & { category: CategoryId })[],
    signature: string,
    map: ColumnMap,
    newRules: Rule[],
  ) => ImportResult;
  setTxnCategory: (id: string, category: CategoryId, alwaysFor?: string) => void;
  deleteRule: (match: string) => void;
  deleteTxn: (id: string) => void;
  setBudget: (category: CategoryId, amount: number | null) => void;
  setWeeklyAllowance: (amount: number | null) => void;
  saveGoal: (goal: Omit<Goal, "id"> & { id?: string }) => void;
  deleteGoal: (id: string) => void;
  /** Makes a new category (or returns the existing one with that name). */
  addCategory: (label: string) => CategoryId;
  saveTracker: (t: Omit<Tracker, "id"> & { id?: string }) => string;
  deleteTracker: (id: string) => void;
};

const FinanceContext = createContext<FinanceStore | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<FinanceData>(EMPTY);
  const [ready, setReady] = useState(false);

  // Make your own categories visible to every screen and calculation.
  setCustomCategories(data.customCategories);

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

  const saveSetup = useCallback((modules: ModuleId[]) => {
    setData((d) => ({ ...d, setupDone: true, modules }));
  }, []);

  const setIncome = useCallback((income: Income | null) => setData((d) => ({ ...d, income })), []);

  const saveBill = useCallback((bill: Omit<Bill, "id"> & { id?: string }) => {
    setData((d) => {
      if (bill.id) return { ...d, bills: d.bills.map((b) => (b.id === bill.id ? ({ ...bill, id: b.id } as Bill) : b)) };
      return { ...d, bills: [...d.bills, { ...bill, id: newId() }] };
    });
  }, []);

  const deleteBill = useCallback((id: string) => {
    setData((d) => ({ ...d, bills: d.bills.filter((b) => b.id !== id) }));
  }, []);

  const togglePaid = useCallback((key: string) => {
    setData((d) => {
      const paid = { ...d.paid };
      if (paid[key]) delete paid[key];
      else paid[key] = today().toISOString();
      return { ...d, paid };
    });
  }, []);

  const addTxn = useCallback((t: Omit<Txn, "id" | "hash" | "source">) => {
    setData((d) => ({
      ...d,
      txns: [...d.txns, { ...t, id: newId(), source: "manual", hash: txnHash(t.date, t.amount, t.description) }],
    }));
  }, []);

  // Runs the import against the current data synchronously so the screen can
  // show "added / duplicates" straight away, then saves.
  const importLines = useCallback(
    (lines: (ParsedLine & { category: CategoryId })[], signature: string, map: ColumnMap, newRules: Rule[]): ImportResult => {
      const seen = new Set(data.txns.map((t) => t.hash));
      const added: Txn[] = [];
      let duplicates = 0;
      // Spending you already added by hand (or from a receipt): the same amount within 3 days
      // on the statement is that payment, so it isn't counted twice.
      const byHand = data.txns.filter((t) => t.source === "manual" && t.amount < 0);
      const matched = new Set<string>();
      const daysApart = (a: string, b: string) => Math.abs(new Date(a + "T12:00:00").getTime() - new Date(b + "T12:00:00").getTime()) / 86_400_000;
      for (const line of lines) {
        const hash = txnHash(line.date, line.amount, line.description);
        if (seen.has(hash)) {
          duplicates++;
          continue;
        }
        const same = line.amount < 0 && byHand.find((t) => !matched.has(t.id) && Math.abs(t.amount - line.amount) < 0.01 && daysApart(t.date, line.date) <= 3);
        if (same) {
          matched.add(same.id);
          duplicates++;
          continue;
        }
        seen.add(hash);
        added.push({ ...line, id: newId(), source: "import", hash });
      }

      // A bank line that matches a bill marks the nearest due date (within a
      // week) as paid and saves what it really cost.
      const paid = { ...data.paid };
      const billActuals = { ...data.billActuals };
      let billsMarkedPaid = 0;
      for (const t of added) {
        if (t.category !== "bills") continue;
        const text = t.description.toLowerCase();
        const bill = data.bills.find((b) => text.includes(billKeyword(b)));
        if (!bill) continue;
        const [y, m, dd] = t.date.split("-").map(Number);
        const from = new Date(y, m - 1, dd - 7);
        const to = new Date(y, m - 1, dd + 7);
        const due = dueDates(bill, from, to)[0];
        if (!due) continue;
        const key = paidKey(bill, due);
        billActuals[key] = (billActuals[key] ?? 0) - t.amount; // a bill paid in two parts adds up
        if (!paid[key]) {
          paid[key] = new Date(y, m - 1, dd).toISOString();
          billsMarkedPaid++;
        }
      }

      setData((d) => {
        const fresh = newRules.filter((r) => r.match.trim());
        return {
          ...d,
          txns: [...d.txns, ...added],
          paid,
          billActuals,
          rules: [...fresh, ...d.rules.filter((r) => !fresh.some((f) => f.match === r.match))],
          // A PDF statement has no columns to remember (signature "").
          importProfiles: signature ? { ...d.importProfiles, [signature]: map } : d.importProfiles,
        };
      });
      return { added: added.length, duplicates, billsMarkedPaid };
    },
    [data.txns, data.bills, data.paid, data.billActuals],
  );

  const deleteRule = useCallback((match: string) => {
    setData((d) => ({ ...d, rules: d.rules.filter((r) => r.match !== match) }));
  }, []);

  const setTxnCategory = useCallback((id: string, category: CategoryId, alwaysFor?: string) => {
    setData((d) => {
      const match = alwaysFor?.toLowerCase().trim();
      return {
        ...d,
        txns: d.txns.map((t) =>
          t.id === id || (match && t.description.toLowerCase().includes(match)) ? { ...t, category } : t,
        ),
        rules: match ? [{ match, category }, ...d.rules.filter((r) => r.match !== match)] : d.rules,
      };
    });
  }, []);

  const deleteTxn = useCallback((id: string) => setData((d) => ({ ...d, txns: d.txns.filter((t) => t.id !== id) })), []);

  const setBudget = useCallback((category: CategoryId, amount: number | null) => {
    setData((d) => {
      const budgets = { ...d.budgets };
      if (amount === null) delete budgets[category];
      else budgets[category] = amount;
      return { ...d, budgets };
    });
  }, []);

  const setWeeklyAllowance = useCallback((amount: number | null) => setData((d) => ({ ...d, weeklyAllowance: amount })), []);

  const saveGoal = useCallback((goal: Omit<Goal, "id"> & { id?: string }) => {
    setData((d) => {
      if (goal.id) return { ...d, goals: d.goals.map((g) => (g.id === goal.id ? ({ ...goal, id: g.id } as Goal) : g)) };
      return { ...d, goals: [...d.goals, { ...goal, id: newId() }] };
    });
  }, []);

  const deleteGoal = useCallback((id: string) => setData((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) })), []);

  const addCategory = useCallback(
    (label: string): CategoryId => {
      const name = label.trim();
      const existing = allCategories().find((c) => c.label.toLowerCase() === name.toLowerCase());
      if (existing) return existing.id;
      const id: CategoryId = `custom:${newId()}`;
      const color = CUSTOM_COLORS[data.customCategories.length % CUSTOM_COLORS.length];
      const made: Category = { id, label: name, color, counts: true };
      setCustomCategories([...data.customCategories, made]); // visible right away, before the re-render
      setData((d) => ({ ...d, customCategories: [...d.customCategories, made] }));
      return id;
    },
    [data.customCategories],
  );

  const saveTracker = useCallback((t: Omit<Tracker, "id"> & { id?: string }) => {
    const id = t.id ?? newId();
    setData((d) => ({
      ...d,
      trackers: t.id ? d.trackers.map((x) => (x.id === t.id ? { ...t, id } : x)) : [...d.trackers, { ...t, id }],
    }));
    return id;
  }, []);

  const deleteTracker = useCallback((id: string) => setData((d) => ({ ...d, trackers: d.trackers.filter((t) => t.id !== id) })), []);

  const saveAdvice = useCallback((advice: SavedAdvice | null) => setData((d) => ({ ...d, advice })), []);

  const value = useMemo<FinanceStore>(
    () => ({
      ...data,
      ready,
      saveAdvice,
      has: (m) => data.modules.includes(m),
      saveSetup,
      setIncome,
      saveBill,
      deleteBill,
      togglePaid,
      addTxn,
      importLines,
      setTxnCategory,
      deleteRule,
      deleteTxn,
      setBudget,
      setWeeklyAllowance,
      saveGoal,
      deleteGoal,
      addCategory,
      saveTracker,
      deleteTracker,
    }),
    [
      data,
      ready,
      saveAdvice,
      saveSetup,
      setIncome,
      saveBill,
      deleteBill,
      togglePaid,
      addTxn,
      importLines,
      setTxnCategory,
      deleteRule,
      deleteTxn,
      setBudget,
      setWeeklyAllowance,
      saveGoal,
      deleteGoal,
      addCategory,
      saveTracker,
      deleteTracker,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const store = useContext(FinanceContext);
  if (!store) throw new Error("useFinance must be used inside <FinanceProvider>");
  return store;
}
