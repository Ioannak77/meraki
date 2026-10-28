"use client";

import { useMemo, useState } from "react";
import {
  BILL_KINDS,
  FREQUENCIES,
  billEstimate,
  dueDates,
  expectedAmount,
  isBillPaid,
  money,
  monthlyCost,
  needsPaying,
  nextDue,
  paidAutomatically,
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
  return BILL_KINDS.filter((k) => has(k.module) || (k.id === "bill" && has("bills")) || k.id === "subscription");
}

export function dueLabel(d: Date, now: Date) {
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return `${-days} days late`;
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Bill due dates from the start of this pay period to `daysAhead` days from now. Never before the
 * due date you entered: a bill added with its next date in November has no "late" October payment.
 */
export function upcomingBills(bills: Bill[], payday: number | null, now: Date, daysAhead: number) {
  const from = payPeriod(payday ? { amount: 0, payday } : null, now).start;
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead);
  return bills
    .flatMap((b) => dueDates(b, from, to).filter((due) => dayKey(due) >= b.firstDue).map((due) => ({ bill: b, due })))
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}

export function BillsTab({ now, startNew = false }: { now: Date; startNew?: boolean }) {
  const { bills, paid, togglePaid, income, has, txns, billActuals } = useFinance();
  const [editing, setEditing] = useState<Bill | "new" | "newSub" | null>(startNew ? "new" : null);
  // Phones show one list at a time; iPad shows them side by side.
  const [view, setView] = useState<"pay" | "all" | "subs">("pay");
  const [showPaid, setShowPaid] = useState(false);
  const kinds = useAllowedKinds();

  // To pay lists only the bills you pay yourself; ones paid automatically just happen.
  const toPay = useMemo(() => bills.filter(needsPaying), [bills]);
  const payBills = bills.filter((b) => b.kind !== "subscription");
  const subs = bills.filter((b) => b.kind === "subscription");
  const upcoming = useMemo(() => upcomingBills(toPay, income?.payday ?? null, now, 45), [toPay, income, now]);
  const period = payPeriod(income?.payday ? { amount: 0, payday: income.payday } : null, now);
  const today = dayKey(now);
  const weekEnd = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6));
  const periodEnd = dayKey(period.end);
  const amountOf = (bill: Bill, due: Date) => expectedAmount(bill, due, billActuals, txns).amount;
  const isPaid = (bill: Bill, due: Date) => isBillPaid(bill, due, paid, now);

  // To pay: everything late, then each bill once, at its next unpaid date.
  const late = upcoming.filter(({ bill, due }) => !isPaid(bill, due) && dayKey(due) < today);
  const seen = new Set<string>();
  const next = upcoming.filter(({ bill, due }) => {
    if (isPaid(bill, due) || dayKey(due) < today || seen.has(bill.id)) return false;
    seen.add(bill.id);
    return true;
  });
  const sections: { title: string; items: typeof upcoming; tone?: string }[] = [
    { title: "Late", items: late, tone: "text-peach" },
    { title: "This week", items: next.filter(({ due }) => dayKey(due) <= weekEnd) },
    {
      title: income?.payday ? "Before payday" : "Rest of this month",
      items: next.filter(({ due }) => dayKey(due) > weekEnd && dayKey(due) <= periodEnd),
    },
    { title: income?.payday ? "After payday" : "Next month", items: next.filter(({ due }) => dayKey(due) > weekEnd && dayKey(due) > periodEnd) },
  ].filter((s) => s.items.length > 0);

  // This pay period (or month): how much is due, and how much of it is paid.
  const inPeriod = upcoming.filter(({ due }) => dayKey(due) <= periodEnd);
  const paidInPeriod = inPeriod.filter(({ bill, due }) => isPaid(bill, due));
  const periodTotal = inPeriod.reduce((t, { bill, due }) => t + amountOf(bill, due), 0);
  const periodPaid = paidInPeriod.reduce((t, { bill, due }) => t + amountOf(bill, due), 0);

  const perMonth = payBills.reduce((t, b) => t + monthlyCost(b), 0);
  const subsPerMonth = subs.reduce((t, b) => t + monthlyCost(b), 0);
  const loans = bills.filter((b) => b.kind === "loan" && b.loan);
  const byKind = BILL_KINDS.map((k) => ({ kind: k, list: payBills.filter((b) => b.kind === k.id) })).filter((g) => g.list.length > 0);

  const row = ({ bill, due }: { bill: Bill; due: Date }) => {
    const key = paidKey(bill, due);
    const done = !!paid[key];
    return (
      <li key={key} className="flex items-center gap-3 py-2.5">
        <button
          type="button"
          onClick={() => togglePaid(key)}
          aria-label={done ? `Mark ${bill.name} as not paid` : `Mark ${bill.name} as paid`}
          className={`grid size-8 shrink-0 place-items-center rounded-lg border-2 transition-[color,background-color,border-color,transform] ${
            done ? "animate-pop border-sage bg-sage text-white" : "border-line bg-card"
          }`}
        >
          {done && <Icon.check className="size-4" />}
        </button>
        <button type="button" onClick={() => setEditing(bill)} className="min-w-0 flex-1 text-left">
          <span className={`block truncate text-[15px] font-semibold ${done ? "text-muted line-through" : ""}`}>{bill.name}</span>
          <span className="block truncate text-[13px] text-muted">{BILL_KINDS.find((k) => k.id === bill.kind)?.label}</span>
        </button>
        <BillAmount bill={bill} due={due} now={now} isPaid={done} late={!done && dayKey(due) < today} />
      </li>
    );
  };

  const tabs: [typeof view, string][] = [
    ["pay", "To pay"],
    ["all", "All bills"],
    ["subs", "Subscriptions"],
  ];

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      {bills.length > 0 && (
        <div className="flex rounded-2xl bg-line/60 p-1 lg:hidden" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-[color,background-color,transform] ${
                view === id ? "bg-card text-ink shadow-sm" : "text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <Card className={`lg:row-span-2 ${view === "pay" ? "" : "hidden lg:block"}`}>
        <CardTitle action={<AddButton onClick={() => setEditing("new")} label="Add a bill" />}>To pay</CardTitle>
        {toPay.length === 0 ? (
          <p className="py-4 text-muted">
            No bills yet. Add rent, utilities, insurance… once, and Meraki keeps track of every due date.
          </p>
        ) : (
          <>
            {periodTotal > 0 && (
              <div className="mb-1 rounded-2xl bg-cream p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-muted">{income?.payday ? "Left to pay before payday" : "Left to pay this month"}</span>
                  <span className="text-[17px] font-bold">{money(periodTotal - periodPaid)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-sage transition-[width] duration-300 ease-out"
                    style={{ width: `${(periodPaid / periodTotal) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {paidInPeriod.length} of {inPeriod.length} paid · {money(periodPaid)} of {money(periodTotal)}
                </p>
              </div>
            )}

            {sections.length === 0 && <p className="py-3 text-[15px] text-muted">Nothing left to pay for now.</p>}
            {sections.map((s) => (
              <section key={s.title} className="mt-3">
                <h3 className={`text-xs font-bold uppercase tracking-wide ${s.tone ?? "text-muted"}`}>
                  {s.title} · {money(s.items.reduce((t, { bill, due }) => t + amountOf(bill, due), 0))}
                </h3>
                <ul className="divide-y divide-line">{s.items.map(row)}</ul>
              </section>
            ))}

            {paidInPeriod.length > 0 && (
              <section className="mt-3 border-t border-line pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaid(!showPaid)}
                  aria-expanded={showPaid}
                  className="flex w-full items-center gap-2 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-muted"
                >
                  <span className={`transition-transform duration-200 ease-out ${showPaid ? "rotate-90" : ""}`}>›</span>
                  Paid {income?.payday ? "this pay period" : "this month"} ({paidInPeriod.length})
                </button>
                {showPaid && <ul className="animate-reveal divide-y divide-line">{paidInPeriod.map(row)}</ul>}
              </section>
            )}
          </>
        )}
      </Card>

      {payBills.length > 0 && (
        <Card className={view === "all" ? "" : "hidden lg:block"}>
          <CardTitle action={<AddButton onClick={() => setEditing("new")} label="Add a bill" />}>All bills</CardTitle>
          <p className="text-[15px] text-muted">
            About <strong className="text-ink">{money(perMonth, true)}</strong> a month, with bills that come every few months spread out
            {subs.length > 0 ? `, plus ${money(subsPerMonth, true)} in subscriptions` : ""}.
          </p>
          {byKind.map(({ kind, list }) => (
            <section key={kind.id} className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
                {kind.label} · {money(list.reduce((t, b) => t + monthlyCost(b), 0), true)} a month
              </h3>
              <ul className="divide-y divide-line">
                {list.map((b) => {
                  const nextDate = nextDue(b, now);
                  const est = billEstimate(b, txns);
                  return (
                    <li key={b.id}>
                      <button type="button" onClick={() => setEditing(b)} className="flex w-full items-center gap-3 py-2.5 text-left">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">{b.name}</span>
                          <span className="block truncate text-[13px] text-muted">
                            {FREQUENCIES.find((f) => f.id === b.frequency)?.label}
                            {paidAutomatically(b) ? " · automatic" : ""}
                            {nextDate ? ` · next ${nextDate.toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}
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
            </section>
          ))}
        </Card>
      )}

      {bills.length > 0 && (
        <Card className={view === "subs" ? "" : "hidden lg:block"}>
          <CardTitle action={<AddButton onClick={() => setEditing("newSub")} label="Add a subscription" />}>Subscriptions</CardTitle>
          {subs.length === 0 ? (
            <p className="text-[15px] text-muted">None yet. Add Netflix, Spotify, the gym… to see what they cost you in a year.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl bg-cream px-2 py-3">
                  <p className="text-[17px] font-bold">{money(subsPerMonth)}</p>
                  <p className="text-xs text-muted">a month</p>
                </div>
                <div className="rounded-2xl bg-cream px-2 py-3">
                  <p className="text-[17px] font-bold">{money(subsPerMonth * 12, true)}</p>
                  <p className="text-xs text-muted">a year</p>
                </div>
              </div>
              <ul className="mt-2 divide-y divide-line">
                {[...subs]
                  .sort((a, b) => monthlyCost(b) - monthlyCost(a))
                  .map((b) => {
                    const nextDate = nextDue(b, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
                    const est = billEstimate(b, txns);
                    const each = est ?? b.amount;
                    return (
                      <li key={b.id}>
                        <button type="button" onClick={() => setEditing(b)} className="flex w-full items-center gap-3 py-2.5 text-left">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold">{b.name}</span>
                            <span className="block truncate text-[13px] text-muted">
                              {money(each)} {FREQUENCIES.find((f) => f.id === b.frequency)?.label.toLowerCase()}
                              {nextDate ? ` · next ${nextDate.toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-[15px] font-semibold">{money(monthlyCost({ ...b, amount: each }) * 12, true)}</span>
                            <span className="block text-xs text-muted">a year</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
              <p className="mt-2 text-xs text-muted">
                Subscriptions paid automatically count as paid on their date. If one fails, it won&apos;t be on your statement.
              </p>
            </>
          )}
        </Card>
      )}

      {has("loans") && loans.length > 0 && (
        <Card className={view === "all" ? "" : "hidden lg:block"}>
          <CardTitle>Loans</CardTitle>
          <ul className="divide-y divide-line">
            {loans.map((b) => (
              <LoanRow key={b.id} bill={b} />
            ))}
          </ul>
        </Card>
      )}

      {editing && kinds.length > 0 && (
        <BillSheet
          bill={editing === "newSub" ? "new" : editing}
          startKind={editing === "newSub" ? "subscription" : undefined}
          onClose={() => setEditing(null)}
          now={now}
        />
      )}
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

function BillSheet({ bill, startKind, onClose, now }: { bill: Bill | "new"; startKind?: BillKind; onClose: () => void; now: Date }) {
  const { saveBill, deleteBill } = useFinance();
  const kinds = useAllowedKinds();
  const existing = bill === "new" ? null : bill;

  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<BillKind>(existing?.kind ?? startKind ?? kinds.find((k) => k.id !== "subscription")?.id ?? kinds[0].id);
  const [amount, setAmount] = useState<number | null>(existing?.amount ?? null);
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? "monthly");
  const [firstDue, setFirstDue] = useState(existing?.firstDue ?? dayKey(now));
  const [match, setMatch] = useState(existing?.match ?? "");
  const [balance, setBalance] = useState<number | null>(existing?.loan?.balance ?? null);
  const [rate, setRate] = useState<number | null>(existing?.loan?.rate ?? null);
  // Until you tick or untick it, follows the type: subscriptions start ticked.
  const [autoChoice, setAutoChoice] = useState<boolean | null>(existing?.auto ?? null);
  const auto = autoChoice ?? kind === "subscription";

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
      auto,
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

        <label className="mt-4 flex items-start gap-3 rounded-2xl bg-cream p-3.5">
          <input type="checkbox" checked={auto} onChange={(e) => setAutoChoice(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-sage" />
          <span>
            <span className="block text-[15px] font-semibold">Paid automatically</span>
            <span className="block text-xs text-muted">
              Direct debit or card. It counts as paid on its date, so it stays out of To pay and reminders.
            </span>
          </span>
        </label>

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
        <p className="mt-1 text-xs text-muted">When a statement line contains this, Meraki ticks the bill off for you.</p>

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
