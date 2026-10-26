// Works out the phone notifications for the next week from what's in the app.
// The list is saved to Supabase (meraki_replace_queue) and the meraki worker sends each one on time.

import { cleaningLists, isDueOn, weeklyPlan, weekdayIndex } from "./cleaning";
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
  routineDone?: Record<string, string[]>; // for the week summary
  kindWords?: string[]; // your own, mixed in
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

/** "This week: 9 tasks done · 5 cleaning lists · 6 skincare days", Monday to `d`. */
function weekSoFar(d: Date, tasks: Task[], skinDone: Record<string, string[]>, routineDone: Record<string, string[]>) {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - weekdayIndex(d));
  const keys: string[] = [];
  for (let x = new Date(monday); x <= d; x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1)) keys.push(dayKey(x));
  const doneTasks = tasks.filter((t) => t.completedAt && keys.includes(dayKey(new Date(t.completedAt)))).length;
  const lists = Object.entries(routineDone).filter(
    ([k, ids]) => keys.includes(k.split("@")[1]?.split("#")[0] ?? "") && ids.some((id) => !id.startsWith("__")),
  ).length;
  const skinDays = keys.filter((k) => skinDone[`am@${k}`]?.length || skinDone[`pm@${k}`]?.length).length;
  const parts = [
    doneTasks ? plural(doneTasks, "task") + " done" : null,
    lists ? plural(lists, "cleaning list") : null,
    skinDays ? plural(skinDays, "skincare day") : null,
  ].filter(Boolean);
  return parts.length ? `This week: ${parts.join(" · ")}` : "A new week starts tomorrow. Whatever this one was, it's done.";
}

export function buildQueue({ now, prefs, tasks, officeDays, bills, paid, skin, routineDone = {}, kindWords = [] }: Input): QueueItem[] {
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
      for (const r of cleaningLists()) if (r.when.kind === "monthly" && isDueOn(r, d, officeDays)) cleaning.push(r.name);
      parts.push(`Cleaning: ${cleaning.join(" + ")}`);
      if (prefs.skincare && prefs.morningTime === skin.amTime) parts.push("Morning skincare");
      add(at(d, prefs.morningTime), "Good morning", `Today: ${parts.join(" · ")}`, "/", `morning-${key}`);
    }

    if (prefs.skincare) {
      // Skip a slot that's already been ticked off today.
      // At the same time as the morning plan, it's part of that message instead.
      const inPlan = prefs.morning && prefs.morningTime === skin.amTime;
      if (!inPlan && !skin.done[slotKey("am", d)]?.length)
        add(at(d, skin.amTime), "Morning skincare", "Your morning steps are ready.", "/self-care/", `am-${key}`);
      if (!skin.done[slotKey("pm", d)]?.length)
        add(at(d, skin.pmTime), "Evening skincare", "Time to wind down with your evening steps.", "/self-care/", `pm-${key}`);
    }

    if (prefs.care) {
      const dueItems = skin.items.filter((it) => careNextDue(it) === key).map((it) => it.name);
      if (dueItems.length)
        add(at(d, "09:30"), "Self care", `${dueItems.join(", ")} ${dueItems.length === 1 ? "is" : "are"} due today.`, "/self-care/", `care-${key}`);
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
          add(at(d, time), `${label}: ${b.name}`, `${money(b.amount)}. Tap to mark it paid.`, "/finances/#bills", `bill-${b.id}-${dayKey(next)}-${time}`);
        }
      }
    }

    // Sunday evening: a look back. With today's numbers when it's planned on the day itself.
    if (prefs.weekly !== false && weekdayIndex(d) === 6) {
      const body = i === 0 ? weekSoFar(d, tasks, skin.done, routineDone) : "Tap to see how your week went.";
      add(at(d, "19:00"), "Your week", body, "/insights/", `week-${key}`);
    }

    if (prefs.kind) {
      const w = kindWordFor(key, kindWords);
      add(new Date(d.getFullYear(), d.getMonth(), d.getDate(), w.hour, w.minute), "A little reminder", w.text, "/", `kind-${key}`);
    }
  }
  // Tasks with "Remind me at": the notification goes out whatever the morning-plan setting is.
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS);
  for (const t of tasks) {
    if (t.completedAt || !t.remindAt) continue;
    const [date, time] = t.remindAt.split("T");
    const [y, m, d] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    const when = new Date(y, m - 1, d, h, mi);
    if (when > horizon) continue;
    const left = t.steps?.filter((s) => !s.done).length ?? 0;
    add(when, `Reminder: ${t.title}`, left ? `${left} small ${left === 1 ? "step" : "steps"} to go. You've got this.` : "Tap to open your tasks.", "/tasks/", `task-${t.id}-${t.remindAt}`);
  }
  return out.sort((a, b) => a.send_at.localeCompare(b.send_at));
}
