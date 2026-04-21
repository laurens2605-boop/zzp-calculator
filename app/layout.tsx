import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: "variable",
});

export const metadata: Metadata = {
  title: "ZZP Calculator 2026 | Rocksolid Solutions",
  description:
    "Bereken je netto inkomen als ZZP'er — inclusief zelfstandigenaftrek en MKB-winstvrijstelling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={sora.className}>
      <body>{children}</body>
    </html>
  );
}
