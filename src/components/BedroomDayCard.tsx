"use client";

// The bedroom day around a month-end weekend (see bedroomDay in cleaning.ts): the weekly Bedroom list and
// the month's bedroom jobs (protectors, mattress, under the bed, pillows and duvet when it's their month)
// as one list, while the bed is stripped anyway. Also the general ChecklistCard it's built on.

import { useState } from "react";
import { bedroomDay, bigCleanOrder, formatMinutes, type CheckItem } from "@/lib/cleaning";
import { useStore } from "@/lib/store";
import { Icon } from "./icons";
import { RoutineTimer, unlockTimerAudio } from "./RoutineTimer";
import { HowButton, HowText } from "./StepHow";

export function BedroomDayCard({ date, badge }: { date: Date; badge?: string }) {
  const { settings } = useStore();
  const day = bedroomDay(date, settings.officeDays);
  if (!day) return null;
  return (
    <ChecklistCard
      title={day.swap.bedroom.name}
      badge={badge}
      subtitle={`With this month's bedroom jobs · ${day.swap.weekly.name} is in the Big clean`}
      items={day.items}
      hideList={day.swap.bedroom.name}
    />
  );
}

/**
 * A checklist made of steps from several lists (each saves to its own list): the bedroom day, catching up,
 * the Big clean's leftovers. `hideList`: a list name not worth repeating under each step.
 */
export function ChecklistCard({
  title,
  subtitle,
  badge,
  items: given,
  hideList,
  tone = "bg-sky-soft text-sky",
  sortable = false,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  items: CheckItem[];
  hideList?: string;
  tone?: string;
  sortable?: boolean; // offer "In cleaning order" / "By day missed" (remembered on this device)
}) {
  const { routineDone, toggleStep } = useStore();
  const [howOpen, setHowOpen] = useState<string | null>(null);
  // The timer: all that's left, or one step (the ▶ next to it).
  const [timing, setTiming] = useState<CheckItem[] | null>(null);
  const startTimer = (list: CheckItem[]) => {
    unlockTimerAudio();
    setTiming(list);
  };
  const [byDay, setByDayState] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("merakiCatchUpOrder") === "day";
    } catch {
      return false;
    }
  });
  const setByDay = (on: boolean) => {
    setByDayState(on);
    try {
      localStorage.setItem("merakiCatchUpOrder", on ? "day" : "clean");
    } catch {}
  };
  // In cleaning order: machines first, high to low, floors last (dusting before vacuuming and mopping).
  const items = sortable && !byDay ? bigCleanOrder(given, (it) => it.step) : given;
  const isDone = (it: (typeof items)[number]) => (routineDone[it.occurrence] ?? []).includes(it.step.id);
  const counted = items.filter((it) => !it.step.optional);
  const done = counted.filter(isDone).length;
  const minutesLeft = counted.filter((it) => !isDone(it)).reduce((t, it) => t + it.step.minutes, 0);

  return (
    <section className="rounded-3xl bg-card p-5">
      <div className="flex items-center gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>
          <Icon.routines className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[17px] font-bold">{title}</span>
            {badge && <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-cream">{badge}</span>}
          </span>
          <span className="block text-[13px] text-muted">{subtitle}</span>
        </span>
        <span className={`shrink-0 text-sm font-semibold ${done === counted.length ? "text-sage-dark" : "text-muted"}`}>
          {done === counted.length ? "Done ✓" : `${done}/${counted.length}`}
        </span>
      </div>

      {sortable && (
        <div className="mt-3 flex gap-1 rounded-full bg-cream p-1 text-[13px]">
          {(
            [
              [false, "In cleaning order"],
              [true, "By day missed"],
            ] as const
          ).map(([day, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setByDay(day)}
              className={`flex-1 rounded-full py-1.5 ${byDay === day ? "bg-ink font-bold text-cream" : "text-ink/70"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <ul className="mt-2 divide-y divide-line">
        {items.map((it) => {
          const ticked = isDone(it);
          const id = it.occurrence + it.step.id;
          return (
            <li key={id}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!ticked) navigator.vibrate?.(20);
                    toggleStep(it.occurrence, it.step.id);
                  }}
                  aria-pressed={ticked}
                  className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition-[color,background-color,border-color,transform] ${
                      ticked ? "animate-pop border-sage bg-sage text-white" : "border-line bg-card"
                    }`}
                  >
                    {ticked && <Icon.check className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[15px] ${ticked ? "text-muted line-through" : ""}`}>{it.step.title}</span>
                    {(it.note ?? it.list) !== hideList && <span className="block text-xs text-muted">{it.note ?? it.list}</span>}
                  </span>
                  <span className="max-w-[40%] shrink-0 text-right text-xs text-muted">
                    {it.step.minutes} min
                    {it.step.hint && <span className="block">{it.step.hint}</span>}
                  </span>
                </button>
                {!ticked && (
                  <button
                    type="button"
                    onClick={() => startTimer([it])}
                    aria-label={`Timer for ${it.step.title}, ${it.step.minutes} minutes`}
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-sage-soft text-[11px] text-sage-dark"
                  >
                    ▶
                  </button>
                )}
                <HowButton step={it.step} open={howOpen === id} onToggle={() => setHowOpen(howOpen === id ? null : id)} />
              </div>
              {howOpen === id && <HowText step={it.step} />}
            </li>
          );
        })}
      </ul>

      {minutesLeft > 0 && (
        <button
          type="button"
          onClick={() => startTimer(items)}
          className="mt-3 w-full rounded-2xl bg-sage-dark py-3.5 text-[16px] font-bold text-white"
        >
          {done ? "Continue" : "Start"} · ~{formatMinutes(minutesLeft)}
        </button>
      )}
      {timing && (
        <RoutineTimer title={timing.length === 1 ? timing[0].step.title : title} items={timing} onClose={() => setTiming(null)} />
      )}
    </section>
  );
}
