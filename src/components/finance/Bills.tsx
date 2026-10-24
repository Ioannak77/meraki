"use client";

import { useMemo, useState } from "react";
import {
  BILL_KINDS,
  FREQUENCIES,
  billEstimate,
  dueDates,
  expectedAmount,
  money,
  monthlyCost,
  nextDue,
  paidKey,
  payPeriod,
  type Bill,
  type BillKind,
  type Frequency,
} from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { dayKey } from "@/lib/store";
import { Icon } from "../icons";
import { AddButton, Card, CardTitle, Chips, DangerButton, Label, MoneyInput, PrimaryButton, Sheet, inputClass } from "./ui";

export function useAllowedKinds() {
  const { has } = useFinance();
  return BILL_KINDS.filter((k) => has(k.module) || (k.id === "bill" && has("bills")));
}

export function dueLabel(d: Date, now: Date) {
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return `${-days} days late`;
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Bill due dates from the start of this pay period to `daysAhead` days from now. */
export function upcomingBills(bills: Bill[], payday: number | null, now: Date, daysAhead: number) {
  const from = payPeriod(payday ? { amount: 0, payday } : null, now).start;
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);
  return bills
    .flatMap((b) => dueDates(b, from, to).map((due) => ({ bill: b, due })))
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}

export function BillsTab({ now, startNew = false }: { now: Date; startNew?: boolean }) {
  const { bills, paid, togglePaid, income, has, txns } = useFinance();
  const [editing, setEditing] = useState<Bill | "new" | null>(startNew ? "new" : null);
  const kinds = useAllowedKinds();

  const upcoming = useMemo(() => upcomingBills(bills, income?.payday ?? null, now, 45), [bills, income, now]);
  const perMonth = bills.reduce((t, b) => t + monthlyCost(b), 0);
  const loans = bills.filter((b) => b.kind === "loan" && b.loan);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:row-span-2">
        <CardTitle action={<AddButton onClick={() => setEditing("new")} label="Add a bill" />}>Coming up</CardTitle>
        {upcoming.length === 0 ? (
          <p className="py-4 text-muted">
            No bills yet. Add rent, utilities, subscriptions, insurance… once, and Meraki keeps track of every due date.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {upcoming.map(({ bill, due }) => {
              const key = paidKey(bill, due);
              const isPaid = !!paid[key];
              const late = !isPaid && dayKey(due) < dayKey(now);
              return (
                <li key={key} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => togglePaid(key)}
                    aria-label={isPaid ? `Mark ${bill.name} as not paid` : `Mark ${bill.name} as paid`}
                    className={`grid size-7 shrink-0 place-items-center rounded-lg border-2 ${
                      isPaid ? "border-sage bg-sage text-white" : "border-line bg-card"
                    }`}
                  >
                    {isPaid && <Icon.check className="size-4" />}
                  </button>
                  <button type="button" onClick={() => setEditing(bill)} className="min-w-0 flex-1 text-left">
                    <span className={`block truncate text-[15px] font-semibold ${isPaid ? "text-muted line-through" : ""}`}>
                      {bill.name}
                    </span>
                    <span className="block text-[13px] text-muted">{BILL_KINDS.find((k) => k.id === bill.kind)?.label}</span>
                  </button>
                  <BillAmount bill={bill} due={due} now={now} isPaid={isPaid} late={late} />

                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {bills.length > 0 && (
        <Card>
          <CardTitle>All bills</CardTitle>
          <p className="text-[15px] text-muted">
            About <strong className="text-ink">{money(perMonth, true)}</strong> a month, with bills that come every few months spread out.
          </p>
          <ul className="mt-2 divide-y divide-line">
            {bills.map((b) => {
              const next = nextDue(b, now);
              const est = billEstimate(b, txns);
              return (
                <li key={b.id}>
                  <button type="button" onClick={() => setEditing(b)} className="flex w-full items-center gap-3 py-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{b.name}</span>
                      <span className="block text-[13px] text-muted">
                        {FREQUENCIES.find((f) => f.id === b.frequency)?.label}
                        {next ? ` · next ${next.toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[15px] font-semibold">{money(est ?? b.amount)}</span>
                      {est !== null && <span className="block text-xs text-muted">from statements</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {has("loans") && loans.length > 0 && (
        <Card>
          <CardTitle>Loans</CardTitle>
          <ul className="divide-y divide-line">
            {loans.map((b) => (
              <LoanRow key={b.id} bill={b} />
            ))}
          </ul>
        </Card>
      )}

      {editing && kinds.length > 0 && <BillSheet bill={editing} onClose={() => setEditing(null)} now={now} />}
    </div>
  );
}

/**
 * The amount for one due date: what was really paid (with the estimate it
 * replaced, so you can see how close it was), or the estimate from past
 * statements, or the usual amount you entered.
 */
function BillAmount({ bill, due, now, isPaid, late }: { bill: Bill; due: Date; now: Date; isPaid: boolean; late: boolean }) {
  const { billActuals, txns } = useFinance();
  const exp = expectedAmount(bill, due, billActuals, txns);
  // Only payments from before this one's matching window (a week either side) count.
  const cutoff = dayKey(new Date(due.getFullYear(), due.getMonth(), due.getDate() - 7));
  const before = billEstimate(bill, txns, cutoff) ?? bill.amount;
  const diff = exp.amount - before;
  return (
    <span className="shrink-0 text-right">
      <span className="block text-[15px] font-semibold">
        {exp.kind === "estimate" ? "~" : ""}
        {money(exp.amount)}
      </span>
      <span className={`block text-xs ${late ? "font-semibold text-peach" : "text-muted"}`}>
        {isPaid ? "Paid" : dueLabel(due, now)}
        {exp.kind === "estimate" && !isPaid ? " · estimate" : ""}
      </span>
      {exp.kind === "actual" && Math.abs(diff) >= 0.5 && (
        <span className={`block text-xs ${diff > 0 ? "text-peach" : "text-sage-dark"}`}>
          estimated {money(before)} ({diff > 0 ? "+" : "−"}
          {money(Math.abs(diff))})
        </span>
      )}
    </span>
  );
}

/** Months left on a loan at this payment and interest rate (standard amortisation). */
function monthsLeft(balance: number, ratePct: number, payment: number) {
  const r = ratePct / 100 / 12;
  if (payment <= 0) return Infinity;
  if (r === 0) return Math.ceil(balance / payment);
  if (payment <= balance * r) return Infinity;
  return Math.ceil(-Math.log(1 - (r * balance) / payment) / Math.log(1 + r));
}

function LoanRow({ bill }: { bill: Bill }) {
  const loan = bill.loan!;
  const monthly = monthlyCost(bill);
  const months = monthsLeft(loan.balance, loan.rate, monthly);
  const interestThisMonth = (loan.balance * loan.rate) / 100 / 12;
  return (
    <li className="py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold">{bill.name}</span>
        <span className="text-[15px] font-semibold">{money(loan.balance, true)} left</span>
      </div>
      <p className="text-[13px] text-muted">
        {loan.rate}% a year · about {money(interestThisMonth)} of this month&apos;s payment is interest ·{" "}
        {Number.isFinite(months)
          ? `paid off in about ${months >= 12 ? `${Math.floor(months / 12)} y ${months % 12} m` : `${months} months`}`
          : "the payment doesn't cover the interest"}
      </p>
    </li>
  );
}

function BillSheet({ bill, onClose, now }: { bill: Bill | "new"; onClose: () => void; now: Date }) {
  const { saveBill, deleteBill } = useFinance();
  const kinds = useAllowedKinds();
  const existing = bill === "new" ? null : bill;

  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<BillKind>(existing?.kind ?? kinds[0].id);
  const [amount, setAmount] = useState<number | null>(existing?.amount ?? null);
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? "monthly");
  const [firstDue, setFirstDue] = useState(existing?.firstDue ?? dayKey(now));
  const [match, setMatch] = useState(existing?.match ?? "");
  const [balance, setBalance] = useState<number | null>(existing?.loan?.balance ?? null);
  const [rate, setRate] = useState<number | null>(existing?.loan?.rate ?? null);

  const valid = name.trim() && amount !== null && amount > 0 && firstDue;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    saveBill({
      id: existing?.id,
      name: name.trim(),
      kind,
      amount: amount!,
      frequency,
      firstDue,
      match: match.trim().toLowerCase() || undefined,
      loan: kind === "loan" && balance !== null ? { balance, rate: rate ?? 0 } : undefined,
    });
    onClose();
  }

  return (
    <Sheet title={existing ? "Edit bill" : "New bill"} onClose={onClose}>
      <form onSubmit={save}>
        <Label>What is it?</Label>
        <input autoFocus={!existing} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rent, EAC, Netflix" className={inputClass} />

        <Label>Type</Label>
        <Chips options={kinds.map((k) => ({ id: k.id, label: k.label }))} value={kind} onChange={setKind} />

        <Label>Amount each time</Label>
        <MoneyInput value={amount} onChange={setAmount} label="Amount" />

        <Label>How often</Label>
        <Chips options={FREQUENCIES} value={frequency} onChange={setFrequency} />

        <Label>A due date (e.g. the next one)</Label>
        <input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} className={inputClass} />

        {kind === "loan" && (
          <>
            <Label>Still to pay back</Label>
            <MoneyInput value={balance} onChange={setBalance} label="Loan balance" />
            <Label>Interest rate (% a year)</Label>
            <input
              inputMode="decimal"
              value={rate ?? ""}
              onChange={(e) => {
                const n = Number(e.target.value.replace(",", "."));
                setRate(e.target.value === "" || !Number.isFinite(n) ? null : n);
              }}
              placeholder="e.g. 4.5"
              className={inputClass}
            />
          </>
        )}

        <Label>How it shows on your bank statement (optional)</Label>
        <input
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          placeholder={name ? name.toLowerCase() : "e.g. electricity authority"}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted">When a statement line contains this, the bill is ticked as paid automatically.</p>

        <PrimaryButton type="submit" disabled={!valid}>
          {existing ? "Save" : "Add bill"}
        </PrimaryButton>
        {existing && (
          <DangerButton
            label="Delete bill"
            onConfirm={() => {
              deleteBill(existing.id);
              onClose();
            }}
          />
        )}
      </form>
    </Sheet>
  );
}
