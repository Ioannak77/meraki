// Money: what Ioanna tracks, bills and their due dates, pay periods,
// spending categories and reading bank statement CSVs.
// Everything stays on this device; nothing is sent anywhere.

import { today } from "./clock";
import { dayKey } from "./store";

// ---------- What to track ----------

export const MODULES = [
  { id: "income", label: "Monthly income and payday" },
  { id: "bills", label: "Recurring bills and payment due dates" },
  { id: "home", label: "Rent, utilities and common expenses" },
  { id: "subscriptions", label: "Subscriptions and annual renewals" },
  { id: "insurance", label: "Insurance premiums" },
  { id: "pet", label: "Pet expenses and budget" },
  { id: "groceries", label: "Groceries and household spending" },
  { id: "imports", label: "Bank statement imports and transaction categorisation" },
  { id: "allowance", label: "Weekly spending allowance" },
  { id: "savings", label: "Savings goals and emergency fund" },
  { id: "loans", label: "Loans, repayments and interest" },
  { id: "summary", label: "Monthly financial summary and payday forecast" },
] as const;
export type ModuleId = (typeof MODULES)[number]["id"];

// ---------- Categories ----------

export type CategoryId =
  | "groceries"
  | "household"
  | "pet"
  | "eating_out"
  | "transport"
  | "shopping"
  | "health"
  | "personal"
  | "fun"
  | "bills"
  | "income"
  | "transfer"
  | "other";

export const CATEGORIES: { id: CategoryId; label: string; color: string; counts: boolean }[] = [
  { id: "groceries", label: "Groceries", color: "#5e8c61", counts: true },
  { id: "household", label: "Household", color: "#8fb48f", counts: true },
  { id: "pet", label: "Pari", color: "#f0a37f", counts: true },
  { id: "eating_out", label: "Eating out", color: "#e3a0a6", counts: true },
  { id: "transport", label: "Transport", color: "#7fa7cf", counts: true },
  { id: "shopping", label: "Shopping", color: "#b39ddb", counts: true },
  { id: "health", label: "Health and beauty", color: "#f4b860", counts: true },
  { id: "personal", label: "Personal", color: "#c9a27e", counts: true },
  { id: "fun", label: "Going out and fun", color: "#d98aa5", counts: true },
  { id: "other", label: "Other", color: "#a8a29a", counts: true },
  // These are tracked elsewhere, so they don't count as "spending".
  { id: "bills", label: "Bills (tracked in Bills)", color: "#6b6560", counts: false },
  { id: "income", label: "Income", color: "#3f6b46", counts: false },
  { id: "transfer", label: "Transfer between my accounts", color: "#bdb5aa", counts: false },
];

export function category(id: CategoryId) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES.find((c) => c.id === "other")!;
}

/** Day-to-day spending categories (what an allowance or "spent so far" covers). */
export const SPENDING_CATEGORIES = CATEGORIES.filter((c) => c.counts).map((c) => c.id);

/** Starter keywords (lower case) for sorting bank lines; learned rules come first. */
const DEFAULT_RULES: { match: string; category: CategoryId }[] = [
  ...["alphamega", "lidl", "sklavenitis", "metro", "carrefour", "supermarket", "papantoniou", "bakery", "fresh"].map(
    (m) => ({ match: m, category: "groceries" as const }),
  ),
  ...["ikea", "jumbo", "superhome", "homemarket", "cleaning"].map((m) => ({ match: m, category: "household" as const })),
  ...["pet", "vet", "zoo", "dog"].map((m) => ({ match: m, category: "pet" as const })),
  ...["wolt", "foody", "bolt food", "restaurant", "cafe", "coffee", "starbucks", "costa", "mcdonald", "kfc", "pizza"].map(
    (m) => ({ match: m, category: "eating_out" as const }),
  ),
  ...["petrol", "esso", "shell", "eko", "agip", "bolt", "uber", "taxi", "osypa", "parking", "bus"].map((m) => ({
    match: m,
    category: "transport" as const,
  })),
  ...["amazon", "zara", "h&m", "shein", "temu", "ebay", "skroutz", "public", "stephanis"].map((m) => ({
    match: m,
    category: "shopping" as const,
  })),
  ...["pharmacy", "farmakeio", "doctor", "clinic", "hospital", "sephora", "hondos", "beauty", "salon", "hair"].map((m) => ({
    match: m,
    category: "health" as const,
  })),
  ...["cinema", "theatre", "concert", "bar ", "club"].map((m) => ({ match: m, category: "fun" as const })),
  ...["salary", "payroll", "wages"].map((m) => ({ match: m, category: "income" as const })),
  ...["transfer to", "transfer from", "own account", "revolut top", "top-up", "topup"].map((m) => ({
    match: m,
    category: "transfer" as const,
  })),
];

export type Rule = { match: string; category: CategoryId };

/** Pick a category for a bank line: your own rules, then bills, then the starter keywords. */
export function categorise(description: string, amount: number, rules: Rule[], bills: Bill[]): CategoryId {
  const text = description.toLowerCase();
  for (const r of rules) if (text.includes(r.match)) return r.category;
  if (amount < 0 && bills.some((b) => text.includes(billKeyword(b)))) return "bills";
  for (const r of DEFAULT_RULES) if (text.includes(r.match)) return r.category;
  return amount > 0 ? "income" : "other";
}

/** A short, stable keyword for "always use this category for …" rules. */
export function ruleKeyword(description: string) {
  const words = description
    .toLowerCase()
    .replace(/[0-9*#/\\.,:;-]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !["pos", "card", "purchase", "payment", "visa", "debit", "contactless", "the"].includes(w));
  return words.slice(0, 2).join(" ") || description.toLowerCase().trim();
}

// ---------- Bills ----------

export type BillKind = "bill" | "rent" | "utility" | "common" | "subscription" | "insurance" | "loan";
export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

export const BILL_KINDS: { id: BillKind; label: string; module: ModuleId }[] = [
  { id: "rent", label: "Rent", module: "home" },
  { id: "utility", label: "Utility", module: "home" },
  { id: "common", label: "Common expenses", module: "home" },
  { id: "subscription", label: "Subscription", module: "subscriptions" },
  { id: "insurance", label: "Insurance", module: "insurance" },
  { id: "loan", label: "Loan repayment", module: "loans" },
  { id: "bill", label: "Other bill", module: "bills" },
];

export const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "quarterly", label: "Every 3 months" },
  { id: "weekly", label: "Weekly" },
];

export type Bill = {
  id: string;
  name: string;
  kind: BillKind;
  amount: number; // per payment, positive
  frequency: Frequency;
  firstDue: string; // "YYYY-MM-DD": any one due date; it repeats before and after it
  match?: string; // text on the bank statement, lower case (defaults to the name)
  loan?: { balance: number; rate: number }; // what's left to pay, yearly interest %
};

export function billKeyword(b: Bill) {
  return (b.match || b.name).toLowerCase().trim();
}

function parseDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addMonthsClamped(base: Date, months: number, day: number) {
  const target = new Date(base.getFullYear(), base.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(day, last));
}

/** Due dates of a bill between two days (inclusive). */
export function dueDates(b: Bill, from: Date, to: Date): Date[] {
  const first = parseDay(b.firstDue);
  const out: Date[] = [];
  if (b.frequency === "weekly") {
    const weeks = Math.ceil((from.getTime() - first.getTime()) / (7 * 86400000));
    for (let d = new Date(first.getFullYear(), first.getMonth(), first.getDate() + weeks * 7); d <= to; ) {
      if (d >= from) out.push(d);
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
    }
    return out;
  }
  const step = b.frequency === "monthly" ? 1 : b.frequency === "quarterly" ? 3 : 12;
  const monthsFromFirst = (from.getFullYear() - first.getFullYear()) * 12 + (from.getMonth() - first.getMonth());
  let k = Math.floor(monthsFromFirst / step) - 1;
  for (let i = 0; i < 400; i++, k++) {
    const d = addMonthsClamped(first, k * step, first.getDate());
    if (d > to) break;
    if (d >= from) out.push(d);
  }
  return out;
}

export function nextDue(b: Bill, from = today()) {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() + 1);
  return dueDates(b, start, end)[0] ?? null;
}

export function paidKey(b: Bill, due: Date) {
  return `${b.id}@${dayKey(due)}`;
}

/** What one bill costs per month on average (for yearly or quarterly ones). */
export function monthlyCost(b: Bill) {
  const perYear = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 }[b.frequency];
  return (b.amount * perYear) / 12;
}

// ---------- Pay period ----------

export type Income = { amount: number; payday: number }; // payday: day of month (1-31)

function clampDay(year: number, month: number, day: number) {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

/** From the last payday (inclusive) to the day before the next one. */
export function payPeriod(income: Income | null, d = today()) {
  const day = income?.payday ?? 1;
  let start = clampDay(d.getFullYear(), d.getMonth(), day);
  if (start > d) start = clampDay(d.getFullYear(), d.getMonth() - 1, day);
  const next = clampDay(start.getFullYear(), start.getMonth() + 1, day);
  const end = new Date(next);
  end.setDate(end.getDate() - 1);
  const todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysLeft = Math.round((next.getTime() - todayStart.getTime()) / 86400000);
  return { start, end, next, daysLeft };
}

export function weekRange(d = today()) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

export function monthRange(d = today()) {
  return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) };
}

export function inRange(key: string, start: Date, end: Date) {
  return key >= dayKey(start) && key <= dayKey(end);
}

// ---------- Transactions ----------

export type Txn = {
  id: string;
  date: string; // "YYYY-MM-DD"
  description: string;
  amount: number; // negative = money out
  category: CategoryId;
  source: "import" | "manual";
  hash: string; // for spotting duplicates when the same statement is imported twice
};

export function txnHash(date: string, amount: number, description: string) {
  return `${date}|${amount.toFixed(2)}|${description.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

export type Goal = { id: string; name: string; target: number; saved: number; emergency?: boolean };

// ---------- Money formatting ----------

const EUR = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const EUR_ROUND = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function money(n: number, round = false) {
  return (round ? EUR_ROUND : EUR).format(n);
}

/** Reads "12,50", "1.234,56", "€ 1,234.56", "-45" etc. Returns NaN if it isn't a number. */
export function parseAmount(raw: string): number {
  let s = raw.trim().replace(/[€$£\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!s) return NaN;
  const minus = s.endsWith("-") ? -1 : 1; // some banks write "45.00-"
  s = s.replace(/-$/, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma > -1) {
    s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n * minus : NaN;
}

/** Reads bank dates: 2026-10-20, 20/10/2026, 20-10-26, 20.10.2026, 20 Oct 2026. Day comes before month. */
export function parseBankDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return fmt(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return fmt(year, +m[2], +m[1]);
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  return null;
}

function fmt(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ---------- CSV ----------

/** Splits CSV text into rows. Handles quotes, and comma / semicolon / tab separators. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const sep = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

export type ColumnMap = { date: number; description: number; amount: number; moneyOut: number; moneyIn: number };

/**
 * Banks often put a few info lines above the real table. The header is the
 * first row that has a date-like and an amount-like column name.
 */
export function findHeader(rows: string[][]) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const names = rows[i].map((c) => c.toLowerCase());
    if (names.some((n) => n.includes("date")) && names.some((n) => /amount|debit|credit|withdraw|deposit|paid|money/.test(n)))
      return i;
  }
  return 0;
}

export function guessColumns(header: string[]): ColumnMap {
  const names = header.map((h) => h.toLowerCase().trim());
  const find = (...words: string[]) => names.findIndex((n) => words.some((w) => n.includes(w)));
  const date = find("transaction date", "date", "posted", "value date");
  const description = find("description", "details", "narrative", "merchant", "payee", "reference", "particulars", "name");
  const amount = names.findIndex((n) => n === "amount" || (n.includes("amount") && !/balance/.test(n)));
  const exact = (...words: string[]) => names.findIndex((n) => words.includes(n));
  const pick = (a: number, b: number) => (a >= 0 ? a : b);
  const moneyOut = pick(find("debit", "withdraw", "paid out", "money out"), exact("out"));
  const moneyIn = pick(find("credit", "deposit", "paid in", "money in"), exact("in"));
  return { date, description, amount, moneyOut: amount >= 0 ? -1 : moneyOut, moneyIn: amount >= 0 ? -1 : moneyIn };
}

export function headerSignature(header: string[]) {
  return header.map((h) => h.toLowerCase().trim()).join("|");
}

export type ParsedLine = { date: string; description: string; amount: number };

/** Turns statement rows into lines; rows that can't be read are counted, not guessed. */
export function readStatement(rows: string[][], map: ColumnMap) {
  const lines: ParsedLine[] = [];
  let unreadable = 0;
  for (const r of rows) {
    const date = parseBankDate(r[map.date] ?? "");
    const description = (r[map.description] ?? "").trim();
    let amount = NaN;
    if (map.amount >= 0) amount = parseAmount(r[map.amount] ?? "");
    else {
      const out = parseAmount(r[map.moneyOut] ?? "");
      const inn = parseAmount(r[map.moneyIn] ?? "");
      if (Number.isFinite(out) && out !== 0) amount = -Math.abs(out);
      else if (Number.isFinite(inn) && inn !== 0) amount = Math.abs(inn);
    }
    if (!date || !Number.isFinite(amount) || amount === 0) {
      unreadable++;
      continue;
    }
    lines.push({ date, description: description || "(no description)", amount });
  }
  return { lines, unreadable };
}
