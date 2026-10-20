"use client";

// Add / edit a task. Slides up from the bottom on phones, centred on iPad.
// Only the title is required, so capturing a task takes one field and one tap.

import { today } from "@/lib/clock";
import { useState } from "react";
import { LEAD_CHOICES, dayKey, leadDays, monthEndKey, useStore, type Energy, type Task } from "@/lib/store";
import { Icon } from "./icons";

const MINUTE_CHOICES = [5, 10, 20, 30, 60];

/** "Shows on Today from Fri 6 Nov." */
function showFromText(dueDate: string, lead: number) {
  const [y, m, d] = dueDate.split("-").map(Number);
  const from = new Date(y, m - 1, d - lead);
  if (dayKey(from) <= dayKey()) return "Shows on Today straight away.";
  return `Shows on Today from ${from.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}.`;
}

function inDays(n: number) {
  const d = today();
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function TaskSheet({ task, onClose }: { task: Task | "new"; onClose: () => void }) {
  const { areas, addTask, updateTask, deleteTask } = useStore();
  const existing = task === "new" ? null : task;

  const [title, setTitle] = useState(existing?.title ?? "");
  const [areaId, setAreaId] = useState<string | null>(existing?.areaId ?? null);
  const [dueDate, setDueDate] = useState<string | null>(existing ? existing.dueDate : dayKey());
  const [wholeMonth, setWholeMonth] = useState(existing?.wholeMonth ?? false);
  // null = the default for this kind of task (see leadDays).
  const [showBefore, setShowBefore] = useState<number | null>(existing?.showBefore ?? null);

  /** A specific day, or (whole month) the month's last day. */
  function setWhen(date: string | null, month = false) {
    setDueDate(date);
    setWholeMonth(month && date !== null);
  }
  const [minutes, setMinutes] = useState<number | null>(existing?.minutes ?? 5);
  const [energy, setEnergy] = useState<Energy>(existing?.energy ?? "normal");
  const [isEssential, setIsEssential] = useState(existing?.isEssential ?? false);
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
      energy,
      isEssential,
    };
    if (existing) updateTask(existing.id, input);
    else addTask(input);
    onClose();
  }

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-2 text-sm transition-colors ${active ? "bg-ink text-cream" : "bg-cream text-ink/80"}`;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/30 md:items-center" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="pb-safe max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card px-5 pt-5 shadow-xl md:max-w-lg md:rounded-3xl md:pb-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{existing ? "Edit task" : "New task"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-muted">
            <Icon.close className="size-6" />
          </button>
        </div>

        <input
          autoFocus={!existing}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="w-full rounded-2xl border border-line bg-cream px-4 py-3.5 text-base outline-none focus:border-sage"
        />

        <p className="mb-2 mt-5 text-sm font-semibold text-muted">When</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(!wholeMonth && dueDate === dayKey())} onClick={() => setWhen(dayKey())}>
            Today
          </button>
          <button type="button" className={chip(!wholeMonth && dueDate === inDays(1))} onClick={() => setWhen(inDays(1))}>
            Tomorrow
          </button>
          <button
            type="button"
            className={chip(wholeMonth && dueDate === monthEndKey(0))}
            onClick={() => setWhen(monthEndKey(0), true)}
          >
            This month
          </button>
          <button
            type="button"
            className={chip(wholeMonth && dueDate === monthEndKey(1))}
            onClick={() => setWhen(monthEndKey(1), true)}
          >
            Next month
          </button>
          <button type="button" className={chip(dueDate === null)} onClick={() => setWhen(null)}>
            No date
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            A day
            <input
              type="date"
              value={!wholeMonth ? (dueDate ?? "") : ""}
              onChange={(e) => setWhen(e.target.value || null)}
              className="mt-1 w-full rounded-full bg-cream px-3 py-2 text-sm text-ink/80"
            />
          </label>
          <label className="text-xs text-muted">
            Or a whole month
            <input
              type="month"
              value={wholeMonth && dueDate ? dueDate.slice(0, 7) : ""}
              onChange={(e) => {
                if (!e.target.value) return setWhen(null);
                const [y, m] = e.target.value.split("-").map(Number);
                setWhen(dayKey(new Date(y, m, 0)), true); // last day of that month
              }}
              className="mt-1 w-full rounded-full bg-cream px-3 py-2 text-sm text-ink/80"
            />
          </label>
        </div>
        {wholeMonth && dueDate && (
          <p className="mt-2 text-xs text-muted">
            Any time in {new Date(dueDate + "T12:00:00").toLocaleDateString(undefined, { month: "long" })}, done by its last
            day.
          </p>
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

        <p className="mb-2 mt-5 text-sm font-semibold text-muted">How long</p>
        <div className="flex flex-wrap gap-2">
          {MINUTE_CHOICES.map((m) => (
            <button key={m} type="button" className={chip(minutes === m)} onClick={() => setMinutes(m)}>
              {m === 60 ? "1 h" : `${m} min`}
            </button>
          ))}
        </div>

        <p className="mb-2 mt-5 text-sm font-semibold text-muted">Energy it needs</p>
        <div className="flex gap-2">
          {(["low", "normal", "high"] as Energy[]).map((en) => (
            <button key={en} type="button" className={chip(energy === en)} onClick={() => setEnergy(en)}>
              {en[0].toUpperCase() + en.slice(1)}
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
