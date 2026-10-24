"use client";

// Settings > Notifications: turn on phone reminders and choose which ones.

import { useEffect, useState, useSyncExternalStore } from "react";
import { deviceSubscribed, disablePush, enablePush, pushSupport, type PushSupport } from "@/lib/push";
import { DEFAULT_PUSH, useStore, type PushPrefs } from "@/lib/store";
import { getServerSyncState, getSyncState, subscribeSync } from "@/lib/sync";
import { Icon } from "./icons";

const KINDS: { id: keyof PushPrefs; label: string; note: string }[] = [
  { id: "morning", label: "Morning plan", note: "Today's tasks and cleaning, in one message" },
  { id: "skincare", label: "Skincare times", note: "At your morning and evening skincare times" },
  { id: "care", label: "Self care reminders", note: "When waxing, nails, hair and the rest are due" },
  { id: "bills", label: "Bills due", note: "The evening before, and on the day" },
  { id: "kind", label: "Kind words", note: "A little affirmation every afternoon 💛" },
];

export function NotificationsCard() {
  const { settings, updateSettings } = useStore();
  const sync = useSyncExternalStore(subscribeSync, getSyncState, getServerSyncState);
  const prefs = { ...DEFAULT_PUSH, ...settings.push };
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [here, setHere] = useState(false); // this device gets notifications
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      setSupport(pushSupport());
      setHere(await deviceSubscribed());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  if (sync.status === "off" || support === null) return null;
  const set = (patch: Partial<PushPrefs>) => updateSettings({ push: { ...prefs, ...patch } });

  async function turnOn() {
    setBusy(true);
    const error = await enablePush();
    setBusy(false);
    setMessage(error);
    if (!error) {
      setHere(true);
      set({ on: true });
    }
  }

  return (
    <section className="mt-5 rounded-3xl bg-card p-5">
      <h2 className="text-lg font-bold">Notifications</h2>

      {sync.status !== "on" ? (
        <p className="text-[15px] text-muted">Sign in under Sync first. Your reminders are sent from there to each of your devices.</p>
      ) : support === "add-to-home-screen" ? (
        <p className="text-[15px] text-muted">
          On iPhone and iPad, notifications only work in the home screen app. Open Meraki from your home screen and turn them on
          there.
        </p>
      ) : support === "unsupported" ? (
        <p className="text-[15px] text-muted">This browser can&apos;t show notifications.</p>
      ) : here ? (
        <p className="text-sm font-semibold text-sage-dark">On for this device ✓</p>
      ) : (
        <>
          <p className="text-[15px] text-muted">Gentle reminders on this device, even when Meraki is closed.</p>
          <button disabled={busy} onClick={turnOn} className="mt-4 w-full rounded-2xl bg-sage-dark py-3 font-bold text-white">
            Turn on notifications
          </button>
        </>
      )}

      {sync.status === "on" && prefs.on && (
        <>
          <ul className="mt-3 divide-y divide-line">
            {KINDS.map((k) => {
              const on = prefs[k.id] === true;
              return (
                <li key={k.id}>
                  <button
                    type="button"
                    onClick={() => set({ [k.id]: !on })}
                    aria-pressed={on}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-lg border-2 ${on ? "border-sage bg-sage text-white" : "border-line bg-card"}`}
                    >
                      {on && <Icon.check className="size-4" />}
                    </span>
                    <span className="flex-1">
                      <span className="block text-[15px]">{k.label}</span>
                      <span className="block text-[13px] text-muted">{k.note}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {prefs.morning && (
            <label className="mt-2 flex items-center justify-between text-[15px]">
              Morning plan at
              <input
                type="time"
                value={prefs.morningTime}
                onChange={(e) => e.target.value && set({ morningTime: e.target.value })}
                className="rounded-xl border border-line bg-cream px-3 py-2"
              />
            </label>
          )}
          <p className="mt-3 text-[13px] text-muted">
            Skincare times come from Self care. Every device with notifications on gets the same reminders.
          </p>
          {here && (
            <button
              onClick={async () => {
                await disablePush();
                setHere(false);
              }}
              className="mt-3 text-sm font-semibold text-muted underline"
            >
              Stop notifications on this device
            </button>
          )}
        </>
      )}

      {message && <p className="mt-3 text-[13px] text-peach">{message}</p>}
    </section>
  );
}
