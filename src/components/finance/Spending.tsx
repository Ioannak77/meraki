"use client";

import { useState } from "react";
import {
  allCategories,
  canLower,
  effectiveBudgets,
  tidy,
  monthStats,
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
  type ParsedLine,
  type Txn,
} from "@/lib/finance";
import { useFinance, type ImportResult } from "@/lib/financeStore";
import { StatementReview } from "./StatementReview";
import { dayKey } from "@/lib/store";
import { workerPost } from "@/lib/worker";
import { NewChip } from "../NewChip";
import { AllowanceBody, AmountSheet } from "./Budgets";
import { Bar, Card, CardTitle, Chips, DangerButton, Label, MoneyInput, PrimaryButton, Sheet, inputClass } from "./ui";
import { Icon } from "../icons";

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
  const { txns, budgets, has, rules, deleteRule, setBudget, addCategory, weeklyAllowance, setWeeklyAllowance } = useFinance();
  const [editingBudget, setEditingBudget] = useState<CategoryId | "allowance" | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Txn | null>(null);

  const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const { start, end } = monthRange(monthDate);
  const totals = spendingByCategory(txns, start, end);
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  const lines = txns.filter((t) => inRange(t.date, start, end)).sort((a, b) => b.date.localeCompare(a.date));
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

      {importing && <ImportSheet onClose={() => setImporting(false)} />}
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

/** Category chips, including your own categories (read fresh each render). */
const categoryChoices = () => allCategories().map((c) => ({ id: c.id, label: c.label }));

type Mapping = { always: boolean; match: string };

/** "Just this once" or "Always" for lines containing some text (editable, e.g. just "abc"). */
function MappingChoice({ value, onChange }: { value: Mapping; onChange: (m: Mapping) => void }) {
  const seg = (on: boolean) =>
    `flex-1 rounded-full py-2 text-sm ${on ? "bg-ink font-bold text-cream" : "text-ink/70"}`;
  return (
    <div>
      <div className="flex gap-1 rounded-full bg-cream p-1">
        <button type="button" className={seg(!value.always)} onClick={() => onChange({ ...value, always: false })}>
          Just this once
        </button>
        <button type="button" className={seg(value.always)} onClick={() => onChange({ ...value, always: true })}>
          Always
        </button>
      </div>
      {value.always && (
        <label className="mt-2 flex items-center gap-2 text-sm">
          <span className="shrink-0 text-muted">for lines containing</span>
          <input
            value={value.match}
            onChange={(e) => onChange({ ...value, match: e.target.value })}
            className="min-w-0 flex-1 rounded-xl border border-line bg-cream px-3 py-2"
          />
        </label>
      )}
    </div>
  );
}

export function TxnSheet({ txn, onClose }: { txn: Txn; onClose: () => void }) {
  const { setTxnCategory, deleteTxn, addCategory } = useFinance();
  const [cat, setCat] = useState<CategoryId>(txn.category);
  const [mapping, setMapping] = useState<Mapping>({
    always: txn.source === "import",
    match: ruleKeyword(txn.description),
  });

  return (
    <Sheet title="Transaction" onClose={onClose}>
      <p className="text-[17px] font-semibold">{txn.description}</p>
      <p className="text-[15px] text-muted">
        {new Date(txn.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long" })} ·{" "}
        {money(txn.amount)}
      </p>

      <Label>Category</Label>
      <Chips options={categoryChoices()} value={cat} onChange={setCat} onCreate={addCategory} />

      <Label>Remember it?</Label>
      <MappingChoice value={mapping} onChange={setMapping} />

      <PrimaryButton
        onClick={() => {
          setTxnCategory(txn.id, cat, mapping.always && mapping.match.trim() ? mapping.match : undefined);
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

/** `only` limits the category choice (a Tracker adds into its own categories). */
export function AddSpendingSheet({ onClose, now, only }: { onClose: () => void; now: Date; only?: CategoryId[] }) {
  const { addTxn, has, addCategory } = useFinance();
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
        <Chips
          options={categoryChoices().filter((c) => (only ? only.includes(c.id) : category(c.id).counts))}
          value={cat}
          onChange={setCat}
          onCreate={only ? undefined : addCategory}
        />
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

/** A PDF statement, read by Claude in the meraki worker (Revolut, Bank of Cyprus, …). */
type PdfRead = { bank: string; currency: string; lines: ParsedLine[]; fileName: string };
type StatementReply = {
  bank: string;
  currency: string;
  lines: {
    date: string;
    description: string;
    amount: number;
    own_transfer: boolean;
    category?: string;
    abroad?: boolean;
    subscription?: "no" | "monthly" | "yearly";
  }[];
};
const NO_COLUMNS: ColumnMap = { date: -1, description: -1, amount: -1, moneyOut: -1, moneyIn: -1 };

async function readPdfStatement(file: File): Promise<PdfRead> {
  if (file.size > 15_000_000) throw new Error("That PDF is too big. Try a statement for a shorter period.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  // Claude suggests a category from your own list (built-in and the ones you made).
  const categories = allCategories().map((c) => ({ id: c.id, label: c.label }));
  const known = new Set(categories.map((c) => c.id as string));
  const r = await workerPost<StatementReply>("/statement", { pdf: btoa(binary), categories }, "statement reader");
  const lines = r.lines
    .filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.date) && Number.isFinite(l.amount) && l.amount !== 0)
    .map(
      (l): ParsedLine => ({
        date: l.date,
        description: l.description.trim() || "(no description)",
        amount: l.amount,
        transfer: l.own_transfer || undefined,
        suggested: l.category && known.has(l.category) ? (l.category as CategoryId) : undefined,
        abroad: l.abroad || undefined,
        subscription: l.subscription === "monthly" || l.subscription === "yearly" ? l.subscription : undefined,
      }),
    );
  return { bank: r.bank, currency: r.currency, lines, fileName: file.name };
}

const FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount (one column, minus = money out)" },
  { key: "moneyOut", label: "…or Money out" },
  { key: "moneyIn", label: "…and Money in" },
];

export function ImportSheet({ onClose }: { onClose: () => void }) {
  const { importLines, importProfiles } = useFinance();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [pdf, setPdf] = useState<PdfRead | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [checking, setChecking] = useState(false); // the check screen (StatementReview)

  async function onFile(file: File) {
    setError(null);
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      setReading(true);
      try {
        const read = await readPdfStatement(file);
        if (read.lines.length === 0) setError("Couldn't find any transactions in that PDF.");
        else setPdf(read);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't read that statement.");
      } finally {
        setReading(false);
      }
      return;
    }
    const text = await file.text();
    const all = parseCsv(text);
    if (all.length < 2) {
      setError("That file doesn't look like a statement. Pick the PDF or CSV your bank gives you.");
      return;
    }
    const h = findHeader(all);
    const header = all[h];
    const signature = headerSignature(header);
    const map = importProfiles[signature] ?? guessColumns(header);
    setLoaded({ rows: all.slice(h + 1), header, signature, map, fileName: file.name });
  }

  const preview = pdf ? { lines: pdf.lines, unreadable: 0 } : loaded ? readStatement(loaded.rows, loaded.map) : null;
  const transfers = pdf ? pdf.lines.filter((l) => l.transfer).length : 0;
  const mapOk = loaded && loaded.map.date >= 0 && loaded.map.description >= 0 && (loaded.map.amount >= 0 || loaded.map.moneyOut >= 0 || loaded.map.moneyIn >= 0);

  if (checking && preview && !result) {
    return (
      <Sheet title="Check your statement" onClose={onClose}>
        <StatementReview
          source={pdf ? pdf.bank || pdf.fileName : (loaded?.fileName ?? "Statement")}
          lines={preview.lines}
          onImport={(lines, rules, bills) => setResult(importLines(lines, loaded?.signature ?? "", loaded?.map ?? NO_COLUMNS, rules, bills))}
          onBack={() => {
            setChecking(false);
            setPdf(null);
            setLoaded(null);
          }}
        />
      </Sheet>
    );
  }

  if (result) {
    return (
      <Sheet title="Statement imported" onClose={onClose}>
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-sage text-white">
            <Icon.check className="size-8" />
          </span>
        <p className="mt-3 text-[17px]">
          <strong>{result.added}</strong> new {result.added === 1 ? "transaction" : "transactions"} added.
        </p>
        {result.duplicates > 0 && <p className="text-[15px] text-muted">{result.duplicates} were already here, so they were skipped.</p>}
        {result.billsAdded > 0 && (
          <p className="text-[15px] text-muted">
            {result.billsAdded} {result.billsAdded === 1 ? "subscription was" : "subscriptions were"} added to Bills.
          </p>
        )}
        {result.billsMarkedPaid > 0 && (
          <p className="text-[15px] text-muted">
            {result.billsMarkedPaid} {result.billsMarkedPaid === 1 ? "bill was" : "bills were"} ticked as paid from the statement.
          </p>
        )}
        <p className="mt-3 text-[15px] text-muted">Tap any transaction to fix its category; Meraki learns from it.</p>
        <PrimaryButton onClick={onClose}>Done</PrimaryButton>
      </Sheet>
    );
  }

  return (
    <Sheet title="Import bank statement" onClose={onClose}>
      {pdf ? (
        <>
          <p className="text-[15px] text-muted">
            {pdf.bank || "Statement"} · {pdf.fileName}
          </p>
          <p className="mt-1 text-[15px]">
            <strong>{pdf.lines.length}</strong> transactions found
            {transfers > 0 ? `, ${transfers} between your own accounts (kept out of your spending)` : ""}.
          </p>
          {pdf.currency && pdf.currency.toUpperCase() !== "EUR" && (
            <p className="mt-2 text-[15px] text-peach">This is a {pdf.currency} account. Amounts are added as they are, not converted to euros.</p>
          )}
          <Label>Preview</Label>
          <ul className="divide-y divide-line rounded-2xl bg-cream px-3">
            {pdf.lines.slice(0, 5).map((l, i) => (
              <li key={i} className="flex gap-3 py-2 text-sm">
                <span className="w-20 shrink-0 text-muted">{l.date}</span>
                <span className="min-w-0 flex-1 truncate">{l.description}</span>
                <span className="shrink-0 font-semibold">{money(l.amount)}</span>
              </li>
            ))}
          </ul>
          <PrimaryButton onClick={() => setChecking(true)}>Next: check {pdf.lines.length} transactions</PrimaryButton>
          <button type="button" onClick={() => setPdf(null)} className="mt-3 w-full py-2 text-sm font-semibold text-muted">
            Choose a different file
          </button>
        </>
      ) : !loaded ? (
        <>
          <p className="text-[15px] text-muted">
            Download a statement from your bank as a <strong>PDF</strong> (Revolut, Bank of Cyprus…) or a <strong>CSV</strong>,
            then pick it here. Importing the same statement twice won&apos;t double count anything.
          </p>
          <p className="mt-2 text-[13px] text-muted">
            A CSV is read on this device. A PDF is read by Meraki&apos;s assistant (Claude) and isn&apos;t kept anywhere.
          </p>
          <label
            className={`mt-5 block rounded-2xl border-2 border-dashed border-line bg-cream py-8 text-center font-semibold ${
              reading ? "pointer-events-none text-muted" : "cursor-pointer"
            }`}
          >
            {reading ? "Reading your statement… this can take a minute" : "Choose PDF or CSV file"}
            <input
              type="file"
              accept=".pdf,.csv,application/pdf,text/csv"
              className="hidden"
              disabled={reading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
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

          <PrimaryButton disabled={!mapOk || !preview?.lines.length} onClick={() => setChecking(true)}>
            Next: {preview?.lines.length ?? 0} transactions
          </PrimaryButton>
          <button type="button" onClick={() => setLoaded(null)} className="mt-3 w-full py-2 text-sm font-semibold text-muted">
            Choose a different file
          </button>
        </>
      )}
    </Sheet>
  );
}
