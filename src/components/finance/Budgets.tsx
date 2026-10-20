"use client";

import { useState } from "react";
import { CATEGORIES, money, monthRange, weekRange, type CategoryId } from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { spendingByCategory } from "./Spending";
import { Bar, Card, CardTitle, Label, MoneyInput, PrimaryButton, Sheet } from "./ui";

/** This week's day-to-day spending against the weekly allowance. */
export function allowanceStatus(txns: Parameters<typeof spendingByCategory>[0], allowance: number, now: Date) {
  const { start, end } = weekRange(now);
  const spent = [...spendingByCategory(txns, start, end).values()].reduce((a, b) => a + b, 0);
  const daysLeft = Math.max(1, Math.round((end.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000) + 1);
  return { spent, left: allowance - spent, perDay: (allowance - spent) / daysLeft, daysLeft };
}

export function BudgetsTab({ now }: { now: Date }) {
  const { txns, budgets, setBudget, weeklyAllowance, setWeeklyAllowance, has } = useFinance();
  const [editing, setEditing] = useState<CategoryId | "allowance" | null>(null);

  const { start, end } = monthRange(now);
  const month = spendingByCategory(txns, start, end);
  // Categories you picked during setup come first.
  const featured: CategoryId[] = [...(has("pet") ? ["pet" as const] : []), ...(has("groceries") ? ["groceries" as const, "household" as const] : [])];
  const cats = CATEGORIES.filter((c) => c.counts).sort(
    (a, b) => Number(featured.includes(b.id)) - Number(featured.includes(a.id)),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {has("allowance") && (
        <Card>
          <CardTitle
            action={
              <button type="button" onClick={() => setEditing("allowance")} className="text-sm font-semibold text-sage-dark">
                {weeklyAllowance ? "Change" : "Set"}
              </button>
            }
          >
            Weekly allowance
          </CardTitle>
          {weeklyAllowance ? (
            <AllowanceBody allowance={weeklyAllowance} now={now} />
          ) : (
            <p className="text-muted">
              Set an amount for day-to-day spending each week (groceries, eating out, shopping…). Bills aren&apos;t included.
            </p>
          )}
        </Card>
      )}

      <Card>
        <CardTitle>Monthly budgets</CardTitle>
        <p className="mb-3 text-sm text-muted">Tap a category to set a budget. Leave it empty if you don&apos;t want one.</p>
        <ul className="space-y-3">
          {cats.map((c) => {
            const spent = month.get(c.id) ?? 0;
            const budget = budgets[c.id];
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setEditing(c.id)} className="w-full text-left">
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-[15px]">
                    <span className="font-semibold">{c.label}</span>
                    <span className={budget && spent > budget ? "font-semibold text-peach" : "text-muted"}>
                      {money(spent)}
                      {budget ? ` / ${money(budget, true)}` : " · no budget"}
                    </span>
                  </div>
                  {budget ? <Bar value={spent} max={budget} color={c.color} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {editing && (
        <AmountSheet
          title={editing === "allowance" ? "Weekly allowance" : `${CATEGORIES.find((c) => c.id === editing)?.label} budget`}
          hint={editing === "allowance" ? "For day-to-day spending, Monday to Sunday." : "Per month."}
          value={editing === "allowance" ? weeklyAllowance : (budgets[editing] ?? null)}
          onSave={(v) => (editing === "allowance" ? setWeeklyAllowance(v) : setBudget(editing, v))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

export function AllowanceBody({ allowance, now }: { allowance: number; now: Date }) {
  const { txns } = useFinance();
  const s = allowanceStatus(txns, allowance, now);
  return (
    <>
      <p className="text-[28px] font-bold leading-tight">
        {s.left >= 0 ? money(s.left) : money(-s.left)}
        <span className="text-[15px] font-normal text-muted"> {s.left >= 0 ? "left this week" : "over this week"}</span>
      </p>
      <div className="mt-2">
        <Bar value={s.spent} max={allowance} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {money(s.spent)} of {money(allowance, true)} spent
        {s.left > 0 ? ` · about ${money(s.perDay)} a day for the next ${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"}` : ""}
      </p>
    </>
  );
}

export function AmountSheet({
  title,
  hint,
  value,
  onSave,
  onClose,
}: {
  title: string;
  hint?: string;
  value: number | null;
  onSave: (v: number | null) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState<number | null>(value);
  return (
    <Sheet title={title} onClose={onClose}>
      {hint && <Label>{hint}</Label>}
      <MoneyInput value={amount} onChange={setAmount} autoFocus label={title} />
      <PrimaryButton
        onClick={() => {
          onSave(amount && amount > 0 ? amount : null);
          onClose();
        }}
      >
        Save
      </PrimaryButton>
      {value !== null && (
        <button
          type="button"
          onClick={() => {
            onSave(null);
            onClose();
          }}
          className="mt-3 w-full py-2 text-sm font-semibold text-muted"
        >
          Remove
        </button>
      )}
    </Sheet>
  );
}
