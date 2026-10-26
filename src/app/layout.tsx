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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`} data-theme="light" suppressHydrationWarning>
      <head>
        {/* The chosen theme before the first paint, so dark mode doesn't flash white. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=JSON.parse(localStorage.getItem("meraki.v1")||"{}");document.documentElement.dataset.theme=(s.settings&&s.settings.theme)||"light"}catch(e){}`,
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
              </GroceriesProvider>
            </SkinProvider>
          </FinanceProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
