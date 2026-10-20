"use client";

// Money data, kept in this browser's localStorage (separate from tasks and
// routines). Nothing here is ever sent to a server.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  billKeyword,
  categorise,
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

type FinanceData = {
  setupDone: boolean;
  modules: ModuleId[];
  income: Income | null;
  bills: Bill[];
  paid: Record<string, string>; // paidKey -> when it was marked paid (ISO)
  txns: Txn[];
  rules: Rule[]; // learned from "always use this category"
  importProfiles: Record<string, ColumnMap>; // remembered column choices per bank layout
  budgets: Partial<Record<CategoryId, number>>; // per month
  weeklyAllowance: number | null;
  goals: Goal[];
};

const STORAGE_KEY = "meraki.finance.v1";

const EMPTY: FinanceData = {
  setupDone: false,
  modules: [],
  income: null,
  bills: [],
  paid: {},
  txns: [],
  rules: [],
  importProfiles: {},
  budgets: {},
  weeklyAllowance: null,
  goals: [],
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
  has: (m: ModuleId) => boolean;
  saveSetup: (modules: ModuleId[]) => void;
  setIncome: (income: Income | null) => void;
  saveBill: (bill: Omit<Bill, "id"> & { id?: string }) => void;
  deleteBill: (id: string) => void;
  togglePaid: (key: string) => void;
  addTxn: (t: Omit<Txn, "id" | "hash" | "source">) => void;
  importLines: (lines: ParsedLine[], signature: string, map: ColumnMap) => ImportResult;
  setTxnCategory: (id: string, category: CategoryId, alwaysFor?: string) => void;
  deleteTxn: (id: string) => void;
  setBudget: (category: CategoryId, amount: number | null) => void;
  setWeeklyAllowance: (amount: number | null) => void;
  saveGoal: (goal: Omit<Goal, "id"> & { id?: string }) => void;
  deleteGoal: (id: string) => void;
};

const FinanceContext = createContext<FinanceStore | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<FinanceData>(EMPTY);
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
    (lines: ParsedLine[], signature: string, map: ColumnMap): ImportResult => {
      const seen = new Set(data.txns.map((t) => t.hash));
      const added: Txn[] = [];
      let duplicates = 0;
      for (const line of lines) {
        const hash = txnHash(line.date, line.amount, line.description);
        if (seen.has(hash)) {
          duplicates++;
          continue;
        }
        seen.add(hash);
        added.push({
          ...line,
          id: newId(),
          source: "import",
          hash,
          category: categorise(line.description, line.amount, data.rules, data.bills),
        });
      }

      // A bank line that matches a bill marks the nearest due date (within a week) as paid.
      const paid = { ...data.paid };
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
        if (due && !paid[paidKey(bill, due)]) {
          paid[paidKey(bill, due)] = new Date(y, m - 1, dd).toISOString();
          billsMarkedPaid++;
        }
      }

      setData((d) => ({
        ...d,
        txns: [...d.txns, ...added],
        paid,
        importProfiles: { ...d.importProfiles, [signature]: map },
      }));
      return { added: added.length, duplicates, billsMarkedPaid };
    },
    [data.txns, data.rules, data.bills, data.paid],
  );

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

  const value = useMemo<FinanceStore>(
    () => ({
      ...data,
      ready,
      has: (m) => data.modules.includes(m),
      saveSetup,
      setIncome,
      saveBill,
      deleteBill,
      togglePaid,
      addTxn,
      importLines,
      setTxnCategory,
      deleteTxn,
      setBudget,
      setWeeklyAllowance,
      saveGoal,
      deleteGoal,
    }),
    [
      data,
      ready,
      saveSetup,
      setIncome,
      saveBill,
      deleteBill,
      togglePaid,
      addTxn,
      importLines,
      setTxnCategory,
      deleteTxn,
      setBudget,
      setWeeklyAllowance,
      saveGoal,
      deleteGoal,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const store = useContext(FinanceContext);
  if (!store) throw new Error("useFinance must be used inside <FinanceProvider>");
  return store;
}
