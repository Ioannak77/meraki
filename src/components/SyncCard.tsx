"use client";

// Settings > Sync: sign in on each device to keep phone and iPad the same.

import { useState, useSyncExternalStore } from "react";
import { chooseStart, getServerSyncState, getSyncState, signIn, signOut, subscribeSync, syncNow } from "@/lib/sync";

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

export function SyncCard() {
  const state = useSyncExternalStore(subscribeSync, getSyncState, getServerSyncState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === "off") return null;

  async function submit(create: boolean) {
    if (!email.trim() || password.length < 8) {
      setMessage("Enter your email and a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    setMessage(await signIn(email.trim(), password, create));
    setBusy(false);
  }

  const input = "mt-1 w-full rounded-2xl border border-line bg-cream px-4 py-3 text-base outline-none focus:border-sage";

  return (
    <section className="mt-5 rounded-3xl bg-card p-5">
      <h2 className="text-lg font-bold">Sync</h2>

      {state.status === "signed-out" && (
        <>
          <p className="text-[15px] text-muted">
            Sign in on your phone and iPad with the same email to keep them the same. Changes go across when you open the app.
          </p>
          <label className="mt-4 block text-sm font-semibold text-muted">
            Email
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </label>
          <label className="mt-3 block text-sm font-semibold text-muted">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={input}
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button disabled={busy} onClick={() => submit(false)} className="flex-1 rounded-2xl bg-sage-dark py-3 font-bold text-white">
              Sign in
            </button>
            <button disabled={busy} onClick={() => submit(true)} className="flex-1 rounded-2xl bg-sage-soft py-3 font-bold text-sage-dark">
              Create account
            </button>
          </div>
        </>
      )}

      {state.status === "choose" && (
        <>
          <p className="text-[15px] text-muted">
            Signed in as <strong>{state.email}</strong>. Your account already has data from another device. Which should this
            device use?
          </p>
          <button onClick={() => chooseStart("cloud")} className="mt-4 w-full rounded-2xl bg-sage-dark py-3 font-bold text-white">
            Use my other device&apos;s data
          </button>
          <button
            onClick={() => {
              if (confirm("Replace what's saved in your account with this device's data?")) void chooseStart("device");
            }}
            className="mt-2 w-full rounded-2xl bg-sage-soft py-3 font-bold text-sage-dark"
          >
            Keep this device&apos;s data
          </button>
        </>
      )}

      {state.status === "on" && (
        <>
          <p className="text-[15px] text-muted">
            Signed in as <strong>{state.email}</strong>.
          </p>
          <p className={`mt-2 text-sm font-semibold ${state.error ? "text-peach" : "text-sage-dark"}`}>
            {state.error ?? (state.busy ? "Syncing…" : state.lastSync ? `Synced ${ago(state.lastSync)}` : "Not synced yet")}
          </p>
          <div className="mt-4 flex gap-2">
            <button onClick={() => void syncNow()} className="flex-1 rounded-2xl bg-sage-dark py-3 font-bold text-white">
              Sync now
            </button>
            <button
              onClick={() => {
                if (confirm("Sign out? Meraki stays on this device but stops syncing.")) void signOut();
              }}
              className="flex-1 rounded-2xl bg-sage-soft py-3 font-bold text-sage-dark"
            >
              Sign out
            </button>
          </div>
        </>
      )}

      {message && <p className="mt-3 text-[13px] text-muted">{message}</p>}
    </section>
  );
}
