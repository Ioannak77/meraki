"use client";

// "What do you want to track?" Shown the first time, and from Settings.

import { useState } from "react";
import { MODULES, type ModuleId } from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { Icon } from "../icons";
import { PrimaryButton } from "./ui";

export function FinanceSetup({ onDone }: { onDone?: () => void }) {
  const { modules, setupDone, saveSetup } = useFinance();
  const [picked, setPicked] = useState<ModuleId[]>(setupDone ? modules : MODULES.map((m) => m.id));

  function toggle(id: ModuleId) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">Money</h1>
      <p className="mt-1 text-[15px] text-muted">
        What do you want to track? Pick only what&apos;s useful; you can change this any time in Settings.
      </p>

      <section className="mt-5 rounded-3xl bg-card px-3 py-2">
        <ul className="divide-y divide-line">
          {MODULES.map((m) => {
            const on = picked.includes(m.id);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-pressed={on}
                  className="flex w-full items-center gap-3 px-2 py-3.5 text-left"
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-lg border-2 transition-[color,background-color,border-color,transform] ${
                      on ? "border-sage bg-sage text-white" : "border-line bg-card"
                    }`}
                  >
                    {on && <Icon.check className="size-4" />}
                  </span>
                  <span className="text-[15px]">{m.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-4 text-sm text-muted">
        Your money data stays on this device. It isn&apos;t sent anywhere.
      </p>

      <PrimaryButton
        disabled={picked.length === 0}
        onClick={() => {
          saveSetup(MODULES.map((m) => m.id).filter((id) => picked.includes(id)));
          onDone?.();
        }}
      >
        {setupDone ? "Save" : `Start tracking (${picked.length})`}
      </PrimaryButton>
    </div>
  );
}
