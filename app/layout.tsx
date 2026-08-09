import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Osmium Shell Builder",
  description:
    "Build a custom pure TI-BASIC launcher for the TI-84 Plus CE, directly in your browser.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
