import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { FinanceProvider } from "@/lib/financeStore";
import { AppShell } from "@/components/AppShell";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meraki",
  description: "Cleaning, tasks, money and gentle progress, one manageable day at a time.",
  appleWebApp: { capable: true, title: "Meraki", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#f6f1ea",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <StoreProvider>
          <FinanceProvider>
            <AppShell>{children}</AppShell>
          </FinanceProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
