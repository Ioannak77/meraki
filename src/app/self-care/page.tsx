"use client";

import { useState } from "react";
import { CareDueCard, CareReminders } from "@/components/skin/CareItems";
import { SkinSetup } from "@/components/skin/SkinSetup";
import { SlotCard } from "@/components/skin/SlotCard";
import { currentSlot } from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { useNow } from "@/lib/useNow";

const TABS = ["Today", "Reminders", "Skincare"] as const;
type Tab = (typeof TABS)[number];

export default function SelfCarePage() {
  const { ready, settings } = useSkin();
  const [tab, setTab] = useState<Tab>("Today");
  const now = useNow();
  if (!ready) return null;
  const slot = currentSlot(now, settings.pmTime);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">Self care</h1>

      <div className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4">
        <div className="flex min-w-full gap-1 rounded-full bg-card p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 whitespace-nowrap rounded-full px-3 py-2 text-sm ${tab === t ? "bg-ink font-bold text-cream" : "text-ink/70"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {tab === "Today" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <CareDueCard now={now} />
            </div>
            {/* The skincare slot for now first. */}
            {(slot === "am" ? (["am", "pm"] as const) : (["pm", "am"] as const)).map((s) => (
              <SlotCard key={s} slot={s} date={now} badge={s === slot ? "Now" : undefined} />
            ))}
          </div>
        )}
        {tab === "Reminders" && <CareReminders now={now} />}
        {tab === "Skincare" && <SkinSetup />}
      </div>
    </div>
  );
}
