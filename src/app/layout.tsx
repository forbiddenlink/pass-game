import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Interrogator's voice + display — a literary, optical serif with real character.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});
// UI / labels — quiet humanist sans.
const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
// Ciphertext ONLY — mono is diegetic here (the machine's tongue), not decoration.
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PASS · a solstice interrogation",
  description:
    "Crack the interrogator's ciphers and answer human enough to be believed, before the solstice sun sets. An Alan Turing tribute. Judged live by Gemini.",
  openGraph: {
    title: "PASS · a solstice interrogation",
    description: "You are the machine. Answer well. An Alan Turing tribute, judged live by Gemini.",
    images: ["/og.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PASS · a solstice interrogation",
    description: "You are the machine. Answer well. An Alan Turing tribute, judged live by Gemini.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
