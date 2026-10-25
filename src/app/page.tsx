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
  monthEndLabel,
  monthEndSaturday,
  occurrenceKey,
  routinesForMonth,
  weekdayIndex,
} from "@/lib/cleaning";
import { TaskRow } from "@/components/TaskRow";
import { SlotCard, dueSteps } from "@/components/skin/SlotCard";
import { careIsDueSoon, currentSlot } from "@/lib/skin";
import { CareDueCard } from "@/components/skin/CareItems";
import { useSkin } from "@/lib/skinStore";
import { TaskSheet } from "@/components/TaskSheet";
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
  const routineSteps = routinesToday.reduce(
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
  const skinSlot = currentSlot(now, skin.settings.pmTime);
  const skinDueNow = dueSteps(skin.steps, skinSlot, now).length;
  // Morning skincare that wasn't done by noon is let go for today.
  const showSkin = skinDueNow > 0 && !(skinSlot === "am" && now.getHours() >= 12);
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

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex items-center justify-between gap-4 md:mt-4">
        <div className="flex items-center gap-3">
          {now.getHours() < 18 ? <Icon.sun className="size-11 shrink-0" /> : <Icon.moon className="size-10 shrink-0" />}
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">
              {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="text-[26px] font-bold leading-tight md:text-4xl">{greeting(now.getHours())}</h1>
            <p className="text-[15px] text-muted md:text-lg">Let&apos;s make today manageable.</p>
          </div>
        </div>
        <Link href="/settings/" aria-label="Settings" className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-muted md:hidden">
          <Icon.settings className="size-5" />
        </Link>
      </header>

      <section className="mt-6 flex justify-center gap-8 sm:gap-12">
        <Ring value={prioritiesDone} max={priorities.length} color="var(--color-sage)" label="Priorities">
          {prioritiesDone}/{priorities.length}
        </Ring>
        <Ring value={todayDone} max={today.length} color="var(--color-peach)" label="Today">
          {todayDone}/{today.length}
        </Ring>
        <Ring value={routineSteps.done} max={routineSteps.total} color="var(--color-sky)" label="Cleaning">
          {routineSteps.done}/{routineSteps.total}
        </Ring>
      </section>

      <div className="mt-6 grid items-start gap-4 lg:grid-flow-dense lg:grid-cols-2">
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

        {show("selfcare") && skin.ready && (showSkin || careDue) && (
          <Fold id="today-selfcare" title="Self care" variant="group">
            <CareDueCard now={now} />
            {showSkin && <SlotCard slot={skinSlot} date={now} badge="Now" />}
          </Fold>
        )}

        {show("comingup") && comingUp.length > 0 && (
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
              <RoutineCard key={r.id} routine={r} date={now} badge={WEEKDAYS[weekdayIndex(now)]} collapsible />
            ))
          )}
          {bigCleanSoon && (
            <Link href="/cleaning/" className="rounded-3xl bg-card/60 p-4 text-[15px] text-muted lg:col-span-2">
              Big clean ({monthLists.map((r) => r.name).join(", ")}) is on the month-end weekend, {monthEndLabel(now)}.
            </Link>
          )}
        </Fold>
        )}

        {show("quickadd") && (
        <Fold id="today-quickadd" title="Quick add">
          <div className="mt-1 grid grid-cols-4 gap-2">
            <QuickAdd label="Task" tone="bg-sky-soft text-sky" onClick={() => setSheet("new")} icon={<Icon.plus className="size-5" />} />
            <Link href="/cleaning/" className="flex flex-col items-center gap-1 rounded-2xl bg-sage-soft py-3 text-sm font-semibold text-sage">
              <Icon.leaf className="size-5" />
              Cleaning
            </Link>
            <Link href="/finances/#new-bill" className="flex flex-col items-center gap-1 rounded-2xl bg-peach-soft py-3 text-sm font-semibold text-peach">
              <Icon.bill className="size-5" />
              Bill
            </Link>
            <Link href="/groceries/" className="flex flex-col items-center gap-1 rounded-2xl bg-rose-soft py-3 text-sm font-semibold text-rose">
              <Icon.basket className="size-5" />
              Receipt
            </Link>
          </div>
        </Fold>
        )}

        {show("week") && <WeekCard now={now} />}
      </div>

      <button
        onClick={() => setSheet("new")}
        aria-label="Add a task"
        className="fixed bottom-24 right-5 z-10 grid size-14 place-items-center rounded-full bg-sage-dark text-white shadow-lg md:hidden"
      >
        <Icon.plus className="size-7" />
      </button>

      {sheet && <TaskSheet task={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

function QuickAdd({
  label,
  icon,
  tone,
  onClick,
  soon,
}: {
  label: string;
  icon: React.ReactNode;
  tone: string;
  onClick?: () => void;
  soon?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={soon}
      className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-sm font-semibold ${tone} disabled:opacity-60`}
    >
      {icon}
      {label}
      {soon && <span className="text-[10px] font-normal opacity-80">soon</span>}
    </button>
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
