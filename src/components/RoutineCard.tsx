"use client";

import { today } from "@/lib/clock";
import { useState } from "react";
import { formatMinutes, occurrenceKey, plannedMinutes, stepsOn, type Routine } from "@/lib/cleaning";
import { useStore } from "@/lib/store";
import { Icon } from "./icons";
import { RoutineTimer, unlockTimerAudio } from "./RoutineTimer";

const GROUP_STYLE: Record<Routine["group"], { tone: string; bar: string; label: string }> = {
  daily: { tone: "bg-sage-soft text-sage", bar: "bg-sage", label: "Daily" },
  weekly: { tone: "bg-peach-soft text-peach", bar: "bg-peach", label: "Weekly" },
  monthly: { tone: "bg-sky-soft text-sky", bar: "bg-sky", label: "Monthly" },
  quarterly: { tone: "bg-rose-soft text-rose", bar: "bg-rose", label: "Every 3 months" },
  "twice-a-year": { tone: "bg-rose-soft text-rose", bar: "bg-rose", label: "Every 6 months" },
};

/** Ticked vs. required steps. Optional steps ("if needed") never hold you back. */
export function routineProgress(routine: Routine, ticked: string[], date = today()) {
  const required = stepsOn(routine, date).filter((s) => !s.optional);
  const done = required.filter((s) => ticked.includes(s.id)).length;
  return { done, total: required.length, complete: done === required.length };
}

export function RoutineCard({
  routine,
  date = today(),
  badge,
  subtitle,
  collapsible = false,
  startOpen = true,
}: {
  routine: Routine;
  date?: Date;
  badge?: string;
  subtitle?: string;
  collapsible?: boolean;
  startOpen?: boolean;
}) {
  const { routineDone, routineTimes, toggleStep } = useStore();
  const [open, setOpen] = useState(startOpen);
  const [timing, setTiming] = useState(false);
  const key = occurrenceKey(routine, date);
  const ticked = routineDone[key] ?? [];
  const daySteps = stepsOn(routine, date);
  const { done, total, complete } = routineProgress(routine, ticked, date);
  const style = GROUP_STYLE[routine.group];
  const minutesLeft = daySteps.filter((s) => !s.optional && !ticked.includes(s.id)).reduce((sum, s) => sum + s.minutes, 0);
  const timedSeconds = routineTimes[key];

  return (
    <section className="rounded-3xl bg-card p-5">
      <button
        type="button"
        onClick={() => collapsible && setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 text-left ${collapsible ? "" : "cursor-default"}`}
        aria-expanded={collapsible ? open : undefined}
      >
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${style.tone}`}>
          <Icon.routines className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[17px] font-bold">{routine.name}</span>
            {badge && <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-cream">{badge}</span>}
          </span>
          <span className="block truncate text-[13px] text-muted">
            {subtitle ?? routine.note ?? style.label} · ~{formatMinutes(plannedMinutes(routine, date))}
          </span>
        </span>
        <span className={`shrink-0 text-sm font-semibold ${complete ? "text-sage-dark" : "text-muted"}`}>
          {complete ? "Done ✓" : `${done}/${total}`}
        </span>
      </button>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full transition-[width] duration-500 ${style.bar}`} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>

      {open && (
        <>
          <ul className="mt-2 divide-y divide-line">
            {daySteps.map((step) => {
              const isDone = ticked.includes(step.id);
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isDone) navigator.vibrate?.(20);
                      toggleStep(key, step.id);
                    }}
                    className="flex w-full items-center gap-3 py-3 text-left"
                    aria-pressed={isDone}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                        isDone ? "animate-pop border-sage bg-sage text-white" : "border-line bg-card"
                      }`}
                    >
                      {isDone && <Icon.check className="size-4" />}
                    </span>
                    <span className={`flex-1 text-[15px] ${isDone ? "text-muted line-through" : ""}`}>{step.title}</span>
                    <span className="shrink-0 text-right text-xs text-muted">
                      {step.minutes} min
                      {step.hint && <span className="block">{step.hint}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {complete ? (
            timedSeconds ? (
              <p className="mt-3 rounded-2xl bg-sage-soft py-3 text-center text-[15px] font-semibold text-sage-dark">
                Done in {formatMinutes(Math.max(1, Math.round(timedSeconds / 60)))} 🎉
              </p>
            ) : null
          ) : (
            <button
              type="button"
              onClick={() => {
                unlockTimerAudio();
                setTiming(true);
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-sage-dark py-3.5 text-[16px] font-bold text-white"
            >
              ▶ {done ? "Continue" : "Start"} · ~{formatMinutes(minutesLeft)}
            </button>
          )}
        </>
      )}

      {timing && (
        <RoutineTimer
          title={routine.name}
          items={daySteps.map((step) => ({ step, occurrence: key }))}
          onClose={() => setTiming(false)}
        />
      )}
    </section>
  );
}
