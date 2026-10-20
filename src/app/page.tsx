"use client";

import { today as getToday } from "@/lib/clock";
import Link from "next/link";
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
  occurrenceKey,
  routinesForMonth,
  weekdayIndex,
} from "@/lib/cleaning";
import { TaskRow } from "@/components/TaskRow";
import { TaskSheet } from "@/components/TaskSheet";
import { dayKey, isDoneToday, todaysTasks, useStore, type Energy, type Mood, type Task } from "@/lib/store";

const MOODS: { mood: Mood; face: string; label: string }[] = [
  { mood: "great", face: "😊", label: "Feeling good" },
  { mood: "okay", face: "😐", label: "Okay" },
  { mood: "low", face: "😔", label: "Low" },
];

const ENERGY_RANK: Record<Energy, number> = { low: 0, normal: 1, high: 2 };
const TIME_CHOICES = [5, 10, 20, 30];

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function TodayPage() {
  const { tasks, moods, setMood, ready, routineDone, settings } = useStore();
  const [sheet, setSheet] = useState<Task | "new" | null>(null);
  const now = useMemo(() => getToday(settings.testDate), [settings.testDate]);

  const routinesToday = useMemo(() => dueToday(now, settings.officeDays), [now, settings.officeDays]);
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

  const today = useMemo(() => todaysTasks(tasks), [tasks]);
  const priorities = useMemo(
    () => tasks.filter((t) => t.isEssential && (!t.completedAt || isDoneToday(t))),
    [tasks],
  );
  const prioritiesDone = priorities.filter((t) => t.completedAt).length;
  const todayDone = today.filter((t) => t.completedAt).length;
  const mood = moods[dayKey()];
  const moodFace = MOODS.find((m) => m.mood === mood)?.face;

  function cycleMood() {
    const i = MOODS.findIndex((m) => m.mood === mood);
    setMood(MOODS[(i + 1) % MOODS.length].mood);
  }

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

      <section className="mt-6 flex justify-between gap-2 sm:justify-start sm:gap-8">
        <Ring value={prioritiesDone} max={priorities.length} color="var(--color-sage)" label="Priorities">
          {prioritiesDone}/{priorities.length}
        </Ring>
        <Ring value={todayDone} max={today.length} color="var(--color-peach)" label="Today">
          {todayDone}/{today.length}
        </Ring>
        <Ring value={routineSteps.done} max={routineSteps.total} color="var(--color-sky)" label="Routines">
          {routineSteps.done}/{routineSteps.total}
        </Ring>
        <button onClick={cycleMood} className="flex flex-col items-center gap-1.5" aria-label="Set today's mood">
          <span className="grid size-[68px] place-items-center rounded-full bg-peach-soft text-3xl md:size-20">
            {moodFace ?? <span className="text-sm text-peach">How?</span>}
          </span>
          <span className="text-xs text-muted md:text-sm">{MOODS.find((m) => m.mood === mood)?.label ?? "Mood"}</span>
        </button>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-flow-dense lg:grid-cols-2">
        <Card className="lg:row-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Your priorities today</h2>
            {priorities.length > 0 && (
              <span className="rounded-full bg-sage-soft px-3 py-1 text-sm font-semibold text-sage-dark">
                {priorities.length - prioritiesDone === 0 ? "All done" : `${priorities.length - prioritiesDone} left`}
              </span>
            )}
          </div>
          {priorities.length === 0 ? (
            <p className="py-4 text-muted">
              Nothing marked as a priority. Pick up to three small things that would make today feel okay.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {priorities.map((t) => (
                <TaskRow key={t.id} task={t} onEdit={setSheet} />
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-muted">Three essentials. Everything else is optional.</p>
        </Card>

        <div className="flex flex-col gap-4 lg:col-span-2 lg:grid lg:grid-cols-2">
          <div className="flex items-center justify-between lg:col-span-2">
            <h2 className="text-lg font-bold">Cleaning now</h2>
            <Link href="/routines/" className="text-sm font-semibold text-sage-dark">
              All routines →
            </Link>
          </div>
          {dailyNow.map((r) => (
            <RoutineCard key={r.id} routine={r} date={now} badge="Now" />
          ))}
          {monthEndOpen ? (
            <BigCleanCard routines={nonDaily} date={now} />
          ) : (
            nonDaily.map((r) => (
              <RoutineCard key={r.id} routine={r} date={now} badge={WEEKDAYS[weekdayIndex(now)]} />
            ))
          )}
          {!monthEndOpen && (
            <Link href="/routines/" className="rounded-3xl bg-card/60 p-4 text-[15px] text-muted lg:col-span-2">
              Big clean ({monthLists.map((r) => r.name).join(", ")}) is on the month-end weekend, {monthEndLabel(now)}.
            </Link>
          )}
        </div>

        <Card>
          <h2 className="mb-3 text-lg font-bold">Quick add</h2>
          <div className="grid grid-cols-4 gap-2">
            <QuickAdd label="Task" tone="bg-sky-soft text-sky" onClick={() => setSheet("new")} icon={<Icon.plus className="size-5" />} />
            <Link href="/routines/" className="flex flex-col items-center gap-1 rounded-2xl bg-sage-soft py-3 text-sm font-semibold text-sage">
              <Icon.leaf className="size-5" />
              Routines
            </Link>
            <QuickAdd label="Bill" tone="bg-peach-soft text-peach" soon icon={<Icon.bill className="size-5" />} />
            <QuickAdd label="Note" tone="bg-cream text-muted" soon icon={<Icon.note className="size-5" />} />
          </div>
        </Card>

        <ManageNow onEdit={setSheet} />

        <WeekCard />
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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-card p-5 shadow-[0_1px_2px_rgba(60,50,40,0.04)] ${className}`}>{children}</section>;
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

/** "What can you manage right now?": pick time + energy, get one suggestion. */
function ManageNow({ onEdit }: { onEdit: (t: Task) => void }) {
  const { tasks } = useStore();
  const [minutes, setMinutes] = useState(10);
  const [energy, setEnergy] = useState<Energy>("low");
  const [skipped, setSkipped] = useState<string[]>([]);
  const [asked, setAsked] = useState(false);

  const suggestion = useMemo(() => {
    const today = dayKey();
    const fits = tasks.filter(
      (t) =>
        !t.completedAt &&
        !skipped.includes(t.id) &&
        (t.minutes ?? 5) <= (minutes >= 30 ? Infinity : minutes) &&
        ENERGY_RANK[t.energy] <= ENERGY_RANK[energy],
    );
    // Overdue and due-today first, then priorities, then shortest.
    return fits.sort((a, b) => {
      const due = (t: Task) => (t.dueDate !== null && t.dueDate <= today ? 0 : 1);
      return due(a) - due(b) || Number(b.isEssential) - Number(a.isEssential) || (a.minutes ?? 5) - (b.minutes ?? 5);
    })[0];
  }, [tasks, minutes, energy, skipped]);

  const chip = (active: boolean) =>
    `flex-1 rounded-full py-2 text-sm transition-colors ${active ? "bg-ink text-cream font-semibold" : "bg-cream text-ink/70"}`;

  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <Icon.bolt className="size-5 text-sun" /> What can you manage right now?
      </h2>
      <div className="flex gap-1.5">
        {TIME_CHOICES.map((m) => (
          <button key={m} className={chip(minutes === m)} onClick={() => { setMinutes(m); setSkipped([]); }}>
            {m === 30 ? "30+" : `${m} min`}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5">
        {(["low", "normal", "high"] as Energy[]).map((en) => (
          <button key={en} className={chip(energy === en)} onClick={() => { setEnergy(en); setSkipped([]); }}>
            {en[0].toUpperCase() + en.slice(1)} energy
          </button>
        ))}
      </div>

      {!asked ? (
        <button onClick={() => setAsked(true)} className="mt-4 w-full rounded-2xl bg-ink py-3.5 font-bold text-cream">
          Find a suitable task
        </button>
      ) : suggestion ? (
        <div className="mt-3 rounded-2xl bg-cream px-3">
          <ul>
            <TaskRow task={suggestion} onEdit={onEdit} />
          </ul>
          <button
            onClick={() => setSkipped((s) => [...s, suggestion.id])}
            className="w-full pb-3 text-sm font-semibold text-muted"
          >
            Not this one, show another
          </button>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-cream p-4 text-center text-muted">
          Nothing fits right now. Resting counts too.
        </p>
      )}
    </Card>
  );
}

function WeekCard() {
  const { tasks } = useStore();
  const days = useMemo(() => {
    const now = getToday();
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
        isToday: key === dayKey(),
        isFuture: key > dayKey(),
      };
    });
  }, [tasks]);
  const max = Math.max(4, ...days.map((d) => d.count));
  const activeDays = days.filter((d) => d.count > 0).length;

  return (
    <Card>
      <h2 className="text-lg font-bold">This week</h2>
      <div className="mt-4 flex h-28 items-end justify-between gap-2">
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
    </Card>
  );
}
