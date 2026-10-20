"use client";

import { useState } from "react";
import { RoutineCard } from "@/components/RoutineCard";
import {
  CLEANING,
  MONTHS,
  WEEKDAYS,
  currentDayPart,
  dueToday,
  endOfMonthStart,
  inEndOfMonthWindow,
  routinesForMonth,
  weekdayIndex,
} from "@/lib/cleaning";
import { useStore } from "@/lib/store";

const TABS = ["Today", "This week", "Month & year"] as const;
type Tab = (typeof TABS)[number];

export default function RoutinesPage() {
  const { ready } = useStore();
  const [tab, setTab] = useState<Tab>("Today");
  const [now] = useState(() => new Date());

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">Routines</h1>
      <p className="text-[15px] text-muted">Cleaning, a little at a time. Missed days don&apos;t pile up.</p>

      <div className="mt-4 flex gap-1 rounded-full bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-sm ${tab === t ? "bg-ink font-bold text-cream" : "text-ink/70"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {tab === "Today" && <TodayTab now={now} />}
        {tab === "This week" && <WeekTab now={now} />}
        {tab === "Month & year" && <MonthTab now={now} />}
      </div>
    </div>
  );
}

function TodayTab({ now }: { now: Date }) {
  const part = currentDayPart(now);
  const due = dueToday(now);
  const monthLists = routinesForMonth(now);
  return (
    <>
      {due.map((r) => (
        <RoutineCard
          key={r.id}
          routine={r}
          date={now}
          badge={r.when.kind === "daily" && r.when.part === part ? "Now" : r.when.kind === "weekly" ? WEEKDAYS[r.when.weekday] : undefined}
        />
      ))}
      {!inEndOfMonthWindow(now) && (
        <p className="rounded-3xl bg-card/60 p-5 text-[15px] text-muted lg:col-span-2">
          Month-end lists ({monthLists.map((r) => r.name).join(", ")}) open on {endOfMonthStart(now)} {MONTHS[now.getMonth()]}.
        </p>
      )}
    </>
  );
}

function WeekTab({ now }: { now: Date }) {
  const monday = new Date(now);
  monday.setDate(now.getDate() - weekdayIndex(now));
  const weekly = CLEANING.filter((r) => r.when.kind === "weekly");
  return (
    <>
      {weekly.map((r) => {
        if (r.when.kind !== "weekly") return null;
        const date = new Date(monday);
        date.setDate(monday.getDate() + r.when.weekday);
        const isToday = r.when.weekday === weekdayIndex(now);
        return (
          <RoutineCard
            key={r.id}
            routine={r}
            date={date}
            badge={isToday ? "Today" : WEEKDAYS[r.when.weekday].slice(0, 3)}
            collapsible
            startOpen={isToday}
          />
        );
      })}
    </>
  );
}

function MonthTab({ now }: { now: Date }) {
  const open = inEndOfMonthWindow(now);
  const thisMonth = routinesForMonth(now);
  const month = MONTHS[now.getMonth()];
  return (
    <>
      <p className="rounded-3xl bg-card/60 p-5 text-[15px] text-muted lg:col-span-2">
        {open
          ? `Month-end lists are open until the end of ${month}. Tick what you can; the rest waits for next time.`
          : `These open on ${endOfMonthStart(now)} ${month}. You can tick things off early if you get to them.`}
      </p>
      {thisMonth.map((r) => (
        <RoutineCard key={r.id} routine={r} date={now} collapsible startOpen={open} />
      ))}

      <section className="rounded-3xl bg-card p-5 lg:col-span-2">
        <h2 className="text-lg font-bold">Year plan</h2>
        <p className="text-sm text-muted">Each month&apos;s end-of-month lists, on top of the Monthly reset.</p>
        <ul className="mt-3 divide-y divide-line">
          {MONTHS.map((name, i) => {
            const extra = CLEANING.filter(
              (r) => r.when.kind === "monthly" && r.group !== "monthly" && r.when.months.includes(i + 1),
            );
            const isCurrent = i === now.getMonth();
            return (
              <li key={name} className="flex gap-3 py-2.5 text-[15px]">
                <span className={`w-24 shrink-0 ${isCurrent ? "font-bold" : "text-muted"}`}>{name}</span>
                <span className={isCurrent ? "font-semibold" : ""}>{extra.map((r) => r.name).join(" + ")}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
