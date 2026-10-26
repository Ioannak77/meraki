// Weather for Today, from Open-Meteo (free, no account). The place is kept on this device only:
// your location (if you allow it) or a town you type. Forecasts are cached for 30 minutes.

const PLACE_KEY = "merakiDevice.place";
const CACHE_KEY = "merakiDevice.weather";

export type Place = { name: string; lat: number; lon: number };
export type Weather = {
  at: number; // when it was fetched (ms)
  temp: number;
  code: number;
  high: number;
  low: number;
  rain: number; // highest chance of rain today, %
  tomorrow: { high: number; low: number; rain: number; code: number };
};

export function savedPlace(): Place | null {
  try {
    return JSON.parse(localStorage.getItem(PLACE_KEY) ?? "null");
  } catch {
    return null;
  }
}
export function savePlace(p: Place | null) {
  try {
    if (p) localStorage.setItem(PLACE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PLACE_KEY);
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}

/** The device's location, asking once. */
export function locate(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("no geolocation"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ name: "Your location", lat: pos.coords.latitude, lon: pos.coords.longitude }),
      reject,
      { maximumAge: 6 * 60 * 60 * 1000, timeout: 10000 },
    );
  });
}

/** A town by name, e.g. "Limassol". */
export async function findPlace(name: string): Promise<Place | null> {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(name)}`);
  const data = (await res.json()) as { results?: { name: string; country?: string; latitude: number; longitude: number }[] };
  const r = data.results?.[0];
  return r ? { name: r.country ? `${r.name}, ${r.country}` : r.name, lat: r.latitude, lon: r.longitude } : null;
}

export async function getWeather(p: Place): Promise<Weather> {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as Weather | null;
    if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached;
  } catch {}
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
    "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code" +
    "&timezone=auto&forecast_days=2";
  const d = await (await fetch(url)).json();
  const w: Weather = {
    at: Date.now(),
    temp: Math.round(d.current.temperature_2m),
    code: d.current.weather_code,
    high: Math.round(d.daily.temperature_2m_max[0]),
    low: Math.round(d.daily.temperature_2m_min[0]),
    rain: d.daily.precipitation_probability_max[0] ?? 0,
    tomorrow: {
      high: Math.round(d.daily.temperature_2m_max[1]),
      low: Math.round(d.daily.temperature_2m_min[1]),
      rain: d.daily.precipitation_probability_max[1] ?? 0,
      code: d.daily.weather_code[1],
    },
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(w));
  } catch {}
  return w;
}

/** WMO weather code → emoji and a word. */
export function describe(code: number): { icon: string; text: string } {
  if (code === 0) return { icon: "☀️", text: "Clear" };
  if (code <= 2) return { icon: "🌤️", text: "Partly cloudy" };
  if (code === 3) return { icon: "☁️", text: "Cloudy" };
  if (code <= 48) return { icon: "🌫️", text: "Fog" };
  if (code <= 57) return { icon: "🌦️", text: "Drizzle" };
  if (code <= 67) return { icon: "🌧️", text: "Rain" };
  if (code <= 77) return { icon: "🌨️", text: "Snow" };
  if (code <= 82) return { icon: "🌦️", text: "Showers" };
  return { icon: "⛈️", text: "Thunderstorms" };
}

/** A small, useful nudge from the forecast (or null). */
export function weatherTip(w: Weather) {
  if (w.rain >= 60) return "Rain likely: dry the laundry inside today.";
  if (w.high >= 33) return "Very hot: water Pari's bowl often and walk her early or late.";
  if (w.high >= 22 && w.rain < 20) return "Dry and warm: a good day to hang laundry outside.";
  return null;
}
