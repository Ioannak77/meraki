"use client";

// "+ New" at the end of a row of choice chips: tap, type a name, done. Used for
// money categories and task areas so a missing one never blocks you.

import { useState } from "react";

export function NewChip({ onAdd, placeholder = "New category" }: { onAdd: (name: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function add() {
    if (!name.trim()) return;
    onAdd(name.trim());
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border-2 border-dashed border-line px-3.5 py-1.5 text-sm font-semibold text-muted"
      >
        + New
      </button>
    );
  }
  return (
    <span className="flex w-full items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-full border border-line bg-cream px-4 py-2 text-sm outline-none focus:border-sage"
      />
      <button
        type="button"
        disabled={!name.trim()}
        onClick={add}
        className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-bold text-cream disabled:opacity-40"
      >
        Add
      </button>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cancel" className="shrink-0 px-1 text-muted">
        ✕
      </button>
    </span>
  );
}
