// Sync between devices through Supabase (table meraki_data, see supabase/schema.sql).
//
// Each store keeps its whole state under one localStorage key and calls markSaved() after
// writing it. Changed keys are pushed a moment later; remote changes are pulled when the app
// opens, comes back to the front, or every two minutes. If both sides changed, the changes are
// merged item by item (merge.ts).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { merge3 } from "./merge";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./syncConfig";

export const SYNCED_KEYS = ["meraki.v1", "meraki.finance.v1", "meraki.skin.v1", "meraki.groceries.v1"];
// Kept outside the "meraki." prefix so backups don't carry it.
const META_KEY = "merakiSync.meta";
// What each key looked like at the last sync, so changes made on two devices can be merged.
const BASE_PREFIX = "merakiSync.base.";
const readBase = (key: string) => localStorage.getItem(BASE_PREFIX + key);
const writeBase = (key: string, value: string) => {
  try {
    localStorage.setItem(BASE_PREFIX + key, value);
  } catch {}
};

type KeyMeta = { hash: string; remoteAt: string | null; editedAt: string | null };
type Meta = { userId: string; lastSync: string | null; keys: Record<string, KeyMeta> };
type Row = { key: string; value: string; updated_at: string };

export type SyncState =
  | { status: "off" } // not set up in syncConfig.ts
  | { status: "signed-out" }
  | { status: "choose"; email: string } // first sync on this device and the cloud already has data
  | { status: "on"; email: string; lastSync: string | null; error: string | null; busy: boolean };

export const syncConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
let client: SupabaseClient | null = null;
export function supabase() {
  if (!client && syncConfigured) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}

function readMeta(): Meta | null {
  try {
    return JSON.parse(localStorage.getItem(META_KEY) ?? "null");
  } catch {
    return null;
  }
}
function writeMeta(m: Meta) {
  localStorage.setItem(META_KEY, JSON.stringify(m));
}

// --- state for the Settings card -------------------------------------------------------------

let state: SyncState = { status: syncConfigured ? "signed-out" : "off" };
const listeners = new Set<() => void>();
function setState(s: SyncState) {
  state = s;
  listeners.forEach((l) => l());
}
export function subscribeSync(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function getSyncState() {
  return state;
}
const OFF: SyncState = { status: "off" };
export function getServerSyncState() {
  return OFF;
}

let currentUser: string | null = null;
let currentEmail = "";
/** The signed-in session's token (for the receipt reader), or null. */
export async function accessToken() {
  const { data } = (await supabase()?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.access_token ?? null;
}
/** The signed-in user, or null. */
export function syncUserId() {
  return currentUser;
}
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

function setOn(patch: { lastSync?: string | null; error?: string | null; busy?: boolean } = {}) {
  const prev = state.status === "on" ? state : null;
  setState({
    status: "on",
    email: currentEmail,
    lastSync: patch.lastSync !== undefined ? patch.lastSync : (prev?.lastSync ?? readMeta()?.lastSync ?? null),
    error: patch.error !== undefined ? patch.error : (prev?.error ?? null),
    busy: patch.busy ?? false,
  });
}

// --- the sync itself -------------------------------------------------------------------------

/** Stores call this after writing their key to localStorage. */
export function markSaved(key: string) {
  if (!currentUser) return;
  const meta = readMeta();
  if (!meta || meta.userId !== currentUser) return;
  const value = localStorage.getItem(key);
  if (value === null) return;
  const km = meta.keys[key];
  if (km && km.hash === hash(value)) return;
  meta.keys[key] = { hash: km?.hash ?? "", remoteAt: km?.remoteAt ?? null, editedAt: new Date().toISOString() };
  writeMeta(meta);
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void syncNow(), 1500);
}

async function fetchRows(): Promise<Row[]> {
  const { data, error } = await supabase()!.from("meraki_data").select("key, value, updated_at");
  if (error) throw error;
  return data as Row[];
}

async function pushKey(meta: Meta, key: string) {
  const value = localStorage.getItem(key);
  if (value === null) return;
  const { data, error } = await supabase()!
    .from("meraki_data")
    .upsert({ user_id: currentUser, key, value }, { onConflict: "user_id,key" })
    .select("updated_at")
    .single();
  if (error) throw error;
  meta.keys[key] = { hash: hash(value), remoteAt: (data as { updated_at: string }).updated_at, editedAt: null };
  writeBase(key, value);
}

/** True while you're typing in a field. */
function typing() {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el as HTMLElement).isContentEditable);
}

/** Pull remote changes, push local ones. Restarts the app if anything came down. */
export async function syncNow() {
  if (!currentUser || running || !navigator.onLine) return;
  // Never sync under your fingers: anything that came down would be overwritten by what's on
  // screen when you save. Try again shortly instead.
  if (typing()) {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void syncNow(), 15_000);
    return;
  }
  const meta = readMeta();
  if (!meta || meta.userId !== currentUser) return;
  running = true;
  setOn({ busy: true });
  try {
    const rows = await fetchRows();
    let pulled = false;
    for (const key of SYNCED_KEYS) {
      const row = rows.find((r) => r.key === key);
      const local = localStorage.getItem(key);
      const km = meta.keys[key] ?? { hash: "", remoteAt: null, editedAt: null };
      const localChanged = local !== null && hash(local) !== km.hash;
      const remoteChanged = !!row && row.updated_at !== km.remoteAt;
      const base = readBase(key);
      if (row && remoteChanged && localChanged && base !== null) {
        // Both devices changed this since they last agreed: keep both sets of changes.
        const merged = JSON.stringify(merge3(JSON.parse(base), JSON.parse(local!), JSON.parse(row.value)));
        localStorage.setItem(key, merged);
        await pushKey(meta, key);
        pulled = true;
      } else if (row && remoteChanged && (!localChanged || !km.editedAt || row.updated_at > km.editedAt)) {
        localStorage.setItem(key, row.value);
        meta.keys[key] = { hash: hash(row.value), remoteAt: row.updated_at, editedAt: null };
        writeBase(key, row.value);
        pulled = true;
      } else if (localChanged) {
        await pushKey(meta, key);
      }
      writeMeta(meta);
    }
    meta.lastSync = new Date().toISOString();
    writeMeta(meta);
    setOn({ lastSync: meta.lastSync, error: null });
    // The stores read localStorage when they start, so restart the app to show what came down.
    if (pulled) location.reload();
  } catch {
    setOn({ error: "Couldn't sync. It will try again when you're back online." });
  } finally {
    running = false;
  }
}

/** First sync on this device: start from the cloud's data or from this device's. */
export async function chooseStart(from: "cloud" | "device") {
  if (!currentUser) return;
  const meta: Meta = { userId: currentUser, lastSync: null, keys: {} };
  // "device": mark every key as edited after anything in the cloud, so they all go up.
  if (from === "device") for (const key of SYNCED_KEYS) meta.keys[key] = { hash: "", remoteAt: "", editedAt: "9999" };
  writeMeta(meta);
  setOn();
  await syncNow();
}

async function onSignedIn(userId: string, email: string) {
  currentUser = userId;
  currentEmail = email;
  if (readMeta()?.userId === userId) {
    setOn();
    await syncNow();
    return;
  }
  // New on this device. If the cloud is empty, this device's data goes up.
  try {
    const rows = await fetchRows();
    if (rows.length === 0) await chooseStart("device");
    else setState({ status: "choose", email });
  } catch {
    setState({ status: "choose", email });
  }
}

let started = false;
/** Called once when the app starts. */
export function startSync() {
  const sb = supabase();
  if (started || !sb) return;
  started = true;
  sb.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      // Supabase calls back inside its own lock: start the sync after it returns.
      if (session.user.id !== currentUser) setTimeout(() => void onSignedIn(session.user.id, session.user.email ?? ""), 0);
    } else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
      currentUser = null;
      setState({ status: "signed-out" });
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncNow();
  });
  // A device left open (the computer) also checks every two minutes, so it doesn't fall behind.
  setInterval(() => {
    if (document.visibilityState === "visible") void syncNow();
  }, 120_000);
  window.addEventListener("online", () => void syncNow());
}

/** Returns a message to show, or null when signed in. */
export async function signIn(email: string, password: string, create: boolean) {
  const sb = supabase()!;
  const { data, error } = create
    ? await sb.auth.signUp({ email, password })
    : await sb.auth.signInWithPassword({ email, password });
  if (error) return error.message;
  if (!data.session) return "Check your email and tap the link to confirm, then sign in here.";
  return null;
}

export async function signOut() {
  await supabase()?.auth.signOut();
  localStorage.removeItem(META_KEY);
  for (const key of SYNCED_KEYS) localStorage.removeItem(BASE_PREFIX + key);
}
