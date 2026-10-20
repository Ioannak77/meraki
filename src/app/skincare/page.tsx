"use client";

import { useMemo, useState } from "react";
import { SkinPhotos } from "@/components/skin/SkinPhotos";
import { SkinSetup } from "@/components/skin/SkinSetup";
import { SlotCard } from "@/components/skin/SlotCard";
import { today } from "@/lib/clock";
import { currentSlot } from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { useStore } from "@/lib/store";

const TABS = ["Today", "Set up", "Check-ins"] as const;
type Tab = (typeof TABS)[number];

export default function SkincarePage() {
  const { settings } = useStore();
  const { ready } = useSkin();
  const [tab, setTab] = useState<Tab>("Today");
  const now = useMemo(() => today(settings.testDate), [settings.testDate]);
  if (!ready) return null;
  const slot = currentSlot(now);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">Skincare</h1>

      <div className="mt-4 flex gap-1 rounded-full bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-sm ${tab === t ? "bg-ink font-bold text-cream" : "text-ink/70"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "Today" && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* The slot for now first. */}
            {(slot === "am" ? (["am", "pm"] as const) : (["pm", "am"] as const)).map((s) => (
              <SlotCard key={s} slot={s} date={now} badge={s === slot ? "Now" : undefined} />
            ))}
          </div>
        )}
        {tab === "Set up" && <SkinSetup />}
        {tab === "Check-ins" && <SkinPhotos now={now} />}
      </div>
    </div>
  );
}
