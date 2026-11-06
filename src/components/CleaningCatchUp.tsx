"use client";

// What's left from earlier (see "What happens when something isn't done" in cleaning.ts): an unfinished
// bedroom day, weekly steps missed this week (and missed machine loads), and the Big clean's leftovers.

import { bedroomCatchUp, bigCleanLeftovers, catchUp } from "@/lib/cleaning";
import { useStore } from "@/lib/store";
import { ChecklistCard } from "./BedroomDayCard";

const dayName = (d: Date) => d.toLocaleDateString(undefined, { weekday: "long" });
const shortDate = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function CleaningCatchUp({ date }: { date: Date }) {
  const { settings } = useStore();
  const bedroom = bedroomCatchUp(date, settings.officeDays);
  const week = catchUp(date, settings.officeDays);
  const leftovers = bigCleanLeftovers(date, settings.officeDays);
  return (
    <>
      {bedroom && (
        <ChecklistCard
          title={`${bedroom.swap.bedroom.name}, from ${dayName(bedroom.day)}`}
          subtitle="Not finished yet: it stays here until it's done"
          items={bedroom.items}
          hideList={bedroom.swap.bedroom.name}
        />
      )}
      {week.length > 0 && (
        <ChecklistCard
          title="Catch up"
          subtitle="Missed earlier this week; it goes after Sunday (machine loads stay until done)"
          items={week}
          tone="bg-cream text-muted"
        />
      )}
      {leftovers && (
        <ChecklistCard
          title="Big clean leftovers"
          subtitle={`From ${shortDate(leftovers.saturday)}; here until ${shortDate(leftovers.until)}, then first in line next month`}
          items={leftovers.items}
          tone="bg-sun/30 text-ink"
        />
      )}
    </>
  );
}
