"use client";

// The top of Today: the weather (temperature, high and low, chance of rain, a small tip) with your
// progress rings beside it. The place is your location (if you allow it) or a town you type; it
// stays on this device. Until there's a place, `fallback` (the full-size rings) shows instead.

import { useEffect, useState } from "react";
import { describe, findPlace, getWeather, locate, savePlace, savedPlace, uvAdvice, weatherTip, type Place, type Weather } from "@/lib/weather";

/** The card's tint follows the sky: warm when clear, blue-grey when cloudy or wet. */
function tint(code: number) {
  if (code <= 1) return "from-sun/25";
  if (code <= 3 || code <= 48) return "from-sky-soft";
  return "from-sky-soft via-sky-soft/60";
}

export function WeatherCard({
  evening,
  progress,
  fallback,
}: {
  evening: boolean;
  progress: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const [place, setPlace] = useState<Place | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [asking, setAsking] = useState(false); // choosing a place
  const [town, setTown] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setPlace(savedPlace());
      setLoaded(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!place) return;
    let gone = false;
    getWeather(place)
      .then((w) => !gone && setWeather(w))
      .catch(() => !gone && setMessage("Couldn't get the weather right now."));
    return () => {
      gone = true;
    };
  }, [place]);

  function choose(p: Place) {
    savePlace(p);
    setWeather(null);
    setMessage(null);
    setAsking(false);
    setPlace(p);
  }

  if (!loaded) return <>{fallback}</>;

  // No place yet: the rings as before, with a small way to add the weather.
  if (!place && !asking) {
    return (
      <>
        {fallback}
        <button type="button" onClick={() => setAsking(true)} className="mx-auto mt-3 block text-sm font-semibold text-sage-dark">
          🌤️ Show the weather here
        </button>
      </>
    );
  }

  if (!place || asking) {
    return (
      <section className="rounded-3xl bg-card p-5">
        <h2 className="text-lg font-bold">Weather</h2>
        <p className="text-[15px] text-muted">Show today&apos;s weather here. Your place stays on this device.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              locate()
                .then(choose)
                .catch(() => setMessage("Location isn't allowed. Type your town instead."))
            }
            className="rounded-2xl bg-sage-dark px-4 py-2.5 text-sm font-bold text-white"
          >
            📍 Use my location
          </button>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!town.trim()) return;
              const p = await findPlace(town.trim()).catch(() => null);
              if (p) choose(p);
              else setMessage("Couldn't find that town. Try another spelling.");
            }}
            className="flex flex-1 gap-2"
          >
            <input
              value={town}
              onChange={(e) => setTown(e.target.value)}
              placeholder="or a town, e.g. Limassol"
              className="min-w-0 flex-1 rounded-2xl border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-sage"
            />
            <button type="submit" className="rounded-2xl bg-sage-soft px-3 text-sm font-bold text-sage-dark">
              Go
            </button>
          </form>
        </div>
        {message && <p className="mt-2 text-sm text-peach">{message}</p>}
        {place && (
          <button type="button" onClick={() => setAsking(false)} className="mt-2 text-sm font-semibold text-muted underline">
            Keep {place.name}
          </button>
        )}
      </section>
    );
  }

  if (!weather) {
    return (
      <>
        {fallback}
        {message && <p className="mt-2 text-center text-sm text-muted">{message}</p>}
      </>
    );
  }

  const now = describe(weather.code);
  const tip = weatherTip(weather);
  // A forecast saved before UV was added has none: no UV line until a fresh one arrives.
  const hasUv = typeof weather.uv === "number";
  const uv = hasUv ? uvAdvice(weather.uv) : null;
  const tomorrow = describe(weather.tomorrow.code);
  return (
    <section className={`rounded-3xl bg-gradient-to-br ${tint(weather.code)} to-card p-5 shadow-[0_1px_2px_rgba(60,50,40,0.04)]`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[34px] leading-none">{now.icon}</span>
            <span className="text-[34px] font-bold leading-none">{weather.temp}°</span>
          </div>
          <p className="mt-1.5 truncate text-[14px] font-semibold">{now.text}</p>
          <p className="truncate text-[12px] text-muted">
            ↑{weather.high}° ↓{weather.low}° · ☔ {weather.rain}%{hasUv ? ` · UV ${weather.uv}` : ""}
          </p>
          <button type="button" onClick={() => setAsking(true)} className="mt-0.5 text-[11px] text-muted" aria-label="Change place">
            {place.name.split(",")[0]} ›
          </button>
        </div>
        <div className="flex shrink-0 gap-2.5 md:gap-5">{progress}</div>
      </div>
      {/* Sunscreen from the UV, always shown: a must from UV 3. */}
      <div className="mt-3 space-y-1 border-t border-line/70 pt-3 text-[13px]">
        {uv && <p className={uv.must ? "font-semibold text-peach" : "text-muted"}>🧴 {uv.text}</p>}
        {tip && <p>{tip}</p>}
        {evening && (
          <p className="text-muted">
            Tomorrow {tomorrow.icon} ↑{weather.tomorrow.high}° ↓{weather.tomorrow.low}° · ☔ {weather.tomorrow.rain}%{typeof weather.tomorrow.uv === "number" ? ` · UV ${weather.tomorrow.uv}` : ""}
          </p>
        )}
      </div>
    </section>
  );
}
