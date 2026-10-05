import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loan Register Cleaner",
  description: "Clean up a branch loan register in a few clicks",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}