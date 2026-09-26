import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vāyu Lekha · India's methane super-emitters, read from orbit",
  description:
    "Two years of Sentinel-5P/TROPOMI over India, screened for persistent point sources and separated from the agricultural background. Built as the Jantar Mantar of methane.",
  openGraph: { images: ["/og.jpg"] },
};

export const viewport: Viewport = { themeColor: "#07080d" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#07080d] text-[#ece4d8] font-sans">{children}</body>
    </html>
  );
}
