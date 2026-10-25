"use client";

// Skincare set up: the morning / evening steps (how often) and reminder times.

import { useState } from "react";
import { WEEKDAY_SHORT, scheduleLabel, type SkinSchedule, type SkinStep, type Slot } from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { dayKey } from "@/lib/store";
import { Card, CardTitle, Chips, DangerButton, Label, PrimaryButton, Sheet, inputClass } from "../finance/ui";
import { SLOT_TITLE } from "./SlotCard";

export function SkinSetup() {
  const { steps, moveStep, settings, updateSettings } = useSkin();
  const [editing, setEditing] = useState<SkinStep | { slot: Slot } | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {(["am", "pm"] as Slot[]).map((slot) => (
        <Card key={slot}>
          <CardTitle
            action={
              <button
                type="button"
                onClick={() => setEditing({ slot })}
                className="rounded-full bg-sage-dark px-3.5 py-1.5 text-sm font-bold text-white"
              >
                + Step
              </button>
            }
          >
            {SLOT_TITLE[slot]}
          </CardTitle>
          <ul className="divide-y divide-line">
            {steps
              .filter((s) => s.slot === slot)
              .map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-2.5">
                  <button type="button" onClick={() => setEditing(s)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[15px] font-semibold">{s.name}</span>
                    <span className="block text-[13px] text-muted">
                      {scheduleLabel(s.schedule)}
                      {s.note ? ` · ${s.note}` : ""}
                    </span>
                  </button>
                  <button type="button" onClick={() => moveStep(s.id, -1)} aria-label={`Move ${s.name} up`} className="px-2 text-muted">
                    ↑
                  </button>
                  <button type="button" onClick={() => moveStep(s.id, 1)} aria-label={`Move ${s.name} down`} className="px-2 text-muted">
                    ↓
                  </button>
                </li>
              ))}
          </ul>
        </Card>
      ))}

      <Card>
        <CardTitle>Reminders</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-muted">
            Morning
            <input
              type="time"
              value={settings.amTime}
              onChange={(e) => e.target.value && updateSettings({ amTime: e.target.value })}
              className={`${inputClass} mt-1`}
            />
          </label>
          <label className="text-sm text-muted">
            Evening
            <input
              type="time"
              value={settings.pmTime}
              onChange={(e) => e.target.value && updateSettings({ pmTime: e.target.value })}
              className={`${inputClass} mt-1`}
            />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-3 rounded-2xl bg-cream px-4 py-3">
          <input
            type="checkbox"
            checked={settings.remind}
            onChange={(e) => updateSettings({ remind: e.target.checked })}
            className="size-5 accent-sage"
          />
          <span className="text-[15px]">Remind me at these times</span>
        </label>
        {settings.remind && perm === "default" && (
          <button
            type="button"
            onClick={async () => setPerm(await Notification.requestPermission())}
            className="mt-3 w-full rounded-2xl bg-sage-soft py-3 text-sm font-bold text-sage-dark"
          >
            Allow notifications on this device
          </button>
        )}
        <p className="mt-3 text-xs text-muted">
          For now reminders come while Meraki is open (a banner at the top
          {perm === "granted" ? ", plus a notification" : ""}). Reminders with the app closed come once it&apos;s on your
          phone with notifications set up.
        </p>
      </Card>

      {editing && <StepSheet step={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StepSheet({ step, onClose }: { step: SkinStep | { slot: Slot }; onClose: () => void }) {
  const { saveStep, deleteStep } = useSkin();
  const existing = "id" in step ? step : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [slot, setSlot] = useState<Slot>(step.slot);
  const [kind, setKind] = useState<SkinSchedule["kind"]>(existing?.schedule.kind ?? "daily");
  const [days, setDays] = useState<number[]>(existing?.schedule.kind === "weekdays" ? existing.schedule.days : []);
  const [every, setEvery] = useState(existing?.schedule.kind === "every" ? existing.schedule.days : 3);
  const [from, setFrom] = useState(existing?.schedule.kind === "every" ? existing.schedule.from : dayKey());
  const [note, setNote] = useState(existing?.note ?? "");

  const schedule: SkinSchedule =
    kind === "daily" ? { kind } : kind === "weekdays" ? { kind, days: [...days].sort() } : { kind, days: every, from };
  const valid = name.trim() && (kind !== "weekdays" || days.length > 0);

  return (
    <Sheet title={existing ? "Edit step" : "New step"} onClose={onClose}>
      <Label>Product or step</Label>
      <input
        autoFocus={!existing}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Vitamin C serum, retinol"
        className={inputClass}
      />

      <Label>When</Label>
      <Chips
        options={[
          { id: "am", label: "Morning" },
          { id: "pm", label: "Evening" },
        ]}
        value={slot}
        onChange={setSlot}
      />

      <Label>How often</Label>
      <Chips
        options={[
          { id: "daily", label: "Every day" },
          { id: "weekdays", label: "Certain days" },
          { id: "every", label: "Every few days" },
        ]}
        value={kind}
        onChange={setKind}
      />
      {kind === "weekdays" && (
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {WEEKDAY_SHORT.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i]))}
              className={`rounded-xl py-2.5 text-sm font-semibold ${days.includes(i) ? "bg-rose text-white" : "bg-cream"}`}
            >
              {d}
            </button>
          ))}
        </div>
      )}
      {kind === "every" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px]">
          <span>Every</span>
          {[2, 3, 4, 7, 14].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEvery(n)}
              className={`rounded-full px-3.5 py-2 text-sm ${every === n ? "bg-ink text-cream" : "bg-cream"}`}
            >
              {n}
            </button>
          ))}
          <span>days, starting</span>
          <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="rounded-full bg-cream px-3 py-2 text-sm" />
        </div>
      )}

      <Label>Note (optional)</Label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. pea-sized amount" className={inputClass} />

      <PrimaryButton
        disabled={!valid}
        onClick={() => {
          saveStep({ id: existing?.id, name: name.trim(), slot, schedule, note: note.trim() || undefined });
          onClose();
        }}
      >
        {existing ? "Save" : "Add step"}
      </PrimaryButton>
      {existing && (
        <DangerButton
          label="Delete step"
          onConfirm={() => {
            deleteStep(existing.id);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
