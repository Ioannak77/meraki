"use client";

// Repeating self-care reminders: waxing, nails, haircut, brows… Each knows
// when you last did it, so it can tell you when it's next due, early enough
// to book an appointment.

import { useState } from "react";
import {
  CARE_EVERY,
  careDaysLeft,
  careIsDueSoon,
  careNextDue,
  careStatus,
  everyLabel,
  type CareItem,
} from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { dayKey } from "@/lib/store";
import { Icon } from "../icons";
import { Fold } from "../Fold";
import { Card, CardTitle, Chips, DangerButton, Label, PrimaryButton, Sheet, inputClass } from "../finance/ui";

const SHOW_BEFORE = [
  { id: 0, label: "On the day" },
  { id: 3, label: "3 days before" },
  { id: 7, label: "1 week before" },
  { id: 14, label: "2 weeks before" },
];

/** Due soon / overdue first, then by date; ones without a last date at the end. */
function sortItems(items: CareItem[], now: Date) {
  return [...items].sort((a, b) => {
    const da = careDaysLeft(a, now);
    const db = careDaysLeft(b, now);
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
}

function CareRow({ item, now, onEdit }: { item: CareItem; now: Date; onEdit: () => void }) {
  const { markDone } = useSkin();
  const left = careDaysLeft(item, now);
  const urgent = left !== null && left <= item.showBefore;
  return (
    <li className="flex items-center gap-3 py-3">
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15px] font-semibold">{item.name}</span>
        <span className={`block text-[13px] ${left !== null && left < 0 ? "font-semibold text-peach" : urgent ? "text-rose" : "text-muted"}`}>
          {careStatus(item, now)} · {everyLabel(item.everyDays).toLowerCase()}
        </span>
      </button>
      {item.lastDone === null ? (
        <button type="button" onClick={onEdit} className="shrink-0 rounded-full bg-cream px-3.5 py-2 text-sm font-semibold">
          Set date
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            navigator.vibrate?.(20);
            markDone(item.id, dayKey(now));
          }}
          className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-bold ${urgent ? "bg-rose text-white" : "bg-rose-soft text-rose"}`}
        >
          Done today
        </button>
      )}
    </li>
  );
}

/** The due-soon ones, for Today screens. Renders nothing when none are due. */
export function CareDueCard({ now }: { now: Date }) {
  const { items } = useSkin();
  const [editing, setEditing] = useState<CareItem | null>(null);
  const due = sortItems(items.filter((i) => careIsDueSoon(i, now)), now);
  if (due.length === 0) return null;
  return (
    <Fold id="today-care" title="Self-care reminders">
      <ul className="divide-y divide-line">
        {due.map((i) => (
          <CareRow key={i.id} item={i} now={now} onEdit={() => setEditing(i)} />
        ))}
      </ul>
      {editing && <CareSheet item={editing} now={now} onClose={() => setEditing(null)} />}
    </Fold>
  );
}

export function CareReminders({ now }: { now: Date }) {
  const { items } = useSkin();
  const [editing, setEditing] = useState<CareItem | "new" | null>(null);
  return (
    <div className="grid grid-cols-1 gap-4">
      <Card>
        <CardTitle
          action={
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="flex items-center gap-1 rounded-full bg-sage-dark px-3.5 py-1.5 text-sm font-bold text-white"
            >
              <Icon.plus className="size-4" /> Add
            </button>
          }
        >
          Reminders
        </CardTitle>
        <p className="text-sm text-muted">
          Things that come round every few weeks. Tap <strong>Done today</strong> when you&apos;ve done one and the
          countdown starts again. They show on Today early enough to book.
        </p>
        {items.length === 0 ? (
          <p className="py-4 text-muted">Nothing yet. Add waxing, nails, a haircut…</p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {sortItems(items, now).map((i) => (
              <CareRow key={i.id} item={i} now={now} onEdit={() => setEditing(i)} />
            ))}
          </ul>
        )}
      </Card>
      {editing && <CareSheet item={editing} now={now} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CareSheet({ item, now, onClose }: { item: CareItem | "new"; now: Date; onClose: () => void }) {
  const { saveItem, deleteItem } = useSkin();
  const existing = item === "new" ? null : item;
  const [name, setName] = useState(existing?.name ?? "");
  const [everyDays, setEveryDays] = useState(existing?.everyDays ?? 28);
  const [lastDone, setLastDone] = useState<string>(existing?.lastDone ?? "");
  const [showBefore, setShowBefore] = useState(existing?.showBefore ?? 3);
  const [note, setNote] = useState(existing?.note ?? "");
  const preview = lastDone ? careNextDue({ id: "", name, everyDays, lastDone, showBefore }) : null;

  return (
    <Sheet title={existing ? existing.name : "New reminder"} onClose={onClose}>
      <Label>What is it?</Label>
      <input
        autoFocus={!existing}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Waxing, nails, haircut, lashes"
        className={inputClass}
      />

      <Label>How often</Label>
      <Chips options={CARE_EVERY.map((c) => ({ id: c.days, label: c.label }))} value={everyDays} onChange={setEveryDays} />

      <Label>When did you last do it?</Label>
      <div className="flex gap-2">
        <input type="date" value={lastDone} max={dayKey(now)} onChange={(e) => setLastDone(e.target.value)} className={`${inputClass} flex-1`} />
        <button type="button" onClick={() => setLastDone(dayKey(now))} className="shrink-0 rounded-2xl bg-cream px-4 text-sm font-semibold">
          Today
        </button>
      </div>
      {preview && (
        <p className="mt-2 text-xs text-muted">
          Next due {new Date(preview + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}.
        </p>
      )}

      <Label>Show on Today</Label>
      <Chips options={SHOW_BEFORE} value={showBefore} onChange={setShowBefore} />

      <Label>Note (optional)</Label>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. salon number, which colour" className={inputClass} />

      <PrimaryButton
        disabled={!name.trim()}
        onClick={() => {
          saveItem({
            id: existing?.id,
            name: name.trim(),
            everyDays,
            lastDone: lastDone || null,
            showBefore,
            note: note.trim() || undefined,
          });
          onClose();
        }}
      >
        {existing ? "Save" : "Add reminder"}
      </PrimaryButton>
      {existing && (
        <DangerButton
          label="Delete reminder"
          onConfirm={() => {
            deleteItem(existing.id);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
