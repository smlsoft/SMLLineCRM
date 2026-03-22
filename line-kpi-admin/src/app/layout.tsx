import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-headline",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LINE KPI Admin",
  description: "LINE OA Customer Support KPI Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${inter.variable} ${manrope.variable}`} suppressHydrationWarning>
      <body className="flex h-screen overflow-hidden antialiased">
        <ThemeProvider>
          <Sidebar />
          <main className="flex-1 overflow-y-auto min-h-0">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
