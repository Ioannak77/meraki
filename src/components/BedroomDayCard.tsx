"use client";

// The bedroom day around a month-end weekend (see bedroomDay in cleaning.ts): the weekly Bedroom list and
// the month's bedroom jobs (protectors, mattress, under the bed, pillows and duvet when it's their month)
// as one list, while the bed is stripped anyway. Each step still saves to its own list.

import { useState } from "react";
import { bedroomDay, formatMinutes } from "@/lib/cleaning";
import { useStore } from "@/lib/store";
import { Icon } from "./icons";
import { RoutineTimer, unlockTimerAudio } from "./RoutineTimer";
import { HowButton, HowText } from "./StepHow";

export function BedroomDayCard({ date, badge }: { date: Date; badge?: string }) {
  const { routineDone, toggleStep, settings } = useStore();
  const [howOpen, setHowOpen] = useState<string | null>(null);
  const [timing, setTiming] = useState(false);
  const day = bedroomDay(date, settings.officeDays);
  if (!day) return null;
  const { swap, items } = day;
  const isDone = (it: (typeof items)[number]) => (routineDone[it.occurrence] ?? []).includes(it.step.id);
  const counted = items.filter((it) => !it.step.optional);
  const done = counted.filter(isDone).length;
  const minutesLeft = counted.filter((it) => !isDone(it)).reduce((t, it) => t + it.step.minutes, 0);

  return (
    <section className="rounded-3xl bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-soft text-sky">
          <Icon.routines className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[17px] font-bold">{swap.bedroom.name}</span>
            {badge && <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-cream">{badge}</span>}
          </span>
          <span className="block text-[13px] text-muted">With this month&apos;s bedroom jobs · {swap.weekly.name} is in the Big clean</span>
        </span>
        <span className={`shrink-0 text-sm font-semibold ${done === counted.length ? "text-sage-dark" : "text-muted"}`}>
          {done === counted.length ? "Done ✓" : `${done}/${counted.length}`}
        </span>
      </div>

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
                    {it.list !== swap.bedroom.name && <span className="block text-xs text-muted">{it.list}</span>}
                  </span>
                  <span className="max-w-[40%] shrink-0 text-right text-xs text-muted">
                    {it.step.minutes} min
                    {it.step.hint && <span className="block">{it.step.hint}</span>}
                  </span>
                </button>
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
          onClick={() => {
            unlockTimerAudio();
            setTiming(true);
          }}
          className="mt-3 w-full rounded-2xl bg-sage-dark py-3.5 text-[16px] font-bold text-white"
        >
          {done ? "Continue" : "Start"} · ~{formatMinutes(minutesLeft)}
        </button>
      )}
      {timing && <RoutineTimer title={swap.bedroom.name} items={items} onClose={() => setTiming(false)} />}
    </section>
  );
}
