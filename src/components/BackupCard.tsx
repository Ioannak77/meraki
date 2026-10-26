"use client";

// Settings > Backup: save everything to one file, and load it back (new phone, iPad, home screen app).

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getServerSyncState, getSyncState, subscribeSync } from "@/lib/sync";
import { dayKey } from "@/lib/store";

const PREFIX = "meraki.";
const LAST_KEY = "meraki.backup.last";

type Backup = { app: "meraki"; version: 1; savedAt: string; data: Record<string, string> };

function collect(): Backup {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith(PREFIX) && k !== LAST_KEY) data[k] = localStorage.getItem(k)!;
  }
  return { app: "meraki", version: 1, savedAt: new Date().toISOString(), data };
}

function daysAgo(iso: string) {
  const days = Math.round((new Date(dayKey()).getTime() - new Date(dayKey(new Date(iso))).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

export function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [last, setLast] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const synced = useSyncExternalStore(subscribeSync, getSyncState, getServerSyncState).status === "on";

  useEffect(() => {
    const t = setTimeout(() => setLast(localStorage.getItem(LAST_KEY)), 0);
    return () => clearTimeout(t);
  }, []);

  async function save() {
    const backup = collect();
    const name = `meraki-backup-${dayKey()}.json`;
    const file = new File([JSON.stringify(backup)], name, { type: "application/json" });
    try {
      // Phones: the share sheet lets you save to Files, iCloud Drive or send it to yourself.
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Meraki backup" });
      else {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // closed the share sheet
      setMessage("Couldn't save the backup. Try again.");
      return;
    }
    localStorage.setItem(LAST_KEY, backup.savedAt);
    setLast(backup.savedAt);
    setMessage("Backup saved.");
  }

  async function load(file: File) {
    let backup: Backup;
    try {
      backup = JSON.parse(await file.text());
      if (backup.app !== "meraki" || typeof backup.data !== "object") throw new Error();
    } catch {
      setMessage("That file isn't a Meraki backup.");
      return;
    }
    const when = new Date(backup.savedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    if (!confirm(`Load the backup from ${when}? It replaces everything in Meraki on this device.`)) return;
    for (const k of Object.keys(collect().data)) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(backup.data)) if (k.startsWith(PREFIX)) localStorage.setItem(k, v);
    location.reload();
  }

  return (
    <section className="mt-5 rounded-3xl bg-card p-5">
      <h2 className="text-lg font-bold">Backup</h2>
      <p className="text-[15px] text-muted">
        Everything is kept on this device only. Save a backup now and then, and use it to move Meraki to a new phone or iPad.
      </p>
      <p className={`mt-2 text-sm font-semibold ${last || synced ? "text-sage-dark" : "text-peach"}`}>
        {last ? `Last backup: ${daysAgo(last)}` : synced ? "Sync keeps your data safe, so a backup is an extra" : "No backup yet"}
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={save} className="flex-1 rounded-2xl bg-sage-dark py-3 font-bold text-white">
          Save backup
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex-1 rounded-2xl bg-sage-soft py-3 font-bold text-sage-dark">
          Load backup
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) load(f);
        }}
      />
      {message && <p className="mt-3 text-[13px] text-muted">{message}</p>}
    </section>
  );
}
