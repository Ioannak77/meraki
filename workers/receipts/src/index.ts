// Meraki's worker. Only answers someone signed in to Meraki (Authorization: Bearer <Supabase token>).
//
// POST /read     { image: "<base64 JPEG>" }
// -> 200 { shop, date, currency, total, discounts, items: [...] }   Claude reads a receipt.
// POST /advise   { summary: {...money summary...}, question: "" }
// -> 200 { headline, going_well, watch, suggestions, answer }     Claude looks over the money.
// POST /statement { pdf: "<base64 PDF>", categories: [{ id, label }] }
// -> 200 { bank, currency, lines: [{ date, description, amount, own_transfer, category, abroad, subscription }] }
//    Claude reads a bank statement and suggests a category for each line.
// POST /push-run  {}  -> 200 { setup, report | error }   Sends due reminders now and says how it went.
//
// Plus a cron that sends due phone reminders (push.ts).

import Anthropic from "@anthropic-ai/sdk";
import { type PushEnv, pushConfigured, pushSetup, sendDuePushes } from "./push";

interface Env extends PushEnv {
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGINS: string;
  // Meraki's Supabase project (public values), for the daily keep-alive below.
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

const MAX_IMAGE_BYTES = 4_000_000; // Meraki shrinks photos to ~200 KB; this is a safety cap
const MAX_PDF_BYTES = 15_000_000; // a few months of statement is well under 1 MB

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

// What a bank statement must come back as. Categories are the person's own list, so the schema is built per request.
const statementSchema = (categoryIds: string[]) => ({
  type: "object",
  additionalProperties: false,
  required: ["readable", "bank", "currency", "lines"],
  properties: {
    readable: { type: "boolean", description: "false if this isn't a bank or card statement, or can't be read" },
    bank: { type: "string", description: "Short bank name, e.g. 'Revolut', 'Bank of Cyprus'" },
    currency: { type: "string", description: "ISO code of the account, e.g. EUR" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "description", "amount", "own_transfer", "category", "abroad", "subscription", "details"],
        properties: {
          date: { type: "string", description: "Transaction date as YYYY-MM-DD" },
          description: { type: "string", description: "Merchant or payee as printed, tidied (no card numbers or reference codes)" },
          amount: { type: "number", description: "Negative for money out, positive for money in, in the account currency" },
          own_transfer: {
            type: "boolean",
            description: "true for money moving between the person's own accounts: top-ups, transfers to or from their other bank, savings vaults or pockets, currency exchanges",
          },
          category: { type: "string", enum: [...categoryIds, "unsure"], description: "Best category id for this line, or 'unsure'" },
          abroad: { type: "boolean", description: "true if paid in person while travelling outside Cyprus (shops, restaurants, transport, hotels abroad)" },
          subscription: {
            type: "string",
            enum: ["no", "monthly", "yearly"],
            description: "monthly or yearly if this is a recurring subscription or membership payment, otherwise no",
          },
          details: {
            type: "array",
            description: "Everything else printed about this line, as short label/value pairs in English",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "value"],
              properties: { label: { type: "string" }, value: { type: "string" } },
            },
          },
        },
      },
    },
  },
});

const STATEMENT_PROMPT = `This is a bank or card statement, usually from Cyprus (Revolut or Bank of Cyprus; it may be in Greek or English).
Return every completed transaction, in date order. Leave out opening and closing balances, running balance figures, totals and subtotals, fees summaries, and pending or reverted card payments.
Use the transaction date (not the value date) as YYYY-MM-DD; when the year isn't printed on a line, take it from the statement period.
Give money out as a negative amount and money in as positive, in the account's currency.
Keep each description short and recognisable: the merchant or person as printed, without card numbers, terminal IDs or long reference codes. Translate nothing.
Set own_transfer to true for money moving between the person's own accounts: card or bank top-ups, transfers to or from their other bank account (e.g. Revolut <-> Bank of Cyprus), savings vaults or pockets, and currency exchanges. Payments to other people and shops are false.
For "category", pick the best fitting id from the list you're given; use "unsure" rather than guessing. Salary and refunds from shops are income; money in from a person (a friend sending their share, e.g. "Transfer from Maria", "Payment from …") is paid_back when that id is in the list; recurring household bills (rent, electricity, water, internet, phone, insurance) are bills.
In "details", list what else the statement prints for the line, each as a short label and value: the full text as printed (label "As printed"), time, payment type (card payment, transfer, direct debit…), card, original amount and currency, exchange rate, fee, location, counterparty or IBAN, reference. Leave out the date and amount already given, and anything not printed. Use an empty list if there is nothing more.
Set abroad to true only for payments made in person while travelling outside Cyprus (shops, restaurants, taxis, hotels in another country). Online services billed from abroad are not abroad.
Set subscription to monthly or yearly for recurring services and memberships (streaming, music, cloud storage, apps, gym, software); otherwise no.
If it isn't a statement or you can't read it, set readable to false and leave lines empty.`;

// What the money advice must look like.
const ADVICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "going_well", "watch", "suggestions", "answer"],
  properties: {
    headline: { type: "string", description: "One kind, honest sentence: how things look overall" },
    going_well: { type: "array", items: { type: "string" }, description: "2-4 things going well, with numbers" },
    watch: { type: "array", items: { type: "string" }, description: "1-4 things worth watching, with numbers" },
    suggestions: {
      type: "array",
      description: "2-5 small, concrete things to try, most useful first",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "saves_per_month"],
        properties: {
          title: { type: "string", description: "Short action, e.g. 'Cancel the second streaming plan'" },
          detail: { type: "string", description: "1-2 sentences: why, and the first step" },
          saves_per_month: { type: ["number", "null"], description: "Estimated euros saved a month, or null" },
        },
      },
    },
    answer: { type: "string", description: "Direct answer to the question, or '' if there was no question" },
  },
} as const;

const ADVICE_SYSTEM = `You are Meraki's money coach for one person in Cyprus who has ADHD. You get a JSON summary of their money: income, bills, spending by month and category (the newest month may be partial), budgets, savings goals, and groceries from receipts. All amounts are in euros.

Look over everything and give practical, specific budgeting advice based only on these numbers. Quote the real figures. Prefer small, easy steps over big plans, and say what to do first. Be warm and encouraging, never shaming: spending patterns are information, not failures. Keep every line short and plain.

Stay with budgeting, spending, bills, saving goals and groceries. Do not recommend specific investments, financial products, or tax or legal strategies; if asked about those, say briefly that a licensed adviser should help, and give the general budgeting side only. If the data is thin, say what's missing and still give what you can.`;

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  return origin && allowed.includes(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, authorization",
        Vary: "Origin",
      }
    : {};
}

/** Signed in to Meraki (a Supabase session for this project). */
async function allowed(request: Request, env: Env) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ") || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return false;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: auth } });
  return res.ok;
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json" } });
}

function claudeError(err: unknown, headers: Record<string, string>) {
  if (err instanceof Anthropic.RateLimitError) return json({ error: "Busy, try again in a minute" }, 429, headers);
  if (err instanceof Anthropic.AuthenticationError) return json({ error: "Server API key is wrong" }, 500, headers);
  if (err instanceof Anthropic.APIError) return json({ error: `Claude error ${err.status}` }, 502, headers);
  return json({ error: "Something went wrong" }, 500, headers);
}

/** One structured-output call. `fallbacks` may be newer than the SDK's type definitions, hence the cast. */
async function callClaude(env: Env, params: Record<string, unknown>) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  // Beta endpoint for the server-side fallback: if Claude Opus 5.5 ever
  // declines, the API retries on a fallback model in the same call.
  return client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    ...params,
  } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
}

async function statement(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  let pdf: string;
  let categories: { id: string; label: string }[] = [];
  try {
    const body = (await request.json()) as { pdf: string; categories?: { id: string; label: string }[] };
    pdf = body.pdf;
    categories = (Array.isArray(body.categories) ? body.categories : [])
      .filter((c) => typeof c?.id === "string" && typeof c?.label === "string")
      .slice(0, 60)
      .map((c) => ({ id: c.id.slice(0, 60), label: c.label.slice(0, 60) }));
  } catch {
    return json({ error: "send { pdf: base64, categories }" }, 400, headers);
  }
  const ids = [...new Set(categories.map((c) => c.id))];
  const list = categories.map((c) => `- ${c.id}: ${c.label}`).join("\n");
  if (!pdf || pdf.length * 0.75 > MAX_PDF_BYTES) return json({ error: "PDF missing or too big" }, 400, headers);

  try {
    // A long statement can mean hundreds of lines, so this one streams (no request timeout).
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const response = await client.beta.messages
      .stream({
        model: "claude-opus-5-5",
        max_tokens: 64000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: statementSchema(ids.length ? ids : ["other"]) } },
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
              { type: "text", text: `${STATEMENT_PROMPT}\n\nCategory ids to choose from:\n${list || "- other: Other"}` },
            ],
          },
        ],
      } as unknown as Anthropic.Beta.MessageCreateParamsStreaming)
      .finalMessage();
    if (response.stop_reason === "refusal") return json({ error: "Couldn't read this statement" }, 422, headers);
    if (response.stop_reason === "max_tokens") return json({ error: "Statement too long to read in one go. Try a shorter period." }, 422, headers);
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ error: "No result" }, 502, headers);
    const result = JSON.parse(text.text);
    if (!result.readable) return json({ error: "That doesn't look like a bank statement" }, 422, headers);
    return json(result, 200, headers);
  } catch (err) {
    return claudeError(err, headers);
  }
}

async function read(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  let image: string;
  try {
    ({ image } = (await request.json()) as { image: string });
  } catch {
    return json({ error: "send { image: base64 }" }, 400, headers);
  }
  if (!image || image.length * 0.75 > MAX_IMAGE_BYTES) return json({ error: "photo missing or too big" }, 400, headers);

  try {
    const response = await callClaude(env, {
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
    });
    if (response.stop_reason === "refusal") return json({ error: "Couldn't read this receipt" }, 422, headers);
    if (response.stop_reason === "max_tokens") return json({ error: "Receipt too long to read in one go" }, 422, headers);
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ error: "No result" }, 502, headers);
    const receipt = JSON.parse(text.text);
    if (!receipt.readable) return json({ error: "That doesn't look like a readable receipt" }, 422, headers);
    return json(receipt, 200, headers);
  } catch (err) {
    return claudeError(err, headers);
  }
}

async function advise(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  let summary: unknown;
  let question = "";
  try {
    const body = (await request.json()) as { summary: unknown; question?: string };
    summary = body.summary;
    question = String(body.question ?? "").slice(0, 500);
  } catch {
    return json({ error: "send { summary, question }" }, 400, headers);
  }
  const data = JSON.stringify(summary ?? {});
  if (data.length > 200_000) return json({ error: "Too much data to look at in one go" }, 400, headers);

  try {
    const response = await callClaude(env, {
      system: ADVICE_SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: ADVICE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `<money>\n${data}\n</money>\n\n${question ? `My question: ${question}` : "Give me my money check-in."}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return json({ error: "Couldn't answer that one" }, 422, headers);
    if (response.stop_reason === "max_tokens") return json({ error: "The answer got too long, try a narrower question" }, 422, headers);
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ error: "No result" }, 502, headers);
    return json(JSON.parse(text.text), 200, headers);
  } catch (err) {
    return claudeError(err, headers);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(request.headers.get("Origin"), env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const path = new URL(request.url).pathname;
    if (request.method !== "POST" || !["/read", "/advise", "/statement", "/push-run"].includes(path)) {
      return json({ error: "not found" }, 404, headers);
    }
    if (!headers["Access-Control-Allow-Origin"]) return json({ error: "origin not allowed" }, 403, headers);
    if (!(await allowed(request, env))) {
      return json({ error: "Sign in under Settings → Sync to use this." }, 401, headers);
    }
    if (path === "/push-run") {
      try {
        return json({ setup: pushSetup(env), report: pushConfigured(env) ? await sendDuePushes(env) : null }, 200, headers);
      } catch (err) {
        return json({ setup: pushSetup(env), error: String(err instanceof Error ? err.message : err).slice(0, 500) }, 200, headers);
      }
    }
    if (path === "/statement") return statement(request, env, headers);
    return path === "/advise" ? advise(request, env, headers) : read(request, env, headers);
  },

  // Every 5 minutes: send due phone reminders. This also keeps the free Supabase project from
  // pausing for being idle (before notifications are set up, a tiny query does that instead).
  async scheduled(_event: unknown, env: Env): Promise<void> {
    if (pushConfigured(env)) {
      try {
        await sendDuePushes(env);
      } catch (err) {
        console.error("Push round failed", err);
      }
      return;
    }
    console.warn("Push not set up", JSON.stringify(pushSetup(env)));
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return;
    await fetch(`${env.SUPABASE_URL}/rest/v1/meraki_data?select=key&limit=1`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
    });
  },
};
