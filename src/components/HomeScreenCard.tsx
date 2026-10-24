"use client";

// Settings > On your phone: how to add Meraki to the home screen. Hidden once it's opened from there.

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void> };

export function HomeScreenCard() {
  const [installed, setInstalled] = useState(true);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    const t = setTimeout(() => setInstalled(standalone), 0);
    // Android Chrome offers its own install button.
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (installed) return null;

  return (
    <section className="mt-5 rounded-3xl bg-card p-5">
      <h2 className="text-lg font-bold">Add to your home screen</h2>
      <p className="text-[15px] text-muted">
        Meraki then opens like an app, full screen, and works without internet.
      </p>
      {prompt ? (
        <button
          onClick={() => prompt.prompt().then(() => setPrompt(null))}
          className="mt-4 w-full rounded-2xl bg-sage-dark py-3 font-bold text-white"
        >
          Add Meraki
        </button>
      ) : (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[15px]">
          <li>Open this page in <strong>Safari</strong> (iPhone and iPad).</li>
          <li>
            Tap <strong>Share</strong> (the square with an arrow).
          </li>
          <li>
            Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </li>
        </ol>
      )}
      <p className="mt-3 text-[13px] text-muted">
        On iPhone and iPad the home screen app keeps its own data, separate from Safari, so add it first and use it from
        there.
      </p>
    </section>
  );
}
