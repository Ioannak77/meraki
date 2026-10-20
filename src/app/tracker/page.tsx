"use client";

import { useMemo } from "react";
import { TrackerView } from "@/components/finance/Tracker";
import { today } from "@/lib/clock";
import { useFinance } from "@/lib/financeStore";
import { useStore } from "@/lib/store";

export default function TrackerPage() {
  const { settings } = useStore();
  const { ready } = useFinance();
  const now = useMemo(() => today(settings.testDate), [settings.testDate]);
  if (!ready) return null;
  return <TrackerView now={now} />;
}
