"use client";

import { useEffect, useState } from "react";
import { AdviceTab } from "@/components/finance/Advice";
import { BillsTab } from "@/components/finance/Bills";
import { GoalsTab } from "@/components/finance/Goals";
import { OverviewTab, type FinanceTab } from "@/components/finance/Overview";
import { FinanceSetup } from "@/components/finance/Setup";
import { SpendingTab } from "@/components/finance/Spending";
import { TrackerView } from "@/components/finance/Tracker";
import { useFinance } from "@/lib/financeStore";
import { useNow } from "@/lib/useNow";

export default function FinancesPage() {
  const { ready, setupDone, has } = useFinance();
  const [tab, setTab] = useState<FinanceTab>("Overview");
  // Today's + menu ("Bill") links here with #new-bill. Read after mounting: on an
  // in-app link the hash is set after the page starts.
  const [newBill, setNewBill] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      // The old Tracker page (home screen shortcuts, old links) sends you here with #tracker.
      if (window.location.hash === "#tracker") return setTab("Tracker");
      // Bill notifications open Bills, where the Paid button is.
      if (window.location.hash === "#bills") return setTab("Bills");
      // Back from importing statements.
      if (window.location.hash === "#spending") return setTab("Spending");
      if (window.location.hash !== "#new-bill") return;
      setNewBill(true);
      setTab("Bills");
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const now = useNow();

  if (!ready) return null;
  if (!setupDone) return <FinanceSetup />;

  // Only show the tabs for what you chose to track.
  const tabs: FinanceTab[] = ["Overview"];
  if (has("bills") || has("home") || has("subscriptions") || has("insurance") || has("loans")) tabs.push("Bills");
  // Spending also holds the budgets and the weekly allowance.
  if (has("imports") || has("groceries") || has("pet") || has("allowance") || has("summary")) tabs.push("Spending");
  if (has("savings")) tabs.push("Goals");
  tabs.push("Tracker", "Advice");
  const current = tabs.includes(tab) ? tab : "Overview";

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">Finances</h1>

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
        {current === "Goals" && <GoalsTab now={now} />}
        {current === "Tracker" && <TrackerView now={now} embedded />}
        {current === "Advice" && <AdviceTab now={now} />}
      </div>
    </div>
  );
}
