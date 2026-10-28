"use client";

// Calendar: one month at a glance. Each day shows what's planned (tasks, bills, the Big clean,
// self care); tap a day to see it in full. Weekly cleaning is shown in the day's list, not as a dot,
// since every day has one.

import Link from "next/link";
import { useState } from "react";
import { MONTHS, WEEKDAYS, cleaningLists, isDueOn, monthEndOwner, weeklyPlan, weekdayIndex } from "@/lib/cleaning";
import { dueDates, isBillPaid, money } from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { careNextDue } from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { TaskSheet } from "@/components/TaskSheet";
import { advanceDate, dayKey, useStore, type Task } from "@/lib/store";
import { useNow } from "@/lib/useNow";

type Entry = {
  kind: "task" | "bill" | "clean" | "care" | "big";
  label: string;
  detail?: string;
  done?: boolean;
  href: string;
  task?: Task; // tasks open in place
  ahead?: boolean; // a future repeat of a repeating task (not made yet)
};

const DOT: Record<Entry["kind"], string> = {
  task: "bg-peach",
  bill: "bg-rose",
  big: "bg-sky",
  care: "bg-sage",
  clean: "bg-line",
};

export default function CalendarPage() {
  const { ready, tasks, settings } = useStore();
  const finance = useFinance();
  const skin = useSkin();
  const now = useNow();
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [picked, setPicked] = useState(() => dayKey(now));
  const [sheet, setSheet] = useState<Task | "new" | null>(null);

  if (!ready) return null;

  const first = month;
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const lead = weekdayIndex(first);
  const days = Array.from({ length: last.getDate() }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1));
  const plan = weeklyPlan(settings.officeDays);

  // Everything planned per day of the shown month.
  const byDay = new Map<string, Entry[]>();
  const add = (key: string, e: Entry) => byDay.set(key, [...(byDay.get(key) ?? []), e]);
  const monthKey = dayKey(first).slice(0, 7);
  for (const t of tasks) {
    if (!t.dueDate) continue;
    if (t.dueDate.startsWith(monthKey)) {
      add(t.dueDate, { kind: "task", label: t.title, done: !!t.completedAt, detail: t.wholeMonth ? "by the end of the month" : undefined, href: "/tasks/", task: t });
    }
    // Repeating tasks: their next turns, shown faintly so the months ahead aren't empty.
    if (t.repeat && !t.completedAt) {
      for (let due = advanceDate(t.dueDate, t.repeat, t.wholeMonth), n = 0; due.slice(0, 7) <= monthKey && n < 400; due = advanceDate(due, t.repeat, t.wholeMonth), n++) {
        if (due.startsWith(monthKey)) add(due, { kind: "task", label: t.title, detail: "repeats", href: "/tasks/", ahead: true });
      }
    }
  }
  for (const b of finance.bills) {
    for (const d of dueDates(b, first, last)) {
      add(dayKey(d), { kind: "bill", label: b.name, detail: money(b.amount), done: isBillPaid(b, d, finance.paid), href: "/finances/" });
    }
  }
  for (const it of skin.items) {
    const due = careNextDue(it);
    if (due?.startsWith(dayKey(first).slice(0, 7))) add(due, { kind: "care", label: it.name, href: "/self-care/" });
  }
  for (const d of days) {
    const key = dayKey(d);
    if (monthEndOwner(d)) {
      const big = cleaningLists().filter((r) => r.when.kind === "monthly" && isDueOn(r, d, settings.officeDays));
      add(key, { kind: "big", label: "Big clean", detail: big.map((r) => r.name).join(", "), href: "/cleaning/" });
    } else {
      const r = plan[weekdayIndex(d)].routine;
      add(key, { kind: "clean", label: `Cleaning: ${r.name}`, detail: settings.officeDays.includes(weekdayIndex(d)) ? "office day" : undefined, href: "/cleaning/" });
    }
  }

  const todayKey = dayKey(now);
  const pickedEntries = (byDay.get(picked) ?? []).sort((a, b) => order(a) - order(b));
  const pickedDate = new Date(picked + "T12:00:00");
  const shift = (by: number) => {
    const next = new Date(first.getFullYear(), first.getMonth() + by, 1);
    setMonth(next);
    setPicked(dayKey(next.getMonth() === now.getMonth() && next.getFullYear() === now.getFullYear() ? now : next));
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between md:mt-4">
        <h1 className="text-[26px] font-bold md:text-3xl">Calendar</h1>
        <div className="flex items-center gap-1">
          {(first.getMonth() !== now.getMonth() || first.getFullYear() !== now.getFullYear()) && (
            <button
              onClick={() => {
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setPicked(dayKey(now));
              }}
              className="mr-1 rounded-full bg-sage-soft px-3 py-2 text-sm font-semibold text-sage-dark"
            >
              Today
            </button>
          )}
          <button onClick={() => shift(-1)} aria-label="Previous month" className="grid size-10 place-items-center rounded-full bg-card text-lg">
            ‹
          </button>
          <span className="w-32 text-center font-semibold md:w-36">
            {MONTHS[first.getMonth()]} {first.getFullYear()}
          </span>
          <button onClick={() => shift(1)} aria-label="Next month" className="grid size-10 place-items-center rounded-full bg-card text-lg">
            ›
          </button>
        </div>
      </div>

      <section className="mt-4 rounded-3xl bg-card p-2 md:p-5">
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-1">
              {d.slice(0, 1)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5 md:gap-1">
          {Array.from({ length: lead }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {days.map((d) => {
            const key = dayKey(d);
            // The day's tasks, bills, Big clean and self care, by name (cleaning lists only in the day's list below).
            const named = (byDay.get(key) ?? []).filter((e) => e.kind !== "clean").sort((a, b) => order(a) - order(b));
            const shown = named.slice(0, 3);
            const isPicked = key === picked;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPicked(key)}
                className={`flex min-h-[76px] min-w-0 flex-col items-stretch gap-0.5 rounded-xl p-0.5 text-left md:min-h-[104px] md:p-1 ${
                  isPicked ? "ring-2 ring-ink" : ""
                } ${key < todayKey ? "opacity-60" : ""}`}
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center self-center rounded-full text-[13px] md:self-start ${
                    key === todayKey ? "bg-sage-dark font-bold text-white" : ""
                  }`}
                >
                  {d.getDate()}
                </span>
                {shown.map((e, i) => (
                  <span
                    key={i}
                    className={`line-clamp-2 break-words rounded-md px-1 py-0.5 text-[9px] font-semibold leading-tight md:text-[11px] ${CHIP[e.kind]} ${
                      e.done ? "line-through opacity-60" : ""
                    } ${e.ahead ? "opacity-50" : ""}`}
                  >
                    {e.kind === "big" ? "Big clean" : e.label}
                  </span>
                ))}
                {named.length > shown.length && <span className="text-center text-[9px] text-muted md:text-[11px]">+{named.length - shown.length}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
          <Legend tone={DOT.task} label="Task" />
          <Legend tone={DOT.bill} label="Bill" />
          <Legend tone={DOT.big} label="Big clean" />
          <Legend tone={DOT.care} label="Self care" />
        </div>
      </section>

      <section className="mt-4 rounded-3xl bg-card p-5">
        <h2 className="text-lg font-bold">
          {picked === todayKey ? "Today" : pickedDate.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        {DAY_GROUPS.map((g) => {
          const items = pickedEntries.filter((e) => g.kinds.includes(e.kind));
          if (items.length === 0) return null;
          return (
            <div key={g.title} className="mt-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{g.title}</h3>
              <ul className="divide-y divide-line">
                {items.map((e, i) => {
                  const body = (
                    <>
                      <span className={`size-2.5 shrink-0 rounded-full ${DOT[e.kind]}`} />
                      <span className={`flex-1 text-[15px] ${e.done ? "text-muted line-through" : ""}`}>
                        {e.kind === "bill" ? `Pay ${e.label}` : e.label}
                        {e.kind === "big" && e.detail && <span className="block text-[13px] text-muted">{e.detail}</span>}
                      </span>
                      {e.kind === "bill" && (
                        <span className={`shrink-0 text-right text-[15px] font-semibold ${e.done ? "text-sage-dark" : ""}`}>
                          {e.done ? "Paid ✓" : e.detail}
                        </span>
                      )}
                      {e.kind === "task" && e.done && <span className="shrink-0 text-[13px] font-semibold text-sage-dark">Done ✓</span>}
                      {e.kind !== "bill" && e.kind !== "big" && !e.done && e.detail && (
                        <span className="shrink-0 text-right text-[13px] text-muted">{e.detail}</span>
                      )}
                    </>
                  );
                  return (
                    <li key={i} className={e.ahead ? "opacity-60" : ""}>
                      {/* Tasks open right here; a future repeat isn't a task yet. */}
                      {e.task ? (
                        <button type="button" onClick={() => setSheet(e.task!)} className="flex w-full items-center gap-3 py-3 text-left">
                          {body}
                        </button>
                      ) : e.ahead ? (
                        <div className="flex items-center gap-3 py-3">{body}</div>
                      ) : (
                        <Link href={e.href} className="flex items-center gap-3 py-3">
                          {body}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {pickedEntries.length === 0 && <p className="mt-2 text-muted">Nothing planned.</p>}
        <button
          type="button"
          onClick={() => setSheet("new")}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-sage-soft py-3 font-bold text-sage-dark"
        >
          + Add a task on this day
        </button>
      </section>

      {sheet && <TaskSheet task={sheet} defaultDate={picked} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** How a picked day's list is split up. */
const DAY_GROUPS: { title: string; kinds: Entry["kind"][] }[] = [
  { title: "To pay", kinds: ["bill"] },
  { title: "To do", kinds: ["task"] },
  { title: "Self care", kinds: ["care"] },
  { title: "Cleaning", kinds: ["big", "clean"] },
];

const CHIP: Record<Entry["kind"], string> = {
  task: "bg-peach-soft text-peach",
  bill: "bg-rose-soft text-rose",
  big: "bg-sky-soft text-sky",
  care: "bg-sage-soft text-sage-dark",
  clean: "bg-cream text-muted",
};

function order(e: Entry) {
  return { big: 0, bill: 1, task: 2, care: 3, clean: 4 }[e.kind] + (e.done ? 10 : 0);
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${tone}`} />
      {label}
    </span>
  );
}
