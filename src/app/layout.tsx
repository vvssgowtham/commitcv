import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Titillium_Web } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const titillium = Titillium_Web({ variable: "--font-titillium", subsets: ["latin"], weight: ["400", "600", "700"] });
const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Resumate AI",
  description: "Tailored, ATS-friendly resumes for every job",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${titillium.variable} ${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-white text-black">{children}</body>
    </html>
  );
}
