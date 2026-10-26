"use client";

// Layout frame: a sidebar on iPad/desktop (768px and wider) and a bottom tab
// bar on phones. Same screens either way.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dayKey } from "@/lib/store";
import { useNow } from "@/lib/useNow";
import { Icon, type IconName } from "./icons";

// `short` is the label under the icon in the phone tab bar, where space is tight.
const NAV: { href: string; label: string; short?: string; icon: IconName; phone: boolean }[] = [
  { href: "/", label: "Today", icon: "home", phone: true },
  { href: "/tasks/", label: "Tasks", icon: "tasks", phone: true },
  { href: "/cleaning/", label: "Cleaning schedule", short: "Cleaning", icon: "routines", phone: true },
  { href: "/finances/", label: "Money", icon: "wallet", phone: true },
  { href: "/groceries/", label: "Groceries", icon: "basket", phone: true },
  { href: "/self-care/", label: "Self care", icon: "heart", phone: true },
  { href: "/insights/", label: "Insights", icon: "insights", phone: false },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href.replace(/\/$/, ""));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // When the date changes (past midnight, or test mode), redraw every screen so
  // nothing keeps showing yesterday.
  const day = dayKey(useNow());

  return (
    <div className="md:flex md:min-h-dvh">
      <aside className="pt-safe sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 px-4 pb-6 md:flex lg:w-64">
        <Link href="/" className="mb-6 flex items-center gap-2 px-3 pt-2">
          <Icon.leaf className="size-7 text-sage" />
          <span className="text-xl font-bold">Meraki</span>
        </Link>
        {NAV.map((item) => {
          const Glyph = Icon[item.icon];
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-[color,background-color,border-color,transform] ${
                active ? "bg-sage-soft font-semibold text-sage-dark" : "text-ink/80 hover:bg-card"
              }`}
            >
              <Glyph className="size-5" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/settings/"
          className={`mt-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-[color,background-color,border-color,transform] ${
            isActive(pathname, "/settings/") ? "bg-sage-soft font-semibold text-sage-dark" : "text-ink/80 hover:bg-card"
          }`}
        >
          <Icon.settings className="size-5" />
          Settings
        </Link>
        <div className="mt-auto rounded-2xl bg-card/70 p-4 text-sm leading-snug text-muted">
          A calmer, more consistent you.
        </div>
      </aside>

      <main key={day} className="pt-safe min-w-0 flex-1 px-4 pb-44 md:px-8 md:pb-28">
        {children}
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-lg justify-around pt-2">
          {NAV.filter((n) => n.phone).map((item) => {
            const Glyph = Icon[item.icon];
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  className={`flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-1 text-[10px] ${
                    active ? "font-bold text-ink" : "text-muted"
                  }`}
                >
                  <Glyph className="size-6" />
                  {item.short ?? item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
