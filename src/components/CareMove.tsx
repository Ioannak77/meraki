"use client";

// Self care used to have its own Reminders tab (waxing, nails, hair…). They now live in Reminders as
// repeating reminders that count from the day you do them. This moves them over once, on each device;
// the ids are fixed ("care-…"), so a second device or a sync can't add them twice.

import { useEffect } from "react";
import { careNextDue, type CareItem } from "@/lib/skin";
import { useSkin } from "@/lib/skinStore";
import { today } from "@/lib/clock";
import { useStore, type Repeat, type Task } from "@/lib/store";

function repeatOf(days: number): Repeat {
  if (days % 365 === 0) return { every: days / 365, unit: "year" };
  if (days % 7 === 0) return { every: days / 7, unit: "week" };
  return { every: days, unit: "day" };
}

function asTask(item: CareItem): Task {
  return {
    id: `care-${item.id}`,
    title: item.note ? `${item.name} (${item.note})` : item.name,
    areaId: "care",
    dueDate: careNextDue(item),
    showBefore: item.showBefore,
    minutes: null,
    energy: "low",
    isEssential: false,
    completedAt: null,
    createdAt: today().toISOString(),
    repeat: repeatOf(item.everyDays),
    repeatFromDone: true,
  };
}

export function CareMove() {
  const store = useStore();
  const skin = useSkin();
  const { ready: storeReady, importTasks } = store;
  const { ready: skinReady, items, clearItems } = skin;
  useEffect(() => {
    if (!storeReady || !skinReady || items.length === 0) return;
    importTasks(items.map(asTask));
    clearItems();
  }, [storeReady, skinReady, items, importTasks, clearItems]);
  return null;
}
