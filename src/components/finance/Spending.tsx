"use client";

import Link from "next/link";
import { useState } from "react";
import {
  afterPaybacks,
  netCost,
  paidBackByHash,
  allCategories,
  billKeyword,
  isBillCategory,
  paidKey,
  canLower,
  effectiveBudgets,
  tidy,
  monthStats,
  category,
  inRange,
  money,
  monthRange,
  ruleKeyword,
  type CategoryId,
  type Txn,
} from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { LineDetails, PaybackPicker, paybacksFor, shortDate } from "./Paybacks";
import { CategorySelect } from "./CategorySelect";
import { dayKey } from "@/lib/store";
import { NewChip } from "../NewChip";
import { AllowanceBody, AmountSheet } from "./Budgets";
import { Bar, Card, CardTitle, DangerButton, Label, MoneyInput, PrimaryButton, Sheet, inputClass } from "./ui";

/** Money spent per counted category in a date range (positive numbers). */
export function spendingByCategory(txns: Txn[], start: Date, end: Date) {
  const totals = new Map<CategoryId, number>();
  for (const t of afterPaybacks(txns)) {
    if (t.amount >= 0 || !category(t.category).counts || !inRange(t.date, start, end)) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) - t.amount);
  }
  return totals;
}

export function SpendingTab({ now }: { now: Date }) {
  const { txns, budgets, has, rules, deleteRule, setBudget, addCategory, weeklyAllowance, setWeeklyAllowance } = useFinance();
  const [editingBudget, setEditingBudget] = useState<CategoryId | "allowance" | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Txn | null>(null);

  const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const { start, end } = monthRange(monthDate);
  const totals = spendingByCategory(txns, start, end);
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  const lines = txns.filter((t) => inRange(t.date, start, end)).sort((a, b) => b.date.localeCompare(a.date));
  const back = paidBackByHash(txns);
  const stats = monthStats(txns, now);
  const eff = effectiveBudgets(budgets, stats);
  const isThisMonth = monthOffset === 0;
  // A weekly allowance close to what the statements show you usually spend.
  const usual = [...stats.avg.values()].reduce((a, v) => a + v, 0);
  const suggestedAllowance = stats.months.length ? tidy((usual * 12) / 52) : null;
  const rows = allCategories().filter((c) => c.counts && (totals.get(c.id) || eff.has(c.id))).sort(
    (a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0),
  );

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <div className="flex gap-2 lg:col-span-2">
        {has("imports") && (
          <Link href="/finances/import/" className="flex-1 rounded-2xl bg-sage-dark py-3.5 text-center font-bold text-white">
            Import statements
          </Link>
        )}
        <button type="button" onClick={() => setAdding(true)} className="flex-1 rounded-2xl bg-card py-3.5 font-bold">
          + Add spending
        </button>
      </div>

      {has("allowance") && (
        <Card className="lg:col-span-2">
          <CardTitle
            action={
              <button type="button" onClick={() => setEditingBudget("allowance")} className="text-sm font-semibold text-sage-dark">
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
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setMonthOffset((m) => m - 1)} aria-label="Previous month" className="px-2 text-xl text-muted">
            ‹
          </button>
          <h2 className="text-lg font-bold">
            {monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
            aria-label="Next month"
            disabled={monthOffset === 0}
            className="px-2 text-xl text-muted disabled:opacity-30"
          >
            ›
          </button>
        </div>
        <p className="text-[15px] text-muted">
          Spent <strong className="text-ink">{money(total)}</strong> (bills and transfers not included). Tap a category to set its
          budget.
        </p>
        {rows.length === 0 ? (
          <p className="py-4 text-muted">Nothing yet this month.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {rows.map((c) => {
              const spent = totals.get(c.id) ?? 0;
              const b = eff.get(c.id);
              const budget = b?.amount;
              const lower = isThisMonth && b ? canLower(stats, c.id, b.amount) : null;
              return (
                <li key={c.id}>
                  {/* Tap a category to set its monthly budget. */}
                  <button type="button" onClick={() => setEditingBudget(c.id)} className="w-full text-left">
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-[15px]">
                      <span className="font-semibold">
                        {c.label}
                        {b && (
                          <span className="ml-2 rounded-full bg-cream px-2 py-0.5 text-[11px] font-semibold text-muted">
                            {b.auto ? "Auto" : "Yours"}
                          </span>
                        )}
                      </span>
                      <span className={budget && spent > budget ? "font-semibold text-peach" : ""}>
                        {money(spent)}
                        {budget ? <span className="text-muted"> / {money(budget, true)}</span> : null}
                      </span>
                    </div>
                    <Bar value={spent} max={budget ?? Math.max(1, ...totals.values())} color={c.color} />
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
        )}
        <div className="mt-4">
          <NewChip placeholder="New category, e.g. Gifts" onAdd={(name) => setEditingBudget(addCategory(name))} />
        </div>
      </Card>

      <Card>
        <CardTitle>Transactions</CardTitle>
        {lines.length === 0 ? (
          <p className="py-4 text-muted">
            {has("imports") ? "Import a statement or add spending by hand." : "Add spending as you go."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map((t) => {
              const c = category(t.category);
              const cost = t.amount < 0 ? netCost(t, back) : 0;
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => setEditing(t)} className="flex w-full items-center gap-3 py-3 text-left">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{t.description}</span>
                      <span className="block text-[13px] text-muted">
                        {new Date(t.date + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })} ·{" "}
                        {c.label}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`block text-[15px] font-semibold ${t.amount > 0 ? "text-sage-dark" : ""}`}>
                        {t.amount > 0 ? "+" : ""}
                        {money(t.amount)}
                      </span>
                      {t.amount < 0 && cost < -t.amount - 0.005 && <span className="block text-xs text-sage-dark">you paid {money(cost)}</span>}
                      {t.category === "paid_back" && !t.backFor && <span className="block text-xs text-peach">which payment?</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {rules.length > 0 && (
        <Card className="lg:col-span-2">
          <CardTitle>Mappings</CardTitle>
          <p className="mb-2 text-sm text-muted">Lines containing this text always get this category. Tap ✕ to forget one.</p>
          <ul className="divide-y divide-line">
            {rules.map((r) => (
              <li key={r.match} className="flex items-center gap-3 py-2.5 text-[15px]">
                <span className="min-w-0 flex-1 truncate">“{r.match}”</span>
                <span className="shrink-0 text-muted">→ {category(r.category).label}</span>
                <button type="button" onClick={() => deleteRule(r.match)} aria-label={`Forget ${r.match}`} className="shrink-0 px-2 text-muted">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {adding && <AddSpendingSheet onClose={() => setAdding(false)} now={now} />}
      {editing && <TxnSheet txn={editing} onClose={() => setEditing(null)} />}
      {editingBudget && (
        <AmountSheet
          title={editingBudget === "allowance" ? "Weekly allowance" : `${category(editingBudget).label} budget`}
          hint={editingBudget === "allowance" ? "For day-to-day spending, Monday to Sunday." : "Per month. Remove it to go back to automatic."}
          value={editingBudget === "allowance" ? weeklyAllowance : (budgets[editingBudget] ?? null)}
          onSave={(v) => (editingBudget === "allowance" ? setWeeklyAllowance(v) : setBudget(editingBudget, v))}
          onClose={() => setEditingBudget(null)}
        />
      )}
    </div>
  );
}

/** A bill name from a bank line ("NETFLIX.COM 866-579" -> "Netflix"). */
function billNameFrom(description: string) {
  return ruleKeyword(description).replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TxnSheet({ txn, onClose }: { txn: Txn; onClose: () => void }) {
  const { setTxnCategory, patchTxn, deleteTxn, bills, saveBill, paid, togglePaid, txns } = useFinance();
  const [cat, setCat] = useState<CategoryId>(txn.category);
  const [showDetails, setShowDetails] = useState(false);
  // Paid back: on a payment, cash friends gave you; on money in, the payment it was for.
  const [cash, setCash] = useState<number | null>(txn.cashBack ?? null);
  const [backFor, setBackFor] = useState<string | undefined>(txn.backFor);
  const [linking, setLinking] = useState(false);
  const linked = txn.amount < 0 ? txns.filter((t) => t.backFor === txn.hash && t.amount > 0) : [];
  const viaBank = linked.reduce((s, t) => s + t.amount, 0);
  const cost = Math.max(0, -txn.amount - viaBank - (cash ?? 0));
  const canLink =
    txn.amount < 0 && linking
      ? paybacksFor(
          txn,
          txns.filter((t) => t.category !== "transfer" && (!t.backFor || t.backFor === txn.hash) && !linked.includes(t)),
        )
      : [];
  const [remember, setRemember] = useState(txn.source === "import");
  const [match, setMatch] = useState(ruleKeyword(txn.description));
  // A bill or subscription that isn't in Bills yet can be added from here.
  const text = txn.description.toLowerCase();
  const knownBill = bills.find((b) => text.includes(billKeyword(b)));
  const billable = txn.amount < 0 && isBillCategory(cat) && !knownBill;
  const [addBill, setAddBill] = useState(true);
  const [billName, setBillName] = useState(billNameFrom(txn.description));
  const [frequency, setFrequency] = useState<"monthly" | "yearly">("monthly");
  const date = new Date(txn.date + "T12:00:00");

  function save() {
    setTxnCategory(txn.id, cat, remember && match.trim() ? match : undefined);
    if (txn.amount < 0 && (cash ?? 0) !== (txn.cashBack ?? 0)) patchTxn(txn.id, { cashBack: cash || null });
    if (txn.amount > 0) patchTxn(txn.id, { backFor: cat === "paid_back" && backFor ? backFor : null });
    if (billable && addBill && billName.trim()) {
      const bill = {
        name: billName.trim(),
        kind: cat === "subscriptions" ? ("subscription" as const) : ("bill" as const),
        amount: -txn.amount,
        frequency,
        firstDue: txn.date,
        match: ruleKeyword(txn.description),
      };
      const id = saveBill(bill);
      // This payment is that bill, paid.
      const key = paidKey({ ...bill, id }, new Date(date.getFullYear(), date.getMonth(), date.getDate()));
      if (!paid[key]) togglePaid(key);
    }
    onClose();
  }

  return (
    <Sheet title={txn.amount > 0 ? "Money in" : "Payment"} onClose={onClose}>
      <div className="rounded-2xl bg-cream px-4 py-5 text-center">
        <p className={`text-[30px] font-bold leading-none ${txn.amount > 0 ? "text-sage-dark" : ""}`}>{money(txn.amount)}</p>
        <p className="mt-2 break-words text-[16px] font-semibold">{txn.description}</p>
        <p className="mt-0.5 text-[13px] text-muted">
          {date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long" })} ·{" "}
          {txn.source === "import" ? `from your ${txn.account ? `${txn.account} ` : ""}statement` : "added by you"}
        </p>
        {txn.source === "import" && (
          <button type="button" onClick={() => setShowDetails(!showDetails)} className="mt-2 text-[13px] font-semibold text-sage-dark">
            {showDetails ? "Hide details" : "All details"}
          </button>
        )}
      </div>
      {showDetails && (
        <div className="animate-reveal mt-2">
          <LineDetails date={txn.date} amount={txn.amount} description={txn.description} account={txn.account} details={txn.details} />
          {!txn.details?.length && (
            <p className="mt-1 text-xs text-muted">Statements imported before 28 Oct 2026 only kept the date, amount and description.</p>
          )}
        </div>
      )}

      <Label>Category</Label>
      <CategorySelect value={cat} onChange={setCat} filter={(c) => txn.amount > 0 || (c.id !== "income" && c.id !== "paid_back")} />

      {txn.amount > 0 && cat === "paid_back" && (
        <PaybackPicker payback={txn} pool={txns.filter((t) => t.amount < 0 && t.category !== "transfer")} value={backFor} onChange={setBackFor} />
      )}

      {txn.amount < 0 && (
        <div className="mt-3 rounded-2xl border border-line p-3.5">
          <p className="text-[15px] font-semibold">Paid back by friends</p>
          {viaBank + (cash ?? 0) > 0 ? (
            <p className="text-[13px] text-sage-dark">
              You paid {money(-txn.amount)}, {money(viaBank + (cash ?? 0))} came back, so it cost you <strong>{money(cost)}</strong>.
            </p>
          ) : (
            <p className="text-[13px] text-muted">Did friends pay you their share? Only what it really cost you counts as spending.</p>
          )}
          {linked.length > 0 && (
            <ul className="mt-2 divide-y divide-line">
              {linked.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2 text-[14px]">
                  <span className="w-12 shrink-0 text-xs text-muted">{shortDate(t.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{t.description}</span>
                  <span className="shrink-0 font-semibold text-sage-dark">+{money(t.amount)}</span>
                  <button type="button" onClick={() => patchTxn(t.id, { backFor: null })} aria-label={`Unlink ${t.description}`} className="shrink-0 px-1 text-muted">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!linking ? (
            <button type="button" onClick={() => setLinking(true)} className="mt-2 text-[13px] font-semibold text-sage-dark">
              + Link money you received for it
            </button>
          ) : canLink.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted">No money in of {money(-txn.amount)} or less in the 60 days after this.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {canLink.slice(0, 8).map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => patchTxn(t.id, { backFor: txn.hash, category: "paid_back" })}
                    className="flex w-full items-center gap-3 rounded-xl bg-cream px-3 py-2 text-left"
                  >
                    <span className="w-12 shrink-0 text-xs text-muted">{shortDate(t.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px]">{t.description}</span>
                    <span className="shrink-0 text-[14px] font-semibold text-sage-dark">+{money(t.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[13px] text-muted">Paid back in cash</p>
          <MoneyInput value={cash} onChange={setCash} label="Paid back in cash" />
        </div>
      )}

      {knownBill && isBillCategory(cat) && <p className="mt-2 text-[13px] text-muted">This is your bill “{knownBill.name}”.</p>}

      {billable && (
        <div className="mt-3 rounded-2xl border border-line p-3.5">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={addBill} onChange={(e) => setAddBill(e.target.checked)} className="size-5 accent-[var(--color-sage-dark)]" />
            <span className="text-[15px] font-semibold">Add to Bills</span>
          </label>
          <p className="mt-1 text-[13px] text-muted">You&apos;ll see it coming, and it&apos;s ticked as paid when it shows on a statement.</p>
          {addBill && (
            <div className="mt-3 flex gap-2">
              <input value={billName} onChange={(e) => setBillName(e.target.value)} aria-label="Bill name" className={inputClass} />
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as "monthly" | "yearly")}
                aria-label="How often"
                className="shrink-0 rounded-2xl border border-line bg-cream px-3 text-base"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}
        </div>
      )}

      <label className="mt-5 flex items-start gap-3">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-sage-dark)]" />
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">Remember for next time</span>
          <span className="block text-[13px] text-muted">Every payment with this word gets the same category:</span>
        </span>
      </label>
      {remember && (
        <input
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          aria-label="Word to match"
          className="ml-8 mt-2 w-[calc(100%-2rem)] rounded-xl border border-line bg-cream px-3 py-2 text-[15px]"
        />
      )}

      <PrimaryButton onClick={save}>Save</PrimaryButton>
      <DangerButton
        label="Delete transaction"
        onConfirm={() => {
          deleteTxn(txn.id);
          onClose();
        }}
      />
    </Sheet>
  );
}

/** `only` limits the category choice (a Tracker adds into its own categories). */
export function AddSpendingSheet({ onClose, now, only }: { onClose: () => void; now: Date; only?: CategoryId[] }) {
  const { addTxn, has } = useFinance();
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [cat, setCat] = useState<CategoryId>(only?.[0] ?? (has("groceries") ? "groceries" : "other"));
  const [date, setDate] = useState(dayKey(now));
  const valid = amount !== null && amount > 0;

  return (
    <Sheet title="Add spending" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          addTxn({ date, description: description.trim() || category(cat).label, amount: -amount!, category: cat });
          onClose();
        }}
      >
        <Label>How much?</Label>
        <MoneyInput value={amount} onChange={setAmount} autoFocus label="Amount" />
        <Label>On what? (optional)</Label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Lidl" className={inputClass} />
        <Label>Category</Label>
        <CategorySelect value={cat} onChange={setCat} filter={(c) => (only ? only.includes(c.id) : c.counts)} allowNew={!only} />
        <Label>Date</Label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        <PrimaryButton type="submit" disabled={!valid}>
          Add
        </PrimaryButton>
      </form>
    </Sheet>
  );
}
