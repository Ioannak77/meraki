"use client";

import { useState } from "react";
import {
  CATEGORIES,
  category,
  findHeader,
  guessColumns,
  headerSignature,
  inRange,
  money,
  monthRange,
  parseCsv,
  readStatement,
  ruleKeyword,
  type CategoryId,
  type ColumnMap,
  type Txn,
} from "@/lib/finance";
import { useFinance, type ImportResult } from "@/lib/financeStore";
import { dayKey } from "@/lib/store";
import { Bar, Card, CardTitle, Chips, DangerButton, Label, MoneyInput, PrimaryButton, Sheet, inputClass } from "./ui";

/** Money spent per counted category in a date range (positive numbers). */
export function spendingByCategory(txns: Txn[], start: Date, end: Date) {
  const totals = new Map<CategoryId, number>();
  for (const t of txns) {
    if (t.amount >= 0 || !category(t.category).counts || !inRange(t.date, start, end)) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) - t.amount);
  }
  return totals;
}

export function SpendingTab({ now }: { now: Date }) {
  const { txns, budgets, has } = useFinance();
  const [monthOffset, setMonthOffset] = useState(0);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Txn | null>(null);

  const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const { start, end } = monthRange(monthDate);
  const totals = spendingByCategory(txns, start, end);
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  const lines = txns.filter((t) => inRange(t.date, start, end)).sort((a, b) => b.date.localeCompare(a.date));
  const rows = CATEGORIES.filter((c) => c.counts && (totals.get(c.id) || budgets[c.id])).sort(
    (a, b) => (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex gap-2 lg:col-span-2">
        {has("imports") && (
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="flex-1 rounded-2xl bg-sage-dark py-3.5 font-bold text-white"
          >
            Import bank statement
          </button>
        )}
        <button type="button" onClick={() => setAdding(true)} className="flex-1 rounded-2xl bg-card py-3.5 font-bold">
          + Add spending
        </button>
      </div>

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
          Spent <strong className="text-ink">{money(total)}</strong> (bills and transfers not included)
        </p>
        {rows.length === 0 ? (
          <p className="py-4 text-muted">Nothing yet this month.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {rows.map((c) => {
              const spent = totals.get(c.id) ?? 0;
              const budget = budgets[c.id];
              return (
                <li key={c.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-[15px]">
                    <span className="font-semibold">{c.label}</span>
                    <span className={budget && spent > budget ? "font-semibold text-peach" : ""}>
                      {money(spent)}
                      {budget ? <span className="text-muted"> / {money(budget, true)}</span> : null}
                    </span>
                  </div>
                  <Bar value={spent} max={budget ?? Math.max(...totals.values())} color={c.color} />
                </li>
              );
            })}
          </ul>
        )}
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
                    <span className={`shrink-0 text-[15px] font-semibold ${t.amount > 0 ? "text-sage-dark" : ""}`}>
                      {t.amount > 0 ? "+" : ""}
                      {money(t.amount)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {importing && <ImportSheet onClose={() => setImporting(false)} />}
      {adding && <AddSpendingSheet onClose={() => setAdding(false)} now={now} />}
      {editing && <TxnSheet txn={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

const CATEGORY_CHOICES = CATEGORIES.map((c) => ({ id: c.id, label: c.label }));

function TxnSheet({ txn, onClose }: { txn: Txn; onClose: () => void }) {
  const { setTxnCategory, deleteTxn } = useFinance();
  const [cat, setCat] = useState<CategoryId>(txn.category);
  const keyword = ruleKeyword(txn.description);
  const [always, setAlways] = useState(txn.source === "import");

  return (
    <Sheet title="Transaction" onClose={onClose}>
      <p className="text-[17px] font-semibold">{txn.description}</p>
      <p className="text-[15px] text-muted">
        {new Date(txn.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long" })} ·{" "}
        {money(txn.amount)}
      </p>

      <Label>Category</Label>
      <Chips options={CATEGORY_CHOICES} value={cat} onChange={setCat} />

      <label className="mt-5 flex items-center gap-3 rounded-2xl bg-cream px-4 py-3">
        <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} className="size-5 accent-sage" />
        <span className="text-[15px]">
          Always use this for lines with “<strong>{keyword}</strong>”
        </span>
      </label>

      <PrimaryButton
        onClick={() => {
          setTxnCategory(txn.id, cat, always ? keyword : undefined);
          onClose();
        }}
      >
        Save
      </PrimaryButton>
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

function AddSpendingSheet({ onClose, now }: { onClose: () => void; now: Date }) {
  const { addTxn, has } = useFinance();
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [cat, setCat] = useState<CategoryId>(has("groceries") ? "groceries" : "other");
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
        <Chips options={CATEGORY_CHOICES.filter((c) => category(c.id).counts)} value={cat} onChange={setCat} />
        <Label>Date</Label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        <PrimaryButton type="submit" disabled={!valid}>
          Add
        </PrimaryButton>
      </form>
    </Sheet>
  );
}

type Loaded = { rows: string[][]; header: string[]; signature: string; map: ColumnMap; fileName: string };

const FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount (one column, minus = money out)" },
  { key: "moneyOut", label: "…or Money out" },
  { key: "moneyIn", label: "…and Money in" },
];

function ImportSheet({ onClose }: { onClose: () => void }) {
  const { importLines, importProfiles } = useFinance();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(file: File) {
    setError(null);
    const text = await file.text();
    const all = parseCsv(text);
    if (all.length < 2) {
      setError("That file doesn't look like a CSV statement. Most banks have a “Download as CSV” option.");
      return;
    }
    const h = findHeader(all);
    const header = all[h];
    const signature = headerSignature(header);
    const map = importProfiles[signature] ?? guessColumns(header);
    setLoaded({ rows: all.slice(h + 1), header, signature, map, fileName: file.name });
  }

  const preview = loaded ? readStatement(loaded.rows, loaded.map) : null;
  const mapOk = loaded && loaded.map.date >= 0 && loaded.map.description >= 0 && (loaded.map.amount >= 0 || loaded.map.moneyOut >= 0 || loaded.map.moneyIn >= 0);

  if (result) {
    return (
      <Sheet title="Statement imported" onClose={onClose}>
        <p className="text-4xl">✅</p>
        <p className="mt-3 text-[17px]">
          <strong>{result.added}</strong> new {result.added === 1 ? "transaction" : "transactions"} added.
        </p>
        {result.duplicates > 0 && <p className="text-[15px] text-muted">{result.duplicates} were already here, so they were skipped.</p>}
        {result.billsMarkedPaid > 0 && (
          <p className="text-[15px] text-muted">{result.billsMarkedPaid} bills were ticked as paid from the statement.</p>
        )}
        <p className="mt-3 text-[15px] text-muted">Tap any transaction to fix its category; Meraki learns from it.</p>
        <PrimaryButton onClick={onClose}>Done</PrimaryButton>
      </Sheet>
    );
  }

  return (
    <Sheet title="Import bank statement" onClose={onClose}>
      {!loaded ? (
        <>
          <p className="text-[15px] text-muted">
            Download a statement from your bank as a <strong>CSV</strong> file, then pick it here. It&apos;s read on this
            device only. Importing the same statement twice won&apos;t double count anything.
          </p>
          <label className="mt-5 block cursor-pointer rounded-2xl border-2 border-dashed border-line bg-cream py-8 text-center font-semibold">
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
          {error && <p className="mt-3 text-[15px] text-peach">{error}</p>}
        </>
      ) : (
        <>
          <p className="text-[15px] text-muted">
            {loaded.fileName} · {loaded.rows.length} rows.{" "}
            {importProfiles[loaded.signature] ? "Using the columns you chose last time." : "Check the columns are right:"}
          </p>

          <div className="mt-3 space-y-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 text-muted">{f.label}</span>
                <select
                  value={loaded.map[f.key]}
                  onChange={(e) => setLoaded({ ...loaded, map: { ...loaded.map, [f.key]: Number(e.target.value) } })}
                  className="min-w-0 flex-1 rounded-xl bg-cream px-3 py-2"
                >
                  <option value={-1}>—</option>
                  {loaded.header.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {preview && (
            <>
              <Label>Preview</Label>
              <ul className="divide-y divide-line rounded-2xl bg-cream px-3">
                {preview.lines.slice(0, 5).map((l, i) => (
                  <li key={i} className="flex gap-3 py-2 text-sm">
                    <span className="w-20 shrink-0 text-muted">{l.date}</span>
                    <span className="min-w-0 flex-1 truncate">{l.description}</span>
                    <span className="shrink-0 font-semibold">{money(l.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                {preview.lines.length} lines read
                {preview.unreadable ? `, ${preview.unreadable} skipped (no date or amount, e.g. balance lines)` : ""}.
              </p>
            </>
          )}

          <PrimaryButton
            disabled={!mapOk || !preview?.lines.length}
            onClick={() => setResult(importLines(preview!.lines, loaded.signature, loaded.map))}
          >
            Import {preview?.lines.length ?? 0} transactions
          </PrimaryButton>
          <button type="button" onClick={() => setLoaded(null)} className="mt-3 w-full py-2 text-sm font-semibold text-muted">
            Choose a different file
          </button>
        </>
      )}
    </Sheet>
  );
}
