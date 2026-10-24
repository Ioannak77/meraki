// Phone notifications (Web Push). Each device subscribes once; the reminders themselves are
// planned by pushSchedule.ts and sent by the meraki worker (workers/receipts).

import { BASE } from "./base";
import type { QueueItem } from "./pushSchedule";
import { supabase, syncUserId } from "./sync";

/** Public half of the VAPID key (the private half is a secret on the worker). */
export const VAPID_PUBLIC_KEY = "BGMF5XwqcfcJW-5inuhCMcIOT8q3JiKS54xslOSszGBjlNBxZenUsNga08ExSYysiFeK14OVheYqpEuHlg46JZg";

export type PushSupport = "ok" | "add-to-home-screen" | "unsupported";

export function pushSupport(): PushSupport {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // iPhone and iPad only allow notifications for apps opened from the home screen.
  if (ios && !standalone) return "add-to-home-screen";
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window ? "ok" : "unsupported";
}

function keyBytes(b64url: string) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration(`${BASE}/`);
  return existing ?? navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` });
}

export async function deviceSubscribed() {
  if (pushSupport() !== "ok" || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration(`${BASE}/`);
  return !!(await reg?.pushManager.getSubscription());
}

/** Ask for permission and save this device. Returns an error message, or null when it worked. */
export async function enablePush(): Promise<string | null> {
  const sb = supabase();
  if (!sb || !syncUserId()) return "Sign in under Sync first, so your reminders can reach this device.";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "Notifications are blocked. Allow them for Meraki in your phone's Settings, then try again.";
  try {
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
    const json = sub.toJSON();
    const { error } = await sb.from("push_subscriptions").upsert({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      updated_at: new Date().toISOString(),
    });
    return error ? "Couldn't save this device. Check your internet and try again." : null;
  } catch {
    return "This device couldn't turn on notifications.";
  }
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration(`${BASE}/`);
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase()?.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

/** A test notification, sent with the worker's next round (within 5 minutes). */
export async function sendTestPush() {
  const sb = supabase();
  if (!sb || !syncUserId()) return false;
  const { error } = await sb.from("push_queue").insert({
    send_at: new Date().toISOString(),
    title: "Meraki is all set 🌿",
    body: "Notifications are working. You're doing great!",
    url: `${BASE}/`,
    tag: "test",
  });
  return !error;
}

/** Replace the upcoming reminders with a new list. */
export async function uploadQueue(items: QueueItem[]) {
  const sb = supabase();
  if (!sb || !syncUserId()) return false;
  const { error } = await sb.rpc("meraki_replace_queue", { items });
  return !error;
}
