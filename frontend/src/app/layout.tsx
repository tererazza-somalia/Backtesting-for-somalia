import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ilyaas backtesting — Forex Strategy Backtester",
  description:
    "Test your forex trading strategies on years of historical data. Free, realistic backtesting with spread simulation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-tv-bg text-tv-text min-h-screen">{children}</body>
    </html>
  );
}
