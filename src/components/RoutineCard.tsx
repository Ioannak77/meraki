"use client";

import { today } from "@/lib/clock";
import { useState } from "react";
import { SKIPPED, formatMinutes, occurrenceKey, bigCleanOrder, plannedMinutes, stepsOn, type Routine } from "@/lib/cleaning";
import { useStore } from "@/lib/store";
import { Icon } from "./icons";
import { RoutineTimer, unlockTimerAudio } from "./RoutineTimer";
import { useRememberedFold } from "./Fold";
import { HowButton, HowText } from "./StepHow";

const GROUP_STYLE: Record<Routine["group"], { tone: string; bar: string; label: string }> = {
  daily: { tone: "bg-sage-soft text-sage", bar: "bg-sage", label: "Daily" },
  weekly: { tone: "bg-peach-soft text-peach", bar: "bg-peach", label: "Weekly" },
  monthly: { tone: "bg-sky-soft text-sky", bar: "bg-sky", label: "Monthly" },
  quarterly: { tone: "bg-rose-soft text-rose", bar: "bg-rose", label: "Every 3 months" },
  "twice-a-year": { tone: "bg-rose-soft text-rose", bar: "bg-rose", label: "Every 6 months" },
};

/** Saved in the next round's list to start it (it isn't a real step). */
const ROUND_MARKER = "__round";

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
  canSkip = false,
  foldId,
}: {
  routine: Routine;
  date?: Date;
  badge?: string;
  subtitle?: string;
  collapsible?: boolean;
  startOpen?: boolean;
  canSkip?: boolean; // offer "Skip today" (weekly lists, for busy or sick days)
  foldId?: string; // remember on this device when you fold it (Today)
}) {
  const { routineDone, routineTimes, toggleStep } = useStore();
  // null until you fold or unfold it yourself; a finished list folds by itself.
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const [timing, setTiming] = useState(false);
  const [howOpen, setHowOpen] = useState<string | null>(null); // the step whose instructions are open
  const [folded, setFolded] = useRememberedFold(foldId);
  // After meals can be done again for each meal: rounds are saved as "meals@day", "meals@day#2"…
  const base = occurrenceKey(routine, date);
  let round = 1;
  if (routine.repeat) while (routineDone[`${base}#${round + 1}`]) round++;
  const key = round === 1 ? base : `${base}#${round}`;
  const skipped = (routineDone[key] ?? []).includes(SKIPPED);
  const ticked = (routineDone[key] ?? []).filter((id) => id !== ROUND_MARKER && id !== SKIPPED);
  // Month-end lists: in Big clean order (machines and soaks first, floors last).
  const daySteps = routine.when.kind === "monthly" ? bigCleanOrder(stepsOn(routine, date), (s) => s) : stepsOn(routine, date);
  const { done, total, complete } = routineProgress(routine, ticked, date);
  const style = GROUP_STYLE[routine.group];
  const minutesLeft = daySteps.filter((s) => !s.optional && !ticked.includes(s.id)).reduce((sum, s) => sum + s.minutes, 0);
  const timedSeconds = routineTimes[key];
  // After meals stays open when done: its "again after the next meal" button lives inside.
  const open = folded ? false : (manualOpen ?? (collapsible && ((complete && !routine.repeat) || skipped) ? false : startOpen));

  return (
    <section className="rounded-3xl bg-card p-5">
      <button
        type="button"
        onClick={() => {
          if (!collapsible) return;
          setManualOpen(!open);
          setFolded(open);
        }}
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
            {round > 1 ? `Meal ${round} today · ` : ""}
            {subtitle ?? routine.note ?? style.label} · ~{formatMinutes(plannedMinutes(routine, date))}
          </span>
        </span>
        <span className={`shrink-0 text-sm font-semibold ${complete ? "text-sage-dark" : "text-muted"}`}>
          {skipped ? "Skipped" : complete ? "Done ✓" : `${done}/${total}`}
        </span>
      </button>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full transition-[width] duration-300 ease-out ${style.bar}`} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>

      {open && (
        <>
          <ul className={`mt-2 divide-y divide-line ${manualOpen !== null ? "animate-reveal" : ""}`}>
            {daySteps.map((step) => {
              const isDone = ticked.includes(step.id);
              return (
                <li key={step.id}>
                  <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isDone) navigator.vibrate?.(20);
                      toggleStep(key, step.id);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
                    aria-pressed={isDone}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition-[color,background-color,border-color,transform] ${
                        isDone ? "animate-pop border-sage bg-sage text-white" : "border-line bg-card"
                      }`}
                    >
                      {isDone && <Icon.check className="size-4" />}
                    </span>
                    <span className={`flex-1 text-[15px] ${isDone ? "text-muted line-through" : ""}`}>{step.title}</span>
                    <span className="max-w-[40%] shrink-0 text-right text-xs text-muted">
                      {step.minutes} min
                      {step.hint && <span className="block">{step.hint}</span>}
                    </span>
                  </button>
                  <HowButton step={step} open={howOpen === step.id} onToggle={() => setHowOpen(howOpen === step.id ? null : step.id)} />
                  </div>
                  {howOpen === step.id && <HowText step={step} />}
                </li>
              );
            })}
          </ul>

          {complete && routine.repeat && (
            <button
              type="button"
              onClick={() => toggleStep(`${base}#${round + 1}`, ROUND_MARKER)}
              className="mt-3 w-full rounded-2xl bg-sage-soft py-3 text-[15px] font-semibold text-sage-dark"
            >
              Done for this meal ✓ · Again after the next one
            </button>
          )}
          {complete ? (
            timedSeconds ? (
              <p className="mt-3 rounded-2xl bg-sage-soft py-3 text-center text-[15px] font-semibold text-sage-dark">
                Done in {formatMinutes(Math.max(1, Math.round(timedSeconds / 60)))}
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
              {done ? "Continue" : "Start"} · ~{formatMinutes(minutesLeft)}
            </button>
          )}
          {canSkip && !complete && (
            <button
              type="button"
              onClick={() => {
                toggleStep(key, SKIPPED);
                setManualOpen(null);
              }}
              className="mt-2 w-full py-1 text-sm font-semibold text-muted"
            >
              {skipped ? "Undo skip" : "Skip today (busy or not feeling well)"}
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
