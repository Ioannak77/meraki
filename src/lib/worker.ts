// The meraki worker (workers/receipts): reads receipts and gives money advice, using Claude.
// It only answers someone signed in to Meraki (Settings > Sync).

import { accessToken } from "./sync";

const WORKER_URL = "https://meraki.constantinouioanna7.workers.dev";

/** POST to the worker. Throws an Error with a friendly message. */
export async function workerPost<T>(path: string, body: unknown, what: string): Promise<T> {
  const token = await accessToken();
  if (!token) throw new Error(`Sign in under Settings → Sync to use the ${what}.`);
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Couldn't reach the ${what}. Check your connection and try again.`);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `The ${what} said no (${res.status}).`);
  return data;
}
