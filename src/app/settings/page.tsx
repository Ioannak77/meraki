"use client";

import { MoneySettingsCard } from "@/components/finance/SettingsCard";
import { OtherSettingsCard } from "@/components/OtherSettingsCard";
import { TestingCard } from "@/components/TestingCard";
import { TodayCardsSettings } from "@/components/TodayCardsSettings";
import { WEEKDAYS, formatMinutes, plannedMinutes, weeklyPlan } from "@/lib/cleaning";
import { useStore } from "@/lib/store";

export default function SettingsPage() {
  const { ready, settings, updateSettings } = useStore();
  if (!ready) return null;

  const office = settings.officeDays;
  const plan = weeklyPlan(office);

  function toggleDay(day: number) {
    const next = office.includes(day) ? office.filter((d) => d !== day) : [...office, day].sort();
    updateSettings({ officeDays: next });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">Settings</h1>

      <section className="mt-5 rounded-3xl bg-card p-5">
        <h2 className="text-lg font-bold">Office days</h2>
        <p className="text-[15px] text-muted">
          On these days you get the lighter weekly cleaning lists. Heavier ones move to a home day automatically.
        </p>
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((name, day) => {
            const on = office.includes(day);
            return (
              <button
                key={name}
                onClick={() => toggleDay(day)}
                aria-pressed={on}
                aria-label={name}
                className={`rounded-2xl py-3 text-sm font-semibold transition-colors ${
                  on ? "bg-sage-dark text-white" : "bg-cream text-ink/70"
                }`}
              >
                {name.slice(0, 3)}
              </button>
            );
          })}
        </div>

        <h3 className="mt-6 text-sm font-semibold text-muted">Your cleaning week</h3>
        <ul className="mt-1 divide-y divide-line">
          {plan.map((slot, day) => (
            <li key={day} className="flex items-center gap-3 py-2.5 text-[15px]">
              <span className={`w-24 shrink-0 ${office.includes(day) ? "font-bold text-sage-dark" : "text-muted"}`}>
                {WEEKDAYS[day]}
              </span>
              <span className="flex-1">
                {slot.routine.name}
                {slot.movedFrom !== undefined && (
                  <span className="text-sm text-muted"> · moved from {WEEKDAYS[slot.movedFrom]}</span>
                )}
              </span>
              <span className="text-xs text-muted">~{formatMinutes(plannedMinutes(slot.routine))}</span>
            </li>
          ))}
        </ul>
      </section>

      <TodayCardsSettings />

      <MoneySettingsCard />

      <OtherSettingsCard />

      <TestingCard />
    </div>
  );
}
