import type { Metadata } from "next";
import { Playfair_Display, Space_Grotesk } from "next/font/google";

import { AppProviders } from "@/components/app-providers";

import "./globals.css";

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display"
});

const body = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Antique Catalogue",
  description: "Catalogue and preserve antique collections with custom metadata.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-stone-50 text-stone-950">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
