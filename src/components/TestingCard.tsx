"use client";

// Settings > Testing: pretend it's another day, to preview the month-end,
// every-3-months and twice-a-year lists before they're really due.

import { MONTHS, endOfMonthStart, routinesForMonth } from "@/lib/cleaning";
import { realToday } from "@/lib/clock";
import { dayKey, useStore } from "@/lib/store";

/** A day inside the month-end window of the month `offset` months from now. */
function monthEndDay(offset: number) {
  const real = realToday();
  const first = new Date(real.getFullYear(), real.getMonth() + offset, 1);
  return new Date(first.getFullYear(), first.getMonth(), endOfMonthStart(first) + 2);
}

export function TestingCard() {
  const { settings, updateSettings } = useStore();
  const active = settings.testDate ?? null;

  const presets = [0, 1, 2].map((offset) => {
    const d = monthEndDay(offset);
    return {
      key: dayKey(d),
      label: `${MONTHS[d.getMonth()]} month end`,
      lists: routinesForMonth(d).map((r) => r.name).join(" + "),
    };
  });

  return (
    <section className="mt-5 rounded-3xl border-2 border-dashed border-line bg-card p-5">
      <h2 className="text-lg font-bold">Testing</h2>
      <p className="text-[15px] text-muted">
        Pretend it&apos;s another day to see how month-end, every-3-months and twice-a-year lists will look. Ticks made
        while testing are saved for that pretend day only.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => updateSettings({ testDate: p.key })}
            className={`rounded-2xl px-4 py-3 text-left ${active === p.key ? "bg-sage-dark text-white" : "bg-cream"}`}
          >
            <span className="block font-semibold">{p.label}</span>
            <span className={`block text-sm ${active === p.key ? "text-white/80" : "text-muted"}`}>{p.lists}</span>
          </button>
        ))}
      </div>

      <label className="mt-4 flex items-center gap-3 text-[15px]">
        <span className="text-muted">Or pick a day</span>
        <input
          type="date"
          value={active ?? ""}
          onChange={(e) => updateSettings({ testDate: e.target.value || null })}
          className="rounded-xl bg-cream px-3 py-2"
        />
      </label>

      {active && (
        <button
          onClick={() => updateSettings({ testDate: null })}
          className="mt-4 w-full rounded-2xl bg-ink py-3 font-bold text-cream"
        >
          Back to real today
        </button>
      )}
    </section>
  );
}
