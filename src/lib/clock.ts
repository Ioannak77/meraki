// The app's idea of "today". Normally the real date; for testing it can be
// set to another day (Settings > Testing) to preview month-end lists etc.
// The time of day stays real, so morning/evening lists still follow the clock.

let testDate: string | null = null; // "YYYY-MM-DD"

export function setTestDate(date: string | null) {
  testDate = date;
}

export function realToday() {
  return new Date();
}

export function today(override: string | null | undefined = testDate) {
  const real = new Date();
  if (!override) return real;
  const [y, m, d] = override.split("-").map(Number);
  return new Date(y, m - 1, d, real.getHours(), real.getMinutes(), real.getSeconds());
}
