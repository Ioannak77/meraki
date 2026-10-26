"use client";

// Add / edit a task. Slides up from the bottom on phones, centred on iPad.
// Only the title is required, so capturing a task takes one field and one tap.

import { useState } from "react";
import {
  LEAD_CHOICES,
  REPEAT_CHOICES,
  dayKey,
  leadDays,
  monthEndKey,
  useStore,
  type Repeat,
  type Task,
  type TaskStep,
} from "@/lib/store";
import { Icon } from "./icons";
import { NewChip } from "./NewChip";

const MINUTE_CHOICES = [5, 10, 20, 30, 60];

/** "Shows on Today from Fri 6 Nov." */
function showFromText(dueDate: string, lead: number) {
  const [y, m, d] = dueDate.split("-").map(Number);
  const from = new Date(y, m - 1, d - lead);
  if (dayKey(from) <= dayKey()) return "Shows on Today straight away.";
  return `Shows on Today from ${from.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}.`;
}

/** `defaultDate`: the date a new task starts with (the Calendar passes the day you picked). */
export function TaskSheet({ task, onClose, defaultDate }: { task: Task | "new"; onClose: () => void; defaultDate?: string }) {
  const { areas, addTask, updateTask, deleteTask, addArea } = useStore();
  const existing = task === "new" ? null : task;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [areaId, setAreaId] = useState<string | null>(existing?.areaId ?? null);
  const [dueDate, setDueDate] = useState<string | null>(existing ? existing.dueDate : (defaultDate ?? dayKey()));
  const [wholeMonth, setWholeMonth] = useState(existing?.wholeMonth ?? false);
  // null = the default for this kind of task (see leadDays).
  const [showBefore, setShowBefore] = useState<number | null>(existing?.showBefore ?? null);

  // Which picker is open: a specific day, a whole month, or none (no date).
  const [mode, setMode] = useState<"date" | "month" | null>(
    existing ? (existing.dueDate ? (existing.wholeMonth ? "month" : "date") : null) : "date",
  );

  /** A specific day, or (whole month) the month's last day. */
  function setWhen(date: string | null, month = false) {
    setDueDate(date);
    setWholeMonth(month && date !== null);
  }
  const [minutes, setMinutes] = useState<number | null>(existing?.minutes ?? 5);
  const [isEssential, setIsEssential] = useState(existing?.isEssential ?? false);
  const [repeat, setRepeat] = useState<Repeat | null>(existing?.repeat ?? null);
  const [steps, setSteps] = useState<TaskStep[]>(existing?.steps ?? []);
  const [newStep, setNewStep] = useState("");
  const [remindTime, setRemindTime] = useState(existing?.remindAt?.slice(11, 16) ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    const input = {
      title: clean,
      areaId,
      dueDate,
      wholeMonth: wholeMonth || undefined,
      showBefore: dueDate && showBefore !== null ? showBefore : undefined,
      minutes,
      energy: existing?.energy ?? "normal",
      isEssential,
      repeat,
      steps: [...steps, ...(newStep.trim() ? [{ id: Math.random().toString(36).slice(2, 9), title: newStep.trim(), done: false }] : [])],
      // On the due day (or today, for a task without a date).
      remindAt: remindTime ? `${dueDate ?? dayKey()}T${remindTime}` : null,
    };
    if (existing) updateTask(existing.id, input);
    else addTask(input);
    onClose();
  }

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-2 text-sm transition-colors ${active ? "bg-ink text-cream" : "bg-cream text-ink/80"}`;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="pb-safe max-h-[92vh] w-full overflow-y-auto overflow-x-hidden rounded-t-3xl bg-card px-5 pt-5 shadow-xl md:max-w-lg md:rounded-3xl md:pb-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{existing ? "Edit task" : "New task"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-muted">
            <Icon.close className="size-6" />
          </button>
        </div>

        {existing && !existing.completedAt && (
          <div className="mb-3 flex gap-2">
            {[
              ["Tomorrow", 1],
              ["Next week", 7],
            ].map(([label, days]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  const d = new Date();
                  const due = dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + Number(days)));
                  updateTask(existing.id, {
                    dueDate: due,
                    wholeMonth: undefined,
                    remindAt: existing.remindAt ? `${due}T${existing.remindAt.slice(11, 16)}` : existing.remindAt,
                  });
                  onClose();
                }}
                className="flex-1 rounded-2xl bg-sky-soft py-2.5 text-sm font-bold text-sky"
              >
                → {label}
              </button>
            ))}
          </div>
        )}

        <input
          autoFocus={!existing}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="w-full rounded-2xl border border-line bg-cream px-4 py-3.5 text-base outline-none focus:border-sage"
        />

        <p className="mb-2 mt-5 text-sm font-semibold text-muted">When</p>
        <div className="flex gap-1 rounded-full bg-cream p-1">
          <button
            type="button"
            className={`flex-1 rounded-full py-2.5 text-sm ${mode === "date" ? "bg-ink font-bold text-cream" : "text-ink/70"}`}
            onClick={() => {
              setMode("date");
              if (wholeMonth || !dueDate) setWhen(dayKey());
            }}
          >
            On a date
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full py-2.5 text-sm ${mode === "month" ? "bg-ink font-bold text-cream" : "text-ink/70"}`}
            onClick={() => {
              setMode("month");
              if (!wholeMonth || !dueDate) setWhen(monthEndKey(0), true);
            }}
          >
            In a month
          </button>
        </div>

        {mode === "date" && (
          <input
            type="date"
            aria-label="Date"
            value={dueDate ?? ""}
            onChange={(e) => setWhen(e.target.value || null)}
            className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 text-base text-ink"
          />
        )}
        {mode === "month" && (
          <>
            <input
              type="month"
              aria-label="Month"
              value={dueDate ? dueDate.slice(0, 7) : ""}
              onChange={(e) => {
                if (!e.target.value) return setWhen(null);
                const [y, m] = e.target.value.split("-").map(Number);
                setWhen(dayKey(new Date(y, m, 0)), true); // stored as that month's last day
              }}
              className="mt-2 w-full rounded-2xl bg-cream px-4 py-3 text-base text-ink"
            />
            {dueDate && (
              <p className="mt-2 text-xs text-muted">
                Any time in {new Date(dueDate + "T12:00:00").toLocaleDateString(undefined, { month: "long" })}, done by its
                last day.
              </p>
            )}
          </>
        )}
        {mode ? (
          <button
            type="button"
            onClick={() => {
              setMode(null);
              setWhen(null);
            }}
            className="mt-2 text-sm font-semibold text-muted underline"
          >
            No date
          </button>
        ) : (
          <p className="mt-2 text-sm text-muted">No date. Pick one above if it has a deadline.</p>
        )}

        {dueDate && (
          <>
            <p className="mb-2 mt-5 text-sm font-semibold text-muted">Show on Today</p>
            <div className="flex flex-wrap gap-2">
              {LEAD_CHOICES.map((c) => (
                <button
                  key={c.days}
                  type="button"
                  className={chip(leadDays({ showBefore: showBefore ?? undefined, wholeMonth }) === c.days)}
                  onClick={() => setShowBefore(c.days)}
                >
                  {wholeMonth && c.days === 0 ? "On the last day" : c.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{showFromText(dueDate, leadDays({ showBefore: showBefore ?? undefined, wholeMonth }))}</p>
          </>
        )}

        <p className="mb-2 mt-5 text-sm font-semibold text-muted">Repeats</p>
        <div className="flex flex-wrap gap-2">
          {REPEAT_CHOICES.map((c) => (
            <button
              key={c.label}
              type="button"
              className={chip(JSON.stringify(repeat) === JSON.stringify(c.repeat))}
              onClick={() => setRepeat(c.repeat)}
            >
              {c.label}
            </button>
          ))}
        </div>
        {repeat && <p className="mt-2 text-xs text-muted">When you tick it off, the next one appears by itself.</p>}

        <p className="mb-2 mt-5 text-sm font-semibold text-muted">Remind me at</p>
        <div className="flex items-center gap-2">
          <input
            type="time"
            aria-label="Reminder time"
            value={remindTime}
            onChange={(e) => setRemindTime(e.target.value)}
            className="rounded-2xl bg-cream px-4 py-3 text-base text-ink"
          />
          {remindTime ? (
            <button type="button" onClick={() => setRemindTime("")} className="text-sm font-semibold text-muted underline">
              No reminder
            </button>
          ) : (
            <span className="text-sm text-muted">{dueDate ? "on the day" : "today"}, as a phone notification</span>
          )}
        </div>

        <p className="mb-2 mt-5 text-sm font-semibold text-muted">Small steps</p>
        {steps.length > 0 && (
          <ul className="mb-2 divide-y divide-line rounded-2xl bg-cream px-3">
            {steps.map((st) => (
              <li key={st.id} className="flex items-center gap-3 py-2">
                <button
                  type="button"
                  onClick={() => setSteps((all) => all.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)))}
                  aria-label={st.done ? `Mark ${st.title} as not done` : `Mark ${st.title} as done`}
                  className={`grid size-6 shrink-0 place-items-center rounded-md border-2 ${st.done ? "border-sage bg-sage text-white" : "border-line bg-card"}`}
                >
                  {st.done && <Icon.check className="size-3.5" />}
                </button>
                <span className={`flex-1 text-[15px] ${st.done ? "text-muted line-through" : ""}`}>{st.title}</span>
                <button
                  type="button"
                  onClick={() => setSteps((all) => all.filter((x) => x.id !== st.id))}
                  aria-label={`Remove ${st.title}`}
                  className="px-1 text-muted"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !newStep.trim()) return;
              e.preventDefault();
              setSteps((all) => [...all, { id: Math.random().toString(36).slice(2, 9), title: newStep.trim(), done: false }]);
              setNewStep("");
            }}
            placeholder="Break it down, e.g. find a garage"
            className="w-full rounded-2xl border border-line bg-cream px-4 py-3 text-base outline-none focus:border-sage"
          />
          <button
            type="button"
            disabled={!newStep.trim()}
            onClick={() => {
              setSteps((all) => [...all, { id: Math.random().toString(36).slice(2, 9), title: newStep.trim(), done: false }]);
              setNewStep("");
            }}
            className="shrink-0 rounded-2xl bg-sage-soft px-4 font-bold text-sage-dark disabled:opacity-40"
          >
            Add
          </button>
        </div>

        <p className="mb-2 mt-5 text-sm font-semibold text-muted">How long</p>
        <div className="flex flex-wrap gap-2">
          {MINUTE_CHOICES.map((m) => (
            <button key={m} type="button" className={chip(minutes === m)} onClick={() => setMinutes(m)}>
              {m === 60 ? "1 h" : `${m} min`}
            </button>
          ))}
        </div>

        <p className="mb-2 mt-5 text-sm font-semibold text-muted">Area</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(areaId === null)} onClick={() => setAreaId(null)}>
            None
          </button>
          {areas.map((a) => (
            <button key={a.id} type="button" className={chip(areaId === a.id)} onClick={() => setAreaId(a.id)}>
              {a.name}
            </button>
          ))}
          <NewChip placeholder="New area, e.g. Work" onAdd={(name) => setAreaId(addArea(name))} />
        </div>

        <label className="mt-5 flex items-center gap-3 rounded-2xl bg-cream px-4 py-3">
          <input
            type="checkbox"
            checked={isEssential}
            onChange={(e) => setIsEssential(e.target.checked)}
            className="size-5 accent-sage"
          />
          <span className="text-[15px]">Priority for today</span>
        </label>

        <button
          type="submit"
          disabled={!title.trim()}
          className="mt-6 w-full rounded-2xl bg-sage-dark py-4 text-base font-bold text-white disabled:opacity-40"
        >
          {existing ? "Save" : "Add task"}
        </button>

        {existing && (
          <button
            type="button"
            onClick={() => {
              if (confirmDelete) {
                deleteTask(existing.id);
                onClose();
              } else setConfirmDelete(true);
            }}
            className={`mt-3 w-full rounded-2xl py-3 text-sm font-semibold ${
              confirmDelete ? "bg-rose text-white" : "text-muted"
            }`}
          >
            {confirmDelete ? "Tap again to delete" : "Delete task"}
          </button>
        )}
      </form>
    </div>
  );
}
