"use client";

// Importing bank statements, as its own page: pick one or more statements (PDF or CSV, any mix of
// banks), check them together on one screen, add them. PDFs are read by Claude in the meraki worker;
// CSVs are read here, with the columns remembered per bank layout.

import Link from "next/link";
import { useState } from "react";
import {
  allCategories,
  findHeader,
  guessColumns,
  headerSignature,
  money,
  parseCsv,
  readStatement,
  type CategoryId,
  type ColumnMap,
  type LineDetail,
  type ParsedLine,
} from "@/lib/finance";
import { useFinance, type ImportResult } from "@/lib/financeStore";
import { workerPost } from "@/lib/worker";
import { Icon } from "../icons";
import { StatementReview } from "./StatementReview";
import { Card, PrimaryButton } from "./ui";

type Csv = { rows: string[][]; header: string[]; signature: string; map: ColumnMap; known: boolean };

/** One chosen file, from reading to ready. */
type Statement = {
  id: number;
  fileName: string;
  state: "reading" | "ready" | "error";
  error?: string;
  bank?: string;
  currency?: string;
  pdfLines?: ParsedLine[];
  csv?: Csv;
};

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
    details?: LineDetail[];
  }[];
};

async function readPdfStatement(file: File) {
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
        details: Array.isArray(l.details) ? l.details.filter((d) => d?.label && d?.value).map((d) => ({ label: String(d.label), value: String(d.value) })) : undefined,
      }),
    );
  if (lines.length === 0) throw new Error("Couldn't find any transactions in it.");
  return { bank: r.bank, currency: r.currency, lines };
}

const FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount (one column, minus = money out)" },
  { key: "moneyOut", label: "…or Money out" },
  { key: "moneyIn", label: "…and Money in" },
];

const columnsOk = (m: ColumnMap) => m.date >= 0 && m.description >= 0 && (m.amount >= 0 || m.moneyOut >= 0 || m.moneyIn >= 0);

/** A statement's lines, each marked with the statement it came from. */
function linesOf(s: Statement): ParsedLine[] {
  const account = s.bank || s.fileName.replace(/\.(pdf|csv)$/i, "");
  const lines = s.pdfLines ?? (s.csv ? readStatement(s.csv.rows, s.csv.map, s.csv.header).lines : []);
  return lines.map((l) => ({ ...l, account }));
}

let nextId = 1;

export function ImportPage() {
  const { importLines, importProfiles } = useFinance();
  const [list, setList] = useState<Statement[]>([]);
  const [step, setStep] = useState<"files" | "check">("files");
  const [result, setResult] = useState<ImportResult | null>(null);

  const update = (id: number, patch: Partial<Statement>) => setList((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  async function add(files: File[]) {
    for (const file of files) {
      const id = nextId++;
      setList((l) => [...l, { id, fileName: file.name, state: "reading" }]);
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        // PDFs are read side by side; each takes up to a minute.
        readPdfStatement(file)
          .then((r) => update(id, { state: "ready", bank: r.bank, currency: r.currency, pdfLines: r.lines }))
          .catch((e) => update(id, { state: "error", error: e instanceof Error ? e.message : "Couldn't read that statement." }));
        continue;
      }
      const all = parseCsv(await file.text());
      if (all.length < 2) {
        update(id, { state: "error", error: "That file doesn't look like a statement. Pick the PDF or CSV your bank gives you." });
        continue;
      }
      const h = findHeader(all);
      const header = all[h];
      const signature = headerSignature(header);
      const known = !!importProfiles[signature];
      const map = importProfiles[signature] ?? guessColumns(header);
      update(id, { state: "ready", csv: { rows: all.slice(h + 1), header, signature, map, known } });
    }
  }

  const ready = list.filter((s) => s.state === "ready");
  const reading = list.some((s) => s.state === "reading");
  const csvToFix = ready.filter((s) => s.csv && !columnsOk(s.csv.map));
  const lines = ready.flatMap(linesOf);
  const sources = ready.map((s) => s.bank || s.fileName);

  if (result) {
    return (
      <Card className="text-center">
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
        <p className="mt-3 text-[15px] text-muted">Tap any transaction in Spending to see its details or fix its category.</p>
        <Link href="/finances/#spending" className="mt-5 block rounded-2xl bg-ink py-3.5 font-bold text-cream">
          Done
        </Link>
      </Card>
    );
  }

  if (step === "check" && lines.length > 0) {
    return (
      <Card>
        <StatementReview
          sources={sources}
          lines={lines}
          onImport={(sorted, rules, bills) => {
            const profiles = ready.filter((s) => s.csv).map((s) => ({ signature: s.csv!.signature, map: s.csv!.map }));
            setResult(importLines(sorted, profiles, rules, bills));
            window.scrollTo(0, 0);
          }}
          onBack={() => setStep("files")}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-[15px] text-muted">
          Download statements from your banks as <strong>PDF</strong> (Revolut, Bank of Cyprus…) or <strong>CSV</strong>, then add them
          here, as many as you like. You check them all together before anything is added, and importing the same statement twice
          won&apos;t double count anything.
        </p>
        <p className="mt-2 text-[13px] text-muted">
          A CSV is read on this device. A PDF is read by Meraki&apos;s assistant (Claude) and isn&apos;t kept anywhere.
        </p>
        <label className="mt-4 block cursor-pointer rounded-2xl border-2 border-dashed border-line bg-cream py-7 text-center font-semibold">
          {list.length ? "+ Add another statement" : "Choose statements (PDF or CSV)"}
          <input
            type="file"
            multiple
            accept=".pdf,.csv,application/pdf,text/csv"
            className="hidden"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              if (files.length) void add(files);
            }}
          />
        </label>
      </Card>

      {list.map((s) => (
        <Card key={s.id}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{s.bank || s.fileName}</p>
              <p className="truncate text-[13px] text-muted">
                {s.state === "reading" && "Reading… this can take a minute"}
                {s.state === "error" && <span className="text-peach">{s.error}</span>}
                {s.state === "ready" && (
                  <>
                    {s.bank ? `${s.fileName} · ` : ""}
                    {linesOf(s).length} transactions
                    {s.pdfLines && s.pdfLines.some((l) => l.transfer) ? `, ${s.pdfLines.filter((l) => l.transfer).length} between your own accounts` : ""}
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setList((l) => l.filter((x) => x.id !== s.id))}
              aria-label={`Remove ${s.fileName}`}
              className="shrink-0 px-2 text-muted"
            >
              ✕
            </button>
          </div>
          {s.currency && s.currency.toUpperCase() !== "EUR" && (
            <p className="mt-2 text-[13px] text-peach">This is a {s.currency} account. Amounts are added as they are, not converted to euros.</p>
          )}
          {s.csv && <CsvColumns csv={s.csv} onChange={(map) => update(s.id, { csv: { ...s.csv!, map } })} />}
          {s.state === "ready" && (
            <ul className="mt-3 divide-y divide-line rounded-2xl bg-cream px-3">
              {linesOf(s)
                .slice(0, 3)
                .map((l, i) => (
                  <li key={i} className="flex gap-3 py-2 text-sm">
                    <span className="w-20 shrink-0 text-muted">{l.date}</span>
                    <span className="min-w-0 flex-1 truncate">{l.description}</span>
                    <span className="shrink-0 font-semibold">{money(l.amount)}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      ))}

      {list.length > 0 && (
        <PrimaryButton disabled={reading || csvToFix.length > 0 || lines.length === 0} onClick={() => setStep("check")}>
          {reading
            ? "Still reading…"
            : `Next: check ${lines.length} transactions${ready.length > 1 ? ` from ${ready.length} statements` : ""}`}
        </PrimaryButton>
      )}
    </div>
  );
}

/** Which column is which, for a CSV layout seen for the first time (folded away once it's known). */
function CsvColumns({ csv, onChange }: { csv: Csv; onChange: (map: ColumnMap) => void }) {
  const [open, setOpen] = useState(!csv.known || !columnsOk(csv.map));
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-[13px] font-semibold text-sage-dark">
        Using the columns you chose last time · change
      </button>
    );
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[13px] text-muted">Check the columns are right:</p>
      {FIELDS.map((f) => (
        <label key={f.key} className="flex items-center gap-3 text-sm">
          <span className="w-40 shrink-0 text-muted">{f.label}</span>
          <select
            value={csv.map[f.key]}
            onChange={(e) => onChange({ ...csv.map, [f.key]: Number(e.target.value) })}
            className="min-w-0 flex-1 rounded-xl bg-cream px-3 py-2"
          >
            <option value={-1}>—</option>
            {csv.header.map((h, i) => (
              <option key={i} value={i}>
                {h || `Column ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
