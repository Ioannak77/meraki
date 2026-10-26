"use client";

// Today's weather on Today: temperature, high and low, chance of rain, and a small tip. The place
// is your location (if you allow it) or a town you type; it stays on this device.

import { useEffect, useState } from "react";
import { describe, findPlace, getWeather, locate, savePlace, savedPlace, weatherTip, type Place, type Weather } from "@/lib/weather";

export function WeatherCard({ evening }: { evening: boolean }) {
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

  if (!loaded) return null;

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
    return message ? <p className="rounded-3xl bg-card p-5 text-[15px] text-muted">{message}</p> : null;
  }

  const now = describe(weather.code);
  const tip = weatherTip(weather);
  const tomorrow = describe(weather.tomorrow.code);
  return (
    <section className="rounded-3xl bg-card p-5">
      <div className="flex items-center gap-4">
        <span className="text-[40px] leading-none">{now.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[28px] font-bold leading-tight">
            {weather.temp}°<span className="ml-2 text-[15px] font-normal text-muted">{now.text}</span>
          </p>
          <p className="text-[13px] text-muted">
            High {weather.high}° · low {weather.low}° · {weather.rain}% rain
          </p>
        </div>
        <button type="button" onClick={() => setAsking(true)} className="shrink-0 self-start text-xs text-muted" aria-label="Change place">
          {place.name.split(",")[0]} ›
        </button>
      </div>
      {tip && <p className="mt-3 rounded-2xl bg-cream px-3 py-2 text-[14px]">{tip}</p>}
      {evening && (
        <p className="mt-2 text-[13px] text-muted">
          Tomorrow: {tomorrow.icon} {weather.tomorrow.high}° / {weather.tomorrow.low}° · {weather.tomorrow.rain}% rain
        </p>
      )}
    </section>
  );
}
