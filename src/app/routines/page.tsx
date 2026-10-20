"use client";

import { today } from "@/lib/clock";
import { useMemo, useState } from "react";
import { RoutineCard } from "@/components/RoutineCard";
import {
  CLEANING,
  weeklyPlan,
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
  const { ready, settings } = useStore();
  const [tab, setTab] = useState<Tab>("Today");
  const now = useMemo(() => today(settings.testDate), [settings.testDate]);

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
  const { settings } = useStore();
  const part = currentDayPart(now);
  const due = dueToday(now, settings.officeDays);
  const monthLists = routinesForMonth(now);
  const todaySlot = weeklyPlan(settings.officeDays)[weekdayIndex(now)];
  const isOffice = settings.officeDays.includes(weekdayIndex(now));
  return (
    <>
      {isOffice && (
        <p className="rounded-3xl bg-sage-soft p-4 text-[15px] text-sage-dark lg:col-span-2">
          Office day: you get the lighter weekly list today.
        </p>
      )}
      {due.map((r) => (
        <RoutineCard
          key={r.id}
          routine={r}
          date={now}
          badge={r.when.kind === "daily" && r.when.part === part ? "Now" : r.when.kind === "weekly" ? WEEKDAYS[weekdayIndex(now)] : undefined}
          subtitle={
            r.when.kind === "weekly" && todaySlot.movedFrom !== undefined
              ? `Swapped with ${WEEKDAYS[todaySlot.movedFrom]}`
              : undefined
          }
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
  const { settings } = useStore();
  const plan = weeklyPlan(settings.officeDays);
  return (
    <>
      {plan.map((slot, day) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + day);
        const isToday = day === weekdayIndex(now);
        const office = settings.officeDays.includes(day);
        return (
          <RoutineCard
            key={day}
            routine={slot.routine}
            date={date}
            badge={isToday ? "Today" : WEEKDAYS[day].slice(0, 3)}
            subtitle={
              slot.movedFrom !== undefined
                ? `${office ? "Office day · " : ""}swapped with ${WEEKDAYS[slot.movedFrom]}`
                : office
                  ? "Office day"
                  : undefined
            }
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
