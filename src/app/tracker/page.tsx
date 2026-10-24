"use client";

import { TrackerView } from "@/components/finance/Tracker";
import { useFinance } from "@/lib/financeStore";
import { useNow } from "@/lib/useNow";

export default function TrackerPage() {
  const { ready } = useFinance();
  const now = useNow();
  if (!ready) return null;
  return <TrackerView now={now} />;
}
