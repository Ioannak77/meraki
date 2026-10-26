"use client";

// One self-care list for a day (morning skincare, evening skincare or daily self care): tick the steps that are due.

import { useEffect, useState } from "react";
import { isStepDue, slotKey, type Slot } from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { WEATHER_EVENT, cachedWeather } from "@/lib/weather";

/** Sunscreen steps follow today's UV: a must from 3, optional below. */
const isSunscreen = (name: string) => /sunscreen|spf|sun ?cream|sunblock/i.test(name);
import { Icon } from "../icons";

export const SLOT_LABEL: Record<Slot, string> = { am: "Morning", pm: "Evening", day: "Daily" };
export const SLOT_TITLE: Record<Slot, string> = { am: "Morning skincare", pm: "Evening skincare", day: "Daily self care" };

export function dueSteps(steps: ReturnType<typeof useSkin>["steps"], slot: Slot, d: Date) {
  return steps.filter((s) => s.slot === slot && isStepDue(s, d));
}

export function SlotCard({ slot, date, badge, startOpen = true }: { slot: Slot; date: Date; badge?: string; startOpen?: boolean }) {
  const { steps, done, toggle, settings } = useSkin();
  const [open, setOpen] = useState(startOpen);
  const key = slotKey(slot, date);
  const due = dueSteps(steps, slot, date);
  const ticked = done[key] ?? [];
  // Draw again when the weather arrives (it's fetched by the card at the top of Today).
  const [, setWeatherSeen] = useState(0);
  useEffect(() => {
    const seen = () => setWeatherSeen((n) => n + 1);
    window.addEventListener(WEATHER_EVENT, seen);
    return () => window.removeEventListener(WEATHER_EVENT, seen);
  }, []);
  // Today's UV (from the weather on Today), for the morning sunscreen.
  const uv = slot === "am" && typeof window !== "undefined" ? (cachedWeather()?.uv ?? null) : null;
  const optional = (name: string) => uv !== null && uv < 3 && isSunscreen(name);
  const counted = due.filter((s) => !optional(s.name));
  const count = counted.filter((s) => ticked.includes(s.id)).length;
  const complete = counted.length > 0 && count === counted.length;

  return (
    <section className="rounded-3xl bg-card p-5">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-soft text-rose">
          {slot === "am" ? <Icon.sun className="size-6" /> : slot === "pm" ? <Icon.moon className="size-6" /> : <Icon.heart className="size-6" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[17px] font-bold">{SLOT_TITLE[slot]}</span>
            {badge && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-cream">{badge}</span>}
          </span>
          <span className="block text-[13px] text-muted">
            {slot === "am" ? settings.amTime : slot === "pm" ? settings.pmTime : "Any time today"}
          </span>
        </span>
        <span className={`shrink-0 text-sm font-semibold ${complete ? "text-sage-dark" : "text-muted"}`}>
          {due.length === 0 ? "Nothing today" : complete ? "Done ✓" : `${count}/${counted.length}`}
        </span>
      </button>

      {open && due.length > 0 && (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-rose transition-[width] duration-500" style={{ width: `${counted.length ? (count / counted.length) * 100 : 0}%` }} />
          </div>
          <ul className="mt-2 divide-y divide-line">
            {due.map((s) => {
              const isDone = ticked.includes(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isDone) navigator.vibrate?.(20);
                      toggle(key, s.id);
                    }}
                    aria-pressed={isDone}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-full border-2 ${
                        isDone ? "animate-pop border-rose bg-rose text-white" : "border-line bg-card"
                      }`}
                    >
                      {isDone && <Icon.check className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[15px] ${isDone ? "text-muted line-through" : ""}`}>{s.name}</span>
                      {s.note && <span className="block text-xs text-muted">{s.note}</span>}
                    </span>
                    {uv !== null && isSunscreen(s.name) && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${uv >= 3 ? "bg-peach-soft text-peach" : "bg-cream text-muted"}`}
                      >
                        UV {uv} · {uv >= 3 ? "must" : "optional"}
                      </span>
                    )}
                    {s.schedule.kind !== "daily" && (
                      <span className="shrink-0 rounded-full bg-rose-soft px-2 py-0.5 text-[11px] font-semibold text-rose">today</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
