"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { TaskRow } from "@/components/TaskRow";
import { TaskSheet } from "@/components/TaskSheet";
import { dayKey, isDoneToday, isDueNow, useStore, type Task } from "@/lib/store";

const FILTERS = ["All", "Today", "This month", "Upcoming", "Overdue", "Done"] as const;
type Filter = (typeof FILTERS)[number];

export default function TasksPage() {
  const { tasks, ready, addTask } = useStore();
  const [filter, setFilter] = useState<Filter>("All");
  const [sheet, setSheet] = useState<Task | "new" | null>(null);
  const [quick, setQuick] = useState("");

  const shown = useMemo(() => {
    const today = dayKey();
    const open = tasks.filter((t) => !t.completedAt);
    const byDate = (a: Task, b: Task) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
    switch (filter) {
      case "Today":
        // Due today, plus whole-month tasks in their last week (late ones are under Overdue).
        return [...open.filter((t) => isDueNow(t) && t.dueDate! >= today), ...tasks.filter(isDoneToday)];
      case "This month":
        return open.filter((t) => t.dueDate !== null && t.dueDate.slice(0, 7) === today.slice(0, 7) && t.dueDate >= today).sort(byDate);
      case "Upcoming":
        return open.filter((t) => t.dueDate !== null && t.dueDate > today).sort(byDate);
      case "Overdue":
        return open.filter((t) => t.dueDate !== null && t.dueDate < today).sort(byDate);
      case "Done":
        return tasks
          .filter((t) => t.completedAt)
          .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
      default:
        return open.sort(byDate);
    }
  }, [tasks, filter]);

  // One-line capture: type and press enter. Lands in Today with defaults.
  function capture(e: React.FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    addTask({ title, areaId: null, dueDate: dayKey(), minutes: 5, energy: "normal", isEssential: false });
    setQuick("");
  }

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between md:mt-4">
        <h1 className="text-[26px] font-bold md:text-3xl">Tasks</h1>
        <button
          onClick={() => setSheet("new")}
          aria-label="Add a task"
          className="grid size-10 place-items-center rounded-full bg-sage-dark text-white"
        >
          <Icon.plus className="size-5" />
        </button>
      </div>

      <form onSubmit={capture} className="mt-4">
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Quick capture: type a task and press enter"
          enterKeyHint="done"
          className="w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-base outline-none focus:border-sage"
        />
      </form>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm ${
              filter === f ? "bg-sage-soft font-semibold text-sage-dark" : "bg-card text-ink/70"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <section className="mt-4 rounded-3xl bg-card px-5 py-2">
        {shown.length === 0 ? (
          <p className="py-8 text-center text-muted">
            {filter === "Overdue" ? "Nothing overdue. Nice." : "Nothing here yet."}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((t) => (
              <TaskRow key={t.id} task={t} onEdit={setSheet} />
            ))}
          </ul>
        )}
      </section>

      {sheet && <TaskSheet task={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}
