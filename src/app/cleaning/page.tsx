"use client";

import { useState } from "react";
import { BigCleanCard } from "@/components/BigCleanCard";
import { BedroomDayCard } from "@/components/BedroomDayCard";
import { CleaningCatchUp } from "@/components/CleaningCatchUp";
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
  monthEndOwner,
  monthEndPlan,
  monthEndSwap,
  monthIndex,
  monthEndLabel,
  monthEndSaturday,
  routinesForMonth,
  bigCleanBudget,
  bedroomDay,
  layerOf,
  plannedMinutes,
  stepsOn,
  weeklyListOn,
  weekdayIndex,
} from "@/lib/cleaning";
import { dayKey, useStore } from "@/lib/store";
import { useNow } from "@/lib/useNow";

// Today is split into the three layers of a clean house (keep up, declutter, clean); Plan shows what's when;
// Edit changes anything; Guide explains how it all works, so nothing needs asking.
const TABS = ["Today", "Plan", "Edit", "Guide"] as const;
type Tab = (typeof TABS)[number];

export default function CleaningSchedulePage() {
  const { ready } = useStore();
  const [tab, setTab] = useState<Tab>("Today");
  const now = useNow();

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">Cleaning schedule</h1>
      <p className="text-[15px] text-muted">Keep up, declutter, then clean: a little at a time.</p>

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
        {tab === "Plan" && <PlanTab now={now} />}
        {tab === "Edit" && <CleaningEditor />}
        {tab === "Guide" && <GuideTab />}
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
  // On the month-end weekend everything but After meals is inside the Big clean; lists with nothing today stay out.
  const shown = due
    .filter((r) => !bigClean || !joinsBigClean(r))
    .filter((r) => r.when.kind !== "daily" || stepsOn(r, now).length > 0)
    .sort((a, b) => rank(a) - rank(b));
  // When decluttering comes up next, for the quiet line under its heading.
  const nextDeclutter = (() => {
    for (let i = 1; i <= 35; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (cleaningLists().some((r) => layerOf(r) === "declutter" && stepsOn(r, d).length > 0))
        return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
    }
    return null;
  })();
  const card = (r: (typeof due)[number]) =>
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
    );
  return (
    <>
      {isOffice && (
        <p className="rounded-3xl bg-sage-soft p-4 text-[15px] text-sage-dark lg:col-span-2">
          Office day: you get the lighter weekly list today.
        </p>
      )}
      <LayerHead
        title="Keep up"
        note="Not cleaning: the daily stuff. Dishes first, a 5-minute pickup, nothing left on the counters. Keeping up is what makes the cleaning quick."
      />
      {shown.filter((r) => layerOf(r) === "keep").map(card)}

      <LayerHead title="Declutter" note="Stuff with no home goes for good, not into another room. Less stuff, less to tidy and clean around." />
      {shown.some((r) => layerOf(r) === "declutter") ? (
        shown.filter((r) => layerOf(r) === "declutter").map(card)
      ) : (
        <p className="rounded-3xl bg-card/60 px-5 py-4 text-[15px] text-muted lg:col-span-2">
          {bigClean ? "Inside the Big clean this weekend." : `Nothing today.${nextDeclutter ? ` Next: ${nextDeclutter}.` : ""}`}
        </p>
      )}

      <LayerHead title="Clean" note="The actual cleaning. With the first two done, it's quick." />
      {shown.filter((r) => layerOf(r) === "clean").map(card)}
      <CleaningCatchUp date={now} />
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
          ? "It's the month-end weekend: the Today tab has everything as one Big clean, in cleaning order."
          : `These are for the month-end weekend, ${monthEndLabel(now)}. You can tick things off early if you get to them.`}
      </p>
      {thisMonth.map((r) => (
        <RoutineCard key={r.id} routine={r} date={now} collapsible startOpen={open} />
      ))}

      <section className="rounded-3xl bg-card p-5 lg:col-span-2">
        <h2 className="text-lg font-bold">The year ahead</h2>
        <p className="text-sm text-muted">
          Each month-end gets the floors, the machine and the loads, then the jobs most overdue, up to about{" "}
          {formatMinutes(bigCleanBudget())}. Anything not done stays first in line. Later months are an estimate; tap one to see it.
        </p>
        <ul className="mt-3 divide-y divide-line">
          {Array.from({ length: 12 }, (_, i) => monthIndex(monthEndOwner(now) ?? now) + i).map((mi, i) => (
            <YearMonth key={mi} mi={mi} isCurrent={i === 0} />
          ))}
        </ul>
      </section>
    </>
  );
}

/** One month-end in the year ahead: what the queue expects to pick, and every step when you tap it. */
function YearMonth({ mi, isCurrent }: { mi: number; isCurrent: boolean }) {
  const [open, setOpen] = useState(false);
  const plan = monthEndPlan(mi);
  const year = Math.floor(mi / 12);
  const name = `${MONTHS[mi % 12]}${year !== new Date().getFullYear() ? ` ${year}` : ""}`;
  // Grouped by list, in the lists' own order.
  const lists = cleaningLists()
    .filter((r) => plan.picked.some((j) => j.list.id === r.id))
    .map((r) => ({ r, jobs: plan.picked.filter((j) => j.list.id === r.id) }));
  const extra = lists.filter(({ r }) => r.group !== "monthly");
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 py-2.5 text-left text-[15px]">
        <span className={`w-28 shrink-0 ${isCurrent ? "font-bold" : "text-muted"}`}>{name}</span>
        <span className={`min-w-0 flex-1 ${isCurrent ? "font-semibold" : ""}`}>
          {extra.map(({ r }) => r.name).join(" + ") || "Monthly basics"}
        </span>
        <span className="shrink-0 text-xs text-muted">{formatMinutes(plan.minutes)}</span>
        <span className={`shrink-0 text-muted transition-transform duration-200 ease-out ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open && (
        <div className="animate-reveal mb-3 space-y-3 rounded-2xl bg-cream p-3.5">
          <p className="text-[13px] text-muted">
            About {formatMinutes(plan.minutes)} on the month-end weekend{isCurrent ? "" : " (an estimate)"}. The bedroom jobs are on the bedroom day.
          </p>
          {lists.map(({ r, jobs }) => (
            <section key={r.id}>
              <h3 className="flex justify-between gap-3 text-xs font-bold uppercase tracking-wide text-muted">
                <span>{r.name}</span>
                <span className="shrink-0 font-semibold normal-case tracking-normal">~{formatMinutes(jobs.reduce((t, j) => t + j.minutes, 0))}</span>
              </h3>
              <ul className="mt-1 divide-y divide-line">
                {jobs.flatMap((j) => j.steps).map((st) => (
                  <li key={st.id} className="flex items-baseline gap-3 py-1.5 text-[14px]">
                    <span className="min-w-0 flex-1">{st.title}</span>
                    <span className="shrink-0 text-xs text-muted">{st.minutes} min</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {plan.waiting.length > 0 && (
            <p className="text-[13px] text-muted">Waiting for a later month: {plan.waiting.map((j) => j.steps[0].title).join(", ")}.</p>
          )}
        </div>
      )}
    </li>
  );
}

/** A heading for one layer of the clean house on the Today tab. */
function LayerHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="mt-2 lg:col-span-2">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-[14px] text-muted">{note}</p>
    </div>
  );
}

const longDate = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/** What's when: this week, the next month-end weekend and its bedroom day, and the year ahead. */
function PlanTab({ now }: { now: Date }) {
  const { settings } = useStore();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekdayIndex(now));
  const weekMinutes = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)).reduce(
    (t, d) => {
      const bd = bedroomDay(d, settings.officeDays);
      if (bd) return t + bd.items.filter((it) => !it.step.optional).reduce((m, it) => m + it.step.minutes, 0);
      if (monthEndOwner(d)) return t;
      return t + plannedMinutes(weeklyListOn(d, settings.officeDays), d);
    },
    0,
  );
  // The month-end weekend we're on, or the next one.
  const thisSat = monthEndSaturday(now);
  const sat =
    monthEndOwner(now) ??
    (now.getTime() > thisSat.getTime() + 2 * 86_400_000 ? monthEndSaturday(new Date(now.getFullYear(), now.getMonth() + 1, 1)) : thisSat);
  const plan = monthEndPlan(monthIndex(sat));
  const swap = monthEndSwap(sat, settings.officeDays);
  const lists = cleaningLists().filter((r) => plan.picked.some((j) => j.list.id === r.id));
  return (
    <>
      <section className="rounded-3xl bg-card p-5 lg:col-span-2">
        <h2 className="text-lg font-bold">At a glance</h2>
        <ul className="mt-2 divide-y divide-line text-[15px]">
          <li className="py-2">
            <span className="block text-sm text-muted">This week&apos;s cleaning (keeping up not counted)</span>
            about <strong>{formatMinutes(weekMinutes)}</strong>, one room a day
          </li>
          <li className="py-2">
            <span className="block text-sm text-muted">Next Big clean</span>
            <strong>
              {longDate(sat)} and {longDate(new Date(sat.getFullYear(), sat.getMonth(), sat.getDate() + 1))}
            </strong>
            , about {formatMinutes(plan.minutes)} (at most {formatMinutes(bigCleanBudget())}): {lists.map((r) => r.name).join(", ")}
          </li>
          {swap && (
            <li className="py-2">
              <span className="block text-sm text-muted">Bedroom day (sheets and the month&apos;s bedroom jobs)</span>
              <strong>{longDate(swap.day)}</strong>, instead of {swap.weekly.name}, which is done in the Big clean
            </li>
          )}
          {plan.waiting.length > 0 && (
            <li className="py-2">
              <span className="block text-sm text-muted">Waiting for a later month (over the time limit)</span>
              {plan.waiting.map((j) => j.steps[0].title).join(", ")}
            </li>
          )}
        </ul>
      </section>
      <div className="lg:col-span-2">
        <h2 className="text-lg font-bold">This week</h2>
      </div>
      <WeekTab now={now} />
      <MonthTab now={now} />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-card p-5 text-[15px] leading-relaxed lg:col-span-2">
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** How the cleaning schedule works, in plain words, with your own numbers. */
function GuideTab() {
  const { settings } = useStore();
  const office = settings.officeDays.map((d) => WEEKDAYS[d]).join(" and ") || "none";
  return (
    <>
      <Section title="Three layers of a clean house">
        <p className="text-muted">From Dana K White (Decluttering at the Speed of Life). Cleaning feels endless when these are mixed up.</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            <strong>Keep up</strong>, every day: dishes first, a 5-minute pickup (trash out, things back where they live), nothing left on
            the counters. It isn&apos;t cleaning, but if it&apos;s skipped it turns into cleaning. These are your Morning, After meals and
            Evening lists.
          </li>
          <li>
            <strong>Declutter</strong>, a little and often: anything without a home leaves the house. Moving it to another room
            doesn&apos;t count; it drifts back. This is the Declutter list (one small spot a week, the give-away bag out every 4 weeks).
          </li>
          <li>
            <strong>Clean</strong>: vacuuming, mopping, scrubbing, dusting. Quick once the first two are done. These are the weekly room
            lists and the month-end Big clean.
          </li>
        </ol>
      </Section>

      <Section title="What's when">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Every day</strong>: Morning (until noon), After meals (after each meal) and Evening (from 6pm) show on Today at their
            time. Some steps are only every few days, like the rubbish (every 3 days) or the plants.
          </li>
          <li>
            <strong>Every week</strong>: one room a day (Bathroom, Floors, Kitchen, Pari, Living room, Bedroom, Reset). Some steps take
            turns every other week, so each week only has half of them. On office days ({office}) you get the shortest list; the longer one
            moves to a lighter weekday.
          </li>
          <li>
            <strong>Month-end weekend</strong> (the last Saturday of the month and the Sunday after): the Big clean. It has the floors, the
            washing machine and the loads every month, then the jobs most overdue, up to {formatMinutes(bigCleanBudget())}. It goes in
            order: get things going (machines and soaks), clear out, high up, bed and appliances, low and floors, then close down on Sunday.
          </li>
          <li>
            <strong>Bedroom day</strong>: near each month-end, one weekday is the bedroom day: sheets, protectors, the mattress and under
            the bed, all while the bed is stripped. That day&apos;s usual list is done in the Big clean instead.
          </li>
        </ul>
      </Section>

      <Section title="If something isn't done">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Daily lists</strong>: let go. Tomorrow starts fresh.
          </li>
          <li>
            <strong>Things with a cost</strong> (the rubbish, the plants, hanging the washing): they stay, saying &ldquo;still to do, since
            Thursday&rdquo;, until done. The next one counts from the day you did it.
          </li>
          <li>
            <strong>A weekly list</strong>: it waits in Catch up until Sunday, then goes. A missed machine load stays until it&apos;s done.
            Busy or unwell? &ldquo;Skip today&rdquo; on the list.
          </li>
          <li>
            <strong>The bedroom day</strong>: stays until it&apos;s done.
          </li>
          <li>
            <strong>The Big clean</strong>: what&apos;s left shows for the next two weekends, then waits. Anything still not done is first
            in line at the next month-end, never 3 or 6 months later.
          </li>
        </ul>
      </Section>

      <Section title="Changing things yourself">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Edit › Settings</strong>: how long the Big clean can be, and your office days.
          </li>
          <li>
            <strong>Edit › a list</strong>: its name and day (weekly) or usual months (month-end). Drag ⋮⋮ to reorder steps; Add a step at the
            bottom.
          </li>
          <li>
            <strong>Edit › a list › a step</strong>: minutes and room; <em>How often</em>; <em>If it isn&apos;t done</em> (let go, or keep
            until done); for month-end jobs, whether it&apos;s on the bedroom day, always in the Big clean, and which part of it; and{" "}
            <em>How to do it</em>, which shows behind the ? next to the step.
          </li>
          <li>
            <strong>Plan</strong> shows this week, the next Big clean, the bedroom day and the year ahead, so you can check a change.
          </li>
          <li>Changed too much? Edit › Reset to the original schedule.</li>
        </ul>
      </Section>

      <Section title="Decluttering, quickly">
        <ul className="list-disc space-y-2 pl-5">
          <li>One small spot at a time: a shelf, a counter, a drawer. Ten minutes, then stop.</li>
          <li>
            For each thing: <em>where would I look for it first?</em> Put it there, now. If it has no home and isn&apos;t needed, it goes in
            the give-away bag or the bin.
          </li>
          <li>Don&apos;t move things into another room to deal with later: that&apos;s shifting stuff, not decluttering.</li>
          <li>Throw trash away in the moment, and take the give-away bag out of the house so it doesn&apos;t drift back.</li>
        </ul>
      </Section>
    </>
  );
}
