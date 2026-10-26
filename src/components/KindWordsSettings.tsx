"use client";

// Settings > Kind words: your own affirmations and favourite quotes. They join the daily
// rotation on Today and in the afternoon notification.

import { useState } from "react";
import { KIND_WORDS } from "@/lib/kindWords";
import { useStore } from "@/lib/store";

export function KindWordsSettings() {
  const { settings, updateSettings } = useStore();
  const own = settings.kindWords ?? [];
  const [text, setText] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || own.includes(clean)) return;
    updateSettings({ kindWords: [...own, clean] });
    setText("");
  }

  return (
    <section className="mt-5 rounded-3xl bg-card p-5">
      <h2 className="text-lg font-bold">Kind words</h2>
      <p className="text-[15px] text-muted">
        Add your own: an affirmation, a quote you love, something someone said to you. They join the {KIND_WORDS.length} built-in
        ones, on Today and in the afternoon notification.
      </p>
      <form onSubmit={add} className="mt-4 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. I am allowed to go slowly."
          enterKeyHint="done"
          className="w-full rounded-2xl border border-line bg-cream px-4 py-3 text-base outline-none focus:border-sage"
        />
        <button type="submit" disabled={!text.trim()} className="shrink-0 rounded-2xl bg-sage-dark px-4 font-bold text-white disabled:opacity-40">
          Add
        </button>
      </form>
      {own.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {own.map((w) => (
            <li key={w} className="flex items-center gap-3 py-2.5">
              <span className="flex-1 text-[15px]">{w}</span>
              <button
                type="button"
                onClick={() => updateSettings({ kindWords: own.filter((x) => x !== w) })}
                aria-label={`Remove: ${w}`}
                className="px-1 text-muted"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
