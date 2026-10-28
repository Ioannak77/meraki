"use client";

// Insights: gentle numbers about how things are going. Streaks count any day you did something,
// and nothing here is a score to beat: the point is to notice what fits and what doesn't.

import { routineProgress } from "@/components/RoutineCard";
import { MONTHS, dueToday, isSkipped, occurrenceKey } from "@/lib/cleaning";
import { money } from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { useGroceries } from "@/lib/groceriesStore";
import { slotKey } from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { dayKey, useStore } from "@/lib/store";
import { useNow } from "@/lib/useNow";

function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export default function InsightsPage() {
  const { ready, tasks, routineDone, settings } = useStore();
  const finance = useFinance();
  const skin = useSkin();
  const groceries = useGroceries();
  const now = useNow();
  if (!ready) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = dayKey(today);
  const monthKey = todayKey.slice(0, 7);

  // Days you did something: finished a task, ticked a cleaning step or a skincare step.
  const active = new Set<string>();
  for (const t of tasks) if (t.completedAt) active.add(dayKey(new Date(t.completedAt)));
  for (const [key, ids] of Object.entries(routineDone)) {
    const when = key.split("@")[1]?.split("#")[0] ?? "";
    if (ids.length && when.length === 10) active.add(when);
  }
  for (const [key, ids] of Object.entries(skin.done)) if (ids.length) active.add(key.split("@")[1]);
  let streak = 0;
  // Today still counts as "in progress": the streak runs up to yesterday if today is empty so far.
  for (let d = active.has(todayKey) ? today : addDays(today, -1); active.has(dayKey(d)); d = addDays(d, -1)) streak++;
  const activeThisMonth = [...active].filter((k) => k.startsWith(monthKey) && k <= todayKey).length;

  // Tasks done per week, last 8 weeks (weeks start on Monday).
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(monday, -7 * (7 - i));
    const end = addDays(start, 7);
    const count = tasks.filter((t) => t.completedAt && new Date(t.completedAt) >= start && new Date(t.completedAt) < end).length;
    return { label: `${start.getDate()}/${start.getMonth() + 1}`, count, current: i === 7 };
  });

  // Cleaning this month: lists finished out of lists due, and the one that's hardest to fit in.
  // Counted from the first day you used Meraki, so the days before don't look like misses.
  const firstUse = [...active].filter((k) => k <= todayKey).sort()[0];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const countFrom = firstUse && firstUse > dayKey(monthStart) ? new Date(firstUse + "T00:00:00") : monthStart;
  const lists = new Map<string, { name: string; due: number; done: number }>();
  let skipped = 0;
  for (let d = countFrom; firstUse && d <= today; d = addDays(d, 1)) {
    for (const r of dueToday(d, settings.officeDays)) {
      if (r.when.kind === "monthly") continue; // the Big clean is counted on its own weekend
      if (isSkipped(routineDone, r, d)) {
        skipped++; // skipped on purpose: not a miss
        continue;
      }
      const entry = lists.get(r.id) ?? { name: r.name, due: 0, done: 0 };
      entry.due++;
      if (routineProgress(r, routineDone[occurrenceKey(r, d)] ?? [], d).complete) entry.done++;
      lists.set(r.id, entry);
    }
  }
  const all = [...lists.values()];
  const listsDue = all.reduce((t, l) => t + l.due, 0);
  const listsDone = all.reduce((t, l) => t + l.done, 0);
  const hardest = all.filter((l) => l.due >= 2).sort((a, b) => a.done / a.due - b.done / b.due)[0];
  const easiest = all.filter((l) => l.due >= 2).sort((a, b) => b.done / b.due - a.done / a.due)[0];

  // Skincare this month.
  let amDays = 0;
  let pmDays = 0;
  let dailyDays = 0;
  const hasDaily = skin.steps.some((st) => st.slot === "day");
  for (let d = new Date(today.getFullYear(), today.getMonth(), 1); d <= today; d = addDays(d, 1)) {
    if (skin.done[slotKey("am", d)]?.length) amDays++;
    if (skin.done[slotKey("pm", d)]?.length) pmDays++;
    if (skin.done[slotKey("day", d)]?.length) dailyDays++;
  }

  // Money: spending (not income or transfers) and groceries, last 6 months.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
    const key = dayKey(d).slice(0, 7);
    const spent = finance.txns
      .filter((t) => t.date.startsWith(key) && t.amount < 0 && t.category !== "transfer" && t.category !== "income")
      .reduce((s, t) => s - t.amount, 0);
    const shopping = groceries.receipts.filter((r) => r.date.startsWith(key)).reduce((s, r) => s + r.total, 0);
    return { label: MONTHS[d.getMonth()].slice(0, 3), spent, shopping, current: i === 5 };
  });
  const hasMoney = months.some((m) => m.spent > 0 || m.shopping > 0);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">Insights</h1>
      <p className="text-[15px] text-muted">How things are going, kindly. Missed days don&apos;t undo anything.</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat value={streak} label={streak === 1 ? "day in a row" : "days in a row"} note="you did something" />
        <Stat value={activeThisMonth} label={`active days in ${MONTHS[today.getMonth()]}`} note={`out of ${today.getDate()}`} />
      </div>

      <section className="mt-4 rounded-3xl bg-card p-5">
        <h2 className="text-lg font-bold">Tasks done</h2>
        <Bars items={weeks.map((w) => ({ label: w.label, value: w.count, current: w.current }))} format={(n) => String(n)} />
        <p className="mt-2 text-sm text-muted">Per week, last 8 weeks.</p>
      </section>

      <section className="mt-4 rounded-3xl bg-card p-5">
        <h2 className="text-lg font-bold">Cleaning in {MONTHS[today.getMonth()]}</h2>
        {listsDue === 0 ? (
          <p className="mt-1 text-muted">Nothing due yet this month.</p>
        ) : (
          <>
            <p className="mt-1 text-[15px]">
              <strong>{listsDone}</strong> of {listsDue} lists finished
              <span className="text-muted"> ({Math.round((listsDone / listsDue) * 100)}%)</span>
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-sky" style={{ width: `${(listsDone / listsDue) * 100}%` }} />
            </div>
            {easiest && easiest.done > 0 && (
              <p className="mt-3 text-[15px]">
                Going well: <strong>{easiest.name}</strong> ({easiest.done} of {easiest.due})
              </p>
            )}
            {skipped > 0 && (
              <p className="mt-1 text-[15px] text-muted">
                {skipped} {skipped === 1 ? "day" : "days"} skipped, and that&apos;s okay.
              </p>
            )}
            {hardest && hardest !== easiest && hardest.done < hardest.due && (
              <p className="mt-1 text-[15px]">
                Hardest to fit in: <strong>{hardest.name}</strong> ({hardest.done} of {hardest.due}). It might be too long, or on
                the wrong day: you can change it in Cleaning schedule › Edit.
              </p>
            )}
          </>
        )}
      </section>

      <section className="mt-4 rounded-3xl bg-card p-5">
        <h2 className="text-lg font-bold">Self care in {MONTHS[today.getMonth()]}</h2>
        <div className={`mt-2 grid gap-3 text-center ${hasDaily ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="rounded-2xl bg-cream p-3">
            <p className="text-2xl font-bold">{amDays}</p>
            <p className="text-sm text-muted">mornings</p>
          </div>
          <div className="rounded-2xl bg-cream p-3">
            <p className="text-2xl font-bold">{pmDays}</p>
            <p className="text-sm text-muted">evenings</p>
          </div>
          {hasDaily && (
            <div className="rounded-2xl bg-cream p-3">
              <p className="text-2xl font-bold">{dailyDays}</p>
              <p className="text-sm text-muted">daily self care</p>
            </div>
          )}
        </div>
      </section>

      {hasMoney && (
        <section className="mt-4 rounded-3xl bg-card p-5">
          <h2 className="text-lg font-bold">Finances</h2>
          {months.some((m) => m.spent > 0) && (
            <>
              <p className="mt-2 text-sm font-semibold text-muted">Spending per month</p>
              <Bars items={months.map((m) => ({ label: m.label, value: m.spent, current: m.current }))} format={(n) => money(n, true)} />
            </>
          )}
          {months.some((m) => m.shopping > 0) && (
            <>
              <p className="mt-4 text-sm font-semibold text-muted">Groceries per month (from receipts)</p>
              <Bars
                items={months.map((m) => ({ label: m.label, value: m.shopping, current: m.current }))}
                format={(n) => money(n, true)}
                tone="bg-rose"
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ value, label, note }: { value: number; label: string; note: string }) {
  return (
    <div className="rounded-3xl bg-card p-4">
      <p className="text-[32px] font-bold leading-none">{value}</p>
      <p className="mt-1 text-[15px] font-semibold">{label}</p>
      <p className="text-[13px] text-muted">{note}</p>
    </div>
  );
}

function Bars({
  items,
  format,
  tone = "bg-sage",
}: {
  items: { label: string; value: number; current: boolean }[];
  format: (n: number) => string;
  tone?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="mt-3 flex h-36 items-end gap-2">
      {items.map((i) => (
        <div key={i.label} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[11px] text-muted">{i.value ? format(i.value) : ""}</span>
          <div className="flex h-24 w-full items-end">
            <div
              className={`w-full rounded-lg ${i.current ? "bg-sage-dark" : tone}`}
              style={{ height: `${Math.max(i.value ? 4 : 0, (i.value / max) * 100)}%` }}
            />
          </div>
          <span className={`text-[11px] ${i.current ? "font-bold" : "text-muted"}`}>{i.label}</span>
        </div>
      ))}
    </div>
  );
}
