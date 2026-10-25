"use client";

// Budget helpers, shown in Money > Spending: the weekly allowance and the amount sheet.

import { useState } from "react";
import { money, weekRange } from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { spendingByCategory } from "./Spending";
import { Bar, Label, MoneyInput, PrimaryButton, Sheet } from "./ui";

/** This week's day-to-day spending against the weekly allowance. */
export function allowanceStatus(txns: Parameters<typeof spendingByCategory>[0], allowance: number, now: Date) {
  const { start, end } = weekRange(now);
  const spent = [...spendingByCategory(txns, start, end).values()].reduce((a, b) => a + b, 0);
  const daysLeft = Math.max(1, Math.round((end.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000) + 1);
  return { spent, left: allowance - spent, perDay: (allowance - spent) / daysLeft, daysLeft };
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
