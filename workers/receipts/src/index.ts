// Meraki receipt reader: Meraki posts a receipt photo, Claude reads it and we
// return the shop, date, total and each item as JSON.
//
// POST /read   { image: "<base64 JPEG>" }   header  x-meraki-key: <passcode>
// -> 200 { shop, date, currency, total, discounts, items: [...] }

import Anthropic from "@anthropic-ai/sdk";
import { type PushEnv, pushConfigured, sendDuePushes } from "./push";

interface Env extends PushEnv {
  ANTHROPIC_API_KEY: string;
  MERAKI_KEY: string;
  ALLOWED_ORIGINS: string;
  // Meraki's Supabase project (public values), for the daily keep-alive below.
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

const MAX_IMAGE_BYTES = 4_000_000; // Meraki shrinks photos to ~200 KB; this is a safety cap

// What Claude must return. Structured outputs guarantee it matches.
const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shop", "date", "currency", "total", "discounts", "items", "readable"],
  properties: {
    readable: { type: "boolean", description: "false if this isn't a receipt or can't be read" },
    shop: { type: "string", description: "Shop name, short (e.g. 'Lidl', 'Alphamega')" },
    date: { type: "string", description: "Purchase date as YYYY-MM-DD, or '' if not shown" },
    currency: { type: "string", description: "ISO code, e.g. EUR" },
    total: { type: "number", description: "Total paid" },
    discounts: { type: "number", description: "Total discounts/offers as a positive number, 0 if none" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "original", "quantity", "unit_price", "price", "category"],
        properties: {
          name: { type: "string", description: "Clear English name, e.g. 'Whole milk 1L'" },
          original: { type: "string", description: "Exactly as printed on the receipt" },
          quantity: { type: "number", description: "Count, or weight in kg for weighed items" },
          unit_price: { type: ["number", "null"], description: "Price per unit/kg if shown" },
          price: { type: "number", description: "Line total actually charged" },
          category: { type: "string", enum: ["groceries", "household", "pet", "personal", "other"] },
        },
      },
    },
  },
} as const;

const PROMPT = `Read this shopping receipt (it may be in Greek or English, usually from Cyprus).
Return every purchased line item. Give each a short, clear English name (translate Greek), keep the printed text in "original".
Use the line total actually charged as "price". If a discount line applies to an item, subtract it from that item; put any remaining basket-level discounts in "discounts".
"category": groceries for food and drink; household for cleaning and home supplies; pet for anything for a dog; personal for toiletries, cosmetics and medicine; other otherwise.
If it isn't a receipt or you can't read it, set readable to false and leave the rest empty or 0.`;

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  return origin && allowed.includes(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, x-meraki-key",
        Vary: "Origin",
      }
    : {};
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json" } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(request.headers.get("Origin"), env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST" || new URL(request.url).pathname !== "/read") {
      return json({ error: "not found" }, 404, headers);
    }
    if (!headers["Access-Control-Allow-Origin"]) return json({ error: "origin not allowed" }, 403, headers);
    if (!env.MERAKI_KEY || request.headers.get("x-meraki-key") !== env.MERAKI_KEY) {
      return json({ error: "wrong passcode" }, 401, headers);
    }

    let image: string;
    try {
      ({ image } = (await request.json()) as { image: string });
    } catch {
      return json({ error: "send { image: base64 }" }, 400, headers);
    }
    if (!image || image.length * 0.75 > MAX_IMAGE_BYTES) return json({ error: "photo missing or too big" }, 400, headers);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    try {
      // Beta endpoint for the server-side fallback: if Claude Opus 5.5 ever
      // declines, the API retries on a fallback model in the same call.
      const params = {
        model: "claude-opus-5-5",
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {
          effort: "low", // reading a receipt is simple; keeps cost per receipt down
          format: { type: "json_schema", schema: RECEIPT_SCHEMA },
        },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      };
      // `fallbacks` may be newer than the SDK's type definitions, hence the cast.
      const response = await client.beta.messages.create(params as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);

      if (response.stop_reason === "refusal") return json({ error: "Couldn't read this receipt" }, 422, headers);
      if (response.stop_reason === "max_tokens") return json({ error: "Receipt too long to read in one go" }, 422, headers);
      const text = response.content.find((b) => b.type === "text");
      if (!text || text.type !== "text") return json({ error: "No result" }, 502, headers);
      const receipt = JSON.parse(text.text);
      if (!receipt.readable) return json({ error: "That doesn't look like a readable receipt" }, 422, headers);
      return json(receipt, 200, headers);
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError) return json({ error: "Busy, try again in a minute" }, 429, headers);
      if (err instanceof Anthropic.AuthenticationError) return json({ error: "Server API key is wrong" }, 500, headers);
      if (err instanceof Anthropic.APIError) return json({ error: `Claude error ${err.status}` }, 502, headers);
      return json({ error: "Something went wrong" }, 500, headers);
    }
  },

  // Every 5 minutes: send due phone reminders. This also keeps the free Supabase project from
  // pausing for being idle (before notifications are set up, a tiny query does that instead).
  async scheduled(_event: unknown, env: Env): Promise<void> {
    if (pushConfigured(env)) {
      await sendDuePushes(env);
      return;
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return;
    await fetch(`${env.SUPABASE_URL}/rest/v1/meraki_data?select=key&limit=1`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
    });
  },
};
