"use client";

// Month-end weekends: the weekend's weekly list and the month's big lists merged into one checklist,
// in the order you'd clean (machines and soaks first, high to low, floors last, close down on Sunday;
// see PHASES), instead of jumping between lists. Each step still saves to its own list, so the
// Cleaning schedule screen stays in sync.

import { useState } from "react";
import { BEDROOM_DAY, PHASES, bigCleanOrder, coveredInBigClean, formatMinutes, monthEndSwap, occurrenceKey, phaseOf, stepsOn, type Room, type Routine } from "@/lib/cleaning";
import { today } from "@/lib/clock";
import { useStore } from "@/lib/store";
import { Icon } from "./icons";
import { RoutineTimer, unlockTimerAudio, type TimerItem } from "./RoutineTimer";
import { HowButton, HowText } from "./StepHow";

export function BigCleanCard({ routines, date = today() }: { routines: Routine[]; date?: Date }) {
  const { routineDone, toggleStep } = useStore();
  const [timing, setTiming] = useState<{ title: string; items: TimerItem[] } | null>(null);
  const [openRooms, setOpenRooms] = useState<Set<string> | null>(null);
  const [howOpen, setHowOpen] = useState<string | null>(null); // the step whose instructions are open

  // The weekly list matching the month's deep clean joins in, saved under the Saturday (so Sunday sees the same ticks).
  const swap = monthEndSwap(date);
  const lists: { r: Routine; on: Date }[] = [
    ...routines.map((r) => ({ r, on: date })),
    ...(swap && !routines.some((r) => r.id === swap.weekly.id) ? [{ r: swap.weekly, on: swap.saturday }] : []),
  ];
  const all = lists.flatMap(({ r, on }) => {
    const occurrence = occurrenceKey(r, on);
    return stepsOn(r, on).map((step) => ({ step, occurrence, room: step.room, listName: r.name, label: PHASES.find((p) => p.id === phaseOf(step))!.label }));
  });
  const ids = new Set(all.map((it) => it.step.id));
  // Daily steps the Big clean already does (the bed made with fresh sheets, every floor vacuumed) are left out.
  const items: (TimerItem & { room: Room; listName: string })[] = bigCleanOrder(
    // The bedroom jobs are done on the bedroom day (see bedroomDay), not in the Big clean.
    all.filter((it) => !coveredInBigClean(it.step, ids) && !(swap && BEDROOM_DAY.includes(it.step.id))),
    (it) => it.step,
  );
  const isDone = (it: TimerItem) => (routineDone[it.occurrence] ?? []).includes(it.step.id);
  const counted = items.filter((it) => !it.step.optional);
  const done = counted.filter(isDone).length;
  const minutesLeft = counted.filter((it) => !isDone(it)).reduce((sum, it) => sum + it.step.minutes, 0);

  // One group per part of the clean, in order (only the parts this weekend has).
  const byRoom = PHASES.map((p) => ({ room: p.label, phase: p, items: items.filter((it) => phaseOf(it.step) === p.id) })).filter(
    (g) => g.items.length > 0,
  );
  // Rooms start open until they're finished; a finished room folds away.
  const roomDone = (g: (typeof byRoom)[number]) => g.items.every((it) => it.step.optional || isDone(it));
  const isOpen = (g: (typeof byRoom)[number]) => (openRooms ? openRooms.has(g.room) : !roomDone(g));
  function toggleRoom(room: string) {
    setOpenRooms((prev) => {
      const next = new Set(prev ?? byRoom.filter((g) => !roomDone(g)).map((g) => g.room));
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  }

  function start(title: string, list: TimerItem[]) {
    unlockTimerAudio();
    setTiming({ title, items: list });
  }

  return (
    <section className="rounded-3xl bg-card p-5 lg:col-span-2">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sun/30 text-ink">
          <Icon.home className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[17px] font-bold">Big clean</span>
            <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-cream">Month end</span>
          </span>
          <span className="block text-[13px] text-muted">{routines.map((r) => r.name).join(" + ")}</span>
        </span>
        <span className={`shrink-0 text-sm font-semibold ${done === counted.length ? "text-sage-dark" : "text-muted"}`}>
          {done === counted.length ? "Done ✓" : `${done}/${counted.length}`}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-sun transition-[width] duration-300 ease-out" style={{ width: `${counted.length ? (done / counted.length) * 100 : 0}%` }} />
      </div>

      {minutesLeft > 0 && (
        <button
          type="button"
          onClick={() => start("Big clean", byRoom.flatMap((g) => g.items))}
          className="mt-4 w-full rounded-2xl bg-sage-dark py-3.5 text-[16px] font-bold text-white"
        >
          {done ? "Continue" : "Start"} in order · ~{formatMinutes(minutesLeft)}
        </button>
      )}

      <div className="mt-2 divide-y divide-line">
        {byRoom.map((g) => {
          const left = g.items.filter((it) => !it.step.optional && !isDone(it));
          const open = isOpen(g);
          return (
            <div key={g.room} className="py-1">
              <button
                type="button"
                onClick={() => toggleRoom(g.room)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 py-3 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-peach">{g.phase.when}</span>
                  <span className="block text-[16px] font-bold">{g.room}</span>
                  <span className="block text-xs text-muted">{g.phase.note}</span>
                </span>
                <span className={`text-sm ${left.length ? "text-muted" : "font-semibold text-sage-dark"}`}>
                  {left.length ? `${left.length} left · ~${formatMinutes(left.reduce((t, it) => t + it.step.minutes, 0))}` : "Done ✓"}
                </span>
                <span className={`text-muted transition-transform duration-200 ease-out ${open ? "rotate-90" : ""}`}>›</span>
              </button>
              {open && (
                <>
                  <ul className={openRooms ? "animate-reveal" : ""}>
                    {g.items.map((it) => {
                      const ticked = isDone(it);
                      return (
                        <li key={it.occurrence + it.step.id}>
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
                              <span className="block text-xs text-muted">{it.listName}</span>
                            </span>
                            <span className="max-w-[40%] shrink-0 text-right text-xs text-muted">
                              {it.step.minutes} min
                              {it.step.hint && <span className="block">{it.step.hint}</span>}
                            </span>
                          </button>
                          <HowButton
                            step={it.step}
                            open={howOpen === it.occurrence + it.step.id}
                            onToggle={() => setHowOpen(howOpen === it.occurrence + it.step.id ? null : it.occurrence + it.step.id)}
                          />
                          </div>
                          {howOpen === it.occurrence + it.step.id && <HowText step={it.step} />}
                        </li>
                      );
                    })}
                  </ul>
                  {left.length > 0 && (
                    <button
                      type="button"
                      onClick={() => start(g.room, g.items)}
                      className="mb-2 mt-1 w-full rounded-xl bg-sage-soft py-2.5 text-sm font-bold text-sage-dark"
                    >
                      Just this part · ~{formatMinutes(left.reduce((t, it) => t + it.step.minutes, 0))}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {timing && <RoutineTimer title={timing.title} items={timing.items} onClose={() => setTiming(null)} />}
    </section>
  );
}
