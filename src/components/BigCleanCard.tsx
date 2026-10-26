"use client";

// Month-end weekends: the weekly list and the month's big lists merged into
// one checklist, grouped by room, so it's one focused clean instead of
// jumping between "weekly" and "monthly". Each step still saves to its own
// list, so the Cleaning schedule screen stays in sync.

import { useState } from "react";
import { ROOMS, formatMinutes, occurrenceKey, stepsOn, type Room, type Routine } from "@/lib/cleaning";
import { today } from "@/lib/clock";
import { useStore } from "@/lib/store";
import { Icon } from "./icons";
import { RoutineTimer, unlockTimerAudio, type TimerItem } from "./RoutineTimer";

export function BigCleanCard({ routines, date = today() }: { routines: Routine[]; date?: Date }) {
  const { routineDone, toggleStep } = useStore();
  const [timing, setTiming] = useState<{ title: string; items: TimerItem[] } | null>(null);
  const [openRooms, setOpenRooms] = useState<Set<Room> | null>(null);

  const items: (TimerItem & { room: Room; listName: string })[] = routines.flatMap((r) => {
    const occurrence = occurrenceKey(r, date);
    return stepsOn(r, date).map((step) => ({ step, occurrence, room: step.room, listName: r.name, label: step.room }));
  });
  const isDone = (it: TimerItem) => (routineDone[it.occurrence] ?? []).includes(it.step.id);
  const counted = items.filter((it) => !it.step.optional);
  const done = counted.filter(isDone).length;
  const minutesLeft = counted.filter((it) => !isDone(it)).reduce((sum, it) => sum + it.step.minutes, 0);

  const byRoom = ROOMS.map((room) => ({ room, items: items.filter((it) => it.room === room) })).filter(
    (g) => g.items.length > 0,
  );
  // Rooms start open until they're finished; a finished room folds away.
  const roomDone = (g: (typeof byRoom)[number]) => g.items.every((it) => it.step.optional || isDone(it));
  const isOpen = (g: (typeof byRoom)[number]) => (openRooms ? openRooms.has(g.room) : !roomDone(g));
  function toggleRoom(room: Room) {
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
        <div className="h-full rounded-full bg-sun transition-[width] duration-500" style={{ width: `${counted.length ? (done / counted.length) * 100 : 0}%` }} />
      </div>

      {minutesLeft > 0 && (
        <button
          type="button"
          onClick={() => start("Big clean", byRoom.flatMap((g) => g.items))}
          className="mt-4 w-full rounded-2xl bg-sage-dark py-3.5 text-[16px] font-bold text-white"
        >
          {done ? "Continue" : "Start"} room by room · ~{formatMinutes(minutesLeft)}
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
                <span className="flex-1 text-[16px] font-bold">{g.room}</span>
                <span className={`text-sm ${left.length ? "text-muted" : "font-semibold text-sage-dark"}`}>
                  {left.length ? `${left.length} left · ~${formatMinutes(left.reduce((t, it) => t + it.step.minutes, 0))}` : "Done ✓"}
                </span>
                <span className={`text-muted transition-transform ${open ? "rotate-90" : ""}`}>›</span>
              </button>
              {open && (
                <>
                  <ul>
                    {g.items.map((it) => {
                      const ticked = isDone(it);
                      return (
                        <li key={it.occurrence + it.step.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (!ticked) navigator.vibrate?.(20);
                              toggleStep(it.occurrence, it.step.id);
                            }}
                            aria-pressed={ticked}
                            className="flex w-full items-center gap-3 py-2.5 text-left"
                          >
                            <span
                              className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                                ticked ? "animate-pop border-sage bg-sage text-white" : "border-line bg-card"
                              }`}
                            >
                              {ticked && <Icon.check className="size-4" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block text-[15px] ${ticked ? "text-muted line-through" : ""}`}>{it.step.title}</span>
                              <span className="block text-xs text-muted">{it.listName}</span>
                            </span>
                            <span className="shrink-0 text-right text-xs text-muted">
                              {it.step.minutes} min
                              {it.step.hint && <span className="block">{it.step.hint}</span>}
                            </span>
                          </button>
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
                      Just {g.room} · ~{formatMinutes(left.reduce((t, it) => t + it.step.minutes, 0))}
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
