// Works out the phone notifications for the next week from what's in the app.
// The list is saved to Supabase (meraki_replace_queue) and the meraki worker sends each one on time.

import { CLEANING, isDueOn, weeklyPlan, weekdayIndex } from "./cleaning";
import { type Bill, money, nextDue, paidKey } from "./finance";
import { kindWordFor } from "./kindWords";
import { type CareItem, careNextDue, slotKey } from "./skin";
import { type PushPrefs, type Task, dayKey, leadDays } from "./store";

export type QueueItem = { send_at: string; title: string; body: string; url: string; tag: string };

type Input = {
  now: Date;
  prefs: PushPrefs;
  tasks: Task[];
  officeDays: number[];
  bills: Bill[];
  paid: Record<string, string>;
  skin: { amTime: string; pmTime: string; done: Record<string, string[]>; items: CareItem[] };
};

const DAYS = 7;
const BASE = "/meraki";

function at(d: Date, time: string) {
  const [h, m] = time.split(":").map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Open tasks that show on Today on day `d` (from their "show early" date, and while late). */
function tasksOn(tasks: Task[], d: Date) {
  const key = dayKey(d);
  return tasks.filter((t) => {
    if (t.completedAt || !t.dueDate) return false;
    const [y, m, day] = t.dueDate.split("-").map(Number);
    return dayKey(new Date(y, m - 1, day - leadDays(t))) <= key;
  });
}

export function buildQueue({ now, prefs, tasks, officeDays, bills, paid, skin }: Input): QueueItem[] {
  const out: QueueItem[] = [];
  const add = (when: Date, title: string, body: string, url: string, tag: string) => {
    if (when > now) out.push({ send_at: when.toISOString(), title, body, url: `${BASE}${url}`, tag });
  };

  for (let i = 0; i < DAYS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const key = dayKey(d);

    if (prefs.morning) {
      const parts: string[] = [];
      const due = tasksOn(tasks, d);
      if (due.length) parts.push(due.length === 1 ? due[0].title : plural(due.length, "task"));
      const cleaning = [weeklyPlan(officeDays)[weekdayIndex(d)].routine.name];
      for (const r of CLEANING) if (r.when.kind === "monthly" && isDueOn(r, d, officeDays)) cleaning.push(r.name);
      parts.push(`Cleaning: ${cleaning.join(" + ")}`);
      if (prefs.skincare && prefs.morningTime === skin.amTime) parts.push("Morning skincare");
      add(at(d, prefs.morningTime), "Good morning ☀️", `Today: ${parts.join(" · ")}`, "/", `morning-${key}`);
    }

    if (prefs.skincare) {
      // Skip a slot that's already been ticked off today.
      // At the same time as the morning plan, it's part of that message instead.
      const inPlan = prefs.morning && prefs.morningTime === skin.amTime;
      if (!inPlan && !skin.done[slotKey("am", d)]?.length)
        add(at(d, skin.amTime), "Morning skincare 🌸", "Your morning steps are ready.", "/self-care/", `am-${key}`);
      if (!skin.done[slotKey("pm", d)]?.length)
        add(at(d, skin.pmTime), "Evening skincare 🌙", "Time to wind down with your evening steps.", "/self-care/", `pm-${key}`);
    }

    if (prefs.care) {
      const dueItems = skin.items.filter((it) => careNextDue(it) === key).map((it) => it.name);
      if (dueItems.length)
        add(at(d, "09:30"), "Self care 💅", `${dueItems.join(", ")} ${dueItems.length === 1 ? "is" : "are"} due today.`, "/self-care/", `care-${key}`);
    }

    if (prefs.bills) {
      const tomorrow = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      for (const b of bills) {
        for (const [day, label, time] of [
          [d, "Due today", "09:00"],
          [tomorrow, "Due tomorrow", "18:00"],
        ] as const) {
          const next = nextDue(b, day);
          if (!next || dayKey(next) !== dayKey(day) || paid[paidKey(b, next)]) continue;
          // The "tomorrow" reminder goes out the evening before, on day `d`.
          add(at(d, time), `${label}: ${b.name}`, `${money(b.amount)}. Tap to mark it paid.`, "/finances/", `bill-${b.id}-${dayKey(next)}-${time}`);
        }
      }
    }

    if (prefs.kind) {
      const w = kindWordFor(key);
      add(new Date(d.getFullYear(), d.getMonth(), d.getDate(), w.hour, w.minute), "A little reminder 💛", w.text, "/", `kind-${key}`);
    }
  }
  return out.sort((a, b) => a.send_at.localeCompare(b.send_at));
}
