"use client";

import { useState } from "react";
import {
  category,
  dueDates,
  expectedAmount,
  inRange,
  money,
  monthRange,
  paidKey,
  payPeriod,
  type Bill,
  type Income,
} from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { dayKey } from "@/lib/store";
import { AllowanceBody } from "./Budgets";
import { useSavings } from "./Goals";
import { dueLabel, upcomingBills } from "./Bills";
import { ImportSheet, spendingByCategory } from "./Spending";
import { Bar, Card, CardTitle, Label, MoneyInput, PrimaryButton, Sheet } from "./ui";

export type FinanceTab = "Overview" | "Bills" | "Spending" | "Budgets" | "Goals" | "Advice";

export function OverviewTab({ now, go }: { now: Date; go: (tab: FinanceTab) => void }) {
  const { income, bills, paid, billActuals, txns, weeklyAllowance, has } = useFinance();
  const { goals, plan } = useSavings(now);
  const [editingIncome, setEditingIncome] = useState(false);
  const [importing, setImporting] = useState(false);
  const billModules = has("bills") || has("home") || has("subscriptions") || has("insurance") || has("loans");
  const spendingModules = has("imports") || has("groceries") || has("pet");
  // Real amount once seen on a statement, else the estimate from past ones.
  const cost = (b: Bill, due: Date) => expectedAmount(b, due, billActuals, txns).amount;
  const lastImport = txns.filter((t) => t.source === "import").reduce((m, t) => (t.date > m ? t.date : m), "");

  const period = payPeriod(income, now);
  const billsInPeriod = bills.flatMap((b) => dueDates(b, period.start, period.end).map((due) => ({ bill: b, due })));
  const billsTotal = billsInPeriod.reduce((t, x) => t + cost(x.bill, x.due), 0);
  const billsUnpaid = billsInPeriod.filter((x) => !paid[paidKey(x.bill, x.due)]).reduce((t, x) => t + cost(x.bill, x.due), 0);
  const spentInPeriod = [...spendingByCategory(txns, period.start, now).values()].reduce((a, b) => a + b, 0);
  const left = income ? income.amount - billsTotal - spentInPeriod : 0;

  const soon = upcomingBills(bills, income?.payday ?? null, now, 7).filter(
    (x) => !paid[paidKey(x.bill, x.due)],
  );

  const { start: mStart, end: mEnd } = monthRange(now);
  const monthSpend = spendingByCategory(txns, mStart, mEnd);
  const topCats = [...monthSpend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const monthIncomeTxns = txns.filter((t) => t.category === "income" && t.amount > 0 && inRange(t.date, mStart, mEnd)).reduce((a, t) => a + t.amount, 0);
  const monthBills = bills.flatMap((b) => dueDates(b, mStart, mEnd).map((due) => cost(b, due))).reduce((a, b) => a + b, 0);
  const monthSpent = [...monthSpend.values()].reduce((a, b) => a + b, 0);
  const monthIn = monthIncomeTxns || income?.amount || 0;

  // Until things are set up, one checklist instead of a column of empty cards.
  const steps = [
    has("income") || has("summary")
      ? { label: "Add your income and payday", done: !!income, act: () => setEditingIncome(true) }
      : null,
    billModules ? { label: "Add your bills (rent, utilities, subscriptions…)", done: bills.length > 0, act: () => go("Bills") } : null,
    has("imports") ? { label: "Import a bank statement", done: txns.some((t) => t.source === "import"), act: () => setImporting(true) } : null,
    has("allowance") ? { label: "Set a weekly allowance", done: !!weeklyAllowance, act: () => go("Budgets") } : null,
    has("savings") ? { label: "Start an emergency fund", done: goals.some((g) => g.emergency), act: () => go("Goals") } : null,
  ].filter((s): s is { label: string; done: boolean; act: () => void } => s !== null);
  const stepsLeft = steps.filter((s) => !s.done).length;
  const hasMonth = monthIn > 0 || monthBills > 0 || monthSpent > 0;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {stepsLeft > 0 && (
        <Card className="lg:col-span-2">
          <CardTitle action={<span className="text-sm text-muted">{steps.length - stepsLeft} of {steps.length} done</span>}>
            Get started
          </CardTitle>
          <ul className="divide-y divide-line">
            {steps.map((s) => (
              <li key={s.label}>
                <button type="button" onClick={s.act} disabled={s.done} className="flex w-full items-center gap-3 py-3 text-left">
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${s.done ? "border-sage bg-sage text-white" : "border-line"}`}
                  >
                    {s.done && "✓"}
                  </span>
                  <span className={`flex-1 text-[15px] ${s.done ? "text-muted line-through" : "font-semibold"}`}>{s.label}</span>
                  {!s.done && <span className="text-muted">›</span>}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {has("imports") && txns.length > 0 && (
        <button
          type="button"
          onClick={() => setImporting(true)}
          className="flex items-center justify-between gap-3 rounded-3xl bg-sage-dark px-5 py-4 text-left text-white lg:col-span-2"
        >
          <span>
            <span className="block text-[17px] font-bold">Import bank statement</span>
            <span className="block text-sm text-white/80">
              {lastImport
                ? `Latest line so far: ${new Date(lastImport + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
                : "Budgets, bill estimates and savings fill in from your statements"}
            </span>
          </span>
          <span className="text-2xl">↑</span>
        </button>
      )}

      {(has("summary") || has("income")) && income && (
        <Card className="lg:col-span-2">
          {!income ? (
            <>
              <CardTitle>Payday forecast</CardTitle>
              <p className="text-muted">Add your monthly income and payday to see what&apos;s really left to spend.</p>
              <PrimaryButton onClick={() => setEditingIncome(true)}>Add income and payday</PrimaryButton>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">Left to spend until payday</p>
                  <p className={`text-[40px] font-bold leading-tight ${left < 0 ? "text-peach" : ""}`}>{money(left)}</p>
                </div>
                <button type="button" onClick={() => setEditingIncome(true)} className="text-sm font-semibold text-sage-dark">
                  Edit income
                </button>
              </div>
              <p className="text-[15px] text-muted">
                Payday {period.daysLeft === 0 ? "is today" : `in ${period.daysLeft} ${period.daysLeft === 1 ? "day" : "days"}`} (
                {period.next.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })})
                {left > 0 && period.daysLeft > 0 ? ` · about ${money(left / period.daysLeft)} a day` : ""}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label="Income" value={money(income.amount, true)} />
                <Stat label={billsUnpaid ? `Bills (${money(billsUnpaid, true)} to pay)` : "Bills"} value={money(billsTotal, true)} />
                <Stat label="Spent so far" value={money(spentInPeriod, true)} />
              </div>
            </>
          )}
        </Card>
      )}

      {billModules && bills.length > 0 && (
        <Card>
          <CardTitle
            action={
              <button type="button" onClick={() => go("Bills")} className="text-sm font-semibold text-sage-dark">
                All bills →
              </button>
            }
          >
            Bills due soon
          </CardTitle>
          {soon.length === 0 ? (
            <p className="text-muted">{bills.length ? "Nothing to pay in the next 7 days." : "No bills added yet."}</p>
          ) : (
            <ul className="divide-y divide-line">
              {soon.map(({ bill, due }) => (
                <li key={paidKey(bill, due)} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
                  <span className="min-w-0 truncate">{bill.name}</span>
                  <span className="shrink-0">
                    <span className="font-semibold">{money(cost(bill, due))}</span>
                    <span className={`ml-2 text-sm ${dayKey(due) < dayKey(now) ? "font-semibold text-peach" : "text-muted"}`}>
                      {dueLabel(due, now)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {has("allowance") && weeklyAllowance && (
        <Card>
          <CardTitle>This week</CardTitle>
          {weeklyAllowance ? (
            <AllowanceBody allowance={weeklyAllowance} now={now} />
          ) : (
            <button type="button" onClick={() => go("Budgets")} className="text-left text-muted">
              No weekly allowance set yet. <span className="font-semibold text-sage-dark">Set one →</span>
            </button>
          )}
        </Card>
      )}

      {spendingModules && txns.length > 0 && (
        <Card>
          <CardTitle
            action={
              <button type="button" onClick={() => go("Spending")} className="text-sm font-semibold text-sage-dark">
                Details →
              </button>
            }
          >
            Spending this month
          </CardTitle>
          {topCats.length === 0 ? (
            <p className="text-muted">Nothing yet. {has("imports") ? "Import a statement to fill this in." : "Add spending as you go."}</p>
          ) : (
            <ul className="space-y-3">
              {topCats.map(([id, amount]) => (
                <li key={id}>
                  <div className="mb-1 flex justify-between text-[15px]">
                    <span>{category(id).label}</span>
                    <span className="font-semibold">{money(amount)}</span>
                  </div>
                  <Bar value={amount} max={topCats[0][1]} color={category(id).color} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {has("savings") && goals.length > 0 && (
        <Card>
          <CardTitle
            action={
              <button type="button" onClick={() => go("Goals")} className="text-sm font-semibold text-sage-dark">
                Goals →
              </button>
            }
          >
            Savings
          </CardTitle>
          {plan.available > 0 && (
            <p className="mb-3 text-[15px] text-muted">
              You can save about <strong className="text-ink">{money(plan.available, true)} a month</strong>.
            </p>
          )}
          {goals.length === 0 ? (
            <p className="text-muted">No goals yet. An emergency fund is a good first one.</p>
          ) : (
            <ul className="space-y-3">
              {goals.slice(0, 3).map((g) => (
                <li key={g.id}>
                  <div className="mb-1 flex justify-between text-[15px]">
                    <span>{g.name}</span>
                    <span className="text-muted">
                      {money(g.saved, true)} / {money(g.target, true)}
                    </span>
                  </div>
                  <Bar value={g.saved} max={g.target} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {has("summary") && hasMonth && (
        <Card>
          <CardTitle>{now.toLocaleDateString(undefined, { month: "long" })} summary</CardTitle>
          <ul className="space-y-2 text-[15px]">
            <SummaryRow label="Money in" value={monthIn} />
            <SummaryRow label="Bills" value={-monthBills} />
            <SummaryRow label="Spending" value={-monthSpent} />
            <li className="flex justify-between border-t border-line pt-2 font-bold">
              <span>{monthIn - monthBills - monthSpent >= 0 ? "Left over" : "Short by"}</span>
              <span className={monthIn - monthBills - monthSpent < 0 ? "text-peach" : "text-sage-dark"}>
                {money(Math.abs(monthIn - monthBills - monthSpent))}
              </span>
            </li>
          </ul>
        </Card>
      )}

      {editingIncome && <IncomeSheet income={income} onClose={() => setEditingIncome(false)} />}
      {importing && <ImportSheet onClose={() => setImporting(false)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cream px-2 py-3">
      <p className="text-[17px] font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span>{money(value)}</span>
    </li>
  );
}

function IncomeSheet({ income, onClose }: { income: Income | null; onClose: () => void }) {
  const { setIncome } = useFinance();
  const [amount, setAmount] = useState<number | null>(income?.amount ?? null);
  const [payday, setPayday] = useState(income?.payday ?? 25);
  const valid = amount !== null && amount > 0;
  return (
    <Sheet title="Income and payday" onClose={onClose}>
      <Label>Take-home pay each month</Label>
      <MoneyInput value={amount} onChange={setAmount} autoFocus label="Monthly income" />
      <Label>Payday (day of the month)</Label>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setPayday(d)}
            className={`rounded-xl py-2 text-sm ${payday === d ? "bg-ink font-bold text-cream" : "bg-cream"}`}
          >
            {d}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">If the month is shorter, payday counts as its last day.</p>
      <PrimaryButton
        disabled={!valid}
        onClick={() => {
          setIncome({ amount: amount!, payday });
          onClose();
        }}
      >
        Save
      </PrimaryButton>
    </Sheet>
  );
}
