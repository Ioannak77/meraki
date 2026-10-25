"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { TaskRow } from "@/components/TaskRow";
import { TaskSheet } from "@/components/TaskSheet";
import { today } from "@/lib/clock";
import { dayKey, isDueNow, useStore, type Task } from "@/lib/store";

// "All" is already grouped into Overdue, Today, This week, Later and No date.
const FILTERS = ["All", "Done"] as const;
type Filter = (typeof FILTERS)[number];

function addDaysKey(n: number) {
  const d = today();
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** "All" is split into time groups so it reads as a plan, not one long list. */
function groupAll(open: Task[]) {
  const today = dayKey();
  const weekEnd = addDaysKey(6);
  const groups: { title: string; tasks: Task[] }[] = [
    { title: "Overdue", tasks: [] },
    { title: "Today", tasks: [] },
    { title: "This week", tasks: [] },
    { title: "Later", tasks: [] },
    { title: "No date", tasks: [] },
  ];
  for (const t of open) {
    if (t.dueDate === null) groups[4].tasks.push(t);
    else if (t.dueDate < today) groups[0].tasks.push(t);
    else if (t.dueDate === today || isDueNow(t)) groups[1].tasks.push(t);
    else if (t.dueDate <= weekEnd) groups[2].tasks.push(t);
    else groups[3].tasks.push(t);
  }
  return groups.filter((g) => g.tasks.length > 0);
}

export default function TasksPage() {
  const { tasks, areas, ready, addTask } = useStore();
  const [filter, setFilter] = useState<Filter>("All");
  const [area, setArea] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Task | "new" | null>(null);
  const [quick, setQuick] = useState("");

  const inArea = useMemo(() => (area ? tasks.filter((t) => t.areaId === area) : tasks), [tasks, area]);

  const shown = useMemo(() => {
    if (filter === "Done") {
      return inArea.filter((t) => t.completedAt).sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    }
    return inArea
      .filter((t) => !t.completedAt)
      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  }, [inArea, filter]);

  // Areas that have tasks, so the row stays short.
  const usedAreas = areas.filter((a) => tasks.some((t) => t.areaId === a.id));

  // One-line capture: type and press enter. No date, so it waits here until you plan it.
  function capture(e: React.FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    addTask({ title, areaId: area, dueDate: null, minutes: 5, energy: "normal", isEssential: false });
    setQuick("");
  }

  if (!ready) return null;

  const chip = (on: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-sm ${on ? "bg-sage-soft font-semibold text-sage-dark" : "bg-card text-ink/70"}`;

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
          <button key={f} onClick={() => setFilter(f)} className={chip(filter === f)}>
            {f}
          </button>
        ))}
      </div>

      {usedAreas.length > 0 && (
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          <button onClick={() => setArea(null)} className={chip(area === null)}>
            All areas
          </button>
          {usedAreas.map((a) => (
            <button key={a.id} onClick={() => setArea(area === a.id ? null : a.id)} className={chip(area === a.id)}>
              {a.name}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <section className="mt-4 rounded-3xl bg-card px-5 py-8 text-center">
          {tasks.length === 0 ? (
            <>
              <p className="text-[17px] font-bold">Nothing on your list</p>
              <p className="mt-1 text-[15px] text-muted">
                Type anything in quick capture above to get it out of your head, or tap <strong>+</strong> to add a task with a
                date, an area, or a reminder ahead of time.
              </p>
            </>
          ) : (
            <p className="text-muted">{filter === "Done" ? "Nothing finished yet." : "All done. Nice."}</p>
          )}
        </section>
      ) : filter === "All" ? (
        groupAll(shown).map((g) => (
          <section key={g.title} className="mt-4 rounded-3xl bg-card px-5 py-3">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${g.title === "Overdue" ? "text-peach" : "text-muted"}`}>
              {g.title} · {g.tasks.length}
            </h2>
            <ul className="divide-y divide-line">
              {g.tasks.map((t) => (
                <TaskRow key={t.id} task={t} onEdit={setSheet} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <section className="mt-4 rounded-3xl bg-card px-5 py-2">
          <ul className="divide-y divide-line">
            {shown.map((t) => (
              <TaskRow key={t.id} task={t} onEdit={setSheet} />
            ))}
          </ul>
        </section>
      )}

      {sheet && <TaskSheet task={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}
