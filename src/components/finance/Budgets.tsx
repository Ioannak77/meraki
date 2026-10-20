"use client";

import { useState } from "react";
import {
  allCategories,
  effectiveBudgets,
  canLower,
  money,
  monthRange,
  monthStats,
  tidy,
  weekRange,
  type CategoryId,
} from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { NewChip } from "../NewChip";
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
  const { txns, budgets, setBudget, weeklyAllowance, setWeeklyAllowance, has, addCategory } = useFinance();
  const [editing, setEditing] = useState<CategoryId | "allowance" | null>(null);

  const { start, end } = monthRange(now);
  const month = spendingByCategory(txns, start, end);
  const stats = monthStats(txns, now);
  const effective = effectiveBudgets(budgets, stats);
  const monthlySpend = [...stats.avg.values()].reduce((a, v) => a + v, 0);
  const suggestedAllowance = stats.months.length ? tidy((monthlySpend * 12) / 52) : null;
  // Categories you picked during setup come first.
  const featured: CategoryId[] = [...(has("pet") ? ["pet" as const] : []), ...(has("groceries") ? ["groceries" as const, "household" as const] : [])];
  const cats = allCategories().filter((c) => c.counts).sort(
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
              An amount for day-to-day spending each week (groceries, eating out, shopping…). Bills aren&apos;t included.
            </p>
          )}
          {suggestedAllowance && suggestedAllowance !== weeklyAllowance && (
            <button
              type="button"
              onClick={() => setWeeklyAllowance(suggestedAllowance)}
              className="mt-3 w-full rounded-2xl bg-sage-soft px-4 py-3 text-left text-sm text-sage-dark"
            >
              Your statements average about <strong>{money(suggestedAllowance, true)} a week</strong>. Tap to use that.
            </button>
          )}
        </Card>
      )}

      <Card>
        <CardTitle>Monthly budgets</CardTitle>
        <p className="mb-3 text-sm text-muted">
          {stats.months.length
            ? `Set automatically from your average in ${stats.months.map((m) => m.label).join(", ")}. Tap one to set your own.`
            : "Import a statement or two and budgets will fill in by themselves from what you usually spend. You can also tap one to set it."}
        </p>
        <ul className="space-y-4">
          {cats.map((c) => {
            const spent = month.get(c.id) ?? 0;
            const b = effective.get(c.id);
            const lower = b ? canLower(stats, c.id, b.amount) : null;
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setEditing(c.id)} className="w-full text-left">
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-[15px]">
                    <span className="font-semibold">
                      {c.label}
                      {b && (
                        <span className="ml-2 rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-muted">
                          {b.auto ? "Auto" : "Yours"}
                        </span>
                      )}
                    </span>
                    <span className={b && spent > b.amount ? "font-semibold text-red" : "text-muted"}>
                      {money(spent)}
                      {b ? ` / ${money(b.amount, true)}` : " · no budget"}
                    </span>
                  </div>
                  {b ? <Bar value={spent} max={b.amount} color={c.color} /> : null}
                </button>
                {lower && (
                  <div className="mt-2 flex items-center gap-3 rounded-2xl bg-red-soft px-3 py-2.5 text-sm text-red">
                    <span className="flex-1">
                      Could be <strong>{money(lower.suggestion, true)}</strong>: in {lower.low.label} you spent{" "}
                      {money(lower.low.amount, true)}.
                    </span>
                    <button
                      type="button"
                      onClick={() => setBudget(c.id, lower.suggestion)}
                      className="shrink-0 rounded-full bg-red px-3 py-1.5 font-bold text-white"
                    >
                      Use {money(lower.suggestion, true)}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-4">
          <NewChip placeholder="New category, e.g. Gifts" onAdd={(name) => setEditing(addCategory(name))} />
        </div>
      </Card>

      {editing && (
        <AmountSheet
          title={editing === "allowance" ? "Weekly allowance" : `${allCategories().find((c) => c.id === editing)?.label} budget`}
          hint={editing === "allowance" ? "For day-to-day spending, Monday to Sunday." : "Per month. Remove it to go back to automatic."}
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
