"use client";

import { useState } from "react";
import { AdviceTab } from "@/components/finance/Advice";
import { BillsTab } from "@/components/finance/Bills";
import { BudgetsTab } from "@/components/finance/Budgets";
import { GoalsTab } from "@/components/finance/Goals";
import { OverviewTab, type FinanceTab } from "@/components/finance/Overview";
import { FinanceSetup } from "@/components/finance/Setup";
import { SpendingTab } from "@/components/finance/Spending";
import { useFinance } from "@/lib/financeStore";
import { useNow } from "@/lib/useNow";

export default function FinancesPage() {
  const { ready, setupDone, has } = useFinance();
  // Quick add "Bill" on Today links here with #new-bill.
  const [newBill] = useState(() => typeof window !== "undefined" && window.location.hash === "#new-bill");
  const [tab, setTab] = useState<FinanceTab>(newBill ? "Bills" : "Overview");
  const now = useNow();

  if (!ready) return null;
  if (!setupDone) return <FinanceSetup />;

  // Only show the tabs for what you chose to track.
  const tabs: FinanceTab[] = ["Overview"];
  if (has("bills") || has("home") || has("subscriptions") || has("insurance") || has("loans")) tabs.push("Bills");
  if (has("imports") || has("groceries") || has("pet") || has("allowance") || has("summary")) tabs.push("Spending");
  if (has("allowance") || has("pet") || has("groceries")) tabs.push("Budgets");
  if (has("savings")) tabs.push("Goals");
  tabs.push("Advice");
  const current = tabs.includes(tab) ? tab : "Overview";

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">Money</h1>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ${
              current === t ? "bg-ink font-bold text-cream" : "bg-card text-ink/70"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {current === "Overview" && <OverviewTab now={now} go={setTab} />}
        {current === "Bills" && <BillsTab now={now} startNew={newBill} />}
        {current === "Spending" && <SpendingTab now={now} />}
        {current === "Budgets" && <BudgetsTab now={now} />}
        {current === "Goals" && <GoalsTab now={now} />}
        {current === "Advice" && <AdviceTab now={now} />}
      </div>
    </div>
  );
}
