// Simple line weather icons, drawn like the app's other icons (no emoji).

import type { Sky } from "@/lib/weather";

const SUN = "var(--color-sun)";
const CLOUD = "var(--color-muted)";
const RAIN = "var(--color-sky)";

function Sun({ cx = 24, cy = 24, r = 8 }: { cx?: number; cy?: number; r?: number }) {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
    const rad = (a * Math.PI) / 180;
    return [cx + Math.cos(rad) * (r + 4), cy + Math.sin(rad) * (r + 4), cx + Math.cos(rad) * (r + 8), cy + Math.sin(rad) * (r + 8)];
  });
  return (
    <g stroke={SUN} strokeWidth="3" strokeLinecap="round">
      <circle cx={cx} cy={cy} r={r} fill={SUN} stroke="none" />
      {rays.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </g>
  );
}

const cloudPath = "M14 36h22a8 8 0 0 0 0-16 11 11 0 0 0-21-2 8 8 0 0 0-1 18z";

export function WeatherIcon({ sky, className = "size-10" }: { sky: Sky; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden fill="none">
      {sky === "clear" && <Sun />}
      {sky === "partly" && (
        <>
          <Sun cx={18} cy={17} r={6} />
          <path d={cloudPath} fill="var(--color-card)" stroke={CLOUD} strokeWidth="3" strokeLinejoin="round" transform="translate(4 6)" />
        </>
      )}
      {(sky === "cloudy" || sky === "fog") && (
        <path d={cloudPath} fill="var(--color-card)" stroke={CLOUD} strokeWidth="3" strokeLinejoin="round" transform="translate(0 2)" />
      )}
      {sky === "fog" && (
        <g stroke={CLOUD} strokeWidth="3" strokeLinecap="round">
          <line x1="10" y1="43" x2="38" y2="43" />
        </g>
      )}
      {(sky === "rain" || sky === "storm" || sky === "snow") && (
        <path d={cloudPath} fill="var(--color-card)" stroke={CLOUD} strokeWidth="3" strokeLinejoin="round" transform="translate(0 -4)" />
      )}
      {sky === "rain" && (
        <g stroke={RAIN} strokeWidth="3" strokeLinecap="round">
          <line x1="17" y1="37" x2="15" y2="43" />
          <line x1="25" y1="37" x2="23" y2="43" />
          <line x1="33" y1="37" x2="31" y2="43" />
        </g>
      )}
      {sky === "snow" && (
        <g fill={RAIN}>
          <circle cx="16" cy="40" r="2" />
          <circle cx="24" cy="42" r="2" />
          <circle cx="32" cy="40" r="2" />
        </g>
      )}
      {sky === "storm" && <path d="M25 34l-5 7h5l-3 6" stroke={SUN} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}
