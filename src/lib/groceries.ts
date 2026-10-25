// Groceries: receipts read by the meraki worker (Claude), plus the
// helpers for item prices and shops.

import { accessToken } from "./sync";

export type GroceryCategory = "groceries" | "household" | "pet" | "personal" | "other";

export const GROCERY_CATEGORIES: { id: GroceryCategory; label: string }[] = [
  { id: "groceries", label: "Food & drink" },
  { id: "household", label: "Household" },
  { id: "pet", label: "Pari" },
  { id: "personal", label: "Personal" },
  { id: "other", label: "Other" },
];

export type ReceiptItem = {
  name: string;
  original: string;
  quantity: number;
  unitPrice: number | null;
  price: number;
  category: GroceryCategory;
};

export type Receipt = {
  id: string;
  shop: string;
  date: string; // "YYYY-MM-DD"
  total: number;
  discounts: number;
  items: ReceiptItem[];
  txnId?: string; // set when it was also added to Money
};

export type ReaderSettings = { url: string; passcode: string };

/** What the worker returns (snake_case, straight from the schema). */
type Read = {
  shop: string;
  date: string;
  total: number;
  discounts: number;
  items: { name: string; original: string; quantity: number; unit_price: number | null; price: number; category: GroceryCategory }[];
};

/** Shrinks a camera photo to ~1600 px JPEG (enough to read small print) and returns base64. */
export async function photoToBase64(file: File, max = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

/** The meraki worker (workers/receipts), which asks Claude to read the photo. */
const READER_URL = "https://meraki.constantinouioanna7.workers.dev";

/** Sends the photo to the receipt reader. Throws an Error with a friendly message. */
export async function readReceipt(image: string): Promise<Omit<Receipt, "id">> {
  // The worker only reads receipts for someone signed in to Meraki (Settings > Sync).
  const token = await accessToken();
  if (!token) throw new Error("Sign in under Settings → Sync to read receipts.");
  let res: Response;
  try {
    res = await fetch(`${READER_URL}/read`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ image }),
    });
  } catch {
    throw new Error("Couldn't reach the receipt reader. Check your connection and try again.");
  }
  const body = (await res.json().catch(() => ({}))) as Partial<Read> & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `The receipt reader said no (${res.status}).`);
  const r = body as Read;
  return {
    shop: r.shop,
    date: r.date,
    total: r.total,
    discounts: r.discounts,
    items: r.items.map((i) => ({
      name: i.name,
      original: i.original,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      price: i.price,
      category: i.category,
    })),
  };
}

/** Item price history: every time an item was bought, newest first. Matches on the English name. */
export function priceHistory(receipts: Receipt[]) {
  const map = new Map<string, { name: string; buys: { date: string; shop: string; price: number; unitPrice: number | null; quantity: number }[] }>();
  for (const r of receipts) {
    for (const i of r.items) {
      const key = i.name.trim().toLowerCase();
      const entry = map.get(key) ?? { name: i.name.trim(), buys: [] };
      entry.buys.push({ date: r.date, shop: r.shop, price: i.price, unitPrice: i.unitPrice, quantity: i.quantity });
      map.set(key, entry);
    }
  }
  for (const e of map.values()) e.buys.sort((a, b) => b.date.localeCompare(a.date));
  return [...map.values()].sort((a, b) => b.buys.length - a.buys.length || a.name.localeCompare(b.name));
}

/** Price of one unit (per item, or per kg), so buys of different sizes compare fairly. */
export function perUnit(b: { price: number; unitPrice: number | null; quantity: number }) {
  return b.unitPrice ?? (b.quantity > 0 ? b.price / b.quantity : b.price);
}
