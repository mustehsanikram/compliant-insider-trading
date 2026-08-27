import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Insider Trading Compliance Portal",
  description: "White-label employee insider trading compliance portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
