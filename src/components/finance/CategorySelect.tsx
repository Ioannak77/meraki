"use client";

// One dropdown for choosing a category (the phone's own picker), instead of a wall of chips.
// Spending categories first, then the ones that aren't counted as spending, then "New category…".

import { useState } from "react";
import { allCategories, category, type Category, type CategoryId } from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { inputClass } from "./ui";

const NEW = "__new";

export function CategorySelect({
  value,
  onChange,
  filter,
  allowNew = true,
  label = "Category",
}: {
  value: CategoryId;
  onChange: (c: CategoryId) => void;
  filter?: (c: Category) => boolean;
  allowNew?: boolean;
  label?: string;
}) {
  const { addCategory } = useFinance();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const list = allCategories().filter((c) => !filter || filter(c));
  const spending = list.filter((c) => c.counts);
  const notSpending = list.filter((c) => !c.counts);
  const current = category(value);

  if (naming)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onChange(addCategory(name.trim()));
          setName("");
          setNaming(false);
        }}
        className="flex gap-2"
      >
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Car" className={inputClass} />
        <button type="submit" disabled={!name.trim()} className="shrink-0 rounded-2xl bg-sage-dark px-4 font-bold text-white disabled:opacity-40">
          Add
        </button>
        <button type="button" onClick={() => setNaming(false)} className="shrink-0 px-1 text-sm font-semibold text-muted">
          Cancel
        </button>
      </form>
    );

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 size-3 -translate-y-1/2 rounded-full" style={{ background: current.color }} />
      <select
        aria-label={label}
        value={value}
        onChange={(e) => (e.target.value === NEW ? setNaming(true) : onChange(e.target.value as CategoryId))}
        className={`${inputClass} appearance-none pl-10 pr-10 font-semibold`}
      >
        <optgroup label="Spending">
          {spending.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </optgroup>
        {notSpending.length > 0 && (
          <optgroup label="Not counted as spending">
            {notSpending.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </optgroup>
        )}
        {allowNew && <option value={NEW}>+ New category…</option>}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden>
        <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
