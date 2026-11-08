"use client";

// Cleaning schedule > Edit: everything about the schedule, without help. The month-end time limit and
// office days at the top; then each list by layer (keep up, declutter, clean). In a list: its name, day or
// months, and each step's time, room, how often, what happens if it isn't done, and how to do it.
// Edits are saved as the store's copy of the schedule; "Reset" goes back to the default.

import { useState } from "react";
import {
  DEFAULT_CLEANING,
  MONTHS,
  ROOMS,
  WEEKDAYS,
  cleaningLists,
  formatMinutes,
  groupForMonths,
  PHASES,
  phaseOf,
  layerOf,
  carries,
  isBedroomJob,
  ALWAYS_DEFAULT,
  type Phase,
  weekParity,
  type WeekParity,
  type Room,
  type Routine,
  type Step,
} from "@/lib/cleaning";
import { useStore } from "@/lib/store";
import { HOW } from "@/lib/cleaningHow";
import { DragList } from "./DragList";
import { Icon } from "./icons";
import { DangerButton, Label, PrimaryButton, Sheet, inputClass } from "./finance/ui";

const PARTS = { morning: "Morning", meals: "After meals", evening: "Evening" } as const;

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function minutesOf(r: Routine) {
  return r.steps.filter((s) => !s.optional).reduce((t, s) => t + s.minutes, 0);
}

function whenLabel(r: Routine) {
  if (layerOf(r) === "declutter") return "A little each week, in the evening";
  if (r.when.kind === "daily") return `Every day · ${PARTS[r.when.part]}`;
  if (r.when.kind === "weekly") return `Every ${WEEKDAYS[r.when.weekday]}`;
  if (r.when.months.length === 12) return "Every month-end weekend";
  return `Month-end: ${r.when.months.map((m) => MONTHS[m - 1].slice(0, 3)).join(", ")}`;
}

export function CleaningEditor() {
  const { cleaning, saveCleaning, settings, updateSettings } = useStore();
  const lists = cleaningLists();
  const [editing, setEditing] = useState<Routine | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  function save(updated: Routine[]) {
    saveCleaning(updated);
  }

  const daily = lists.filter((r) => r.when.kind === "daily" && layerOf(r) === "keep");
  const declutter = lists.filter((r) => layerOf(r) === "declutter");
  const weekly = lists
    .filter((r) => r.when.kind === "weekly")
    .sort((a, b) => (a.when.kind === "weekly" && b.when.kind === "weekly" ? a.when.weekday - b.when.weekday : 0));
  const monthEnd = lists.filter((r) => r.when.kind === "monthly");

  const group = (title: string, items: Routine[]) => (
    <section className="rounded-3xl bg-card p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <ul className="mt-1 divide-y divide-line">
        {items.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => setEditing(r)} className="flex w-full items-center gap-3 py-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold">{r.name}</span>
                <span className="block truncate text-[13px] text-muted">
                  {whenLabel(r)} · {r.steps.length} {r.steps.length === 1 ? "step" : "steps"} · ~{formatMinutes(minutesOf(r))}
                </span>
              </span>
              <span className="text-muted">›</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <>
      <p className="rounded-3xl bg-card/60 p-5 text-[15px] text-muted lg:col-span-2">
        Tap a list to change its steps: time, room, how often, what happens if it isn&apos;t done, and how to do it. Changes show
        everywhere straight away and sync to your other devices. The Guide tab explains how it all fits together.
      </p>
      <section className="rounded-3xl bg-card p-5 lg:col-span-2">
        <h2 className="text-lg font-bold">Settings</h2>
        <p className="mt-2 text-sm font-semibold text-muted">Month-end Big clean: at most</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {[60, 90, 120, 150, 180].map((m) => {
            const on = (settings.bigCleanMinutes ?? 120) === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => updateSettings({ bigCleanMinutes: m })}
                className={`rounded-full px-3.5 py-2 text-sm ${on ? "bg-ink font-bold text-cream" : "bg-cream text-ink/80"}`}
              >
                {formatMinutes(m)}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-muted">
          The floors, the machine and the loads always fit; then the jobs most overdue, until the time is used. The rest waits.
        </p>
        <p className="mt-4 text-sm font-semibold text-muted">Office days</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {WEEKDAYS.slice(0, 5).map((d, i) => {
            const on = settings.officeDays.includes(i);
            return (
              <button
                key={d}
                type="button"
                onClick={() =>
                  updateSettings({ officeDays: on ? settings.officeDays.filter((x) => x !== i) : [...settings.officeDays, i].sort() })
                }
                className={`rounded-full px-3.5 py-2 text-sm ${on ? "bg-ink font-bold text-cream" : "bg-cream text-ink/80"}`}
              >
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-muted">On office days you get the shortest weekly list; the longer one moves to a lighter weekday.</p>
      </section>
      {group("Keep up: every day", daily)}
      {group("Declutter", declutter)}
      {group("Clean: weekly", weekly)}
      <div className="flex flex-col gap-4 lg:col-span-2">
        {group("Clean: month-end jobs", monthEnd)}
        <button
          type="button"
          onClick={() =>
            setEditing({ id: newId("list"), name: "", group: "quarterly", when: { kind: "monthly", months: [] }, steps: [] })
          }
          className="flex items-center justify-center gap-2 rounded-2xl bg-sage-soft py-3 font-bold text-sage-dark"
        >
          <Icon.plus className="size-5" /> New month-end list
        </button>
        {cleaning && (
          <button
            type="button"
            onClick={() => (confirmReset ? (saveCleaning(null), setConfirmReset(false)) : setConfirmReset(true))}
            className={`rounded-2xl py-3 text-sm font-semibold ${confirmReset ? "bg-rose text-white" : "text-muted"}`}
          >
            {confirmReset ? "Tap again: undo all my changes" : "Reset to the original schedule"}
          </button>
        )}
      </div>

      {editing && (
        <ListSheet
          routine={editing}
          isNew={!lists.some((r) => r.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(r) => {
            let next = lists.some((x) => x.id === r.id) ? lists.map((x) => (x.id === r.id ? r : x)) : [...lists, r];
            // A weekly list moved to another day swaps places with the list that was there.
            const before = lists.find((x) => x.id === r.id);
            if (before?.when.kind === "weekly" && r.when.kind === "weekly" && before.when.weekday !== r.when.weekday) {
              const to = r.when.weekday;
              const from = before.when.weekday;
              next = next.map((x) =>
                x.id !== r.id && x.when.kind === "weekly" && x.when.weekday === to ? { ...x, when: { kind: "weekly", weekday: from } } : x,
              );
            }
            save(next);
            setEditing(null);
          }}
          onDelete={() => {
            save(lists.filter((x) => x.id !== editing.id));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ListSheet({
  routine,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  routine: Routine;
  isNew: boolean;
  onClose: () => void;
  onSave: (r: Routine) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<Routine>(routine);
  const [open, setOpen] = useState<string | null>(null);
  const prefix = routine.id;
  const isDefault = DEFAULT_CLEANING.some((r) => r.id === routine.id);

  const setStep = (id: string, patch: Partial<Step>) =>
    setDraft((d) => ({ ...d, steps: d.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const months = draft.when.kind === "monthly" ? draft.when.months : [];
  const valid = draft.name.trim() && draft.steps.every((s) => s.title.trim()) && (draft.when.kind !== "monthly" || months.length > 0);

  return (
    <Sheet title={isNew ? "New month-end list" : "Edit list"} onClose={onClose}>
      <Label>Name</Label>
      <input
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="e.g. Spring clean"
        className={inputClass}
      />

      {draft.when.kind === "weekly" && (
        <>
          <Label>Day</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => setDraft({ ...draft, when: { kind: "weekly", weekday: i } })}
                className={`rounded-full px-3.5 py-2 text-sm ${draft.when.kind === "weekly" && draft.when.weekday === i ? "bg-ink text-cream" : "bg-cream text-ink/80"}`}
              >
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">It swaps places with the list on that day. Office days still get the shorter lists.</p>
        </>
      )}

      {draft.when.kind === "monthly" && (
        <>
          <Label>Usual months (its jobs repeat this often; a missed job moves to the next month)</Label>
          <div className="flex flex-wrap gap-2">
            {MONTHS.map((m, i) => {
              const on = months.includes(i + 1);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    const next = on ? months.filter((x) => x !== i + 1) : [...months, i + 1].sort((a, b) => a - b);
                    setDraft({ ...draft, group: groupForMonths(next), when: { kind: "monthly", months: next } });
                  }}
                  className={`rounded-full px-3 py-2 text-sm ${on ? "bg-ink text-cream" : "bg-cream text-ink/80"}`}
                >
                  {m.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </>
      )}

      <Label>Steps</Label>
      <div className="rounded-2xl bg-cream px-3">
      <DragList
        className="divide-y divide-line"
        items={draft.steps}
        label={(s) => s.title || "new step"}
        onReorder={(ids) => setDraft((d) => ({ ...d, steps: ids.map((id) => d.steps.find((x) => x.id === id)!) }))}
        render={(s, handle) => (
          <div className="py-2">
            <div className="flex items-center gap-1">
            <span {...handle}>⋮⋮</span>
            <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left">
              <span className={`flex-1 text-[15px] ${s.title ? "" : "text-muted"}`}>{s.title || "New step"}</span>
              <span className="shrink-0 text-xs text-muted">
                {s.minutes} min{s.optional ? " · if needed" : ""}
              </span>
            </button>
            </div>
            {open === s.id && (
              <div className="mt-2 grid gap-2 pb-2">
                <input
                  value={s.title}
                  onChange={(e) => setStep(s.id, { title: e.target.value })}
                  placeholder="What to do"
                  className={inputClass}
                  autoFocus={!s.title}
                />
                <div className="flex gap-2">
                  <label className="flex flex-1 items-center gap-2 text-sm text-muted">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={s.minutes}
                      onChange={(e) => setStep(s.id, { minutes: Math.max(1, Number(e.target.value) || 1) })}
                      className={`${inputClass} w-20 text-center`}
                    />
                    min
                  </label>
                  <select value={s.room} onChange={(e) => setStep(s.id, { room: e.target.value as Room })} className={`${inputClass} flex-1`}>
                    {ROOMS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <input
                  value={s.hint ?? ""}
                  onChange={(e) => setStep(s.id, { hint: e.target.value || undefined })}
                  placeholder="Small note (optional), e.g. into the machine"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setStep(s.id, { optional: !s.optional || undefined })}
                  className="flex items-center gap-2 text-left text-sm"
                >
                  <span className={`grid size-6 place-items-center rounded-md border-2 ${s.optional ? "border-sage bg-sage text-white" : "border-line bg-card"}`}>
                    {s.optional && <Icon.check className="size-4" />}
                  </span>
                  Only if needed (doesn&apos;t count towards the time)
                </button>
                <StepTiming step={s} list={draft} onChange={(patch) => setStep(s.id, patch)} />
                <label className="text-sm text-muted">
                  How to do it
                  <textarea
                    value={s.how ?? ""}
                    onChange={(e) => setStep(s.id, { how: e.target.value || undefined })}
                    placeholder={HOW[s.id] || "Steps, products, what to watch out for…"}
                    rows={4}
                    className={`${inputClass} mt-1 text-[15px]`}
                  />
                  {!s.how && HOW[s.id] && <span className="mt-1 block text-xs">Empty: the instructions above (greyed) are used.</span>}
                </label>
                <div className="flex gap-2 text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, steps: d.steps.filter((x) => x.id !== s.id) }))}
                    className="ml-auto rounded-xl px-3 py-2 text-rose"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      />
      <div className="border-t border-line py-2">
          <button
            type="button"
            onClick={() => {
              const id = newId(prefix);
              setDraft((d) => ({ ...d, steps: [...d.steps, { id, title: "", minutes: 5, room: d.steps.at(-1)?.room ?? "Whole home" }] }));
              setOpen(id);
            }}
            className="flex w-full items-center gap-2 py-1 text-[15px] font-semibold text-sage-dark"
          >
            <Icon.plus className="size-4" /> Add a step
          </button>
      </div>
      </div>

      <PrimaryButton disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>
        Save
      </PrimaryButton>
      {!isNew && draft.when.kind === "monthly" && !(isDefault && routine.id === "monthly") && (
        <DangerButton label="Delete this list" onConfirm={onDelete} />
      )}
    </Sheet>
  );
}

const todayKey = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

function Choice({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1 text-sm text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Tick({ on, label, note, onChange }: { on: boolean; label: string; note?: string; onChange: (on: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-start gap-2 text-left text-sm">
      <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 ${on ? "border-sage bg-sage text-white" : "border-line bg-card"}`}>
        {on && <Icon.check className="size-4" />}
      </span>
      <span>
        {label}
        {note && <span className="block text-xs text-muted">{note}</span>}
      </span>
    </button>
  );
}

/**
 * When a step comes up, and what happens if it isn't done: the choices depend on the kind of list.
 * Every choice here has a plain default, so leaving them alone is always fine.
 */
function StepTiming({ step: s, list, onChange }: { step: Step; list: Routine; onChange: (patch: Partial<Step>) => void }) {
  if (list.when.kind === "daily") {
    const freq = s.every ? "days" : s.weekdays ? "weekdays" : "daily";
    return (
      <div className="grid gap-2 rounded-2xl bg-card p-3">
        <Choice
          label="How often"
          value={freq}
          options={[
            ["daily", "Every day"],
            ["weekdays", "On some days of the week"],
            ["days", "Every few days"],
          ]}
          onChange={(v) =>
            onChange(
              v === "daily"
                ? { every: undefined, weekdays: undefined }
                : v === "weekdays"
                  ? { every: undefined, weekdays: s.weekdays ?? [0] }
                  : { weekdays: undefined, every: s.every ?? { days: 3, from: todayKey() } },
            )
          }
        />
        {freq === "weekdays" && (
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, wd) => {
              const on = s.weekdays?.includes(wd) ?? false;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    const next = on ? (s.weekdays ?? []).filter((x) => x !== wd) : [...(s.weekdays ?? []), wd].sort();
                    onChange({ weekdays: next.length ? next : undefined });
                  }}
                  className={`rounded-full px-2.5 py-1.5 text-xs ${on ? "bg-ink text-cream" : "bg-cream text-ink/80"}`}
                >
                  {d.slice(0, 3)}
                </button>
              );
            })}
          </div>
        )}
        {freq === "days" && (
          <label className="flex items-center gap-2 text-sm text-muted">
            Every
            <input
              type="number"
              inputMode="numeric"
              min={2}
              value={s.every?.days ?? 3}
              onChange={(e) => onChange({ every: { days: Math.max(2, Number(e.target.value) || 2), from: s.every?.from ?? todayKey() } })}
              className={`${inputClass} w-20 text-center`}
            />
            days, starting from {s.every?.from === todayKey() ? "today" : "the last time"}
          </label>
        )}
        {(freq === "days" || s.afterWash) && (
          <Choice
            label="If it isn't done"
            value={carries(s) ? "carry" : "let-go"}
            options={[
              ["let-go", "Let it go: it comes back on its next day"],
              ["carry", "Keep it until it's done (the next one counts from then)"],
            ]}
            onChange={(v) => onChange({ carry: v === "carry" })}
          />
        )}
      </div>
    );
  }
  if (list.when.kind === "weekly") {
    return (
      <div className="grid gap-2 rounded-2xl bg-card p-3">
        <Choice
          label="How often"
          value={s.everyOtherWeek ?? "every"}
          options={[
            ["every", "Every week"],
            [weekParity(), "Every other week, starting this week"],
            [weekParity() === "odd" ? "even" : "odd", "Every other week, starting next week"],
          ]}
          onChange={(v) => onChange({ everyOtherWeek: v === "every" ? undefined : (v as WeekParity) })}
        />
        <Choice
          label="If it isn't done"
          value={carries(s) || (s.wash && s.everyOtherWeek) ? "carry" : "week"}
          options={[
            ["week", "Catch up until Sunday, then let it go"],
            ["carry", "Keep it until it's done"],
          ]}
          onChange={(v) => onChange({ carry: v === "carry" })}
        />
        <Choice
          label="On the month-end weekend, it goes in the Big clean part"
          value={phaseOf(s)}
          options={PHASES.map((p) => [p.id, `${p.label} (${p.when})`])}
          onChange={(v) => onChange({ phase: v as Phase, startFirst: undefined })}
        />
      </div>
    );
  }
  // Month-end jobs.
  const listEvery = Math.max(1, Math.round(12 / Math.max(1, list.when.months.length)));
  const bedroom = isBedroomJob(s);
  return (
    <div className="grid gap-2 rounded-2xl bg-card p-3">
      <Choice
        label="How often"
        value={String(s.everyMonths ?? "list")}
        options={[
          ["list", `Like the rest of this list (every ${listEvery === 1 ? "month" : `${listEvery} months`})`],
          ["1", "Every month"],
          ["2", "Every 2 months"],
          ["3", "Every 3 months"],
          ["4", "Every 4 months"],
          ["6", "Every 6 months"],
          ["12", "Once a year"],
        ]}
        onChange={(v) => onChange({ everyMonths: v === "list" ? undefined : Number(v) })}
      />
      <Tick
        on={bedroom}
        label="Do it on the bedroom day, with the sheets"
        note="For bed and bedroom jobs: done while the bed is stripped, not in the Big clean."
        onChange={(on) => onChange({ bedroomDay: on })}
      />
      {!bedroom && (
        <>
          <Tick
            on={s.always ?? ALWAYS_DEFAULT.includes(s.id)}
            label="In every Big clean"
            note="It always gets a place, even past the time limit (like the floors and the machine)."
            onChange={(on) => onChange({ always: on })}
          />
          <Choice
            label="Part of the Big clean"
            value={phaseOf(s)}
            options={PHASES.map((p) => [p.id, `${p.label} (${p.when})`])}
            onChange={(v) => onChange({ phase: v as Phase, startFirst: undefined })}
          />
          <p className="text-xs text-muted">If it isn&apos;t done, it stays due and is first in line at the next month-end.</p>
        </>
      )}
    </div>
  );
}
