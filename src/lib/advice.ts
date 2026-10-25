// Money > Advice: a summary of everything in Money and Groceries goes to the meraki worker,
// Claude looks it over and replies with what's going well, what to watch and what to try.
// Only totals and names are sent (no bank details), and only when you ask.

import {
  type Bill,
  type CategoryId,
  type Goal,
  type Income,
  type Txn,
  category,
  monthStats,
  monthlyCost,
  savingsPlan,
} from "./finance";
import { type Receipt, priceHistory } from "./groceries";
import { dayKey } from "./store";
import { workerPost } from "./worker";

export type Advice = {
  headline: string;
  going_well: string[];
  watch: string[];
  suggestions: { title: string; detail: string; saves_per_month: number | null }[];
  answer: string;
};

type Input = {
  now: Date;
  income: Income | null;
  bills: Bill[];
  txns: Txn[];
  budgets: Partial<Record<CategoryId, number>>;
  weeklyAllowance: number | null;
  goals: Goal[];
  receipts: Receipt[];
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Everything Claude needs, as small, readable numbers. */
export function moneySummary({ now, income, bills, txns, budgets, weeklyAllowance, goals, receipts }: Input) {
  const months = Array.from({ length: 6 }, (_, i) => dayKey(new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)).slice(0, 7));
  const thisMonth = months[5];
  const counted = (t: Txn) => t.amount < 0 && category(t.category).counts;

  const spendingByMonth = months
    .map((m) => {
      const byCat = new Map<string, number>();
      for (const t of txns) if (t.date.startsWith(m) && counted(t)) byCat.set(category(t.category).label, (byCat.get(category(t.category).label) ?? 0) - t.amount);
      const incomeIn = txns.filter((t) => t.date.startsWith(m) && t.amount > 0 && t.category === "income").reduce((s, t) => s + t.amount, 0);
      return {
        month: m,
        partial: m === thisMonth,
        total: round([...byCat.values()].reduce((a, v) => a + v, 0)),
        income_received: round(incomeIn),
        by_category: Object.fromEntries([...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, round(v)])),
      };
    })
    .filter((m) => m.total > 0 || m.income_received > 0);

  // Where the money goes most, last 3 months (by statement description).
  const since = months[3];
  const places = new Map<string, number>();
  for (const t of txns) {
    if (t.date < since || !counted(t)) continue;
    const key = t.description.toLowerCase().replace(/\d+/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
    places.set(key, (places.get(key) ?? 0) - t.amount);
  }

  const stats = monthStats(txns, now);
  const plan = income ? savingsPlan(income.amount, bills, stats, goals) : null;

  const groceryMonths = months
    .map((m) => ({ month: m, total: round(receipts.filter((r) => r.date.startsWith(m)).reduce((s, r) => s + r.total, 0)) }))
    .filter((m) => m.total > 0);
  const shops = new Map<string, number>();
  for (const r of receipts) if (r.date >= since) shops.set(r.shop || "Other", (shops.get(r.shop || "Other") ?? 0) + r.total);

  return {
    today: dayKey(now),
    currency: "EUR",
    income: income ? { per_month: income.amount, payday: income.payday } : null,
    average_income_on_statements: round(stats.avgIncome),
    bills: bills.map((b) => ({
      name: b.name,
      kind: b.kind,
      amount: b.amount,
      frequency: b.frequency,
      per_month: round(monthlyCost(b)),
      ...(b.loan ? { loan_balance: b.loan.balance, interest_rate: b.loan.rate } : {}),
    })),
    bills_per_month: round(bills.reduce((t, b) => t + monthlyCost(b), 0)),
    spending_by_month: spendingByMonth,
    average_spending_per_category: Object.fromEntries([...stats.avg.entries()].map(([c, v]) => [category(c).label, round(v)])),
    budgets: Object.entries(budgets).map(([c, v]) => ({
      category: category(c as CategoryId).label,
      budget_per_month: v,
      spent_this_month: round(txns.filter((t) => t.date.startsWith(thisMonth) && t.category === c && t.amount < 0).reduce((s, t) => s - t.amount, 0)),
    })),
    weekly_allowance: weeklyAllowance,
    savings_goals: goals.map((g) => ({ name: g.name, target: g.target, saved: g.saved, emergency_fund: !!g.emergency })),
    left_over_per_month_estimate: plan ? round(plan.available) : null,
    top_places_last_3_months: [...places.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => ({ where: k, spent: round(v) })),
    groceries: {
      receipts_per_month: groceryMonths,
      by_shop_last_3_months: Object.fromEntries([...shops.entries()].map(([k, v]) => [k, round(v)])),
      most_bought: priceHistory(receipts)
        .slice(0, 15)
        .map((h) => ({ item: h.name, times: h.buys.length, last_price: h.buys[0].price, shops: [...new Set(h.buys.map((b) => b.shop))] })),
    },
  };
}

export function hasMoneyData(i: Pick<Input, "income" | "bills" | "txns" | "receipts">) {
  return !!i.income || i.bills.length > 0 || i.txns.length > 0 || i.receipts.length > 0;
}

export function askAdvice(summary: ReturnType<typeof moneySummary>, question: string) {
  return workerPost<Advice>("/advise", { summary, question }, "money advisor");
}
