"use client";

import { useState } from "react";
import { money, monthStats, necessitiesPerMonth, savingsPlan, tidy, type Goal } from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { AddButton, Bar, Card, CardTitle, Chips, DangerButton, Label, MoneyInput, PrimaryButton, Sheet, inputClass } from "./ui";

/**
 * Goals with their real targets (the emergency fund follows necessities ×
 * months automatically) and the monthly savings suggestion for each.
 */
export function useSavings(now: Date) {
  const { goals, bills, txns, income } = useFinance();
  const stats = monthStats(txns, now);
  const nec = necessitiesPerMonth(bills, stats);
  const hasData = stats.months.length > 0 || bills.length > 0;
  const withTargets: Goal[] = goals.map((g) =>
    g.emergency && g.autoTarget !== false && hasData ? { ...g, target: tidy(nec.total * (g.months ?? 3)) } : g,
  );
  const incomeAmount = income?.amount || stats.avgIncome;
  const plan = savingsPlan(incomeAmount, bills, stats, withTargets);
  return { goals: withTargets, stats, nec, plan, incomeAmount, hasData };
}

function monthsText(n: number) {
  if (!Number.isFinite(n)) return "";
  if (n <= 1) return "this month";
  if (n < 12) return `in about ${Math.ceil(n)} months`;
  const y = Math.floor(n / 12);
  const m = Math.ceil(n % 12);
  return `in about ${y} ${y === 1 ? "year" : "years"}${m ? ` ${m} months` : ""}`;
}

export function GoalsTab({ now }: { now: Date }) {
  const { goals, stats, nec, plan, incomeAmount, hasData } = useSavings(now);
  const [editing, setEditing] = useState<Goal | "new" | "emergency" | null>(null);
  const [adding, setAdding] = useState<Goal | null>(null);
  const hasEmergency = goals.some((g) => g.emergency);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardTitle>What you can save</CardTitle>
        {!incomeAmount || !stats.months.length ? (
          <p className="text-muted">
            Once your income is set and a full month of statements is imported, Meraki works out what&apos;s realistic to save.
          </p>
        ) : (
          <>
            <p className="text-[32px] font-bold leading-tight">
              {money(plan.available, true)}
              <span className="text-[15px] font-normal text-muted"> a month</span>
            </p>
            <p className="text-sm text-muted">
              {money(incomeAmount, true)} income − {money(plan.billsMonthly, true)} bills − {money(plan.spending, true)} usual
              spending ({stats.months.map((m) => m.label).join(", ")})
            </p>
            {plan.available === 0 && (
              <p className="mt-2 text-sm text-muted">
                Nothing left over on average right now. The red hints in Spending show where it could come from.
              </p>
            )}
          </>
        )}
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle action={<AddButton onClick={() => setEditing("new")} label="Add a goal" />}>Savings goals</CardTitle>
        {!hasEmergency && (
          <button
            type="button"
            onClick={() => setEditing("emergency")}
            className="mb-3 w-full rounded-2xl bg-sage-soft p-4 text-left text-[15px] text-sage-dark"
          >
            <strong>Start an emergency fund</strong>
            <span className="block text-sm">
              {hasData
                ? `Meraki sets the target from your necessities: about ${money(nec.total, true)} a month, × 3 months = ${money(tidy(nec.total * 3), true)}.`
                : "Its target is set from your necessities (bills, groceries, Pari…) once you add bills or import a statement."}
            </span>
          </button>
        )}
        {goals.length === 0 ? (
          <p className="text-muted">No goals yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {goals.map((g) => {
              const monthly = plan.perGoal.get(g.id) ?? 0;
              const toGo = Math.max(0, g.target - g.saved);
              return (
                <li key={g.id} className="py-3">
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setEditing(g)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[15px] font-semibold">
                        {g.name}
                        {g.emergency && (
                          <span className="ml-2 rounded-full bg-sage-soft px-2 py-0.5 text-[11px] text-sage-dark">Emergency</span>
                        )}
                      </span>
                      <span className="block text-[13px] text-muted">
                        {money(g.saved)} of {money(g.target, true)}
                        {toGo === 0 ? " · reached 🎉" : ` · ${money(toGo, true)} to go`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdding(g)}
                      className="shrink-0 rounded-full bg-sage-dark px-3.5 py-2 text-sm font-bold text-white"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="mt-2">
                    <Bar value={g.saved} max={g.target} />
                  </div>
                  {g.emergency && g.autoTarget !== false && hasData && (
                    <p className="mt-2 text-xs text-muted">
                      {g.months ?? 3} months of necessities: {money(nec.billsMonthly, true)} bills + {money(nec.essentials, true)}{" "}
                      groceries, household, Pari, transport and health a month.
                    </p>
                  )}
                  {toGo > 0 && monthly > 0 && (
                    <p className="mt-1 text-sm text-sage-dark">
                      Put aside {money(monthly, true)} a month → reached {monthsText(toGo / monthly)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {goals.length > 1 && plan.available > 0 && (
          <p className="mt-3 text-xs text-muted">
            While the emergency fund isn&apos;t full it gets most of what&apos;s left (70%); the other goals share the rest.
          </p>
        )}
      </Card>

      {editing && <GoalSheet goal={editing} onClose={() => setEditing(null)} />}
      {adding && <AddMoneySheet goal={adding} onClose={() => setAdding(null)} />}
    </div>
  );
}

function GoalSheet({ goal, onClose }: { goal: Goal | "new" | "emergency"; onClose: () => void }) {
  const { saveGoal, deleteGoal } = useFinance();
  const existing = typeof goal === "string" ? null : goal;
  const isEmergency = existing?.emergency ?? goal === "emergency";
  const [name, setName] = useState(existing?.name ?? (isEmergency ? "Emergency fund" : ""));
  const [auto, setAuto] = useState(isEmergency ? existing?.autoTarget !== false : false);
  const [months, setMonths] = useState(existing?.months ?? 3);
  const [target, setTarget] = useState<number | null>(existing?.target ?? null);
  const [saved, setSaved] = useState<number | null>(existing?.saved ?? 0);
  const valid = name.trim() && (auto || (target && target > 0));

  return (
    <Sheet title={existing ? "Edit goal" : isEmergency ? "Emergency fund" : "New goal"} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          saveGoal({
            id: existing?.id,
            name: name.trim(),
            target: target ?? 0,
            saved: saved ?? 0,
            emergency: isEmergency,
            autoTarget: isEmergency ? auto : undefined,
            months: isEmergency ? months : undefined,
          });
          onClose();
        }}
      >
        <Label>Name</Label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Holiday" className={inputClass} />

        {isEmergency && (
          <>
            <Label>Target</Label>
            <Chips
              options={[
                { id: "auto", label: "Automatic" },
                { id: "own", label: "Set my own" },
              ]}
              value={auto ? "auto" : "own"}
              onChange={(v) => setAuto(v === "auto")}
            />
            {auto && (
              <>
                <Label>How many months of necessities?</Label>
                <Chips
                  options={[
                    { id: 3, label: "3 months" },
                    { id: 6, label: "6 months" },
                  ]}
                  value={months}
                  onChange={setMonths}
                />
              </>
            )}
          </>
        )}
        {!auto && (
          <>
            <Label>Target</Label>
            <MoneyInput value={target} onChange={setTarget} label="Target" />
          </>
        )}

        <Label>Saved so far</Label>
        <MoneyInput value={saved} onChange={setSaved} label="Saved so far" />
        <PrimaryButton type="submit" disabled={!valid}>
          {existing ? "Save" : "Add goal"}
        </PrimaryButton>
        {existing && (
          <DangerButton
            label="Delete goal"
            onConfirm={() => {
              deleteGoal(existing.id);
              onClose();
            }}
          />
        )}
      </form>
    </Sheet>
  );
}

function AddMoneySheet({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const { saveGoal, goals } = useFinance();
  const [amount, setAmount] = useState<number | null>(null);
  const valid = amount !== null && amount !== 0;
  // Save onto the stored goal (not the version with the computed target).
  const stored = goals.find((g) => g.id === goal.id) ?? goal;
  return (
    <Sheet title={`Add to ${goal.name}`} onClose={onClose}>
      <Label>How much did you put aside? (use a minus to take some out)</Label>
      <MoneyInput value={amount} onChange={setAmount} autoFocus label="Amount" />
      <PrimaryButton
        disabled={!valid}
        onClick={() => {
          saveGoal({ ...stored, saved: Math.max(0, stored.saved + amount!) });
          onClose();
        }}
      >
        Add
      </PrimaryButton>
    </Sheet>
  );
}
