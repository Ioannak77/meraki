"use client";

// Tracker tabs: your own views on money, e.g. "Car maintenance" or
// "Limassol". Each one follows a few categories (and, optionally, bills), so
// the spending you care about is one tap away, with totals and a monthly list.

import { useState } from "react";
import {
  allCategories,
  billPayments,
  category,
  expectedAmount,
  money,
  nextDue,
  type CategoryId,
  type Txn,
} from "@/lib/finance";
import { useFinance, type Tracker } from "@/lib/financeStore";
import { dayKey } from "@/lib/store";
import { Icon } from "../icons";
import { AddSpendingSheet, TxnSheet } from "./Spending";
import { Card, CardTitle, DangerButton, Label, PrimaryButton, Sheet, inputClass } from "./ui";

/** The lines a tracker shows: its categories, plus statement payments of its bills. */
export function trackerLines(t: Tracker, txns: Txn[], bills: ReturnType<typeof useFinance>["bills"]) {
  const out = new Map<string, Txn>();
  for (const x of txns) if (x.amount < 0 && t.categories.includes(x.category)) out.set(x.id, x);
  for (const b of bills.filter((b) => t.billIds.includes(b.id))) for (const x of billPayments(b, txns)) out.set(x.id, x);
  return [...out.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Your trackers. `embedded`: inside Finances (no page title of its own). */
export function TrackerView({ now, embedded = false }: { now: Date; embedded?: boolean }) {
  const { trackers, txns, bills } = useFinance();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Tracker | "new" | null>(null);
  const active = trackers.find((t) => t.id === activeId) ?? trackers[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      {!embedded && <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">Tracker</h1>}

      <div className={`-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 ${embedded ? "" : "mt-4"}`}>
        {trackers.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ${
              active?.id === t.id ? "bg-ink font-bold text-cream" : "bg-card text-ink/70"
            }`}
          >
            {t.name}
          </button>
        ))}
        {trackers.length > 0 && (
          <button
            onClick={() => setEditing("new")}
            className="flex shrink-0 items-center gap-1 rounded-full bg-sage-dark px-4 py-2 text-sm font-bold text-white"
          >
            <Icon.plus className="size-4" /> New tracker
          </button>
        )}
      </div>

      <div className="mt-4">
        {active ? (
          <TrackerBody tracker={active} now={now} onEdit={() => setEditing(active)} lines={trackerLines(active, txns, bills)} />
        ) : (
          <Card>
            <CardTitle>Keep an eye on what matters</CardTitle>
            <p className="text-[15px] text-muted">
              Make a tracker for anything you want to follow, like car maintenance or your Limassol trips. Pick the money
              categories (and bills) it covers, and everything in them lands here, sorted by month.
            </p>
            <PrimaryButton onClick={() => setEditing("new")}>Make my first tracker</PrimaryButton>
          </Card>
        )}
      </div>

      {editing && (
        <TrackerSheet
          tracker={editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => setActiveId(id)}
        />
      )}
    </div>
  );
}

function TrackerBody({ tracker, now, onEdit, lines }: { tracker: Tracker; now: Date; onEdit: () => void; lines: Txn[] }) {
  const { bills, billActuals, txns } = useFinance();
  const [adding, setAdding] = useState(false);
  const [editingTxn, setEditingTxn] = useState<Txn | null>(null);

  const thisMonth = dayKey(now).slice(0, 7);
  const thisYear = dayKey(now).slice(0, 4);
  const sum = (list: Txn[]) => list.reduce((t, x) => t - x.amount, 0);
  const monthTotal = sum(lines.filter((x) => x.date.startsWith(thisMonth)));
  const yearTotal = sum(lines.filter((x) => x.date.startsWith(thisYear)));
  const allTotal = sum(lines);

  const byMonth = new Map<string, Txn[]>();
  for (const x of lines) byMonth.set(x.date.slice(0, 7), [...(byMonth.get(x.date.slice(0, 7)) ?? []), x]);

  const byCategory = tracker.categories
    .map((c) => ({ c, total: sum(lines.filter((x) => x.category === c && x.date.startsWith(thisYear))) }))
    .filter((x) => x.total > 0);

  const trackedBills = bills.filter((b) => tracker.billIds.includes(b.id));

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{tracker.name} this year</p>
            <p className="text-[36px] font-bold leading-tight">{money(yearTotal)}</p>
          </div>
          <button type="button" onClick={onEdit} className="text-sm font-semibold text-sage-dark">
            Edit
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-cream px-2 py-3">
            <p className="text-[17px] font-bold">{money(monthTotal, true)}</p>
            <p className="text-xs text-muted">This month</p>
          </div>
          <div className="rounded-2xl bg-cream px-2 py-3">
            <p className="text-[17px] font-bold">{money(allTotal, true)}</p>
            <p className="text-xs text-muted">All time</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Covers: {[...tracker.categories.map((c) => category(c).label), ...trackedBills.map((b) => `${b.name} (bill)`)].join(", ") || "nothing yet, tap Edit"}
        </p>
        {tracker.categories.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-4 w-full rounded-2xl bg-sage-dark py-3.5 font-bold text-white"
          >
            + Add to {tracker.name}
          </button>
        )}
      </Card>

      {trackedBills.length > 0 && (
        <Card>
          <CardTitle>Bills</CardTitle>
          <ul className="divide-y divide-line">
            {trackedBills.map((b) => {
              const next = nextDue(b, now);
              const exp = next ? expectedAmount(b, next, billActuals, txns) : null;
              return (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
                  <span className="min-w-0 truncate">{b.name}</span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold">
                      {exp ? `${exp.kind === "estimate" ? "~" : ""}${money(exp.amount)}` : "—"}
                    </span>
                    {next && (
                      <span className="block text-xs text-muted">
                        next{" "}
                        {next.toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: next.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
                        })}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {byCategory.length > 1 && (
        <Card>
          <CardTitle>By category this year</CardTitle>
          <ul className="space-y-2 text-[15px]">
            {byCategory.map(({ c, total }) => (
              <li key={c} className="flex items-center gap-3">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: category(c).color }} />
                <span className="flex-1">{category(c).label}</span>
                <span className="font-semibold">{money(total)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="lg:col-span-2">
        <CardTitle>By month</CardTitle>
        {lines.length === 0 ? (
          <p className="text-muted">
            Nothing yet. Add something above, or in Finances tap a transaction and give it one of this tracker&apos;s
            categories (choose “Always” so future statements land here by themselves).
          </p>
        ) : (
          <div className="space-y-4">
            {[...byMonth.entries()].map(([key, items]) => (
              <div key={key}>
                <div className="mb-1 flex items-baseline justify-between">
                  <h3 className="font-bold">{monthLabel(key)}</h3>
                  <span className="text-sm font-semibold">{money(sum(items))}</span>
                </div>
                <ul className="divide-y divide-line">
                  {items.map((x) => (
                    <li key={x.id}>
                      <button type="button" onClick={() => setEditingTxn(x)} className="flex w-full items-center gap-3 py-2.5 text-left">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: category(x.category).color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px]">{x.description}</span>
                          <span className="block text-[13px] text-muted">
                            {new Date(x.date + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })} ·{" "}
                            {category(x.category).label}
                          </span>
                        </span>
                        <span className="shrink-0 text-[15px] font-semibold">{money(-x.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {adding && <AddSpendingSheet onClose={() => setAdding(false)} now={now} only={tracker.categories} />}
      {editingTxn && <TxnSheet txn={editingTxn} onClose={() => setEditingTxn(null)} />}
    </div>
  );
}

function TrackerSheet({
  tracker,
  onClose,
  onSaved,
}: {
  tracker: Tracker | "new";
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { saveTracker, deleteTracker, addCategory, bills } = useFinance();
  const existing = tracker === "new" ? null : tracker;
  const [name, setName] = useState(existing?.name ?? "");
  const [cats, setCats] = useState<CategoryId[]>(existing?.categories ?? []);
  const [billIds, setBillIds] = useState<string[]>(existing?.billIds ?? []);
  const [newCat, setNewCat] = useState("");
  const [makeOwn, setMakeOwn] = useState(!existing);

  const choices = allCategories().filter((c) => c.counts);
  const nameMatches = choices.some((c) => c.label.toLowerCase() === name.trim().toLowerCase());
  const offerOwn = !existing && name.trim() !== "" && !nameMatches;

  function toggle<T>(list: T[], v: T) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function save() {
    let categories = cats;
    if (offerOwn && makeOwn) categories = [...categories, addCategory(name)];
    const id = saveTracker({ id: existing?.id, name: name.trim(), categories, billIds });
    onSaved(id);
    onClose();
  }

  const valid = name.trim() !== "" && (cats.length > 0 || billIds.length > 0 || (offerOwn && makeOwn));
  const pill = (on: boolean) => `rounded-full px-3.5 py-2 text-sm ${on ? "bg-ink text-cream" : "bg-cream text-ink/80"}`;

  return (
    <Sheet title={existing ? "Edit tracker" : "New tracker"} onClose={onClose}>
      <Label>Name</Label>
      <input
        autoFocus={!existing}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Car maintenance, Limassol"
        className={inputClass}
      />
      {offerOwn && (
        <label className="mt-3 flex items-center gap-3 rounded-2xl bg-cream px-4 py-3">
          <input type="checkbox" checked={makeOwn} onChange={(e) => setMakeOwn(e.target.checked)} className="size-5 accent-sage" />
          <span className="text-[15px]">
            Also make a category called “<strong>{name.trim()}</strong>”
          </span>
        </label>
      )}

      <Label>Categories it follows</Label>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <button key={c.id} type="button" className={pill(cats.includes(c.id))} onClick={() => setCats((l) => toggle(l, c.id))}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="New category…"
          className="min-w-0 flex-1 rounded-full border border-line bg-cream px-4 py-2 text-sm"
        />
        <button
          type="button"
          disabled={!newCat.trim()}
          onClick={() => {
            const id = addCategory(newCat);
            setCats((l) => (l.includes(id) ? l : [...l, id]));
            setNewCat("");
          }}
          className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-bold text-cream disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {bills.length > 0 && (
        <>
          <Label>Bills it follows (optional)</Label>
          <div className="flex flex-wrap gap-2">
            {bills.map((b) => (
              <button key={b.id} type="button" className={pill(billIds.includes(b.id))} onClick={() => setBillIds((l) => toggle(l, b.id))}>
                {b.name}
              </button>
            ))}
          </div>
        </>
      )}

      <PrimaryButton disabled={!valid} onClick={save}>
        {existing ? "Save" : "Make tracker"}
      </PrimaryButton>
      {existing && (
        <DangerButton
          label="Delete tracker (your transactions stay)"
          onConfirm={() => {
            deleteTracker(existing.id);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
