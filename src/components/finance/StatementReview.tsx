"use client";

// After a statement is read: one screen to check it before it's added. Most lines arrive already
// sorted (your own rules, your bills, Claude's suggestion for a PDF, then the starter keywords), so
// this only asks about what's left, offers to file a trip under Travel, and to add subscriptions to Bills.

import { useMemo, useState } from "react";
import {
  allCategories,
  billKeyword,
  categorise,
  category,
  money,
  ruleKeyword,
  type CategoryId,
  type ParsedLine,
  type Rule,
} from "@/lib/finance";
import { useFinance, type NewBill } from "@/lib/financeStore";
import { Icon } from "../icons";
import { NewChip } from "../NewChip";
import { PrimaryButton } from "./ui";

type Sorted = ParsedLine & { category: CategoryId };

/** Your rules first, then transfers and bills, then the reader's suggestion, then the starter keywords. */
function firstGuess(l: ParsedLine, rules: Rule[], bills: Parameters<typeof categorise>[3]): CategoryId {
  const text = l.description.toLowerCase();
  const rule = rules.find((r) => text.includes(r.match));
  if (rule) return rule.category;
  if (l.transfer) return "transfer";
  if (l.amount < 0 && bills.some((b) => text.includes(billKeyword(b)))) return "bills";
  if (l.suggested && l.suggested !== "other") return l.suggested;
  return categorise(l.description, l.amount, [], bills);
}

const shortDate = (key: string) => new Date(key + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** A tidy bill name from a bank line ("NETFLIX.COM 866-579" -> "Netflix"). */
function billName(description: string) {
  const word = ruleKeyword(description).split(" ")[0] ?? description;
  const clean = word.replace(/\.(com|net|io|co)$/, "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function CategoryPicker({ value, onPick, allowIncome }: { value: CategoryId; onPick: (c: CategoryId) => void; allowIncome: boolean }) {
  const { addCategory } = useFinance();
  return (
    <div className="animate-reveal mt-2 rounded-2xl bg-cream p-2">
      <div className="grid grid-cols-2 gap-1.5">
        {allCategories()
          .filter((c) => allowIncome || c.id !== "income")
          .map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              className={`flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] ${
                value === c.id ? "bg-ink font-bold text-cream" : "bg-card"
              }`}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="min-w-0 leading-tight">{c.label}</span>
            </button>
          ))}
      </div>
      <div className="mt-2">
        <NewChip onAdd={(name) => onPick(addCategory(name))} placeholder="New category" />
      </div>
    </div>
  );
}

export function StatementReview({
  source,
  lines,
  onImport,
  onBack,
}: {
  source: string;
  lines: ParsedLine[];
  onImport: (lines: Sorted[], rules: Rule[], bills: NewBill[]) => void;
  onBack: () => void;
}) {
  const { rules, bills } = useFinance();
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
    if (l.subscription && sub && subOn(sub.match)) return "bills";
    if (tripAsTravel && trip.includes(i) && guesses[i] !== "bills") return "travel";
    return guesses[i];
  };
  const final = lines.map((l, i) => ({ ...l, category: finalCategory(i) }));

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
        {open === key && <CategoryPicker value={l.category} allowIncome={l.amount > 0} onPick={(cat) => pickGroup([i], cat)} />}
      </li>
    );
  };

  return (
    <div>
      {/* What came in */}
      <div className="rounded-2xl bg-cream p-3.5">
        <p className="text-[13px] text-muted">
          {source} · {dates.length ? `${shortDate(dates[0])} – ${shortDate(dates[dates.length - 1])}` : ""}
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
