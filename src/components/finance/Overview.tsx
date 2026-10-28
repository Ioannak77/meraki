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
import { Icon } from "../icons";

export type FinanceTab = "Overview" | "Bills" | "Spending" | "Goals" | "Tracker" | "Advice";

export function OverviewTab({ now, go }: { now: Date; go: (tab: FinanceTab) => void }) {
  const { income, bills, paid, billActuals, txns, weeklyAllowance, has, advice } = useFinance();
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

  const hasMonth = monthIn > 0 || monthBills > 0 || monthSpent > 0;

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
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

      {(has("summary") || has("income")) && (
        <Card className="lg:col-span-2">
          {!income ? (
            <>
              <CardTitle>Until payday</CardTitle>
              <p className="text-muted">Add your monthly pay and payday to see how much you can still spend before you&apos;re paid again.</p>
              <PrimaryButton onClick={() => setEditingIncome(true)}>Add pay and payday</PrimaryButton>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">
                    Left to spend until payday ({short(period.next)})
                  </p>
                  <p className={`text-[40px] font-bold leading-tight ${left < 0 ? "text-peach" : ""}`}>{money(left)}</p>
                </div>
                <button type="button" onClick={() => setEditingIncome(true)} className="text-sm font-semibold text-sage-dark">
                  Edit pay
                </button>
              </div>
              <p className="text-[15px] text-muted">
                {period.daysLeft === 0 ? "Payday is today" : `${period.daysLeft} ${period.daysLeft === 1 ? "day" : "days"} to go`}
                {left > 0 && period.daysLeft > 0 ? ` · about ${money(left / period.daysLeft)} a day` : ""}
                {left < 0 ? " · you've gone over" : ""}
              </p>
              {/* Spelled out as a sum so the big number is never a mystery. */}
              <ul className="mt-4 space-y-2 rounded-2xl bg-cream px-4 py-3 text-[15px]">
                <SummaryRow label={`Pay on ${short(period.start)}`} value={income.amount} />
                <SummaryRow
                  label={`Bills before ${short(period.next)}${billsUnpaid ? ` (${money(billsUnpaid, true)} not paid yet)` : ""}`}
                  value={-billsTotal}
                />
                <SummaryRow label={`Spent since ${short(period.start)}`} value={-spentInPeriod} />
                <li className="flex justify-between border-t border-line pt-2 font-bold">
                  <span>Left</span>
                  <span className={left < 0 ? "text-peach" : "text-sage-dark"}>{money(left)}</span>
                </li>
              </ul>
              {has("imports") && lastImport && lastImport < dayKey(now) && (
                <p className="mt-2 text-xs text-muted">
                  Spending is counted up to {short(new Date(lastImport + "T12:00:00"))}, your latest statement line. Import a newer
                  statement to bring it up to date.
                </p>
              )}
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
            <button type="button" onClick={() => go("Spending")} className="text-left text-muted">
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

      {/* With income set, the payday card above already says what came in, went out and is left. */}
      {has("summary") && hasMonth && !income && (
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

      {/* The latest money check-in from Advice, or an invitation to get one. */}
      {(income || bills.length > 0 || txns.length > 0) && (
        <button
          type="button"
          onClick={() => go("Advice")}
          className="flex items-center gap-3 rounded-3xl bg-card p-5 text-left lg:col-span-2"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-peach-soft text-peach">
            <Icon.wallet className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            {advice ? (
              <>
                <span className="block text-xs text-muted">
                  Latest check-in · {new Date(advice.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                </span>
                <span className="block text-[15px] font-semibold leading-snug">{advice.result.headline}</span>
              </>
            ) : (
              <>
                <span className="block text-[15px] font-semibold">Get your money check-in</span>
                <span className="block text-sm text-muted">What&apos;s going well, what to watch, what to try</span>
              </>
            )}
          </span>
          <span className="text-muted">›</span>
        </button>
      )}

      {editingIncome && <IncomeSheet income={income} onClose={() => setEditingIncome(false)} />}
      {importing && <ImportSheet onClose={() => setImporting(false)} />}
    </div>
  );
}

function short(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
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
