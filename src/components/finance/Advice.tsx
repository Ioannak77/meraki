"use client";

// Money > Advice: Claude looks over your money (bills, spending, budgets, goals, groceries) and
// says what's going well, what to watch and what to try. Ask a question too, e.g. "Can I afford
// a holiday in March?". The latest answer is kept (and synced) until you ask again.

import { useState } from "react";
import { askAdvice, hasMoneyData, moneySummary } from "@/lib/advice";
import { money } from "@/lib/finance";
import { useFinance } from "@/lib/financeStore";
import { useGroceries } from "@/lib/groceriesStore";
import { Card, inputClass } from "./ui";

const EXAMPLES = ["Where can I save €100 a month?", "Can I afford a €600 holiday in March?", "Am I on track with my emergency fund?"];

export function AdviceTab({ now }: { now: Date }) {
  const finance = useFinance();
  const { receipts } = useGroceries();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = finance.advice;
  const input = { now, income: finance.income, bills: finance.bills, txns: finance.txns, budgets: finance.budgets, weeklyAllowance: finance.weeklyAllowance, goals: finance.goals, receipts };

  async function ask(q: string) {
    setError(null);
    setBusy(true);
    try {
      const result = await askAdvice(moneySummary(input), q.trim());
      finance.saveAdvice({ at: new Date().toISOString(), question: q.trim(), result });
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get advice right now.");
    } finally {
      setBusy(false);
    }
  }

  if (!hasMoneyData(input)) {
    return (
      <Card>
        <p className="text-muted">
          Add your income, a few bills or a bank statement first, then Meraki can look it all over and give you advice.
        </p>
      </Card>
    );
  }

  const a = saved?.result;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <h2 className="text-lg font-bold">Ask about your money</h2>
        <p className="text-[15px] text-muted">
          Meraki looks over your income, bills, spending, budgets, goals and groceries, and tells you what&apos;s going well and
          what to try.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => ask("")}
          className="mt-4 w-full rounded-2xl bg-sage-dark py-3.5 text-[16px] font-bold text-white disabled:opacity-60"
        >
          {busy ? "Looking over your money…" : "✨ Give me my money check-in"}
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) void ask(question);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Or ask a question…"
            enterKeyHint="send"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="shrink-0 rounded-2xl bg-sage-soft px-4 font-bold text-sage-dark disabled:opacity-50"
          >
            Ask
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((q) => (
            <button key={q} type="button" disabled={busy} onClick={() => ask(q)} className="rounded-full bg-cream px-3 py-1.5 text-sm text-ink/80">
              {q}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-[15px] text-peach">{error}</p>}
        <p className="mt-3 text-xs text-muted">
          Uses Claude through your own worker (a few cents each time). Sends totals, bill names and categories, never bank
          details. Not a licensed financial adviser: for investments, tax or loans, check with one.
        </p>
      </Card>

      {a && (
        <>
          <Card className="lg:col-span-2">
            <p className="text-xs text-muted">
              {new Date(saved.at).toLocaleDateString(undefined, { day: "numeric", month: "long" })}
              {saved.question ? ` · “${saved.question}”` : " · Money check-in"}
            </p>
            <p className="mt-1 text-[17px] font-bold leading-snug">{a.headline}</p>
            {a.answer && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{a.answer}</p>}
          </Card>
          {a.going_well.length > 0 && <ListCard title="🌿 Going well" items={a.going_well} />}
          {a.watch.length > 0 && <ListCard title="👀 Worth watching" items={a.watch} />}
          {a.suggestions.length > 0 && (
            <Card className="lg:col-span-2">
              <h3 className="text-lg font-bold">💡 Things to try</h3>
              <ul className="mt-1 divide-y divide-line">
                {a.suggestions.map((s, i) => (
                  <li key={i} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-semibold">{s.title}</span>
                      {s.saves_per_month ? (
                        <span className="shrink-0 rounded-full bg-sage-soft px-2.5 py-0.5 text-sm font-semibold text-sage-dark">
                          saves {money(s.saves_per_month, true)}/mo
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[15px] text-muted">{s.detail}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <h3 className="text-lg font-bold">{title}</h3>
      <ul className="mt-2 grid gap-2">
        {items.map((t, i) => (
          <li key={i} className="text-[15px] leading-snug">
            {t}
          </li>
        ))}
      </ul>
    </Card>
  );
}
