"use client";

import Link from "next/link";
import { useNow } from "@/lib/useNow";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Ring } from "@/components/Ring";
import { BigCleanCard } from "@/components/BigCleanCard";
import { RoutineCard, routineProgress } from "@/components/RoutineCard";
import {
  WEEKDAYS,
  currentDayPart,
  dueToday,
  inEndOfMonthWindow,
  isSkipped,
  monthEndLabel,
  monthEndSaturday,
  occurrenceKey,
  routinesForMonth,
  weekdayIndex,
  weeklyPlan,
} from "@/lib/cleaning";
import { TaskRow } from "@/components/TaskRow";
import { SlotCard, dueSteps, slotFinished } from "@/components/skin/SlotCard";
import { careIsDueSoon, currentSlot } from "@/lib/skin";
import { CareDueCard } from "@/components/skin/CareItems";
import { useSkin } from "@/lib/skinStore";
import { TaskSheet } from "@/components/TaskSheet";
import { AddMenu } from "@/components/AddMenu";
import { dueDates, money, paidKey } from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { useGroceries } from "@/lib/groceriesStore";
import { kindWordFor } from "@/lib/kindWords";
import { WeatherCard } from "@/components/WeatherCard";
import { Fold } from "@/components/Fold";
import { dayKey, isDoneToday, todaysTasks, useStore, type Task, type TodayCard } from "@/lib/store";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function TodayPage() {
  const { tasks, ready, routineDone, settings } = useStore();
  const [sheet, setSheet] = useState<Task | "new" | null>(null);
  const now = useNow();

  const routinesToday = dueToday(now, settings.officeDays);
  // A list skipped today ("Skip today") doesn't count towards the ring.
  const routineSteps = routinesToday.filter((r) => !isSkipped(routineDone, r, now)).reduce(
    (sum, r) => {
      const p = routineProgress(r, routineDone[occurrenceKey(r, now)] ?? [], now);
      return { done: sum.done + p.done, total: sum.total + p.total };
    },
    { done: 0, total: 0 },
  );
  // On Today, show the daily list for this time of day and today's weekly
  // list. On a month-end weekend the weekly and big lists become one
  // "Big clean" checklist grouped by room.
  const part = currentDayPart(now);
  const monthEndOpen = inEndOfMonthWindow(now);
  const dailyNow = routinesToday.filter((r) => r.when.kind === "daily" && r.when.part === part);
  const nonDaily = routinesToday.filter((r) => r.when.kind !== "daily");
  const monthLists = routinesForMonth(now);
  // A heads-up about the month-end Big clean, in the week before it.
  const daysToBigClean = Math.round(
    (monthEndSaturday(now).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000,
  );
  const bigCleanSoon = !monthEndOpen && daysToBigClean > 0 && daysToBigClean <= 7;

  const today = useMemo(() => todaysTasks(tasks), [tasks]);
  const priorities = useMemo(
    () => tasks.filter((t) => t.isEssential && (!t.completedAt || isDoneToday(t))),
    [tasks],
  );
  const prioritiesDone = priorities.filter((t) => t.completedAt).length;
  const todayDone = today.filter((t) => t.completedAt).length;
  // Self care: skincare for this time of day, while it has steps due today.
  const skin = useSkin();
  const finance = useFinance();
  const groceries = useGroceries();
  const skinSlot = currentSlot(now, skin.settings.pmTime);
  const skinDueNow = dueSteps(skin.steps, skinSlot, now).length;
  // Skincare leaves Today once it's all ticked; morning skincare not done by noon is let go for today.
  const skinFinished = slotFinished(skin.steps, skin.done, skinSlot, now);
  const showSkin = skinDueNow > 0 && !skinFinished && !(skinSlot === "am" && now.getHours() >= 12);
  const dailyDue = dueSteps(skin.steps, "day", now).length > 0;
  const careDue = skin.items.some((i) => careIsDueSoon(i, now));
  // Everything due now that isn't a priority: today's tasks, late ones, and
  // ones showing early (an MOT two weeks before its date). Soonest first.
  const hidden = settings.todayHidden ?? [];
  const show = (card: TodayCard) => !hidden.includes(card);
  const comingUp = today
    .filter((t) => !t.isEssential)
    .sort(
      (a, b) =>
        Number(!!a.completedAt) - Number(!!b.completedAt) || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
    );

  // Bills due today or tomorrow (unpaid), shown in Coming up.
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const billsSoon = (show("bills") ? finance.bills : [])
    .flatMap((b) => dueDates(b, startToday, tomorrow).map((due) => ({ bill: b, due })))
    .filter((x) => !finance.paid[paidKey(x.bill, x.due)]);
  const shoppingLeft = show("shopping") ? groceries.list.filter((i) => !i.done).length : 0;
  // From 8pm: a look at tomorrow, to get ready.
  const evening = show("tomorrow") && now.getHours() >= 20;
  const tomorrowKey = dayKey(tomorrow);
  const tomorrowTasks = tasks.filter((t) => !t.completedAt && t.dueDate === tomorrowKey);
  const tomorrowBills = finance.bills.filter((b) => dueDates(b, tomorrow, tomorrow).some((d) => !finance.paid[paidKey(b, d)]));
  const tomorrowClean = inEndOfMonthWindow(tomorrow) ? "Big clean" : weeklyPlan(settings.officeDays)[weekdayIndex(tomorrow)].routine.name;

  // Only rings with something to count.
  const rings = (small: boolean) => (
    <>
            {priorities.length > 0 && (
              <Ring small={small} value={prioritiesDone} max={priorities.length} color="var(--color-sage)" label="Priorities">
                {prioritiesDone}/{priorities.length}
              </Ring>
            )}
            {today.length > 0 && (
              <Ring small={small} value={todayDone} max={today.length} color="var(--color-peach)" label="Today">
                {todayDone}/{today.length}
              </Ring>
            )}
            {routineSteps.total > 0 && (
              <Ring small={small} value={routineSteps.done} max={routineSteps.total} color="var(--color-sky)" label="Cleaning">
                {routineSteps.done}/{routineSteps.total}
              </Ring>
            )}
    </>
  );

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex items-center justify-between gap-4 md:mt-4">
        <div className="flex items-center gap-3">
          {now.getHours() < 18 ? <Icon.sun className="hidden size-11 shrink-0 md:block" /> : <Icon.moon className="hidden size-10 shrink-0 md:block" />}
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">
              {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="text-[26px] font-bold leading-tight md:text-4xl">{greeting(now.getHours())}</h1>
            {/* Today's kind word: the same one as the afternoon notification. */}
            <p className="text-[15px] text-muted md:text-lg">{kindWordFor(dayKey(now), settings.kindWords).text}</p>
          </div>
        </div>
        {/* Calendar always; Insights and Settings on phones, where they aren't in the tab bar. */}
        <div className="flex shrink-0 gap-1.5">
          <Link href="/calendar/" aria-label="Calendar" className="grid size-9 place-items-center rounded-full bg-card text-muted md:size-11">
            <Icon.calendar className="size-5" />
          </Link>
          <Link href="/insights/" aria-label="Insights" className="grid size-9 place-items-center rounded-full bg-card text-muted md:hidden">
            <Icon.insights className="size-5" />
          </Link>
          <Link href="/settings/" aria-label="Settings" className="grid size-9 place-items-center rounded-full bg-card text-muted md:hidden">
            <Icon.settings className="size-5" />
          </Link>
        </div>
      </header>

      {/* Weather with your progress beside it; just the rings without the weather. */}
      {show("weather") ? (
        <div className="mt-6">
          <WeatherCard evening={now.getHours() >= 18} progress={rings(true)} fallback={<div className="flex justify-center gap-8 sm:gap-12">{rings(false)}</div>} />
        </div>
      ) : (
        <section className="mt-6 flex justify-center gap-8 sm:gap-12">{rings(false)}</section>
      )}

      {shoppingLeft > 0 && (
        <Link href="/groceries/" className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-semibold text-ink/80">
          <Icon.basket className="size-4" /> {shoppingLeft} {shoppingLeft === 1 ? "thing" : "things"} on your shopping list ›
        </Link>
      )}

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-flow-dense lg:grid-cols-2">
        {show("priorities") && priorities.length > 0 && (
          <Fold
            id="today-priorities"
            title="Your priorities today"
            className="lg:row-span-2"
            right={
              <span className="shrink-0 rounded-full bg-sage-soft px-3 py-1 text-sm font-semibold text-sage-dark">
                {priorities.length - prioritiesDone === 0 ? "All done" : `${priorities.length - prioritiesDone} left`}
              </span>
            }
          >
            <ul className="divide-y divide-line">
              {priorities.map((t) => (
                <TaskRow key={t.id} task={t} onEdit={setSheet} />
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted">Three essentials. Everything else is optional.</p>
          </Fold>
        )}

        {show("selfcare") && skin.ready && (showSkin || careDue || dailyDue) && (
          <Fold id="today-selfcare" title="Self care" variant="group">
            <CareDueCard now={now} />
            {showSkin && <SlotCard slot={skinSlot} date={now} badge="Now" />}
            {dailyDue && <SlotCard slot="day" date={now} />}
          </Fold>
        )}

        {show("comingup") && (comingUp.length > 0 || billsSoon.length > 0) && (
          <Fold
            id="today-comingup"
            title="Coming up"
            right={
              <Link href="/tasks/" className="shrink-0 text-sm font-semibold text-sage-dark">
                All tasks →
              </Link>
            }
          >
            <ul className="divide-y divide-line">
              {billsSoon.map(({ bill, due }) => (
                <li key={paidKey(bill, due)} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => finance.togglePaid(paidKey(bill, due))}
                    aria-label={`Mark ${bill.name} as paid`}
                    className="grid size-7 shrink-0 place-items-center rounded-lg border-2 border-line bg-card"
                  />
                  <Link href="/finances/#bills" className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">Pay {bill.name}</span>
                    <span className="block text-[13px] text-muted">{money(bill.amount)}</span>
                  </Link>
                  <span className="shrink-0 text-xs text-peach">{dayKey(due) === dayKey(startToday) ? "Today" : "Tomorrow"}</span>
                </li>
              ))}
              {comingUp.map((t) => (
                <TaskRow key={t.id} task={t} onEdit={setSheet} />
              ))}
            </ul>
          </Fold>
        )}

        {show("cleaning") && (
        <Fold
          id="today-cleaning"
          title="Cleaning now"
          variant="group"
          className="lg:col-span-2 lg:grid lg:grid-cols-2 lg:items-start"
          right={
            <Link href="/cleaning/" className="shrink-0 text-sm font-semibold text-sage-dark">
              Cleaning schedule →
            </Link>
          }
        >
          {dailyNow.map((r) => (
            <RoutineCard key={r.id} routine={r} date={now} badge="Now" collapsible />
          ))}
          {monthEndOpen ? (
            <BigCleanCard routines={nonDaily} date={now} />
          ) : (
            nonDaily.map((r) => (
              <RoutineCard key={r.id} routine={r} date={now} badge={WEEKDAYS[weekdayIndex(now)]} collapsible canSkip />
            ))
          )}
          {bigCleanSoon && (
            <Link href="/cleaning/" className="rounded-3xl bg-card/60 p-4 text-[15px] text-muted lg:col-span-2">
              Big clean ({monthLists.map((r) => r.name).join(", ")}) is on the month-end weekend, {monthEndLabel(now)}.
            </Link>
          )}
        </Fold>
        )}

      </div>

      {evening && (tomorrowTasks.length > 0 || tomorrowBills.length > 0 || tomorrowClean) && (
        <section className="mt-4 rounded-3xl bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Icon.moon className="size-5 text-muted" /> Tomorrow
          </h2>
          <ul className="mt-2 space-y-1.5 text-[15px]">
            {tomorrowTasks.map((t) => (
              <li key={t.id}>• {t.title}</li>
            ))}
            {tomorrowBills.map((b) => (
              <li key={b.id}>
                • Pay {b.name} <span className="text-muted">· {money(b.amount)}</span>
              </li>
            ))}
            <li className="text-muted">• Cleaning: {tomorrowClean}</li>
          </ul>
        </section>
      )}

      {/* Outside the grid so it always comes last, even when the iPad's two columns fill gaps. */}
      {show("week") && (
        <div className="mt-4">
          <WeekCard now={now} />
        </div>
      )}

      <AddMenu onNewTask={() => setSheet("new")} />

      {sheet && <TaskSheet task={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

function WeekCard({ now }: { now: Date }) {
  const { tasks } = useStore();
  const days = useMemo(() => {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const key = dayKey(d);
      return {
        key,
        letter: d.toLocaleDateString(undefined, { weekday: "narrow" }),
        count: tasks.filter((t) => t.completedAt && dayKey(new Date(t.completedAt)) === key).length,
        isToday: key === dayKey(now),
        isFuture: key > dayKey(now),
      };
    });
  }, [tasks, now]);
  const max = Math.max(4, ...days.map((d) => d.count));
  const activeDays = days.filter((d) => d.count > 0).length;

  return (
    <Fold id="today-week" title="This week">
      <div className="mt-2 flex h-28 items-end justify-between gap-2">
        {days.map((d) => (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-20 w-3 items-end overflow-hidden rounded-full bg-line">
              <div
                className={`w-full rounded-full ${d.isToday ? "bg-sage-dark" : "bg-sage"}`}
                style={{ height: `${d.isFuture ? 0 : (d.count / max) * 100}%` }}
              />
            </div>
            <span className={`text-xs ${d.isToday ? "font-bold text-ink" : "text-muted"}`}>{d.letter}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        {activeDays === 0
          ? "A fresh week. One small tick puts a bar here."
          : `You showed up on ${activeDays} ${activeDays === 1 ? "day" : "days"} this week. Missed days don't erase that.`}
      </p>
    </Fold>
  );
}
