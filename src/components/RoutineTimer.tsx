"use client";

// Full-screen cleaning timer. One step at a time with a countdown from the
// step's estimate, so each job feels small and has a finish line. At the end it
// shows how long the whole list really took.

import { useEffect, useRef, useState } from "react";
import { formatMinutes, type Step } from "@/lib/cleaning";
import { howTo } from "@/lib/cleaningHow";
import { useStore } from "@/lib/store";
import { Icon } from "./icons";

const HOLD_TO_SKIP_MS = 1000;
const RING = 2 * Math.PI * 90;

function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** One step in a timed run. A run can mix lists (e.g. a big month-end weekend). */
export type TimerItem = { step: Step; occurrence: string; label?: string };

export function RoutineTimer({
  title,
  items,
  onClose,
}: {
  title: string;
  items: TimerItem[];
  onClose: () => void;
}) {
  const { routineDone, finishTimedRun } = useStore();

  // Steps still to do when the timer opened. Fixed for this run.
  const [queue] = useState<TimerItem[]>(() =>
    items.filter((it) => !(routineDone[it.occurrence] ?? []).includes(it.step.id)),
  );
  const [index, setIndex] = useState(0);
  const [howFor, setHowFor] = useState<string | null>(null); // the step whose instructions are open
  const [stepStart, setStepStart] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [runSeconds, setRunSeconds] = useState(0);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rang = useRef(false);

  const item = queue[index];
  const step = item?.step;
  const finished = index >= queue.length;
  const elapsed = ((pausedAt ?? now) - stepStart) / 1000;
  const planned = step ? step.minutes * 60 : 0;
  const left = planned - elapsed;
  const countable = (it: TimerItem) => (it.step.optional ? 0 : it.step.minutes);
  const minutesLeft = queue.slice(index + 1).reduce((sum, it) => sum + countable(it), 0) + Math.max(0, left) / 60;
  const plannedTotal = queue.reduce((sum, it) => sum + countable(it), 0);

  // Tick a few times a second; times come from the clock so a locked phone is fine.
  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [finished]);

  // Keep the screen on while the timer is open.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  // Gentle chime and buzz when a step's estimate runs out (once per step).
  useEffect(() => {
    if (step && left <= 0 && !rang.current && pausedAt === null) {
      rang.current = true;
      navigator.vibrate?.([200, 100, 200]);
      chime();
    }
  }, [left, step, pausedAt]);

  function next(markDone: boolean) {
    if (!item) return;
    const seconds = Math.round(elapsed);
    finishTimedRun(item.occurrence, markDone ? [item.step.id] : [], markDone ? seconds : 0);
    if (markDone) setRunSeconds((s) => s + seconds);
    setIndex((i) => i + 1);
    setStepStart(Date.now());
    setNow(Date.now());
    setPausedAt(null);
    rang.current = false;
  }

  function togglePause() {
    if (pausedAt === null) setPausedAt(Date.now());
    else {
      setStepStart((s) => s + (Date.now() - pausedAt));
      setPausedAt(null);
    }
  }

  function startHold() {
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      setHolding(false);
      next(false);
    }, HOLD_TO_SKIP_MS);
  }
  function endHold() {
    setHolding(false);
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }

  const over = left < 0;

  return (
    <div className="pt-safe pb-safe animate-enter fixed inset-0 z-50 flex flex-col items-center overflow-y-auto overscroll-contain bg-cream px-5 text-center">
      <div className="flex w-full max-w-md items-center justify-between pt-2">
        <span className="text-sm text-muted">
          {finished ? title : `${title} · step ${index + 1} of ${queue.length}`}
        </span>
        <button onClick={onClose} aria-label="Close the timer" className="grid size-11 place-items-center rounded-full bg-card text-muted">
          <Icon.close className="size-5" />
        </button>
      </div>

      {finished ? (
        <div className="my-auto flex w-full max-w-md flex-col items-center gap-3 py-10">
          <span className="grid size-16 place-items-center rounded-full bg-sage text-white">
            <Icon.check className="size-9" />
          </span>
          <h2 className="text-3xl font-bold">Done in {formatMinutes(Math.max(1, Math.round(runSeconds / 60)))}</h2>
          <p className="text-[17px] text-muted">
            {queue.length === 0
              ? "Everything was already ticked off."
              : runSeconds / 60 <= plannedTotal
                ? `You planned ${formatMinutes(plannedTotal)}. Quicker than it felt, right?`
                : `You planned ${formatMinutes(plannedTotal)}, and you still finished. That's what counts.`}
          </p>
          <button onClick={onClose} className="mt-6 w-full rounded-2xl bg-sage-dark py-4 text-lg font-bold text-white">
            Back
          </button>
        </div>
      ) : (
        <div className="flex w-full max-w-md flex-1 flex-col items-center">
          {item.label && <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-sage">{item.label}</p>}
          <h2 className={`${item.label ? "mt-1" : "mt-6"} text-[28px] font-bold leading-tight`}>{step.title}</h2>
          <p className="mt-1 min-h-6 text-[15px] text-muted">
            {step.optional ? `Optional${step.hint ? `, ${step.hint}` : ""}. Skip it if it's not needed.` : step.hint ?? ""}
          </p>
          {howTo(step) &&
            (howFor === step.id ? (
              <p className="animate-reveal mt-2 rounded-2xl bg-card px-4 py-3 text-left text-[14px] leading-snug">{howTo(step)}</p>
            ) : (
              <button type="button" onClick={() => setHowFor(step.id)} className="mt-1 text-sm font-semibold text-sage-dark">
                How to do it
              </button>
            ))}

          <div className="relative my-6 aspect-square w-[min(72vw,300px)]">
            <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden>
              <circle cx="100" cy="100" r="90" fill="none" stroke="var(--color-line)" strokeWidth="12" />
              <circle
                cx="100"
                cy="100"
                r="90"
                fill="none"
                stroke={over ? "var(--color-peach)" : "var(--color-sage)"}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={over ? 0 : RING * (1 - Math.max(0, left) / planned)}
                className="transition-[stroke-dashoffset] duration-300 ease-linear"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-6xl font-bold tabular-nums ${over ? "text-peach" : ""} ${pausedAt !== null ? "opacity-50" : ""}`}>
                {over ? `+${mmss(-left)}` : mmss(left)}
              </span>
              <span className="mt-1 text-sm text-muted">
                {pausedAt !== null ? "Paused" : over ? "Nearly there" : `of ${step.minutes} min`}
              </span>
            </div>
          </div>

          <p className="text-sm text-muted">About {formatMinutes(Math.max(1, Math.ceil(minutesLeft)))} left in total</p>

          <div className="mt-auto w-full pb-4 pt-6">
            <button onClick={() => next(true)} className="w-full rounded-2xl bg-sage-dark py-5 text-xl font-bold text-white">
              ✓ Done
            </button>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button onClick={togglePause} className="rounded-2xl bg-card py-3.5 font-semibold">
                {pausedAt !== null ? "Resume" : "Pause"}
              </button>
              {step.optional ? (
                <button onClick={() => next(false)} className="rounded-2xl bg-card py-3.5 font-semibold">
                  Not needed
                </button>
              ) : (
                <button
                  onPointerDown={startHold}
                  onPointerUp={endHold}
                  onPointerLeave={endHold}
                  onPointerCancel={endHold}
                  className="relative touch-none select-none overflow-hidden rounded-2xl bg-card py-3.5 font-semibold"
                >
                  <span
                    className={`absolute inset-0 origin-left bg-line ${holding ? "scale-x-100 transition-transform duration-1000 ease-linear" : "scale-x-0 transition-transform duration-200 ease-out"}`}
                  />
                  <span className="relative">Hold to skip</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

let sharedAudio: AudioContext | null = null;

/** Phones only allow sound after a tap, so call this from the Start button. */
export function unlockTimerAudio() {
  try {
    sharedAudio ??= new AudioContext();
    sharedAudio.resume().catch(() => {});
  } catch {}
}

function chime() {
  const ctx = sharedAudio;
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [660, 880, 1100].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    const t = t0 + i * 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  });
}
