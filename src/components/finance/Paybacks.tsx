"use client";

// Paid back: money friends send you for their share of something you paid. Linked to that payment,
// it lowers what the payment really cost you (€50 dinner, €15 back = €35), and isn't counted as income.

import { useState } from "react";
import { money, type LineDetail } from "@/lib/finance";

export type Candidate = { hash: string; date: string; description: string; amount: number; account?: string };

const day = (key: string) => new Date(key + "T12:00:00").getTime() / 86_400_000;
export const shortDate = (key: string) => new Date(key + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Payments a payback could be for: paid up to 60 days before it (or a few days after), and at least as much. */
export function paymentsFor(payback: { date: string; amount: number }, pool: Candidate[]) {
  const d = day(payback.date);
  return pool
    .filter((c) => c.amount < 0 && -c.amount >= payback.amount - 0.005 && day(c.date) <= d + 3 && day(c.date) >= d - 60)
    .sort((a, b) => Math.abs(day(a.date) - d) - Math.abs(day(b.date) - d));
}

/** Money in that could be a payback for this payment: within 60 days after it, and no more than it. */
export function paybacksFor(payment: { date: string; amount: number }, pool: (Candidate & { id: string })[]) {
  const d = day(payment.date);
  return pool
    .filter((c) => c.amount > 0 && c.amount <= -payment.amount + 0.005 && day(c.date) >= d - 3 && day(c.date) <= d + 60)
    .sort((a, b) => Math.abs(day(a.date) - d) - Math.abs(day(b.date) - d));
}

/** Pick the payment a payback is for. Closest dates first. */
export function PaybackPicker({
  payback,
  pool,
  value,
  onChange,
}: {
  payback: { date: string; amount: number };
  pool: Candidate[];
  value?: string;
  onChange: (hash: string | undefined) => void;
}) {
  const [more, setMore] = useState(false);
  const list = paymentsFor(payback, pool);
  const chosen = list.find((c) => c.hash === value);
  const shown = more ? list.slice(0, 40) : list.slice(0, 5);
  if (chosen && !shown.includes(chosen)) shown.unshift(chosen);

  return (
    <div className="mt-2 rounded-2xl bg-cream p-3">
      <p className="text-[14px] font-semibold">Which payment was it for?</p>
      {chosen ? (
        <p className="text-[13px] text-sage-dark">
          {chosen.description}: you paid {money(-chosen.amount)}, so it cost you {money(-chosen.amount - payback.amount)}.
        </p>
      ) : (
        <p className="text-[13px] text-muted">Pick it so that payment counts as what you really paid.</p>
      )}
      {list.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted">No payment of {money(payback.amount)} or more in the 60 days before this.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {shown.map((c) => {
            const on = c.hash === value;
            return (
              <li key={c.hash}>
                <button
                  type="button"
                  onClick={() => onChange(on ? undefined : c.hash)}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${on ? "bg-sage-dark text-white" : "bg-card"}`}
                >
                  <span className={`w-12 shrink-0 text-xs ${on ? "text-white/80" : "text-muted"}`}>{shortDate(c.date)}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px]">{c.description}</span>
                  <span className="shrink-0 text-[14px] font-semibold">{money(c.amount)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > 5 && !more && (
        <button type="button" onClick={() => setMore(true)} className="mt-2 text-[13px] font-semibold text-sage-dark">
          Show more ({list.length - 5})
        </button>
      )}
    </div>
  );
}

/** Everything known about one statement line. */
export function LineDetails({
  date,
  amount,
  description,
  account,
  details,
  notes = [],
}: {
  date: string;
  amount: number;
  description: string;
  account?: string;
  details?: LineDetail[];
  notes?: string[];
}) {
  const rows: LineDetail[] = [
    { label: "Date", value: new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" }) },
    { label: "Amount", value: money(amount) },
    { label: "Description", value: description },
    ...(account ? [{ label: "Statement", value: account }] : []),
    // The statement's own fields, without repeating what's above.
    ...(details ?? []).filter((d) => d.value && d.value !== description && !["date", "amount", "description"].includes(d.label.toLowerCase())),
  ];
  return (
    <div className="rounded-2xl bg-cream px-3.5 py-2.5">
      <dl className="divide-y divide-line text-[13px]">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-3 py-1.5">
            <dt className="w-24 shrink-0 text-muted">{r.label}</dt>
            <dd className="min-w-0 flex-1 break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
      {notes.length > 0 && <p className="mt-1.5 text-xs text-muted">{notes.join(" · ")}</p>}
    </div>
  );
}
