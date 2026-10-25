// Meraki phone notifications (Web Push).
// Every few minutes: read due reminders from Supabase (push_queue), send each to the user's devices
// (push_subscriptions), then mark them sent. Messages are encrypted for each device (RFC 8291,
// aes128gcm) and signed with Meraki's VAPID key (RFC 8292), using only WebCrypto.
// Encryption ported from PumpPal's push worker.

export interface PushEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string; // secret: Supabase > Project Settings > API Keys > secret key
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string; // secret
}

type QueueRow = { id: number; user_id: string; send_at: string; title: string; body: string; url: string; tag: string };
type Sub = { endpoint: string; user_id: string; p256dh: string; auth: string };

const enc = new TextEncoder();
const TOO_LATE_MS = 2 * 60 * 60 * 1000; // skip reminders more than 2 hours late (e.g. the worker was down)
// only real browser push services (Safari/iOS, Chrome/Android, Firefox, Edge)
const PUSH_SERVICE_HOSTS = /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;

export function pushConfigured(env: PushEnv) {
  return !!(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

function db(env: PushEnv, path: string, init: RequestInit = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.SUPABASE_SECRET_KEY!.trim(), "Content-Type": "application/json", Prefer: "return=minimal", ...init.headers },
  });
}

/** What one round did, for the logs and for /push-run. */
export type PushReport = { due: number; devices: number; results: number[]; marked: number | null; skippedLate: number };

export function pushSetup(env: PushEnv) {
  return {
    SUPABASE_URL: !!env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: !!env.SUPABASE_SECRET_KEY,
    // Shape only (never the key itself), to spot a bad paste: right kind, full length, no quotes.
    secretKeyShape: env.SUPABASE_SECRET_KEY
      ? {
          start: env.SUPABASE_SECRET_KEY.trim().slice(0, 10),
          length: env.SUPABASE_SECRET_KEY.trim().length,
          spaces: /s/.test(env.SUPABASE_SECRET_KEY.trim()),
          quotes: /["']/.test(env.SUPABASE_SECRET_KEY),
        }
      : null,
    VAPID_PUBLIC_KEY: !!env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: !!env.VAPID_PRIVATE_KEY,
  };
}

export async function sendDuePushes(env: PushEnv): Promise<PushReport> {
  const report: PushReport = { due: 0, devices: 0, results: [], marked: null, skippedLate: 0 };
  const now = new Date();
  const res = await db(env, `push_queue?sent=eq.false&send_at=lte.${now.toISOString()}&order=send_at&limit=200`, {
    headers: { Prefer: "" },
  });
  if (!res.ok) throw new Error(`queue ${res.status} ${await res.text()}`);
  const due = (await res.json()) as QueueRow[];
  report.due = due.length;

  if (due.length) {
    const users = [...new Set(due.map((r) => r.user_id))];
    const subsRes = await db(env, `push_subscriptions?user_id=in.(${users.join(",")})`, { headers: { Prefer: "" } });
    if (!subsRes.ok) throw new Error(`devices ${subsRes.status} ${await subsRes.text()}`);
    const subs = (await subsRes.json()) as Sub[];
    report.devices = subs.length;
    const gone = new Set<string>();

    for (const row of due) {
      if (now.getTime() - new Date(row.send_at).getTime() > TOO_LATE_MS) {
        report.skippedLate++;
        continue;
      }
      const payload = JSON.stringify({ title: row.title.slice(0, 80), body: row.body.slice(0, 200), url: row.url, tag: row.tag });
      for (const sub of subs.filter((s) => s.user_id === row.user_id && !gone.has(s.endpoint))) {
        try {
          const r = await sendWebPush(sub, payload, env);
          report.results.push(r.status);
          if (r.status === 404 || r.status === 410) gone.add(sub.endpoint);
          else if (!r.ok) console.error("Push service error", r.status, await r.text());
        } catch (e) {
          report.results.push(0);
          console.error("Push failed", e);
        }
      }
    }

    const marked = await db(env, `push_queue?id=in.(${due.map((r) => r.id).join(",")})`, { method: "PATCH", body: JSON.stringify({ sent: true }) });
    report.marked = marked.status;
    if (!marked.ok) console.error("Couldn't mark sent", marked.status, await marked.text());
    for (const endpoint of gone) await db(env, `push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE" });
  }

  // Tidy up: sent reminders older than three days.
  const old = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  await db(env, `push_queue?sent=eq.true&send_at=lt.${old}`, { method: "DELETE" });
  if (report.due) console.log("Push round", JSON.stringify(report));
  return report;
}

async function sendWebPush(sub: Sub, payload: string, env: PushEnv) {
  const endpoint = new URL(sub.endpoint);
  if (endpoint.protocol !== "https:" || !PUSH_SERVICE_HOSTS.test(endpoint.hostname)) throw new Error("Bad endpoint");
  const body = await encryptPayload(sub, enc.encode(payload));
  const jwt = await vapidJwt(env, `${endpoint.protocol}//${endpoint.host}`);
  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "3600",
      Urgency: "normal",
    },
    body,
  });
}

// ---------- RFC 8291 message encryption ----------
async function encryptPayload(sub: Sub, plaintext: Uint8Array) {
  const uaPublic = b64urlDecode(sub.p256dh);
  const authSecret = b64urlDecode(sub.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error("Bad subscription keys");

  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer);
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey } as unknown as Algorithm, local.privateKey, 256),
  );

  const ikm = await hkdf(authSecret, ecdhSecret, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // single record: content followed by the 0x02 "last record" delimiter
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, concat(plaintext, new Uint8Array([2]))));

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ciphertext);
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

// ---------- RFC 8292 VAPID ----------
async function vapidJwt(env: PushEnv, audience: string) {
  const pub = b64urlDecode(env.VAPID_PUBLIC_KEY!);
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: b64urlEncode(pub.slice(1, 33)), y: b64urlEncode(pub.slice(33, 65)), d: env.VAPID_PRIVATE_KEY!.trim() },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: "https://ioannak77.github.io/meraki/" })),
  );
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`)));
  return `${header}.${claims}.${b64urlEncode(signature)}`;
}

// ---------- helpers ----------
function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function b64urlDecode(str: string) {
  const b64 = String(str).trim().replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function b64urlEncode(bytes: Uint8Array) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
