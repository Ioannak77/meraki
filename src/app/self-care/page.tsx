"use client";

import { useEffect, useState } from "react";
import { CareDueCard, CareReminders } from "@/components/skin/CareItems";
import { SkinSetup } from "@/components/skin/SkinSetup";
import { SlotCard } from "@/components/skin/SlotCard";
import { currentSlot } from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { useNow } from "@/lib/useNow";

const TABS = ["Today", "Reminders", "Set up"] as const;
type Tab = (typeof TABS)[number];

export default function SelfCarePage() {
  const { ready, settings, items, steps } = useSkin();
  const hasDaily = steps.some((s) => s.slot === "day");
  // Reminders don't know when they're due until they know when you last did them.
  const needDate = items.filter((i) => i.lastDone === null).length;
  // Settings links here with #reminders or #skincare.
  const [tab, setTab] = useState<Tab>("Today");
  useEffect(() => {
    const read = () => {
      const h = window.location.hash;
      if (h === "#reminders") setTab("Reminders");
      else if (h === "#skincare") setTab("Set up");
    };
    const t = setTimeout(read, 0);
    window.addEventListener("hashchange", read);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", read);
    };
  }, []);
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
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <CareDueCard now={now} />
            </div>
            {/* The skincare slot for now first. */}
            {needDate > 0 && (
              <button
                type="button"
                onClick={() => setTab("Reminders")}
                className="rounded-3xl bg-rose-soft px-5 py-4 text-left text-[15px] text-rose lg:col-span-2"
              >
                <strong>
                  {needDate} {needDate === 1 ? "reminder needs" : "reminders need"} a last date
                </strong>{" "}
                · Set {needDate === 1 ? "it" : "them"} →
              </button>
            )}
            {(slot === "am" ? (["am", "pm"] as const) : (["pm", "am"] as const)).map((s) => (
              <SlotCard key={s} slot={s} date={now} badge={s === slot ? "Now" : undefined} startOpen={s === slot} />
            ))}
            {hasDaily && <SlotCard slot="day" date={now} />}
          </div>
        )}
        {tab === "Reminders" && <CareReminders now={now} />}
        {tab === "Set up" && <SkinSetup />}
      </div>
    </div>
  );
}
