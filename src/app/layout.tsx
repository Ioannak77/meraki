import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { FinanceProvider } from "@/lib/financeStore";
import { SkinProvider } from "@/lib/skinStore";
import { GroceriesProvider } from "@/lib/groceriesStore";
import { AppShell } from "@/components/AppShell";
import { OfflineSupport } from "@/components/OfflineSupport";
import { SyncStart } from "@/components/SyncStart";
import { CareMove } from "@/components/CareMove";
import { PushScheduler } from "@/components/PushScheduler";
import { ThemeApply } from "@/components/ThemeApply";
import { BASE } from "@/lib/base";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meraki",
  description: "Cleaning, tasks, money and gentle progress, one manageable day at a time.",
  appleWebApp: { capable: true, title: "Meraki", statusBarStyle: "default" },
  icons: { icon: `${BASE}/icon.svg`, apple: `${BASE}/apple-touch-icon.png` },
};

export const viewport: Viewport = {
  themeColor: "#f6f1ea",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: the page shrinks above the keyboard, so a sheet's Save button stays reachable.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`} data-theme="light" suppressHydrationWarning>
      <head>
        {/* The chosen theme before the first paint, so dark mode doesn't flash white. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=JSON.parse(localStorage.getItem("meraki.v1")||"{}");var t=(s.settings&&s.settings.theme)||"light";document.documentElement.dataset.theme=t;if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches)){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#1b1916")}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full font-sans">
        <StoreProvider>
          <FinanceProvider>
            <SkinProvider>
              <GroceriesProvider>
                <AppShell>{children}</AppShell>
                <PushScheduler />
                <ThemeApply />
                <OfflineSupport />
                <SyncStart />
                <CareMove />
              </GroceriesProvider>
            </SkinProvider>
          </FinanceProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
