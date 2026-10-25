"use client";

// Settings: a short, grouped list. Each row shows how things stand; tap it to change it.

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BackupCard } from "@/components/BackupCard";
import { HomeScreenCard } from "@/components/HomeScreenCard";
import { MoneySettingsCard } from "@/components/finance/SettingsCard";
import { Sheet } from "@/components/finance/ui";
import { Icon, type IconName } from "@/components/icons";
import { NotificationsCard } from "@/components/NotificationsCard";
import { SyncCard } from "@/components/SyncCard";
import { TodayCardsSettings } from "@/components/TodayCardsSettings";
import { WEEKDAYS, formatMinutes, plannedMinutes, weeklyPlan } from "@/lib/cleaning";
import { DEFAULT_PUSH, TODAY_CARDS, useStore } from "@/lib/store";
import { getServerSyncState, getSyncState, subscribeSync } from "@/lib/sync";

type Panel = "home" | "notifications" | "today" | "office" | "money" | "sync" | "backup";

const TITLES: Record<Panel, string> = {
  home: "Add to your home screen",
  notifications: "Notifications",
  today: "Today screen",
  office: "Office days",
  money: "Money",
  sync: "Sync",
  backup: "Backup",
};

function daysAgo(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  const days = Math.round(
    (new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000,
  );
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

export default function SettingsPage() {
  const { ready, settings } = useStore();
  const sync = useSyncExternalStore(subscribeSync, getSyncState, getServerSyncState);
  const [open, setOpen] = useState<Panel | null>(null);
  const [installed, setInstalled] = useState(true);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setInstalled(
        window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
      );
      try {
        setLastBackup(localStorage.getItem("meraki.backup.last"));
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  if (!ready) return null;

  const push = { ...DEFAULT_PUSH, ...settings.push };
  const shownCards = TODAY_CARDS.length - (settings.todayHidden ?? []).filter((h) => TODAY_CARDS.some((c) => c.id === h)).length;
  const office = settings.officeDays;

  const syncStatus =
    sync.status === "on"
      ? sync.error
        ? "Couldn't sync, will retry"
        : `Signed in · ${sync.email}`
      : sync.status === "choose"
        ? "Choose which data to keep"
        : sync.status === "signed-out"
          ? "Not signed in"
          : "Off";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[26px] font-bold md:mt-4 md:text-3xl">Settings</h1>

      {!installed && (
        <Group title="Phone">
          <Row icon="home" tone="bg-sage-soft text-sage-dark" label="Add to your home screen" note="Opens like an app, works offline" onClick={() => setOpen("home")} />
        </Group>
      )}

      <Group title="Reminders">
        <Row
          icon="bolt"
          tone="bg-sun/20 text-sun"
          label="Notifications"
          note={push.on ? "On" : "Off"}
          attention={sync.status === "on" && !push.on}
          onClick={() => setOpen("notifications")}
        />
        <LinkRow href="/self-care/#reminders" icon="heart" tone="bg-rose-soft text-rose" label="Self-care reminders" note="Waxing, nails, hair…" />
      </Group>

      <Group title="Your days">
        <Row
          icon="home"
          tone="bg-sky-soft text-sky"
          label="Today screen"
          note={`${shownCards} of ${TODAY_CARDS.length} cards shown`}
          onClick={() => setOpen("today")}
        />
        <Row
          icon="briefcase"
          tone="bg-peach-soft text-peach"
          label="Office days"
          note={office.length ? office.map((d) => WEEKDAYS[d].slice(0, 3)).join(", ") : "None"}
          onClick={() => setOpen("office")}
        />
        <LinkRow href="/cleaning/" icon="routines" tone="bg-sage-soft text-sage-dark" label="Cleaning lists" note="Edit them in Cleaning schedule › Edit" />
        <LinkRow href="/self-care/#skincare" icon="sun" tone="bg-rose-soft text-rose" label="Skincare" note="Morning and evening steps and times" />
      </Group>

      <Group title="Money">
        <Row icon="wallet" tone="bg-peach-soft text-peach" label="Money" note="What you track, income, categories" onClick={() => setOpen("money")} />
      </Group>

      <Group title="Your data">
        <Row
          icon="routines"
          tone="bg-sky-soft text-sky"
          label="Sync"
          note={syncStatus}
          attention={sync.status === "signed-out" || sync.status === "choose" || (sync.status === "on" && !!sync.error)}
          onClick={() => setOpen("sync")}
        />
        <Row
          icon="note"
          tone="bg-sage-soft text-sage-dark"
          label="Backup"
          note={lastBackup ? `Last backup: ${daysAgo(lastBackup)}` : "No backup yet"}
          onClick={() => setOpen("backup")}
        />
      </Group>

      {open && (
        <Sheet title={TITLES[open]} onClose={() => setOpen(null)}>
          {/* The cards are full cards on their own; inside the sheet, drop their frame and title. */}
          <div className="pb-4 [&>section]:mt-0 [&>section]:bg-transparent [&>section]:p-0 [&>section>h2:first-child]:hidden">
            {open === "home" && <HomeScreenCard />}
            {open === "notifications" && <NotificationsCard />}
            {open === "today" && <TodayCardsSettings />}
            {open === "office" && <OfficeDays />}
            {open === "money" && <MoneySettingsCard />}
            {open === "sync" && <SyncCard />}
            {open === "backup" && <BackupCard />}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">{title}</h2>
      <ul className="divide-y divide-line rounded-3xl bg-card px-4">{children}</ul>
    </section>
  );
}

function RowBody({ icon, tone, label, note, attention }: { icon: IconName; tone: string; label: string; note: string; attention?: boolean }) {
  const I = Icon[icon];
  return (
    <>
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone}`}>
        <I className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{label}</span>
        <span className={`block truncate text-[13px] ${attention ? "font-semibold text-peach" : "text-muted"}`}>{note}</span>
      </span>
      <span className="text-muted">›</span>
    </>
  );
}

function Row(props: { icon: IconName; tone: string; label: string; note: string; attention?: boolean; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={props.onClick} className="flex w-full items-center gap-3 py-3 text-left">
        <RowBody {...props} />
      </button>
    </li>
  );
}

function LinkRow(props: { href: string; icon: IconName; tone: string; label: string; note: string }) {
  return (
    <li>
      <Link href={props.href} className="flex items-center gap-3 py-3">
        <RowBody {...props} />
      </Link>
    </li>
  );
}

/** Office days, and the cleaning week they make. */
function OfficeDays() {
  const { settings, updateSettings } = useStore();
  const office = settings.officeDays;
  const plan = weeklyPlan(office);

  function toggleDay(day: number) {
    const next = office.includes(day) ? office.filter((d) => d !== day) : [...office, day].sort();
    updateSettings({ officeDays: next });
  }

  return (
    <>
      <p className="text-[15px] text-muted">
        On these days you get the lighter weekly cleaning lists. Heavier ones move to a home day automatically.
      </p>
      <div className="mt-4 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((name, day) => {
          const on = office.includes(day);
          return (
            <button
              key={name}
              onClick={() => toggleDay(day)}
              aria-pressed={on}
              aria-label={name}
              className={`rounded-2xl py-3 text-sm font-semibold transition-colors ${on ? "bg-sage-dark text-white" : "bg-cream text-ink/70"}`}
            >
              {name.slice(0, 3)}
            </button>
          );
        })}
      </div>

      <h3 className="mt-6 text-sm font-semibold text-muted">Your cleaning week</h3>
      <ul className="mt-1 divide-y divide-line">
        {plan.map((slot, day) => (
          <li key={day} className="flex items-center gap-3 py-2.5 text-[15px]">
            <span className={`w-24 shrink-0 ${office.includes(day) ? "font-bold text-sage-dark" : "text-muted"}`}>{WEEKDAYS[day]}</span>
            <span className="flex-1">
              {slot.routine.name}
              {slot.movedFrom !== undefined && <span className="text-sm text-muted"> · moved from {WEEKDAYS[slot.movedFrom]}</span>}
            </span>
            <span className="text-xs text-muted">~{formatMinutes(plannedMinutes(slot.routine))}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
