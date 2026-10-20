"use client";

// Settings > Money: change what's tracked.

import { useState } from "react";
import { MODULES } from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { FinanceSetup } from "./Setup";
import { Sheet } from "./ui";

export function MoneySettingsCard() {
  const { setupDone, modules } = useFinance();
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-5 rounded-3xl bg-card p-5">
      <h2 className="text-lg font-bold">Money</h2>
      <p className="text-[15px] text-muted">
        {setupDone
          ? `Tracking ${modules.length} of ${MODULES.length} areas.`
          : "Not set up yet. Open Money to choose what to track."}
      </p>
      {setupDone && (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded-2xl bg-cream px-4 py-2.5 font-semibold">
          Change what to track
        </button>
      )}
      {open && (
        <Sheet title="What to track" onClose={() => setOpen(false)}>
          <FinanceSetup onDone={() => setOpen(false)} />
        </Sheet>
      )}
    </section>
  );
}
