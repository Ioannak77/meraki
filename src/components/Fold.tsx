"use client";

// A part of a screen that folds away when you tap its title. Remembers what you folded on this device.

import { useEffect, useState } from "react";

// Outside the "meraki." prefix: a per-device preference, not synced or backed up.
const KEY = "merakiFold.v1";

function readFolded(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useFold(id: string) {
  const [open, setOpen] = useState(true);
  const [toggled, setToggled] = useState(false); // opened by a tap (then it animates in)
  useEffect(() => {
    const t = setTimeout(() => setOpen(!readFolded().includes(id)), 0);
    return () => clearTimeout(t);
  }, [id]);
  function toggle() {
    const next = !open;
    setOpen(next);
    setToggled(true);
    try {
      const rest = readFolded().filter((f) => f !== id);
      localStorage.setItem(KEY, JSON.stringify(next ? rest : [...rest, id]));
    } catch {}
  }
  return { open, toggle, toggled };
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-5 shrink-0 text-muted transition-transform duration-200 ease-out ${open ? "" : "-rotate-90"}`} aria-hidden>
      <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * `card`: a white card whose title folds its contents.
 * `group`: a plain title row above other cards that fold themselves (for parts made of several cards).
 */
export function Fold({
  id,
  title,
  right,
  variant = "card",
  className = "",
  children,
}: {
  id: string;
  title: React.ReactNode;
  right?: React.ReactNode;
  variant?: "card" | "group";
  className?: string;
  children: React.ReactNode;
}) {
  const { open, toggle, toggled } = useFold(id);
  const header = (
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={toggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Chevron open={open} />
        <h2 className="truncate text-lg font-bold">{title}</h2>
      </button>
      {right}
    </div>
  );

  // Groups keep their title; each card inside folds on its own.
  if (variant === "group")
    return (
      <div className={`flex flex-col gap-4 ${className}`}>
        <div className="flex items-center justify-between gap-2 lg:col-span-2">
          <h2 className="truncate text-lg font-bold">{title}</h2>
          {right}
        </div>
        {children}
      </div>
    );
  return (
    <section className={`rounded-3xl bg-card p-5 shadow-[0_1px_2px_rgba(60,50,40,0.04)] ${className}`}>
      {header}
      {open && <div className={`mt-2 ${toggled ? "animate-reveal" : ""}`}>{children}</div>}
    </section>
  );
}
