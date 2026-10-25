// Three-way merge for sync: given what both devices last agreed on (`base`), this device's
// version and the cloud's, keep the changes from both sides.
//
// - Objects merge key by key (a key removed on one side and untouched on the other is removed).
// - Lists of things with an `id` (tasks, bills, receipts…) merge item by item.
// - Lists of plain values (ticked steps, office days) keep what either side added and drop what
//   either side removed.
// - When both sides changed the very same value, this device's version wins.

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isObject = (v: unknown): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);
const hasIds = (v: unknown): v is { id: string }[] =>
  Array.isArray(v) && v.every((x) => isObject(x) && typeof x.id === "string");
const isPlainList = (v: unknown): v is (string | number | boolean | null)[] =>
  Array.isArray(v) && v.every((x) => x === null || typeof x !== "object");

export function merge3(base: unknown, mine: unknown, theirs: unknown): unknown {
  if (same(mine, theirs)) return mine;
  if (same(base, mine)) return theirs;
  if (same(base, theirs)) return mine;

  if (isObject(mine) && isObject(theirs)) {
    const b = isObject(base) ? base : {};
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
      const v = merge3(b[k], mine[k], theirs[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  if (hasIds(mine) && hasIds(theirs)) {
    const b = hasIds(base) ? base : [];
    const byId = (list: { id: string }[]) => new Map(list.map((x) => [x.id, x]));
    const [bm, mm, tm] = [byId(b), byId(mine), byId(theirs)];
    const order = [...mine.map((x) => x.id), ...theirs.map((x) => x.id).filter((id) => !mm.has(id))];
    return order.map((id) => merge3(bm.get(id), mm.get(id), tm.get(id))).filter((x) => x !== undefined);
  }

  if (isPlainList(mine) && isPlainList(theirs)) {
    const b = isPlainList(base) ? base : [];
    const removed = new Set([...b.filter((x) => !mine.includes(x)), ...b.filter((x) => !theirs.includes(x))]);
    const all = [...mine, ...theirs.filter((x) => !mine.includes(x))];
    return all.filter((x) => !removed.has(x));
  }

  // Both changed the same value (or one side removed it while the other changed it): keep this device's.
  return mine === undefined ? theirs : mine;
}
