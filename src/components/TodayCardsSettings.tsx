"use client";

// Settings > Today screen: switch off the cards you don't want to see.

import { TODAY_CARDS, useStore, type TodayCard } from "@/lib/store";
import { Icon } from "./icons";

export function TodayCardsSettings() {
  const { settings, updateSettings } = useStore();
  const hidden = settings.todayHidden ?? [];

  function toggle(id: TodayCard) {
    updateSettings({ todayHidden: hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id] });
  }

  return (
    <section className="mt-5 rounded-3xl bg-card p-5">
      <h2 className="text-lg font-bold">Today screen</h2>
      <p className="text-[15px] text-muted">Choose what shows on Today. Untick anything you don&apos;t need.</p>
      <ul className="mt-2 divide-y divide-line">
        {TODAY_CARDS.map((c) => {
          const on = !hidden.includes(c.id);
          return (
            <li key={c.id}>
              <button type="button" onClick={() => toggle(c.id)} aria-pressed={on} className="flex w-full items-center gap-3 py-3 text-left">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-lg border-2 ${on ? "border-sage bg-sage text-white" : "border-line bg-card"}`}
                >
                  {on && <Icon.check className="size-4" />}
                </span>
                <span className="text-[15px]">{c.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
