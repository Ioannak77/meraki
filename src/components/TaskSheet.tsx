"use client";

// Add / edit a reminder. Slides up from the bottom on phones, centred on iPad.
// In the order you'd think of it: what, how often, when, show early, notification. Area, time, small steps
// and priority are folded under More. Only the title is required; ready-made ones fill in the rest.

import { useState } from "react";
import {
  LEAD_CHOICES,
  advanceDate,
  repeatLabel,
  dayKey,
  leadDays,
  monthEndKey,
  useStore,
  type Repeat,
  type Task,
  type TaskStep,
} from "@/lib/store";
import { Sheet } from "./finance/ui";
import { Icon } from "./icons";
import { NewChip } from "./NewChip";

const MINUTE_CHOICES = [5, 10, 20, 30, 60];

/** How often a repeating reminder comes back. */
const INTERVALS: Repeat[] = [
  { every: 1, unit: "week" },
  { every: 2, unit: "week" },
  { every: 3, unit: "week" },
  { every: 4, unit: "week" },
  { every: 6, unit: "week" },
  { every: 8, unit: "week" },
  { every: 1, unit: "month" },
  { every: 3, unit: "month" },
  { every: 6, unit: "month" },
  { every: 1, unit: "year" },
  { every: 2, unit: "year" },
  { every: 5, unit: "year" },
  { every: 10, unit: "year" },
];
const same = (a: Repeat, b: Repeat) => a.every === b.every && a.unit === b.unit;

/** Ready-made repeating reminders (self care, check-ups, documents). */
type Idea = { title: string; repeat: Repeat; fromDone: boolean; area: string; lead: number; minutes: number };
const IDEAS: Idea[] = [
  { title: "Waxing", repeat: { every: 4, unit: "week" }, fromDone: true, area: "care", lead: 7, minutes: 60 },
  { title: "Nails", repeat: { every: 3, unit: "week" }, fromDone: true, area: "care", lead: 3, minutes: 60 },
  { title: "Haircut", repeat: { every: 8, unit: "week" }, fromDone: true, area: "care", lead: 7, minutes: 60 },
  { title: "Eyebrows", repeat: { every: 4, unit: "week" }, fromDone: true, area: "care", lead: 3, minutes: 30 },
  { title: "Dentist check-up", repeat: { every: 6, unit: "month" }, fromDone: true, area: "care", lead: 30, minutes: 60 },
  { title: "Gynaecologist check-up", repeat: { every: 1, unit: "year" }, fromDone: true, area: "care", lead: 30, minutes: 60 },
  { title: "Renew passport", repeat: { every: 10, unit: "year" }, fromDone: false, area: "life", lead: 182, minutes: 60 },
  { title: "Renew ID card", repeat: { every: 10, unit: "year" }, fromDone: false, area: "life", lead: 182, minutes: 60 },
];

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
  const [fromDone, setFromDone] = useState(existing?.repeatFromDone ?? false);
  const [steps, setSteps] = useState<TaskStep[]>(existing?.steps ?? []);
  const [newStep, setNewStep] = useState("");
  const [remindTime, setRemindTime] = useState(existing?.remindAt?.slice(11, 16) ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [more, setMore] = useState(false);
  // "I last did it on": kept to explain where the next date came from.
  const [lastDone, setLastDone] = useState<string | null>(null);

  const nice = (key: string) => new Date(key + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const lead = dueDate ? leadDays({ showBefore: showBefore ?? undefined, wholeMonth }) : 0;
  const showFrom = dueDate
    ? (() => {
        const [y, m, d] = dueDate.split("-").map(Number);
        return dayKey(new Date(y, m - 1, d - lead));
      })()
    : null;
  const summary = (() => {
    const when = !dueDate
      ? "No date yet: it waits in Reminders."
      : `${repeat ? "Next one" : "Due"}: ${wholeMonth ? `by the end of ${new Date(dueDate + "T12:00:00").toLocaleDateString(undefined, { month: "long" })}` : nice(dueDate)}${
          lastDone && repeat && dueDate === advanceDate(lastDone, repeat) ? ` (${nice(lastDone)} + ${repeatLabel(repeat).replace(/^Every /, "").toLowerCase()})` : ""
        }. ${showFrom && showFrom > dayKey() ? `It shows on Today from ${nice(showFrom)}.` : "It's on Today now."}`;
    if (!repeat) return when;
    const gap = repeatLabel(repeat).replace(/^Every /, "").toLowerCase();
    const after = fromDone
      ? `After you tick it, the next one is ${gap} after the day you tick it.`
      : `After you tick it, the next one is ${gap} after ${dueDate ? nice(dueDate) : "the day you tick it"}, whenever you did it.`;
    return `${when} ${after}`;
  })();

  function applyIdea(idea: Idea) {
    setTitle(idea.title);
    setRepeat(idea.repeat);
    setFromDone(idea.fromDone);
    setAreaId(areas.some((a) => a.id === idea.area) ? idea.area : null);
    setShowBefore(idea.lead);
    setMinutes(idea.minutes);
  }

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
      repeatFromDone: repeat && fromDone ? true : undefined,
      steps: [...steps, ...(newStep.trim() ? [{ id: Math.random().toString(36).slice(2, 9), title: newStep.trim(), done: false }] : [])],
      // On the due day (or today, for a task without a date).
      remindAt: remindTime ? `${dueDate ?? dayKey()}T${remindTime}` : null,
    };
    if (existing) updateTask(existing.id, input);
    else addTask(input);
    onClose();
  }

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-2 text-sm transition-[color,background-color,border-color,transform] ${active ? "bg-ink text-cream" : "bg-cream text-ink/80"}`;

  return (
    <Sheet title={existing ? "Edit reminder" : "New reminder"} onClose={onClose}>
      <form onSubmit={save}>

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
          placeholder="What do you want to remember?"
          className="w-full rounded-2xl border border-line bg-cream px-4 py-3.5 text-base outline-none focus:border-sage"
        />

        {/* Ready-made repeating reminders: one tap fills in the rest. */}
        {!existing && !title.trim() && (
          <>
            <p className="mb-2 mt-4 text-sm font-semibold text-muted">Or pick one</p>
            <div className="flex flex-wrap gap-2">
              {IDEAS.map((idea) => (
                <button key={idea.title} type="button" onClick={() => applyIdea(idea)} className={chip(false)}>
                  {idea.title}
                </button>
              ))}
            </div>
          </>
        )}

        <p className="mb-2 mt-5 text-sm font-semibold text-muted">How often</p>
        <div className="flex gap-1 rounded-full bg-cream p-1">
          {(
            [
              ["once", "Just once"],
              ["repeat", "It repeats"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`flex-1 rounded-full py-2.5 text-sm ${(repeat ? "repeat" : "once") === id ? "bg-ink font-bold text-cream" : "text-ink/70"}`}
              onClick={() => {
                if (id === "once") setRepeat(null);
                else if (!repeat) {
                  setRepeat({ every: 4, unit: "week" });
                  setFromDone(true);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {repeat && (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              {/* A repeat that isn't one of the choices (e.g. every 5 weeks) stays selectable. */}
              {!INTERVALS.some((c) => same(c, repeat)) && (
                <button type="button" className={chip(true)}>
                  {repeatLabel(repeat)}
                </button>
              )}
              {INTERVALS.map((c) => (
                <button
                  key={repeatLabel(c)}
                  type="button"
                  className={chip(same(c, repeat))}
                  onClick={() => {
                    setRepeat(c);
                    // Counted from a last-done date: the next date follows the new gap.
                    if (lastDone && dueDate === advanceDate(lastDone, repeat)) setWhen(advanceDate(lastDone, c));
                  }}
                >
                  {repeatLabel(c)}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-start gap-3 rounded-2xl bg-cream p-3.5">
              <input type="checkbox" checked={fromDone} onChange={(e) => setFromDone(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-sage" />
              <span>
                <span className="block text-[15px] font-semibold">Count from the day I do it</span>
                <span className="block text-xs text-muted">
                  For waxing, a haircut or a check-up: done a week late, the next one moves a week too. Off for fixed dates, like a
                  passport&apos;s expiry.
                </span>
              </span>
            </label>
          </>
        )}

        <p className="mb-2 mt-5 text-sm font-semibold text-muted">{repeat ? "When is the next one?" : "When"}</p>
        <div className="flex gap-1 rounded-full bg-cream p-1">
          {(
            [
              ["date", "On a date"],
              ["month", "In a month"],
              ["none", "No date"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`flex-1 rounded-full py-2.5 text-sm ${(mode ?? "none") === id ? "bg-ink font-bold text-cream" : "text-ink/70"}`}
              onClick={() => {
                if (id === "none") {
                  setMode(null);
                  setWhen(null);
                } else if (id === "date") {
                  setMode("date");
                  if (wholeMonth || !dueDate) setWhen(dayKey());
                } else {
                  setMode("month");
                  if (!wholeMonth || !dueDate) setWhen(monthEndKey(0), true);
                }
              }}
            >
              {label}
            </button>
          ))}
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
                Any time in {new Date(dueDate + "T12:00:00").toLocaleDateString(undefined, { month: "long" })}, done by its last day.
              </p>
            )}
          </>
        )}
        {!mode && (
          <p className="mt-2 text-sm text-muted">
            {repeat ? "Tick it when you do it, and the next one gets its date from then." : "It waits in Reminders until you give it a date."}
          </p>
        )}
        {/* For repeating ones you often know the last time better than the next. */}
        {repeat && (
          <label className="mt-2 flex items-center gap-2 text-sm text-muted">
            Or: I last did it on
            <input
              type="date"
              aria-label="Last time"
              onChange={(e) => {
                if (!e.target.value) return;
                setMode("date");
                setLastDone(e.target.value);
                setWhen(advanceDate(e.target.value, repeat));
              }}
              className="min-w-0 flex-1 rounded-2xl bg-cream px-3 py-2 text-base text-ink"
            />
          </label>
        )}

        {dueDate && (
          <>
            <p className="mb-2 mt-5 text-sm font-semibold text-muted">Show it on Today</p>
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
            <p className="mt-2 text-xs text-muted">
              {showFromText(dueDate, leadDays({ showBefore: showBefore ?? undefined, wholeMonth }))} Early is handy for things you
              need to book.
            </p>
          </>
        )}

        <p className="mb-2 mt-5 text-sm font-semibold text-muted">Phone notification</p>
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
              None
            </button>
          ) : (
            <span className="text-sm text-muted">optional, at this time {dueDate ? "on the day" : "today"}</span>
          )}
        </div>

        {/* The rest is optional: folded away so a reminder stays quick to add. */}
        <button
          type="button"
          onClick={() => setMore(!more)}
          aria-expanded={more}
          className="mt-5 flex w-full items-center justify-between rounded-2xl bg-cream px-4 py-3 text-left text-[15px] font-semibold"
        >
          <span>
            More
            <span className="block text-xs font-normal text-muted">
              {[
                areas.find((a) => a.id === areaId)?.name ?? "No area",
                minutes ? (minutes === 60 ? "1 h" : `${minutes} min`) : null,
                steps.length ? `${steps.length} steps` : null,
                isEssential ? "priority today" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <span className={`text-muted transition-transform duration-200 ease-out ${more ? "rotate-90" : ""}`}>›</span>
        </button>
        {more && (
          <div className="animate-reveal">
            <p className="mb-2 mt-4 text-sm font-semibold text-muted">Area</p>
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

            <p className="mb-2 mt-5 text-sm font-semibold text-muted">How long it takes</p>
            <div className="flex flex-wrap gap-2">
              {MINUTE_CHOICES.map((m) => (
                <button key={m} type="button" className={chip(minutes === m)} onClick={() => setMinutes(m)}>
                  {m === 60 ? "1 h" : `${m} min`}
                </button>
              ))}
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
                placeholder="Break it down, e.g. call to book"
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

            <label className="mt-5 flex items-center gap-3 rounded-2xl bg-cream px-4 py-3">
              <input type="checkbox" checked={isEssential} onChange={(e) => setIsEssential(e.target.checked)} className="size-5 accent-sage" />
              <span className="text-[15px]">Make it a priority for today</span>
            </label>
          </div>
        )}

        {/* What happens, in plain words, from the choices above. */}
        <div className="mt-5 rounded-2xl bg-sage-soft px-4 py-3 text-[14px] leading-snug text-sage-dark">
          {summary}
        </div>

        <button
          type="submit"
          disabled={!title.trim()}
          className="mt-6 w-full rounded-2xl bg-sage-dark py-4 text-base font-bold text-white disabled:opacity-40"
        >
          {existing ? "Save" : "Add reminder"}
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
            {confirmDelete ? "Tap again to delete" : "Delete reminder"}
          </button>
        )}
      </form>
    </Sheet>
  );
}
