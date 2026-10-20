"use client";

// One skincare slot (morning or evening) for a day: tick the steps that are due.

import { isStepDue, slotKey, type Slot } from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { Icon } from "../icons";

export const SLOT_LABEL: Record<Slot, string> = { am: "Morning", pm: "Evening" };
export const SLOT_TITLE: Record<Slot, string> = { am: "Morning skincare", pm: "Evening skincare" };

export function dueSteps(steps: ReturnType<typeof useSkin>["steps"], slot: Slot, d: Date) {
  return steps.filter((s) => s.slot === slot && isStepDue(s, d));
}

export function SlotCard({ slot, date, badge }: { slot: Slot; date: Date; badge?: string }) {
  const { steps, done, toggle, settings } = useSkin();
  const key = slotKey(slot, date);
  const due = dueSteps(steps, slot, date);
  const ticked = done[key] ?? [];
  const count = due.filter((s) => ticked.includes(s.id)).length;
  const complete = due.length > 0 && count === due.length;

  return (
    <section className="rounded-3xl bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-soft text-rose">
          {slot === "am" ? <Icon.sun className="size-6" /> : <Icon.moon className="size-6" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[17px] font-bold">{SLOT_TITLE[slot]}</span>
            {badge && <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-cream">{badge}</span>}
          </span>
          <span className="block text-[13px] text-muted">
            {slot === "am" ? settings.amTime : settings.pmTime}
          </span>
        </span>
        <span className={`shrink-0 text-sm font-semibold ${complete ? "text-sage-dark" : "text-muted"}`}>
          {due.length === 0 ? "Nothing today" : complete ? "Done ✓" : `${count}/${due.length}`}
        </span>
      </div>

      {due.length > 0 && (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-rose transition-[width] duration-500" style={{ width: `${(count / due.length) * 100}%` }} />
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
