"use client";

// Today's + button: one place to add anything. A task opens the task sheet, a grocery item goes
// straight onto the shopping list, the rest open the right page ready to add.

import Link from "next/link";
import { useState } from "react";
import { useGroceries } from "@/lib/groceriesStore";
import { Icon, type IconName } from "./icons";
import { Sheet, inputClass } from "./finance/ui";

const LINKS: { href: string; label: string; note: string; icon: IconName; tone: string }[] = [
  { href: "/finances/#new-bill", label: "Bill", note: "Rent, a subscription, insurance…", icon: "bill", tone: "bg-peach-soft text-peach" },
  { href: "/groceries/#receipts", label: "Receipt", note: "Snap it and Meraki reads it", icon: "basket", tone: "bg-rose-soft text-rose" },
  { href: "/self-care/#reminders", label: "Self-care reminder", note: "Waxing, nails, hair…", icon: "heart", tone: "bg-sage-soft text-sage-dark" },
];

export function AddMenu({ onNewTask }: { onNewTask: () => void }) {
  const { addToList } = useGroceries();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  const row = "flex w-full items-center gap-3 py-3 text-left";
  const badge = (icon: IconName, tone: string) => {
    const I = Icon[icon];
    return (
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>
        <I className="size-5" />
      </span>
    );
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Add something"
        className="fixed bottom-24 right-5 z-10 grid size-14 place-items-center rounded-full bg-sage-dark text-white shadow-lg md:bottom-8 md:right-8"
      >
        <Icon.plus className="size-7" />
      </button>

      {open && (
        <Sheet
          title="Add"
          onClose={() => {
            setOpen(false);
            setAdded(null);
          }}
        >
          <ul className="divide-y divide-line">
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNewTask();
                }}
                className={row}
              >
                {badge("tasks", "bg-sky-soft text-sky")}
                <span className="flex-1">
                  <span className="block text-[16px] font-semibold">Task</span>
                  <span className="block text-[13px] text-muted">Something to do, with a date if you like</span>
                </span>
              </button>
            </li>
            <li className="py-3">
              <div className="flex items-center gap-3">
                {badge("basket", "bg-sun/20 text-sun")}
                <span className="flex-1">
                  <span className="block text-[16px] font-semibold">Grocery item</span>
                  <span className="block text-[13px] text-muted">{added ? `Added ${added} to your list ✓` : "Goes on your shopping list"}</span>
                </span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!item.trim()) return;
                  addToList(item);
                  setAdded(item.trim());
                  setItem("");
                }}
                className="mt-2 flex gap-2 pl-[52px]"
              >
                <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. milk" enterKeyHint="done" className={inputClass} />
                <button type="submit" disabled={!item.trim()} className="shrink-0 rounded-2xl bg-sage-dark px-4 font-bold text-white disabled:opacity-40">
                  Add
                </button>
              </form>
            </li>
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={row} onClick={() => setOpen(false)}>
                  {badge(l.icon, l.tone)}
                  <span className="flex-1">
                    <span className="block text-[16px] font-semibold">{l.label}</span>
                    <span className="block text-[13px] text-muted">{l.note}</span>
                  </span>
                  <span className="text-muted">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </>
  );
}
