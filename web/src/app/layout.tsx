import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3311";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "Vāyu Lekha · India's methane super-emitters, read from orbit",
  description:
    "Every clear Sentinel-5P/TROPOMI pass over India since 2023, screened for persistent point sources and separated from the agricultural background. Built as the Jantar Mantar of methane.",
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
