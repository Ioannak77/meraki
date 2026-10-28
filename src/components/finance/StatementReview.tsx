"use client";

// After the statements are read: one page to check them before they're added. Most lines arrive already
// sorted (your own rules, your bills, Claude's suggestion for a PDF, then the starter keywords), so
// this only asks about what's left, offers to file a trip under Travel, to add subscriptions to Bills,
// and which money in was friends paying you back. Tap any line for everything the statement says about it.

import { useMemo, useState } from "react";
import {
  billKeyword,
  categorise,
  category,
  isBillCategory,
  money,
  ruleKeyword,
  type CategoryId,
  txnHash,
  type ParsedLine,
  type Rule,
} from "@/lib/finance";
import { useFinance, type NewBill } from "@/lib/financeStore";
import { Icon } from "../icons";
import { CategorySelect } from "./CategorySelect";
import { LineDetails, PaybackPicker, shortDate, type Candidate } from "./Paybacks";
import { PrimaryButton } from "./ui";

type Sorted = ParsedLine & { category: CategoryId };

/** Your rules first, then transfers and bills, then the reader's suggestion, then the starter keywords. */
function firstGuess(l: ParsedLine, rules: Rule[], bills: Parameters<typeof categorise>[3]): CategoryId {
  const text = l.description.toLowerCase();
  const rule = rules.find((r) => text.includes(r.match));
  if (rule) return rule.category;
  if (l.transfer) return "transfer";
  const bill = l.amount < 0 ? bills.find((b) => text.includes(billKeyword(b))) : undefined;
  if (bill) return bill.kind === "subscription" ? "subscriptions" : "bills";
  if (l.suggested === "paid_back") return l.amount > 0 ? "paid_back" : categorise(l.description, l.amount, [], bills);
  if (l.suggested && l.suggested !== "other") return l.suggested;
  return categorise(l.description, l.amount, [], bills);
}

/** A tidy bill name from a bank line ("NETFLIX.COM 866-579" -> "Netflix"). */
function billName(description: string) {
  return ruleKeyword(description).replace(/\b\w/g, (c) => c.toUpperCase());
}

function CategoryPicker({ value, onPick, allowIncome }: { value: CategoryId; onPick: (c: CategoryId) => void; allowIncome: boolean }) {
  return (
    <div className="animate-reveal mt-2">
      <CategorySelect value={value} onChange={onPick} filter={(c) => allowIncome || (c.id !== "income" && c.id !== "paid_back")} />
    </div>
  );
}

export function StatementReview({
  sources,
  lines,
  onImport,
  onBack,
}: {
  sources: string[];
  lines: ParsedLine[];
  onImport: (lines: Sorted[], rules: Rule[], bills: NewBill[]) => void;
  onBack: () => void;
}) {
  const { rules, bills, txns } = useFinance();
  const [links, setLinks] = useState<Record<number, string>>({}); // paid back: line -> hash of the payment it's for
  const guesses = useMemo(() => lines.map((l) => firstGuess(l, rules, bills)), [lines, rules, bills]);
  const [picked, setPicked] = useState<Record<number, CategoryId>>({}); // your changes, by line
  const [open, setOpen] = useState<string | null>(null); // the row whose picker is showing
  const [remember, setRemember] = useState<Record<string, boolean>>({}); // per shop: make a rule (default yes)
  const [openGroup, setOpenGroup] = useState<CategoryId | null>(null);

  // A trip: several payments abroad. Filed under Travel unless you say no.
  const abroad = lines.map((l, i) => i).filter((i) => lines[i].abroad && lines[i].amount < 0 && !lines[i].transfer);
  const trip = abroad.length >= 2 ? abroad : [];
  const [tripAsTravel, setTripAsTravel] = useState(true);

  // Subscriptions that aren't a bill yet, once per shop.
  const subs = useMemo(() => {
    const out = new Map<string, { i: number; name: string; amount: number; frequency: "monthly" | "yearly" }>();
    lines.forEach((l, i) => {
      if (!l.subscription || l.amount >= 0) return;
      const text = l.description.toLowerCase();
      if (bills.some((b) => text.includes(billKeyword(b)))) return;
      const key = ruleKeyword(l.description);
      if (!out.has(key)) out.set(key, { i, name: billName(l.description), amount: -l.amount, frequency: l.subscription });
    });
    return [...out.entries()].map(([match, s]) => ({ match, ...s }));
  }, [lines, bills]);
  const [addSub, setAddSub] = useState<Record<string, boolean>>({}); // default yes

  const subOn = (match: string) => addSub[match] ?? true;
  const finalCategory = (i: number): CategoryId => {
    if (picked[i]) return picked[i];
    const l = lines[i];
    const sub = subs.find((s) => s.match === ruleKeyword(l.description));
    if (l.subscription && sub && subOn(sub.match)) return "subscriptions";
    if (tripAsTravel && trip.includes(i) && !isBillCategory(guesses[i])) return "travel";
    return guesses[i];
  };
  const final = lines.map((l, i) => {
    const category = finalCategory(i);
    return { ...l, category, backFor: category === "paid_back" && links[i] ? links[i] : undefined };
  });

  // Payments a payback can be for: this import's and the ones already in Finances.
  const pool: Candidate[] = useMemo(
    () => [
      ...lines.filter((l) => l.amount < 0 && !l.transfer).map((l) => ({ ...l, hash: txnHash(l.date, l.amount, l.description) })),
      ...txns.filter((t) => t.amount < 0 && t.category !== "transfer"),
    ],
    [lines, txns],
  );
  // Money in: pay, refunds, friends paying you back, or a move from your own account. "Transfer from Maria"
  // can look like any of them, so each one is shown with the choice.
  const moneyIn = lines.map((l, i) => i).filter((i) => lines[i].amount > 0);

  // Still "Other": grouped by shop, so each one is decided once. (A trip's payments are already sorted.)
  const tripSorted = tripAsTravel ? trip : [];
  const unsorted = (() => {
    const groups = new Map<string, { match: string; sample: string; idx: number[]; total: number }>();
    lines.forEach((l, i) => {
      if (guesses[i] !== "other" || l.amount > 0 || tripSorted.includes(i)) return;
      const match = ruleKeyword(l.description);
      const g = groups.get(match) ?? { match, sample: l.description, idx: [], total: 0 };
      g.idx.push(i);
      g.total += l.amount;
      groups.set(match, g);
    });
    return [...groups.values()];
  })();
  const stillOther = unsorted.filter((g) => g.idx.every((i) => final[i].category === "other"));

  // Everything else, by category.
  const groups = new Map<CategoryId, number[]>();
  final.forEach((l, i) => groups.set(l.category, [...(groups.get(l.category) ?? []), i]));
  const size = (ids: number[]) => ids.reduce((t, i) => t + Math.abs(final[i].amount), 0);
  const byCategory = [...groups.entries()].sort((a, b) => size(b[1]) - size(a[1]));

  const out = final.filter((l) => l.amount < 0 && l.category !== "transfer").reduce((t, l) => t - l.amount, 0);
  const into = final.filter((l) => l.amount > 0 && l.category !== "transfer").reduce((t, l) => t + l.amount, 0);
  const dates = lines.map((l) => l.date).sort();

  function pickGroup(idx: number[], c: CategoryId) {
    setPicked((p) => ({ ...p, ...Object.fromEntries(idx.map((i) => [i, c])) }));
    setOpen(null);
  }

  function save() {
    const newRules: Rule[] = unsorted
      .filter((g) => (remember[g.match] ?? true) && final[g.idx[0]].category !== "other")
      .map((g) => ({ match: g.match, category: final[g.idx[0]].category }));
    const newBills: NewBill[] = subs
      .filter((s) => subOn(s.match))
      .map((s) => ({
        name: s.name,
        kind: "subscription",
        amount: s.amount,
        frequency: s.frequency,
        firstDue: lines[s.i].date,
        match: s.name.toLowerCase(),
      }));
    onImport(final, newRules, newBills);
  }

  const row = (i: number) => {
    const l = final[i];
    const c = category(l.category);
    const key = `line-${i}`;
    return (
      <li key={key} className="py-2">
        <button type="button" onClick={() => setOpen(open === key ? null : key)} className="flex w-full items-center gap-3 text-left">
          <span className="w-12 shrink-0 text-xs text-muted">{shortDate(l.date)}</span>
          <span className="min-w-0 flex-1 truncate text-[14px]">{l.description}</span>
          <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} aria-label={c.label} />
          <span className={`shrink-0 text-[14px] font-semibold ${l.amount > 0 ? "text-sage-dark" : ""}`}>{money(l.amount)}</span>
        </button>
        {open === key && lineOpen(i)}
      </li>
    );
  };

  // A line, opened: everything the statement says, its category, and for a payback, what it was for.
  function lineOpen(i: number) {
    const l = final[i];
    const notes = [
      l.transfer ? "Between your own accounts" : "",
      l.abroad ? "Paid abroad" : "",
      l.subscription ? `Looks like a ${l.subscription} subscription` : "",
    ].filter(Boolean);
    return (
      <div className="animate-reveal mt-2 space-y-2">
        <LineDetails date={l.date} amount={l.amount} description={l.description} account={l.account} details={l.details} notes={notes} />
        <CategoryPicker
          value={l.category}
          allowIncome={l.amount > 0}
          onPick={(cat) => setPicked((p) => ({ ...p, [i]: cat }))}
        />
        {l.category === "paid_back" && (
          <PaybackPicker payback={l} pool={pool} value={links[i]} onChange={(h) => setLinks((x) => ({ ...x, [i]: h ?? "" }))} />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* What came in */}
      <div className="rounded-2xl bg-cream p-3.5">
        <p className="text-[13px] text-muted">
          {sources.length > 1 ? `${sources.length} statements: ${sources.join(", ")}` : sources[0]} ·{" "}
          {dates.length ? `${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}` : ""}
        </p>
        <p className="mt-0.5 text-[17px] font-bold">{lines.length} transactions</p>
        <p className="text-[13px] text-muted">
          {money(out)} out · {money(into)} in{final.some((l) => l.category === "transfer") ? " · moves between your accounts left out" : ""}
        </p>
      </div>

      {/* A trip */}
      {trip.length > 0 && (
        <section className="mt-3 rounded-2xl border border-line p-3.5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-soft text-sky">
              <Icon.sun className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">Looks like a trip</p>
              <p className="text-[13px] text-muted">
                {shortDate(lines[trip[0]].date)} – {shortDate(lines[trip[trip.length - 1]].date)} · {trip.length} payments abroad ·{" "}
                {money(trip.reduce((t, i) => t - lines[i].amount, 0))}
              </p>
            </div>
          </div>
          <label className="mt-3 flex items-center gap-3 text-[14px]">
            <input type="checkbox" checked={tripAsTravel} onChange={(e) => setTripAsTravel(e.target.checked)} className="size-5 accent-[var(--color-sage-dark)]" />
            File all of it under Travel and holidays, so your usual months stay comparable
          </label>
        </section>
      )}

      {/* Subscriptions */}
      {subs.length > 0 && (
        <section className="mt-3 rounded-2xl border border-line p-3.5">
          <p className="text-[15px] font-semibold">Subscriptions found</p>
          <p className="text-[13px] text-muted">Add them to Bills to see every renewal coming. Ticked ones are added.</p>
          <ul className="mt-1 divide-y divide-line">
            {subs.map((s) => (
              <li key={s.match}>
                <label className="flex items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={subOn(s.match)}
                    onChange={(e) => setAddSub((a) => ({ ...a, [s.match]: e.target.checked }))}
                    className="size-5 accent-[var(--color-sage-dark)]"
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{s.name}</span>
                  <span className="shrink-0 text-[14px] font-semibold">
                    {money(s.amount)}
                    <span className="font-normal text-muted"> / {s.frequency === "yearly" ? "year" : "month"}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Money in: pay, or friends paying you back */}
      {moneyIn.length > 0 && (
        <section className="mt-3 rounded-2xl border border-line p-3.5">
          <p className="text-[15px] font-semibold">Money in</p>
          <p className="text-[13px] text-muted">
            Did a friend pay you back for something? Mark it Paid back and pick the payment, so that payment counts as what you really
            paid (and it isn&apos;t counted as income). Mine is money from your own account.
          </p>
          <ul className="mt-1 divide-y divide-line">
            {moneyIn.map((i) => {
              const l = final[i];
              const key = `in-${i}`;
              const back = l.category === "paid_back";
              const linked = back && links[i] ? pool.find((c) => c.hash === links[i]) : undefined;
              return (
                <li key={key} className="py-2.5">
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => setOpen(open === key ? null : key)} className="min-w-0 text-left">
                      <span className="block truncate text-[15px] font-semibold">{l.description}</span>
                      <span className="block text-[12px] text-muted">
                        {shortDate(l.date)} · <span className="font-semibold text-sage-dark">+{money(l.amount)}</span>
                        {linked ? ` · for ${linked.description}` : back ? " · pick the payment" : ""}
                        {l.category === "transfer" ? " · from your own account" : ""}
                      </span>
                    </button>
                    <div className="flex self-start rounded-full bg-cream p-0.5 text-[13px] font-semibold">
                      {(
                        [
                          ["income", "Income"],
                          ["paid_back", "Paid back"],
                          ["transfer", "Mine"],
                        ] as const
                      ).map(([id, label]) => {
                        const on = l.category === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => {
                              setPicked((p) => ({ ...p, [i]: id }));
                              if (id === "paid_back") setOpen(key);
                            }}
                            className={`rounded-full px-3 py-1.5 ${on ? "bg-ink text-cream" : "text-muted"}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {open === key && lineOpen(i)}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Still to sort */}
      {unsorted.length > 0 && (
        <section className="mt-3 rounded-2xl border border-line p-3.5">
          <p className="text-[15px] font-semibold">
            {stillOther.length ? `${stillOther.length} to sort` : "All sorted"}
          </p>
          <p className="text-[13px] text-muted">Tap one to pick a category. Anything you skip goes under Other.</p>
          <ul className="mt-1 divide-y divide-line">
            {unsorted.map((g) => {
              const c = category(final[g.idx[0]].category);
              const key = `group-${g.match}`;
              const done = c.id !== "other";
              return (
                <li key={g.match} className="py-2.5">
                  <button type="button" onClick={() => setOpen(open === key ? null : key)} className="flex w-full items-center gap-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{g.sample}</span>
                      <span className="block text-[12px] text-muted">
                        {g.idx.length > 1 ? `${g.idx.length} payments · ` : ""}
                        {money(g.total)}
                      </span>
                    </span>
                    <span
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                        done ? "bg-sage-soft text-sage-dark" : "bg-peach-soft text-peach"
                      }`}
                    >
                      {done && <span className="size-2 rounded-full" style={{ background: c.color }} />}
                      {done ? c.label : "Choose"}
                    </span>
                  </button>
                  {open === key && (
                    <>
                      <div className="animate-reveal mt-2 space-y-1.5">
                        {g.idx.map((i) => (
                          <LineDetails key={i} date={lines[i].date} amount={lines[i].amount} description={lines[i].description} account={lines[i].account} details={lines[i].details} />
                        ))}
                      </div>
                      <CategoryPicker value={c.id} allowIncome={false} onPick={(cat) => pickGroup(g.idx, cat)} />
                      <label className="mt-2 flex items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={remember[g.match] ?? true}
                          onChange={(e) => setRemember((r) => ({ ...r, [g.match]: e.target.checked }))}
                          className="size-4 accent-[var(--color-sage-dark)]"
                        />
                        Remember for next time
                        <span className="text-muted">(lines with “{g.match}”)</span>
                      </label>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Everything, by category */}
      <section className="mt-3">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">By category</p>
        <ul className="divide-y divide-line rounded-2xl border border-line px-3.5">
          {byCategory.map(([id, idx]) => {
            const c = category(id);
            const isOpen = openGroup === id;
            return (
              <li key={id} className="py-1">
                <button type="button" onClick={() => setOpenGroup(isOpen ? null : id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 py-2 text-left">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="min-w-0 flex-1 truncate text-[15px]">
                    {c.label} <span className="text-muted">· {idx.length}</span>
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold">{money(idx.reduce((t, i) => t + final[i].amount, 0))}</span>
                  <span className={`text-muted transition-transform duration-200 ease-out ${isOpen ? "rotate-90" : ""}`}>›</span>
                </button>
                {isOpen && <ul className="animate-reveal divide-y divide-line pb-1">{idx.map(row)}</ul>}
              </li>
            );
          })}
        </ul>
      </section>

      <PrimaryButton onClick={save}>Add {lines.length} transactions</PrimaryButton>
      <button type="button" onClick={onBack} className="mt-3 w-full py-2 text-sm font-semibold text-muted">
        Choose a different file
      </button>
    </div>
  );
}
