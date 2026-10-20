"use client";

import { useState } from "react";
import { dueLabel, useStore, type Task, type Tone } from "@/lib/store";
import { Icon } from "./icons";

export const TONE_CLASSES: Record<Tone, string> = {
  rose: "bg-rose-soft text-rose",
  peach: "bg-peach-soft text-peach",
  sage: "bg-sage-soft text-sage",
  sky: "bg-sky-soft text-sky",
  sun: "bg-sun/25 text-[#b7791f]",
  lilac: "bg-[#ebe7f5] text-[#7a6db0]",
};

export function TaskRow({ task, onEdit, showArea = true }: { task: Task; onEdit: (t: Task) => void; showArea?: boolean }) {
  const { toggleTask, areaById } = useStore();
  const [popped, setPopped] = useState(false);
  const area = areaById(task.areaId);
  const done = !!task.completedAt;
  const AreaGlyph = area ? Icon[area.icon] : null;
  const label = dueLabel(task);

  function toggle() {
    if (!done) {
      setPopped(true);
      navigator.vibrate?.(20);
    }
    toggleTask(task.id);
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <button
        onClick={toggle}
        aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
        onAnimationEnd={() => setPopped(false)}
        className={`grid size-7 shrink-0 place-items-center rounded-lg border-2 transition-colors ${
          done ? "border-sage bg-sage text-white" : "border-line bg-card"
        } ${popped ? "animate-pop" : ""}`}
      >
        {done && <Icon.check className="size-4" />}
      </button>

      {showArea && AreaGlyph && area && (
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONE_CLASSES[area.tone]}`}>
          <AreaGlyph className="size-5" />
        </span>
      )}

      <button onClick={() => onEdit(task)} className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-[15px] font-semibold ${done ? "text-muted line-through" : ""}`}>
          {task.title}
        </span>
        <span className="block truncate text-[13px] text-muted">
          {[task.minutes ? `${task.minutes} min` : null, area?.name].filter(Boolean).join(" · ")}
        </span>
      </button>

      <span className={`shrink-0 text-xs ${label === "Overdue" || label === "Today" || label.startsWith("by ") ? "text-peach" : "text-muted"}`}>
        {done ? "Done" : label}
      </span>
      <button onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`} className="shrink-0 p-1 text-muted">
        <Icon.more className="size-5" />
      </button>
    </li>
  );
}
