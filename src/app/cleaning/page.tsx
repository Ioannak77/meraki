"use client";

import { useState } from "react";
import { BigCleanCard } from "@/components/BigCleanCard";
import { BedroomDayCard } from "@/components/BedroomDayCard";
import { CleaningEditor } from "@/components/CleaningEditor";
import { RoutineCard, routineProgress } from "@/components/RoutineCard";
import {
  cleaningLists,
  formatMinutes,
  weeklyPlan,
  MONTHS,
  WEEKDAYS,
  currentDayPart,
  occurrenceKey,
  type DayPart,
  dueToday,
  inEndOfMonthWindow,
  joinsBigClean,
  monthEndSwap,
  monthEndLabel,
  monthEndSaturday,
  routinesForMonth,
  weekdayIndex,
} from "@/lib/cleaning";
import { dayKey, useStore } from "@/lib/store";
import { useNow } from "@/lib/useNow";

const TABS = ["Today", "This week", "Big clean", "Edit"] as const;
type Tab = (typeof TABS)[number];

export default function CleaningSchedulePage() {
  const { ready } = useStore();
  const [tab, setTab] = useState<Tab>("Today");
  const now = useNow();

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">Cleaning schedule</h1>
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

      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {tab === "Today" && <TodayTab now={now} />}
        {tab === "This week" && <WeekTab now={now} />}
        {tab === "Big clean" && <MonthTab now={now} />}
        {tab === "Edit" && <CleaningEditor />}
      </div>
    </div>
  );
}

function TodayTab({ now }: { now: Date }) {
  const { settings, routineDone } = useStore();
  const part = currentDayPart(now);
  const due = dueToday(now, settings.officeDays);
  const monthLists = routinesForMonth(now);
  const todaySlot = weeklyPlan(settings.officeDays)[weekdayIndex(now)];
  const swapNow = monthEndSwap(now, settings.officeDays);
  const todaySwap = swapNow && dayKey(swapNow.day) === dayKey(now) ? swapNow : null;
  const isOffice = settings.officeDays.includes(weekdayIndex(now));
  const bigClean = inEndOfMonthWindow(now);
  // Only the list for now (and today's weekly one) starts open; earlier ones go quiet.
  const order: DayPart[] = ["morning", "meals", "evening"];
  const isPast = (p: DayPart) => part !== null && order.indexOf(p) < order.indexOf(part);
  // The list for now first, then today's weekly list, then the other daily lists.
  const rank = (r: (typeof due)[number]) => (r.when.kind === "daily" ? (r.when.part === part ? 0 : 2) : 1);
  const daysToBigClean = Math.round(
    (monthEndSaturday(now).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000,
  );
  return (
    <>
      {isOffice && (
        <p className="rounded-3xl bg-sage-soft p-4 text-[15px] text-sage-dark lg:col-span-2">
          Office day: you get the lighter weekly list today.
        </p>
      )}
      {due
        // On the month-end weekend everything but After meals is inside the Big clean.
        .filter((r) => !bigClean || !joinsBigClean(r))
        .sort((a, b) => rank(a) - rank(b))
        .map((r) =>
          todaySwap && r.id === todaySwap.bedroom.id ? (
            <BedroomDayCard key={r.id} date={now} badge={WEEKDAYS[weekdayIndex(now)]} />
          ) : (
          <RoutineCard
            key={r.id}
            routine={r}
            date={now}
            badge={r.when.kind === "daily" && r.when.part === part ? "Now" : r.when.kind === "weekly" ? WEEKDAYS[weekdayIndex(now)] : undefined}
            subtitle={
              r.when.kind === "weekly" && todaySwap
                ? `${todaySwap.weekly.name} is in the month-end Big clean`
                : r.when.kind === "weekly" && todaySlot.movedFrom !== undefined
                ? `Swapped with ${WEEKDAYS[todaySlot.movedFrom]}`
                : r.when.kind === "daily" && isPast(r.when.part) && !routineProgress(r, routineDone[occurrenceKey(r, now)] ?? [], now).complete
                  ? "Missed it? No worries"
                  : undefined
            }
            collapsible
            startOpen={r.when.kind !== "daily" || r.when.part === part}
            canSkip={r.when.kind === "weekly"}
          />
          ),
        )}
      {bigClean ? (
        <BigCleanCard routines={due.filter(joinsBigClean)} date={now} />
      ) : (
        // A heads-up in the week before; the details are in the Big clean tab.
        daysToBigClean > 0 &&
        daysToBigClean <= 7 && (
        <p className="rounded-3xl bg-card/60 p-5 text-[15px] text-muted lg:col-span-2">
          Big clean ({monthLists.map((r) => r.name).join(", ")}) is on the month-end weekend, {monthEndLabel(now)}.
        </p>
        )
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
        // Around a month-end weekend one day swaps with the Big clean (see monthEndSwap).
        const sw = monthEndSwap(date, settings.officeDays);
        const swappedDay = sw && dayKey(sw.day) === dayKey(date);
        if (swappedDay) return <BedroomDayCard key={day} date={date} badge={isToday ? "Today" : WEEKDAYS[day].slice(0, 3)} />;
        // The month-end Saturday's list is the one that matches the deep clean.
        const sat = sw && dayKey(sw.saturday) === dayKey(date);
        return (
          <RoutineCard
            key={day}
            routine={sat ? sw.weekly : slot.routine}
            date={date}
            badge={isToday ? "Today" : WEEKDAYS[day].slice(0, 3)}
            subtitle={
              sat
                ? "In the month-end Big clean"
                : slot.movedFrom !== undefined
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
  return (
    <>
      <p className="rounded-3xl bg-card/60 p-5 text-[15px] text-muted lg:col-span-2">
        {open
          ? "It's the month-end weekend: the Today tab has everything as one Big clean, room by room."
          : `These are for the month-end weekend, ${monthEndLabel(now)}. You can tick things off early if you get to them.`}
      </p>
      {thisMonth.map((r) => (
        <RoutineCard key={r.id} routine={r} date={now} collapsible startOpen={open} />
      ))}

      <section className="rounded-3xl bg-card p-5 lg:col-span-2">
        <h2 className="text-lg font-bold">Year plan</h2>
        <p className="text-sm text-muted">Each month&apos;s end-of-month lists, on top of the Monthly reset. Tap a month to see everything in it.</p>
        <ul className="mt-3 divide-y divide-line">
          {MONTHS.map((name, i) => (
            <YearMonth key={name} name={name} month={i + 1} isCurrent={i === now.getMonth()} />
          ))}
        </ul>
      </section>
    </>
  );
}

/** One month of the year plan: its lists at a glance, and every step when you tap it. */
function YearMonth({ name, month, isCurrent }: { name: string; month: number; isCurrent: boolean }) {
  const [open, setOpen] = useState(false);
  const lists = cleaningLists().filter((r) => r.when.kind === "monthly" && r.when.months.includes(month));
  const extra = lists.filter((r) => r.group !== "monthly");
  const inMonth = (r: (typeof lists)[number]) => r.steps.filter((st) => !st.months || st.months.includes(month));
  const minutes = (r: (typeof lists)[number]) => inMonth(r).filter((st) => !st.optional).reduce((t, st) => t + st.minutes, 0);
  const total = lists.reduce((t, r) => t + minutes(r), 0);
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 py-2.5 text-left text-[15px]">
        <span className={`w-24 shrink-0 ${isCurrent ? "font-bold" : "text-muted"}`}>{name}</span>
        <span className={`min-w-0 flex-1 ${isCurrent ? "font-semibold" : ""}`}>{extra.map((r) => r.name).join(" + ") || "Monthly reset only"}</span>
        <span className={`shrink-0 text-muted transition-transform duration-200 ease-out ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open && (
        <div className="animate-reveal mb-3 space-y-3 rounded-2xl bg-cream p-3.5">
          <p className="text-[13px] text-muted">About {formatMinutes(total)} in all, on the month-end weekend.</p>
          {lists.map((r) => (
            <section key={r.id}>
              <h3 className="flex justify-between gap-3 text-xs font-bold uppercase tracking-wide text-muted">
                <span>{r.name}</span>
                <span className="shrink-0 font-semibold normal-case tracking-normal">~{formatMinutes(minutes(r))}</span>
              </h3>
              <ul className="mt-1 divide-y divide-line">
                {inMonth(r).map((st) => (
                  <li key={st.id} className="flex items-baseline gap-3 py-1.5 text-[14px]">
                    <span className="min-w-0 flex-1">
                      {st.title}
                      <span className="block text-xs text-muted">
                        {st.room}
                        {st.hint ? ` · ${st.hint}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {st.minutes} min{st.optional ? " · if needed" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </li>
  );
}
