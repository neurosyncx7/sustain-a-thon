import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PS-13-S3 — India Methane Super-Emitters",
  description:
    "A real Sentinel-5P/TROPOMI + ERA5 pipeline screening India for persistent point-source methane emitters.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
