"use client";

// Groceries: snap a receipt, Claude reads it (via the meraki-receipts worker),
// check it, save. Then see receipts by month, each item's price history, and
// spending per shop.

import { useState } from "react";
import { money } from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import {
  GROCERY_CATEGORIES,
  perUnit,
  photoToBase64,
  priceHistory,
  readReceipt,
  type Receipt,
  type ReceiptItem,
} from "@/lib/groceries";
import { useGroceries } from "@/lib/groceriesStore";
import { dayKey } from "@/lib/store";
import { Card, CardTitle, Chips, DangerButton, Label, MoneyInput, PrimaryButton, Sheet, inputClass } from "../finance/ui";

const TABS = ["Receipts", "Prices", "Shops"] as const;
type Tab = (typeof TABS)[number];

function niceDate(key: string) {
  return key
    ? new Date(key + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
    : "No date";
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function GroceriesView({ now }: { now: Date }) {
  const { receipts, reader } = useGroceries();
  const [tab, setTab] = useState<Tab>("Receipts");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<(Omit<Receipt, "id"> & { id?: string }) | null>(null);
  const [setup, setSetup] = useState(false);
  const connected = !!reader.url && !!reader.passcode;

  async function onPhoto(file: File) {
    setError(null);
    setReading(true);
    try {
      const image = await photoToBase64(file);
      const read = await readReceipt(reader, image);
      setReview({ ...read, date: read.date || dayKey(now) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that receipt.");
    } finally {
      setReading(false);
    }
  }

  const thisMonth = dayKey(now).slice(0, 7);
  const monthTotal = receipts.filter((r) => r.date.startsWith(thisMonth)).reduce((t, r) => t + r.total, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between md:mt-4">
        <h1 className="text-[26px] font-bold md:text-3xl">Groceries</h1>
        {connected && (
          <button type="button" onClick={() => setSetup(true)} className="text-sm font-semibold text-sage-dark">
            Reader settings
          </button>
        )}
      </div>

      <Card className="mt-4">
        <p className="text-sm text-muted">This month</p>
        <p className="text-[32px] font-bold leading-tight">{money(monthTotal)}</p>
        {connected ? (
          <label
            className={`mt-4 block cursor-pointer rounded-2xl py-4 text-center text-[17px] font-bold text-white ${
              reading ? "bg-sage" : "bg-sage-dark"
            }`}
          >
            {reading ? "Reading your receipt…" : "📷 Snap a receipt"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={reading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void onPhoto(f);
              }}
            />
          </label>
        ) : (
          <PrimaryButton onClick={() => setSetup(true)}>Set up the receipt reader</PrimaryButton>
        )}
        {error && <p className="mt-3 text-[15px] text-peach">{error}</p>}
        <button
          type="button"
          onClick={() => setReview({ shop: "", date: dayKey(now), total: 0, discounts: 0, items: [] })}
          className="mt-3 w-full py-1 text-sm font-semibold text-muted"
        >
          or type one in
        </button>
      </Card>

      {/* Prices and Shops only mean something once there are receipts. */}
      {receipts.length > 0 && (
      <div className="mt-4 flex gap-1 rounded-full bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-sm ${tab === t ? "bg-ink font-bold text-cream" : "text-ink/70"}`}
          >
            {t}
          </button>
        ))}
      </div>
      )}

      <div className="mt-4">
        {tab === "Receipts" && <ReceiptList onOpen={(r) => setReview(r)} />}
        {tab === "Prices" && <Prices />}
        {tab === "Shops" && <Shops now={now} />}
      </div>

      {review && <ReviewSheet receipt={review} onClose={() => setReview(null)} />}
      {setup && <ReaderSheet onClose={() => setSetup(false)} />}
    </div>
  );
}

function ReceiptList({ onOpen }: { onOpen: (r: Receipt) => void }) {
  const { receipts } = useGroceries();
  if (receipts.length === 0) {
    return (
      <Card>
        <p className="text-muted">No receipts yet. Snap one after your next shop.</p>
      </Card>
    );
  }
  const sorted = [...receipts].sort((a, b) => b.date.localeCompare(a.date));
  const byMonth = new Map<string, Receipt[]>();
  for (const r of sorted) byMonth.set(r.date.slice(0, 7), [...(byMonth.get(r.date.slice(0, 7)) ?? []), r]);
  return (
    <div className="grid gap-4">
      {[...byMonth.entries()].map(([key, list]) => (
        <Card key={key}>
          <CardTitle action={<span className="font-semibold">{money(list.reduce((t, r) => t + r.total, 0))}</span>}>
            {monthLabel(key)}
          </CardTitle>
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r)} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{r.shop || "Receipt"}</span>
                    <span className="block text-[13px] text-muted">
                      {niceDate(r.date)} · {r.items.length} {r.items.length === 1 ? "item" : "items"}
                    </span>
                  </span>
                  <span className="text-[15px] font-semibold">{money(r.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function Prices() {
  const { receipts } = useGroceries();
  const [q, setQ] = useState("");
  const items = priceHistory(receipts).filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Card>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an item, e.g. milk" className={inputClass} />
      {items.length === 0 ? (
        <p className="py-4 text-muted">{receipts.length ? "No match." : "Prices show up here once you've saved receipts."}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {items.slice(0, 60).map((i) => {
            const last = i.buys[0];
            const cheapest = [...i.buys].sort((a, b) => perUnit(a) - perUnit(b))[0];
            return (
              <li key={i.name} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[15px] font-semibold">{i.name}</span>
                  <span className="shrink-0 text-[15px] font-semibold">{money(last.price)}</span>
                </div>
                <p className="text-[13px] text-muted">
                  Last: {last.shop}, {niceDate(last.date)}
                  {i.buys.length > 1 && cheapest.shop !== last.shop
                    ? ` · cheapest at ${cheapest.shop} (${money(perUnit(cheapest))}${cheapest.unitPrice !== null && cheapest.quantity !== 1 ? "/unit" : ""})`
                    : ""}
                  {i.buys.length > 1 ? ` · bought ${i.buys.length}×` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Shops({ now }: { now: Date }) {
  const { receipts } = useGroceries();
  const thisMonth = dayKey(now).slice(0, 7);
  const shops = new Map<string, { month: number; all: number; visits: number }>();
  for (const r of receipts) {
    const s = shops.get(r.shop || "Other") ?? { month: 0, all: 0, visits: 0 };
    s.all += r.total;
    s.visits += 1;
    if (r.date.startsWith(thisMonth)) s.month += r.total;
    shops.set(r.shop || "Other", s);
  }
  const list = [...shops.entries()].sort((a, b) => b[1].month - a[1].month || b[1].all - a[1].all);
  return (
    <Card>
      <CardTitle>Spending by shop</CardTitle>
      {list.length === 0 ? (
        <p className="text-muted">Nothing yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map(([shop, s]) => (
            <li key={shop} className="flex items-center gap-3 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{shop}</span>
                <span className="block text-[13px] text-muted">
                  {s.visits} {s.visits === 1 ? "visit" : "visits"} · {money(s.all)} in total
                </span>
              </span>
              <span className="shrink-0 text-right text-[15px] font-semibold">
                {money(s.month)}
                <span className="block text-xs font-normal text-muted">this month</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const CATEGORY_CHOICES = GROCERY_CATEGORIES.map((c) => ({ id: c.id, label: c.label }));

/** Check what was read, fix anything, save. */
function ReviewSheet({ receipt, onClose }: { receipt: Omit<Receipt, "id"> & { id?: string }; onClose: () => void }) {
  const { saveReceipt, deleteReceipt } = useGroceries();
  const { has, addTxn } = useFinance();
  const [shop, setShop] = useState(receipt.shop);
  const [date, setDate] = useState(receipt.date);
  const [total, setTotal] = useState<number | null>(receipt.total || null);
  const [items, setItems] = useState<ReceiptItem[]>(receipt.items);
  const [editing, setEditing] = useState<number | null>(null);
  // If bank statements are imported, the same shop already shows up there.
  const [toMoney, setToMoney] = useState(!receipt.id && !has("imports"));

  const itemsSum = items.reduce((t, i) => t + i.price, 0) - receipt.discounts;
  const mismatch = total !== null && Math.abs(itemsSum - total) > 0.05;

  function update(i: number, patch: Partial<ReceiptItem>) {
    setItems((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  return (
    <Sheet title={receipt.id ? "Receipt" : "Check your receipt"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Shop</Label>
          <input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="e.g. Lidl" className={inputClass} />
        </div>
        <div>
          <Label>Date</Label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      <Label>Items ({items.length})</Label>
      <ul className="divide-y divide-line rounded-2xl bg-cream px-3">
        {items.map((it, i) =>
          editing === i ? (
            <li key={i} className="space-y-2 py-3">
              <input value={it.name} onChange={(e) => update(i, { name: e.target.value })} className={inputClass} aria-label="Item name" />
              <MoneyInput value={it.price} onChange={(v) => update(i, { price: v ?? 0 })} label="Item price" />
              <Chips options={CATEGORY_CHOICES} value={it.category} onChange={(category) => update(i, { category })} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl bg-ink py-2 text-sm font-bold text-cream">
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setItems((l) => l.filter((_, j) => j !== i));
                    setEditing(null);
                  }}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-rose"
                >
                  Remove
                </button>
              </div>
            </li>
          ) : (
            <li key={i}>
              <button type="button" onClick={() => setEditing(i)} className="flex w-full items-center gap-3 py-2.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px]">{it.name}</span>
                  {it.original && it.original !== it.name && <span className="block truncate text-xs text-muted">{it.original}</span>}
                </span>
                <span className="shrink-0 text-[15px] font-semibold">{money(it.price)}</span>
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            onClick={() => {
              setItems((l) => [...l, { name: "", original: "", quantity: 1, unitPrice: null, price: 0, category: "groceries" }]);
              setEditing(items.length);
            }}
            className="w-full py-2.5 text-left text-sm font-semibold text-sage-dark"
          >
            + Add an item
          </button>
        </li>
      </ul>
      {receipt.discounts > 0 && <p className="mt-1 text-xs text-muted">Discounts: −{money(receipt.discounts)}</p>}

      <Label>Total paid</Label>
      <MoneyInput value={total} onChange={setTotal} label="Total" />
      {mismatch && (
        <p className="mt-1 text-xs text-peach">
          Items add up to {money(itemsSum)}. Check for a missing or misread line.
        </p>
      )}

      {!receipt.id && (
        <label className="mt-4 flex items-center gap-3 rounded-2xl bg-cream px-4 py-3">
          <input type="checkbox" checked={toMoney} onChange={(e) => setToMoney(e.target.checked)} className="size-5 accent-sage" />
          <span className="text-[15px]">
            Also add to Money as Groceries
            {has("imports") && <span className="block text-xs text-muted">Leave off if this shop is on your bank statements, so it isn&apos;t counted twice.</span>}
          </span>
        </label>
      )}

      <PrimaryButton
        disabled={total === null || items.length === 0}
        onClick={() => {
          const clean = items.filter((i) => i.name.trim());
          saveReceipt({ ...receipt, shop: shop.trim(), date, total: total ?? itemsSum, items: clean });
          if (toMoney && total) addTxn({ date, description: shop.trim() || "Groceries", amount: -total, category: "groceries" });
          onClose();
        }}
      >
        {receipt.id ? "Save" : "Save receipt"}
      </PrimaryButton>
      {receipt.id && (
        <DangerButton
          label="Delete receipt"
          onConfirm={() => {
            deleteReceipt(receipt.id!);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function ReaderSheet({ onClose }: { onClose: () => void }) {
  const { reader, setReader } = useGroceries();
  const [url, setUrl] = useState(reader.url);
  const [passcode, setPasscode] = useState(reader.passcode);
  return (
    <Sheet title="Receipt reader" onClose={onClose}>
      <p className="text-[15px] text-muted">
        Receipts are read by your own small server (the <strong>meraki-receipts</strong> Cloudflare worker), which asks
        Claude. Paste its address and the passcode you set there.
      </p>
      <Label>Worker address</Label>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://meraki-receipts.….workers.dev"
        className={inputClass}
        inputMode="url"
        autoCapitalize="off"
      />
      <Label>Passcode</Label>
      <input
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        type="password"
        placeholder="The MERAKI_KEY you chose"
        className={inputClass}
      />
      <p className="mt-2 text-xs text-muted">Saved on this device only. Each receipt costs a few cents of Claude usage.</p>
      <PrimaryButton
        disabled={!url.trim() || !passcode}
        onClick={() => {
          setReader({ url: url.trim(), passcode });
          onClose();
        }}
      >
        Save
      </PrimaryButton>
    </Sheet>
  );
}
