"use client";

// Settings > More settings: links to the settings that live on their own pages.

import Link from "next/link";

const LINKS = [
  { href: "/self-care/#skincare", label: "Skincare times", note: "Morning and evening steps and times" },
  { href: "/self-care/#reminders", label: "Self-care reminders", note: "Waxing, nails, hair and more" },
];

export function OtherSettingsCard() {
  return (
    <section className="mt-5 rounded-3xl bg-card p-5">
      <h2 className="text-lg font-bold">More settings</h2>
      <ul className="mt-2 divide-y divide-line">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex items-center gap-3 py-3">
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">{l.label}</span>
                <span className="block text-[13px] text-muted">{l.note}</span>
              </span>
              <span className="text-muted">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
