"use client";

// Groceries > List: what to buy, with the cheapest shop for each item from your receipts,
// as one list (by aisle) or grouped by shop. Snapping the receipt ticks off what you bought.

import { useState } from "react";
import { money } from "@/lib/finance";
import {
  GROCERY_CATEGORIES,
  itemCategory,
  priceChange,
  priceHistory,
  shopPrices,
  type ListItem,
  type ShopPrice,
} from "@/lib/groceries";
import { useGroceries } from "@/lib/groceriesStore";
import { Icon } from "../icons";
import { Card, DangerButton, Sheet, inputClass } from "../finance/ui";

/** `snap`: the Snap a receipt button, shown under the list for when you're done shopping. */
export function ShoppingList({ snap }: { snap?: React.ReactNode }) {
  const { receipts, list, addToList, updateListItem, removeFromList, clearTicked } = useGroceries();
  const [text, setText] = useState("");
  const [byShop, setByShop] = useState(false);
  const [picking, setPicking] = useState<ListItem | null>(null);
  const history = priceHistory(receipts);
  const prices = new Map(list.map((i) => [i.id, shopPrices(i.name, history)]));
  // Where to buy it: your choice, else the cheapest shop seen on receipts.
  const shopOf = (i: ListItem) => i.shop ?? prices.get(i.id)?.[0]?.shop ?? null;
  const priceAt = (i: ListItem, shop: string | null) => prices.get(i.id)?.find((p) => p.shop === shop)?.price ?? null;
  const open = list.filter((i) => !i.done);
  // Things you buy often that aren't on the list yet, one tap to add.
  const often = history
    .filter(
      (h) =>
        h.buys.length >= 2 &&
        // "milk" on the list already covers "Semi-skimmed milk 1L".
        !open.some((i) => i.name.toLowerCase().split(/\s+/).every((w) => h.name.toLowerCase().includes(w))),
    )
    .slice(0, 8);
  const ticked = list.filter((i) => i.done);

  function add(e: React.FormEvent) {
    e.preventDefault();
    addToList(text);
    setText("");
  }

  const row = (i: ListItem) => {
    const shop = shopOf(i);
    const all = prices.get(i.id) ?? [];
    const price = priceAt(i, shop);
    const saving = all.length > 1 ? all[all.length - 1].price - all[0].price : 0;
    let note = "No price yet · tap to choose a shop";
    const here = all.find((p) => p.shop === shop);
    const change = here ? priceChange(here) : null;
    if (shop) {
      note = i.shop ? shop : `Cheapest at ${shop}`;
      if (price !== null) note += ` · ${money(price)}`;
      if (change) note += ` · ${change > 0 ? "↑" : "↓"} ${Math.abs(change)}%`;
      if (!i.shop && saving >= 0.05) note += ` · saves ${money(saving)}`;
    }
    return (
      <li key={i.id} className="flex items-center gap-3 py-2.5">
        <button
          type="button"
          onClick={() => updateListItem(i.id, { done: !i.done })}
          aria-pressed={i.done}
          aria-label={i.done ? "Not bought yet" : "Bought"}
          className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${i.done ? "border-sage bg-sage text-white" : "border-line bg-card"}`}
        >
          {i.done && <Icon.check className="size-4" />}
        </button>
        <button type="button" onClick={() => setPicking(i)} className="min-w-0 flex-1 text-left">
          <span className={`block text-[15px] ${i.done ? "text-muted line-through" : ""}`}>
            {i.name}
            {i.note && <span className="text-muted"> · {i.note}</span>}
          </span>
          <span className="block text-[13px] text-muted">{note}</span>
        </button>
      </li>
    );
  };

  const groups = new Map<string, ListItem[]>();
  for (const i of open) {
    const key = shopOf(i) ?? "Anywhere";
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  const grouped = [...groups.entries()].sort((a, b) =>
    a[0] === "Anywhere" ? 1 : b[0] === "Anywhere" ? -1 : b[1].length - a[1].length,
  );
  // One list, by aisle (from how your receipts categorised these items).
  const aisles = GROCERY_CATEGORIES.map((c) => ({
    label: c.label,
    items: open.filter((i) => (itemCategory(i.name, receipts) ?? "other") === c.id),
  })).filter((a) => a.items.length > 0);

  return (
    <>
      <Card>
        <form onSubmit={add} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add to the list, e.g. milk"
            list="grocery-names"
            enterKeyHint="done"
            className={inputClass}
          />
          <button type="submit" aria-label="Add" className="grid size-[52px] shrink-0 place-items-center rounded-2xl bg-sage-dark text-white">
            <Icon.plus className="size-5" />
          </button>
        </form>
        <datalist id="grocery-names">
          {history.slice(0, 200).map((h) => (
            <option key={h.name} value={h.name} />
          ))}
        </datalist>
        {often.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {often.map((h) => (
              <button key={h.name} type="button" onClick={() => addToList(h.name)} className="rounded-full bg-cream px-3 py-1.5 text-sm text-ink/80">
                + {h.name}
              </button>
            ))}
          </div>
        )}
      </Card>

      {list.length === 0 ? (
        <p className="mt-4 rounded-3xl bg-card/60 p-5 text-[15px] text-muted">
          Your list is empty. Add what you need, and Meraki shows which shop had it cheapest on your receipts.
        </p>
      ) : (
        <>
          {open.length > 0 && (
            <div className="mt-4 flex gap-1 rounded-full bg-card p-1">
              {(["One list", "By shop"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setByShop(v === "By shop")}
                  className={`flex-1 rounded-full py-2 text-sm ${byShop === (v === "By shop") ? "bg-sage-soft font-semibold text-sage-dark" : "text-ink/70"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          {byShop
            ? grouped.map(([shop, items]) => {
                const total = items.reduce((t, i) => t + (priceAt(i, shopOf(i)) ?? 0), 0);
                return (
                  <Card key={shop} className="mt-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-lg font-bold">{shop}</h3>
                      <span className="shrink-0 text-sm text-muted">
                        {items.length} {items.length === 1 ? "item" : "items"}
                        {total > 0 ? ` · about ${money(total)}` : ""}
                      </span>
                    </div>
                    <ul className="divide-y divide-line">{items.map(row)}</ul>
                  </Card>
                );
              })
            : open.length > 0 && (
                <Card className="mt-4">
                  {aisles.map((a) => (
                    <div key={a.label} className="mt-2 first:mt-0">
                      {aisles.length > 1 && <h3 className="pt-1 text-xs font-bold uppercase tracking-wider text-muted">{a.label}</h3>}
                      <ul className="divide-y divide-line">{a.items.map(row)}</ul>
                    </div>
                  ))}
                </Card>
              )}

          {snap && <div className="mt-4">{snap}</div>}

          {ticked.length > 0 && (
            <Card className="mt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-muted">In the basket · {ticked.length}</h3>
                <button type="button" onClick={clearTicked} className="text-sm font-semibold text-sage-dark">
                  Clear
                </button>
              </div>
              <ul className="divide-y divide-line">{ticked.map(row)}</ul>
            </Card>
          )}
        </>
      )}

      {picking && (
        <ShopPicker
          item={picking}
          prices={prices.get(picking.id) ?? []}
          shops={[...new Set(receipts.map((r) => r.shop.trim()).filter(Boolean))]}
          onPick={(shop) => {
            updateListItem(picking.id, { shop });
            setPicking(null);
          }}
          onNote={(note) => updateListItem(picking.id, { note: note || undefined })}
          onRemove={() => {
            removeFromList(picking.id);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}

/** Choose where to buy an item: the cheapest (default), or any shop from your receipts. */
function ShopPicker({
  item,
  prices,
  shops,
  onPick,
  onNote,
  onRemove,
  onClose,
}: {
  item: ListItem;
  prices: ShopPrice[];
  shops: string[];
  onPick: (shop: string | null) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const chosen = item.shop ?? null;
  const others = shops.filter((s) => !prices.some((p) => p.shop.toLowerCase() === s.toLowerCase()));
  const option = (label: string, shop: string | null, note?: string) => (
    <li key={label}>
      <button type="button" onClick={() => onPick(shop)} className="flex w-full items-center gap-3 py-3 text-left">
        <span className={`flex-1 text-[15px] ${chosen === shop ? "font-bold" : ""}`}>{label}</span>
        {note && <span className="text-[15px] text-muted">{note}</span>}
        {chosen === shop && <Icon.check className="size-5 text-sage-dark" />}
      </button>
    </li>
  );
  return (
    <Sheet title={item.name} onClose={onClose}>
      <input
        defaultValue={item.note ?? ""}
        onChange={(e) => onNote(e.target.value.trim())}
        placeholder="Amount or note, e.g. × 2, the lactose-free one"
        className={inputClass}
      />
      <p className="mt-4 text-[15px] text-muted">
        {prices.length > 0 ? "Latest price at each shop, from your receipts." : "No receipts with this yet. Choose where you'll get it."}
      </p>
      <ul className="mt-2 divide-y divide-line">
        {option(prices.length ? `Cheapest (${prices[0].shop})` : "Anywhere", null)}
        {prices.map((p) => {
          const change = priceChange(p);
          return option(p.shop, p.shop, `${money(p.price)}${change ? ` (${change > 0 ? "↑" : "↓"} ${Math.abs(change)}%)` : ""}`);
        })}
        {others.map((s) => option(s, s))}
      </ul>
      <DangerButton label="Remove from the list" onConfirm={onRemove} />
    </Sheet>
  );
}
