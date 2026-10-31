"use client";

// The little "?" next to a cleaning step, and the instructions it opens.

import { howTo } from "@/lib/cleaningHow";
import type { Step } from "@/lib/cleaning";

export function HowButton({ step, open, onToggle }: { step: Step; open: boolean; onToggle: () => void }) {
  if (!howTo(step)) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`How to: ${step.title}`}
      className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${open ? "bg-sage-dark text-white" : "bg-cream text-muted"}`}
    >
      ?
    </button>
  );
}

export function HowText({ step }: { step: Step }) {
  return <p className="animate-reveal mb-2 ml-10 rounded-2xl bg-cream px-3.5 py-2.5 text-[14px] leading-snug">{howTo(step)}</p>;
}
