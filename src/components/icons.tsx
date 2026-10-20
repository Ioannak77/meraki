// Small line icons, drawn to match the soft, rounded look of the design.

type IconProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const Icon = {
  home: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z" />
    </svg>
  ),
  tasks: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  ),
  routines: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <path d="M19.5 9A8 8 0 0 0 5 7.5M4.5 15A8 8 0 0 0 19 16.5" />
      <path d="M19.5 4v5h-5M4.5 20v-5h5" />
    </svg>
  ),
  calendar: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <rect x="4" y="5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8.5 3v4M15.5 3v4" />
    </svg>
  ),
  wallet: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <rect x="3.5" y="6" width="17" height="13" rx="2.5" />
      <path d="M3.5 10h17M15.5 14.5h2" />
    </svg>
  ),
  insights: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <path d="M5 20v-6M10 20V9M15 20v-8M20 20V5" />
    </svg>
  ),
  tracker: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 9h8M8 13h5M8 17h3" />
    </svg>
  ),
  settings: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </svg>
  ),
  heart: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <path d="M12 19.5s-7.5-4.4-7.5-10A4 4 0 0 1 12 7a4 4 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z" />
    </svg>
  ),
  briefcase: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <rect x="3.5" y="7" width="17" height="12.5" rx="2.5" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" />
    </svg>
  ),
  paw: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <ellipse cx="12" cy="16" rx="4.5" ry="3.8" />
      <circle cx="6.5" cy="10.5" r="1.8" />
      <circle cx="10" cy="6.8" r="1.8" />
      <circle cx="14" cy="6.8" r="1.8" />
      <circle cx="17.5" cy="10.5" r="1.8" />
    </svg>
  ),
  car: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <path d="M4 16.5V12l2-5h12l2 5v4.5" />
      <path d="M3.5 12h17v4.5h-17z" />
      <circle cx="7.5" cy="17.5" r="1.7" />
      <circle cx="16.5" cy="17.5" r="1.7" />
    </svg>
  ),
  leaf: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z" />
      <path d="M5 19c3-4 6-7 10-9" />
    </svg>
  ),
  plus: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  check: ({ className }: IconProps) => (
    <svg {...base} strokeWidth={2.6} className={className}>
      <path d="m6 12.5 4 4 8-9" />
    </svg>
  ),
  bolt: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />
    </svg>
  ),
  more: ({ className }: IconProps) => (
    <svg {...base} strokeWidth={2.6} className={className}>
      <path d="M6 12h.01M12 12h.01M18 12h.01" />
    </svg>
  ),
  note: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <path d="M6 3.5h9l3.5 3.5v13.5H6z" />
      <path d="M9 11h6M9 15h4" />
    </svg>
  ),
  bill: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8.5h6M9 12h6" />
    </svg>
  ),
  close: ({ className }: IconProps) => (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  sun: ({ className }: IconProps) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <circle cx="24" cy="24" r="9" fill="#f4b860" />
      <g stroke="#f4b860" strokeWidth="3" strokeLinecap="round">
        <path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.6 10.6l3.5 3.5M33.9 33.9l3.5 3.5M10.6 37.4l3.5-3.5M33.9 14.1l3.5-3.5" />
      </g>
    </svg>
  ),
  moon: ({ className }: IconProps) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path d="M31 8a17 17 0 1 0 9 26A14 14 0 0 1 31 8z" fill="#9db6cf" />
    </svg>
  ),
};

export type IconName = keyof typeof Icon;
